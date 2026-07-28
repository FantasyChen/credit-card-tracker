import { prisma } from "@/lib/prisma";
import type {
  AmexSyncDestinationContext,
  AmexSyncPlanRow,
  ManualCardSelection,
  StatusStateProjection,
} from "./authority";

interface SyncDelegate {
  findMany(args: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  upsert(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<{ count: number }>;
}

interface SyncPrismaClient {
  creditCard: SyncDelegate;
  externalCardMapping: SyncDelegate;
  amexSyncAttempt: SyncDelegate;
  amexSyncRowAudit: SyncDelegate;
  benefitStatus: SyncDelegate;
  benefitStatusSourceProvenance: SyncDelegate;
  $transaction<T>(
    callback: (transaction: SyncPrismaClient) => Promise<T>,
    options?: { isolationLevel: "Serializable" },
  ): Promise<T>;
}

function client(): SyncPrismaClient {
  return prisma as unknown as SyncPrismaClient;
}

interface RawDestinationStatus {
  id: string;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  usedAmount: number;
  isCompleted: boolean;
  completedAt: Date | null;
  isNotUsable: boolean;
  updatedAt: Date;
  sourceProvenance: Array<{
    observedAt: Date;
    sourceObservationIdentity: string;
    sourceObservationDigest: string;
  }>;
}

interface RawDestinationBenefit {
  id: string;
  productKey: string | null;
  creditFamilyKey: string | null;
  periodKey: string | null;
  startDate: Date;
  endDate: Date | null;
  benefitStatuses: RawDestinationStatus[];
}

interface RawDestinationCard {
  id: string;
  userId: string;
  name: string;
  nickname: string | null;
  productKey: string | null;
  lastFourDigits: string | null;
  lifecycleStatus: "ACTIVE" | "CLOSED" | "PRODUCT_CHANGED";
  benefits: RawDestinationBenefit[];
}

interface RawMapping {
  sourceLocalCardId: string;
  sourceProductKey: string;
  creditCardId: string;
  inactiveAt: Date | null;
}

export async function loadAmexSyncDestinationContext(userId: string): Promise<AmexSyncDestinationContext> {
  const db = client();
  const [rawCards, rawMappings] = await Promise.all([
    db.creditCard.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        name: true,
        nickname: true,
        productKey: true,
        lastFourDigits: true,
        lifecycleStatus: true,
        benefits: {
          select: {
            id: true,
            productKey: true,
            creditFamilyKey: true,
            periodKey: true,
            startDate: true,
            endDate: true,
            benefitStatuses: {
              where: { userId },
              select: {
                id: true,
                userId: true,
                cycleStartDate: true,
                cycleEndDate: true,
                occurrenceIndex: true,
                usedAmount: true,
                isCompleted: true,
                completedAt: true,
                isNotUsable: true,
                updatedAt: true,
                sourceProvenance: {
                  where: { source: "AMEX" },
                  take: 1,
                  select: {
                    observedAt: true,
                    sourceObservationIdentity: true,
                    sourceObservationDigest: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.externalCardMapping.findMany({
      where: { userId, source: "AMEX" },
      select: {
        sourceLocalCardId: true,
        sourceProductKey: true,
        creditCardId: true,
        inactiveAt: true,
      },
    }),
  ]);
  const cards = rawCards as unknown as RawDestinationCard[];
  const mappings = rawMappings as unknown as RawMapping[];
  return {
    cards: cards.map((card) => ({
      ...card,
      displayName: card.nickname ? `${card.nickname} (${card.name})` : card.name,
      benefits: card.benefits.map((benefit) => ({
        ...benefit,
        statuses: benefit.benefitStatuses.map((status) => ({
          ...status,
          provenance: status.sourceProvenance[0] ?? null,
        })),
      })),
    })),
    savedMappings: mappings,
  };
}

export interface StoredAttemptResult {
  id: string;
  state: "PROCESSING" | "COMPLETED" | "PARTIAL_FAILED";
  rowAudits: StoredRowResult[];
}

export interface StoredRowResult {
  sourceRowIdentity: string;
  disposition: "UPDATED" | "UNCHANGED" | "SKIPPED" | "FAILED";
  reasonCode: string;
}

export async function findAmexSyncAttempt(userId: string, idempotencyKey: string): Promise<StoredAttemptResult | null> {
  return client().amexSyncAttempt.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    select: {
      id: true,
      state: true,
      rowAudits: { select: { sourceRowIdentity: true, disposition: true, reasonCode: true } },
    },
  }) as Promise<StoredAttemptResult | null>;
}

export async function createAmexSyncAttempt(input: {
  userId: string;
  idempotencyKey: string;
  envelopeDigest: string;
  confirmedAt: Date;
  expiresAt: Date;
}): Promise<{ id: string }> {
  return client().amexSyncAttempt.create({
    data: {
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      envelopeDigest: input.envelopeDigest,
      mode: "WRITE",
      state: "PROCESSING",
      confirmedAt: input.confirmedAt,
      expiresAt: input.expiresAt,
    },
    select: { id: true },
  }) as Promise<{ id: string }>;
}

export async function saveConfirmedManualMappings(input: {
  userId: string;
  selections: ManualCardSelection[];
  productKeyBySourceCard: ReadonlyMap<string, string>;
  endingBySourceCard: ReadonlyMap<string, string>;
}): Promise<void> {
  if (!input.selections.length) return;
  await client().$transaction(async (transaction) => {
    for (const selection of input.selections) {
      const sourceProductKey = input.productKeyBySourceCard.get(selection.sourceLocalCardId);
      if (!sourceProductKey) continue;
      const destinationCard = await transaction.creditCard.findUnique({
        where: { id: selection.destinationCardId },
        select: {
          id: true,
          userId: true,
          productKey: true,
          lifecycleStatus: true,
        },
      }) as {
        id: string;
        userId: string;
        productKey: string | null;
        lifecycleStatus: "ACTIVE" | "CLOSED" | "PRODUCT_CHANGED";
      } | null;
      if (!destinationCard
        || destinationCard.userId !== input.userId
        || destinationCard.lifecycleStatus !== "ACTIVE"
        || destinationCard.productKey !== sourceProductKey) {
        throw new Error("conflict_repreview_required");
      }
      await transaction.externalCardMapping.upsert({
        where: {
          userId_source_sourceLocalCardId: {
            userId: input.userId,
            source: "AMEX",
            sourceLocalCardId: selection.sourceLocalCardId,
          },
        },
        create: {
          userId: input.userId,
          source: "AMEX",
          sourceLocalCardId: selection.sourceLocalCardId,
          creditCardId: selection.destinationCardId,
          sourceProductKey,
          endingSnapshot: input.endingBySourceCard.get(selection.sourceLocalCardId) ?? null,
          kind: "MANUAL_CONFIRMED",
        },
        update: {
          creditCardId: selection.destinationCardId,
          sourceProductKey,
          endingSnapshot: input.endingBySourceCard.get(selection.sourceLocalCardId) ?? null,
          kind: "MANUAL_CONFIRMED",
          inactiveAt: null,
        },
      });
    }
  }, { isolationLevel: "Serializable" });
}

export async function deactivateAmexCardMapping(input: {
  userId: string;
  sourceLocalCardId: string;
  deactivatedAt?: Date;
}): Promise<boolean> {
  const result = await client().externalCardMapping.updateMany({
    where: {
      userId: input.userId,
      source: "AMEX",
      sourceLocalCardId: input.sourceLocalCardId,
      inactiveAt: null,
    },
    data: { inactiveAt: input.deactivatedAt ?? new Date() },
  });
  return result.count === 1;
}

function auditSnapshot(prefix: "before" | "after", state: StatusStateProjection | null): Record<string, unknown> {
  const label = (field: string): string => `${prefix}${field}`;
  return {
    [label("UsedAmount")]: state?.usedAmount ?? null,
    [label("IsCompleted")]: state?.isCompleted ?? null,
    [label("CompletedAt")]: state?.completedAt ? new Date(state.completedAt) : null,
    [label("IsNotUsable")]: state?.isNotUsable ?? null,
  };
}

function auditData(attemptId: string, row: AmexSyncPlanRow, disposition: string, reasonCode: string): Record<string, unknown> {
  return {
    attemptId,
    sourceRowIdentity: row.sourceRowIdentity,
    sourceObservationIdentity: row.sourceObservationIdentity,
    observedAt: new Date(row.observedAt),
    contractVersion: "amex-benefits/3",
    parserVersion: row.parserVersion,
    disposition,
    reasonCode,
    destinationCardId: row.destinationCardId,
    destinationBenefitId: row.destinationBenefitId,
    destinationStatusId: row.destinationStatusId,
    ...auditSnapshot("before", row.before),
    ...auditSnapshot("after", row.after),
  };
}

export async function recordNonAppliedAmexSyncRow(
  attemptId: string,
  row: AmexSyncPlanRow,
): Promise<StoredRowResult> {
  const disposition = row.disposition === "unchanged" ? "UNCHANGED" : "SKIPPED";
  const successfulAudit = auditData(attemptId, row, disposition, row.reason);
  return client().$transaction(async (transaction) => {
    const existingAudit = await transaction.amexSyncRowAudit.findUnique({
      where: { attemptId_sourceRowIdentity: { attemptId, sourceRowIdentity: row.sourceRowIdentity } },
      select: { sourceRowIdentity: true, disposition: true, reasonCode: true },
    }) as StoredRowResult | null;
    if (existingAudit && existingAudit.disposition !== "FAILED") return existingAudit;

    if (existingAudit) {
      await transaction.amexSyncRowAudit.update({
        where: { attemptId_sourceRowIdentity: { attemptId, sourceRowIdentity: row.sourceRowIdentity } },
        data: successfulAudit,
      });
    } else {
      await transaction.amexSyncRowAudit.create({ data: successfulAudit });
    }
    return {
      sourceRowIdentity: row.sourceRowIdentity,
      disposition,
      reasonCode: row.reason,
    };
  }, { isolationLevel: "Serializable" });
}

function provenanceUpsertArgs(
  attemptId: string,
  row: AmexSyncPlanRow,
): { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> } {
  if (!row.destinationStatusId || !row.periodKey) {
    throw new Error("A provenance-bearing sync row is incomplete.");
  }
  const observation = {
    sourceObservationIdentity: row.sourceObservationIdentity,
    sourceObservationDigest: row.sourceObservationDigest,
    observedAt: new Date(row.observedAt),
    contractVersion: "amex-benefits/3",
    parserVersion: row.parserVersion,
    productKey: row.productKey,
    creditFamilyKey: row.creditFamilyKey,
    periodKey: row.periodKey,
    attemptId,
  };
  return {
    where: {
      benefitStatusId_source: {
        benefitStatusId: row.destinationStatusId,
        source: "AMEX",
      },
    },
    create: {
      benefitStatusId: row.destinationStatusId,
      source: "AMEX",
      ...observation,
    },
    update: {
      ...observation,
      appliedAt: new Date(),
    },
  };
}

interface TransactionalDestinationStatus {
  userId: string;
  usedAmount: number;
  isCompleted: boolean;
  completedAt: Date | null;
  isNotUsable: boolean;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  benefit: {
    id: string;
    creditCardId: string | null;
    productKey: string | null;
    creditFamilyKey: string | null;
    periodKey: string | null;
    creditCard: {
      id: string;
      userId: string;
      productKey: string | null;
      lifecycleStatus: "ACTIVE" | "CLOSED" | "PRODUCT_CHANGED";
    } | null;
  };
}

function stateMatchesProjection(
  status: TransactionalDestinationStatus | null,
  userId: string,
  expected: StatusStateProjection,
): boolean {
  return Boolean(status
    && status.userId === userId
    && status.usedAmount === expected.usedAmount
    && status.isCompleted === expected.isCompleted
    && (status.completedAt?.toISOString() ?? null) === expected.completedAt
    && status.isNotUsable === expected.isNotUsable);
}

async function assertAmexProvenanceCanAdvance(
  transaction: SyncPrismaClient,
  row: AmexSyncPlanRow,
): Promise<void> {
  if (!row.destinationStatusId) throw new Error("conflict_repreview_required");
  const currentProvenance = await transaction.benefitStatusSourceProvenance.findUnique({
    where: {
      benefitStatusId_source: {
        benefitStatusId: row.destinationStatusId,
        source: "AMEX",
      },
    },
    select: {
      observedAt: true,
      sourceObservationDigest: true,
    },
  }) as { observedAt: Date; sourceObservationDigest: string } | null;
  const observedAt = new Date(row.observedAt);
  if (currentProvenance
    && (currentProvenance.observedAt.getTime() > observedAt.getTime()
      || (currentProvenance.observedAt.getTime() === observedAt.getTime()
        && currentProvenance.sourceObservationDigest !== row.sourceObservationDigest))) {
    throw new Error("conflict_repreview_required");
  }
}

async function loadAuthorizedDestinationStatus(
  transaction: SyncPrismaClient,
  userId: string,
  row: AmexSyncPlanRow,
): Promise<TransactionalDestinationStatus | null> {
  if (!row.destinationStatusId
    || !row.destinationBenefitId
    || !row.destinationCardId
    || !row.periodKey
    || !row.sourcePeriodStartDate
    || !row.sourcePeriodEndDate) return null;

  const status = await transaction.benefitStatus.findUnique({
    where: { id: row.destinationStatusId },
    select: {
      userId: true,
      usedAmount: true,
      isCompleted: true,
      completedAt: true,
      isNotUsable: true,
      cycleStartDate: true,
      cycleEndDate: true,
      occurrenceIndex: true,
      benefit: {
        select: {
          id: true,
          creditCardId: true,
          productKey: true,
          creditFamilyKey: true,
          periodKey: true,
          creditCard: {
            select: {
              id: true,
              userId: true,
              productKey: true,
              lifecycleStatus: true,
            },
          },
        },
      },
    },
  }) as TransactionalDestinationStatus | null;
  if (!status
    || status.userId !== userId
    || status.occurrenceIndex !== 0
    || status.cycleStartDate.toISOString().slice(0, 10) !== row.sourcePeriodStartDate
    || status.cycleEndDate.toISOString().slice(0, 10) !== row.sourcePeriodEndDate
    || status.benefit.id !== row.destinationBenefitId
    || status.benefit.creditCardId !== row.destinationCardId
    || status.benefit.productKey !== row.productKey
    || status.benefit.creditFamilyKey !== row.creditFamilyKey
    || status.benefit.periodKey !== row.periodKey
    || !status.benefit.creditCard
    || status.benefit.creditCard.id !== row.destinationCardId
    || status.benefit.creditCard.userId !== userId
    || status.benefit.creditCard.lifecycleStatus !== "ACTIVE"
    || status.benefit.creditCard.productKey !== row.productKey) return null;
  return status;
}

/**
 * Advances replay-defense provenance for a newer observation whose destination
 * values are already current. The serializable transaction prevents a
 * concurrent status edit from being acknowledged as observed.
 */
export async function recordCurrentAmexSyncRow(input: {
  attemptId: string;
  userId: string;
  row: AmexSyncPlanRow;
}): Promise<StoredRowResult> {
  const { attemptId, userId, row } = input;
  if (row.disposition !== "unchanged"
    || row.reason !== "already_current"
    || !row.destinationStatusId
    || !row.destinationBenefitId
    || !row.destinationCardId
    || !row.before
    || !row.after
    || !row.periodKey
    || !row.sourcePeriodStartDate
    || !row.sourcePeriodEndDate) {
    throw new Error("A current sync row is incomplete.");
  }

  const before = row.before;
  return client().$transaction(async (transaction) => {
    const existingAudit = await transaction.amexSyncRowAudit.findUnique({
      where: { attemptId_sourceRowIdentity: { attemptId, sourceRowIdentity: row.sourceRowIdentity } },
      select: { sourceRowIdentity: true, disposition: true, reasonCode: true },
    }) as StoredRowResult | null;
    if (existingAudit && existingAudit.disposition !== "FAILED") return existingAudit;

    const currentStatus = await loadAuthorizedDestinationStatus(transaction, userId, row);
    if (!stateMatchesProjection(currentStatus, userId, before)) {
      throw new Error("conflict_repreview_required");
    }

    await assertAmexProvenanceCanAdvance(transaction, row);

    await transaction.benefitStatusSourceProvenance.upsert(
      provenanceUpsertArgs(attemptId, row),
    );
    const successfulAudit = auditData(attemptId, row, "UNCHANGED", row.reason);
    if (existingAudit) {
      await transaction.amexSyncRowAudit.update({
        where: { attemptId_sourceRowIdentity: { attemptId, sourceRowIdentity: row.sourceRowIdentity } },
        data: successfulAudit,
      });
    } else {
      await transaction.amexSyncRowAudit.create({ data: successfulAudit });
    }
    return {
      sourceRowIdentity: row.sourceRowIdentity,
      disposition: "UNCHANGED",
      reasonCode: row.reason,
    };
  }, { isolationLevel: "Serializable" });
}

export async function applyAmexSyncRow(input: {
  attemptId: string;
  userId: string;
  row: AmexSyncPlanRow;
}): Promise<StoredRowResult> {
  const { attemptId, userId, row } = input;
  if (!row.destinationStatusId
    || !row.destinationCardId
    || !row.destinationBenefitId
    || !row.before
    || !row.after
    || !row.periodKey
    || !row.sourcePeriodStartDate
    || !row.sourcePeriodEndDate) {
    throw new Error("An applied sync row is incomplete.");
  }
  const before = row.before;
  const after = row.after;
  return client().$transaction(async (transaction) => {
    const existingAudit = await transaction.amexSyncRowAudit.findUnique({
      where: { attemptId_sourceRowIdentity: { attemptId, sourceRowIdentity: row.sourceRowIdentity } },
      select: { sourceRowIdentity: true, disposition: true, reasonCode: true },
    }) as StoredRowResult | null;
    if (existingAudit && existingAudit.disposition !== "FAILED") return existingAudit;

    const currentStatus = await loadAuthorizedDestinationStatus(transaction, userId, row);
    if (!stateMatchesProjection(currentStatus, userId, before)) {
      throw new Error("conflict_repreview_required");
    }
    await assertAmexProvenanceCanAdvance(transaction, row);

    const update = await transaction.benefitStatus.updateMany({
      where: {
        id: row.destinationStatusId,
        userId,
        benefitId: row.destinationBenefitId,
        cycleStartDate: new Date(`${row.sourcePeriodStartDate}T00:00:00.000Z`),
        cycleEndDate: new Date(`${row.sourcePeriodEndDate}T00:00:00.000Z`),
        occurrenceIndex: 0,
        usedAmount: before.usedAmount,
        isCompleted: before.isCompleted,
        completedAt: before.completedAt ? new Date(before.completedAt) : null,
        isNotUsable: before.isNotUsable,
      },
      data: {
        usedAmount: after.usedAmount,
        isCompleted: after.isCompleted,
        completedAt: after.completedAt ? new Date(after.completedAt) : null,
      },
    });
    if (update.count !== 1) throw new Error("conflict_repreview_required");

    await transaction.benefitStatusSourceProvenance.upsert(
      provenanceUpsertArgs(attemptId, row),
    );
    const successfulAudit = auditData(attemptId, row, "UPDATED", row.reason);
    if (existingAudit) {
      await transaction.amexSyncRowAudit.update({
        where: { attemptId_sourceRowIdentity: { attemptId, sourceRowIdentity: row.sourceRowIdentity } },
        data: successfulAudit,
      });
    } else {
      await transaction.amexSyncRowAudit.create({ data: successfulAudit });
    }
    return { sourceRowIdentity: row.sourceRowIdentity, disposition: "UPDATED", reasonCode: row.reason };
  }, { isolationLevel: "Serializable" });
}

export async function recordFailedAmexSyncRow(
  attemptId: string,
  row: AmexSyncPlanRow,
  reasonCode: "conflict_repreview_required" | "persistence_failed",
): Promise<StoredRowResult> {
  return client().amexSyncRowAudit.upsert({
    where: { attemptId_sourceRowIdentity: { attemptId, sourceRowIdentity: row.sourceRowIdentity } },
    create: auditData(attemptId, row, "FAILED", reasonCode),
    // Never downgrade a concurrently successful retry to FAILED.
    update: {},
    select: { sourceRowIdentity: true, disposition: true, reasonCode: true },
  }) as Promise<StoredRowResult>;
}

export async function completeAmexSyncAttempt(
  attemptId: string,
  results: StoredRowResult[],
  now: Date,
): Promise<void> {
  const counts = { updatedCount: 0, unchangedCount: 0, skippedCount: 0, failedCount: 0 };
  results.forEach((result) => {
    if (result.disposition === "UPDATED") counts.updatedCount += 1;
    else if (result.disposition === "UNCHANGED") counts.unchangedCount += 1;
    else if (result.disposition === "SKIPPED") counts.skippedCount += 1;
    else counts.failedCount += 1;
  });
  await client().amexSyncAttempt.update({
    where: { id: attemptId },
    data: {
      ...counts,
      state: counts.failedCount ? "PARTIAL_FAILED" : "COMPLETED",
      completedAt: now,
    },
  });
}

export const AMEX_SYNC_AUDIT_RETENTION_DAYS = 90;
export const AMEX_SYNC_AUDIT_RETENTION_BATCH_SIZE = 500;

export function amexSyncAuditRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - AMEX_SYNC_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function deleteExpiredAmexSyncRowAudits(cutoff: Date): Promise<number> {
  return client().$transaction(async (transaction) => {
    const expiredAudits = await transaction.amexSyncRowAudit.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: AMEX_SYNC_AUDIT_RETENTION_BATCH_SIZE,
      select: { id: true },
    }) as Array<{ id: string }>;
    const auditResult = expiredAudits.length
      ? await transaction.amexSyncRowAudit.deleteMany({
        where: { id: { in: expiredAudits.map((audit) => audit.id) } },
      })
      : { count: 0 };

    const expiredEmptyAttempts = await transaction.amexSyncAttempt.findMany({
      where: {
        createdAt: { lt: cutoff },
        rowAudits: { none: {} },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: AMEX_SYNC_AUDIT_RETENTION_BATCH_SIZE,
      select: { id: true },
    }) as Array<{ id: string }>;
    if (expiredEmptyAttempts.length) {
      await transaction.amexSyncAttempt.deleteMany({
        where: { id: { in: expiredEmptyAttempts.map((attempt) => attempt.id) } },
      });
    }
    return auditResult.count;
  });
}
