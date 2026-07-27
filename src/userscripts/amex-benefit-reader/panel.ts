import type {
  NormalizedBenefitObservation,
  ObservedField,
  QuantityV1,
  ScanSummaryV1,
  SourcePeriodV2,
  StoreEnvelopeV1,
  StoredCardRecordV1,
} from "@/lib/amex-benefit-reader/contract";
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

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (text != null) result.textContent = text;
  return result;
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

export class AmexBenefitReaderPanel implements ScanReporter {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private store: StoreEnvelopeV1;
  private mode: "idle" | "scanning" | "cancelling" | "syncing" | "error" = "idle";
  private progress = "Ready to scan.";
  private progressCardCount: number | null = null;
  private progressCardIndex = 0;
  private errorMessage: string | null = null;
  private benefitFilter: BenefitFilter = "remaining";
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
      this.mode = "scanning";
      this.progressCardCount = null;
      this.progressCardIndex = 0;
      this.progress = "Starting your read-only scan…";
    } else if (progress.type === "discovered") {
      this.progressCardCount = progress.cardCount;
      this.progressCardIndex = 0;
      this.progress = progress.cardCount === 0
        ? "No eligible cards were found. Finishing the scan…"
        : `Preparing ${progress.cardCount} card${progress.cardCount === 1 ? "" : "s"} for a read-only scan…`;
    } else if (progress.type === "card") {
      this.progressCardCount = progress.cardCount;
      this.progressCardIndex = progress.cardIndex;
      this.progress = `Reading card ${progress.cardIndex} of ${progress.cardCount}…`;
    } else if (progress.type === "card_committed") {
      this.store = { ...this.store, cards: { ...this.store.cards, [progress.record.localCardId]: progress.record } };
    } else if (progress.type === "verifying_context") {
      if (this.progressCardCount !== null) this.progressCardIndex = this.progressCardCount;
      this.progress = "Finishing the scan…";
    } else {
      this.mode = "idle";
      this.progressCardCount = null;
      this.progressCardIndex = 0;
      this.store = { ...this.store, lastScan: progress.summary };
      this.progress = "Ready to scan.";
    }
    this.render();
  }

  private async start(): Promise<void> {
    if (this.mode !== "idle") return;
    this.collapsed = false;
    this.mode = "scanning";
    this.progressCardCount = null;
    this.progressCardIndex = 0;
    this.progress = "Starting your read-only scan…";
    this.errorMessage = null;
    this.render();
    try {
      // The engine's terminal `finished` event is the only authority that may
      // restore result UI. A resolved action without that event must remain in
      // the isolated workspace rather than exposing a partial scan as final.
      await this.actions.startScan();
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

  private renderCardGroup(record: StoredCardRecordV1): HTMLElement {
    const section = element("section");
    const headingId = `pr-card-${record.localCardId}`;
    const benefits = record.latest?.benefits ?? [];
    const filtered = benefits.filter((benefit) => benefitPresentation(benefit).filter === this.benefitFilter);
    section.className = "card-group";
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
    headingRow.append(headingCopy);
    section.append(headingRow);

    const list = element("ul");
    list.className = "benefit-list";
    filtered.forEach((benefit) => list.append(this.renderBenefit(benefit)));
    section.append(list);

    return section;
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
      .scan-workspace { display: grid; gap: 14px; padding: 22px 18px; }
      .scan-status { padding: 10px 12px; border: 1px solid var(--pr-border); border-radius: 10px; background: #f8fafc; color: #475467; font-size: 13px; }
      .scan-progress { width: 100%; height: 10px; accent-color: var(--pr-primary); }
      .scan-cancel { width: 100%; }
      .notice { margin-top: 10px; padding: 10px 12px; border-radius: 10px; font-size: 13px; }
      .notice-warning { border: 1px solid var(--pr-amber-border); background: var(--pr-amber-bg); color: #92400e; }
      .content { padding: 16px; }
      .card-groups { display: grid; gap: 12px; margin-top: 14px; }
      .card-group { padding: 14px; border: 1px solid var(--pr-border); border-radius: 14px; background: var(--pr-card); box-shadow: 0 1px 2px rgba(15,23,42,.04); }
      .card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .card-summary { margin-top: 4px; color: var(--pr-muted); font-size: 12px; }
      .status-pill { display: inline-flex; align-items: center; flex: 0 0 auto; border: 1px solid; border-radius: 999px; font-size: 11px; font-weight: 750; white-space: nowrap; padding: 3px 7px; }
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
      .empty-state { margin-top: 12px; padding: 18px 12px; border: 1px dashed #cbd5e1; border-radius: 10px; color: var(--pr-muted); text-align: center; }
      .footer { padding: 0 16px 16px; }
      .privacy-details p { margin-top: 8px; color: var(--pr-muted); font-size: 12px; }
      .clear-button { width: 100%; margin-top: 10px; padding: 8px 10px; border-color: var(--pr-red-border); color: #b91c1c; }
      @media (max-width: 520px) { .panel { top: 8px; right: 8px; width: calc(100vw - 16px); max-height: calc(100vh - 16px); } }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
    `;

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

    if (this.mode === "scanning" || this.mode === "cancelling") {
      const workspace = element("section");
      workspace.className = "scan-workspace";
      const title = element("h2", "Amex benefits");
      title.id = "pr-reader-title";
      workspace.append(title);
      const status = element("p", this.progress);
      status.className = "scan-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      workspace.append(status);
      const progress = element("progress");
      progress.className = "scan-progress";
      progress.setAttribute("aria-label", "Scan progress");
      if (this.progressCardCount !== null && this.progressCardCount > 0) {
        progress.max = this.progressCardCount;
        progress.value = Math.min(this.progressCardIndex, this.progressCardCount);
        progress.setAttribute("aria-valuetext", `Card ${this.progressCardIndex} of ${this.progressCardCount}`);
      }
      workspace.append(progress);
      const cancel = element("button", this.mode === "cancelling" ? "Cancelling…" : "Cancel");
      cancel.type = "button";
      cancel.className = "scan-cancel";
      cancel.disabled = this.mode === "cancelling";
      cancel.addEventListener("click", () => this.cancel());
      workspace.append(cancel);
      panel.append(workspace);
      this.root.append(style, panel);
      return;
    }

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
    if (this.mode === "idle" || this.mode === "syncing" || this.mode === "error") {
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
    if (this.store.lastScan && this.actions.syncReviewed) {
      const sync = element("button", "Sync reviewed");
      sync.type = "button";
      sync.dataset.amexSyncAction = "true";
      sync.disabled = this.mode !== "idle";
      sync.addEventListener("click", () => void this.syncReviewed());
      controls.append(sync);
    }
    top.append(controls);

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
    const filterCounts: Record<BenefitFilter, number> = { remaining: 0, used: 0 };
    benefitCards.forEach((record) => {
      record.latest?.benefits.forEach((benefit) => {
        filterCounts[benefitPresentation(benefit).filter] += 1;
      });
    });
    const renderedEntries = reviewEntries.filter(({ record }) =>
      record.latest?.benefits.some((benefit) =>
        benefitPresentation(benefit).filter === this.benefitFilter));
    const content = element("div");
    content.className = "content";
    if (cards.length) {
      const totalBenefits = filterCounts.remaining + filterCounts.used;

      if (benefitCards.length) {
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

      if (renderedEntries.length) {
        const groups = element("div");
        groups.className = "card-groups";
        renderedEntries.forEach(({ record }) => groups.append(this.renderCardGroup(record)));
        content.append(groups);
      } else {
        let message: string;
        const allCardsConclusivelyEmpty = totalBenefits === 0
          && confirmedEmptyCards.length === cards.length
          && this.store.lastScan?.status === "complete";
        if (allCardsConclusivelyEmpty) {
          message = "No trackable benefits are available in the reviewed card observations.";
        } else if (totalBenefits === 0) {
          message = "No benefit rows are available in the local observations.";
        } else {
          const otherFilter: BenefitFilter = this.benefitFilter === "remaining" ? "used" : "remaining";
          const otherCount = filterCounts[otherFilter];
          message = `No ${filterLabel(this.benefitFilter).toLowerCase()} benefit rows are available. `
            + `${otherCount} ${filterLabel(otherFilter).toLowerCase()} benefit${otherCount === 1 ? " is" : "s are"} available under ${filterLabel(otherFilter)}.`;
        }
        const empty = element("p", message);
        empty.className = "empty-state account-empty-state";
        content.append(empty);
      }
    } else {
      const empty = element("p", "No local card observations yet. Start a scan when you are ready.");
      empty.className = "empty-state";
      content.append(empty);
    }
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
    clear.disabled = this.mode === "syncing";
    clear.addEventListener("click", () => void this.clear());
    privacy.append(clear);
    footer.append(privacy);
    panel.append(footer);

    this.root.append(style, panel);
  }
}
