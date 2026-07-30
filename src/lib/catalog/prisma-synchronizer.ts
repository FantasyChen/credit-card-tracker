import type { StaticPredefinedBenefit, StaticPredefinedCard } from "../static-catalog";
import { validateStaticCatalog } from "./validation";
import {
  planCatalogSynchronization,
  summarizeCatalogSyncPlan,
  type CatalogSnapshot,
  type CatalogSyncPlan,
  type StoredCatalogBenefit,
  type StoredCatalogCard,
} from "./synchronizer";

interface CatalogDelegate {
  findMany(args: unknown): Promise<unknown[]>;
  create(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
}

export interface CatalogPrismaClient {
  predefinedCard: CatalogDelegate;
  predefinedBenefit: CatalogDelegate;
  $transaction<T>(
    callback: (transaction: CatalogPrismaClient) => Promise<T>,
    options?: { isolationLevel: "Serializable" },
  ): Promise<T>;
}

const cardSelect = {
  id: true,
  catalogKey: true,
  name: true,
  issuer: true,
  annualFee: true,
  imageUrl: true,
  productKey: true,
  retiredAt: true,
  updatedAt: true,
} as const;

const benefitSelect = {
  id: true,
  catalogKey: true,
  predefinedCardId: true,
  category: true,
  description: true,
  percentage: true,
  maxAmount: true,
  frequency: true,
  cycleAlignment: true,
  fixedCycleStartMonth: true,
  fixedCycleDurationMonths: true,
  occurrencesInCycle: true,
  productKey: true,
  creditFamilyKey: true,
  periodKey: true,
  retiredAt: true,
  updatedAt: true,
} as const;

export async function readCatalogSnapshot(database: CatalogPrismaClient): Promise<CatalogSnapshot> {
  const [cards, benefits] = await Promise.all([
    database.predefinedCard.findMany({ select: cardSelect, orderBy: { id: "asc" } }),
    database.predefinedBenefit.findMany({ select: benefitSelect, orderBy: { id: "asc" } }),
  ]);
  return {
    cards: cards as StoredCatalogCard[],
    benefits: benefits as StoredCatalogBenefit[],
  };
}

function cardData(source: StaticPredefinedCard): Record<string, unknown> {
  return {
    catalogKey: source.catalogKey,
    name: source.name,
    issuer: source.issuer,
    annualFee: source.annualFee,
    imageUrl: source.imageUrl,
    productKey: source.productKey ?? null,
    retiredAt: null,
  };
}

function benefitData(source: StaticPredefinedBenefit, predefinedCardId: string): Record<string, unknown> {
  return {
    catalogKey: source.catalogKey,
    predefinedCardId,
    category: source.category,
    description: source.description,
    percentage: source.percentage,
    maxAmount: source.maxAmount ?? null,
    frequency: source.frequency,
    cycleAlignment: source.cycleAlignment ?? "CARD_ANNIVERSARY",
    fixedCycleStartMonth: source.fixedCycleStartMonth ?? null,
    fixedCycleDurationMonths: source.fixedCycleDurationMonths ?? null,
    occurrencesInCycle: source.occurrencesInCycle ?? 1,
    productKey: source.productKey ?? null,
    creditFamilyKey: source.creditFamilyKey ?? null,
    periodKey: source.periodKey ?? null,
    retiredAt: null,
  };
}

function createdId(record: unknown, kind: "card" | "benefit"): string {
  const id = (record as { id?: unknown }).id;
  if (typeof id !== "string" || !id) throw new Error(`Catalog ${kind} create did not return an id.`);
  return id;
}

function syncPlanFingerprint(plan: CatalogSyncPlan): string {
  const action = (entry: {
    kind: string;
    source: { catalogKey: string } | null;
    existing: { id: string; updatedAt: Date } | null;
  }) => ({
    kind: entry.kind,
    sourceCatalogKey: entry.source?.catalogKey ?? null,
    existingId: entry.existing?.id ?? null,
    existingUpdatedAt: entry.existing?.updatedAt.toISOString() ?? null,
  });
  return JSON.stringify({
    cards: plan.cards.map(action),
    benefits: plan.benefits.map((entry) => ({
      ...action(entry),
      parentCatalogKey: entry.parentCatalogKey,
    })),
    conflicts: plan.conflicts,
  });
}

async function compareAndSet(
  delegate: CatalogDelegate,
  existing: { id: string; catalogKey: string | null; updatedAt: Date },
  data: Record<string, unknown>,
): Promise<void> {
  const result = await delegate.updateMany({
    where: { id: existing.id, catalogKey: existing.catalogKey, updatedAt: existing.updatedAt },
    data,
  });
  if (result.count !== 1) throw new Error("catalog_sync_compare_and_set_conflict");
}

export async function applyCatalogSyncPlan(input: {
  database: CatalogPrismaClient;
  plan: CatalogSyncPlan;
  retirementTime: Date;
}): Promise<void> {
  if (input.plan.conflicts.length) throw new Error("catalog_sync_plan_conflict");
  const source = input.plan.cards.flatMap((action) => action.source ? [action.source] : []);
  const expectedPlanFingerprint = syncPlanFingerprint(input.plan);

  await input.database.$transaction(async (transaction) => {
    const currentPlan = planCatalogSynchronization({
      source,
      snapshot: await readCatalogSnapshot(transaction),
    });
    if (syncPlanFingerprint(currentPlan) !== expectedPlanFingerprint) {
      throw new Error("catalog_sync_compare_and_set_conflict");
    }

    const cardIdByCatalogKey = new Map<string, string>();
    for (const action of input.plan.cards) {
      if (action.kind === "retire") {
        await compareAndSet(transaction.predefinedCard, action.existing!, { retiredAt: input.retirementTime });
        continue;
      }
      if (!action.source) continue;
      if (action.kind === "create") {
        const created = await transaction.predefinedCard.create({ data: cardData(action.source), select: { id: true } });
        cardIdByCatalogKey.set(action.source.catalogKey, createdId(created, "card"));
      } else {
        if (action.kind !== "unchanged") {
          await compareAndSet(transaction.predefinedCard, action.existing!, cardData(action.source));
        }
        cardIdByCatalogKey.set(action.source.catalogKey, action.existing!.id);
      }
    }

    for (const action of input.plan.benefits) {
      if (action.kind === "retire") {
        await compareAndSet(transaction.predefinedBenefit, action.existing!, { retiredAt: input.retirementTime });
        continue;
      }
      if (!action.source) continue;
      const parentId = cardIdByCatalogKey.get(action.parentCatalogKey);
      if (!parentId) throw new Error("catalog_sync_parent_missing");
      if (action.kind === "create") {
        await transaction.predefinedBenefit.create({
          data: benefitData(action.source, parentId),
          select: { id: true },
        });
      } else if (action.kind !== "unchanged") {
        await compareAndSet(
          transaction.predefinedBenefit,
          action.existing!,
          benefitData(action.source, parentId),
        );
      }
    }
  }, { isolationLevel: "Serializable" });
}

export const GLOBAL_CATALOG_SYNC_CONFIRMATION = "SYNC_GLOBAL_CATALOG" as const;

export interface GlobalCatalogSyncReport {
  mode: "dry-run" | "apply";
  source: { cards: number; benefits: number };
  plan: ReturnType<typeof summarizeCatalogSyncPlan>;
}

export async function runGlobalCatalogSyncOperator(input: {
  source: readonly StaticPredefinedCard[];
  database: CatalogPrismaClient;
  mode?: "dry-run" | "apply";
  targetVerified?: boolean;
  confirmApply?: string;
  now?: Date;
}): Promise<GlobalCatalogSyncReport> {
  const mode = input.mode ?? "dry-run";
  if (mode === "apply" && input.targetVerified !== true) {
    throw new Error("Catalog apply requires explicit confirmation that the database target was verified.");
  }
  if (mode === "apply" && input.confirmApply !== GLOBAL_CATALOG_SYNC_CONFIRMATION) {
    throw new Error("Catalog apply requires the exact confirmation phrase.");
  }

  validateStaticCatalog(input.source);
  const snapshot = await readCatalogSnapshot(input.database);
  const plan = planCatalogSynchronization({ source: input.source, snapshot });
  const report: GlobalCatalogSyncReport = {
    mode,
    source: {
      cards: input.source.length,
      benefits: input.source.reduce((count, card) => count + card.benefits.length, 0),
    },
    plan: summarizeCatalogSyncPlan(plan),
  };

  if (mode === "apply") {
    if (plan.conflicts.length) throw new Error("Catalog apply blocked by source/database identity conflicts.");
    await applyCatalogSyncPlan({ database: input.database, plan, retirementTime: input.now ?? new Date() });
  }
  return report;
}
