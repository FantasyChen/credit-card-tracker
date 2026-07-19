import { fireEvent, waitFor } from "@testing-library/react";
import type { NormalizedBenefitObservationV1, StoreEnvelopeV1 } from "@/lib/amex-benefit-reader/contract";
import { createEmptyStore, mergeCardAttempt, mergeScanSummary } from "@/lib/amex-benefit-reader/storage-policy";
import { AmexBenefitReaderPanel } from "../panel";

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
    category: { state: "observed", value: "spend" },
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
    localCardId: string;
    productName: string;
    endingDigits: string;
    benefits?: NormalizedBenefitObservationV1[];
    disposition?: "complete" | "partial";
    issueCodes?: NormalizedBenefitObservationV1["issueCodes"];
    sourceFingerprint?: string;
  },
): StoreEnvelopeV1 {
  const disposition = input.disposition ?? "complete";
  return mergeCardAttempt(store, {
    disposition,
    identity: {
      localCardId: input.localCardId,
      sourceFingerprint: input.sourceFingerprint
        ?? (input.localCardId === cardOneId ? "a".repeat(64) : "b".repeat(64)),
      productName: input.productName,
      endingDigits: input.endingDigits,
    },
    attemptedAt: now,
    observation: {
      contractVersion: "amex-benefits/1",
      issuer: "american_express_us",
      localCardId: input.localCardId,
      productName: input.productName,
      endingDigits: input.endingDigits,
      observedAt: now,
      parserVersion: "fixture/1",
      completeness: disposition,
      issueCodes: input.issueCodes ?? [],
      benefits: input.benefits ?? [],
    },
  }).store;
}

describe("Amex reader side panel", () => {
  beforeEach(() => {
    document.getElementById("perks-reminder-amex-reader")?.remove();
    jest.restoreAllMocks();
  });

  it("mounts Perks Reminder-styled local-only UI without scanning automatically", () => {
    const startScan = jest.fn(async () => undefined);
    new AmexBenefitReaderPanel(createEmptyStore(now), {
      startScan,
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().textContent).toContain("Amex benefits");
    expect(shadow().textContent).toContain("Perks Reminder local reader");
    expect(shadow().textContent).toContain("Local only — not sent to Perks Reminder");
    expect(shadow().textContent).toContain("first-party read requests");
    expect(shadow().textContent).toContain("Raw responses are not saved");
    expect(shadow().textContent).toContain("Nothing is scanned until you start");
    expect(startScan).not.toHaveBeenCalled();
    expect(button("Scan all cards")).toBeEnabled();
  });

  it("shows a persisted interruption without resuming automatically", () => {
    const startScan = jest.fn(async () => undefined);
    const interrupted = mergeScanSummary(createEmptyStore(now), {
      startedAt: now,
      finishedAt: "2026-07-15T12:01:00.000Z",
      status: "interrupted",
      discoveredCardCount: 9,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 0,
      cards: [],
      visibleContext: "unavailable",
    });
    new AmexBenefitReaderPanel(interrupted, {
      startScan,
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().textContent).toContain("Scan interrupted after 1 card was checked");
    expect(shadow().textContent).toContain("Nothing resumes automatically");
    expect(shadow().textContent).toContain("visible Amex card context could not be verified");
    expect(startScan).not.toHaveBeenCalled();
    expect(button("Scan all cards")).toBeEnabled();
  });

  it("starts only from the named button and exposes accessible live progress and cancellation", async () => {
    let release!: () => void;
    const startScan = jest.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const cancelScan = jest.fn();
    const panel = new AmexBenefitReaderPanel(createEmptyStore(now), {
      startScan,
      cancelScan,
      clearData: jest.fn(async () => undefined),
    });

    fireEvent.click(button("Scan all cards"));
    await waitFor(() => expect(startScan).toHaveBeenCalledTimes(1));
    panel.report({ type: "started" });
    panel.report({ type: "discovered", cardCount: 2, unknownEntryCount: 1 });
    expect(shadow().querySelector('[role="status"]')).toHaveAttribute("aria-live", "polite");
    expect(shadow().textContent).toContain("2 supported cards");
    fireEvent.click(button("Cancel"));
    expect(cancelScan).toHaveBeenCalledTimes(1);
    expect(shadow().textContent).toContain("Cancelling");
    release();
  });

  it("shows one physical card at a time and keeps duplicate products distinguishable", () => {
    const firstBenefit = benefit({ title: "First card benefit" });
    const secondBenefit = benefit({ benefitKey: "benefit-abcdef1234567890", title: "Second card benefit" });
    let store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Platinum",
      endingDigits: "1234",
      benefits: [firstBenefit],
    });
    store = addCard(store, {
      localCardId: cardTwoId,
      productName: "Synthetic Platinum",
      endingDigits: "56789",
      benefits: [secondBenefit],
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    const picker = shadow().querySelector('select[aria-label="Choose a card to review"]') as HTMLSelectElement;
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual([
      "Synthetic Platinum •••• 1234",
      "Synthetic Platinum •••• 56789",
    ]);
    expect(shadow().textContent).toContain("First card benefit");
    expect(shadow().textContent).not.toContain("Second card benefit");

    fireEvent.change(picker, { target: { value: cardTwoId } });
    expect(shadow().textContent).not.toContain("First card benefit");
    expect(shadow().textContent).toContain("Second card benefit");
  });

  it("keeps a 16-card, 130-observation account navigable without rendering every card at once", () => {
    let store = createEmptyStore(now);
    const benefitCounts = new Map<string, number>();
    for (let cardIndex = 1; cardIndex <= 16; cardIndex += 1) {
      const localCardId = `${String(cardIndex).padStart(8, "0")}-0000-4000-8000-${String(cardIndex).padStart(12, "0")}`;
      const count = cardIndex <= 2 ? 9 : 8;
      benefitCounts.set(localCardId, count);
      store = addCard(store, {
        localCardId,
        productName: `Synthetic Card ${cardIndex % 4}`,
        endingDigits: String(1000 + cardIndex),
        sourceFingerprint: cardIndex.toString(16).padStart(2, "0").repeat(32),
        benefits: Array.from({ length: count }, (_, benefitIndex) => benefit({
          benefitKey: `benefit-${cardIndex}-${benefitIndex}-abcdef1234567890`,
          title: `Benefit ${cardIndex}-${benefitIndex + 1}`,
        })),
      });
    }
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    const picker = shadow().querySelector('select[aria-label="Choose a card to review"]') as HTMLSelectElement;
    expect(picker.options).toHaveLength(16);
    expect(Array.from(shadow().querySelectorAll(".account-summary strong")).map((item) => item.textContent)).toEqual([
      "16",
      "130",
      "0",
    ]);
    const initiallySelectedCount = benefitCounts.get(picker.value);
    if (initiallySelectedCount == null) throw new Error("Selected synthetic card is missing from the fixture.");
    expect(shadow().querySelectorAll(".benefit-card")).toHaveLength(initiallySelectedCount);

    const lastCardId = picker.options[picker.options.length - 1].value;
    fireEvent.change(picker, { target: { value: lastCardId } });
    const lastCardCount = benefitCounts.get(lastCardId);
    if (lastCardCount == null) throw new Error("Last synthetic card is missing from the fixture.");
    expect(shadow().querySelectorAll(".benefit-card")).toHaveLength(lastCardCount);
    expect(shadow().querySelectorAll(".benefit-card").length).toBeLessThan(130);
  });

  it("uses human benefit labels, filters, counts, and compatible progress", () => {
    const needsAction = benefit({
      title: "Enrollment benefit",
      enrollmentState: { state: "observed", value: "required" },
      trackerState: { state: "not_exposed" },
      activityKind: "enrollment_candidate",
    });
    const inProgress = benefit({
      benefitKey: "benefit-progress-123456",
      title: "Progress benefit",
      trackerState: { state: "observed", value: "in_progress" },
      earnedOrUsed: { state: "observed", value: { value: "25", unit: "USD", currency: "USD" } },
      targetOrLimit: { state: "observed", value: { value: "100", unit: "USD", currency: "USD" } },
      remaining: { state: "observed", value: { value: "75", unit: "USD", currency: "USD" } },
      period: { state: "observed", value: "Jan–Jun" },
    });
    const completed = benefit({
      benefitKey: "benefit-complete-123456",
      title: "Completed benefit",
      activityKind: "completed",
      trackerState: { state: "observed", value: "completed" },
      completionState: { state: "observed", value: "complete" },
    });
    const store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      benefits: [needsAction, inProgress, completed],
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().textContent).toContain("Enrollment required");
    expect(shadow().textContent).toContain("In progress");
    expect(shadow().textContent).toContain("Completed");
    expect(shadow().textContent).toContain("$25 of $100");
    expect(shadow().textContent).toContain("$75 remaining");
    expect(shadow().querySelector('[role="progressbar"]')).toHaveAttribute("aria-valuenow", "25");

    const actionFilter = button("Needs action 1");
    expect(actionFilter.parentElement).toHaveAttribute("role", "group");
    expect(actionFilter.parentElement).toHaveAttribute("aria-label", "Filter benefits for selected card");
    fireEvent.click(actionFilter);
    expect(button("Needs action 1")).toHaveAttribute("aria-pressed", "true");
    expect(shadow().textContent).toContain("Enrollment benefit");
    expect(shadow().textContent).not.toContain("Progress benefit");
    expect(shadow().textContent).not.toContain("Completed benefit");
  });

  it("does not derive progress for incompatible quantities", () => {
    const store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      benefits: [benefit({
        trackerState: { state: "observed", value: "in_progress" },
        earnedOrUsed: { state: "observed", value: { value: "2", unit: "count", currency: null } },
        targetOrLimit: { state: "observed", value: { value: "100", unit: "USD", currency: "USD" } },
      })],
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().textContent).toContain("Current 2 count · Goal $100");
    expect(shadow().querySelector('[role="progressbar"]')).toBeNull();
  });

  it("uses explicit empty-filter and error-without-data states", () => {
    const actionOnly = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      benefits: [benefit()],
    });
    new AmexBenefitReaderPanel(actionOnly, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });
    fireEvent.click(button("Completed 0"));
    expect(shadow().textContent).toContain("No completed benefits on this card");

    document.getElementById("perks-reminder-amex-reader")?.remove();
    const failed = mergeCardAttempt(createEmptyStore(now), {
      disposition: "failed",
      identity: {
        localCardId: cardOneId,
        sourceFingerprint: "a".repeat(64),
        productName: "Synthetic Card",
        endingDigits: "1234",
      },
      attemptedAt: now,
      errorCode: "request_timeout",
    }).store;
    new AmexBenefitReaderPanel(failed, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });
    expect(shadow().textContent).toContain("Could not read");
    expect(shadow().textContent).toContain("No safe benefit observation is available for this card yet");
  });

  it("separates partial and stale data quality from benefit status", () => {
    const partial = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      disposition: "partial",
      issueCodes: ["unknown_quantity"],
      benefits: [benefit()],
    });
    new AmexBenefitReaderPanel(partial, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });
    expect(shadow().textContent).toContain("Partial data");
    expect(shadow().querySelector(".quality-pill")?.textContent).toBe("Partial data");

    document.getElementById("perks-reminder-amex-reader")?.remove();
    const identity = { localCardId: cardOneId, sourceFingerprint: "a".repeat(64), productName: "Synthetic Card", endingDigits: "1234" };
    const stale = mergeCardAttempt(partial, {
      disposition: "failed",
      identity,
      attemptedAt: "2026-07-15T13:00:00.000Z",
      errorCode: "request_timeout",
    }).store;
    new AmexBenefitReaderPanel(stale, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });
    expect(shadow().textContent).toContain("Stale data");
    expect(shadow().textContent).toContain("read request timed out");
    expect(shadow().textContent).toContain("Scan notes");
  });

  it("renders explicit account and visible-context scan notes", () => {
    const store = mergeScanSummary(createEmptyStore(now), {
      startedAt: now,
      finishedAt: "2026-07-15T12:01:00.000Z",
      status: "partial",
      discoveredCardCount: 1,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 2,
      cards: [],
      visibleContext: "changed",
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });
    expect(shadow().textContent).toContain("2 account items were not recognized and not scanned");
    expect(shadow().textContent).toContain("visible Amex card or route changed");
  });

  it("requires confirmation before clearing local observations and identity data", async () => {
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
    expect(shadow().textContent).toContain("Local data cleared");
  });
});
