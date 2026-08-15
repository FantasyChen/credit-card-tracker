import { mergeCardAttempt, mergeScanSummary, createEmptyStore } from "@/lib/amex-benefit-reader/storage-policy";
import type { NormalizedBenefitObservationV3, StoreEnvelopeV1 } from "@/lib/amex-benefit-reader/contract";
import { AmexBenefitReaderPanel } from "@/userscripts/amex-benefit-reader/panel";

const observedAt = "2026-07-15T12:00:00.000Z";
const attemptedAt = "2026-07-15T12:01:00.000Z";

function benefit(input: {
  title: string;
  key: string;
  current: string;
  target: string;
  tracker: "not_started" | "in_progress";
}): NormalizedBenefitObservationV3 {
  return {
    benefitKey: input.key,
    title: input.title,
    category: { state: "observed", value: "usage" },
    activityKind: "credit_usage",
    enrollmentState: { state: "observed", value: "not_required" },
    trackerState: { state: "observed", value: input.tracker },
    completionState: { state: "observed", value: "incomplete" },
    earnedOrUsed: { state: "observed", value: { value: input.current, unit: "USD", currency: "USD" } },
    targetOrLimit: { state: "observed", value: { value: input.target, unit: "USD", currency: "USD" } },
    remaining: { state: "not_exposed" },
    period: { state: "not_exposed" },
    sourcePeriod: { state: "observed", value: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-09-30", timeZone: "UTC" } },
    confidence: "high",
    issueCodes: [],
  };
}

function card(
  store: StoreEnvelopeV1,
  localCardId: string,
  productName: string,
  endingDigits: string,
  sourceFingerprint: string,
  benefits: NormalizedBenefitObservationV3[],
): StoreEnvelopeV1 {
  return mergeCardAttempt(store, {
    disposition: "complete",
    identity: { localCardId, productName, endingDigits, sourceFingerprint },
    attemptedAt,
    observation: {
      contractVersion: "amex-benefits/3",
      issuer: "american_express_us",
      localCardId,
      productName,
      endingDigits,
      observedAt,
      parserVersion: "amex-api-us/3.0.0",
      scanId: "33333333-3333-4333-8333-333333333333",
      completeness: "complete",
      issueCodes: [],
      benefits,
    },
  }).store;
}

function syntheticStore(): StoreEnvelopeV1 {
  let store = createEmptyStore(observedAt);
  store = card(store, "11111111-1111-4111-8111-111111111111", "Synthetic Platinum Card", "1234", "a".repeat(64), [
    benefit({ title: "Synthetic Dining Credit", key: "synthetic-dining-credit-1", current: "25.00", target: "100.00", tracker: "in_progress" }),
    benefit({ title: "Synthetic Travel Credit", key: "synthetic-travel-credit-1", current: "0.00", target: "200.00", tracker: "not_started" }),
  ]);
  store = card(store, "22222222-2222-4222-8222-222222222222", "Synthetic Gold Card", "5678", "b".repeat(64), [
    benefit({ title: "Synthetic Dining Credit", key: "synthetic-dining-credit-2", current: "10.00", target: "50.00", tracker: "in_progress" }),
  ]);
  return mergeScanSummary(store, {
    scanId: "33333333-3333-4333-8333-333333333333",
    startedAt: observedAt,
    finishedAt: attemptedAt,
    status: "complete",
    discoveredCardCount: 2,
    attemptedCardCount: 2,
    unknownAccountVariantCount: 0,
    cards: [
      { localCardId: "11111111-1111-4111-8111-111111111111", result: "complete", issueCode: null },
      { localCardId: "22222222-2222-4222-8222-222222222222", result: "complete", issueCode: null },
    ],
    visibleContext: "unchanged",
  });
}

const noop = async (): Promise<void> => undefined;
new AmexBenefitReaderPanel(syntheticStore(), {
  startScan: noop,
  cancelScan: () => undefined,
  syncReviewed: noop,
  clearData: noop,
});
