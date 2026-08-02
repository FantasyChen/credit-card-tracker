import { prisma } from "@/lib/prisma";
import {
  amexSyncAuditRetentionCutoff,
  applyAmexSyncGroup,
  applyAmexSyncRow,
  deactivateAmexCardMapping,
  deleteExpiredAmexSyncRowAudits,
  loadAmexSyncDestinationContext,
  recordCurrentAmexSyncRow,
  recordNonAppliedAmexSyncRow,
} from "../repository";
import {
  amexDestinationDefinitionFingerprint,
  resolveAmexGlobalDefinitionAuthority,
  type AmexSyncPlanRow,
  type DestinationPredefinedBenefitSnapshot,
  type DestinationPredefinedCardSnapshot,
} from "../authority";

jest.mock("@/lib/prisma", () => {
  const database = {
    creditCard: { findMany: jest.fn(), findUnique: jest.fn() },
    benefitStatus: { findUnique: jest.fn(), updateMany: jest.fn() },
    benefitStatusSourceProvenance: { findUnique: jest.fn(), upsert: jest.fn() },
    amexSyncRowAudit: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    amexSyncAttempt: { findMany: jest.fn(), deleteMany: jest.fn() },
    externalCardMapping: { upsert: jest.fn(), updateMany: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  database.$transaction.mockImplementation(async (callback: (transaction: typeof database) => Promise<unknown>) => callback(database));
  return { prisma: database };
});

const db = prisma as unknown as {
  creditCard: { findMany: jest.Mock; findUnique: jest.Mock };
  benefitStatus: { findUnique: jest.Mock; updateMany: jest.Mock };
  benefitStatusSourceProvenance: { findUnique: jest.Mock; upsert: jest.Mock };
  amexSyncRowAudit: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock; deleteMany: jest.Mock };
  amexSyncAttempt: { findMany: jest.Mock; deleteMany: jest.Mock };
  externalCardMapping: { upsert: jest.Mock; updateMany: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

const globalProduct: DestinationPredefinedCardSnapshot = {
  id: "global-card-1",
  catalogKey: "card:american-express-platinum-card",
  name: "American Express Platinum Card",
  issuer: "American Express",
  productKey: "american-express-platinum-card",
  retiredAt: null,
  benefits: [],
};
const globalBenefit: DestinationPredefinedBenefitSnapshot = {
  id: "global-benefit-1",
  catalogKey: "benefit:american-express-platinum-card:resy:calendar-quarter-q3",
  predefinedCardId: globalProduct.id,
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
  statuses: [],
};
const sourceIdentity = resolveAmexGlobalDefinitionAuthority({
  product: globalProduct,
  benefit: globalBenefit,
  sourceCreditKey: "american-express-platinum-card:resy",
})!;
const definitionFingerprint = amexDestinationDefinitionFingerprint({
  product: globalProduct,
  benefit: globalBenefit,
  sourceIdentity,
});

function strictAuthorityRow(statusId: string, benefitId: string | null) {
  return {
    statusId,
    statusBenefitId: benefitId,
    statusCreditCardId: "card-1",
    statusPredefinedBenefitId: globalBenefit.id,
    statusUserId: "user-1",
    cycleStartDate: new Date("2026-07-01T00:00:00.000Z"),
    cycleEndDate: new Date("2026-09-30T23:59:59.999Z"),
    occurrenceIndex: 0,
    strictLegacyBenefitId: benefitId,
    strictUserId: benefitId ? "user-1" : null,
    strictCreditCardId: benefitId ? "card-1" : null,
    strictPredefinedCardId: benefitId ? globalProduct.id : null,
    strictPredefinedBenefitId: benefitId ? globalBenefit.id : null,
    strictClassification: benefitId ? "STANDARD" : null,
    strictPhase: benefitId ? "BRIDGED" : null,
    repairId: null,
    repairLegacyBenefitId: null,
    repairLedgerId: null,
    repairUserId: null,
    repairCreditCardId: null,
    repairPredefinedCardId: null,
    repairPredefinedBenefitId: null,
    targetCardCatalogKey: null,
    targetBenefitCatalogKey: null,
    definitionFingerprint: null,
    repairPlanFingerprint: null,
    repairPostimageFingerprint: null,
    evidenceVersion: null,
    repairPhase: null,
    repairRolledBackAt: null,
    ledgerId: null,
    ledgerLegacyBenefitId: null,
    ledgerUserId: null,
    ledgerCreditCardId: null,
    ledgerPredefinedCardId: null,
    ledgerPredefinedBenefitId: null,
    ledgerClassification: null,
    ledgerPhase: null,
    ledgerDestinationFingerprint: null,
    occurrenceRepairId: null,
    occurrenceUserId: null,
    occurrenceCreditCardId: null,
    occurrencePredefinedBenefitId: null,
    occurrenceTargetBenefitCatalogKey: null,
    occurrenceAction: null,
    occurrenceKeeperSource: null,
    occurrenceKeeperStatusId: null,
    occurrenceCycleStartDate: null,
    occurrenceCycleEndDate: null,
    occurrenceIndexEvidence: null,
    keeperBaselineVersion: null,
    removedStatusPreimageVersion: null,
    auditMetadataVersion: null,
  };
}

const row: AmexSyncPlanRow = {
  sourceRowIdentity: "a".repeat(64),
  atomicGroupIdentity: "e".repeat(64),
  sourceObservationIdentity: "b".repeat(64),
  sourceObservationDigest: "c".repeat(64),
  sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
  sourceEndingDigits: "12345",
  sourceCreditKey: "american-express-platinum-card:resy",
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
  destinationPredefinedCardId: globalProduct.id,
  destinationProductCatalogKey: globalProduct.catalogKey,
  destinationBenefitId: "legacy-benefit-1",
  destinationLegacyAuthority: { kind: "STRICT_STANDARD", legacyBenefitId: "legacy-benefit-1" },
  destinationPredefinedBenefitId: globalBenefit.id,
  destinationBenefitCatalogKey: globalBenefit.catalogKey,
  destinationDefinitionFingerprint: definitionFingerprint,
  destinationStatusId: "status-1",
  destinationOccurrenceIndex: 0,
  destinationCycleStartInstant: "2026-07-01T00:00:00.000Z",
  destinationCycleEndInstant: "2026-09-30T23:59:59.999Z",
  beforeProvenance: null,
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
      lifecycleStatus: "ACTIVE",
    });
    db.benefitStatus.findUnique.mockResolvedValue({
      benefitId: row.destinationBenefitId,
      creditCardId: row.destinationCardId,
      predefinedBenefitId: row.destinationPredefinedBenefitId,
      userId: "user-1",
      usedAmount: 50,
      isCompleted: true,
      completedAt: new Date("2026-07-10T00:00:00.000Z"),
      isNotUsable: false,
      cycleStartDate: new Date("2026-07-01T00:00:00.000Z"),
      cycleEndDate: new Date("2026-09-30T23:59:59.999Z"),
      occurrenceIndex: 0,
      creditCard: {
        id: "card-1",
        userId: "user-1",
        issuer: "American Express",
        lastFourDigits: "12345",
        lifecycleStatus: "ACTIVE",
        predefinedCardId: globalProduct.id,
        predefinedCard: { ...globalProduct, benefits: undefined },
      },
      predefinedBenefit: {
        ...globalBenefit,
        statuses: undefined,
        predefinedCard: { ...globalProduct, benefits: undefined },
      },
    });
    db.$queryRaw.mockImplementation(async (query: { strings?: readonly string[]; values?: unknown[] }) => {
      const text = query.strings?.join(' ') ?? '';
      if (text.includes('WHERE bs."id"')) {
        const statusId = String(query.values?.[0]);
        const status = await db.benefitStatus.findUnique({ where: { id: statusId } });
        return status ? [strictAuthorityRow(statusId, status.benefitId ?? null)] : [];
      }
      return [strictAuthorityRow("status-1", "legacy-benefit-1")];
    });
    db.benefitStatus.updateMany.mockResolvedValue({ count: 1 });
    db.benefitStatusSourceProvenance.findUnique.mockResolvedValue(null);
    db.benefitStatusSourceProvenance.upsert.mockResolvedValue({});
    db.amexSyncRowAudit.create.mockResolvedValue({});
    db.amexSyncRowAudit.update.mockResolvedValue({});
  });

  it("loads only physical-card global definitions and standard status relations as authority", async () => {
    db.creditCard.findMany.mockResolvedValue([{
      id: "card-1",
      userId: "user-1",
      name: "Legacy mutable name",
      nickname: "Synthetic",
      issuer: "American Express",
      lastFourDigits: "12345",
      lifecycleStatus: "ACTIVE",
      predefinedCard: {
        ...globalProduct,
        benefits: [{
          ...globalBenefit,
          benefitStatuses: [{
            id: "status-1",
            benefitId: "legacy-benefit-1",
            creditCardId: "card-1",
            predefinedBenefitId: globalBenefit.id,
            userId: "user-1",
            cycleStartDate: new Date("2026-07-01T00:00:00.000Z"),
            cycleEndDate: new Date("2026-09-30T23:59:59.999Z"),
            occurrenceIndex: 0,
            usedAmount: 50,
            isCompleted: true,
            completedAt: new Date("2026-07-10T00:00:00.000Z"),
            isNotUsable: false,
            updatedAt: new Date("2026-07-14T00:00:00.000Z"),
            sourceProvenance: [],
          }],
        }],
      },
    }]);

    const context = await loadAmexSyncDestinationContext("user-1");
    expect(db.creditCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
      select: expect.objectContaining({
        predefinedCard: expect.any(Object),
      }),
    }));
    const selectedCard = db.creditCard.findMany.mock.calls[0][0].select;
    expect(selectedCard).not.toHaveProperty("productKey");
    expect(selectedCard).not.toHaveProperty("benefits");
    expect(context.cards[0]).toMatchObject({
      id: "card-1",
      displayName: "Synthetic (Legacy mutable name)",
      predefinedCard: {
        id: globalProduct.id,
        benefits: [{
          id: globalBenefit.id,
          statuses: [{
            creditCardId: "card-1",
            predefinedBenefitId: globalBenefit.id,
          }],
        }],
      },
    });
  });

  it("atomically writes one owned compare-and-set status, provenance, and audit", async () => {
    await expect(applyAmexSyncRow({ attemptId: "attempt-1", userId: "user-1", row })).resolves.toMatchObject({
      sourceRowIdentity: row.sourceRowIdentity,
      disposition: "UPDATED",
      reasonCode: "proposed_update",
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.benefitStatus.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "status-1",
        userId: "user-1",
        benefitId: "legacy-benefit-1",
        creditCardId: "card-1",
        predefinedBenefitId: globalBenefit.id,
        cycleStartDate: new Date("2026-07-01T00:00:00.000Z"),
        cycleEndDate: new Date("2026-09-30T23:59:59.999Z"),
        occurrenceIndex: row.destinationOccurrenceIndex,
        usedAmount: 50,
        isCompleted: true,
      }),
      data: { usedAmount: 25, isCompleted: false, completedAt: null },
    }));
    expect(db.benefitStatusSourceProvenance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ source: "AMEX", attemptId: "attempt-1", sourceObservationDigest: row.sourceObservationDigest }),
    }));
    expect(db.amexSyncRowAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      disposition: "UPDATED",
      destinationBenefitId: "legacy-benefit-1",
      destinationPredefinedBenefitId: globalBenefit.id,
      destinationDefinitionFingerprint: definitionFingerprint,
      beforeUsedAmount: 50,
      afterUsedAmount: 25,
      beforeIsCompleted: true,
      afterIsCompleted: false,
    }) });
  });

  it("applies both destinations without requiring legacy benefit links in one serializable transaction", async () => {
    const standardRow: AmexSyncPlanRow = {
      ...row,
      destinationBenefitId: null,
      destinationLegacyAuthority: { kind: "STRICT_STANDARD", legacyBenefitId: null },
    };
    const bonusRow: AmexSyncPlanRow = {
      ...standardRow,
      sourceRowIdentity: "d".repeat(64),
      destinationStatusId: "status-2",
      before: { ...row.before!, usedAmount: 0, isCompleted: false, completedAt: null },
      after: { ...row.after!, usedAmount: 15 },
      changes: { amountDecrease: false, amountIncrease: true, completionSet: false, completionCleared: false },
    };
    const firstStatus = { ...await db.benefitStatus.findUnique(), benefitId: null };
    db.benefitStatus.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "status-2"
      ? {
        ...firstStatus,
        usedAmount: 0,
        isCompleted: false,
        completedAt: null,
      }
      : firstStatus);

    await expect(applyAmexSyncGroup({
      attemptId: "attempt-1",
      userId: "user-1",
      rows: [standardRow, bonusRow],
    })).resolves.toEqual([
      expect.objectContaining({ sourceRowIdentity: standardRow.sourceRowIdentity, disposition: "UPDATED" }),
      expect.objectContaining({ sourceRowIdentity: bonusRow.sourceRowIdentity, disposition: "UPDATED" }),
    ]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.benefitStatus.updateMany).toHaveBeenCalledTimes(2);
    expect(db.benefitStatus.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        id: "status-1",
        cycleStartDate: new Date("2026-07-01T00:00:00.000Z"),
        cycleEndDate: new Date("2026-09-30T23:59:59.999Z"),
      }),
    }));
    expect(db.benefitStatus.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        id: "status-2",
        cycleStartDate: new Date("2026-07-01T00:00:00.000Z"),
        cycleEndDate: new Date("2026-09-30T23:59:59.999Z"),
      }),
    }));
    expect(db.benefitStatusSourceProvenance.upsert).toHaveBeenCalledTimes(2);
    expect(db.amexSyncRowAudit.create).toHaveBeenCalledTimes(2);
  });

  it("rolls back both atomic-group destinations when either compare-and-set fails", async () => {
    const bonusRow: AmexSyncPlanRow = {
      ...row,
      sourceRowIdentity: "d".repeat(64),
      destinationStatusId: "status-2",
    };
    const firstStatus = await db.benefitStatus.findUnique();
    db.benefitStatus.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "status-2"
      ? { ...firstStatus }
      : firstStatus);
    db.benefitStatus.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(applyAmexSyncGroup({
      attemptId: "attempt-1",
      userId: "user-1",
      rows: [row, bonusRow],
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
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
      creditCard: { ...current.creditCard, lifecycleStatus: "CLOSED" },
    });
    await expect(applyAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row,
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
  });

  it("rejects transaction-time legacy authority drift before mutation", async () => {
    db.$queryRaw.mockResolvedValue([
      strictAuthorityRow('status-1', 'different-legacy-benefit'),
    ]);

    await expect(applyAmexSyncRow({
      attemptId: 'attempt-1',
      userId: 'user-1',
      row,
    })).rejects.toThrow('conflict_repreview_required');
    expect(db.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
  });

  it("rejects transaction-time global definition drift before mutation", async () => {
    const current = await db.benefitStatus.findUnique();
    db.benefitStatus.findUnique.mockResolvedValue({
      ...current,
      predefinedBenefit: {
        ...current.predefinedBenefit,
        maxAmount: 125,
      },
    });

    await expect(applyAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row,
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.findUnique).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
  });

  it("rejects a different persisted cycle end date before mutation", async () => {
    const current = await db.benefitStatus.findUnique();
    db.benefitStatus.findUnique.mockResolvedValue({
      ...current,
      cycleEndDate: new Date("2026-10-01T23:59:59.999Z"),
    });

    await expect(applyAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row,
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.findUnique).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
  });

  it("rejects a changed persisted occurrence before mutation", async () => {
    const current = await db.benefitStatus.findUnique();
    db.benefitStatus.findUnique.mockResolvedValue({
      ...current,
      occurrenceIndex: 1,
    });

    await expect(applyAmexSyncRow({
      attemptId: "attempt-1",
      userId: "user-1",
      row,
    })).rejects.toThrow("conflict_repreview_required");
    expect(db.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.findUnique).not.toHaveBeenCalled();
    expect(db.benefitStatusSourceProvenance.upsert).not.toHaveBeenCalled();
    expect(db.amexSyncRowAudit.create).not.toHaveBeenCalled();
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
    })).resolves.toMatchObject({
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

    await expect(recordNonAppliedAmexSyncRow("attempt-1", nonAppliedRow)).resolves.toMatchObject({
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
