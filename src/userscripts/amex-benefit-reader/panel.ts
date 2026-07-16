import type {
  NormalizedBenefitObservationV1,
  ObservedField,
  QuantityV1,
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

function fieldText<T>(field: ObservedField<T>, format: (value: T) => string = String): string {
  if (field.state === "observed") return format(field.value);
  return field.state === "not_exposed" ? "Not exposed" : "Unrecognized";
}

function quantityText(quantity: QuantityV1): string {
  if (quantity.unit === "USD") return `$${quantity.value}`;
  if (quantity.unit === "percent") return `${quantity.value}%`;
  return `${quantity.value} ${quantity.unit}`;
}

function primaryBenefitStatus(benefit: NormalizedBenefitObservationV1): string {
  if (benefit.completionState.state === "observed" && benefit.completionState.value === "complete") return "Complete";
  if (benefit.trackerState.state === "observed") return benefit.trackerState.value.replace(/_/g, " ");
  if (benefit.enrollmentState.state === "observed") return benefit.enrollmentState.value.replace(/_/g, " ");
  if (benefit.completionState.state === "observed") return "Incomplete";
  return benefit.activityKind.replace(/_/g, " ");
}

function cardBadge(record: StoredCardRecordV1): string {
  if (record.freshness === "error_no_data") return "Error";
  if (record.freshness === "stale_error") return "Stale";
  if (record.completeness === "partial") return "Incomplete";
  return "Current";
}

export class AmexBenefitReaderPanel implements ScanReporter {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private store: StoreEnvelopeV1;
  private mode: "idle" | "scanning" | "cancelling" | "error" = "idle";
  private progress = "Ready. Nothing is scanned until you start.";
  private errorMessage: string | null = null;

  constructor(
    initialStore: StoreEnvelopeV1,
    private readonly actions: PanelActions,
    private readonly requiresReloadAfterClear = false,
  ) {
    this.store = initialStore;
    this.host = document.createElement("div");
    this.host.id = "perks-reminder-amex-reader";
    this.root = this.host.attachShadow({ mode: "open" });
    document.documentElement.append(this.host);
    if (initialStore.lastScan?.status === "interrupted") {
      const { attemptedCardCount, discoveredCardCount } = initialStore.lastScan;
      this.progress = `Previous user-requested scan was interrupted after ${attemptedCardCount} of ${discoveredCardCount} cards were attempted. Nothing resumes until you press Scan all cards.`;
    } else if (initialStore.lastScan) {
      const { status, attemptedCardCount } = initialStore.lastScan;
      this.progress = `Last scan ${status}. ${attemptedCardCount} card${attemptedCardCount === 1 ? "" : "s"} attempted. Nothing is scanned until you start.`;
    }
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
      this.progress = "Starting user-requested scan…";
    } else if (progress.type === "discovered") {
      this.progress = `Found ${progress.cardCount} supported card${progress.cardCount === 1 ? "" : "s"}${progress.unknownEntryCount ? ` and ${progress.unknownEntryCount} unknown account variant${progress.unknownEntryCount === 1 ? "" : "s"}` : ""}.`;
    } else if (progress.type === "card") {
      const phase = progress.phase === "trackers"
        ? "reading benefit trackers"
        : progress.phase === "catalog"
          ? "reading benefit catalog"
          : "normalizing approved fields";
      this.progress = `Card ${progress.cardIndex} of ${progress.cardCount} — ${phase}: ${progress.productName} ending ${progress.endingDigits}`;
    } else if (progress.type === "card_committed") {
      this.store = { ...this.store, cards: { ...this.store.cards, [progress.record.localCardId]: progress.record } };
    } else if (progress.type === "verifying_context") {
      this.progress = "Verifying that the visible Amex card and route did not change…";
    } else {
      this.mode = "idle";
      this.store = { ...this.store, lastScan: progress.summary };
      this.progress = `Scan ${progress.summary.status}. ${progress.summary.attemptedCardCount} card${progress.summary.attemptedCardCount === 1 ? "" : "s"} attempted.`;
    }
    this.render();
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
    const item = element("li");
    item.className = "benefit";
    const heading = element("strong", benefit.title);
    item.append(heading);
    const primary = element("div", primaryBenefitStatus(benefit));
    primary.className = "primary-status";
    const amounts = [
      benefit.earnedOrUsed.state === "observed" ? `Used/earned ${quantityText(benefit.earnedOrUsed.value)}` : null,
      benefit.targetOrLimit.state === "observed" ? `of ${quantityText(benefit.targetOrLimit.value)}` : null,
      benefit.remaining.state === "observed" ? `${quantityText(benefit.remaining.value)} remaining` : null,
    ].filter(Boolean).join(" ");
    if (amounts) primary.append(` — ${amounts}`);
    item.append(primary);
    const details = element("details");
    const summary = element("summary", "Details");
    details.append(summary);
    const list = element("dl");
    const rows: Array<[string, string]> = [
      ["Category", fieldText(benefit.category)],
      ["Activity", benefit.activityKind.replace(/_/g, " ")],
      ["Enrollment", fieldText(benefit.enrollmentState, (value) => value.replace(/_/g, " "))],
      ["Tracker", fieldText(benefit.trackerState, (value) => value.replace(/_/g, " "))],
      ["Period", fieldText(benefit.period)],
      ["Completion", fieldText(benefit.completionState)],
      ["Confidence", benefit.confidence],
      ["Used/earned field", fieldText(benefit.earnedOrUsed, quantityText)],
      ["Target field", fieldText(benefit.targetOrLimit, quantityText)],
      ["Remaining field", fieldText(benefit.remaining, quantityText)],
    ];
    for (const [term, description] of rows) {
      list.append(element("dt", term), element("dd", description));
    }
    details.append(list);
    item.append(details);
    return item;
  }

  private renderCard(record: StoredCardRecordV1): HTMLElement {
    const article = element("article");
    article.className = "card";
    const title = element("h3", `${record.identity.productName} •••• ${record.identity.endingDigits}`);
    const badge = element("span", cardBadge(record));
    badge.className = `badge ${record.freshness}`;
    title.append(" ", badge);
    article.append(title);
    article.append(element("p", `Observed: ${formatDate(record.observedAt)} · Last attempt: ${formatDate(record.lastAttemptAt)}`));
    if (record.error) {
      const error = element("p", record.error.message);
      error.className = "warning";
      article.append(error);
    }
    if (record.latest?.issueCodes.length) {
      const issues = element("ul");
      issues.className = "warning issue-list";
      Array.from(new Set(record.latest.issueCodes)).forEach((code) => issues.append(element("li", fixedErrorMessage(code))));
      article.append(issues);
    }
    if (record.latest) {
      const list = element("ul");
      list.className = "benefits";
      if (!record.latest.benefits.length) list.append(element("li", "No trackable benefit activity was exposed."));
      else record.latest.benefits.forEach((benefit) => list.append(this.renderBenefit(benefit)));
      article.append(list);
    }
    return article;
  }

  private render(): void {
    this.root.replaceChildren();
    const style = element("style");
    style.textContent = `
      :host { all: initial; }
      .panel { position: fixed; z-index: 2147483647; top: 16px; right: 16px; width: min(390px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; padding: 16px; border: 1px solid #bcc5d3; border-radius: 12px; background: #fff; color: #182230; box-shadow: 0 8px 30px rgba(0,0,0,.22); font: 14px/1.4 system-ui, sans-serif; }
      h2,h3,p { margin: 0 0 10px; } h2 { font-size: 18px; } h3 { font-size: 15px; }
      .disclosure { padding: 8px; border-radius: 6px; background: #e7f0ff; font-weight: 700; }
      .controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
      button { min-height: 40px; padding: 7px 12px; border: 1px solid #52657c; border-radius: 6px; background: #fff; color: #182230; font: inherit; cursor: pointer; }
      button.primary { background: #163f75; color: #fff; } button:focus-visible, summary:focus-visible { outline: 3px solid #f4b400; outline-offset: 2px; } button:disabled { opacity: .55; cursor: default; }
      .status, .warning { padding: 8px; border-radius: 6px; background: #fff3cd; } .warning { color: #712b1b; } .issue-list { padding-left: 26px; }
      .card { border-top: 1px solid #d7dde5; padding: 12px 0 2px; } .badge { display: inline-block; padding: 2px 6px; border-radius: 99px; background: #dbe8db; font-size: 11px; } .stale_error,.error_no_data { background: #ffe2dc; }
      .benefits { padding-left: 18px; } .benefit { margin: 10px 0; } .primary-status { text-transform: capitalize; } details { margin-top: 5px; } summary { cursor: pointer; }
      dl { display: grid; grid-template-columns: minmax(90px, auto) 1fr; gap: 3px 8px; font-size: 12px; } dt { font-weight: 700; } dd { margin: 0; overflow-wrap: anywhere; }
    `;
    const panel = element("section");
    panel.className = "panel";
    panel.setAttribute("aria-labelledby", "pr-reader-title");
    const title = element("h2", "Amex Benefit Reader");
    title.id = "pr-reader-title";
    const disclosure = element("p", "Local only — not sent to Perks Reminder");
    disclosure.className = "disclosure";
    const requestDisclosure = element(
      "p",
      "A manual scan makes first-party American Express read requests with your current signed-in session. Raw responses are not saved.",
    );
    panel.append(title, disclosure, requestDisclosure);

    const controls = element("div");
    controls.className = "controls";
    const scan = element("button", "Scan all cards");
    scan.className = "primary";
    scan.disabled = this.mode !== "idle";
    scan.addEventListener("click", () => void this.start());
    controls.append(scan);
    if (this.mode === "scanning" || this.mode === "cancelling") {
      const cancel = element("button", this.mode === "cancelling" ? "Cancelling…" : "Cancel");
      cancel.disabled = this.mode === "cancelling";
      cancel.addEventListener("click", () => this.cancel());
      controls.append(cancel);
    }
    const clear = element("button", "Clear local data");
    clear.disabled = this.mode === "scanning" || this.mode === "cancelling";
    clear.addEventListener("click", () => void this.clear());
    controls.append(clear);
    panel.append(controls);

    const status = element("p", this.progress);
    status.className = "status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    panel.append(status);
    if (this.errorMessage) {
      const error = element("p", this.errorMessage);
      error.className = "warning";
      error.setAttribute("role", "alert");
      panel.append(error);
    }
    if (hasMixedObservations(this.store)) {
      const mixed = element("p", "Mixed observation times or incomplete/stale records are shown. This account is not fully current.");
      mixed.className = "warning";
      panel.append(mixed);
    }
    if (this.store.lastScan?.unknownAccountVariantCount) {
      const count = this.store.lastScan.unknownAccountVariantCount;
      const unknown = element("p", count === 1
        ? "1 account response variant was not recognized and was not scanned."
        : `${count} account response variants were not recognized and were not scanned.`);
      unknown.className = "warning";
      panel.append(unknown);
    }
    if (this.store.lastScan?.visibleContext === "changed") {
      const contextWarning = element("p", fixedErrorMessage("visible_context_changed"));
      contextWarning.className = "warning";
      panel.append(contextWarning);
    } else if (this.store.lastScan?.visibleContext === "unavailable") {
      const contextWarning = element("p", "The visible Amex card context could not be verified. This scan is not fully current.");
      contextWarning.className = "warning";
      panel.append(contextWarning);
    }
    if (this.store.lastScan?.status === "interrupted") {
      const interrupted = element("p", "The scan was interrupted. Previously committed card observations remain local; uncommitted cards were not updated.");
      interrupted.className = "warning";
      panel.append(interrupted);
    }
    const cards = Object.values(this.store.cards).sort((left, right) =>
      left.identity.productName.localeCompare(right.identity.productName) || left.identity.endingDigits.localeCompare(right.identity.endingDigits),
    );
    if (!cards.length) panel.append(element("p", "No local card observations yet."));
    cards.forEach((record) => panel.append(this.renderCard(record)));
    this.root.append(style, panel);
  }
}
