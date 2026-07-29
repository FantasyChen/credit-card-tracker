import {
  BenefitCycleAlignment,
  BenefitFrequency,
} from "@/generated/prisma";
import { materializeBenefitStatusRows } from "@/lib/benefit-cycle-materialization";
import { prisma } from "@/lib/prisma";
import {
  predefinedCardsData,
  type StaticPredefinedCard,
} from "@/lib/static-catalog";
import {
  executeCatalogKeyBackfill,
  type CatalogBackfillCardShape,
  type CatalogBackfillExecutionReport,
  type CatalogBackfillProposal,
  type CatalogBackfillTemplateCardShape,
  type CatalogBackfillWriter,
} from "./catalog-backfill";
import {
  AMEX_CATALOG_IDENTITY_REGISTRY,
  AMEX_WRITABLE_DESTINATIONS,
} from "./catalog-registry";

export const AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION =
  "FILL_NULL_AMEX_CATALOG_KEYS" as const;
export const AMEX_CATALOG_BACKFILL_DEFAULT_LIMIT = 250;
export const AMEX_CATALOG_BACKFILL_MAX_LIMIT = 500;

interface BackfillDelegate {
  findMany(args: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  updateMany(args: unknown): Promise<{ count: number }>;
  createMany(args: unknown): Promise<{ count: number }>;
}

export interface CatalogBackfillPrismaClient {
  predefinedCard: BackfillDelegate;
  predefinedBenefit: BackfillDelegate;
  creditCard: BackfillDelegate;
  benefit: BackfillDelegate;
  benefitStatus: BackfillDelegate;
  $transaction<T>(
    callback: (transaction: CatalogBackfillPrismaClient) => Promise<T>,
    options?: { isolationLevel: "Serializable" },
  ): Promise<T>;
}

interface RawBenefitShape {
  id: string;
  category: string;
  description: string;
  percentage: number;
  maxAmount: number | null;
  frequency: string;
  cycleAlignment: string | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number;
  productKey: string | null;
  creditFamilyKey: string | null;
  periodKey: string | null;
}

interface RawCardShape {
  id: string;
  name: string;
  issuer: string;
  productKey: string | null;
  benefits: RawBenefitShape[];
}

function templates(): CatalogBackfillTemplateCardShape[] {
  const names = new Set(Object.keys(AMEX_CATALOG_IDENTITY_REGISTRY));
  return (predefinedCardsData as readonly StaticPredefinedCard[])
    .filter((card) => names.has(card.name))
    .map((card) => ({
      name: card.name,
      issuer: card.issuer,
      productKey: card.productKey,
      benefits: card.benefits.map((benefit) => ({
        category: benefit.category,
        description: benefit.description,
        percentage: benefit.percentage,
        maxAmount: benefit.maxAmount ?? null,
        frequency: benefit.frequency,
        cycleAlignment: benefit.cycleAlignment ?? null,
        fixedCycleStartMonth: benefit.fixedCycleStartMonth ?? null,
        fixedCycleDurationMonths: benefit.fixedCycleDurationMonths ?? null,
        occurrencesInCycle: benefit.occurrencesInCycle ?? 1,
        productKey: benefit.productKey ?? null,
        creditFamilyKey: benefit.creditFamilyKey ?? null,
        periodKey: benefit.periodKey ?? null,
      })),
    }));
}

const cardSelect = {
  id: true,
  name: true,
  issuer: true,
  productKey: true,
  benefits: {
    select: {
      id: true,
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
    },
  },
} as const;

function cards(records: unknown[]): CatalogBackfillCardShape[] {
  return (records as RawCardShape[]).map((card) => ({
    ...card,
    benefits: card.benefits.map((benefit) => ({ ...benefit })),
  }));
}

function hasConflict(
  current: { productKey: string | null; creditFamilyKey: string | null; periodKey: string | null },
  expected: CatalogBackfillProposal["benefits"][number],
): boolean {
  return (current.productKey !== null && current.productKey !== expected.productKey)
    || (current.creditFamilyKey !== null && current.creditFamilyKey !== expected.creditFamilyKey)
    || (current.periodKey !== null && current.periodKey !== expected.periodKey);
}

function createWriter(input: {
  database: CatalogBackfillPrismaClient;
  kind: "predefined" | "user";
  referenceDate: Date;
}): { writer: CatalogBackfillWriter; runtimeConflicts: string[] } {
  const { database, kind, referenceDate } = input;
  const cardDelegate = kind === "predefined" ? "predefinedCard" : "creditCard";
  const benefitDelegate = kind === "predefined" ? "predefinedBenefit" : "benefit";
  const materializable = new Set<string>();
  const runtimeConflicts: string[] = [];
  const writableTuples = new Set(AMEX_WRITABLE_DESTINATIONS.map((entry) =>
    `${entry.productKey}|${entry.creditFamilyKey}|${entry.periodKey}`));

  const writer: CatalogBackfillWriter = {
    async fillNullCardProductKey(cardId, productKey) {
      const result = await database[cardDelegate].updateMany({
        where: { id: cardId, productKey: null },
        data: { productKey },
      });
      if (result.count !== 1) runtimeConflicts.push(`card:${cardId}`);
      return result.count === 1;
    },

    async fillNullBenefitKeys(expected) {
      let changed = false;
      try {
        changed = await database.$transaction(async (transaction) => {
          const delegate = transaction[benefitDelegate];
          const current = await delegate.findUnique({
            where: { id: expected.benefitId },
            select: { productKey: true, creditFamilyKey: true, periodKey: true },
          }) as { productKey: string | null; creditFamilyKey: string | null; periodKey: string | null } | null;
          if (!current || hasConflict(current, expected)) {
            runtimeConflicts.push(`benefit:${expected.benefitId}`);
            return false;
          }

          let fieldsChanged = 0;
          const fill = async (field: "productKey" | "creditFamilyKey" | "periodKey", value: string): Promise<void> => {
            if (current[field] !== null) return;
            const result = await delegate.updateMany({
              where: { id: expected.benefitId, [field]: null },
              data: { [field]: value },
            });
            if (result.count !== 1) throw new Error("catalog_backfill_compare_and_set_conflict");
            fieldsChanged += 1;
          };
          await fill("productKey", expected.productKey);
          await fill("creditFamilyKey", expected.creditFamilyKey);
          await fill("periodKey", expected.periodKey);
          return fieldsChanged > 0;
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (error instanceof Error && error.message === "catalog_backfill_compare_and_set_conflict") {
          runtimeConflicts.push(`benefit:${expected.benefitId}`);
          return false;
        }
        throw error;
      }
      if (changed && kind === "user" && writableTuples.has(
        `${expected.productKey}|${expected.creditFamilyKey}|${expected.periodKey}`,
      )) materializable.add(expected.benefitId);
      return changed;
    },

    async materializeMissingStatuses(benefitId) {
      if (kind !== "user" || !materializable.has(benefitId)) return 0;
      return database.$transaction(async (transaction) => {
        const benefit = await transaction.benefit.findUnique({
          where: { id: benefitId },
          select: {
            id: true,
            frequency: true,
            startDate: true,
            description: true,
            cycleAlignment: true,
            fixedCycleStartMonth: true,
            fixedCycleDurationMonths: true,
            occurrencesInCycle: true,
            creditCard: { select: { userId: true, openedDate: true } },
          },
        }) as {
          id: string;
          frequency: BenefitFrequency;
          startDate: Date;
          description: string;
          cycleAlignment: BenefitCycleAlignment | null;
          fixedCycleStartMonth: number | null;
          fixedCycleDurationMonths: number | null;
          occurrencesInCycle: number;
          creditCard: { userId: string; openedDate: Date | null } | null;
        } | null;
        if (!benefit?.creditCard) return 0;
        const materialized = materializeBenefitStatusRows({
          id: benefit.id,
          userId: benefit.creditCard.userId,
          frequency: benefit.frequency,
          startDate: benefit.startDate,
          description: benefit.description,
          cycleAlignment: benefit.cycleAlignment,
          fixedCycleStartMonth: benefit.fixedCycleStartMonth,
          fixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
          occurrencesInCycle: benefit.occurrencesInCycle,
        }, {
          referenceDate,
          cardOpenedDate: benefit.creditCard.openedDate,
          validateCycles: true,
        });
        if (materialized.rows.length > 24) {
          throw new Error(`Refusing to materialize more than 24 statuses for benefit ${benefitId}.`);
        }
        if (!materialized.rows.length) return 0;
        const result = await transaction.benefitStatus.createMany({
          data: materialized.rows.map((row) => ({
            ...row,
            usedAmount: 0,
            isCompleted: false,
            completedAt: null,
            isNotUsable: false,
          })),
          skipDuplicates: true,
        });
        return result.count;
      }, { isolationLevel: "Serializable" });
    },
  };
  return { writer, runtimeConflicts };
}

export interface AmexCatalogBackfillOperatorReport {
  mode: "dry-run" | "apply";
  limit: number;
  hasMore: { predefined: boolean; user: boolean };
  nextCursor: { predefined: string | null; user: string | null };
  runtimeConflicts: { predefined: string[]; user: string[] };
  predefined: CatalogBackfillExecutionReport;
  user: CatalogBackfillExecutionReport;
}

export async function runAmexCatalogBackfillOperator(input: {
  mode?: "dry-run" | "apply";
  confirmApply?: string;
  targetVerified?: boolean;
  limit?: number;
  referenceDate?: Date;
  after?: { predefined?: string; user?: string };
  database?: CatalogBackfillPrismaClient;
} = {}): Promise<AmexCatalogBackfillOperatorReport> {
  const mode = input.mode ?? "dry-run";
  const limit = input.limit ?? AMEX_CATALOG_BACKFILL_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > AMEX_CATALOG_BACKFILL_MAX_LIMIT) {
    throw new Error(`Backfill limit must be between 1 and ${AMEX_CATALOG_BACKFILL_MAX_LIMIT}.`);
  }
  if (mode === "apply" && input.confirmApply !== AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION) {
    throw new Error("Apply mode requires the exact AMEX catalog backfill confirmation phrase.");
  }
  if (mode === "apply" && input.targetVerified !== true) {
    throw new Error("Apply mode requires explicit confirmation that the database target was verified.");
  }

  const database = input.database ?? prisma as unknown as CatalogBackfillPrismaClient;
  const templateCards = templates();
  const names = templateCards.map((card) => card.name);
  const query = (after?: string) => ({
    where: {
      name: { in: names },
      ...(after ? { id: { gt: after } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
    select: cardSelect,
  });
  const [rawPredefined, rawUser] = await Promise.all([
    database.predefinedCard.findMany(query(input.after?.predefined)),
    database.creditCard.findMany(query(input.after?.user)),
  ]);
  const predefinedRecords = cards(rawPredefined.slice(0, limit));
  const userRecords = cards(rawUser.slice(0, limit));
  const referenceDate = input.referenceDate ?? new Date();
  const predefinedWriter = createWriter({ database, kind: "predefined", referenceDate });
  const userWriter = createWriter({ database, kind: "user", referenceDate });

  const predefined = await executeCatalogKeyBackfill({
    cards: predefinedRecords,
    templates: templateCards,
    mode,
    writer: mode === "apply" ? predefinedWriter.writer : undefined,
  });
  const user = await executeCatalogKeyBackfill({
    cards: userRecords,
    templates: templateCards,
    mode,
    writer: mode === "apply" ? userWriter.writer : undefined,
  });
  return {
    mode,
    limit,
    hasMore: { predefined: rawPredefined.length > limit, user: rawUser.length > limit },
    nextCursor: {
      predefined: rawPredefined.length > limit ? predefinedRecords[predefinedRecords.length - 1]?.id ?? null : null,
      user: rawUser.length > limit ? userRecords[userRecords.length - 1]?.id ?? null : null,
    },
    runtimeConflicts: {
      predefined: predefinedWriter.runtimeConflicts,
      user: userWriter.runtimeConflicts,
    },
    predefined,
    user,
  };
}
