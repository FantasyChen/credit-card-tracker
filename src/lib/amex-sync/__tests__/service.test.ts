import {
  parseAmexSyncEnvelope,
} from "@/lib/amex-benefit-reader/sync-contract";
import {
  applyAmexSyncGroup,
  applyAmexSyncRow,
  completeAmexSyncAttempt,
  createAmexSyncAttempt,
  findAmexSyncAttempt,
  loadAmexSyncDestinationContext,
  recordCurrentAmexSyncRow,
  recordFailedAmexSyncRow,
  recordNonAppliedAmexSyncRow,
  type StoredRowResult,
} from "../repository";
import type { AmexSyncPlanRow } from "../authority";
import { confirmAmexSync, previewAmexSync } from "../service";

jest.mock("../repository", () => ({
  applyAmexSyncGroup: jest.fn(),
  applyAmexSyncRow: jest.fn(),
  completeAmexSyncAttempt: jest.fn(),
  createAmexSyncAttempt: jest.fn(),
  findAmexSyncAttempt: jest.fn(),
  loadAmexSyncDestinationContext: jest.fn(),
  recordCurrentAmexSyncRow: jest.fn(),
  recordFailedAmexSyncRow: jest.fn(),
  recordNonAppliedAmexSyncRow: jest.fn(),
}));

const now = new Date("2026-07-15T12:00:00.000Z");
const key = "synthetic-hmac-key-that-is-at-least-32-characters";
const envelope = parseAmexSyncEnvelope({
  envelopeVersion: "amex-sync-envelope/3",
  observationContractVersion: "amex-benefits/3",
  scanId: "22222222-2222-4222-8222-222222222222",
  scanFinishedAt: now.toISOString(),
  cards: [{
    sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
    providerProductName: "American Express Platinum Card",
    productKey: "american-express-platinum-card",
    endingDigits: "12345",
    observedAt: "2026-07-15T11:59:00.000Z",
    parserVersion: "amex-api-us/3.0.0",
    rows: [{
      providerTitle: "Resy Credit",
      providerCategory: "usage",
      sourceCreditKey: "american-express-platinum-card:resy",
      creditFamilyKey: "american-express-platinum-card:resy",
      sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-09-30", timeZone: "UTC" },
      enrollmentState: "enrolled",
      completionState: "incomplete",
      earnedOrUsed: { value: "25.00", unit: "USD", currency: "USD" },
      targetOrLimit: { value: "100.00", unit: "USD", currency: "USD" },
    }],
  }],
  exclusions: [],
});

function context(usedAmount = 0) {
  return {
    cards: [{
      id: "card-1",
      userId: "user-1",
      displayName: "Synthetic Platinum",
      issuer: "American Express",
      lastFourDigits: "12345",
      lifecycleStatus: "ACTIVE" as const,
      predefinedCard: {
        id: "global-card-1",
        catalogKey: "card:american-express-platinum-card",
        name: "American Express Platinum Card",
        issuer: "American Express",
        productKey: "american-express-platinum-card",
        retiredAt: null,
        benefits: [{
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
          productKey: "american-express-platinum-card",
          creditFamilyKey: "american-express-platinum-card:resy",
          periodKey: "calendar-quarter-q3",
          retiredAt: null,
          statuses: [{
          id: "status-1",
          benefitId: "legacy-benefit-1",
          creditCardId: "card-1",
          predefinedBenefitId: "global-benefit-1",
          userId: "user-1",
          cycleStartDate: new Date("2026-07-01T00:00:00.000Z"),
          cycleEndDate: new Date("2026-09-30T00:00:00.000Z"),
          occurrenceIndex: 0,
          usedAmount,
          isCompleted: false,
          completedAt: null,
          isNotUsable: false,
          updatedAt: new Date("2026-07-14T00:00:00.000Z"),
          provenance: null,
          }],
        }],
      },
    }],
  };
}

function storedRowResult(
  sourceRowIdentity: string,
  overrides: Partial<StoredRowResult> = {},
): StoredRowResult {
  return {
    sourceRowIdentity,
    disposition: "UPDATED",
    reasonCode: "proposed_update",
    destinationCardId: "card-1",
    beforeUsedAmount: 0,
    beforeIsCompleted: false,
    beforeCompletedAt: null,
    beforeIsNotUsable: false,
    afterUsedAmount: 25,
    afterIsCompleted: false,
    afterCompletedAt: null,
    afterIsNotUsable: false,
    ...overrides,
  };
}

function storedRowFromPlan(
  row: AmexSyncPlanRow,
  overrides: Partial<StoredRowResult> = {},
): StoredRowResult {
  return storedRowResult(row.sourceRowIdentity, {
    destinationCardId: row.destinationCardId,
    beforeUsedAmount: row.before?.usedAmount ?? null,
    beforeIsCompleted: row.before?.isCompleted ?? null,
    beforeCompletedAt: row.before?.completedAt ?? null,
    beforeIsNotUsable: row.before?.isNotUsable ?? null,
    afterUsedAmount: row.after?.usedAmount ?? null,
    afterIsCompleted: row.after?.isCompleted ?? null,
    afterCompletedAt: row.after?.completedAt ?? null,
    afterIsNotUsable: row.after?.isNotUsable ?? null,
    ...overrides,
  });
}

const loadContext = loadAmexSyncDestinationContext as jest.Mock;
const findAttempt = findAmexSyncAttempt as jest.Mock;
const createAttempt = createAmexSyncAttempt as jest.Mock;
const applyGroup = applyAmexSyncGroup as jest.Mock;
const applyRow = applyAmexSyncRow as jest.Mock;
const recordCurrent = recordCurrentAmexSyncRow as jest.Mock;
const recordFailed = recordFailedAmexSyncRow as jest.Mock;
const recordNonApplied = recordNonAppliedAmexSyncRow as jest.Mock;

describe("Amex sync service orchestration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadContext.mockResolvedValue(context());
    findAttempt.mockResolvedValue(null);
    createAttempt.mockResolvedValue({ id: "attempt-1" });
    applyGroup.mockImplementation(async ({ rows }) => rows.map((row: AmexSyncPlanRow) =>
      storedRowFromPlan(row, {
        disposition: row.disposition === "proposed" ? "UPDATED" : "UNCHANGED",
        reasonCode: row.reason,
      })));
    applyRow.mockImplementation(async ({ row }) => storedRowFromPlan(row, {
      disposition: "UPDATED",
      reasonCode: row.reason,
    }));
    recordCurrent.mockImplementation(async ({ row }) => storedRowFromPlan(row, {
      disposition: "UNCHANGED",
      reasonCode: row.reason,
    }));
    recordFailed.mockImplementation(async (_attemptId, row, reasonCode) => storedRowFromPlan(row, {
      disposition: "FAILED",
      reasonCode,
    }));
    recordNonApplied.mockImplementation(async (_attemptId, row) => storedRowFromPlan(row, {
      disposition: "SKIPPED",
      reasonCode: row.reason,
    }));
  });

  it("previews with reads only and no manual mapping authority", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    expect(preview.rows[0]).toMatchObject({ disposition: "proposed", before: { usedAmount: 0 }, after: { usedAmount: 25 } });
    expect(preview.cardSkips).toEqual([]);
    expect(createAttempt).not.toHaveBeenCalled();
    expect(applyRow).not.toHaveBeenCalled();
    expect(completeAmexSyncAttempt).not.toHaveBeenCalled();
  });

  it("returns one actionable skip for an owned Amex card missing five digits", async () => {
    const destinationContext = context();
    destinationContext.cards[0].lastFourDigits = "1234";
    loadContext.mockResolvedValue(destinationContext);
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    expect(preview.cardSkips).toEqual([{
      destinationCardId: "card-1",
      reason: "destination_last_five_required",
      label: "Synthetic Platinum",
      editHref: "/cards/card-1/edit#lastFourDigits",
    }]);
    expect(preview.rows[0]).toMatchObject({ disposition: "skipped", reason: "destination_last_five_required" });
  });

  it("requires the signed exact preview state before creating an attempt", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    loadContext.mockResolvedValue(context(5));
    await expect(confirmAmexSync({
      userId: "user-1",
      envelope,
      proposalToken: preview.proposalToken,
      hmacKey: key,
      now: new Date("2026-07-15T12:01:00.000Z"),
    })).rejects.toThrow("conflict_repreview_required");
    expect(createAttempt).not.toHaveBeenCalled();
    expect(applyRow).not.toHaveBeenCalled();
  });

  it("requires re-preview when authoritative global definition terms drift", async () => {
    const previewContext = context();
    loadContext.mockResolvedValue(previewContext);
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    previewContext.cards[0].predefinedCard.benefits[0].maxAmount = 125;

    await expect(confirmAmexSync({
      userId: "user-1",
      envelope,
      proposalToken: preview.proposalToken,
      hmacKey: key,
      now: new Date("2026-07-15T12:01:00.000Z"),
    })).rejects.toThrow("conflict_repreview_required");
    expect(createAttempt).not.toHaveBeenCalled();
    expect(applyRow).not.toHaveBeenCalled();
  });

  it("applies proposed rows independently and completes aggregate attempt state", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    const result = await confirmAmexSync({ userId: "user-1", envelope, proposalToken: preview.proposalToken, hmacKey: key, now });
    expect(result).toMatchObject({ attemptId: "attempt-1", replayed: false, updatedCount: 1, rows: [{ disposition: "updated" }] });
    expect(applyRow).toHaveBeenCalledTimes(1);
    expect(completeAmexSyncAttempt).toHaveBeenCalledWith("attempt-1", [expect.objectContaining({ disposition: "UPDATED" })], now);
  });

  it("orchestrates a December Uber split through one grouped persistence call", async () => {
    const decemberNow = new Date("2026-12-15T12:00:00.000Z");
    const decemberEnvelope = parseAmexSyncEnvelope({
      ...envelope,
      scanFinishedAt: decemberNow.toISOString(),
      cards: [{
        ...envelope.cards[0],
        observedAt: "2026-12-15T11:59:00.000Z",
        rows: [{
          ...envelope.cards[0].rows[0],
          providerTitle: "Uber Cash",
          sourceCreditKey: "american-express-platinum-card:uber-cash",
          creditFamilyKey: "american-express-platinum-card:uber-cash",
          sourcePeriod: { kind: "calendar_date_range", startDate: "2026-12-01", endDate: "2026-12-31", timeZone: "UTC" },
          completionState: null,
          earnedOrUsed: { value: "30.00", unit: "USD", currency: "USD" },
        }],
      }],
    });
    const destinationContext = context();
    const status = {
      ...destinationContext.cards[0].predefinedCard.benefits[0].statuses[0],
      cycleStartDate: new Date("2026-12-01T00:00:00.000Z"),
      cycleEndDate: new Date("2026-12-31T00:00:00.000Z"),
    };
    destinationContext.cards[0].predefinedCard.benefits = [{
      ...destinationContext.cards[0].predefinedCard.benefits[0],
      id: "benefit-monthly",
      catalogKey: "benefit:american-express-platinum-card:uber-cash:calendar-month",
      creditFamilyKey: "american-express-platinum-card:uber-cash",
      periodKey: "calendar-month",
      statuses: [{ ...status, id: "status-monthly", predefinedBenefitId: "benefit-monthly" }],
    }, {
      ...destinationContext.cards[0].predefinedCard.benefits[0],
      id: "benefit-december-bonus",
      catalogKey: "benefit:american-express-platinum-card:uber-cash-december-bonus:calendar-month-december",
      creditFamilyKey: "american-express-platinum-card:uber-cash-december-bonus",
      periodKey: "calendar-month-december",
      statuses: [{ ...status, id: "status-december-bonus", predefinedBenefitId: "benefit-december-bonus" }],
    }];
    loadContext.mockResolvedValue(destinationContext);

    const preview = await previewAmexSync({
      userId: "user-1",
      envelope: decemberEnvelope,
      mode: "write",
      hmacKey: key,
      now: decemberNow,
    });
    expect(preview.rows).toHaveLength(2);
    expect(new Set(preview.rows.map((row) => row.atomicGroupIdentity))).toHaveProperty("size", 1);
    const result = await confirmAmexSync({
      userId: "user-1",
      envelope: decemberEnvelope,
      proposalToken: preview.proposalToken,
      hmacKey: key,
      now: decemberNow,
    });
    expect(result).toMatchObject({ updatedCount: 2 });
    expect(applyGroup).toHaveBeenCalledTimes(1);
    expect(applyGroup).toHaveBeenCalledWith(expect.objectContaining({ rows: expect.arrayContaining([
      expect.objectContaining({ creditFamilyKey: "american-express-platinum-card:uber-cash" }),
      expect.objectContaining({ creditFamilyKey: "american-express-platinum-card:uber-cash-december-bonus" }),
    ]) }));
    expect(applyRow).not.toHaveBeenCalled();
  });

  it("persists latest provenance for a newer observation whose values are already current", async () => {
    loadContext.mockResolvedValue(context(25));
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    const result = await confirmAmexSync({ userId: "user-1", envelope, proposalToken: preview.proposalToken, hmacKey: key, now });
    expect(result.rows[0]).toMatchObject({ disposition: "unchanged", reason: "already_current" });
    expect(recordCurrent).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: "attempt-1",
      userId: "user-1",
      row: expect.objectContaining({ disposition: "unchanged", reason: "already_current" }),
    }));
    expect(recordNonApplied).not.toHaveBeenCalled();
    expect(applyRow).not.toHaveBeenCalled();
  });

  it("records a bounded failed row while preserving partial processing", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    applyRow.mockRejectedValue(new Error("synthetic database failure details"));
    const result = await confirmAmexSync({ userId: "user-1", envelope, proposalToken: preview.proposalToken, hmacKey: key, now });
    expect(result.rows[0]).toMatchObject({ disposition: "failed", reason: "persistence_failed" });
    expect(recordFailed).toHaveBeenCalledWith("attempt-1", expect.any(Object), "persistence_failed");
    expect(completeAmexSyncAttempt).toHaveBeenCalled();
  });

  it("isolates a failed skipped-row audit instead of aborting the attempt", async () => {
    const missingDestination = context();
    missingDestination.cards[0].lastFourDigits = "9999";
    loadContext.mockResolvedValue(missingDestination);
    recordNonApplied.mockRejectedValue(new Error("synthetic audit failure"));
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    const result = await confirmAmexSync({ userId: "user-1", envelope, proposalToken: preview.proposalToken, hmacKey: key, now });
    expect(result.rows[0]).toMatchObject({ disposition: "failed", reason: "persistence_failed" });
    expect(recordFailed).toHaveBeenCalled();
    expect(completeAmexSyncAttempt).toHaveBeenCalled();
  });

  it("resumes a partial attempt and retries its failed row without creating another attempt", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    findAttempt.mockResolvedValue({
      id: "attempt-partial",
      state: "PARTIAL_FAILED",
      rowAudits: [storedRowResult(preview.rows[0].sourceRowIdentity, {
        disposition: "FAILED",
        reasonCode: "persistence_failed",
      })],
    });
    const result = await confirmAmexSync({
      userId: "user-1",
      envelope,
      proposalToken: preview.proposalToken,
      hmacKey: key,
      now,
    });
    expect(result).toMatchObject({
      attemptId: "attempt-partial",
      replayed: false,
      updatedCount: 1,
      rows: [{ disposition: "updated" }],
    });
    expect(createAttempt).not.toHaveBeenCalled();
    expect(applyRow).toHaveBeenCalledTimes(1);
    expect(completeAmexSyncAttempt).toHaveBeenCalled();
  });

  it("resumes a partial attempt after a durable row changed destination state", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    const durable = storedRowResult(preview.rows[0].sourceRowIdentity);
    findAttempt.mockResolvedValue({
      id: "attempt-partial-success",
      state: "PARTIAL_FAILED",
      rowAudits: [durable],
    });
    loadContext.mockResolvedValue(context(25));
    recordCurrent.mockResolvedValue(durable);

    const result = await confirmAmexSync({
      userId: "user-1",
      envelope,
      proposalToken: preview.proposalToken,
      hmacKey: key,
      now,
    });

    expect(result).toMatchObject({
      attemptId: "attempt-partial-success",
      replayed: false,
      updatedCount: 1,
      rows: [{ disposition: "updated", before: { usedAmount: 0 }, after: { usedAmount: 25 } }],
    });
    expect(createAttempt).not.toHaveBeenCalled();
  });

  it("rejects drift on a failed row when resuming a partial attempt", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    findAttempt.mockResolvedValue({
      id: "attempt-partial-failed",
      state: "PARTIAL_FAILED",
      rowAudits: [storedRowResult(preview.rows[0].sourceRowIdentity, {
        disposition: "FAILED",
        reasonCode: "persistence_failed",
      })],
    });
    loadContext.mockResolvedValue(context(5));

    await expect(confirmAmexSync({
      userId: "user-1",
      envelope,
      proposalToken: preview.proposalToken,
      hmacKey: key,
      now,
    })).rejects.toThrow("conflict_repreview_required");
    expect(applyRow).not.toHaveBeenCalled();
    expect(recordCurrent).not.toHaveBeenCalled();
  });

  it("replays a completed idempotent attempt after its successful write changed destination state", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    const identity = preview.rows[0].sourceRowIdentity;
    // A successful first confirmation changes the state covered by the proposal's
    // authority digest. Exact replay must consult its durable attempt before
    // treating that expected post-write state as preview drift.
    loadContext.mockResolvedValue(context(25));
    findAttempt.mockResolvedValue({
      id: "attempt-existing",
      state: "COMPLETED",
      rowAudits: [storedRowResult(identity)],
    });
    const result = await confirmAmexSync({ userId: "user-1", envelope, proposalToken: preview.proposalToken, hmacKey: key, now });
    expect(result).toMatchObject({
      attemptId: "attempt-existing",
      replayed: true,
      updatedCount: 1,
      rows: [{
        disposition: "updated",
        destinationCardId: "card-1",
        before: { usedAmount: 0, isCompleted: false },
        after: { usedAmount: 25, isCompleted: false },
        changes: { amountIncrease: true },
      }],
    });
    expect(createAttempt).not.toHaveBeenCalled();
    expect(applyRow).not.toHaveBeenCalled();
  });

  it("replays the durable audited result when attempt creation loses a completion race", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, mode: "write", hmacKey: key, now });
    const identity = preview.rows[0].sourceRowIdentity;
    findAttempt
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "attempt-raced",
        state: "COMPLETED",
        rowAudits: [storedRowResult(identity)],
      });
    createAttempt.mockRejectedValue(new Error("unique constraint"));

    const result = await confirmAmexSync({
      userId: "user-1",
      envelope,
      proposalToken: preview.proposalToken,
      hmacKey: key,
      now,
    });

    expect(result).toMatchObject({
      attemptId: "attempt-raced",
      replayed: true,
      rows: [{ before: { usedAmount: 0 }, after: { usedAmount: 25 } }],
    });
    expect(applyRow).not.toHaveBeenCalled();
  });
});
