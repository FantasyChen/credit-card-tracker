import { americanExpressCardCatalog } from "@/lib/american-express-card-catalog";
import type { AmexProductKey } from "./contract";

interface CreditMatchRule {
  key: string;
  catalogAnchors: readonly string[];
  titleAliases: readonly string[];
}

interface CardMatchRule {
  catalogName: string;
  productAliases?: readonly string[];
  credits: readonly CreditMatchRule[];
}

export interface SupportedAmexCardCreditMatch {
  catalogCardName: string;
  productKey: AmexProductKey;
  creditKey: string;
}

const CARD_RULES: readonly CardMatchRule[] = [
  {
    catalogName: "American Express Gold Card",
    productAliases: ["The Gold Card from American Express"],
    credits: [
      credit("uber-cash", ["uber cash"]),
      credit("dining", ["dining credit"], ["dining credit", "grubhub credit"]),
      credit("dunkin", ["dunkin"], ["dunkin credit", "dunkin"]),
      credit("resy", ["resy"], ["resy dining credit", "resy credit", "resy"]),
    ],
  },
  {
    catalogName: "American Express Platinum Card",
    productAliases: ["The Platinum Card from American Express"],
    credits: [
      credit("airline-fee", ["airline fee credit", "airline fee"]),
      credit("uber-cash", ["uber cash"]),
      credit("saks", ["saks"], ["saks fifth avenue credit", "saks credit", "saks"]),
      credit("resy", ["resy"], ["resy dining credit", "resy credit", "resy"]),
      credit("lululemon", ["lululemon"]),
      credit(
        "fhr-thc-hotel",
        ["hotel credit", "fhr", "thc"],
        ["hotel credit", "fine hotels resorts credit", "the hotel collection credit", "fhr credit", "thc credit"],
      ),
      credit("digital-entertainment", ["digital entertainment"]),
      credit("uber-one", ["uber one"]),
      credit("oura-ring", ["oura"]),
      credit("walmart-plus", ["walmart plus"]),
    ],
  },
  {
    catalogName: "American Express Business Platinum Card",
    productAliases: ["The Business Platinum Card from American Express"],
    credits: [
      credit("airline-fee", ["airline fee credit", "airline fee"]),
      credit(
        "fhr-thc-hotel",
        ["hotel credit", "fhr", "thc"],
        ["hotel credit", "fine hotels resorts credit", "the hotel collection credit", "fhr credit", "thc credit"],
      ),
      credit("dell-technologies", ["dell"]),
      credit("adobe", ["adobe"]),
      credit("amex-travel-flight", ["amex travel flight"]),
      credit("one-ap", ["one ap"]),
      credit("hilton", ["hilton credit"]),
      credit("indeed", ["indeed"]),
      credit("wireless", ["wireless bill", "wireless credit"]),
    ],
  },
  {
    catalogName: "American Express Business Gold Card",
    productAliases: ["The Business Gold Card from American Express"],
    credits: [
      credit("flexible-business", ["flexible business"], ["flexible business credit", "business credit"]),
      credit("walmart-plus", ["walmart plus"]),
    ],
  },
  {
    catalogName: "Hilton Honors American Express Aspire Card",
    credits: [
      credit("flight", ["flight credit"]),
      credit("hilton-resort", ["hilton resort"]),
      credit("clear-plus", ["clear plus", "clear credit"]),
    ],
  },
  {
    catalogName: "Hilton Honors American Express Surpass Card",
    credits: [credit("hilton", ["hilton credit"])],
  },
  {
    catalogName: "Hilton Honors American Express Business Card",
    credits: [credit("hilton", ["hilton credit"])],
  },
  {
    catalogName: "Delta SkyMiles Gold American Express Card",
    credits: [
      credit("delta-flight", ["delta flight"]),
      credit("delta-stays", ["delta stays"]),
    ],
  },
  {
    catalogName: "Delta SkyMiles Platinum American Express Card",
    credits: [
      credit("delta-stays", ["delta stays"]),
      credit("resy", ["resy"]),
      credit("rideshare", ["rideshare"]),
    ],
  },
  {
    catalogName: "Delta SkyMiles Reserve American Express Card",
    credits: [
      credit("delta-stays", ["delta stays"]),
      credit("resy", ["resy"]),
      credit("rideshare", ["rideshare"]),
    ],
  },
  {
    catalogName: "Marriott Bonvoy Brilliant American Express Card",
    credits: [credit("dining", ["dining credit"])],
  },
  {
    catalogName: "Marriott Bonvoy Business American Express Card",
    credits: [],
  },
] as const;

function credit(
  key: string,
  catalogAnchors: readonly string[],
  titleAliases: readonly string[] = catalogAnchors,
): CreditMatchRule {
  return { key, catalogAnchors, titleAliases };
}

function normalizedWords(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

function productKeyForCatalogName(catalogName: string): AmexProductKey {
  return normalizedWords(catalogName).replace(/ /g, "-") as AmexProductKey;
}

function containsPhrase(value: string, phrase: string): boolean {
  return ` ${value} `.includes(` ${normalizedWords(phrase)} `);
}

const EXCLUDED_NON_CREDIT_TITLE_PHRASES = [
  "car rental loss and damage insurance",
  "cell phone protection",
  "free night",
  "global assist hotline",
  "global dining access",
  "lounge access",
  "priority pass",
  "purchase protection",
  "return protection",
  "elite status",
] as const;

function isExplicitlyUnsupportedTitle(normalizedTitle: string): boolean {
  return EXCLUDED_NON_CREDIT_TITLE_PHRASES.some((phrase) => containsPhrase(normalizedTitle, phrase));
}

function productAliases(rule: CardMatchRule): string[] {
  const withoutIssuer = rule.catalogName.replace(/\bAmerican Express\b/gi, "").replace(/\s+/g, " ").trim();
  return Array.from(new Set([
    rule.catalogName,
    withoutIssuer,
    ...(rule.productAliases ?? []),
  ].map(normalizedWords)));
}

const CATALOG_CARDS = new Map<string, (typeof americanExpressCardCatalog)[keyof typeof americanExpressCardCatalog]>(
  Object.values(americanExpressCardCatalog).map((card) => [card.name, card] as const),
);

const PRODUCT_RULES = new Map<string, CardMatchRule>();
for (const rule of CARD_RULES) {
  if (!CATALOG_CARDS.has(rule.catalogName)) continue;
  for (const alias of productAliases(rule)) {
    const existing = PRODUCT_RULES.get(alias);
    if (existing && existing.catalogName !== rule.catalogName) {
      PRODUCT_RULES.delete(alias);
      continue;
    }
    PRODUCT_RULES.set(alias, rule);
  }
}

function isRuleRepresented(rule: CardMatchRule, creditRule: CreditMatchRule): boolean {
  const card = CATALOG_CARDS.get(rule.catalogName);
  return Boolean(card?.benefits.some((benefit) => {
    if (benefit.maxAmount <= 0) return false;
    const description = normalizedWords(benefit.description);
    return creditRule.catalogAnchors.some((anchor) => containsPhrase(description, anchor));
  }));
}

export function matchSupportedAmexCardCredit(
  productName: string,
  benefitTitle: string,
): SupportedAmexCardCreditMatch | null {
  const cardRule = PRODUCT_RULES.get(normalizedWords(productName));
  if (!cardRule) return null;
  const normalizedTitle = normalizedWords(benefitTitle);
  if (!normalizedTitle || isExplicitlyUnsupportedTitle(normalizedTitle)) return null;

  const matches = cardRule.credits.flatMap((creditRule) => {
    if (!isRuleRepresented(cardRule, creditRule)) return [];
    const matchingAliases = creditRule.titleAliases
      .map(normalizedWords)
      .filter((alias) => containsPhrase(normalizedTitle, alias));
    if (!matchingAliases.length) return [];
    return [{
      rule: creditRule,
      specificity: Math.max(...matchingAliases.map((alias) => alias.length)),
    }];
  });
  const highestSpecificity = Math.max(...matches.map((match) => match.specificity));
  const mostSpecific = matches.filter((match) => match.specificity === highestSpecificity);
  if (mostSpecific.length !== 1) return null;
  const productKey = productKeyForCatalogName(cardRule.catalogName);
  return {
    catalogCardName: cardRule.catalogName,
    productKey,
    creditKey: `${productKey}:${mostSpecific[0].rule.key}`,
  };
}

export function matchSupportedAmexProduct(productName: string): {
  catalogCardName: string;
  productKey: AmexProductKey;
} | null {
  const rule = PRODUCT_RULES.get(normalizedWords(productName));
  return rule ? { catalogCardName: rule.catalogName, productKey: productKeyForCatalogName(rule.catalogName) } : null;
}

export function isSupportedAmexCatalogCard(productName: string): boolean {
  return PRODUCT_RULES.has(normalizedWords(productName));
}

export function retainSupportedAmexCardCredits<T extends { title: string }>(
  productName: string,
  benefits: T[],
): T[] {
  const retained = benefits.filter((benefit) =>
    matchSupportedAmexCardCredit(productName, benefit.title) !== null);
  return retained.length === benefits.length ? benefits : retained;
}
