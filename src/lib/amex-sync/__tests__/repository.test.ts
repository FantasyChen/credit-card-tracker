import { prisma } from "@/lib/prisma";
import {
  amexSyncAuditRetentionCutoff,
  applyAmexSyncRow,
  deactivateAmexCardMapping,
  deleteExpiredAmexSyncRowAudits,
  recordCurrentAmexSyncRow,
  recordNonAppliedAmexSyncRow,
  saveConfirmedManualMappings,
} from "../repository";
import type { AmexSyncPlanRow } from "../authority";

jest.mock("@/lib/prisma", () => {
  const database = {
    creditCard: { findUnique: jest.fn() },
    benefitStatus: { findUnique: jest.fn(), updateMany: jest.fn() },
    benefitStatusSourceProvenance: { findUnique: jest.fn(), upsert: jest.fn() },
    amexSyncRowAudit: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    amexSyncAttempt: { findMany: jest.fn(), deleteMany: jest.fn() },
    externalCardMapping: { upsert: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  database.$transaction.mockImplementation(async (callback: (transaction: typeof database) => Promise<unknown>) => callback(database));
  return { prisma: database };
});

const db = prisma as unknown as {
  creditCard: { findUnique: jest.Mock };
  benefitStatus: { findUnique: jest.Mock; updateMany: jest.Mock };
  benefitStatusSourceProvenance: { findUnique: jest.Mock; upsert: jest.Mock };
  amexSyncRowAudit: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock; deleteMany: jest.Mock };
  amexSyncAttempt: { findMany: jest.Mock; deleteMany: jest.Mock };
  externalCardMapping: { upsert: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};

const row: AmexSyncPlanRow = {
  sourceRowIdentity: "a".repeat(64),
  sourceObservationIdentity: "b".repeat(64),
  sourceObservationDigest: "c".repeat(64),
  sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
  productKey: "american-express-platinum-card",
  creditFamilyKey: "american-express-platinum-card:resy",
  observedAt: "2026-07-15T11:59:00.000Z",
  parserVersion: "amex-api-us/3.0.0",
  periodKey: "calendar-quarter-q3",
  sourcePeriodStartDate: "2026-07-01",
  sourcePeriodEndDate: "2026-09-30",
  disposition: "proposed",
  reason: "proposed_update",
  destinationCardId: "card-1",
  destinationBenefitId: "benefit-1",
  destinationStatusId: "status-1",
  before: { usedAmount: 50, isCompleted: true, completedAt: "2026-07-10T00:00:00.000Z", isNotUsable: false },
  after: { usedAmount: 25, isCompleted: false, completedAt: null, isNotUsable: false },
  changes: { amountDecrease: true, amountIncrease: false, completionSet: false, completionCleared: true },
};

describe("Amex sync persistence boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.amexSyncRowAudit.findUnique.mockResolvedValue(null);
    db.creditCard.findUnique.mockResolvedValue({
      id: "card-1",
      userId: "user-1",
      productKey: row.productKey,
      lifecycleStatus: "ACTIVE",
    });
    db.benefitStatus.findUnique.mockResolvedValue({
      userId: "user-1",
      usedAmount: 50,
      isCompleted: true,
      completedAt: new Date("2026-07-10T00:00:00.000Z"),
      isNotUsable: false,
      cycleStartDate: new Date("2026-07-01T00:00:00.000Z"),
      cycleEndDate: new Date("2026-09-30T00:00:00.000Z"),
      occurrenceIndex: 0,
      benefit: {
        id: "benefit-1",
        creditCardId: "card-1",
        productKey: row.productKey,
        creditFamilyKey: row.creditFamilyKey,
        periodKey: row.periodKey,
        creditCard: {
          id: "card-1",
          userId: "user-1",
          productKey: row.productKey,
          lifecycleStatus: "ACTIVE",
        },
      },
    });
    db.benefitStatus.updateMany.mockResolvedValue({ count: 1 });
    db.benefitStatusSourceProvenance.findUnique.mockResolvedValue(null);
    db.benefitStatusSourceProvenance.upsert.mockResolvedValue({});
    db.amexSyncRowAudit.create.mockResolvedValue({});
    db.amexSyncRowAudit.update.mockResolvedValue({});
  });

  it("atomically writes one owned compare-and-set status, provenance, and audit", async () => {
    await expect(applyAmexSyncRow({ attemptId: "attempt-1", userId: "user-1", row })).resolves.toEqual({
      sourceRowIdentity: row.sourceRowIdentity,
      disposition: "UPDATED",
      reasonCode: "proposed_update",
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.benefitStatus.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "status-1", userId: "user-1", usedAmount: 50, isCompleted: true }),
      data: { usedAmount: 25, isCompleted: false, completedAt: null },
    }));
    expect(db.benefitStatusSourceProvenance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ source: "AMEX", attemptId: "attempt-1", sourceObservationDigest: row.sourceObservationDigest }),
    }));
    expect(db.amexSyncRowAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      disposition: "UPDATED",
      beforeUsedAmount: 50,
      afterUsedAmount: 25,
      beforeIsCompleted: true,
      afterIsCompleted: false,
    }) });
  });

  it("fails a changed destination before provenance or audit creation", async () => {
    db.benefitStatus.updateMany.mockResolvedValue({ count: 0 });
    await expect(applyAmexSyncRow({ attemptId: "attempt-1", userId: "user-1", row })).rejects.toThrow("conflict_repreview_required");
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
  });

  it("revalidates card, benefit, and exact cycle authority inside the row transaction", async () => {
    const current = await db.benefitStatus.findUnique();
    db.benefitStatus.findUnique.mockResolvedValue({
      ...current,
      benefit: {
        ...current.benefit,
        creditCard: { ...current.benefit.creditCard, lifecycleStatus: "CLOSED" },
      },
    });
    await expect(applyAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row,
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["newer", "2026-07-15T12:00:00.000Z", row.sourceObservationDigest],
    ["equal conflicting", row.observedAt, "d".repeat(64)],
  ])("rejects an applied row after a %s source observation wins", async (_label, observedAt, sourceObservationDigest) => {
    db.benefitStatusSourceProvenance.findUnique.mockResolvedValue({
      observedAt: new Date(observedAt),
      sourceObservationDigest,
    });

    await expect(applyAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row,
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
  });

  it("advances provenance transactionally when a newer observation is already current", async () => {
    const currentRow: AmexSyncPlanRow = {
      ...row,
      disposition: "unchanged",
      reason: "already_current",
      after: row.before,
      changes: { amountDecrease: false, amountIncrease: false, completionSet: false, completionCleared: false },
    };
    await expect(recordCurrentAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row: currentRow,
    })).resolves.toEqual({
      sourceRowIdentity: row.sourceRowIdentity,
      disposition: "UNCHANGED",
      reasonCode: "already_current",
    });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(db.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        observedAt: new Date(row.observedAt),
        sourceObservationDigest: row.sourceObservationDigest,
      }),
    }));
    expect(db.amexSyncRowAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ disposition: "UNCHANGED", reasonCode: "already_current" }),
    });
  });

  it("does not advance current-row provenance after destination state changes", async () => {
    db.benefitStatus.findUnique.mockResolvedValue({
      userId: "user-1",
      usedAmount: 51,
      isCompleted: true,
      completedAt: new Date("2026-07-10T00:00:00.000Z"),
      isNotUsable: false,
    });
    const currentRow: AmexSyncPlanRow = {
      ...row,
      disposition: "unchanged",
      reason: "already_current",
      after: row.before,
      changes: { amountDecrease: false, amountIncrease: false, completionSet: false, completionCleared: false },
    };
    await expect(recordCurrentAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row: currentRow,
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
  });

  it("uses transaction-local provenance ordering for an already-current row", async () => {
    db.benefitStatusSourceProvenance.findUnique.mockResolvedValue({
      observedAt: new Date("2026-07-15T12:00:00.000Z"),
      sourceObservationDigest: "d".repeat(64),
    });
    const currentRow: AmexSyncPlanRow = {
      ...row,
      disposition: "unchanged",
      reason: "already_current",
      after: row.before,
      changes: { amountDecrease: false, amountIncrease: false, completionSet: false, completionCleared: false },
    };

    await expect(recordCurrentAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row: currentRow,
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
  });

  it("returns an existing row audit without applying twice", async () => {
    db.amexSyncRowAudit.findUnique.mockResolvedValue({ sourceRowIdentity: row.sourceRowIdentity, disposition: "UPDATED", reasonCode: "proposed_update" });
    await expect(applyAmexSyncRow({ attemptId: "attempt-1", userId: "user-1", row })).resolves.toMatchObject({ disposition: "UPDATED" });
    expect(db.benefitStatus.updateMany).not.toHaveBeenCalled();
  });

  it("retries a previously failed row and replaces its audit after success", async () => {
    db.amexSyncRowAudit.findUnique.mockResolvedValue({
      sourceRowIdentity: row.sourceRowIdentity,
      disposition: "FAILED",
      reasonCode: "persistence_failed",
    });
    await expect(applyAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row,
    })).resolves.toMatchObject({ disposition: "UPDATED" });
    expect(db.benefitStatus.updateMany).toHaveBeenCalledTimes(1);
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.update).toHaveBeenCalledWith({
      where: {
        attemptId_sourceRowIdentity: {
          attemptId: "attempt-1",
          sourceRowIdentity: row.sourceRowIdentity,
        },
      },
      data: expect.objectContaining({ disposition: "UPDATED", reasonCode: "proposed_update" }),
    });
  });

  it.each([
    ["skipped", "stale_replay", "SKIPPED"],
    ["unchanged", "unchanged_replay", "UNCHANGED"],
  ] as const)("promotes a failed %s audit-only row on resume", async (disposition, reason, storedDisposition) => {
    db.amexSyncRowAudit.findUnique.mockResolvedValue({
      sourceRowIdentity: row.sourceRowIdentity,
      disposition: "FAILED",
      reasonCode: "persistence_failed",
    });
    const nonAppliedRow: AmexSyncPlanRow = {
      ...row,
      disposition,
      reason,
      after: disposition === "unchanged" ? row.before : null,
      changes: { amountDecrease: false, amountIncrease: false, completionSet: false, completionCleared: false },
    };

    await expect(recordNonAppliedAmexSyncRow("attempt-1", nonAppliedRow)).resolves.toEqual({
      sourceRowIdentity: row.sourceRowIdentity,
      disposition: storedDisposition,
      reasonCode: reason,
    });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.update).toHaveBeenCalledWith({
      where: {
        attemptId_sourceRowIdentity: {
          attemptId: "attempt-1",
          sourceRowIdentity: row.sourceRowIdentity,
        },
      },
      data: expect.objectContaining({ disposition: storedDisposition, reasonCode: reason }),
    });
  });

  it("saves confirmed mappings together in one write-mode transaction", async () => {
    db.externalCardMapping.upsert.mockResolvedValue({});
    await saveConfirmedManualMappings({
      userId: "user-1",
      selections: [{ sourceLocalCardId: row.sourceLocalCardId, destinationCardId: "card-1" }],
      productKeyBySourceCard: new Map([[row.sourceLocalCardId, row.productKey]]),
      endingBySourceCard: new Map([[row.sourceLocalCardId, "1234"]]),
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.creditCard.findUnique).toHaveBeenCalledWith({
      where: { id: "card-1" },
      select: { id: true, userId: true, productKey: true, lifecycleStatus: true },
    });
    expect(db.externalCardMapping.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_source_sourceLocalCardId: {
          userId: "user-1",
          source: "AMEX",
          sourceLocalCardId: row.sourceLocalCardId,
        },
      },
      create: expect.objectContaining({
        creditCardId: "card-1",
        sourceProductKey: row.productKey,
        endingSnapshot: "1234",
      }),
    }));
  });

  it("rejects a mapping if transactional ownership or product validation changed", async () => {
    db.creditCard.findUnique.mockResolvedValue({
      id: "card-1",
      userId: "other-user",
      productKey: row.productKey,
      lifecycleStatus: "ACTIVE",
    });
    await expect(saveConfirmedManualMappings({
      userId: "user-1",
      selections: [{ sourceLocalCardId: row.sourceLocalCardId, destinationCardId: "card-1" }],
      productKeyBySourceCard: new Map([[row.sourceLocalCardId, row.productKey]]),
      endingBySourceCard: new Map([[row.sourceLocalCardId, "1234"]]),
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.externalCardMapping.upsert).not.toHaveBeenCalled();
  });

  it("deactivates only the authenticated user's exact active Amex mapping", async () => {
    const deactivatedAt = new Date("2026-07-15T12:00:00.000Z");
    db.externalCardMapping.updateMany.mockResolvedValue({ count: 1 });
    await expect(deactivateAmexCardMapping({ userId: "user-1", sourceLocalCardId: row.sourceLocalCardId, deactivatedAt })).resolves.toBe(true);
    expect(db.externalCardMapping.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", source: "AMEX", sourceLocalCardId: row.sourceLocalCardId, inactiveAt: null },
      data: { inactiveAt: deactivatedAt },
    });
  });

  it("computes and applies the exact injected 90-day audit cutoff", async () => {
    const now = new Date("2026-07-26T12:00:00.000Z");
    const cutoff = amexSyncAuditRetentionCutoff(now);
    expect(cutoff.toISOString()).toBe("2026-04-27T12:00:00.000Z");
    db.amexSyncRowAudit.findMany.mockResolvedValue([
      { id: "audit-1" },
      { id: "audit-2" },
    ]);
    db.amexSyncRowAudit.deleteMany.mockResolvedValue({ count: 2 });
    db.amexSyncAttempt.findMany.mockResolvedValue([{ id: "attempt-old-empty" }]);
    db.amexSyncAttempt.deleteMany.mockResolvedValue({ count: 1 });
    await expect(deleteExpiredAmexSyncRowAudits(cutoff)).resolves.toBe(2);
    expect(db.amexSyncRowAudit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: { lt: cutoff } },
      take: 500,
    }));
    expect(db.amexSyncRowAudit.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["audit-1", "audit-2"] } },
    });
    expect(db.amexSyncAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: { lt: cutoff }, rowAudits: { none: {} } },
      take: 500,
    }));
    expect(db.amexSyncAttempt.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["attempt-old-empty"] } },
    });
  });
});
