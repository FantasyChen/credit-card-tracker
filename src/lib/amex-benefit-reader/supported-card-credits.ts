import { americanExpressCardCatalog } from "@/lib/american-express-card-catalog";
import {
  AMEX_CATALOG_IDENTITY_REGISTRY,
  type AmexCatalogCardName,
} from "@/lib/amex-catalog/catalog-registry";
import { normalizeAmexSelectionText } from "@/lib/amex-catalog/normalization";
import type { AmexPeriodKey } from "@/lib/amex-catalog/catalog-registry";
import {
  evidenceSatisfiesAmexPolicy,
  GENERIC_FORBIDDEN_AMEX_CREDIT_TOKEN_GROUPS,
  titleSatisfiesAmexPolicy,
  type AmexSourceCreditEvidence,
  type AmexSourceCreditPolicy,
} from "@/lib/amex-catalog/source-credit-policy";

function containsPhrase(value: string, phrase: string): boolean {
  return ` ${value} `.includes(` ${normalizeAmexSelectionText(phrase)} `);
}

const EXCLUDED_NON_CREDIT_TITLE_PHRASES = [
  "access",
  "car rental loss and damage insurance",
  "cell phone protection",
  "free night",
  "global assist hotline",
  "insurance",
  "lounge access",
  "priority pass",
  "protection",
  "status",
] as const;

const REVIEWED_IGNORED_CATALOG_TITLES = new Set([
  normalizeAmexSelectionText("35% Airline Bonus"),
  normalizeAmexSelectionText("Link Your Resy Profile"),
]);

export function isIgnoredAmexCatalogBenefitTitle(title: string): boolean {
  return REVIEWED_IGNORED_CATALOG_TITLES.has(normalizeAmexSelectionText(title));
}

function isExplicitlyUnsupportedTitle(normalizedTitle: string): boolean {
  return REVIEWED_IGNORED_CATALOG_TITLES.has(normalizedTitle)
    || EXCLUDED_NON_CREDIT_TITLE_PHRASES.some((phrase) => containsPhrase(normalizedTitle, phrase));
}

export function isEligibleLocalAmexUsageTitle(title: string): boolean {
  const normalized = normalizeAmexSelectionText(title);
  return normalized.length > 0 && !isExplicitlyUnsupportedTitle(normalized);
}

export interface AmexProductMatch {
  productKey: string;
  confidence: "exact" | "fuzzy";
  score: number;
}

export type AmexProductResolution =
  | { disposition: "matched"; match: AmexProductMatch }
  | { disposition: "low_confidence" | "ambiguous" | "hard_conflict"; match: null };

export const AMEX_BROWSER_PRODUCT_MATCH_MIN_SCORE = 0.88;
export const AMEX_BROWSER_PRODUCT_MATCH_MIN_MARGIN = 0.10;

export function evaluateAmexBrowserProductScores(
  bestScore: number,
  runnerUpScore: number,
): "accepted" | "low_confidence" | "ambiguous" {
  if (bestScore < AMEX_BROWSER_PRODUCT_MATCH_MIN_SCORE) return "low_confidence";
  if (bestScore - runnerUpScore + Number.EPSILON < AMEX_BROWSER_PRODUCT_MATCH_MIN_MARGIN) return "ambiguous";
  return "accepted";
}
const PRODUCT_NOISE = new Set(["american", "express", "card", "the", "from"]);
const COBRANDS = ["hilton", "delta", "marriott"] as const;
const TIERS = ["gold", "platinum", "reserve", "aspire", "surpass", "brilliant"] as const;

function tokens(value: string, noise = PRODUCT_NOISE): Set<string> {
  return new Set(normalizeAmexSelectionText(value).split(" ").filter((token) => token && !noise.has(token)));
}

function weightedTokenScore(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  const union = new Set([...Array.from(a), ...Array.from(b)]);
  if (!union.size) return 0;
  let shared = 0;
  union.forEach((token) => { if (a.has(token) && b.has(token)) shared += 1; });
  return shared / union.size;
}

function hasHardProductConflict(source: string, candidate: string, affiliation = false): boolean {
  if (affiliation) return false;
  const sourceTokens = tokens(source, new Set());
  const candidateTokens = tokens(candidate, new Set());
  if (sourceTokens.has("business") !== candidateTokens.has("business")) return true;
  const sourceCobrand = COBRANDS.find((token) => sourceTokens.has(token));
  const candidateCobrand = COBRANDS.find((token) => candidateTokens.has(token));
  if (sourceCobrand !== candidateCobrand) return true;
  const sourceTier = TIERS.find((token) => sourceTokens.has(token));
  const candidateTier = TIERS.find((token) => candidateTokens.has(token));
  return Boolean(sourceTier && candidateTier && sourceTier !== candidateTier);
}

export function resolveAmexBrowserProduct(productName: string): AmexProductResolution {
  const normalized = normalizeAmexSelectionText(productName);
  const products = Object.entries(AMEX_CATALOG_IDENTITY_REGISTRY);
  for (const [, descriptor] of products) {
    const exactAliases = [...descriptor.exactAliases, ...("affiliationAliases" in descriptor ? descriptor.affiliationAliases : [])];
    if (exactAliases.some((alias) => normalizeAmexSelectionText(alias) === normalized)) {
      return { disposition: "matched", match: { productKey: descriptor.productKey, confidence: "exact", score: 1 } };
    }
  }

  const candidates = products.flatMap(([name, descriptor]) => {
    const hardConflict = hasHardProductConflict(productName, name);
    return hardConflict ? [] : [{ productKey: descriptor.productKey, score: weightedTokenScore(productName, name) }];
  }).sort((left, right) => right.score - left.score || left.productKey.localeCompare(right.productKey));
  if (!candidates.length) return { disposition: "hard_conflict", match: null };
  const best = candidates[0];
  const runnerUp = candidates[1]?.score ?? 0;
  const scoreDisposition = evaluateAmexBrowserProductScores(best.score, runnerUp);
  if (scoreDisposition !== "accepted") return { disposition: scoreDisposition, match: null };
  return { disposition: "matched", match: { ...best, confidence: "fuzzy" } };
}

export interface AmexBrowserSyncMatch {
  productKey: string;
  creditFamilyKey: string;
  sourceCreditKey: string;
}

const REVIEWED_SOURCE_ALIASES: Record<string, readonly string[]> = {
  "american-express-platinum-card:resy": ["Resy Credit", "Resy Dining Credit", "$400 Resy Credit"],
  "american-express-platinum-card:lululemon": ["lululemon Credit", "$300 lululemon Credit"],
  "american-express-platinum-card:airline-fee": ["$200 Airline Fee Credit", "Airline Fee Credit"],
  "american-express-platinum-card:uber-cash": ["Uber Cash"],
  "american-express-platinum-card:saks": ["Saks Fifth Avenue Credit"],
  "american-express-platinum-card:hotel": ["Hotel Credit"],
  "american-express-platinum-card:digital-entertainment": ["Digital Entertainment Credit"],
  "american-express-platinum-card:walmart-plus": ["Walmart+ Credit"],
  "american-express-business-platinum-card:dell": ["Dell Technologies Credit"],
  "hilton-honors-american-express-aspire-card:hilton-resort": ["Hilton Resort Statement Credit"],
};

const SOURCE_REQUIRED_TOKEN_OVERRIDES: Record<string, readonly (readonly string[])[]> = {
  "american-express-gold-card:dining": [["dining", "grubhub"]],
  "american-express-business-gold-card:flexible-business": [["flexible", "fedex", "grubhub", "office"], ["business", "credit"]],
  "american-express-platinum-card:hotel": [["hotel", "fhr", "thc"]],
  "american-express-business-platinum-card:hotel": [["hotel", "fhr", "thc"]],
  "american-express-business-platinum-card:wireless": [["wireless", "phone"]],
};

const SOURCE_FORBIDDEN_TOKEN_OVERRIDES: Record<string, readonly (readonly string[])[]> = {
  "american-express-platinum-card:airline-fee": [["airline", "bonus"]],
  "american-express-platinum-card:uber-cash": [["uber", "one"], ["membership"]],
  "american-express-platinum-card:uber-one": [["uber", "cash"]],
  "american-express-platinum-card:resy": [["global", "dining", "access"]],
  "hilton-honors-american-express-aspire-card:flight": [["spend"], ["bonus"]],
};

function defaultRequiredTokenGroups(sourceCreditKey: string): readonly (readonly string[])[] {
  const family = sourceCreditKey.slice(sourceCreditKey.lastIndexOf(":") + 1);
  return family.split("-").map((token) => [token]);
}

export const BROWSER_AMEX_SOURCE_CREDIT_DESCRIPTORS: readonly AmexSourceCreditPolicy[] = (() => {
  const grouped = new Map<string, {
    productKey: string;
    sourceCreditKey: string;
    creditFamilyKey: string;
    aliases: Set<string>;
    periods: Set<AmexPeriodKey>;
  }>();
  for (const [cardName, product] of Object.entries(AMEX_CATALOG_IDENTITY_REGISTRY)) {
    const card = americanExpressCardCatalog[cardName as AmexCatalogCardName];
    product.benefits.forEach((identity, index) => {
      if (identity.sourceSemantics !== "usage" || !identity.sourceCreditKey) return;
      const existing = grouped.get(identity.sourceCreditKey) ?? {
        productKey: product.productKey,
        sourceCreditKey: identity.sourceCreditKey,
        creditFamilyKey: identity.sourceCreditKey,
        aliases: new Set<string>(),
        periods: new Set<AmexPeriodKey>(),
      };
      existing.aliases.add(card.benefits[index].description);
      (REVIEWED_SOURCE_ALIASES[identity.sourceCreditKey] ?? []).forEach((alias) => existing.aliases.add(alias));
      existing.periods.add(identity.periodKey);
      grouped.set(identity.sourceCreditKey, existing);
    });
  }
  return Array.from(grouped.values()).map((descriptor) => ({
    productKey: descriptor.productKey,
    sourceCreditKey: descriptor.sourceCreditKey,
    creditFamilyKey: descriptor.creditFamilyKey,
    exactAliases: Array.from(descriptor.aliases),
    requiredTokenGroups: SOURCE_REQUIRED_TOKEN_OVERRIDES[descriptor.sourceCreditKey]
      ?? defaultRequiredTokenGroups(descriptor.sourceCreditKey),
    forbiddenTokenGroups: [
      ...GENERIC_FORBIDDEN_AMEX_CREDIT_TOKEN_GROUPS,
      ...(SOURCE_FORBIDDEN_TOKEN_OVERRIDES[descriptor.sourceCreditKey] ?? []),
    ],
    compatiblePeriodKeys: Array.from(descriptor.periods),
    amountConstraint: {
      currency: "USD",
      minimumUsd: 0,
      ...(descriptor.sourceCreditKey === "american-express-platinum-card:uber-cash"
        ? { maximumUsd: 35 }
        : {}),
    },
  }));
})();

/**
 * Browser projection resolves a benefit only after product resolution. Exact
 * reviewed aliases win; catalog-derived core-token matching must have one unique
 * candidate. Amount, ending digits, and product resemblance never decide it.
 */
export function matchAmexBrowserSyncCredit(
  productName: string,
  trackerTitle: string,
  evidence: AmexSourceCreditEvidence = {},
): AmexBrowserSyncMatch | null {
  const product = resolveAmexBrowserProduct(productName);
  if (product.disposition !== "matched") return null;
  const normalizedTitle = normalizeAmexSelectionText(trackerTitle);
  const candidates = BROWSER_AMEX_SOURCE_CREDIT_DESCRIPTORS
    .filter((descriptor) => descriptor.productKey === product.match.productKey
      && titleSatisfiesAmexPolicy(descriptor, trackerTitle)
      && evidenceSatisfiesAmexPolicy(descriptor, evidence));
  const exact = candidates.filter((descriptor) => descriptor.exactAliases
    .some((alias) => normalizeAmexSelectionText(alias) === normalizedTitle));
  const resolved = exact.length === 1
    ? exact[0]
    : exact.length > 1 || candidates.length !== 1 ? null : candidates[0];
  if (!resolved) return null;
  return {
    productKey: product.match.productKey,
    creditFamilyKey: resolved.creditFamilyKey,
    sourceCreditKey: resolved.sourceCreditKey,
  };
}
