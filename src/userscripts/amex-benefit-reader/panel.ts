import type {
  NormalizedBenefitObservation,
  ObservedField,
  QuantityV1,
  ScanSummaryV1,
  SourcePeriodV2,
  StoreEnvelopeV1,
  StoredCardRecordV1,
} from "@/lib/amex-benefit-reader/contract";
import {
  BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS,
  type BenefitIdentityConflictCandidateDetail,
  type BenefitIdentityConflictDetail,
  type BenefitIdentityConflictDetailSet,
  type BenefitIdentityConflictDiagnostic,
  type ConflictDiagnosticField,
} from "@/lib/amex-benefit-reader/amex-response-adapter";
import { fixedErrorMessage } from "@/lib/amex-benefit-reader/storage-policy";
import type { ScanProgress, ScanReporter } from "@/lib/amex-benefit-reader/scan-engine";
import { formatAmexBenefitTitle } from "./provider-text";

export const AMEX_READER_HOST_ID = "perks-reminder-amex-reader";

export interface PanelActions {
  startScan(): Promise<void>;
  cancelScan(): void;
  syncReviewed?(): Promise<void>;
  clearData(): Promise<void>;
}

export interface PanelOptions {
  initiallyCollapsed?: boolean;
  requiresReloadAfterClear?: boolean;
}

type BenefitFilter = "remaining" | "used";
type BenefitTone = "amber" | "blue" | "green" | "muted";
type QualityTone = "good" | "note" | "warning" | "error";

export type BenefitUsageLabel =
  | "Not used"
  | "Partially used"
  | "Used"
  | "Enrollment required"
  | "Link required"
  | "Status unavailable";

export interface BenefitUsagePresentation {
  label: BenefitUsageLabel;
  tone: BenefitTone;
  filter: BenefitFilter;
}

interface BenefitPresentation extends BenefitUsagePresentation {
  amount: string | null;
  period: string | null;
}

interface QualityPresentation {
  label: string;
  tone: QualityTone;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (text != null) result.textContent = text;
  return result;
}

function formatDate(value: string | null): string {
  if (!value) return "No observation";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

const COMPACT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

function calendarDateParts(value: string): CalendarDateParts {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function compactExplicitDateRange(start: CalendarDateParts, end: CalendarDateParts): string {
  const startMonth = COMPACT_MONTHS[start.month - 1];
  const endMonth = COMPACT_MONTHS[end.month - 1];
  if (start.year === end.year && start.month === end.month) {
    return `${startMonth} ${start.day}–${end.day}, ${start.year}`;
  }
  if (start.year === end.year) {
    return `${startMonth} ${start.day}–${endMonth} ${end.day}, ${start.year}`;
  }
  return `${startMonth} ${start.day}, ${start.year}–${endMonth} ${end.day}, ${end.year}`;
}

export function formatAmexSourcePeriod(period: SourcePeriodV2): string {
  const start = calendarDateParts(period.startDate);
  const end = calendarDateParts(period.endDate);
  const startsOnMonthBoundary = start.day === 1;
  const endsOnMonthBoundary = end.day === lastDayOfMonth(end.year, end.month);
  if (startsOnMonthBoundary && endsOnMonthBoundary && start.year === end.year) {
    if (start.month === 1 && end.month === 12) return String(start.year);
    if (start.month === end.month) return `${COMPACT_MONTHS[start.month - 1]} ${start.year}`;
    return `${COMPACT_MONTHS[start.month - 1]}–${COMPACT_MONTHS[end.month - 1]} ${start.year}`;
  }
  return compactExplicitDateRange(start, end);
}

function quantityText(quantity: QuantityV1): string {
  if (quantity.unit === "USD") return `$${quantity.value}`;
  if (quantity.unit === "percent") return `${quantity.value}%`;
  if (quantity.unit === "points") return `${quantity.value} points`;
  if (quantity.unit === "count") return `${quantity.value} count`;
  return quantity.value;
}

function observedValue<T>(field: ObservedField<T>): T | null {
  return field.state === "observed" ? field.value : null;
}

function quantitiesAreCompatible(left: QuantityV1, right: QuantityV1): boolean {
  return left.unit !== "unknown"
    && right.unit !== "unknown"
    && left.unit === right.unit
    && left.currency === right.currency;
}

interface DecimalParts {
  integer: string;
  fraction: string;
}

function nonnegativeDecimalParts(value: string): DecimalParts | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  return {
    integer: match[1].replace(/^0+(?=\d)/, ""),
    fraction: (match[2] ?? "").replace(/0+$/, ""),
  };
}

function compareNonnegativeDecimals(left: string, right: string): -1 | 0 | 1 | null {
  const leftParts = nonnegativeDecimalParts(left);
  const rightParts = nonnegativeDecimalParts(right);
  if (!leftParts || !rightParts) return null;
  if (leftParts.integer.length !== rightParts.integer.length) {
    return leftParts.integer.length < rightParts.integer.length ? -1 : 1;
  }
  if (leftParts.integer !== rightParts.integer) return leftParts.integer < rightParts.integer ? -1 : 1;
  const fractionLength = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const leftFraction = leftParts.fraction.padEnd(fractionLength, "0");
  const rightFraction = rightParts.fraction.padEnd(fractionLength, "0");
  if (leftFraction === rightFraction) return 0;
  return leftFraction < rightFraction ? -1 : 1;
}

function compareUsageToPositiveTarget(current: QuantityV1 | null, target: QuantityV1 | null): -1 | 0 | 1 | null {
  if (!current || !target || !quantitiesAreCompatible(current, target)) return null;
  const targetVsZero = compareNonnegativeDecimals(target.value, "0");
  if (targetVsZero !== 1) return null;
  return compareNonnegativeDecimals(current.value, target.value);
}

function isObservedZero(quantity: QuantityV1 | null): boolean {
  return quantity !== null && compareNonnegativeDecimals(quantity.value, "0") === 0;
}

function observationQuality(record: StoredCardRecordV1): QualityPresentation {
  if (record.freshness === "error_no_data") return { label: "Could not read", tone: "error" };
  if (record.freshness === "stale_error") return { label: "Stale data", tone: "warning" };
  if (record.completeness === "partial") return { label: "Partial data", tone: "note" };
  return { label: "Current", tone: "good" };
}

function confidenceSummary(benefits: NormalizedBenefitObservation[]): string {
  if (!benefits.length) return "No benefit observations";
  const counts = { high: 0, medium: 0, low: 0 };
  benefits.forEach((benefit) => {
    counts[benefit.confidence] += 1;
  });
  return (["high", "medium", "low"] as const)
    .filter((confidence) => counts[confidence] > 0)
    .map((confidence) => `${counts[confidence]} ${confidence}`)
    .join(", ");
}

export function deriveBenefitUsageState(benefit: NormalizedBenefitObservation): BenefitUsagePresentation {
  const completion = observedValue(benefit.completionState);
  const tracker = observedValue(benefit.trackerState);
  const enrollment = observedValue(benefit.enrollmentState);
  const current = observedValue(benefit.earnedOrUsed);
  const target = observedValue(benefit.targetOrLimit);
  const quantityComparison = compareUsageToPositiveTarget(current, target);

  if (enrollment === "required") return { label: "Enrollment required", tone: "amber", filter: "remaining" };
  if (enrollment === "linking_required") return { label: "Link required", tone: "amber", filter: "remaining" };
  if (
    completion === "complete"
    || tracker === "earned"
    || tracker === "completed"
    || benefit.activityKind === "credit_earned"
    || benefit.activityKind === "completed"
    || quantityComparison === 0
    || quantityComparison === 1
  ) {
    return { label: "Used", tone: "green", filter: "used" };
  }
  if (quantityComparison === -1 && isObservedZero(current)) {
    return { label: "Not used", tone: "amber", filter: "remaining" };
  }
  if (tracker === "in_progress" || quantityComparison === -1) {
    return { label: "Partially used", tone: "blue", filter: "remaining" };
  }
  if (tracker === "not_started") {
    return { label: "Not used", tone: "amber", filter: "remaining" };
  }
  return { label: "Status unavailable", tone: "muted", filter: "remaining" };
}

function benefitPeriodText(benefit: NormalizedBenefitObservation): string | null {
  if ("sourcePeriod" in benefit) {
    const sourcePeriod = observedValue(benefit.sourcePeriod);
    if (sourcePeriod) return formatAmexSourcePeriod(sourcePeriod);
  }
  return observedValue(benefit.period);
}

function benefitPresentation(benefit: NormalizedBenefitObservation): BenefitPresentation {
  const state = deriveBenefitUsageState(benefit);
  const current = observedValue(benefit.earnedOrUsed);
  const target = observedValue(benefit.targetOrLimit);
  let amount: string | null = null;

  if (current && target && quantitiesAreCompatible(current, target)) {
    amount = `${quantityText(current)} of ${quantityText(target)}`;
  } else if (current && !target && current.unit !== "unknown") {
    amount = `Used ${quantityText(current)}`;
  } else if (!current && target && target.unit !== "unknown") {
    amount = `Total ${quantityText(target)}`;
  }

  return {
    ...state,
    amount,
    period: benefitPeriodText(benefit),
  };
}

function scanSummaryText(summary: ScanSummaryV1): string {
  const count = `${summary.attemptedCardCount} card${summary.attemptedCardCount === 1 ? "" : "s"}`;
  if (summary.status === "complete") return `Scan complete. ${count} updated.`;
  if (summary.status === "partial") return `Scan finished with data notes. ${count} checked.`;
  if (summary.status === "interrupted") {
    const verb = summary.attemptedCardCount === 1 ? "was" : "were";
    return `Scan interrupted after ${count} ${verb} checked. Nothing resumes automatically.`;
  }
  return `Scan failed safely. ${count} checked; existing local observations were preserved.`;
}

function sortedCards(store: StoreEnvelopeV1): StoredCardRecordV1[] {
  return Object.values(store.cards).sort((left, right) =>
    left.identity.productName.localeCompare(right.identity.productName)
    || left.identity.endingDigits.localeCompare(right.identity.endingDigits));
}

export type CardCoverageKind =
  | "benefit_bearing"
  | "confirmed_empty"
  | "latest_scan_unresolved"
  | "older_retained";

export interface CardCoverageEntry {
  record: StoredCardRecordV1;
  kind: CardCoverageKind;
}

function isConfirmedEmptyInLatestScan(
  record: StoredCardRecordV1,
  summary: ScanSummaryV1,
  dispositions: NonNullable<ScanSummaryV1["cards"]>,
): boolean {
  const cardDispositions = dispositions.filter((card) => card.localCardId === record.localCardId);
  if (cardDispositions.length !== 1 || cardDispositions[0].result !== "complete") return false;
  if (
    !record.latest
    || record.latest.benefits.length !== 0
    || record.freshness !== "current"
    || record.completeness !== "complete"
    || record.latest.completeness !== "complete"
  ) return false;
  return record.latest.contractVersion !== "amex-benefits/2"
    || summary.scanId === undefined
    || record.latest.scanId === summary.scanId;
}

export function projectCardCoverage(store: StoreEnvelopeV1): CardCoverageEntry[] {
  const cards = sortedCards(store);
  const summary = store.lastScan;
  const latestCardIds = new Set(summary?.cards.flatMap((card) => card.localCardId ? [card.localCardId] : []) ?? []);
  return cards.map((record) => {
    if (!summary || !latestCardIds.has(record.localCardId)) return { record, kind: "older_retained" };
    if ((record.latest?.benefits.length ?? 0) > 0) return { record, kind: "benefit_bearing" };
    if (isConfirmedEmptyInLatestScan(record, summary, summary.cards)) return { record, kind: "confirmed_empty" };
    return { record, kind: "latest_scan_unresolved" };
  });
}

function filterLabel(filter: BenefitFilter): string {
  return filter === "remaining" ? "Remaining" : "Used";
}

const CONFLICT_DIAGNOSTIC_LABELS: Record<BenefitIdentityConflictDiagnostic, string> = {
  tracker_state_collision: "Conflicting tracker states",
  tracker_catalog_key_mismatch: "Tracker and benefit details matched different credits",
  ambiguous_catalog_join: "Benefit details could not be joined safely",
  tracker_catalog_candidate_collision: "Tracker and enrollment details conflicted",
};

const CONFLICT_SOURCE_LABELS: Record<BenefitIdentityConflictCandidateDetail["sourceRole"], string> = {
  tracker: "Tracker",
  joined_catalog: "Joined benefit details",
  catalog_enrollment_candidate: "Enrollment candidate",
};

interface PanelConflictState {
  diagnostics: BenefitIdentityConflictDiagnostic[];
  detailSet: BenefitIdentityConflictDetailSet;
}

function creditFamilyLabel(creditKey: string): string {
  return creditKey.slice(creditKey.lastIndexOf(":") + 1);
}

function diagnosticFieldText<T>(
  field: ConflictDiagnosticField<T>,
  format: (value: T) => string = (value) => String(value),
): string {
  if (field.state === "not_exposed") return "Not exposed";
  if (field.state === "unrecognized") return "Unrecognized";
  return format(field.value);
}

function appendDiagnosticField<T>(
  list: HTMLDListElement,
  label: string,
  fieldName: string,
  field: ConflictDiagnosticField<T>,
  format?: (value: T) => string,
): void {
  const value = element("dd", diagnosticFieldText(field, format));
  value.dataset.amexConflictField = fieldName;
  value.dataset.fieldState = field.state;
  if (field.state === "observed") value.dataset.fieldValue = String(field.value);
  list.append(element("dt", label), value);
}

function appendDiagnosticQuantity(
  list: HTMLDListElement,
  label: string,
  fieldName: string,
  field: ConflictDiagnosticField<QuantityV1>,
): void {
  const value = element("dd", diagnosticFieldText(field, quantityText));
  value.dataset.amexConflictField = fieldName;
  value.dataset.fieldState = field.state;
  if (field.state === "observed") {
    value.dataset.quantityValue = field.value.value;
    value.dataset.quantityUnit = field.value.unit;
    value.dataset.quantityCurrency = field.value.currency ?? "none";
  }
  list.append(element("dt", label), value);
}

export class AmexBenefitReaderPanel implements ScanReporter {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private store: StoreEnvelopeV1;
  private mode: "idle" | "scanning" | "cancelling" | "syncing" | "error" = "idle";
  private progress = "Ready. Nothing is scanned until you start.";
  private errorMessage: string | null = null;
  private benefitFilter: BenefitFilter = "remaining";
  private readonly conflictsByCard = new Map<string, PanelConflictState>();
  private collapsed: boolean;
  private readonly requiresReloadAfterClear: boolean;

  constructor(
    initialStore: StoreEnvelopeV1,
    private readonly actions: PanelActions,
    options: PanelOptions = {},
  ) {
    this.store = initialStore;
    this.collapsed = options.initiallyCollapsed ?? false;
    this.requiresReloadAfterClear = options.requiresReloadAfterClear ?? false;
    this.host = document.createElement("div");
    this.host.id = AMEX_READER_HOST_ID;
    this.root = this.host.attachShadow({ mode: "open" });
    document.documentElement.append(this.host);
    if (initialStore.lastScan) this.progress = scanSummaryText(initialStore.lastScan);
    this.render();
  }

  static mountError(
    message: string,
    clearData: () => Promise<void>,
    options: PanelOptions = {},
  ): AmexBenefitReaderPanel | null {
    const now = new Date().toISOString();
    const empty: StoreEnvelopeV1 = { schemaVersion: 1, revision: 0, updatedAt: now, cards: {}, lastScan: null };
    const panel = new AmexBenefitReaderPanel(empty, {
      startScan: async () => undefined,
      cancelScan: () => undefined,
      syncReviewed: async () => undefined,
      clearData,
    }, { ...options, requiresReloadAfterClear: true });
    panel.mode = "error";
    panel.errorMessage = message;
    panel.render();
    return panel;
  }

  report(progress: ScanProgress): void {
    if (progress.type === "started") {
      this.collapsed = false;
      this.conflictsByCard.clear();
      this.mode = "scanning";
      this.progress = "Starting your read-only scan…";
    } else if (progress.type === "discovered") {
      this.progress = `Found ${progress.cardCount} supported card${progress.cardCount === 1 ? "" : "s"}${progress.unknownEntryCount ? ` and ${progress.unknownEntryCount} account item${progress.unknownEntryCount === 1 ? "" : "s"} that could not be classified` : ""}.`;
    } else if (progress.type === "card") {
      const phase = progress.phase === "trackers"
        ? "reading benefit progress"
        : progress.phase === "catalog"
          ? "reading benefit details"
          : "organizing safe fields";
      this.progress = `Card ${progress.cardIndex} of ${progress.cardCount}: ${phase} for ${progress.productName} ending ${progress.endingDigits}.`;
    } else if (progress.type === "card_committed") {
      this.store = { ...this.store, cards: { ...this.store.cards, [progress.record.localCardId]: progress.record } };
      const diagnostics = BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS.filter((diagnostic) =>
        progress.conflictDiagnostics.includes(diagnostic));
      if (diagnostics.length || progress.conflictDetails.details.length) {
        this.conflictsByCard.set(progress.record.localCardId, {
          diagnostics,
          detailSet: progress.conflictDetails,
        });
      } else {
        this.conflictsByCard.delete(progress.record.localCardId);
      }
    } else if (progress.type === "verifying_context") {
      this.progress = "Finishing the scan and checking that the visible Amex page did not change…";
    } else {
      this.mode = "idle";
      this.store = { ...this.store, lastScan: progress.summary };
      this.progress = scanSummaryText(progress.summary);
    }
    this.render();
  }

  private async start(): Promise<void> {
    if (this.mode !== "idle") return;
    this.collapsed = false;
    this.conflictsByCard.clear();
    this.mode = "scanning";
    this.progress = "Starting your read-only scan…";
    this.errorMessage = null;
    this.render();
    try {
      await this.actions.startScan();
      if (this.mode === "scanning" || this.mode === "cancelling") {
        this.mode = "idle";
        this.render();
      }
    } catch {
      this.mode = "error";
      this.errorMessage = "The scan could not finish safely. Existing local observations were preserved.";
      this.render();
    }
  }

  private cancel(): void {
    if (this.mode !== "scanning") return;
    this.mode = "cancelling";
    this.progress = "Cancelling after the current safe step…";
    this.actions.cancelScan();
    this.render();
  }

  private async syncReviewed(): Promise<void> {
    if (this.mode !== "idle" || !this.store.lastScan || !this.actions.syncReviewed) return;
    this.mode = "syncing";
    this.errorMessage = null;
    this.progress = "Preparing a private one-time handoff…";
    this.render();
    try {
      await this.actions.syncReviewed();
      this.progress = "Sync review opened in a new tab. Confirm separately there; nothing is written from Amex.";
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : "A sync handoff could not be prepared.";
      this.progress = "No data was sent and no benefit was changed.";
    } finally {
      this.mode = "idle";
      this.render();
    }
  }

  private async clear(): Promise<void> {
    if (!window.confirm("Clear all local Amex benefit observations and the local identity secret?")) return;
    this.conflictsByCard.clear();
    try {
      await this.actions.clearData();
      this.store = { schemaVersion: 1, revision: 0, updatedAt: new Date().toISOString(), cards: {}, lastScan: null };
      this.benefitFilter = "remaining";
      this.mode = this.requiresReloadAfterClear ? "error" : "idle";
      this.errorMessage = this.requiresReloadAfterClear ? "Local data was cleared. Reload this Amex page before scanning." : null;
      this.progress = this.requiresReloadAfterClear
        ? "Local data cleared. Reload required."
        : "Local data cleared. Nothing is scanned until you start.";
    } catch {
      this.mode = "error";
      this.errorMessage = "Local data could not be cleared. No scan was started.";
    }
    this.render();
  }

  private renderBenefit(benefit: NormalizedBenefitObservation): HTMLElement {
    const presentation = benefitPresentation(benefit);
    const item = element("li");
    item.className = `benefit-card tone-${presentation.tone}`;
    item.dataset.filter = presentation.filter;

    const top = element("div");
    top.className = "benefit-top";
    const heading = element("h4", formatAmexBenefitTitle(benefit.title));
    const badge = element("span", presentation.label);
    badge.className = `status-pill tone-${presentation.tone}`;
    top.append(heading, badge);
    item.append(top);

    const essentials = element("div");
    essentials.className = "benefit-essentials";
    if (presentation.amount) {
      const amount = element("span", presentation.amount);
      amount.className = "amount";
      essentials.append(amount);
    }
    if (presentation.period) {
      const period = element("span", presentation.period);
      period.className = "period";
      essentials.append(period);
    }
    if (essentials.childElementCount) item.append(essentials);

    return item;
  }

  private renderConflictCandidate(candidate: BenefitIdentityConflictCandidateDetail): HTMLElement {
    const item = element("li");
    item.className = "conflict-candidate";
    item.dataset.amexConflictCandidate = "true";
    item.dataset.candidateIndex = String(candidate.candidateIndex);
    item.dataset.sourceRole = candidate.sourceRole;

    const heading = element("h5", `Candidate ${candidate.candidateIndex}: ${CONFLICT_SOURCE_LABELS[candidate.sourceRole]}`);
    item.append(heading);
    const title = element(
      "p",
      candidate.displayTitle ? formatAmexBenefitTitle(candidate.displayTitle) : "No display title exposed",
    );
    title.className = "conflict-candidate-title";
    title.dataset.amexConflictField = "display-title";
    title.dataset.fieldState = candidate.displayTitle ? "observed" : "not_exposed";
    item.append(title);

    const fields = element("dl");
    fields.className = "conflict-candidate-fields";
    const key = element("dd", candidate.supportedCreditKey ?? "No reviewed credit match");
    key.dataset.amexConflictField = "supported-credit-key";
    key.dataset.fieldState = candidate.supportedCreditKey ? "observed" : "not_exposed";
    if (candidate.supportedCreditKey) key.dataset.fieldValue = candidate.supportedCreditKey;
    const family = element("dd", candidate.supportedCreditFamily ?? "No reviewed credit family");
    family.dataset.amexConflictField = "supported-credit-family";
    family.dataset.fieldState = candidate.supportedCreditFamily ? "observed" : "not_exposed";
    if (candidate.supportedCreditFamily) family.dataset.fieldValue = candidate.supportedCreditFamily;
    fields.append(
      element("dt", "Reviewed credit"), key,
      element("dt", "Reviewed credit family"), family,
    );
    appendDiagnosticField(fields, "Category", "category", candidate.category);
    appendDiagnosticField(fields, "Activity", "activity-kind", candidate.activityKind);
    appendDiagnosticField(fields, "Enrollment", "enrollment-state", candidate.enrollmentState);
    appendDiagnosticField(fields, "Tracker", "tracker-state", candidate.trackerState);
    appendDiagnosticField(fields, "Completion", "completion-state", candidate.completionState);
    appendDiagnosticQuantity(fields, "Earned or used", "earned-or-used", candidate.earnedOrUsed);
    appendDiagnosticQuantity(fields, "Target or limit", "target-or-limit", candidate.targetOrLimit);
    appendDiagnosticQuantity(fields, "Remaining", "remaining", candidate.remaining);
    appendDiagnosticField(fields, "Period", "period", candidate.period);
    appendDiagnosticField(fields, "Catalog layout", "catalog-layout", candidate.catalogLayout);
    appendDiagnosticField(fields, "Catalog enrollable", "catalog-enrollable", candidate.catalogEnrollable, (value) => value ? "Yes" : "No");
    item.append(fields);
    return item;
  }

  private renderConflictDetail(detail: BenefitIdentityConflictDetail): HTMLElement {
    const article = element("article");
    article.className = "conflict-detail";
    article.dataset.amexConflict = "true";
    article.dataset.conflictKey = detail.conflictKey;
    article.dataset.conflictCategory = detail.category;
    article.dataset.candidateCount = String(detail.candidateCount);
    article.dataset.candidatesTruncated = String(detail.candidatesTruncated);

    const heading = element("h4", CONFLICT_DIAGNOSTIC_LABELS[detail.category]);
    heading.className = "conflict-detail-title";
    article.append(heading);
    const keyList = element("ul");
    keyList.className = "conflict-credit-keys";
    detail.reviewedCreditKeys.forEach((key) => {
      const item = element("li", `${creditFamilyLabel(key)} (${key})`);
      item.dataset.amexReviewedCreditKey = key;
      item.dataset.creditFamily = creditFamilyLabel(key);
      keyList.append(item);
    });
    article.append(keyList);

    const candidates = element("ol");
    candidates.className = "conflict-candidates";
    detail.candidates.forEach((candidate) => candidates.append(this.renderConflictCandidate(candidate)));
    article.append(candidates);
    if (detail.candidatesTruncated) {
      article.append(element("p", `Showing ${detail.candidates.length} of ${detail.candidateCount} parsed candidates.`));
    }

    const relations = element("dl");
    relations.className = "conflict-relations";
    ([
      ["Same join", "same-join-id", detail.relations.sameJoinId],
      ["Period comparison", "period", detail.relations.period],
      ["Amount comparison", "amount", detail.relations.amount],
      ["State comparison", "state", detail.relations.state],
    ] as const).forEach(([label, relation, value]) => {
      const result = element("dd", value === "unavailable" ? "Unavailable" : value === "same" ? "Same" : "Different");
      result.dataset.amexConflictRelation = relation;
      result.dataset.relationValue = value;
      relations.append(element("dt", label), result);
    });
    article.append(relations);
    return article;
  }

  private renderCardGroup(record: StoredCardRecordV1, coverageKind: CardCoverageKind): HTMLElement {
    const section = element("section");
    const headingId = `pr-card-${record.localCardId}`;
    const quality = observationQuality(record);
    const benefits = record.latest?.benefits ?? [];
    const filtered = benefits.filter((benefit) => benefitPresentation(benefit).filter === this.benefitFilter);
    const isCompact = benefits.length > 0 && filtered.length === 0;
    section.className = isCompact ? "card-group card-group-compact" : "card-group";
    section.dataset.amexReaderCardGroup = "true";
    section.dataset.cardProduct = record.identity.productName;
    section.dataset.cardEnding = record.identity.endingDigits;

    const headingRow = element("div");
    headingRow.className = "card-heading";
    const headingCopy = element("div");
    const heading = element("h3", `${record.identity.productName} •••• ${record.identity.endingDigits}`);
    heading.id = headingId;
    headingCopy.append(heading);
    const visibleLabel = filterLabel(this.benefitFilter).toLowerCase();
    const summaryId = `${headingId}-summary`;
    const summary = element(
      "p",
      `${filtered.length} ${visibleLabel} benefit${filtered.length === 1 ? "" : "s"}`,
    );
    summary.id = summaryId;
    summary.className = "card-summary";
    headingCopy.append(summary);
    section.setAttribute("aria-labelledby", `${headingId} ${summaryId}`);
    const qualityBadge = element("span", quality.label);
    qualityBadge.id = `${headingId}-quality`;
    qualityBadge.className = `quality-pill quality-${quality.tone}`;
    qualityBadge.setAttribute("aria-label", `Data quality: ${quality.label}`);
    heading.setAttribute("aria-describedby", qualityBadge.id);
    headingRow.append(headingCopy, qualityBadge);
    section.append(headingRow);

    let coverageMessage: string | null = null;
    if (coverageKind === "older_retained") {
      coverageMessage = record.freshness === "stale_error"
        ? "This older stored card was not checked in the latest scan; its stale data remains for review."
        : "This older stored card was not checked in the latest scan and remains for review.";
    } else if (record.freshness === "stale_error") {
      coverageMessage = "Older benefit data was retained because the latest read failed.";
    } else if (
      record.latest?.benefits.length === 0
      && record.latest.issueCodes.includes("http_error")
    ) {
      coverageMessage = "The benefit catalog was unavailable, so this card is not confirmed to have no trackable benefits.";
    } else if (coverageKind === "latest_scan_unresolved") {
      coverageMessage = "The latest scan did not conclusively establish whether this card has trackable benefits.";
    }
    if (coverageMessage) {
      const notice = element("p", coverageMessage);
      notice.className = "card-coverage-note";
      section.append(notice);
    }

    if (filtered.length) {
      const list = element("ul");
      list.className = "benefit-list";
      filtered.forEach((benefit) => list.append(this.renderBenefit(benefit)));
      section.append(list);
    } else if (!record.latest) {
      const empty = element("p", "No safe benefit observation is available for this card yet.");
      empty.className = "empty-state";
      section.append(empty);
    }

    const dataQuality = element("details");
    dataQuality.className = "secondary-panel data-quality";
    dataQuality.append(element("summary", "Data quality and timestamps"));
    const timeList = element("dl");
    timeList.append(
      element("dt", "Observed"), element("dd", formatDate(record.observedAt)),
      element("dt", "Last attempt"), element("dd", formatDate(record.lastAttemptAt)),
      element("dt", "Parser"), element("dd", record.latest?.parserVersion ?? "No observation"),
      element("dt", "Benefit confidence"), element("dd", confidenceSummary(benefits)),
    );
    dataQuality.append(timeList);
    const qualityReasons = new Set<string>();
    if (record.error) qualityReasons.add(record.error.message);
    record.latest?.issueCodes.forEach((code) => qualityReasons.add(fixedErrorMessage(code)));
    if (qualityReasons.size) {
      const issues = element("ul");
      issues.className = "detail-notes";
      qualityReasons.forEach((message) => issues.append(element("li", message)));
      dataQuality.append(issues);
    }
    const conflictState = this.conflictsByCard.get(record.localCardId);
    if (conflictState) {
      dataQuality.append(element("p", "Benefit matching notes from this scan"));
      if (conflictState.diagnostics.length) {
        const diagnostics = element("ul");
        diagnostics.className = "detail-notes conflict-diagnostics";
        conflictState.diagnostics.forEach((diagnostic) => {
          diagnostics.append(element("li", CONFLICT_DIAGNOSTIC_LABELS[diagnostic]));
        });
        dataQuality.append(diagnostics);
      }
      if (conflictState.detailSet.details.length) {
        const detailSection = element("section");
        detailSection.className = "conflict-detail-section";
        detailSection.dataset.amexConflictDetails = "true";
        detailSection.dataset.conflictCount = String(conflictState.detailSet.totalCount);
        detailSection.dataset.conflictsTruncated = String(conflictState.detailSet.truncated);
        detailSection.setAttribute("aria-label", "Structured benefit matching ambiguities from this scan");
        conflictState.detailSet.details.forEach((detail) => detailSection.append(this.renderConflictDetail(detail)));
        if (conflictState.detailSet.truncated) {
          detailSection.append(element("p", `Showing ${conflictState.detailSet.details.length} of ${conflictState.detailSet.totalCount} matching ambiguities.`));
        }
        dataQuality.append(detailSection);
      }
    }
    section.append(dataQuality);
    return section;
  }

  private renderAccountNotes(benefitCards: StoredCardRecordV1[]): HTMLElement | null {
    const messages: string[] = [];
    const observationTimes = new Set(benefitCards.map((record) => record.observedAt).filter(Boolean));
    if (
      observationTimes.size > 1
      || benefitCards.some((record) => observationQuality(record).tone !== "good")
    ) {
      messages.push("Some cards have partial, stale, failed, or differently timed observations. Review each card's data-quality label.");
    }
    if (this.store.lastScan?.unknownAccountVariantCount) {
      const count = this.store.lastScan.unknownAccountVariantCount;
      messages.push(`${count} account item${count === 1 ? " was" : "s were"} not recognized and not scanned.`);
    }
    if (this.store.lastScan?.visibleContext === "changed") messages.push(fixedErrorMessage("visible_context_changed"));
    if (this.store.lastScan?.visibleContext === "unavailable") messages.push("The visible Amex card context could not be verified after the scan.");
    if (!messages.length) return null;
    const details = element("details");
    details.className = "secondary-panel account-notes";
    details.append(element("summary", `Scan notes (${messages.length})`));
    const list = element("ul");
    messages.forEach((message) => list.append(element("li", message)));
    details.append(list);
    return details;
  }

  private render(): void {
    this.root.replaceChildren();
    const style = element("style");
    style.textContent = `
      :host { all: initial; --pr-bg: #f8fafc; --pr-card: #ffffff; --pr-text: #1f2937; --pr-muted: #667085; --pr-border: #e4e7ec; --pr-primary: #27313d; --pr-primary-hover: #1f2933; --pr-amber: #d97706; --pr-amber-bg: #fffbeb; --pr-amber-border: #fde68a; --pr-blue: #2563eb; --pr-blue-bg: #eff6ff; --pr-blue-border: #bfdbfe; --pr-green: #059669; --pr-green-bg: #ecfdf5; --pr-green-border: #a7f3d0; --pr-red: #dc2626; --pr-red-bg: #fef2f2; --pr-red-border: #fecaca; }
      * { box-sizing: border-box; }
      .launcher { position: fixed; z-index: 2147483647; top: 16px; right: 16px; display: grid; width: 48px; min-height: 48px; padding: 0; place-items: center; border: 1px solid #475467; border-radius: 14px; background: var(--pr-primary); color: #fff; box-shadow: 0 8px 24px rgba(15,23,42,.2); font: 800 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .04em; }
      .launcher:hover { background: var(--pr-primary-hover); }
      .panel { position: fixed; z-index: 2147483647; top: 16px; right: 16px; width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; border: 1px solid var(--pr-border); border-radius: 16px; background: var(--pr-bg); color: var(--pr-text); box-shadow: 0 18px 50px rgba(15,23,42,.18); font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      h2,h3,h4,p { margin: 0; } h2 { font-size: 19px; line-height: 1.2; } h3 { font-size: 16px; line-height: 1.3; } h4 { font-size: 14px; line-height: 1.35; } ul { margin: 0; }
      .top { padding: 18px; border-bottom: 1px solid var(--pr-border); background: var(--pr-card); border-radius: 16px 16px 0 0; }
      .brand-row { display: flex; align-items: center; gap: 10px; }
      .brand-mark { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 10px; background: var(--pr-primary); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .04em; }
      .collapse-button { min-height: 34px; margin-left: auto; padding: 6px 9px; color: #475467; font-size: 12px; }
      .eyebrow { margin-top: 2px; color: var(--pr-muted); font-size: 12px; }
      .privacy-banner { margin-top: 14px; padding: 10px 12px; border: 1px solid #dbeafe; border-radius: 10px; background: #f0f7ff; color: #334155; font-size: 12px; }
      .privacy-banner strong { display: block; margin-bottom: 2px; color: #1e3a5f; font-size: 13px; }
      .controls { display: flex; gap: 8px; margin-top: 14px; }
      button { min-height: 40px; border-radius: 9px; font: inherit; }
      button { border: 1px solid var(--pr-border); background: var(--pr-card); color: var(--pr-text); font-weight: 650; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, color .15s ease, transform .15s ease; }
      button:active { transform: translateY(1px); }
      button.primary { flex: 1; border-color: var(--pr-primary); background: var(--pr-primary); color: #fff; box-shadow: 0 2px 5px rgba(15,23,42,.12); }
      button.primary:hover { background: var(--pr-primary-hover); }
      button:focus-visible, summary:focus-visible { outline: 3px solid rgba(71,85,105,.28); outline-offset: 2px; }
      button:disabled { opacity: .52; cursor: default; transform: none; }
      .scan-status { margin-top: 12px; padding: 10px 12px; border: 1px solid var(--pr-border); border-radius: 10px; background: #f8fafc; color: #475467; font-size: 13px; }
      .notice { margin-top: 10px; padding: 10px 12px; border-radius: 10px; font-size: 13px; }
      .notice-warning { border: 1px solid var(--pr-amber-border); background: var(--pr-amber-bg); color: #92400e; }
      .content { padding: 16px; }
      .account-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .metric { padding: 10px; border: 1px solid var(--pr-border); border-radius: 10px; background: var(--pr-card); }
      .metric strong { display: block; font-size: 17px; line-height: 1.2; }
      .metric span { display: block; margin-top: 3px; color: var(--pr-muted); font-size: 11px; }
      .card-groups { display: grid; gap: 12px; margin-top: 14px; }
      .card-group { padding: 14px; border: 1px solid var(--pr-border); border-radius: 14px; background: var(--pr-card); box-shadow: 0 1px 2px rgba(15,23,42,.04); }
      .card-group-compact { padding: 10px 14px; box-shadow: none; }
      .card-group-compact .card-heading { align-items: center; }
      .card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .card-summary { margin-top: 4px; color: var(--pr-muted); font-size: 12px; }
      .card-coverage-note { margin: 8px 0 0; color: var(--pr-muted); font-size: 12px; }
      .quality-pill, .status-pill { display: inline-flex; align-items: center; flex: 0 0 auto; border: 1px solid; border-radius: 999px; font-size: 11px; font-weight: 750; white-space: nowrap; }
      .quality-pill { padding: 4px 8px; }
      .quality-good { border-color: var(--pr-green-border); background: var(--pr-green-bg); color: #047857; }
      .quality-note { border-color: var(--pr-blue-border); background: var(--pr-blue-bg); color: #1d4ed8; }
      .quality-warning { border-color: var(--pr-amber-border); background: var(--pr-amber-bg); color: #92400e; }
      .quality-error { border-color: var(--pr-red-border); background: var(--pr-red-bg); color: #b91c1c; }
      .filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
      .filter-button { min-height: 40px; padding: 7px 10px; color: #475467; font-size: 13px; }
      .filter-button[aria-pressed="true"] { border-color: #94a3b8; background: #eef2f6; color: #1f2937; box-shadow: inset 0 0 0 1px rgba(71,85,105,.08); }
      .benefit-list { display: grid; gap: 10px; padding: 0; margin-top: 12px; list-style: none; }
      .benefit-card { position: relative; overflow: hidden; padding: 13px 13px 12px 16px; border: 1px solid var(--pr-border); border-radius: 11px; background: var(--pr-card); box-shadow: 0 1px 2px rgba(15,23,42,.04); }
      .benefit-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: #94a3b8; }
      .benefit-card.tone-amber::before { background: #f59e0b; } .benefit-card.tone-blue::before { background: #3b82f6; } .benefit-card.tone-green::before { background: #10b981; }
      .benefit-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
      .status-pill { padding: 3px 7px; }
      .status-pill.tone-amber { border-color: var(--pr-amber-border); background: var(--pr-amber-bg); color: #92400e; }
      .status-pill.tone-blue { border-color: var(--pr-blue-border); background: var(--pr-blue-bg); color: #1d4ed8; }
      .status-pill.tone-green { border-color: var(--pr-green-border); background: var(--pr-green-bg); color: #047857; }
      .status-pill.tone-muted { border-color: var(--pr-border); background: #f8fafc; color: #667085; }
      .benefit-essentials { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; margin-top: 7px; }
      .amount { color: #111827; font-size: 13px; font-weight: 750; font-variant-numeric: tabular-nums; }
      .period { color: var(--pr-muted); font-size: 12px; }
      details { margin-top: 10px; }
      summary { color: #475467; font-size: 12px; font-weight: 700; cursor: pointer; }
      dl { display: grid; grid-template-columns: minmax(100px, auto) 1fr; gap: 5px 10px; margin: 10px 0 0; font-size: 12px; }
      dt { color: #475467; font-weight: 700; } dd { margin: 0; overflow-wrap: anywhere; color: var(--pr-muted); }
      .detail-notes { margin-top: 10px; padding-left: 18px; color: #92400e; font-size: 12px; }
      .conflict-detail-section { display: grid; gap: 10px; margin-top: 10px; }
      .conflict-detail { padding: 10px; border: 1px solid var(--pr-amber-border); border-radius: 9px; background: var(--pr-amber-bg); }
      .conflict-detail-title { color: #78350f; font-size: 13px; }
      .conflict-credit-keys { margin-top: 6px; padding-left: 18px; color: #92400e; font: 600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
      .conflict-candidates { display: grid; gap: 8px; margin-top: 8px; padding-left: 20px; }
      .conflict-candidate { padding: 8px; border: 1px solid #f3d28f; border-radius: 8px; background: #fff; }
      .conflict-candidate h5 { margin: 0; color: #78350f; font-size: 12px; }
      .conflict-candidate-title { margin-top: 4px; font-size: 12px; font-weight: 700; overflow-wrap: anywhere; }
      .conflict-candidate-fields, .conflict-relations { grid-template-columns: minmax(105px, auto) 1fr; margin-top: 7px; }
      .conflict-relations { padding-top: 7px; border-top: 1px solid #f3d28f; }
      .secondary-panel { padding: 10px 12px; border: 1px solid var(--pr-border); border-radius: 10px; background: #f8fafc; }
      .account-notes { margin: 12px 0 0; }
      .account-notes ul { margin-top: 9px; padding-left: 18px; color: #475467; font-size: 12px; }
      .coverage-summary { margin: -4px 0 10px; color: var(--pr-muted); font-size: 12px; }
      .hidden-cards-note { margin: -4px 0 12px; color: var(--pr-muted); font-size: 12px; }
      .empty-state { margin-top: 12px; padding: 18px 12px; border: 1px dashed #cbd5e1; border-radius: 10px; color: var(--pr-muted); text-align: center; }
      .footer { padding: 0 16px 16px; }
      .privacy-details p { margin-top: 8px; color: var(--pr-muted); font-size: 12px; }
      .clear-button { width: 100%; margin-top: 10px; padding: 8px 10px; border-color: var(--pr-red-border); color: #b91c1c; }
      @media (max-width: 520px) { .panel { top: 8px; right: 8px; width: calc(100vw - 16px); max-height: calc(100vh - 16px); } .account-summary { grid-template-columns: repeat(3, minmax(0,1fr)); } }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
    `;

    if (this.mode === "scanning" || this.mode === "cancelling") this.collapsed = false;
    if (this.collapsed) {
      const launcher = element("button", "PR");
      launcher.type = "button";
      launcher.className = "launcher";
      launcher.setAttribute("aria-label", "Open Perks Reminder Amex benefit reader");
      launcher.setAttribute("aria-expanded", "false");
      launcher.setAttribute("aria-controls", "pr-reader-panel");
      launcher.addEventListener("click", () => {
        this.collapsed = false;
        this.render();
      });
      this.root.append(style, launcher);
      return;
    }

    const panel = element("section");
    panel.id = "pr-reader-panel";
    panel.className = "panel";
    panel.setAttribute("aria-labelledby", "pr-reader-title");

    const top = element("div");
    top.className = "top";
    const brand = element("div");
    brand.className = "brand-row";
    const brandMark = element("div", "PR");
    brandMark.className = "brand-mark";
    brandMark.setAttribute("aria-hidden", "true");
    brand.append(brandMark);
    const brandText = element("div");
    const title = element("h2", "Amex benefits");
    title.id = "pr-reader-title";
    brandText.append(title, element("p", "Perks Reminder local reader"));
    brandText.lastElementChild!.className = "eyebrow";
    brand.append(brandText);
    if (this.mode !== "scanning" && this.mode !== "cancelling") {
      const collapse = element("button", "Collapse");
      collapse.type = "button";
      collapse.className = "collapse-button";
      collapse.setAttribute("aria-label", "Collapse Perks Reminder Amex benefit reader");
      collapse.setAttribute("aria-expanded", "true");
      collapse.setAttribute("aria-controls", "pr-reader-panel");
      collapse.addEventListener("click", () => {
        this.collapsed = true;
        this.render();
      });
      brand.append(collapse);
    }
    top.append(brand);

    const disclosure = element("div");
    disclosure.className = "privacy-banner";
    disclosure.append(
      element("strong", "Local unless you choose Sync reviewed"),
      element("span", "A manual scan uses your signed-in Amex session for first-party read requests. Raw responses are not saved. Sync sends only the reviewed normalized handoff."),
    );
    top.append(disclosure);

    const controls = element("div");
    controls.className = "controls";
    const scan = element("button", "Scan all cards");
    scan.type = "button";
    scan.className = "primary";
    scan.disabled = this.mode !== "idle";
    scan.addEventListener("click", () => void this.start());
    controls.append(scan);
    if (this.store.lastScan && this.actions.syncReviewed && this.mode !== "scanning" && this.mode !== "cancelling") {
      const sync = element("button", "Sync reviewed");
      sync.type = "button";
      sync.dataset.amexSyncAction = "true";
      sync.disabled = this.mode !== "idle";
      sync.addEventListener("click", () => void this.syncReviewed());
      controls.append(sync);
    }
    if (this.mode === "scanning" || this.mode === "cancelling") {
      const cancel = element("button", this.mode === "cancelling" ? "Cancelling…" : "Cancel");
      cancel.type = "button";
      cancel.disabled = this.mode === "cancelling";
      cancel.addEventListener("click", () => this.cancel());
      controls.append(cancel);
    }
    top.append(controls);

    const status = element("p", this.progress);
    status.className = "scan-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    top.append(status);
    if (this.errorMessage) {
      const error = element("p", this.errorMessage);
      error.className = "notice notice-warning";
      error.setAttribute("role", "alert");
      top.append(error);
    }
    panel.append(top);

    const coverage = projectCardCoverage(this.store);
    const cards = coverage.map(({ record }) => record);
    const benefitCards = cards.filter((record) => (record.latest?.benefits.length ?? 0) > 0);
    const confirmedEmptyCards = coverage.filter(({ kind }) => kind === "confirmed_empty");
    const reviewEntries = coverage.filter(({ kind }) => kind !== "confirmed_empty");
    const reviewCards = reviewEntries.map(({ record }) => record);
    const olderRetainedCards = coverage.filter(({ kind }) => kind === "older_retained");
    const content = element("div");
    content.className = "content";
    if (cards.length) {
      const totalBenefits = benefitCards.reduce((sum, record) => sum + (record.latest?.benefits.length ?? 0), 0);
      const dataNoteCards = reviewEntries.filter(({ record, kind }) =>
        kind === "latest_scan_unresolved"
        || kind === "older_retained"
        || observationQuality(record).tone !== "good").length;
      const metrics = element("div");
      metrics.className = "account-summary";
      ([[String(benefitCards.length), "Cards with benefits"], [String(totalBenefits), "Eligible benefits"], [String(dataNoteCards), "Data notes"]] as Array<[string,string]>).forEach(([value, label]) => {
        const metric = element("div");
        metric.className = "metric";
        metric.append(element("strong", value), element("span", label));
        metrics.append(metric);
      });
      content.append(metrics);

      if (this.store.lastScan) {
        const attempted = this.store.lastScan.attemptedCardCount;
        const older = olderRetainedCards.length;
        const coverageSummary = element(
          "p",
          `${attempted} card${attempted === 1 ? "" : "s"} checked in the latest scan; `
            + `${cards.length} stored card record${cards.length === 1 ? "" : "s"}; `
            + `${older} older stored card${older === 1 ? " remains" : "s remain"} retained for review.`,
        );
        coverageSummary.className = "coverage-summary";
        content.append(coverageSummary);
      }

      if (confirmedEmptyCards.length) {
        const count = confirmedEmptyCards.length;
        const hiddenNote = element(
          "p",
          count === 1
            ? "1 card was confirmed to have no trackable benefits and is hidden."
            : `${count} cards were confirmed to have no trackable benefits and are hidden.`,
        );
        hiddenNote.className = "hidden-cards-note";
        content.append(hiddenNote);
      }

      if (benefitCards.length) {
        const filterCounts: Record<BenefitFilter, number> = { remaining: 0, used: 0 };
        benefitCards.forEach((record) => {
          record.latest?.benefits.forEach((benefit) => {
            filterCounts[benefitPresentation(benefit).filter] += 1;
          });
        });
        const filters = element("div");
        filters.className = "filters";
        filters.setAttribute("role", "group");
        filters.setAttribute("aria-label", "Filter account benefits");
        (["remaining", "used"] as BenefitFilter[]).forEach((filter) => {
          const control = element("button", `${filterLabel(filter)} ${filterCounts[filter]}`);
          control.type = "button";
          control.className = "filter-button";
          control.dataset.filter = filter;
          control.setAttribute("aria-pressed", String(this.benefitFilter === filter));
          control.addEventListener("click", () => {
            this.benefitFilter = filter;
            this.render();
          });
          filters.append(control);
        });
        content.append(filters);
      }

      if (reviewEntries.length) {
        const groups = element("div");
        groups.className = "card-groups";
        reviewEntries.forEach(({ record, kind }) => groups.append(this.renderCardGroup(record, kind)));
        content.append(groups);
      } else {
        const empty = element("p", "No trackable benefits are available in the reviewed card observations.");
        empty.className = "empty-state account-empty-state";
        content.append(empty);
      }
    } else {
      const empty = element("p", "No local card observations yet. Start a scan when you are ready.");
      empty.className = "empty-state";
      content.append(empty);
    }
    const accountNotes = this.renderAccountNotes(reviewCards);
    if (accountNotes) content.append(accountNotes);
    panel.append(content);

    const footer = element("div");
    footer.className = "footer";
    const privacy = element("details");
    privacy.className = "secondary-panel privacy-details";
    privacy.append(element("summary", "Data and privacy"));
    privacy.append(element("p", "Only normalized observations and a local identity fingerprint are stored in Tampermonkey. Clearing data also removes the local identity secret."));
    const clear = element("button", "Clear local data");
    clear.type = "button";
    clear.className = "clear-button";
    clear.disabled = this.mode === "scanning" || this.mode === "cancelling" || this.mode === "syncing";
    clear.addEventListener("click", () => void this.clear());
    privacy.append(clear);
    footer.append(privacy);
    panel.append(footer);

    this.root.append(style, panel);
  }
}
