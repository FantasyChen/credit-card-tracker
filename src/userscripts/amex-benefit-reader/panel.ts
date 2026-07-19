import type {
  NormalizedBenefitObservationV1,
  ObservedField,
  QuantityV1,
  ScanSummaryV1,
  StoreEnvelopeV1,
  StoredCardRecordV1,
} from "@/lib/amex-benefit-reader/contract";
import { fixedErrorMessage, hasMixedObservations } from "@/lib/amex-benefit-reader/storage-policy";
import type { ScanProgress, ScanReporter } from "@/lib/amex-benefit-reader/scan-engine";

export interface PanelActions {
  startScan(): Promise<void>;
  cancelScan(): void;
  clearData(): Promise<void>;
}

type BenefitFilter = "all" | "action" | "progress" | "complete";
type BenefitBucket = Exclude<BenefitFilter, "all"> | "other";
type BenefitTone = "amber" | "blue" | "green" | "muted";
type QualityTone = "good" | "note" | "warning" | "error";

interface BenefitPresentation {
  label: string;
  tone: BenefitTone;
  bucket: BenefitBucket;
  amount: string | null;
  remaining: string | null;
  progress: number | null;
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

function titleCase(value: string): string {
  const normalized = value.replace(/_/g, " ");
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function formatDate(value: string | null): string {
  if (!value) return "No observation";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

function fieldText<T>(field: ObservedField<T>, format: (value: T) => string = String): string {
  if (field.state === "observed") return format(field.value);
  return field.state === "not_exposed" ? "Not provided by Amex" : "Could not interpret safely";
}

function quantityText(quantity: QuantityV1): string {
  if (quantity.unit === "USD") return `$${quantity.value}`;
  if (quantity.unit === "percent") return `${quantity.value}%`;
  if (quantity.unit === "points") return `${quantity.value} points`;
  if (quantity.unit === "count") return `${quantity.value} count`;
  return quantity.value;
}

function compatibleProgress(current: QuantityV1, target: QuantityV1): number | null {
  if (current.unit !== target.unit || current.currency !== target.currency) return null;
  const currentValue = Number(current.value);
  const targetValue = Number(target.value);
  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue) || currentValue < 0 || targetValue <= 0) return null;
  return Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
}

function observedValue<T>(field: ObservedField<T>): T | null {
  return field.state === "observed" ? field.value : null;
}

function observationQuality(record: StoredCardRecordV1): QualityPresentation {
  if (record.freshness === "error_no_data") return { label: "Could not read", tone: "error" };
  if (record.freshness === "stale_error") return { label: "Stale data", tone: "warning" };
  if (record.completeness === "partial") return { label: "Partial data", tone: "note" };
  return { label: "Up to date", tone: "good" };
}

function benefitState(benefit: NormalizedBenefitObservationV1): Pick<BenefitPresentation, "label" | "tone" | "bucket"> {
  const completion = observedValue(benefit.completionState);
  const tracker = observedValue(benefit.trackerState);
  const enrollment = observedValue(benefit.enrollmentState);

  if (completion === "complete" || tracker === "completed" || benefit.activityKind === "completed") {
    return { label: "Completed", tone: "green", bucket: "complete" };
  }
  if (tracker === "earned" || benefit.activityKind === "credit_earned") {
    return { label: "Credit earned", tone: "green", bucket: "complete" };
  }
  if (enrollment === "linking_required") {
    return { label: "Link required", tone: "amber", bucket: "action" };
  }
  if (enrollment === "required") {
    return { label: "Enrollment required", tone: "amber", bucket: "action" };
  }
  if (tracker === "in_progress") {
    return { label: "In progress", tone: "blue", bucket: "progress" };
  }
  if (tracker === "not_started") {
    return { label: "Not started", tone: "amber", bucket: "action" };
  }
  if (benefit.activityKind === "enrollment_candidate") {
    return { label: "Check enrollment", tone: "amber", bucket: "action" };
  }
  if (benefit.activityKind === "spend_progress" && observedValue(benefit.earnedOrUsed)) {
    return { label: "In progress", tone: "blue", bucket: "progress" };
  }
  if (completion === "incomplete") {
    return { label: "Not completed", tone: "amber", bucket: "action" };
  }
  return { label: "Status unavailable", tone: "muted", bucket: "other" };
}

function benefitPresentation(benefit: NormalizedBenefitObservationV1): BenefitPresentation {
  const state = benefitState(benefit);
  const current = observedValue(benefit.earnedOrUsed);
  const target = observedValue(benefit.targetOrLimit);
  const remaining = observedValue(benefit.remaining);
  const period = observedValue(benefit.period);
  let amount: string | null = null;

  if (current && target) {
    amount = current.unit === target.unit && current.currency === target.currency
      ? `${quantityText(current)} of ${quantityText(target)}`
      : `Current ${quantityText(current)} · Goal ${quantityText(target)}`;
  } else if (current) {
    const prefix = benefit.activityKind === "credit_earned"
      ? "Earned"
      : benefit.activityKind === "spend_progress"
        ? "Progress"
        : "Recorded";
    amount = `${prefix} ${quantityText(current)}`;
  } else if (target) {
    amount = `Goal ${quantityText(target)}`;
  }

  return {
    ...state,
    amount,
    remaining: remaining ? `${quantityText(remaining)} remaining` : null,
    progress: current && target ? compatibleProgress(current, target) : null,
    period,
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

function filterLabel(filter: BenefitFilter): string {
  if (filter === "action") return "Needs action";
  if (filter === "progress") return "In progress";
  if (filter === "complete") return "Completed";
  return "All";
}

export class AmexBenefitReaderPanel implements ScanReporter {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private store: StoreEnvelopeV1;
  private mode: "idle" | "scanning" | "cancelling" | "error" = "idle";
  private progress = "Ready. Nothing is scanned until you start.";
  private errorMessage: string | null = null;
  private selectedCardId: string | null = null;
  private benefitFilter: BenefitFilter = "all";

  constructor(
    initialStore: StoreEnvelopeV1,
    private readonly actions: PanelActions,
    private readonly requiresReloadAfterClear = false,
  ) {
    this.store = initialStore;
    this.reconcileSelectedCard();
    this.host = document.createElement("div");
    this.host.id = "perks-reminder-amex-reader";
    this.root = this.host.attachShadow({ mode: "open" });
    document.documentElement.append(this.host);
    if (initialStore.lastScan) this.progress = scanSummaryText(initialStore.lastScan);
    this.render();
  }

  static mountError(message: string, clearData: () => Promise<void>): AmexBenefitReaderPanel | null {
    const now = new Date().toISOString();
    const empty: StoreEnvelopeV1 = { schemaVersion: 1, revision: 0, updatedAt: now, cards: {}, lastScan: null };
    const panel = new AmexBenefitReaderPanel(empty, {
      startScan: async () => undefined,
      cancelScan: () => undefined,
      clearData,
    }, true);
    panel.mode = "error";
    panel.errorMessage = message;
    panel.render();
    return panel;
  }

  report(progress: ScanProgress): void {
    if (progress.type === "started") {
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
      this.reconcileSelectedCard();
    } else if (progress.type === "verifying_context") {
      this.progress = "Finishing the scan and checking that the visible Amex page did not change…";
    } else {
      this.mode = "idle";
      this.store = { ...this.store, lastScan: progress.summary };
      this.progress = scanSummaryText(progress.summary);
    }
    this.render();
  }

  private reconcileSelectedCard(): void {
    const cards = sortedCards(this.store);
    if (!cards.length) {
      this.selectedCardId = null;
      this.benefitFilter = "all";
      return;
    }
    if (!this.selectedCardId || !cards.some((record) => record.localCardId === this.selectedCardId)) {
      this.selectedCardId = cards[0].localCardId;
      this.benefitFilter = "all";
    }
  }

  private async start(): Promise<void> {
    if (this.mode !== "idle") return;
    this.errorMessage = null;
    try {
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

  private async clear(): Promise<void> {
    if (!window.confirm("Clear all local Amex benefit observations and the local identity secret?")) return;
    try {
      await this.actions.clearData();
      this.store = { schemaVersion: 1, revision: 0, updatedAt: new Date().toISOString(), cards: {}, lastScan: null };
      this.selectedCardId = null;
      this.benefitFilter = "all";
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

  private renderBenefit(benefit: NormalizedBenefitObservationV1): HTMLElement {
    const presentation = benefitPresentation(benefit);
    const item = element("li");
    item.className = `benefit-card tone-${presentation.tone}`;
    item.dataset.bucket = presentation.bucket;

    const top = element("div");
    top.className = "benefit-top";
    const badge = element("span", presentation.label);
    badge.className = `status-pill tone-${presentation.tone}`;
    top.append(badge);
    if (presentation.period) {
      const period = element("span", presentation.period);
      period.className = "period";
      top.append(period);
    }
    item.append(top);

    const heading = element("h4", benefit.title);
    item.append(heading);
    if (presentation.amount) {
      const amount = element("p", presentation.amount);
      amount.className = "amount";
      item.append(amount);
    }
    if (presentation.progress != null) {
      const track = element("div");
      track.className = "progress-track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${benefit.title} progress`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(Math.round(presentation.progress)));
      const fill = element("div");
      fill.className = "progress-fill";
      fill.style.width = `${presentation.progress}%`;
      track.append(fill);
      item.append(track);
    }
    if (presentation.remaining) {
      const remaining = element("p", presentation.remaining);
      remaining.className = "remaining";
      item.append(remaining);
    }

    const details = element("details");
    details.className = "data-details";
    details.append(element("summary", "Data details"));
    const list = element("dl");
    const rows: Array<[string, string]> = [
      ["Category", fieldText(benefit.category)],
      ["Activity type", titleCase(benefit.activityKind)],
      ["Enrollment", fieldText(benefit.enrollmentState, titleCase)],
      ["Tracker", fieldText(benefit.trackerState, titleCase)],
      ["Period", fieldText(benefit.period)],
      ["Completion", fieldText(benefit.completionState, titleCase)],
      ["Confidence", titleCase(benefit.confidence)],
      ["Current amount", fieldText(benefit.earnedOrUsed, quantityText)],
      ["Goal or limit", fieldText(benefit.targetOrLimit, quantityText)],
      ["Remaining", fieldText(benefit.remaining, quantityText)],
    ];
    for (const [term, description] of rows) list.append(element("dt", term), element("dd", description));
    details.append(list);
    if (benefit.issueCodes.length) {
      const notes = element("ul");
      notes.className = "detail-notes";
      Array.from(new Set(benefit.issueCodes)).forEach((code) => notes.append(element("li", fixedErrorMessage(code))));
      details.append(notes);
    }
    item.append(details);
    return item;
  }

  private renderSelectedCard(record: StoredCardRecordV1): HTMLElement {
    const section = element("section");
    section.className = "card-workspace";
    section.setAttribute("aria-labelledby", "pr-selected-card-title");
    const quality = observationQuality(record);
    const benefits = record.latest?.benefits ?? [];
    const presentations = benefits.map((benefit) => ({ benefit, presentation: benefitPresentation(benefit) }));
    const counts: Record<BenefitFilter, number> = {
      all: presentations.length,
      action: presentations.filter(({ presentation }) => presentation.bucket === "action").length,
      progress: presentations.filter(({ presentation }) => presentation.bucket === "progress").length,
      complete: presentations.filter(({ presentation }) => presentation.bucket === "complete").length,
    };

    const headingRow = element("div");
    headingRow.className = "card-heading";
    const headingCopy = element("div");
    headingCopy.append(element("p", "Selected card"));
    const heading = element("h3", `${record.identity.productName} •••• ${record.identity.endingDigits}`);
    heading.id = "pr-selected-card-title";
    headingCopy.append(heading);
    const qualityBadge = element("span", quality.label);
    qualityBadge.className = `quality-pill quality-${quality.tone}`;
    headingRow.append(headingCopy, qualityBadge);
    section.append(headingRow);

    const summary = element("p", `${benefits.length} trackable benefit${benefits.length === 1 ? "" : "s"}`);
    summary.className = "card-summary";
    section.append(summary);

    if (record.error) {
      const error = element("p", record.error.message);
      error.className = "notice notice-warning";
      section.append(error);
    }

    if (benefits.length) {
      const filters = element("div");
      filters.className = "filters";
      filters.setAttribute("role", "group");
      filters.setAttribute("aria-label", "Filter benefits for selected card");
      (["all", "action", "progress", "complete"] as BenefitFilter[]).forEach((filter) => {
        const control = element("button", `${filterLabel(filter)} ${counts[filter]}`);
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
      section.append(filters);

      const filtered = presentations.filter(({ presentation }) =>
        this.benefitFilter === "all" || presentation.bucket === this.benefitFilter);
      if (!filtered.length) {
        const empty = element("p", `No ${filterLabel(this.benefitFilter).toLowerCase()} benefits on this card.`);
        empty.className = "empty-state";
        section.append(empty);
      } else {
        const list = element("ul");
        list.className = "benefit-list";
        filtered.forEach(({ benefit }) => list.append(this.renderBenefit(benefit)));
        section.append(list);
      }
    } else {
      const empty = element("p", record.latest
        ? "No trackable benefit activity was exposed for this card."
        : "No safe benefit observation is available for this card yet.");
      empty.className = "empty-state";
      section.append(empty);
    }

    const dataQuality = element("details");
    dataQuality.className = "secondary-panel";
    dataQuality.append(element("summary", "Data quality and timestamps"));
    const timeList = element("dl");
    timeList.append(
      element("dt", "Observed"), element("dd", formatDate(record.observedAt)),
      element("dt", "Last attempt"), element("dd", formatDate(record.lastAttemptAt)),
    );
    dataQuality.append(timeList);
    if (record.latest?.issueCodes.length) {
      const issues = element("ul");
      issues.className = "detail-notes";
      Array.from(new Set(record.latest.issueCodes)).forEach((code) => issues.append(element("li", fixedErrorMessage(code))));
      dataQuality.append(issues);
    }
    section.append(dataQuality);
    return section;
  }

  private renderAccountNotes(): HTMLElement | null {
    const messages: string[] = [];
    if (hasMixedObservations(this.store)) {
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
      .panel { position: fixed; z-index: 2147483647; top: 16px; right: 16px; width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; border: 1px solid var(--pr-border); border-radius: 16px; background: var(--pr-bg); color: var(--pr-text); box-shadow: 0 18px 50px rgba(15,23,42,.18); font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      h2,h3,h4,p { margin: 0; } h2 { font-size: 19px; line-height: 1.2; } h3 { font-size: 16px; line-height: 1.3; } h4 { margin-top: 10px; font-size: 15px; line-height: 1.35; } ul { margin: 0; }
      .top { padding: 18px; border-bottom: 1px solid var(--pr-border); background: var(--pr-card); border-radius: 16px 16px 0 0; }
      .brand-row { display: flex; align-items: center; gap: 10px; }
      .brand-mark { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 10px; background: var(--pr-primary); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .04em; }
      .eyebrow { margin-top: 2px; color: var(--pr-muted); font-size: 12px; }
      .privacy-banner { margin-top: 14px; padding: 10px 12px; border: 1px solid #dbeafe; border-radius: 10px; background: #f0f7ff; color: #334155; font-size: 12px; }
      .privacy-banner strong { display: block; margin-bottom: 2px; color: #1e3a5f; font-size: 13px; }
      .controls { display: flex; gap: 8px; margin-top: 14px; }
      button, select { min-height: 40px; border-radius: 9px; font: inherit; }
      button { border: 1px solid var(--pr-border); background: var(--pr-card); color: var(--pr-text); font-weight: 650; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, color .15s ease, transform .15s ease; }
      button:active { transform: translateY(1px); }
      button.primary { flex: 1; border-color: var(--pr-primary); background: var(--pr-primary); color: #fff; box-shadow: 0 2px 5px rgba(15,23,42,.12); }
      button.primary:hover { background: var(--pr-primary-hover); }
      button:focus-visible, select:focus-visible, summary:focus-visible { outline: 3px solid rgba(71,85,105,.28); outline-offset: 2px; }
      button:disabled { opacity: .52; cursor: default; transform: none; }
      .scan-status { margin-top: 12px; padding: 10px 12px; border: 1px solid var(--pr-border); border-radius: 10px; background: #f8fafc; color: #475467; font-size: 13px; }
      .notice { margin-top: 10px; padding: 10px 12px; border-radius: 10px; font-size: 13px; }
      .notice-warning { border: 1px solid var(--pr-amber-border); background: var(--pr-amber-bg); color: #92400e; }
      .content { padding: 16px; }
      .account-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .metric { padding: 10px; border: 1px solid var(--pr-border); border-radius: 10px; background: var(--pr-card); }
      .metric strong { display: block; font-size: 17px; line-height: 1.2; }
      .metric span { display: block; margin-top: 3px; color: var(--pr-muted); font-size: 11px; }
      .card-picker { display: block; margin-bottom: 14px; }
      .card-picker > span { display: block; margin-bottom: 6px; color: #475467; font-size: 12px; font-weight: 700; }
      select { width: 100%; padding: 0 36px 0 12px; border: 1px solid #cfd4dc; background: var(--pr-card); color: var(--pr-text); font-weight: 650; }
      .card-workspace { padding: 16px; border: 1px solid var(--pr-border); border-radius: 14px; background: var(--pr-card); box-shadow: 0 1px 2px rgba(15,23,42,.04); }
      .card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .card-heading p { margin-bottom: 3px; color: var(--pr-muted); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
      .card-summary { margin-top: 7px; color: var(--pr-muted); font-size: 12px; }
      .quality-pill, .status-pill { display: inline-flex; align-items: center; flex: 0 0 auto; border: 1px solid; border-radius: 999px; font-size: 11px; font-weight: 750; white-space: nowrap; }
      .quality-pill { padding: 4px 8px; }
      .quality-good { border-color: var(--pr-green-border); background: var(--pr-green-bg); color: #047857; }
      .quality-note { border-color: var(--pr-blue-border); background: var(--pr-blue-bg); color: #1d4ed8; }
      .quality-warning { border-color: var(--pr-amber-border); background: var(--pr-amber-bg); color: #92400e; }
      .quality-error { border-color: var(--pr-red-border); background: var(--pr-red-bg); color: #b91c1c; }
      .filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-top: 14px; }
      .filter-button { min-height: 34px; padding: 6px 8px; color: #475467; font-size: 12px; }
      .filter-button[aria-pressed="true"] { border-color: #94a3b8; background: #eef2f6; color: #1f2937; box-shadow: inset 0 0 0 1px rgba(71,85,105,.08); }
      .benefit-list { display: grid; gap: 10px; padding: 0; margin-top: 12px; list-style: none; }
      .benefit-card { position: relative; overflow: hidden; padding: 13px 13px 12px 16px; border: 1px solid var(--pr-border); border-radius: 11px; background: var(--pr-card); box-shadow: 0 1px 2px rgba(15,23,42,.04); }
      .benefit-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: #94a3b8; }
      .benefit-card.tone-amber::before { background: #f59e0b; } .benefit-card.tone-blue::before { background: #3b82f6; } .benefit-card.tone-green::before { background: #10b981; }
      .benefit-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .status-pill { padding: 3px 7px; }
      .status-pill.tone-amber { border-color: var(--pr-amber-border); background: var(--pr-amber-bg); color: #92400e; }
      .status-pill.tone-blue { border-color: var(--pr-blue-border); background: var(--pr-blue-bg); color: #1d4ed8; }
      .status-pill.tone-green { border-color: var(--pr-green-border); background: var(--pr-green-bg); color: #047857; }
      .status-pill.tone-muted { border-color: var(--pr-border); background: #f8fafc; color: #667085; }
      .period { overflow: hidden; color: var(--pr-muted); font-size: 11px; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
      .amount { margin-top: 6px; color: #111827; font-size: 17px; font-weight: 750; font-variant-numeric: tabular-nums; }
      .remaining { margin-top: 5px; color: var(--pr-muted); font-size: 12px; }
      .progress-track { height: 7px; margin-top: 9px; overflow: hidden; border-radius: 999px; background: #e5e7eb; }
      .progress-fill { height: 100%; border-radius: inherit; background: #3b82f6; }
      .tone-green .progress-fill { background: #10b981; } .tone-amber .progress-fill { background: #f59e0b; }
      details { margin-top: 10px; }
      summary { color: #475467; font-size: 12px; font-weight: 700; cursor: pointer; }
      dl { display: grid; grid-template-columns: minmax(100px, auto) 1fr; gap: 5px 10px; margin: 10px 0 0; font-size: 12px; }
      dt { color: #475467; font-weight: 700; } dd { margin: 0; overflow-wrap: anywhere; color: var(--pr-muted); }
      .detail-notes { margin-top: 10px; padding-left: 18px; color: #92400e; font-size: 12px; }
      .secondary-panel { padding: 10px 12px; border: 1px solid var(--pr-border); border-radius: 10px; background: #f8fafc; }
      .account-notes { margin: 12px 0 0; }
      .account-notes ul { margin-top: 9px; padding-left: 18px; color: #475467; font-size: 12px; }
      .empty-state { margin-top: 12px; padding: 18px 12px; border: 1px dashed #cbd5e1; border-radius: 10px; color: var(--pr-muted); text-align: center; }
      .footer { padding: 0 16px 16px; }
      .privacy-details p { margin-top: 8px; color: var(--pr-muted); font-size: 12px; }
      .clear-button { width: 100%; margin-top: 10px; padding: 8px 10px; border-color: var(--pr-red-border); color: #b91c1c; }
      @media (max-width: 520px) { .panel { top: 8px; right: 8px; width: calc(100vw - 16px); max-height: calc(100vh - 16px); } .account-summary { grid-template-columns: repeat(3, minmax(0,1fr)); } }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
    `;

    const panel = element("section");
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
    top.append(brand);

    const disclosure = element("div");
    disclosure.className = "privacy-banner";
    disclosure.append(
      element("strong", "Local only — not sent to Perks Reminder"),
      element("span", "A manual scan uses your signed-in Amex session for first-party read requests. Raw responses are not saved."),
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

    const cards = sortedCards(this.store);
    const content = element("div");
    content.className = "content";
    if (cards.length) {
      const totalBenefits = cards.reduce((sum, record) => sum + (record.latest?.benefits.length ?? 0), 0);
      const dataNoteCards = cards.filter((record) => observationQuality(record).tone !== "good").length;
      const metrics = element("div");
      metrics.className = "account-summary";
      ([[String(cards.length), "Cards"], [String(totalBenefits), "Benefits"], [String(dataNoteCards), "Data notes"]] as Array<[string,string]>).forEach(([value, label]) => {
        const metric = element("div");
        metric.className = "metric";
        metric.append(element("strong", value), element("span", label));
        metrics.append(metric);
      });
      content.append(metrics);

      const picker = element("label");
      picker.className = "card-picker";
      picker.append(element("span", "Choose a card"));
      const select = element("select");
      select.setAttribute("aria-label", "Choose a card to review");
      cards.forEach((record) => {
        const option = element("option", `${record.identity.productName} •••• ${record.identity.endingDigits}`);
        option.value = record.localCardId;
        option.selected = record.localCardId === this.selectedCardId;
        select.append(option);
      });
      select.addEventListener("change", () => {
        this.selectedCardId = select.value;
        this.benefitFilter = "all";
        this.render();
      });
      picker.append(select);
      content.append(picker);

      const selected = cards.find((record) => record.localCardId === this.selectedCardId) ?? cards[0];
      content.append(this.renderSelectedCard(selected));
    } else {
      const empty = element("p", "No local card observations yet. Start a scan when you are ready.");
      empty.className = "empty-state";
      content.append(empty);
    }
    const accountNotes = this.renderAccountNotes();
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
    clear.disabled = this.mode === "scanning" || this.mode === "cancelling";
    clear.addEventListener("click", () => void this.clear());
    privacy.append(clear);
    footer.append(privacy);
    panel.append(footer);

    this.root.append(style, panel);
  }
}
