import { parseAmexSyncEnvelope } from "@/lib/amex-benefit-reader/sync-contract";
import {
  applyAmexSyncRow,
  completeAmexSyncAttempt,
  createAmexSyncAttempt,
  findAmexSyncAttempt,
  loadAmexSyncDestinationContext,
  recordCurrentAmexSyncRow,
  recordFailedAmexSyncRow,
  recordNonAppliedAmexSyncRow,
  saveConfirmedManualMappings,
} from "../repository";
import { confirmAmexSync, previewAmexSync } from "../service";

jest.mock("../repository", () => ({
  applyAmexSyncRow: jest.fn(),
  completeAmexSyncAttempt: jest.fn(),
  createAmexSyncAttempt: jest.fn(),
  findAmexSyncAttempt: jest.fn(),
  loadAmexSyncDestinationContext: jest.fn(),
  recordCurrentAmexSyncRow: jest.fn(),
  recordFailedAmexSyncRow: jest.fn(),
  recordNonAppliedAmexSyncRow: jest.fn(),
  saveConfirmedManualMappings: jest.fn(),
}));

const now = new Date("2026-07-15T12:00:00.000Z");
const key = "synthetic-hmac-key-that-is-at-least-32-characters";
const envelope = parseAmexSyncEnvelope({
  envelopeVersion: "amex-sync-envelope/1",
  observationContractVersion: "amex-benefits/2",
  scanId: "22222222-2222-4222-8222-222222222222",
  scanFinishedAt: now.toISOString(),
  cards: [{
    sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
    productKey: "american-express-platinum-card",
    endingDigits: "1234",
    observedAt: "2026-07-15T11:59:00.000Z",
    parserVersion: "fixture/2",
    rows: [{
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
      productKey: "american-express-platinum-card",
      lastFourDigits: "1234",
      lifecycleStatus: "ACTIVE" as const,
      benefits: [{
        id: "benefit-1",
        productKey: "american-express-platinum-card",
        creditFamilyKey: "american-express-platinum-card:resy",
        periodKey: "calendar-quarter-q3",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
        statuses: [{
          id: "status-1",
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
    }],
    savedMappings: [],
  };
}

const loadContext = loadAmexSyncDestinationContext as jest.Mock;
const findAttempt = findAmexSyncAttempt as jest.Mock;
const createAttempt = createAmexSyncAttempt as jest.Mock;
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
    applyRow.mockImplementation(async ({ row }) => ({ sourceRowIdentity: row.sourceRowIdentity, disposition: "UPDATED", reasonCode: row.reason }));
    recordCurrent.mockImplementation(async ({ row }) => ({ sourceRowIdentity: row.sourceRowIdentity, disposition: "UNCHANGED", reasonCode: row.reason }));
    recordFailed.mockImplementation(async (_attemptId, row, reasonCode) => ({ sourceRowIdentity: row.sourceRowIdentity, disposition: "FAILED", reasonCode }));
    recordNonApplied.mockImplementation(async (_attemptId, row) => ({ sourceRowIdentity: row.sourceRowIdentity, disposition: "SKIPPED", reasonCode: row.reason }));
  });

  it("previews with reads only and exposes server-owned mapping labels", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, manualMappings: [], mode: "write", hmacKey: key, now });
    expect(preview.rows[0]).toMatchObject({ disposition: "proposed", before: { usedAmount: 0 }, after: { usedAmount: 25 } });
    expect(preview.mappingOptions).toEqual([{ id: "card-1", productKey: "american-express-platinum-card", label: "Synthetic Platinum ending 1234" }]);
    expect(createAttempt).not.toHaveBeenCalled();
    expect(applyRow).not.toHaveBeenCalled();
    expect(saveConfirmedManualMappings).not.toHaveBeenCalled();
    expect(completeAmexSyncAttempt).not.toHaveBeenCalled();
  });

  it("requires the signed exact preview state before creating an attempt", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, manualMappings: [], mode: "write", hmacKey: key, now });
    loadContext.mockResolvedValue(context(5));
    await expect(confirmAmexSync({
      userId: "user-1",
      envelope,
      manualMappings: [],
      proposalToken: preview.proposalToken,
      hmacKey: key,
      now: new Date("2026-07-15T12:01:00.000Z"),
    })).rejects.toThrow("conflict_repreview_required");
    expect(createAttempt).not.toHaveBeenCalled();
    expect(applyRow).not.toHaveBeenCalled();
  });

  it("applies proposed rows independently and completes aggregate attempt state", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, manualMappings: [], mode: "write", hmacKey: key, now });
    const result = await confirmAmexSync({ userId: "user-1", envelope, manualMappings: [], proposalToken: preview.proposalToken, hmacKey: key, now });
    expect(result).toMatchObject({ attemptId: "attempt-1", replayed: false, updatedCount: 1, rows: [{ disposition: "updated" }] });
    expect(applyRow).toHaveBeenCalledTimes(1);
    expect(completeAmexSyncAttempt).toHaveBeenCalledWith("attempt-1", [expect.objectContaining({ disposition: "UPDATED" })], now);
  });

  it("persists latest provenance for a newer observation whose values are already current", async () => {
    loadContext.mockResolvedValue(context(25));
    const preview = await previewAmexSync({ userId: "user-1", envelope, manualMappings: [], mode: "write", hmacKey: key, now });
    const result = await confirmAmexSync({ userId: "user-1", envelope, manualMappings: [], proposalToken: preview.proposalToken, hmacKey: key, now });
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
    const preview = await previewAmexSync({ userId: "user-1", envelope, manualMappings: [], mode: "write", hmacKey: key, now });
    applyRow.mockRejectedValue(new Error("synthetic database failure details"));
    const result = await confirmAmexSync({ userId: "user-1", envelope, manualMappings: [], proposalToken: preview.proposalToken, hmacKey: key, now });
    expect(result.rows[0]).toMatchObject({ disposition: "failed", reason: "persistence_failed" });
    expect(recordFailed).toHaveBeenCalledWith("attempt-1", expect.any(Object), "persistence_failed");
    expect(completeAmexSyncAttempt).toHaveBeenCalled();
  });

  it("isolates a failed skipped-row audit instead of aborting the attempt", async () => {
    const missingDestination = context();
    missingDestination.cards[0].lastFourDigits = "9999";
    loadContext.mockResolvedValue(missingDestination);
    recordNonApplied.mockRejectedValue(new Error("synthetic audit failure"));
    const preview = await previewAmexSync({ userId: "user-1", envelope, manualMappings: [], mode: "write", hmacKey: key, now });
    const result = await confirmAmexSync({ userId: "user-1", envelope, manualMappings: [], proposalToken: preview.proposalToken, hmacKey: key, now });
    expect(result.rows[0]).toMatchObject({ disposition: "failed", reason: "persistence_failed" });
    expect(recordFailed).toHaveBeenCalled();
    expect(completeAmexSyncAttempt).toHaveBeenCalled();
  });

  it("resumes a partial attempt and retries its failed row without creating another attempt", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, manualMappings: [], mode: "write", hmacKey: key, now });
    findAttempt.mockResolvedValue({
      id: "attempt-partial",
      state: "PARTIAL_FAILED",
      rowAudits: [{
        sourceRowIdentity: preview.rows[0].sourceRowIdentity,
        disposition: "FAILED",
        reasonCode: "persistence_failed",
      }],
    });
    const result = await confirmAmexSync({
      userId: "user-1",
      envelope,
      manualMappings: [],
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

  it("replays a completed idempotent attempt without a second write", async () => {
    const preview = await previewAmexSync({ userId: "user-1", envelope, manualMappings: [], mode: "write", hmacKey: key, now });
    const identity = preview.rows[0].sourceRowIdentity;
    findAttempt.mockResolvedValue({
      id: "attempt-existing",
      state: "COMPLETED",
      rowAudits: [{ sourceRowIdentity: identity, disposition: "UPDATED", reasonCode: "proposed_update" }],
    });
    const result = await confirmAmexSync({ userId: "user-1", envelope, manualMappings: [], proposalToken: preview.proposalToken, hmacKey: key, now });
    expect(result).toMatchObject({ attemptId: "attempt-existing", replayed: true, updatedCount: 1 });
    expect(createAttempt).not.toHaveBeenCalled();
    expect(applyRow).not.toHaveBeenCalled();
  });
});
