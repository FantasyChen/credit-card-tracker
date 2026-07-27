import { fireEvent, waitFor } from "@testing-library/react";
import type { NormalizedBenefitObservationV1, StoreEnvelopeV1 } from "@/lib/amex-benefit-reader/contract";
import type { BenefitIdentityConflictDetailSet } from "@/lib/amex-benefit-reader/amex-response-adapter";
import { createEmptyStore, mergeCardAttempt, mergeScanSummary } from "@/lib/amex-benefit-reader/storage-policy";
import { AmexBenefitReaderPanel, deriveBenefitUsageState } from "../panel";

const now = "2026-07-15T12:00:00.000Z";
const cardOneId = "11111111-1111-4111-8111-111111111111";
const cardTwoId = "22222222-2222-4222-8222-222222222222";
const cardThreeId = "33333333-3333-4333-8333-333333333333";
const emptyConflictDetails: BenefitIdentityConflictDetailSet = { details: [], totalCount: 0, truncated: false };
const trackerConflictDetails: BenefitIdentityConflictDetailSet = {
  details: [{
    conflictKey: "tracker_state_collision:adobe:01",
    category: "tracker_state_collision",
    reviewedCreditKeys: ["american-express-business-platinum-card:adobe"],
    reviewedCreditFamilies: ["adobe"],
    candidateCount: 2,
    candidatesTruncated: false,
    candidates: ["1.00", "2.00"].map((amount, index) => ({
      candidateIndex: index + 1,
      sourceRole: "tracker" as const,
      displayTitle: index === 0
        ? "Synthetic Adobe &#67;redit<sup>&#174;</sup>"
        : "Synthetic Adobe Credit",
      supportedCreditKey: "american-express-business-platinum-card:adobe",
      supportedCreditFamily: "adobe",
      category: { state: "observed" as const, value: "spend" },
      activityKind: { state: "observed" as const, value: "spend_progress" as const },
      enrollmentState: { state: "not_exposed" as const },
      trackerState: { state: "observed" as const, value: "in_progress" as const },
      completionState: { state: "observed" as const, value: "incomplete" as const },
      earnedOrUsed: { state: "observed" as const, value: { value: amount, unit: "USD" as const, currency: "USD" as const } },
      targetOrLimit: { state: "observed" as const, value: { value: "10.00", unit: "USD" as const, currency: "USD" as const } },
      remaining: { state: "observed" as const, value: { value: index === 0 ? "9.00" : "8.00", unit: "USD" as const, currency: "USD" as const } },
      period: { state: "observed" as const, value: "Synthetic monthly period" },
      catalogLayout: { state: "not_exposed" as const },
      catalogEnrollable: { state: "not_exposed" as const },
    })),
    relations: { sameJoinId: "different", period: "same", amount: "different", state: "same" },
  }],
  totalCount: 1,
  truncated: false,
};

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
    expect(shadow().textContent).toContain("Local unless you choose Sync reviewed");
    expect(shadow().textContent).toContain("first-party read requests");
    expect(shadow().textContent).toContain("Raw responses are not saved");
    expect(shadow().textContent).toContain("Nothing is scanned until you start");
    expect(startScan).not.toHaveBeenCalled();
    expect(button("Scan all cards")).toBeEnabled();
  });

  it("uses a transient accessible launcher off primary routes without starting work", () => {
    const startScan = jest.fn(async () => undefined);
    const cancelScan = jest.fn();
    const clearData = jest.fn(async () => undefined);
    const store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      benefits: [benefit()],
    });
    new AmexBenefitReaderPanel(store, { startScan, cancelScan, clearData }, { initiallyCollapsed: true });

    const launcher = button("PR");
    expect(launcher).toHaveAccessibleName("Open Perks Reminder Amex benefit reader");
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(shadow().querySelector("#pr-reader-panel")).toBeNull();
    expect(button("Scan all cards")).toBeUndefined();
    expect(startScan).not.toHaveBeenCalled();

    fireEvent.click(launcher);
    expect(shadow().querySelector("#pr-reader-panel")).not.toBeNull();
    expect(button("Collapse")).toHaveAccessibleName("Collapse Perks Reminder Amex benefit reader");
    expect(button("Collapse")).toHaveAttribute("aria-expanded", "true");
    expect(button("Scan all cards")).toBeEnabled();
    expect(shadow().textContent).toContain("Synthetic Card •••• 1234");
    expect(startScan).not.toHaveBeenCalled();

    fireEvent.click(button("Collapse"));
    expect(button("PR")).toHaveAttribute("aria-expanded", "false");
    expect(startScan).not.toHaveBeenCalled();
    expect(cancelScan).not.toHaveBeenCalled();
    expect(clearData).not.toHaveBeenCalled();
  });

  it("keeps the complete panel expanded while scanning and cancelling", async () => {
    let release!: () => void;
    const startScan = jest.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const cancelScan = jest.fn();
    new AmexBenefitReaderPanel(createEmptyStore(now), {
      startScan,
      cancelScan,
      clearData: jest.fn(async () => undefined),
    }, { initiallyCollapsed: true });

    fireEvent.click(button("PR"));
    fireEvent.click(button("Scan all cards"));
    await waitFor(() => expect(startScan).toHaveBeenCalledTimes(1));
    expect(button("PR")).toBeUndefined();
    expect(button("Collapse")).toBeUndefined();
    expect(button("Cancel")).toBeEnabled();

    fireEvent.click(button("Cancel"));
    expect(cancelScan).toHaveBeenCalledTimes(1);
    expect(button("PR")).toBeUndefined();
    expect(shadow().textContent).toContain("Cancelling");
    release();
    await waitFor(() => expect(button("Scan all cards")).toBeEnabled());
  });

  it("lets a collapsed recovery panel reveal its local-data action without scanning", () => {
    const clearData = jest.fn(async () => undefined);
    AmexBenefitReaderPanel.mountError("Synthetic local data error.", clearData, { initiallyCollapsed: true });

    expect(button("PR")).toHaveAccessibleName("Open Perks Reminder Amex benefit reader");
    fireEvent.click(button("PR"));
    expect(shadow().textContent).toContain("Synthetic local data error");
    expect(button("Scan all cards")).toBeDisabled();
    expect(button("Clear local data")).toBeEnabled();
    expect(clearData).not.toHaveBeenCalled();
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

  it("derives the six truthful usage states with prerequisite and evidence precedence", () => {
    const quantity = (value: string, unit: "USD" | "count" | "unknown" = "USD") => ({
      value,
      unit,
      currency: unit === "USD" ? "USD" as const : null,
    });

    expect(deriveBenefitUsageState(benefit({
      enrollmentState: { state: "observed", value: "required" },
      completionState: { state: "observed", value: "complete" },
    })).label).toBe("Enrollment required");
    expect(deriveBenefitUsageState(benefit({
      enrollmentState: { state: "observed", value: "linking_required" },
      trackerState: { state: "observed", value: "completed" },
    })).label).toBe("Link required");
    expect(deriveBenefitUsageState(benefit({ completionState: { state: "observed", value: "complete" } })).label).toBe("Used");
    expect(deriveBenefitUsageState(benefit({ trackerState: { state: "observed", value: "earned" } })).label).toBe("Used");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "not_exposed" },
      earnedOrUsed: { state: "observed", value: quantity("100") },
      targetOrLimit: { state: "observed", value: quantity("100") },
    })).label).toBe("Used");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "not_exposed" },
      earnedOrUsed: { state: "observed", value: quantity("100.01") },
      targetOrLimit: { state: "observed", value: quantity("100") },
    })).label).toBe("Used");
    expect(deriveBenefitUsageState(benefit({ trackerState: { state: "observed", value: "completed" } })).label).toBe("Used");
    expect(deriveBenefitUsageState(benefit({
      completionState: { state: "observed", value: "complete" },
      trackerState: { state: "observed", value: "in_progress" },
      earnedOrUsed: { state: "observed", value: quantity("0") },
      targetOrLimit: { state: "observed", value: quantity("100") },
    })).label).toBe("Used");
    expect(deriveBenefitUsageState(benefit({ trackerState: { state: "observed", value: "in_progress" } })).label).toBe("Partially used");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "observed", value: "in_progress" },
      earnedOrUsed: { state: "observed", value: quantity("0") },
      targetOrLimit: { state: "observed", value: quantity("100") },
    })).label).toBe("Not used");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "observed", value: "in_progress" },
      earnedOrUsed: { state: "observed", value: quantity("25") },
      targetOrLimit: { state: "observed", value: quantity("100") },
    })).label).toBe("Partially used");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "observed", value: "in_progress" },
      earnedOrUsed: { state: "observed", value: quantity("0", "unknown") },
      targetOrLimit: { state: "observed", value: quantity("100", "unknown") },
    })).label).toBe("Partially used");
    expect(deriveBenefitUsageState(benefit({ trackerState: { state: "observed", value: "not_started" } })).label).toBe("Not used");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "not_exposed" },
      earnedOrUsed: { state: "observed", value: quantity("0") },
      targetOrLimit: { state: "observed", value: quantity("100") },
    })).label).toBe("Not used");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "not_exposed" },
      completionState: { state: "observed", value: "incomplete" },
    })).label).toBe("Status unavailable");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "not_exposed" },
      completionState: { state: "not_exposed" },
      earnedOrUsed: { state: "observed", value: quantity("25") },
    })).label).toBe("Status unavailable");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "not_exposed" },
      earnedOrUsed: { state: "observed", value: quantity("2", "count") },
      targetOrLimit: { state: "observed", value: quantity("100") },
    })).label).toBe("Status unavailable");
    expect(deriveBenefitUsageState(benefit({
      trackerState: { state: "not_exposed" },
      earnedOrUsed: { state: "observed", value: quantity("2", "unknown") },
      targetOrLimit: { state: "observed", value: quantity("100", "unknown") },
    })).label).toBe("Status unavailable");
  });

  it("formats reviewed Amex footnotes while keeping other provider title text inert", () => {
    const titles = [
      "Literal Credit <sup>‡</sup>",
      "Encoded Markup Credit &#x3C;sup&#x3E;&#8225;&#x3C;/sup&#x3E;",
      "Encoded Dagger Credit <sup>&#x2021;</sup>",
      "Standalone Credit ‡",
      "Literal Merchant <sup>‡</sup> Statement Credit",
      "Encoded Merchant &#x3C;sup&#x3E;&#8225;&#x3C;/sup&#x3E; Statement Credit",
      "Registered Terminal <sup>®</sup>",
      "Registered Merchant &#60;sup&#62;&#174;&#60;/sup&#62; Statement Credit",
      "Nonterminal ‡ Credit",
      "Arbitrary <sup>‡</sup> mid-title prose",
      "Arbitrary <sup>®</sup> mid-title prose",
      "Other <em>‡</em> Statement Credit",
      "Other <sup>©</sup> Statement Credit",
      "Double encoded &#38;#60;sup&#38;#62;&#38;#8225;&#38;#60;/sup&#38;#62; Statement Credit",
      "Markup-like Credit <em>visible</em>",
    ];
    const store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      benefits: titles.map((title, index) => benefit({
        benefitKey: `benefit-title-${index}-1234567890`,
        title,
      })),
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(Array.from(shadow().querySelectorAll(".benefit-card h4"), (heading) => heading.textContent)).toEqual([
      "Literal Credit",
      "Encoded Markup Credit",
      "Encoded Dagger Credit",
      "Standalone Credit",
      "Literal Merchant Statement Credit",
      "Encoded Merchant Statement Credit",
      "Registered Terminal",
      "Registered Merchant Statement Credit",
      "Nonterminal ‡ Credit",
      "Arbitrary <sup>‡</sup> mid-title prose",
      "Arbitrary <sup>®</sup> mid-title prose",
      "Other <em>‡</em> Statement Credit",
      "Other <sup>©</sup> Statement Credit",
      "Double encoded &#60;sup&#62;&#8225;&#60;/sup&#62; Statement Credit",
      "Markup-like Credit <em>visible</em>",
    ]);
    expect(shadow().querySelector(".benefit-card sup")).toBeNull();
    expect(shadow().querySelector(".benefit-card em")).toBeNull();
    expect(store.cards[cardOneId].latest?.benefits.map((item) => item.title)).toEqual(titles);
  });

  it("renders benefit-bearing cards account-wide while hiding globally empty card identities", () => {
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
    store = addCard(store, {
      localCardId: cardThreeId,
      productName: "Hidden Synthetic Card",
      endingDigits: "9999",
      disposition: "partial",
      issueCodes: ["unknown_quantity"],
      sourceFingerprint: "c".repeat(64),
      benefits: [],
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().querySelector('select[aria-label="Choose a card to review"]')).toBeNull();
    expect(Array.from(shadow().querySelectorAll(".card-group h3")).map((heading) => heading.textContent)).toEqual([
      "Synthetic Platinum •••• 1234",
      "Synthetic Platinum •••• 56789",
    ]);
    expect(shadow().textContent).toContain("First card benefit");
    expect(shadow().textContent).toContain("Second card benefit");
    expect(shadow().textContent).not.toContain("Hidden Synthetic Card");
    expect(shadow().textContent).not.toContain("9999");
    expect(shadow().textContent).toContain("1 reviewed card had no trackable benefits and is hidden.");
    expect(Array.from(shadow().querySelectorAll(".account-summary strong")).map((item) => item.textContent)).toEqual([
      "2",
      "2",
      "0",
    ]);
    expect(Array.from(shadow().querySelectorAll(".account-summary span")).map((item) => item.textContent)).toEqual([
      "Cards with benefits",
      "Eligible benefits",
      "Data notes",
    ]);
  });

  it("shows one account-level empty state when every reviewed card has no trackable benefits", () => {
    let store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Hidden Synthetic Card One",
      endingDigits: "1234",
      benefits: [],
    });
    store = addCard(store, {
      localCardId: cardTwoId,
      productName: "Hidden Synthetic Card Two",
      endingDigits: "56789",
      benefits: [],
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().querySelectorAll(".card-group")).toHaveLength(0);
    expect(shadow().querySelector(".filters")).toBeNull();
    expect(shadow().textContent).toContain("No trackable benefits are available in the reviewed card observations.");
    expect(shadow().textContent).toContain("2 reviewed cards had no trackable benefits and are hidden.");
    expect(shadow().textContent).not.toContain("Hidden Synthetic Card One");
    expect(shadow().textContent).not.toContain("Hidden Synthetic Card Two");
  });

  it("keeps a 16-card, 130-observation grouped account reachable in the bounded panel", () => {
    let store = createEmptyStore(now);
    for (let cardIndex = 1; cardIndex <= 16; cardIndex += 1) {
      const localCardId = `${String(cardIndex).padStart(8, "0")}-0000-4000-8000-${String(cardIndex).padStart(12, "0")}`;
      const count = cardIndex <= 2 ? 9 : 8;
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
    store = addCard(store, {
      localCardId: cardThreeId,
      productName: "Synthetic Empty Card",
      endingDigits: "9999",
      sourceFingerprint: "f".repeat(64),
      benefits: [],
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(Array.from(shadow().querySelectorAll(".account-summary strong")).map((item) => item.textContent)).toEqual([
      "16",
      "130",
      "0",
    ]);
    expect(shadow().querySelectorAll(".card-group")).toHaveLength(16);
    expect(shadow().querySelectorAll(".benefit-card")).toHaveLength(130);
    expect(shadow().textContent).toContain("1 reviewed card had no trackable benefits and is hidden.");
    expect(shadow().textContent).not.toContain("Synthetic Empty Card");
    expect(shadow().querySelector("style")?.textContent).toContain("max-height: calc(100vh - 32px); overflow: auto");
  });

  it("defaults to Remaining, filters globally, and preserves truthful row labels and practical fields", () => {
    const enrollment = benefit({
      title: "Enrollment benefit",
      enrollmentState: { state: "observed", value: "required" },
      trackerState: { state: "not_exposed" },
      activityKind: "enrollment_candidate",
    });
    const link = benefit({
      benefitKey: "benefit-linking-123456",
      title: "Linking benefit",
      enrollmentState: { state: "observed", value: "linking_required" },
      trackerState: { state: "not_exposed" },
      activityKind: "enrollment_candidate",
    });
    const partial = benefit({
      benefitKey: "benefit-progress-123456",
      title: "Partially used benefit",
      trackerState: { state: "observed", value: "in_progress" },
      earnedOrUsed: { state: "observed", value: { value: "25", unit: "USD", currency: "USD" } },
      targetOrLimit: { state: "observed", value: { value: "100", unit: "USD", currency: "USD" } },
      remaining: { state: "observed", value: { value: "75", unit: "USD", currency: "USD" } },
      period: { state: "observed", value: "Jan–Jun" },
    });
    const notUsed = benefit({
      benefitKey: "benefit-not-used-123456",
      title: "Not used benefit",
    });
    const unavailable = benefit({
      benefitKey: "benefit-unavailable-123456",
      title: "Unavailable benefit",
      trackerState: { state: "not_exposed" },
      completionState: { state: "not_exposed" },
    });
    const used = benefit({
      benefitKey: "benefit-complete-123456",
      title: "Used benefit",
      activityKind: "completed",
      trackerState: { state: "observed", value: "completed" },
      completionState: { state: "observed", value: "complete" },
    });
    const store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      benefits: [enrollment, link, partial, notUsed, unavailable, used],
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    const remainingFilter = button("Remaining 5");
    expect(remainingFilter.parentElement).toHaveAttribute("role", "group");
    expect(remainingFilter.parentElement).toHaveAttribute("aria-label", "Filter account benefits");
    expect(remainingFilter).toHaveAttribute("aria-pressed", "true");
    expect(shadow().textContent).toContain("Enrollment required");
    expect(shadow().textContent).toContain("Link required");
    expect(shadow().textContent).toContain("Partially used");
    expect(shadow().textContent).toContain("Not used");
    expect(shadow().textContent).toContain("Status unavailable");
    expect(shadow().textContent).toContain("$25 of $100");
    expect(shadow().textContent).toContain("Jan–Jun");
    expect(shadow().textContent).not.toContain("$75 remaining");
    expect(shadow().querySelector('[role="progressbar"]')).toBeNull();
    expect(shadow().querySelectorAll(".benefit-card details")).toHaveLength(0);
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("Parserfixture/1");
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("Benefit confidence6 high");
    expect(shadow().querySelector('h4')?.textContent).toBe("Enrollment benefit");
    expect(shadow().textContent).not.toContain("Used benefit");

    fireEvent.click(button("Used 1"));
    expect(button("Used 1")).toHaveAttribute("aria-pressed", "true");
    expect(shadow().textContent).toContain("Used benefit");
    expect(shadow().textContent).toContain("Used");
    expect(shadow().textContent).not.toContain("Enrollment benefit");
    expect(shadow().textContent).not.toContain("Linking benefit");
    expect(shadow().textContent).not.toContain("Partially used benefit");
    expect(shadow().textContent).not.toContain("Not used benefit");
    expect(shadow().textContent).not.toContain("Unavailable benefit");
  });

  it("does not present incompatible quantities inline or derive a usage state from them", () => {
    const store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      benefits: [benefit({
        trackerState: { state: "not_exposed" },
        completionState: { state: "not_exposed" },
        earnedOrUsed: { state: "observed", value: { value: "2", unit: "count", currency: null } },
        targetOrLimit: { state: "observed", value: { value: "100", unit: "USD", currency: "USD" } },
      })],
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().textContent).toContain("Status unavailable");
    expect(shadow().querySelector(".benefit-essentials")).toBeNull();
    expect(shadow().querySelector(".benefit-card details")).toBeNull();
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("Benefit confidence1 high");
  });

  it("keeps matching unknown quantity units out of status and inline amount derivation", () => {
    const store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      benefits: [
        benefit({
          trackerState: { state: "not_exposed" },
          completionState: { state: "not_exposed" },
          earnedOrUsed: { state: "observed", value: { value: "2", unit: "unknown", currency: null } },
          targetOrLimit: { state: "observed", value: { value: "100", unit: "unknown", currency: null } },
        }),
        benefit({
          benefitKey: "benefit-unknown-current-123456",
          title: "Unknown current quantity",
          trackerState: { state: "not_exposed" },
          completionState: { state: "not_exposed" },
          earnedOrUsed: { state: "observed", value: { value: "3", unit: "unknown", currency: null } },
        }),
      ],
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().querySelectorAll(".status-pill")).toHaveLength(2);
    expect(Array.from(shadow().querySelectorAll(".status-pill")).every((item) => item.textContent === "Status unavailable")).toBe(true);
    expect(shadow().querySelector(".benefit-essentials")).toBeNull();
    expect(shadow().querySelectorAll(".benefit-card details")).toHaveLength(0);
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("Benefit confidence2 high");
  });

  it("keeps filter-empty benefit-bearing cards as compact accessible groups", () => {
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
    fireEvent.click(button("Used 0"));

    const group = shadow().querySelector(".card-group");
    expect(group).toHaveClass("card-group-compact");
    expect(group).toHaveAccessibleName("Synthetic Card •••• 1234 0 used benefits");
    expect(group?.querySelector("h3")).toHaveTextContent("Synthetic Card •••• 1234");
    expect(group?.querySelector(".card-summary")).toHaveTextContent("0 used benefits");
    expect(group?.querySelector(".benefit-list")).toBeNull();
    expect(group?.querySelector(".empty-state")).toBeNull();
    expect(group?.querySelector(".data-quality")).toHaveTextContent("Data quality and timestamps");
    expect(shadow().textContent).not.toContain("No used benefits for this card");
  });

  it("keeps an explicit error state when no safe observation exists", () => {
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

  it("shows card-level partial and stale quality once without relabeling benefit rows", () => {
    const partial = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      disposition: "partial",
      issueCodes: ["unknown_quantity"],
      benefits: [
        benefit(),
        benefit({ benefitKey: "benefit-second-1234567890", title: "Second synthetic benefit" }),
      ],
    });
    new AmexBenefitReaderPanel(partial, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });
    expect(shadow().textContent).toContain("Not used");
    expect(shadow().querySelectorAll(".quality-pill")).toHaveLength(1);
    expect(shadow().querySelector(".quality-pill")).toHaveTextContent("Partial data");
    expect(shadow().querySelector(".quality-pill")).toHaveAccessibleName("Data quality: Partial data");
    expect(shadow().querySelector("h3")).toHaveAccessibleDescription("Partial data");
    expect(shadow().querySelectorAll(".row-quality")).toHaveLength(0);
    expect(Array.from(shadow().querySelectorAll(".benefit-card"), (item) => item.textContent)).toEqual([
      expect.not.stringContaining("Partial data"),
      expect.not.stringContaining("Partial data"),
    ]);
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("A benefit amount or unit was not recognized.");

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
    expect(shadow().querySelectorAll(".quality-pill")).toHaveLength(1);
    expect(shadow().querySelector(".quality-pill")).toHaveTextContent("Stale data");
    expect(shadow().querySelector(".quality-pill")).toHaveAccessibleName("Data quality: Stale data");
    expect(shadow().querySelector("h3")).toHaveAccessibleDescription("Stale data");
    expect(shadow().querySelectorAll(".row-quality")).toHaveLength(0);
    expect(shadow().textContent).toContain("read request timed out");
    fireEvent.click(button("Used 0"));
    const compactStaleGroup = shadow().querySelector(".card-group-compact");
    expect(compactStaleGroup).not.toBeNull();
    expect(compactStaleGroup?.querySelector(".data-quality")).toHaveTextContent("read request timed out");
    expect(shadow().textContent).toContain("Scan notes");
  });

  it("shows fixed per-card conflict diagnostics only for the active panel scan", async () => {
    let store = addCard(createEmptyStore(now), {
      localCardId: cardOneId,
      productName: "Synthetic Card",
      endingDigits: "1234",
      disposition: "partial",
      issueCodes: ["benefit_identity_conflict"],
      benefits: [benefit()],
    });
    store = addCard(store, {
      localCardId: cardTwoId,
      productName: "Synthetic Card",
      endingDigits: "56789",
      benefits: [benefit({ benefitKey: "benefit-second-card-123456" })],
    });
    const panel = new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });

    expect(shadow().textContent).not.toContain("Tracker state collision");
    panel.report({
      type: "card_committed",
      record: store.cards[cardOneId],
      conflictDiagnostics: [
        "tracker_catalog_candidate_collision",
        "tracker_state_collision",
        "ambiguous_catalog_join",
        "tracker_catalog_key_mismatch",
        "tracker_state_collision",
      ],
      conflictDetails: trackerConflictDetails,
    });
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("Benefit matching notes from this scan");
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("Conflicting tracker states");
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("Tracker and benefit details matched different credits");
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("Benefit details could not be joined safely");
    expect(shadow().querySelector(".data-quality")?.textContent).toContain("Tracker and enrollment details conflicted");
    expect(Array.from(shadow().querySelectorAll(".conflict-diagnostics li"), (item) => item.textContent)).toEqual([
      "Conflicting tracker states",
      "Tracker and benefit details matched different credits",
      "Benefit details could not be joined safely",
      "Tracker and enrollment details conflicted",
    ]);
    expect(shadow().querySelectorAll(".conflict-diagnostics li")).toHaveLength(4);
    const detailSection = shadow().querySelector<HTMLElement>('[data-amex-conflict-details="true"]');
    expect(detailSection).not.toBeNull();
    expect(detailSection).toHaveAttribute("data-conflict-count", "1");
    const conflict = detailSection?.querySelector<HTMLElement>('[data-amex-conflict="true"]');
    expect(conflict).toHaveAttribute("data-conflict-key", "tracker_state_collision:adobe:01");
    expect(conflict).toHaveAttribute("data-conflict-category", "tracker_state_collision");
    expect(conflict?.querySelectorAll('[data-amex-conflict-candidate="true"]')).toHaveLength(2);
    expect(Array.from(
      conflict?.querySelectorAll('[data-amex-conflict-field="display-title"]') ?? [],
      (field) => field.textContent,
    )).toEqual(["Synthetic Adobe Credit", "Synthetic Adobe Credit"]);
    expect(Array.from(
      conflict?.querySelectorAll<HTMLElement>('[data-amex-conflict-field="supported-credit-family"]') ?? [],
      (field) => ({ state: field.dataset.fieldState, value: field.dataset.fieldValue }),
    )).toEqual([
      { state: "observed", value: "adobe" },
      { state: "observed", value: "adobe" },
    ]);
    expect(trackerConflictDetails.details[0].candidates[0].displayTitle).toBe(
      "Synthetic Adobe &#67;redit<sup>&#174;</sup>",
    );
    expect(Array.from(conflict?.querySelectorAll('[data-amex-conflict-field="earned-or-used"]') ?? [], (field) => ({
      state: (field as HTMLElement).dataset.fieldState,
      value: (field as HTMLElement).dataset.quantityValue,
      unit: (field as HTMLElement).dataset.quantityUnit,
      currency: (field as HTMLElement).dataset.quantityCurrency,
    }))).toEqual([
      { state: "observed", value: "1.00", unit: "USD", currency: "USD" },
      { state: "observed", value: "2.00", unit: "USD", currency: "USD" },
    ]);
    expect(conflict?.querySelector('[data-amex-conflict-relation="amount"]')).toHaveAttribute("data-relation-value", "different");
    expect(detailSection?.innerHTML).not.toMatch(/sorBenefitId|sourceId|rawResponse|accountToken/i);
    const cardGroups = Array.from(shadow().querySelectorAll(".card-group"));
    const firstCardGroup = cardGroups.find((group) => group.querySelector("h3")?.textContent?.includes("1234"));
    const secondCardGroup = cardGroups.find((group) => group.querySelector("h3")?.textContent?.includes("56789"));
    expect(firstCardGroup?.querySelectorAll(".conflict-diagnostics li")).toHaveLength(4);
    expect(secondCardGroup?.querySelectorAll(".conflict-diagnostics li")).toHaveLength(0);

    fireEvent.click(button("Used 0"));
    expect(shadow().querySelectorAll(".conflict-diagnostics li")).toHaveLength(4);
    expect(JSON.stringify(store)).not.toMatch(/tracker_state_collision|conflictDiagnostics/);

    panel.report({
      type: "card_committed",
      record: store.cards[cardOneId],
      conflictDiagnostics: [],
      conflictDetails: emptyConflictDetails,
    });
    expect(shadow().querySelectorAll(".conflict-diagnostics li")).toHaveLength(0);
    panel.report({
      type: "card_committed",
      record: store.cards[cardOneId],
      conflictDiagnostics: ["tracker_state_collision"],
      conflictDetails: trackerConflictDetails,
    });
    expect(shadow().querySelectorAll(".conflict-diagnostics li")).toHaveLength(1);

    const staleAfterFailedRescan = mergeCardAttempt(store, {
      disposition: "failed",
      identity: { localCardId: cardOneId, ...store.cards[cardOneId].identity },
      attemptedAt: "2026-07-15T13:00:00.000Z",
      errorCode: "network_error",
    }).record;
    panel.report({
      type: "card_committed",
      record: staleAfterFailedRescan,
      conflictDiagnostics: [],
      conflictDetails: emptyConflictDetails,
    });
    expect(shadow().querySelectorAll(".conflict-diagnostics li")).toHaveLength(0);
    panel.report({
      type: "card_committed",
      record: store.cards[cardOneId],
      conflictDiagnostics: ["tracker_state_collision"],
      conflictDetails: trackerConflictDetails,
    });
    expect(shadow().querySelectorAll(".conflict-diagnostics li")).toHaveLength(1);

    fireEvent.click(button("Scan all cards"));
    expect(shadow().textContent).not.toContain("Benefit matching notes from this scan");
    expect(shadow().textContent).not.toContain("Conflicting tracker states");

    document.getElementById("perks-reminder-amex-reader")?.remove();
    const restoredPanel = new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => {
        throw new Error("synthetic clear failure");
      }),
    });
    expect(shadow().textContent).not.toContain("Benefit matching notes from this scan");
    expect(shadow().textContent).not.toContain("Conflicting tracker states");
    restoredPanel.report({
      type: "card_committed",
      record: store.cards[cardOneId],
      conflictDiagnostics: ["tracker_state_collision"],
      conflictDetails: trackerConflictDetails,
    });
    expect(shadow().querySelectorAll('[data-amex-conflict="true"]')).toHaveLength(1);
    jest.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(button("Clear local data"));
    await waitFor(() => expect(shadow().querySelectorAll('[data-amex-conflict="true"]')).toHaveLength(0));
    expect(shadow().textContent).toContain("Local data could not be cleared");
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

  it("renders one global reviewed Sync action only after a scan and invokes it explicitly", async () => {
    const store = mergeScanSummary(createEmptyStore(now), {
      scanId: "99999999-9999-4999-8999-999999999999",
      startedAt: now,
      finishedAt: "2026-07-15T12:01:00.000Z",
      status: "complete",
      discoveredCardCount: 0,
      attemptedCardCount: 0,
      unknownAccountVariantCount: 0,
      cards: [],
      visibleContext: "unchanged",
    });
    let finishSync!: () => void;
    const syncReviewed = jest.fn(() => new Promise<void>((resolve) => { finishSync = resolve; }));
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      syncReviewed,
      clearData: jest.fn(async () => undefined),
    });
    expect(shadow().querySelectorAll('[data-amex-sync-action="true"]')).toHaveLength(1);
    expect(syncReviewed).not.toHaveBeenCalled();
    fireEvent.click(button("Sync reviewed"));
    expect(button("Sync reviewed")).toBeDisabled();
    fireEvent.click(button("Sync reviewed"));
    expect(syncReviewed).toHaveBeenCalledTimes(1);
    finishSync();
    await waitFor(() => expect(shadow().textContent).toContain("Confirm separately there"));
    expect(button("Sync reviewed")).toBeEnabled();
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
