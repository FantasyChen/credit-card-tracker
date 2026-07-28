import { parseAmexSyncEnvelope, type AmexSyncEnvelope } from "@/lib/amex-benefit-reader/sync-contract";
import {
  periodKeyForExactRange,
  planAmexSync,
  planReviewedAmexCompensation,
  syncIdempotencyKey,
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
    creditFamilyKey: "american-express-platinum-card:resy",
    sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-09-30", timeZone: "UTC" },
    enrollmentState: "enrolled",
    completionState: "incomplete",
    earnedOrUsed: { value: "25.00", unit: "USD", currency: "USD" },
    targetOrLimit: { value: "100.00", unit: "USD", currency: "USD" },
    ...overrides,
  };
  return parseAmexSyncEnvelope({
    envelopeVersion: "amex-sync-envelope/2",
    observationContractVersion: "amex-benefits/3",
    scanId: "22222222-2222-4222-8222-222222222222",
    scanFinishedAt: now.toISOString(),
    cards: [{
      sourceLocalCardId: sourceCardId,
      productKey: "american-express-platinum-card",
      endingDigits: "1234",
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
} = {}): AmexSyncDestinationContext {
  const status = {
    id: statusId,
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
    id: "benefit-1",
    productKey: options.productKey === undefined ? "american-express-platinum-card" : options.productKey,
    creditFamilyKey: options.familyKey === undefined ? "american-express-platinum-card:resy" : options.familyKey,
    periodKey: options.periodKey === undefined ? "calendar-quarter-q3" : options.periodKey,
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    endDate: new Date("2026-09-30T00:00:00.000Z"),
    statuses: [status],
  };
  return {
    cards: [{
      id: cardId,
      userId,
      displayName: "Synthetic Platinum ending 1234",
      productKey: "american-express-platinum-card",
      lastFourDigits: options.lastFour === undefined ? "1234" : options.lastFour,
      lifecycleStatus: "ACTIVE",
      benefits: options.duplicateBenefit ? [benefit, { ...benefit, id: "benefit-2" }] : [benefit],
    }],
    savedMappings: [],
  };
}

function plan(envelope = source(), context = destination(), manualMappings: Array<{ sourceLocalCardId: string; destinationCardId: string }> = []) {
  return planAmexSync({ envelope, context, manualMappings, userId, now, transitionTime: now });
}

describe("Amex sync authority", () => {
  it("recognizes only exact calendar quarter ranges", () => {
    expect(periodKeyForExactRange("2026-01-01", "2026-03-31")).toBe("calendar-quarter-q1");
    expect(periodKeyForExactRange("2026-07-01", "2026-09-30")).toBe("calendar-quarter-q3");
    expect(periodKeyForExactRange("2026-07-02", "2026-09-30")).toBeNull();
    expect(periodKeyForExactRange("2026-07-01", "2026-10-01")).toBeNull();
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
    [{ creditFamilyKey: "american-express-platinum-card:saks" }, "credit_family_not_allowlisted"],
    [{ sourcePeriod: null }, "period_not_structured"],
    [{ enrollmentState: "required" }, "enrollment_required"],
    [{ completionState: "complete", earnedOrUsed: { value: "10.00", unit: "USD", currency: "USD" } }, "completion_conflict"],
  ])("fails closed for source authority case %#", (overrides, reason) => {
    expect(plan(source(overrides)).rows[0]).toMatchObject({ disposition: "skipped", reason });
  });

  it("requires one exact owned active card, benefit, and status", () => {
    expect(plan(source(), destination({ lastFour: "9999" })).rows[0].reason).toBe("manual_mapping_required");
    expect(plan(source(), destination({ lastFour: "9999" }), [{ sourceLocalCardId: sourceCardId, destinationCardId: cardId }]).rows[0].disposition).toBe("proposed");
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
    const status = destination({ usedAmount: 25 }).cards[0].benefits[0].statuses[0];
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
