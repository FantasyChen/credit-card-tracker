import { prisma } from "@/lib/prisma";
import {
  amexDestinationDefinitionFingerprint,
  resolveAmexGlobalDefinitionAuthority,
  type AmexSyncDestinationContext,
  type AmexSyncPlanRow,
  type DestinationPredefinedBenefitSnapshot,
  type DestinationPredefinedCardSnapshot,
  type StatusStateProjection,
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
  benefitId: string | null;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
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
  catalogKey: string | null;
  predefinedCardId: string;
  category: string;
  description: string;
  percentage: number;
  maxAmount: number | null;
  frequency: string;
  cycleAlignment: string | null;
  fixedCycleDurationMonths: number | null;
  fixedCycleStartMonth: number | null;
  occurrencesInCycle: number;
  productKey: string | null;
  creditFamilyKey: string | null;
  periodKey: string | null;
  retiredAt: Date | null;
  benefitStatuses: RawDestinationStatus[];
}

interface RawDestinationPredefinedCard {
  id: string;
  catalogKey: string | null;
  name: string;
  issuer: string;
  productKey: string | null;
  retiredAt: Date | null;
  benefits: RawDestinationBenefit[];
}

interface RawDestinationCard {
  id: string;
  userId: string;
  name: string;
  nickname: string | null;
  issuer: string;
  lastFourDigits: string | null;
  lifecycleStatus: "ACTIVE" | "CLOSED" | "PRODUCT_CHANGED";
  predefinedCard: RawDestinationPredefinedCard | null;
}

export async function loadAmexSyncDestinationContext(userId: string): Promise<AmexSyncDestinationContext> {
  const db = client();
  const rawCards = await db.creditCard.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        name: true,
        nickname: true,
        issuer: true,
        lastFourDigits: true,
        lifecycleStatus: true,
        predefinedCard: {
          select: {
            id: true,
            catalogKey: true,
            name: true,
            issuer: true,
            productKey: true,
            retiredAt: true,
            benefits: {
              select: {
                id: true,
                catalogKey: true,
                predefinedCardId: true,
                category: true,
                description: true,
                percentage: true,
                maxAmount: true,
                frequency: true,
                cycleAlignment: true,
                fixedCycleDurationMonths: true,
                fixedCycleStartMonth: true,
                occurrencesInCycle: true,
                productKey: true,
                creditFamilyKey: true,
                periodKey: true,
                retiredAt: true,
                benefitStatuses: {
                  where: { userId },
                  select: {
                    id: true,
                    benefitId: true,
                    creditCardId: true,
                    predefinedBenefitId: true,
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
        },
      },
    });
  const cards = rawCards as unknown as RawDestinationCard[];
  return {
    cards: cards.map((card) => ({
      id: card.id,
      userId: card.userId,
      displayName: card.nickname ? `${card.nickname} (${card.name})` : card.name,
      issuer: card.issuer,
      lastFourDigits: card.lastFourDigits,
      lifecycleStatus: card.lifecycleStatus,
      predefinedCard: card.predefinedCard ? {
        ...card.predefinedCard,
        benefits: card.predefinedCard.benefits.map((benefit) => ({
          ...benefit,
          statuses: benefit.benefitStatuses
            .filter((status) => status.creditCardId === card.id)
            .map((status) => ({
              ...status,
              provenance: status.sourceProvenance[0] ?? null,
            })),
        })),
      } : null,
    })),
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
  destinationCardId: string | null;
  beforeUsedAmount: number | null;
  beforeIsCompleted: boolean | null;
  beforeCompletedAt: Date | string | null;
  beforeIsNotUsable: boolean | null;
  afterUsedAmount: number | null;
  afterIsCompleted: boolean | null;
  afterCompletedAt: Date | string | null;
  afterIsNotUsable: boolean | null;
}

const storedRowResultSelect = {
  sourceRowIdentity: true,
  disposition: true,
  reasonCode: true,
  destinationCardId: true,
  beforeUsedAmount: true,
  beforeIsCompleted: true,
  beforeCompletedAt: true,
  beforeIsNotUsable: true,
  afterUsedAmount: true,
  afterIsCompleted: true,
  afterCompletedAt: true,
  afterIsNotUsable: true,
} as const;

export async function findAmexSyncAttempt(userId: string, idempotencyKey: string): Promise<StoredAttemptResult | null> {
  return client().amexSyncAttempt.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    select: {
      id: true,
      state: true,
      rowAudits: { select: storedRowResultSelect },
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
    destinationPredefinedBenefitId: row.destinationPredefinedBenefitId,
    destinationDefinitionFingerprint: row.destinationDefinitionFingerprint,
    destinationStatusId: row.destinationStatusId,
    ...auditSnapshot("before", row.before),
    ...auditSnapshot("after", row.after),
  };
}

function storedResultFromPlan(
  row: AmexSyncPlanRow,
  disposition: StoredRowResult["disposition"],
  reasonCode: string,
): StoredRowResult {
  return {
    sourceRowIdentity: row.sourceRowIdentity,
    disposition,
    reasonCode,
    destinationCardId: row.destinationCardId,
    beforeUsedAmount: row.before?.usedAmount ?? null,
    beforeIsCompleted: row.before?.isCompleted ?? null,
    beforeCompletedAt: row.before?.completedAt ?? null,
    beforeIsNotUsable: row.before?.isNotUsable ?? null,
    afterUsedAmount: row.after?.usedAmount ?? null,
    afterIsCompleted: row.after?.isCompleted ?? null,
    afterCompletedAt: row.after?.completedAt ?? null,
    afterIsNotUsable: row.after?.isNotUsable ?? null,
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
      select: storedRowResultSelect,
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
    return storedResultFromPlan(row, disposition, row.reason);
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
  benefitId: string | null;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  usedAmount: number;
  isCompleted: boolean;
  completedAt: Date | null;
  isNotUsable: boolean;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  creditCard: {
    id: string;
    userId: string;
    issuer: string;
    lastFourDigits: string | null;
    lifecycleStatus: "ACTIVE" | "CLOSED" | "PRODUCT_CHANGED";
    predefinedCardId: string | null;
    predefinedCard: Omit<DestinationPredefinedCardSnapshot, "benefits"> | null;
  } | null;
  predefinedBenefit: Omit<DestinationPredefinedBenefitSnapshot, "statuses"> & {
    predefinedCard: Omit<DestinationPredefinedCardSnapshot, "benefits">;
  } | null;
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
      sourceObservationIdentity: true,
      sourceObservationDigest: true,
    },
  }) as { observedAt: Date; sourceObservationIdentity: string; sourceObservationDigest: string } | null;
  const expected = row.beforeProvenance;
  if ((currentProvenance === null) !== (expected === null)
    || (currentProvenance && expected
      && (currentProvenance.observedAt.toISOString() !== expected.observedAt
        || currentProvenance.sourceObservationIdentity !== expected.sourceObservationIdentity
        || currentProvenance.sourceObservationDigest !== expected.sourceObservationDigest))) {
    throw new Error("conflict_repreview_required");
  }
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
    || !row.destinationPredefinedCardId
    || !row.destinationProductCatalogKey
    || !row.destinationPredefinedBenefitId
    || !row.destinationBenefitCatalogKey
    || !row.destinationDefinitionFingerprint
    || !row.destinationCardId
    || row.destinationOccurrenceIndex === null
    || !row.periodKey
    || !row.sourcePeriodStartDate
    || !row.sourcePeriodEndDate
    || !row.destinationCycleStartInstant
    || !row.destinationCycleEndInstant) return null;

  const status = await transaction.benefitStatus.findUnique({
    where: { id: row.destinationStatusId },
    select: {
      benefitId: true,
      creditCardId: true,
      predefinedBenefitId: true,
      userId: true,
      usedAmount: true,
      isCompleted: true,
      completedAt: true,
      isNotUsable: true,
      cycleStartDate: true,
      cycleEndDate: true,
      occurrenceIndex: true,
      creditCard: {
        select: {
          id: true,
          userId: true,
          issuer: true,
          lastFourDigits: true,
          lifecycleStatus: true,
          predefinedCardId: true,
          predefinedCard: {
            select: {
              id: true,
              catalogKey: true,
              name: true,
              issuer: true,
              productKey: true,
              retiredAt: true,
            },
          },
        },
      },
      predefinedBenefit: {
        select: {
          id: true,
          catalogKey: true,
          predefinedCardId: true,
          category: true,
          description: true,
          percentage: true,
          maxAmount: true,
          frequency: true,
          cycleAlignment: true,
          fixedCycleDurationMonths: true,
          fixedCycleStartMonth: true,
          occurrencesInCycle: true,
          productKey: true,
          creditFamilyKey: true,
          periodKey: true,
          retiredAt: true,
          predefinedCard: {
            select: {
              id: true,
              catalogKey: true,
              name: true,
              issuer: true,
              productKey: true,
              retiredAt: true,
            },
          },
        },
      },
    },
  }) as TransactionalDestinationStatus | null;
  if (!status
    || status.userId !== userId
    || status.occurrenceIndex !== row.destinationOccurrenceIndex
    || status.cycleStartDate.toISOString() !== row.destinationCycleStartInstant
    || status.cycleEndDate.toISOString() !== row.destinationCycleEndInstant
    || status.cycleStartDate.toISOString().slice(0, 10) !== row.sourcePeriodStartDate
    || status.cycleEndDate.toISOString().slice(0, 10) !== row.sourcePeriodEndDate
    || status.creditCardId !== row.destinationCardId
    || status.predefinedBenefitId !== row.destinationPredefinedBenefitId
    || status.benefitId !== row.destinationBenefitId
    || !status.creditCard
    || status.creditCard.id !== row.destinationCardId
    || status.creditCard.userId !== userId
    || status.creditCard.issuer !== "American Express"
    || status.creditCard.lifecycleStatus !== "ACTIVE"
    || status.creditCard.predefinedCardId !== row.destinationPredefinedCardId
    || !/^\d{5}$/.test(status.creditCard.lastFourDigits ?? "")
    || status.creditCard.lastFourDigits !== row.sourceEndingDigits
    || !status.creditCard.predefinedCard
    || status.creditCard.predefinedCard.id !== row.destinationPredefinedCardId
    || status.creditCard.predefinedCard.catalogKey !== row.destinationProductCatalogKey
    || status.creditCard.predefinedCard.productKey !== row.productKey
    || status.creditCard.predefinedCard.issuer !== "American Express"
    || !status.predefinedBenefit
    || status.predefinedBenefit.id !== row.destinationPredefinedBenefitId
    || status.predefinedBenefit.catalogKey !== row.destinationBenefitCatalogKey
    || status.predefinedBenefit.predefinedCardId !== row.destinationPredefinedCardId
    || status.predefinedBenefit.predefinedCard.id !== row.destinationPredefinedCardId
    || status.predefinedBenefit.predefinedCard.catalogKey !== row.destinationProductCatalogKey
    || status.predefinedBenefit.productKey !== row.productKey
    || status.predefinedBenefit.creditFamilyKey !== row.creditFamilyKey
    || status.predefinedBenefit.periodKey !== row.periodKey) return null;

  const product: DestinationPredefinedCardSnapshot = {
    ...status.creditCard.predefinedCard,
    benefits: [],
  };
  const benefit: DestinationPredefinedBenefitSnapshot = {
    ...status.predefinedBenefit,
    statuses: [],
  };
  const sourceIdentity = resolveAmexGlobalDefinitionAuthority({
    product,
    benefit,
    sourceCreditKey: row.sourceCreditKey,
  });
  if (!sourceIdentity
    || amexDestinationDefinitionFingerprint({ product, benefit, sourceIdentity }) !== row.destinationDefinitionFingerprint) {
    return null;
  }
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
    || !row.destinationPredefinedBenefitId
    || !row.destinationDefinitionFingerprint
    || !row.destinationCardId
    || row.destinationOccurrenceIndex === null
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
      select: storedRowResultSelect,
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
    return storedResultFromPlan(row, "UNCHANGED", row.reason);
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
    || !row.destinationPredefinedBenefitId
    || !row.destinationDefinitionFingerprint
    || row.destinationOccurrenceIndex === null
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
      select: storedRowResultSelect,
    }) as StoredRowResult | null;
    if (existingAudit && existingAudit.disposition !== "FAILED") return existingAudit;

    const currentStatus = await loadAuthorizedDestinationStatus(transaction, userId, row);
    if (!currentStatus || !stateMatchesProjection(currentStatus, userId, before)) {
      throw new Error("conflict_repreview_required");
    }
    await assertAmexProvenanceCanAdvance(transaction, row);

    const update = await transaction.benefitStatus.updateMany({
      where: {
        id: row.destinationStatusId,
        userId,
        benefitId: row.destinationBenefitId,
        creditCardId: row.destinationCardId,
        predefinedBenefitId: row.destinationPredefinedBenefitId,
        cycleStartDate: currentStatus.cycleStartDate,
        cycleEndDate: currentStatus.cycleEndDate,
        occurrenceIndex: row.destinationOccurrenceIndex,
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
    return storedResultFromPlan(row, "UPDATED", row.reason);
  }, { isolationLevel: "Serializable" });
}

export async function applyAmexSyncGroup(input: {
  attemptId: string;
  userId: string;
  rows: AmexSyncPlanRow[];
}): Promise<StoredRowResult[]> {
  const { attemptId, userId, rows } = input;
  if (rows.length < 2
    || new Set(rows.map((row) => row.atomicGroupIdentity)).size !== 1
    || rows.some((row) => (row.disposition !== "proposed"
      && !(row.disposition === "unchanged" && row.reason === "already_current"))
      || !row.destinationStatusId
      || !row.destinationCardId
      || !row.destinationPredefinedBenefitId
      || !row.destinationDefinitionFingerprint
      || row.destinationOccurrenceIndex === null
      || !row.before
      || !row.after
      || !row.periodKey
      || !row.sourcePeriodStartDate
      || !row.sourcePeriodEndDate)) {
    throw new Error("An applied sync group is incomplete.");
  }

  return client().$transaction(async (transaction) => {
    const existingAudits: Array<StoredRowResult | null> = [];
    for (const row of rows) {
      existingAudits.push(await transaction.amexSyncRowAudit.findUnique({
        where: { attemptId_sourceRowIdentity: { attemptId, sourceRowIdentity: row.sourceRowIdentity } },
        select: storedRowResultSelect,
      }) as StoredRowResult | null);
    }
    const successfulExisting = existingAudits.filter((audit) => audit && audit.disposition !== "FAILED") as StoredRowResult[];
    if (successfulExisting.length) {
      if (successfulExisting.length === rows.length) return successfulExisting;
      throw new Error("conflict_repreview_required");
    }

    const currentStatuses: TransactionalDestinationStatus[] = [];
    for (const row of rows) {
      const currentStatus = await loadAuthorizedDestinationStatus(transaction, userId, row);
      if (!currentStatus || !stateMatchesProjection(currentStatus, userId, row.before!)) {
        throw new Error("conflict_repreview_required");
      }
      currentStatuses.push(currentStatus);
      await assertAmexProvenanceCanAdvance(transaction, row);
    }

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (row.disposition !== "proposed") continue;
      const before = row.before!;
      const after = row.after!;
      const currentStatus = currentStatuses[index];
      const update = await transaction.benefitStatus.updateMany({
        where: {
          id: row.destinationStatusId,
          userId,
          benefitId: row.destinationBenefitId,
          creditCardId: row.destinationCardId,
          predefinedBenefitId: row.destinationPredefinedBenefitId,
          cycleStartDate: currentStatus.cycleStartDate,
          cycleEndDate: currentStatus.cycleEndDate,
          occurrenceIndex: row.destinationOccurrenceIndex,
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
    }

    const results: StoredRowResult[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      await transaction.benefitStatusSourceProvenance.upsert(
        provenanceUpsertArgs(attemptId, row),
      );
      const disposition = row.disposition === "proposed" ? "UPDATED" : "UNCHANGED";
      const data = auditData(attemptId, row, disposition, row.reason);
      if (existingAudits[index]) {
        await transaction.amexSyncRowAudit.update({
          where: { attemptId_sourceRowIdentity: { attemptId, sourceRowIdentity: row.sourceRowIdentity } },
          data,
        });
      } else {
        await transaction.amexSyncRowAudit.create({ data });
      }
      results.push(storedResultFromPlan(row, disposition, row.reason));
    }
    return results;
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
    select: storedRowResultSelect,
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
