export type CatalogBackfillConflictReason =
  | "card_template_missing"
  | "card_template_ambiguous"
  | "card_key_conflict"
  | "benefit_template_missing"
  | "benefit_template_ambiguous"
  | "benefit_key_conflict"
  | "duplicate_destination_key";

export interface CatalogBackfillBenefitShape {
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

export interface CatalogBackfillCardShape {
  id: string;
  name: string;
  issuer: string;
  productKey: string | null;
  benefits: CatalogBackfillBenefitShape[];
}

export type CatalogBackfillTemplateBenefitShape = Omit<CatalogBackfillBenefitShape, "id">;

export interface CatalogBackfillTemplateCardShape {
  name: string;
  issuer: string;
  productKey?: string;
  benefits: CatalogBackfillTemplateBenefitShape[];
}

export interface CatalogBackfillProposal {
  cardId: string;
  productKey: string;
  benefits: Array<{
    benefitId: string;
    productKey: string;
    creditFamilyKey: string;
    periodKey: string;
  }>;
}

export interface CatalogBackfillDryRun {
  proposals: CatalogBackfillProposal[];
  counts: {
    cardsExamined: number;
    cardsProposed: number;
    benefitsExamined: number;
    benefitsProposed: number;
    conflicts: number;
  };
  conflicts: Array<{ cardId: string; benefitId: string | null; reason: CatalogBackfillConflictReason }>;
}

function sameNullable(left: unknown, right: unknown): boolean {
  return (left ?? null) === (right ?? null);
}

function sameBenefitShape(
  record: CatalogBackfillBenefitShape,
  template: CatalogBackfillTemplateBenefitShape,
): boolean {
  return record.category === template.category
    && record.description === template.description
    && record.percentage === template.percentage
    && sameNullable(record.maxAmount, template.maxAmount)
    && record.frequency === template.frequency
    && sameNullable(record.cycleAlignment, template.cycleAlignment)
    && sameNullable(record.fixedCycleStartMonth, template.fixedCycleStartMonth)
    && sameNullable(record.fixedCycleDurationMonths, template.fixedCycleDurationMonths)
    && record.occurrencesInCycle === template.occurrencesInCycle;
}

function templateHasWritableKeys(template: CatalogBackfillTemplateBenefitShape): template is CatalogBackfillTemplateBenefitShape & {
  productKey: string;
  creditFamilyKey: string;
  periodKey: string;
} {
  return Boolean(template.productKey && template.creditFamilyKey && template.periodKey);
}

function conflictsWith(existing: string | null, expected: string): boolean {
  return existing !== null && existing !== expected;
}

/**
 * Produces a deterministic, write-free backfill proposal. Runtime sync never uses
 * this classifier: unresolved records retain null keys and remain unwritable.
 */
export function classifyCatalogKeyBackfill(
  cards: CatalogBackfillCardShape[],
  templates: CatalogBackfillTemplateCardShape[],
): CatalogBackfillDryRun {
  const conflicts: CatalogBackfillDryRun["conflicts"] = [];
  const proposals: CatalogBackfillProposal[] = [];
  let benefitsExamined = 0;
  let benefitsProposed = 0;

  for (const card of [...cards].sort((left, right) => left.id.localeCompare(right.id))) {
    benefitsExamined += card.benefits.length;
    const cardTemplates = templates.filter((template) =>
      template.name === card.name && template.issuer === card.issuer && template.productKey);
    if (cardTemplates.length !== 1) {
      conflicts.push({
        cardId: card.id,
        benefitId: null,
        reason: cardTemplates.length ? "card_template_ambiguous" : "card_template_missing",
      });
      continue;
    }
    const template = cardTemplates[0];
    const productKey = template.productKey as string;
    if (conflictsWith(card.productKey, productKey)) {
      conflicts.push({ cardId: card.id, benefitId: null, reason: "card_key_conflict" });
      continue;
    }

    const proposedBenefits: CatalogBackfillProposal["benefits"] = [];
    const candidates = card.benefits.map((benefit) => ({
      benefit,
      templates: template.benefits.filter((candidate) => templateHasWritableKeys(candidate) && sameBenefitShape(benefit, candidate)),
    }));
    const destinationCounts = new Map<string, number>();
    for (const candidate of candidates) {
      if (candidate.templates.length === 1) {
        const match = candidate.templates[0];
        const key = `${match.productKey}:${match.creditFamilyKey}:${match.periodKey}`;
        destinationCounts.set(key, (destinationCounts.get(key) ?? 0) + 1);
      }
    }

    for (const { benefit, templates: benefitTemplates } of candidates) {
      if (benefitTemplates.length !== 1) {
        conflicts.push({
          cardId: card.id,
          benefitId: benefit.id,
          reason: benefitTemplates.length ? "benefit_template_ambiguous" : "benefit_template_missing",
        });
        continue;
      }
      const match = benefitTemplates[0] as CatalogBackfillTemplateBenefitShape & {
        productKey: string;
        creditFamilyKey: string;
        periodKey: string;
      };
      const destinationKey = `${match.productKey}:${match.creditFamilyKey}:${match.periodKey}`;
      if ((destinationCounts.get(destinationKey) ?? 0) !== 1) {
        conflicts.push({ cardId: card.id, benefitId: benefit.id, reason: "duplicate_destination_key" });
        continue;
      }
      if (conflictsWith(benefit.productKey, match.productKey)
        || conflictsWith(benefit.creditFamilyKey, match.creditFamilyKey)
        || conflictsWith(benefit.periodKey, match.periodKey)) {
        conflicts.push({ cardId: card.id, benefitId: benefit.id, reason: "benefit_key_conflict" });
        continue;
      }
      if (benefit.productKey !== null && benefit.creditFamilyKey !== null && benefit.periodKey !== null) continue;
      proposedBenefits.push({
        benefitId: benefit.id,
        productKey: match.productKey,
        creditFamilyKey: match.creditFamilyKey,
        periodKey: match.periodKey,
      });
      benefitsProposed += 1;
    }
    if (proposedBenefits.length || card.productKey === null) {
      proposals.push({ cardId: card.id, productKey, benefits: proposedBenefits });
    }
  }

  return {
    proposals,
    counts: {
      cardsExamined: cards.length,
      cardsProposed: proposals.length,
      benefitsExamined,
      benefitsProposed,
      conflicts: conflicts.length,
    },
    conflicts,
  };
}

export const AMEX_CATALOG_BACKFILL_SUPERSEDED_ERROR =
  "AMEX catalog key apply is superseded by global catalog migration; no user-row keys were written." as const;

export interface CatalogBackfillExecutionReport extends CatalogBackfillDryRun {
  mode: "dry-run";
  applied: { cards: 0; benefits: 0; statusesMaterialized: 0 };
}

/**
 * Retains the historical exact classifier as a write-free review aid. The
 * former per-user apply boundary is permanently closed; global definitions and
 * the separately gated legacy migration now own catalog identity.
 */
export async function executeCatalogKeyBackfill(input: {
  cards: CatalogBackfillCardShape[];
  templates: CatalogBackfillTemplateCardShape[];
  mode?: "dry-run" | "apply";
}): Promise<CatalogBackfillExecutionReport> {
  const mode = input.mode ?? "dry-run";
  if (mode === "apply") throw new Error(AMEX_CATALOG_BACKFILL_SUPERSEDED_ERROR);

  const dryRun = classifyCatalogKeyBackfill(input.cards, input.templates);
  return {
    ...dryRun,
    mode: "dry-run",
    applied: { cards: 0, benefits: 0, statusesMaterialized: 0 },
  };
}
