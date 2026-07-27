import { fireEvent, waitFor } from "@testing-library/react";
import type {
  NormalizedBenefitObservationV1,
  NormalizedBenefitObservationV2,
  StoreEnvelopeV1,
} from "@/lib/amex-benefit-reader/contract";
import { createEmptyStore, mergeCardAttempt, mergeScanSummary } from "@/lib/amex-benefit-reader/storage-policy";
import { AmexBenefitReaderPanel, deriveBenefitUsageState, formatAmexSourcePeriod } from "../panel";

const now = "2026-07-15T12:00:00.000Z";
const cardOneId = "11111111-1111-4111-8111-111111111111";
const cardTwoId = "22222222-2222-4222-8222-222222222222";

function shadow(): ShadowRoot {
  return document.getElementById("perks-reminder-amex-reader")!.shadowRoot!;
}

function button(name: string): HTMLButtonElement {
  return Array.from(shadow().querySelectorAll("button")).find((item) => item.textContent === name) as HTMLButtonElement;
}

function benefit(overrides: Partial<NormalizedBenefitObservationV1> = {}): NormalizedBenefitObservationV1 {
  return {
    benefitKey: "benefit-1234567890abcdef",
    title: "Synthetic benefit",
    category: { state: "observed", value: "usage" },
    activityKind: "spend_progress",
    enrollmentState: { state: "not_exposed" },
    trackerState: { state: "observed", value: "not_started" },
    completionState: { state: "observed", value: "incomplete" },
    earnedOrUsed: { state: "not_exposed" },
    targetOrLimit: { state: "not_exposed" },
    remaining: { state: "not_exposed" },
    period: { state: "not_exposed" },
    confidence: "high",
    issueCodes: [],
    ...overrides,
  };
}

function addCard(
  store: StoreEnvelopeV1,
  input: {
    localCardId?: string;
    productName?: string;
    endingDigits?: string;
    benefits?: NormalizedBenefitObservationV1[];
    disposition?: "complete" | "partial";
    issueCodes?: NormalizedBenefitObservationV1["issueCodes"];
  } = {},
): StoreEnvelopeV1 {
  const localCardId = input.localCardId ?? cardOneId;
  const productName = input.productName ?? "Synthetic Card";
  const endingDigits = input.endingDigits ?? "1234";
  const disposition = input.disposition ?? "complete";
  return mergeCardAttempt(store, {
    disposition,
    identity: {
      localCardId,
      sourceFingerprint: localCardId === cardOneId ? "a".repeat(64) : "b".repeat(64),
      productName,
      endingDigits,
    },
    attemptedAt: now,
    observation: {
      contractVersion: "amex-benefits/1",
      issuer: "american_express_us",
      localCardId,
      productName,
      endingDigits,
      observedAt: now,
      parserVersion: "fixture/1",
      completeness: disposition,
      issueCodes: input.issueCodes ?? [],
      benefits: input.benefits ?? [],
    },
  }).store;
}

function withLatestScan(store: StoreEnvelopeV1): StoreEnvelopeV1 {
  const cards = Object.values(store.cards).map((record) => ({
    localCardId: record.localCardId,
    result: record.completeness === "failed" ? "failed" as const : record.completeness,
    issueCode: record.error?.code ?? record.latest?.issueCodes[0] ?? null,
  }));
  return mergeScanSummary(store, {
    startedAt: now,
    finishedAt: "2026-07-15T12:01:00.000Z",
    status: cards.some((card) => card.result !== "complete") ? "partial" : "complete",
    discoveredCardCount: cards.length,
    attemptedCardCount: cards.length,
    unknownAccountVariantCount: 0,
    cards,
    visibleContext: "unchanged",
  });
}

describe("Amex reader side panel", () => {
  beforeEach(() => {
    document.getElementById("perks-reminder-amex-reader")?.remove();
    jest.restoreAllMocks();
  });

  it("mounts the local-only reader without scanning automatically", () => {
    const startScan = jest.fn(async () => undefined);
    new AmexBenefitReaderPanel(createEmptyStore(now), {
      startScan,
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().textContent).toContain("Amex benefits");
    expect(shadow().textContent).toContain("Local unless you choose Sync reviewed");
    expect(shadow().textContent).toContain("No local card observations yet");
    expect(button("Scan all cards")).toBeEnabled();
    expect(startScan).not.toHaveBeenCalled();
    expect(shadow().querySelector('[role="progressbar"]')).toBeNull();
  });

  it("uses a collapsed launcher off primary routes without starting work", () => {
    const startScan = jest.fn(async () => undefined);
    new AmexBenefitReaderPanel(createEmptyStore(now), {
      startScan,
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    }, { initiallyCollapsed: true });

    expect(button("PR")).toHaveAccessibleName("Open Perks Reminder Amex benefit reader");
    expect(shadow().querySelector("#pr-reader-panel")).toBeNull();
    fireEvent.click(button("PR"));
    expect(button("Collapse")).toHaveAccessibleName("Collapse Perks Reminder Amex benefit reader");
    expect(button("Scan all cards")).toBeEnabled();
    expect(startScan).not.toHaveBeenCalled();
  });

  it("shows only determinate scan progress while data is committed and restores results after finish", async () => {
    let release!: () => void;
    const startScan = jest.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const cancelScan = jest.fn();
    const stored = addCard(createEmptyStore(now), {
      benefits: [benefit({ title: "Stored benefit before scan" })],
    });
    const committedStore = addCard(createEmptyStore(now), {
      localCardId: cardTwoId,
      productName: "Committed Card",
      endingDigits: "56789",
      benefits: [benefit({ benefitKey: "benefit-committed-123456", title: "Committed benefit during scan" })],
    });
    const panel = new AmexBenefitReaderPanel(stored, { startScan, cancelScan, clearData: jest.fn(async () => undefined) });

    fireEvent.click(button("Scan all cards"));
    await waitFor(() => expect(startScan).toHaveBeenCalledTimes(1));
    panel.report({ type: "started" });
    panel.report({ type: "discovered", cardCount: 2, unknownEntryCount: 1 });
    panel.report({
      type: "card",
      cardIndex: 1,
      cardCount: 2,
      productName: "Committed Card",
      endingDigits: "56789",
      phase: "trackers",
    });
    panel.report({
      type: "card_committed",
      record: committedStore.cards[cardTwoId],
      conflictDiagnostics: [],
      conflictDetails: { details: [], totalCount: 0, truncated: false },
    });

    const progress = shadow().querySelector("progress");
    expect(progress).toHaveAccessibleName("Scan progress");
    expect(progress).toHaveAttribute("max", "2");
    expect(progress).toHaveAttribute("value", "1");
    expect(progress).toHaveAttribute("aria-valuetext", "Card 1 of 2");
    expect(shadow().querySelector('[role="status"]')).toHaveTextContent("Reading card 1 of 2");
    expect(button("Cancel")).toBeEnabled();
    expect(shadow().querySelector(".card-group")).toBeNull();
    expect(shadow().querySelector(".filters")).toBeNull();
    expect(shadow().textContent).not.toContain("Stored benefit before scan");
    expect(shadow().textContent).not.toContain("Committed benefit during scan");
    expect(shadow().textContent).not.toContain("Data and privacy");
    expect(shadow().textContent).not.toContain("Sync reviewed");

    panel.report({ type: "finished", summary: withLatestScan(committedStore).lastScan! });
    expect(shadow().querySelector('[role="progressbar"]')).toBeNull();
    expect(button("Scan all cards")).toBeEnabled();
    expect(shadow().textContent).toContain("Committed benefit during scan");
    expect(shadow().textContent).toContain("Stored benefit before scan");
    release();
  });

  it("keeps the progress-only workspace visible while cancelling", async () => {
    let release!: () => void;
    const startScan = jest.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const cancelScan = jest.fn();
    new AmexBenefitReaderPanel(addCard(createEmptyStore(now), { benefits: [benefit()] }), {
      startScan,
      cancelScan,
      clearData: jest.fn(async () => undefined),
    });

    fireEvent.click(button("Scan all cards"));
    await waitFor(() => expect(startScan).toHaveBeenCalledTimes(1));
    fireEvent.click(button("Cancel"));
    expect(cancelScan).toHaveBeenCalledTimes(1);
    expect(button("Cancelling…")).toBeDisabled();
    expect(shadow().querySelector(".card-group")).toBeNull();
    expect(shadow().querySelector(".footer")).toBeNull();
    release();
  });

  it("keeps zero-card progress isolated until the engine reports finished", async () => {
    const startScan = jest.fn(async () => undefined);
    const panel = new AmexBenefitReaderPanel(addCard(createEmptyStore(now), {
      benefits: [benefit({ title: "Stored benefit before zero-card scan" })],
    }), {
      startScan,
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    fireEvent.click(button("Scan all cards"));
    await waitFor(() => expect(startScan).toHaveBeenCalledTimes(1));
    panel.report({ type: "started" });
    panel.report({ type: "discovered", cardCount: 0, unknownEntryCount: 0 });

    const progress = shadow().querySelector("progress");
    expect(progress).toHaveAccessibleName("Scan progress");
    expect(progress).not.toHaveAttribute("max");
    expect(progress).not.toHaveAttribute("value");
    expect(shadow().querySelector('[role="status"]')).toHaveTextContent("No eligible cards were found. Finishing the scan");
    expect(button("Cancel")).toBeEnabled();
    expect(shadow().textContent).not.toContain("Stored benefit before zero-card scan");
    expect(shadow().querySelector(".filters")).toBeNull();
    expect(shadow().querySelector(".footer")).toBeNull();

    await Promise.resolve();
    expect(shadow().querySelector("progress")).not.toBeNull();
    expect(button("Cancel")).toBeEnabled();

    panel.report({ type: "finished", summary: withLatestScan(createEmptyStore(now)).lastScan! });
    expect(shadow().querySelector("progress")).toBeNull();
    expect(button("Scan all cards")).toBeEnabled();
    expect(shadow().textContent).toContain("Stored benefit before zero-card scan");
  });

  it("does not display scan notes, quality fields, timestamps, or conflict diagnostics after completion", () => {
    const store = withLatestScan(addCard(createEmptyStore(now), {
      disposition: "partial",
      issueCodes: ["benefit_identity_conflict"],
      benefits: [benefit({ title: "Visible credit" })],
    }));
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().textContent).toContain("Visible credit");
    expect(shadow().textContent).not.toContain("Scan notes");
    expect(shadow().textContent).not.toContain("Data quality");
    expect(shadow().textContent).not.toContain("Partial data");
    expect(shadow().textContent).not.toContain("Observed");
    expect(shadow().textContent).not.toContain("Last attempt");
    expect(shadow().textContent).not.toContain("Parser");
    expect(shadow().textContent).not.toContain("Benefit confidence");
    expect(shadow().textContent).not.toContain("Benefit matching notes");
    expect(shadow().querySelector(".quality-pill")).toBeNull();
    expect(shadow().querySelector(".data-quality")).toBeNull();
    expect(shadow().querySelector('[data-amex-conflict]')).toBeNull();
  });

  it("renders only cards with rows in the active filter", () => {
    const remaining = benefit({ title: "Remaining benefit" });
    const used = benefit({
      benefitKey: "benefit-used-1234567890",
      title: "Used benefit",
      completionState: { state: "observed", value: "complete" },
    });
    let store = addCard(createEmptyStore(now), { benefits: [remaining] });
    store = addCard(store, {
      localCardId: cardTwoId,
      productName: "Used Card",
      endingDigits: "56789",
      benefits: [used],
    });
    new AmexBenefitReaderPanel(withLatestScan(store), {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().querySelectorAll(".card-group")).toHaveLength(1);
    expect(shadow().textContent).toContain("Remaining benefit");
    expect(shadow().textContent).not.toContain("Used Card •••• 56789");
    fireEvent.click(button("Used 1"));
    expect(shadow().querySelectorAll(".card-group")).toHaveLength(1);
    expect(shadow().textContent).toContain("Used Card •••• 56789");
    expect(shadow().textContent).toContain("Used benefit");
    expect(shadow().textContent).not.toContain("Remaining benefit");
  });

  it("formats structured periods and suppresses raw provider tokens when a V2 range is observed", () => {
    const sourcePeriod: NormalizedBenefitObservationV2["sourcePeriod"] = {
      state: "observed",
      value: {
        kind: "calendar_date_range",
        startDate: "2026-07-01",
        endDate: "2026-09-30",
        timeZone: "UTC",
      },
    };
    const v2Benefit: NormalizedBenefitObservationV2 = {
      ...benefit({ period: { state: "observed", value: "QuarterYear" } }),
      creditFamilyKey: "american-express-platinum-card:resy",
      sourcePeriod,
    };
    const store = addCard(createEmptyStore(now), { benefits: [benefit({ period: { state: "observed", value: "QuarterYear" } })] });
    const latest = store.cards[cardOneId].latest;
    if (!latest) throw new Error("Expected a synthetic observation.");
    store.cards[cardOneId].latest = {
      ...latest,
      contractVersion: "amex-benefits/2",
      scanId: "99999999-9999-4999-8999-999999999999",
      productKey: "american-express-platinum-card",
      benefits: [v2Benefit],
    };
    new AmexBenefitReaderPanel(withLatestScan(store), {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().textContent).toContain("Jul–Sep 2026");
    expect(shadow().textContent).not.toContain("QuarterYear");
    const period = (startDate: string, endDate: string) => ({ kind: "calendar_date_range" as const, startDate, endDate, timeZone: "UTC" as const });
    expect(formatAmexSourcePeriod(period("2026-01-01", "2026-12-31"))).toBe("2026");
    expect(formatAmexSourcePeriod(period("2026-07-01", "2026-12-31"))).toBe("Jul–Dec 2026");
  });

  it("derives truthful usage states without conflating them with observation quality", () => {
    const quantity = (value: string) => ({ value, unit: "USD" as const, currency: "USD" as const });
    expect(deriveBenefitUsageState(benefit({ enrollmentState: { state: "observed", value: "required" } })).label).toBe("Enrollment required");
    expect(deriveBenefitUsageState(benefit({ completionState: { state: "observed", value: "complete" } })).label).toBe("Used");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "observed", value: "in_progress" },
      earnedOrUsed: { state: "observed", value: quantity("0") },
      targetOrLimit: { state: "observed", value: quantity("100") },
    })).label).toBe("Not used");
    expect(deriveBenefitUsageState(benefit({ trackerState: { state: "observed", value: "in_progress" } })).label).toBe("Partially used");
    expect(deriveBenefitUsageState(benefit({ trackerState: { state: "not_exposed" }, completionState: { state: "not_exposed" } })).label).toBe("Status unavailable");
  });

  it("requires confirmation before clearing local data without starting a scan", async () => {
    const clearData = jest.fn(async () => undefined);
    jest.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    new AmexBenefitReaderPanel(createEmptyStore(now), {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData,
    });

    fireEvent.click(button("Clear local data"));
    expect(clearData).not.toHaveBeenCalled();
    fireEvent.click(button("Clear local data"));
    await waitFor(() => expect(clearData).toHaveBeenCalledTimes(1));
    expect(shadow().textContent).toContain("No local card observations yet");
  });
});
