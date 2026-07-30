import type { StaticPredefinedBenefit, StaticPredefinedCard } from "../static-catalog";
import { validateStaticCatalog } from "./validation";

export interface StoredCatalogCard {
  id: string;
  catalogKey: string | null;
  name: string;
  issuer: string;
  annualFee: number;
  imageUrl: string | null;
  productKey: string | null;
  retiredAt: Date | null;
  updatedAt: Date;
}

export interface StoredCatalogBenefit {
  id: string;
  catalogKey: string | null;
  predefinedCardId: string;
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
  retiredAt: Date | null;
  updatedAt: Date;
}

export interface CatalogSnapshot {
  cards: StoredCatalogCard[];
  benefits: StoredCatalogBenefit[];
}

export type CatalogActionKind = "create" | "adopt" | "update" | "retire" | "unchanged";

export interface CatalogCardAction {
  kind: CatalogActionKind;
  source: StaticPredefinedCard | null;
  existing: StoredCatalogCard | null;
}

export interface CatalogBenefitAction {
  kind: CatalogActionKind;
  source: StaticPredefinedBenefit | null;
  existing: StoredCatalogBenefit | null;
  parentCatalogKey: string;
}

export interface CatalogSyncPlan {
  cards: CatalogCardAction[];
  benefits: CatalogBenefitAction[];
  conflicts: string[];
}

const cardCanonicalFields = ["name", "issuer", "annualFee", "imageUrl"] as const;
const cardProviderIdentityFields = ["productKey"] as const;
const cardMutableFields = [...cardCanonicalFields, ...cardProviderIdentityFields] as const;
const benefitCanonicalFields = [
  "category",
  "description",
  "percentage",
  "maxAmount",
  "frequency",
  "cycleAlignment",
  "fixedCycleStartMonth",
  "fixedCycleDurationMonths",
  "occurrencesInCycle",
] as const;
const benefitProviderIdentityFields = ["productKey", "creditFamilyKey", "periodKey"] as const;
const benefitMutableFields = [...benefitCanonicalFields, ...benefitProviderIdentityFields] as const;

function sourceCardValue(card: StaticPredefinedCard, field: typeof cardMutableFields[number]): unknown {
  if (field === "productKey") return card.productKey ?? null;
  return card[field];
}

function sourceBenefitValue(benefit: StaticPredefinedBenefit, field: typeof benefitMutableFields[number]): unknown {
  if (field === "maxAmount") return benefit.maxAmount ?? null;
  if (field === "cycleAlignment") return benefit.cycleAlignment ?? "CARD_ANNIVERSARY";
  if (field === "occurrencesInCycle") return benefit.occurrencesInCycle ?? 1;
  if (field === "productKey" || field === "creditFamilyKey" || field === "periodKey") return benefit[field] ?? null;
  if (field === "fixedCycleStartMonth" || field === "fixedCycleDurationMonths") return benefit[field] ?? null;
  return benefit[field];
}

function cardMatches(existing: StoredCatalogCard, source: StaticPredefinedCard): boolean {
  return cardMutableFields.every((field) => existing[field] === sourceCardValue(source, field));
}

function cardAdoptionMatches(existing: StoredCatalogCard, source: StaticPredefinedCard): boolean {
  if (!cardCanonicalFields.every((field) => existing[field] === sourceCardValue(source, field))) {
    return false;
  }

  const hasNoStoredProviderIdentity = cardProviderIdentityFields.every(
    (field) => existing[field] === null,
  );
  return hasNoStoredProviderIdentity
    || cardProviderIdentityFields.every((field) => existing[field] === sourceCardValue(source, field));
}

function benefitMatches(existing: StoredCatalogBenefit, source: StaticPredefinedBenefit): boolean {
  return benefitMutableFields.every((field) => existing[field] === sourceBenefitValue(source, field));
}

function benefitAdoptionMatches(existing: StoredCatalogBenefit, source: StaticPredefinedBenefit): boolean {
  if (!benefitCanonicalFields.every((field) => existing[field] === sourceBenefitValue(source, field))) {
    return false;
  }

  const hasNoStoredProviderIdentity = benefitProviderIdentityFields.every((field) => existing[field] === null);
  return hasNoStoredProviderIdentity
    || benefitProviderIdentityFields.every((field) => existing[field] === sourceBenefitValue(source, field));
}

function uniqueByKey<T extends { catalogKey: string | null }>(
  records: readonly T[],
  kind: "card" | "benefit",
  conflicts: string[],
): Map<string, T> {
  const keyed = new Map<string, T>();
  for (const record of records) {
    if (!record.catalogKey) continue;
    if (keyed.has(record.catalogKey)) conflicts.push(`duplicate_${kind}_key:${record.catalogKey}`);
    else keyed.set(record.catalogKey, record);
  }
  return keyed;
}

export function planCatalogSynchronization(input: {
  source: readonly StaticPredefinedCard[];
  snapshot: CatalogSnapshot;
}): CatalogSyncPlan {
  validateStaticCatalog(input.source);
  const conflicts: string[] = [];
  const keyedCards = uniqueByKey(input.snapshot.cards, "card", conflicts);
  const keyedBenefits = uniqueByKey(input.snapshot.benefits, "benefit", conflicts);
  const sourceCardKeys = new Set(input.source.map((card) => card.catalogKey));
  const sourceBenefitKeys = new Set(input.source.flatMap((card) => card.benefits.map((benefit) => benefit.catalogKey)));
  const claimedCards = new Set<string>();
  const claimedBenefits = new Set<string>();
  const cards: CatalogCardAction[] = [];
  const benefits: CatalogBenefitAction[] = [];
  const cardIdByCatalogKey = new Map<string, string>();

  for (const source of input.source) {
    let existing = keyedCards.get(source.catalogKey) ?? null;
    let kind: CatalogActionKind;
    if (existing) {
      kind = cardMatches(existing, source) && existing.retiredAt === null ? "unchanged" : "update";
    } else {
      const legacy = input.snapshot.cards.filter((candidate) =>
        candidate.catalogKey === null
        && cardAdoptionMatches(candidate, source)
        && !claimedCards.has(candidate.id));
      const sourceMatchIsUnique = legacy.every((candidate) =>
        input.source.filter((candidateSource) => cardAdoptionMatches(candidate, candidateSource)).length === 1);
      if (legacy.length > 1 || !sourceMatchIsUnique) {
        conflicts.push(`ambiguous_unkeyed_card:${source.catalogKey}`);
      }
      existing = legacy.length === 1 && sourceMatchIsUnique ? legacy[0] : null;
      kind = existing ? "adopt" : "create";
    }
    if (existing) {
      claimedCards.add(existing.id);
      cardIdByCatalogKey.set(source.catalogKey, existing.id);
    }
    cards.push({ kind, source, existing });
  }

  for (const sourceCard of input.source) {
    const parentId = cardIdByCatalogKey.get(sourceCard.catalogKey);
    for (const source of sourceCard.benefits) {
      let existing = keyedBenefits.get(source.catalogKey) ?? null;
      let kind: CatalogActionKind;
      if (existing) {
        if (!parentId || existing.predefinedCardId !== parentId) {
          conflicts.push(`benefit_parent_conflict:${source.catalogKey}`);
        }
        kind = benefitMatches(existing, source) && existing.retiredAt === null ? "unchanged" : "update";
      } else if (parentId) {
        const legacy = input.snapshot.benefits.filter((candidate) =>
          candidate.catalogKey === null
          && candidate.predefinedCardId === parentId
          && benefitAdoptionMatches(candidate, source)
          && !claimedBenefits.has(candidate.id));
        const sourceMatchIsUnique = legacy.every((candidate) =>
          sourceCard.benefits.filter((candidateSource) => benefitAdoptionMatches(candidate, candidateSource)).length === 1);
        if (legacy.length > 1 || !sourceMatchIsUnique) {
          conflicts.push(`ambiguous_unkeyed_benefit:${source.catalogKey}`);
        }
        existing = legacy.length === 1 && sourceMatchIsUnique ? legacy[0] : null;
        kind = existing ? "adopt" : "create";
      } else {
        kind = "create";
      }
      if (existing) claimedBenefits.add(existing.id);
      benefits.push({ kind, source, existing, parentCatalogKey: sourceCard.catalogKey });
    }
  }

  for (const existing of input.snapshot.benefits) {
    if (existing.catalogKey && !sourceBenefitKeys.has(existing.catalogKey)) {
      benefits.push({ kind: existing.retiredAt ? "unchanged" : "retire", source: null, existing, parentCatalogKey: "" });
    } else if (!existing.catalogKey && !claimedBenefits.has(existing.id)) {
      conflicts.push(`unmatched_unkeyed_benefit:${existing.id}`);
    }
  }
  for (const existing of input.snapshot.cards) {
    if (existing.catalogKey && !sourceCardKeys.has(existing.catalogKey)) {
      cards.push({ kind: existing.retiredAt ? "unchanged" : "retire", source: null, existing });
    } else if (!existing.catalogKey && !claimedCards.has(existing.id)) {
      conflicts.push(`unmatched_unkeyed_card:${existing.id}`);
    }
  }

  return { cards, benefits, conflicts: Array.from(new Set(conflicts)).sort() };
}

export interface CatalogSyncCounts {
  create: number;
  adopt: number;
  update: number;
  retire: number;
  unchanged: number;
}

function countActions(actions: readonly { kind: CatalogActionKind }[]): CatalogSyncCounts {
  return actions.reduce<CatalogSyncCounts>((counts, action) => {
    counts[action.kind] += 1;
    return counts;
  }, { create: 0, adopt: 0, update: 0, retire: 0, unchanged: 0 });
}

export function summarizeCatalogSyncPlan(plan: CatalogSyncPlan): {
  cards: CatalogSyncCounts;
  benefits: CatalogSyncCounts;
  conflictCount: number;
} {
  return {
    cards: countActions(plan.cards),
    benefits: countActions(plan.benefits),
    conflictCount: plan.conflicts.length,
  };
}
