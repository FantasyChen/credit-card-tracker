import { parseAmexSyncEnvelope, type AmexSyncEnvelope } from "@/lib/amex-benefit-reader/sync-contract";
import {
  periodKeyForExactRange,
  periodKeysForExactRange,
  planAmexSync,
  planReviewedAmexCompensation,
  syncIdempotencyKey,
  type AmexDestinationLegacyAuthority,
  type AmexSyncDestinationContext,
} from "../authority";

const userId = "user-1";
const cardId = "card-1";
const sourceCardId = "11111111-1111-4111-8111-111111111111";
const statusId = "status-1";
const observedAt = "2026-07-15T11:59:00.000Z";
const now = new Date("2026-07-15T12:00:00.000Z");

function source(overrides: Record<string, unknown> = {}): AmexSyncEnvelope {
  const baseRow = {
    providerTitle: "Resy Credit",
    providerCategory: "usage",
    sourceCreditKey: "american-express-platinum-card:resy",
    creditFamilyKey: "american-express-platinum-card:resy",
    sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-09-30", timeZone: "UTC" },
    enrollmentState: "enrolled",
    completionState: "incomplete",
    earnedOrUsed: { value: "25.00", unit: "USD", currency: "USD" },
    targetOrLimit: { value: "100.00", unit: "USD", currency: "USD" },
    ...overrides,
  };
  return parseAmexSyncEnvelope({
    envelopeVersion: "amex-sync-envelope/3",
    observationContractVersion: "amex-benefits/3",
    scanId: "22222222-2222-4222-8222-222222222222",
    scanFinishedAt: now.toISOString(),
    cards: [{
      sourceLocalCardId: sourceCardId,
      providerProductName: "American Express Platinum Card",
      productKey: "american-express-platinum-card",
      endingDigits: "12345",
      observedAt,
      parserVersion: "amex-api-us/3.0.0",
      rows: [baseRow],
    }],
    exclusions: [],
  });
}

function destination(options: {
  usedAmount?: number;
  completed?: boolean;
  completedAt?: Date | null;
  notUsable?: boolean;
  lastFour?: string | null;
  productKey?: string | null;
  familyKey?: string | null;
  periodKey?: string | null;
  provenance?: { observedAt: Date; sourceObservationIdentity: string; sourceObservationDigest: string } | null;
  duplicateBenefit?: boolean;
  ownerId?: string;
  issuer?: string;
  lifecycleStatus?: "ACTIVE" | "CLOSED" | "PRODUCT_CHANGED";
  legacyAuthority?: AmexDestinationLegacyAuthority;
} = {}): AmexSyncDestinationContext {
  const status = {
    id: statusId,
    benefitId: "legacy-benefit-1",
    legacyAuthority: options.legacyAuthority
      ?? { kind: "STRICT_STANDARD" as const, legacyBenefitId: "legacy-benefit-1" },
    creditCardId: cardId,
    predefinedBenefitId: "global-benefit-1",
    userId,
    cycleStartDate: new Date("2026-07-01T00:00:00.000Z"),
    cycleEndDate: new Date("2026-09-30T00:00:00.000Z"),
    occurrenceIndex: 0,
    usedAmount: options.usedAmount ?? 0,
    isCompleted: options.completed ?? false,
    completedAt: options.completedAt ?? null,
    isNotUsable: options.notUsable ?? false,
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    provenance: options.provenance ?? null,
  };
  const benefit = {
    id: "global-benefit-1",
    catalogKey: "benefit:american-express-platinum-card:resy:calendar-quarter-q3",
    predefinedCardId: "global-card-1",
    category: "Dining",
    description: "Synthetic Resy credit",
    percentage: 100,
    maxAmount: 100,
    frequency: "QUARTERLY",
    cycleAlignment: "CALENDAR_FIXED",
    fixedCycleDurationMonths: null,
    fixedCycleStartMonth: 7,
    occurrencesInCycle: 1,
    productKey: options.productKey === undefined ? "american-express-platinum-card" : options.productKey,
    creditFamilyKey: options.familyKey === undefined ? "american-express-platinum-card:resy" : options.familyKey,
    periodKey: options.periodKey === undefined ? "calendar-quarter-q3" : options.periodKey,
    retiredAt: null,
    statuses: [status],
  };
  return {
    cards: [{
      id: cardId,
      userId: options.ownerId ?? userId,
      displayName: "Synthetic Platinum ending 12345",
      issuer: options.issuer ?? "American Express",
      lastFourDigits: options.lastFour === undefined ? "12345" : options.lastFour,
      lifecycleStatus: options.lifecycleStatus ?? "ACTIVE",
      predefinedCard: {
        id: "global-card-1",
        catalogKey: "card:american-express-platinum-card",
        name: "American Express Platinum Card",
        issuer: "American Express",
        productKey: "american-express-platinum-card",
        retiredAt: null,
        benefits: options.duplicateBenefit
          ? [benefit, { ...benefit, id: "global-benefit-2", statuses: [{ ...status, predefinedBenefitId: "global-benefit-2" }] }]
          : [benefit],
      },
    }],
  };
}

function plan(envelope = source(), context = destination()) {
  return planAmexSync({ envelope, context, userId, now, transitionTime: now });
}

function decemberUberScenario(legacyAuthority?: AmexDestinationLegacyAuthority) {
  const decemberNow = new Date("2026-12-15T12:00:00.000Z");
  const decemberEnvelope = source({
    providerTitle: "Uber Cash",
    sourceCreditKey: "american-express-platinum-card:uber-cash",
    creditFamilyKey: "american-express-platinum-card:uber-cash",
    sourcePeriod: { kind: "calendar_date_range", startDate: "2026-12-01", endDate: "2026-12-31", timeZone: "UTC" },
    earnedOrUsed: { value: "30.00", unit: "USD", currency: "USD" },
    completionState: null,
  });
  decemberEnvelope.scanFinishedAt = decemberNow.toISOString();
  decemberEnvelope.cards[0].observedAt = "2026-12-15T11:59:00.000Z";
  const decemberContext = destination();
  const monthlyStatus = {
    ...decemberContext.cards[0].predefinedCard!.benefits[0].statuses[0],
    id: "status-monthly",
    cycleStartDate: new Date("2026-12-01T00:00:00.000Z"),
    cycleEndDate: new Date("2026-12-31T00:00:00.000Z"),
    ...(legacyAuthority === undefined ? {} : { legacyAuthority }),
  };
  decemberContext.cards[0].predefinedCard!.benefits = [{
    ...decemberContext.cards[0].predefinedCard!.benefits[0],
    id: "benefit-monthly",
    catalogKey: "benefit:american-express-platinum-card:uber-cash:calendar-month",
    creditFamilyKey: "american-express-platinum-card:uber-cash",
    periodKey: "calendar-month",
    statuses: [{ ...monthlyStatus, predefinedBenefitId: "benefit-monthly" }],
  }, {
    ...decemberContext.cards[0].predefinedCard!.benefits[0],
    id: "benefit-december-bonus",
    catalogKey: "benefit:american-express-platinum-card:uber-cash-december-bonus:calendar-month-december",
    creditFamilyKey: "american-express-platinum-card:uber-cash-december-bonus",
    periodKey: "calendar-month-december",
    statuses: [{ ...monthlyStatus, id: "status-december-bonus", predefinedBenefitId: "benefit-december-bonus" }],
  }];
  return { decemberNow, decemberEnvelope, decemberContext };
}

describe("Amex sync authority", () => {
  it("recognizes only exact calendar quarter ranges", () => {
    expect(periodKeyForExactRange("2026-01-01", "2026-03-31")).toBe("calendar-quarter-q1");
    expect(periodKeyForExactRange("2026-07-01", "2026-09-30")).toBe("calendar-quarter-q3");
    expect(periodKeyForExactRange("2026-07-02", "2026-09-30")).toBeNull();
    expect(periodKeyForExactRange("2026-07-01", "2026-10-01")).toBeNull();
  });

  it("recognizes every closed calendar and anniversary period shape", () => {
    expect(periodKeysForExactRange("2026-07-01", "2026-07-31")).toEqual(["calendar-month"]);
    expect(periodKeysForExactRange("2026-12-01", "2026-12-31")).toEqual(expect.arrayContaining(["calendar-month", "calendar-month-december"]));
    expect(periodKeysForExactRange("2026-04-01", "2026-06-30")).toEqual(expect.arrayContaining(["calendar-quarter", "calendar-quarter-q2", "card-anniversary-quarter"]));
    expect(periodKeysForExactRange("2026-01-01", "2026-06-30")).toContain("calendar-half-h1");
    expect(periodKeysForExactRange("2026-07-01", "2026-12-31")).toContain("calendar-half-h2");
    expect(periodKeysForExactRange("2026-01-01", "2026-12-31")).toEqual(expect.arrayContaining(["calendar-year", "card-anniversary-year"]));
    expect(periodKeysForExactRange("2026-02-15", "2026-05-14")).toContain("card-anniversary-quarter");
    expect(periodKeysForExactRange("2026-02-15", "2027-02-14")).toContain("card-anniversary-year");
  });

  it("plans an absolute amount update without adding to the existing value", () => {
    const row = plan(source({ earnedOrUsed: { value: "25.00", unit: "USD", currency: "USD" } }), destination({ usedAmount: 10 })).rows[0];
    expect(row).toMatchObject({
      disposition: "proposed",
      reason: "proposed_update",
      before: { usedAmount: 10, isCompleted: false },
      after: { usedAmount: 25, isCompleted: false },
      changes: { amountIncrease: true, amountDecrease: false },
    });
  });

  it("splits a Platinum December Uber aggregate into one atomic $15/$20 group", () => {
    const { decemberNow, decemberEnvelope, decemberContext } = decemberUberScenario();
    const split = planAmexSync({
      envelope: decemberEnvelope,
      context: decemberContext,
      userId,
      now: decemberNow,
      transitionTime: decemberNow,
    }).rows;
    expect(split).toHaveLength(2);
    expect(new Set(split.map((row) => row.atomicGroupIdentity))).toHaveProperty("size", 1);
    expect(new Set(split.map((row) => row.sourceRowIdentity))).toHaveProperty("size", 2);
    expect(split).toEqual([
      expect.objectContaining({
        creditFamilyKey: "american-express-platinum-card:uber-cash",
        disposition: "proposed",
        after: expect.objectContaining({ usedAmount: 15, isCompleted: true }),
      }),
      expect.objectContaining({
        creditFamilyKey: "american-express-platinum-card:uber-cash-december-bonus",
        disposition: "proposed",
        after: expect.objectContaining({ usedAmount: 15, isCompleted: false }),
      }),
    ]);

    decemberEnvelope.cards[0].rows[0].earnedOrUsed = { value: "35.01", unit: "USD", currency: "USD" };
    expect(planAmexSync({
      envelope: decemberEnvelope,
      context: decemberContext,
      userId,
      now: decemberNow,
      transitionTime: decemberNow,
    }).rows).toEqual([
      expect.objectContaining({ disposition: "skipped", reason: "amount_incompatible" }),
      expect.objectContaining({ disposition: "skipped", reason: "amount_incompatible" }),
    ]);
  });

  it("excludes invalid retained statuses from both Platinum December Uber destinations", () => {
    const invalidAuthority = { kind: "INVALID_RETAINED_BENEFIT" as const };
    const { decemberNow, decemberEnvelope, decemberContext } = decemberUberScenario(invalidAuthority);
    expect(decemberContext.cards[0].predefinedCard!.benefits.map(
      (benefit) => benefit.statuses[0].legacyAuthority,
    )).toEqual([invalidAuthority, invalidAuthority]);

    const split = planAmexSync({
      envelope: decemberEnvelope,
      context: decemberContext,
      userId,
      now: decemberNow,
      transitionTime: decemberNow,
    }).rows;
    expect(split).toEqual([
      expect.objectContaining({
        creditFamilyKey: "american-express-platinum-card:uber-cash",
        disposition: "skipped",
        reason: "destination_status_missing",
        destinationStatusId: null,
        destinationLegacyAuthority: null,
      }),
      expect.objectContaining({
        creditFamilyKey: "american-express-platinum-card:uber-cash-december-bonus",
        disposition: "skipped",
        reason: "destination_status_missing",
        destinationStatusId: null,
        destinationLegacyAuthority: null,
      }),
    ]);
  });

  it("preserves each omitted authoritative field while applying the other", () => {
    const amountOnly = plan(source({ completionState: null, earnedOrUsed: { value: "0", unit: "USD", currency: "USD" } }), destination({ usedAmount: 25, completed: true, completedAt: new Date("2026-07-10T00:00:00.000Z") })).rows[0];
    expect(amountOnly.after).toMatchObject({ usedAmount: 0, isCompleted: true, completedAt: "2026-07-10T00:00:00.000Z" });
    const completionOnly = plan(source({ completionState: "incomplete", earnedOrUsed: null }), destination({ usedAmount: 25, completed: true, completedAt: new Date("2026-07-10T00:00:00.000Z") })).rows[0];
    expect(completionOnly.after).toMatchObject({ usedAmount: 25, isCompleted: false, completedAt: null });
  });

  it("rejects duplicate source-credit claims without suppressing another source benefit", () => {
    const envelope = source();
    const resy = envelope.cards[0].rows[0];
    envelope.cards[0].rows = [
      resy,
      { ...resy, providerTitle: "$400 Resy Credit" },
      {
        ...resy,
        providerTitle: "lululemon Credit",
        sourceCreditKey: "american-express-platinum-card:lululemon",
        creditFamilyKey: "american-express-platinum-card:lululemon",
      },
    ];

    expect(plan(envelope).rows.map((row) => row.reason)).toEqual([
      "source_mapping_ambiguous",
      "source_mapping_ambiguous",
      "destination_benefit_missing",
    ]);
  });

  it("supports a newer refund decrease and conservative completion clearing", () => {
    const row = plan(
      source({
        completionState: "incomplete",
        earnedOrUsed: { value: "40.00", unit: "USD", currency: "USD" },
        targetOrLimit: { value: "100.00", unit: "USD", currency: "USD" },
      }),
      destination({ usedAmount: 100, completed: true, completedAt: new Date("2026-07-10T12:00:00.000Z") }),
    ).rows[0];
    expect(row.after).toMatchObject({ usedAmount: 40, isCompleted: false, completedAt: null });
    expect(row.changes).toMatchObject({ amountDecrease: true, completionCleared: true });
  });

  it("sets completion at the server-bound transition time and reports already-current rows", () => {
    const completed = plan(source({
      completionState: "complete",
      earnedOrUsed: { value: "100.00", unit: "USD", currency: "USD" },
    })).rows[0];
    expect(completed.after).toMatchObject({ usedAmount: 100, isCompleted: true, completedAt: now.toISOString() });
    expect(completed.changes.completionSet).toBe(true);

    const unchanged = plan(source({ earnedOrUsed: { value: "25.00", unit: "USD", currency: "USD" } }), destination({ usedAmount: 25 })).rows[0];
    expect(unchanged).toMatchObject({ disposition: "unchanged", reason: "already_current" });
  });

  it.each([
    [{ creditFamilyKey: "american-express-platinum-card:saks" }, "source_evidence_mismatch"],
    [{ sourcePeriod: null }, "period_not_structured"],
    [{ enrollmentState: "required" }, "enrollment_required"],
  ])("fails closed for source authority case %#", (overrides, reason) => {
    expect(plan(source(overrides)).rows[0]).toMatchObject({ disposition: "skipped", reason });
  });

  it("authorizes only the physical-card global relation and standard status links", () => {
    const authorized = plan();
    expect(authorized.rows[0]).toMatchObject({
      disposition: "proposed",
      destinationCardId: cardId,
      destinationPredefinedCardId: "global-card-1",
      destinationPredefinedBenefitId: "global-benefit-1",
      destinationBenefitId: "legacy-benefit-1",
      destinationDefinitionFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      destinationOccurrenceIndex: 0,
      destinationCycleStartInstant: "2026-07-01T00:00:00.000Z",
      destinationCycleEndInstant: "2026-09-30T00:00:00.000Z",
    });

    const userKeyOnly = destination();
    userKeyOnly.cards[0].predefinedCard = null;
    expect(plan(source(), userKeyOnly).rows[0].reason).toBe("destination_card_missing");

    const customOnly = destination();
    customOnly.cards[0].predefinedCard!.benefits[0].statuses[0].predefinedBenefitId = null;
    expect(plan(source(), customOnly).rows[0].reason).toBe("destination_status_missing");

    const invalidRetained = destination({
      legacyAuthority: { kind: "INVALID_RETAINED_BENEFIT" },
    });
    expect(plan(source(), invalidRetained).rows[0]).toMatchObject({
      disposition: "skipped",
      reason: "destination_status_missing",
    });

    const wrongGlobalKey = destination();
    wrongGlobalKey.cards[0].predefinedCard!.benefits[0].catalogKey = "benefit:american-express-platinum-card:saks:calendar-half-h1";
    expect(plan(source(), wrongGlobalKey).rows[0].reason).toBe("destination_benefit_missing");

    const wrongGlobalParent = destination();
    wrongGlobalParent.cards[0].predefinedCard!.benefits[0].predefinedCardId = "other-global-card";
    expect(plan(source(), wrongGlobalParent).rows[0].reason).toBe("destination_benefit_missing");
  });

  it("binds global definition terms and permits a retired definition only with its existing status", () => {
    const firstContext = destination();
    const first = plan(source(), firstContext);
    const firstFingerprint = first.rows[0].destinationDefinitionFingerprint;

    const reboundContext = destination();
    reboundContext.cards[0].predefinedCard!.id = "rebound-global-card";
    reboundContext.cards[0].predefinedCard!.benefits[0].predefinedCardId = "rebound-global-card";
    const rebound = plan(source(), reboundContext);
    expect(rebound.rows[0].destinationDefinitionFingerprint).toBe(firstFingerprint);
    expect(rebound.destinationAuthorityDigest).not.toBe(first.destinationAuthorityDigest);

    firstContext.cards[0].predefinedCard!.benefits[0].description = "Updated global terms";
    const changed = plan(source(), firstContext);
    expect(changed.rows[0].destinationDefinitionFingerprint).not.toBe(firstFingerprint);
    expect(changed.destinationAuthorityDigest).not.toBe(first.destinationAuthorityDigest);

    const retiredContext = destination();
    retiredContext.cards[0].predefinedCard!.benefits[0].retiredAt = new Date("2026-07-10T00:00:00.000Z");
    const retiredFingerprint = plan(source(), retiredContext).rows[0].destinationDefinitionFingerprint;
    expect(plan(source(), retiredContext).rows[0].disposition).toBe("proposed");
    retiredContext.cards[0].predefinedCard!.benefits[0].retiredAt = new Date("2026-07-11T00:00:00.000Z");
    expect(plan(source(), retiredContext).rows[0].destinationDefinitionFingerprint).not.toBe(retiredFingerprint);
    retiredContext.cards[0].predefinedCard!.benefits[0].statuses = [];
    expect(plan(source(), retiredContext).rows[0].reason).toBe("destination_status_missing");
  });

  it("requires one exact owned active card, benefit, and status without a manual bypass", () => {
    expect(plan(source(), destination({ lastFour: "9999" })).rows[0].reason).toBe("destination_last_five_required");
    expect(plan(source(), destination({ lastFour: "99999" })).rows[0].reason).toBe("destination_card_missing");
    expect(plan(source(), destination({ ownerId: "other-user" })).rows[0].reason).toBe("destination_card_missing");
    expect(plan(source(), destination({ issuer: "Other Issuer" })).rows[0].reason).toBe("destination_card_missing");
    expect(plan(source(), destination({ lifecycleStatus: "CLOSED" })).rows[0].reason).toBe("destination_card_missing");
    expect(plan(source(), destination({ productKey: "american-express-gold-card" })).rows[0].reason).toBe("destination_benefit_missing");
    expect(plan(source(), destination({ familyKey: null })).rows[0].reason).toBe("destination_benefit_missing");
    expect(plan(source(), destination({ duplicateBenefit: true })).rows[0].reason).toBe("destination_benefit_ambiguous");
    expect(plan(source(), destination({ notUsable: true })).rows[0].reason).toBe("destination_not_usable");
  });

  it("orders older, equal, conflicting, and newer source observations", () => {
    const first = plan();
    const identity = first.rows[0].sourceObservationIdentity;
    const digest = first.rows[0].sourceObservationDigest;

    expect(plan(source(), destination({ provenance: { observedAt: new Date("2026-07-15T12:00:00.000Z"), sourceObservationIdentity: "newer", sourceObservationDigest: "a".repeat(64) } })).rows[0].reason).toBe("stale_replay");
    expect(plan(source(), destination({ provenance: { observedAt: new Date(observedAt), sourceObservationIdentity: identity, sourceObservationDigest: digest } })).rows[0]).toMatchObject({ disposition: "unchanged", reason: "unchanged_replay" });
    expect(plan(source(), destination({ provenance: { observedAt: new Date(observedAt), sourceObservationIdentity: "other", sourceObservationDigest: "b".repeat(64) } })).rows[0].reason).toBe("source_conflict");
    expect(plan(source(), destination({ provenance: { observedAt: new Date("2026-07-15T11:58:00.000Z"), sourceObservationIdentity: "older", sourceObservationDigest: "c".repeat(64) } })).rows[0].disposition).toBe("proposed");
  });

  it("derives deterministic before-state and idempotency identities", () => {
    const first = plan();
    const second = plan();
    expect(first).toEqual(second);
    expect(syncIdempotencyKey(userId, first)).toBe(syncIdempotencyKey(userId, second));
    expect(syncIdempotencyKey("user-2", first)).not.toBe(syncIdempotencyKey(userId, first));
  });

  it("plans reviewed compensation only when no newer manual or Amex edit exists", () => {
    const status = destination({ usedAmount: 25 }).cards[0].predefinedCard!.benefits[0].statuses[0];
    status.updatedAt = new Date("2026-07-15T12:00:00.000Z");
    const input = {
      auditDisposition: "UPDATED" as const,
      attemptId: "attempt-1",
      auditAppliedAt: new Date("2026-07-15T12:00:01.000Z"),
      auditBefore: { usedAmount: 0, isCompleted: false, completedAt: null, isNotUsable: false },
      auditAfter: { usedAmount: 25, isCompleted: false, completedAt: null, isNotUsable: false },
      currentStatus: status,
      currentProvenance: { attemptId: "attempt-1", appliedAt: new Date("2026-07-15T12:00:00.500Z") },
    };
    expect(planReviewedAmexCompensation(input)).toMatchObject({
      disposition: "proposed",
      reason: "compensation_proposed",
      after: { usedAmount: 0 },
    });
    expect(planReviewedAmexCompensation({
      ...input,
      currentStatus: { ...status, usedAmount: 30, updatedAt: new Date("2026-07-15T12:00:02.000Z") },
    })).toMatchObject({ disposition: "refused", reason: "newer_status_edit" });
    expect(planReviewedAmexCompensation({
      ...input,
      currentProvenance: { attemptId: "attempt-newer", appliedAt: new Date("2026-07-15T12:00:00.750Z") },
    })).toMatchObject({ disposition: "refused", reason: "newer_source_provenance" });
  });
});
