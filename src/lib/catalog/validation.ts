import {
  AMEX_CATALOG_IDENTITY_REGISTRY,
  AMEX_PERIOD_KEYS,
  type AmexSourceSemantics,
} from "../amex-sync/catalog-registry";
import type { StaticPredefinedBenefit, StaticPredefinedCard } from "../static-catalog";

const CATALOG_KEY_PATTERN = /^(?:card|benefit):[a-z0-9]+(?:[a-z0-9-]*)(?::[a-z0-9]+(?:[a-z0-9-]*))*$/;
const POSITIONAL_KEY_SEGMENT_PATTERN = /^(?:benefit|card|item|row)?-?\d+$/;

interface AmexStaticBenefit extends StaticPredefinedBenefit {
  sourceSemantics?: AmexSourceSemantics;
  sourceCreditKey?: string | null;
}

function assertCatalogKey(key: unknown, kind: "card" | "benefit"): asserts key is string {
  if (typeof key !== "string" || !CATALOG_KEY_PATTERN.test(key) || !key.startsWith(`${kind}:`)) {
    throw new Error(`Invalid ${kind} catalog key: ${String(key)}.`);
  }
  const finalSegment = key.split(":").at(-1) ?? "";
  if (POSITIONAL_KEY_SEGMENT_PATTERN.test(finalSegment)) {
    throw new Error(`Catalog keys cannot use positional identity: ${key}.`);
  }
}

function tuple(productKey: string, creditFamilyKey: string, periodKey: string): string {
  return `${productKey}|${creditFamilyKey}|${periodKey}`;
}

export interface StaticCatalogValidationSummary {
  cards: number;
  benefits: number;
  amexCards: number;
  amexBenefits: number;
  amexWritableBenefits: number;
}

export function validateStaticCatalog(
  cards: readonly StaticPredefinedCard[],
): StaticCatalogValidationSummary {
  const allKeys = new Set<string>();
  const cardNames = new Set<string>();
  const productKeys = new Set<string>();
  const destinationTuples = new Set<string>();
  const registryProducts = new Map<string, {
    name: string;
    product: (typeof AMEX_CATALOG_IDENTITY_REGISTRY)[keyof typeof AMEX_CATALOG_IDENTITY_REGISTRY];
  }>(Object.entries(AMEX_CATALOG_IDENTITY_REGISTRY).map(([name, product]) => [product.catalogKey, { name, product }]));
  const seenRegistryProducts = new Set<string>();
  let benefitCount = 0;
  let amexCards = 0;
  let amexBenefits = 0;
  let amexWritableBenefits = 0;

  for (const card of cards) {
    assertCatalogKey(card.catalogKey, "card");
    if (allKeys.has(card.catalogKey)) throw new Error(`Duplicate catalog key: ${card.catalogKey}.`);
    allKeys.add(card.catalogKey);
    if (cardNames.has(card.name)) throw new Error(`Duplicate catalog card name: ${card.name}.`);
    cardNames.add(card.name);

    const registryEntry = registryProducts.get(card.catalogKey);
    const isAmex = card.issuer === "American Express";
    if (isAmex !== Boolean(registryEntry)) {
      throw new Error(`AMEX source/registry product mismatch for ${card.catalogKey}.`);
    }
    if (card.productKey !== undefined) {
      if (productKeys.has(card.productKey)) throw new Error(`Duplicate product key: ${card.productKey}.`);
      productKeys.add(card.productKey);
    }

    const registryBenefits = new Map(
      registryEntry?.product.benefits.map((benefit) => [benefit.catalogKey, benefit] as const) ?? [],
    );
    if (registryEntry) {
      amexCards += 1;
      seenRegistryProducts.add(card.catalogKey);
      if (registryEntry.name !== card.name || registryEntry.product.productKey !== card.productKey) {
        throw new Error(`AMEX source/registry product identity mismatch for ${card.catalogKey}.`);
      }
      if (registryBenefits.size !== registryEntry.product.benefits.length) {
        throw new Error(`Duplicate AMEX registry benefit key for ${card.catalogKey}.`);
      }
    }

    for (const rawBenefit of card.benefits) {
      const benefit = rawBenefit as AmexStaticBenefit;
      benefitCount += 1;
      assertCatalogKey(benefit.catalogKey, "benefit");
      if (allKeys.has(benefit.catalogKey)) throw new Error(`Duplicate catalog key: ${benefit.catalogKey}.`);
      allKeys.add(benefit.catalogKey);
      if (benefit.parentCatalogKey !== card.catalogKey) {
        throw new Error(`Catalog parent mismatch for ${benefit.catalogKey}.`);
      }

      const amexIdentityFields = [benefit.productKey, benefit.creditFamilyKey, benefit.periodKey];
      const populatedIdentityFields = amexIdentityFields.filter((value) => value !== undefined).length;
      if (populatedIdentityFields !== 0 && populatedIdentityFields !== amexIdentityFields.length) {
        throw new Error(`Partial AMEX identity for ${benefit.catalogKey}.`);
      }

      const registryBenefit = registryBenefits.get(benefit.catalogKey);
      if (isAmex) {
        amexBenefits += 1;
        if (!registryBenefit || populatedIdentityFields !== 3) {
          throw new Error(`AMEX source/registry benefit mismatch for ${benefit.catalogKey}.`);
        }
        registryBenefits.delete(benefit.catalogKey);
        if (
          registryBenefit.parentCatalogKey !== benefit.parentCatalogKey
          || registryBenefit.creditFamilyKey !== benefit.creditFamilyKey
          || registryBenefit.periodKey !== benefit.periodKey
          || registryBenefit.sourceSemantics !== benefit.sourceSemantics
          || registryBenefit.sourceCreditKey !== benefit.sourceCreditKey
          || card.productKey !== benefit.productKey
        ) {
          throw new Error(`AMEX source/registry tuple mismatch for ${benefit.catalogKey}.`);
        }
        if (!AMEX_PERIOD_KEYS.includes(benefit.periodKey as typeof AMEX_PERIOD_KEYS[number])) {
          throw new Error(`Unsupported AMEX period key for ${benefit.catalogKey}.`);
        }
        const destination = tuple(benefit.productKey!, benefit.creditFamilyKey!, benefit.periodKey!);
        if (destinationTuples.has(destination)) throw new Error(`Duplicate AMEX destination tuple: ${destination}.`);
        destinationTuples.add(destination);
        if (benefit.sourceSemantics === "usage") {
          if (!benefit.sourceCreditKey) throw new Error(`Writable AMEX benefit lacks a source key: ${benefit.catalogKey}.`);
          amexWritableBenefits += 1;
        } else if (benefit.sourceCreditKey !== null) {
          throw new Error(`Non-usage AMEX benefit has source authority: ${benefit.catalogKey}.`);
        }
      } else if (registryBenefit || populatedIdentityFields !== 0 || benefit.sourceSemantics !== undefined || benefit.sourceCreditKey !== undefined) {
        throw new Error(`Non-AMEX benefit has provider identity: ${benefit.catalogKey}.`);
      }
    }

    if (registryBenefits.size !== 0) {
      throw new Error(`AMEX registry contains benefits missing from ${card.catalogKey}.`);
    }
  }

  if (seenRegistryProducts.size !== registryProducts.size) {
    throw new Error("AMEX registry contains products missing from the static catalog.");
  }
  if (amexCards !== 12 || amexBenefits !== 56 || amexWritableBenefits !== 47) {
    throw new Error(`AMEX catalog invariant failed: ${amexCards} products, ${amexBenefits} benefits, ${amexWritableBenefits} writable.`);
  }

  return {
    cards: cards.length,
    benefits: benefitCount,
    amexCards,
    amexBenefits,
    amexWritableBenefits,
  };
}
