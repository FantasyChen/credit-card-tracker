import { prisma } from "@/lib/prisma";
import {
  predefinedCardsData,
  type StaticPredefinedCard,
} from "@/lib/static-catalog";
import {
  AMEX_CATALOG_BACKFILL_SUPERSEDED_ERROR,
  executeCatalogKeyBackfill,
  type CatalogBackfillCardShape,
  type CatalogBackfillExecutionReport,
  type CatalogBackfillTemplateCardShape,
} from "./catalog-backfill";
import { AMEX_CATALOG_IDENTITY_REGISTRY } from "./catalog-registry";

export { AMEX_CATALOG_BACKFILL_SUPERSEDED_ERROR } from "./catalog-backfill";
export const AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION =
  "FILL_NULL_AMEX_CATALOG_KEYS" as const;
export const AMEX_CATALOG_BACKFILL_DEFAULT_LIMIT = 250;
export const AMEX_CATALOG_BACKFILL_MAX_LIMIT = 500;

interface BackfillReadDelegate {
  findMany(args: unknown): Promise<unknown[]>;
}

export interface CatalogBackfillPrismaClient {
  predefinedCard: BackfillReadDelegate;
  creditCard: BackfillReadDelegate;
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

export interface AmexCatalogBackfillOperatorReport {
  mode: "dry-run";
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
  if (mode === "apply") {
    throw new Error(AMEX_CATALOG_BACKFILL_SUPERSEDED_ERROR);
  }
  const limit = input.limit ?? AMEX_CATALOG_BACKFILL_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > AMEX_CATALOG_BACKFILL_MAX_LIMIT) {
    throw new Error(`Backfill limit must be between 1 and ${AMEX_CATALOG_BACKFILL_MAX_LIMIT}.`);
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
  const predefined = await executeCatalogKeyBackfill({
    cards: predefinedRecords,
    templates: templateCards,
    mode,
  });
  const user = await executeCatalogKeyBackfill({
    cards: userRecords,
    templates: templateCards,
    mode,
  });
  return {
    mode,
    limit,
    hasMore: { predefined: rawPredefined.length > limit, user: rawUser.length > limit },
    nextCursor: {
      predefined: rawPredefined.length > limit ? predefinedRecords[predefinedRecords.length - 1]?.id ?? null : null,
      user: rawUser.length > limit ? userRecords[userRecords.length - 1]?.id ?? null : null,
    },
    runtimeConflicts: { predefined: [], user: [] },
    predefined,
    user,
  };
}
