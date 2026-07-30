export const AMEX_PERIOD_KEYS = [
  "calendar-month",
  "calendar-month-december",
  "calendar-quarter",
  "calendar-quarter-q1",
  "calendar-quarter-q2",
  "calendar-quarter-q3",
  "calendar-quarter-q4",
  "calendar-half-h1",
  "calendar-half-h2",
  "calendar-year",
  "card-anniversary-quarter",
  "card-anniversary-year",
] as const;

export type AmexPeriodKey = typeof AMEX_PERIOD_KEYS[number];
export type AmexSourceSemantics = "usage" | "spend" | "certificate" | "status_or_access";

export interface AmexCatalogBenefitIdentity {
  catalogKey: string;
  parentCatalogKey: string;
  creditFamilyKey: string;
  periodKey: AmexPeriodKey;
  sourceSemantics: AmexSourceSemantics;
  sourceCreditKey: string | null;
}

export interface AmexCatalogProductIdentity {
  catalogKey: string;
  productKey: string;
  exactAliases: readonly string[];
  affiliationAliases?: readonly string[];
  benefits: readonly AmexCatalogBenefitIdentity[];
}

const usage = (
  catalogKey: string,
  parentCatalogKey: string,
  family: string,
  periodKey: AmexPeriodKey,
  sourceCreditKey = family,
): AmexCatalogBenefitIdentity => ({
  catalogKey,
  parentCatalogKey,
  creditFamilyKey: family,
  periodKey,
  sourceSemantics: "usage",
  sourceCreditKey,
});
const excluded = (
  catalogKey: string,
  parentCatalogKey: string,
  family: string,
  periodKey: AmexPeriodKey,
  sourceSemantics: Exclude<AmexSourceSemantics, "usage">,
): AmexCatalogBenefitIdentity => ({
  catalogKey,
  parentCatalogKey,
  creditFamilyKey: family,
  periodKey,
  sourceSemantics,
  sourceCreditKey: null,
});

export const AMEX_CATALOG_IDENTITY_REGISTRY = {
  "American Express Gold Card": {
    catalogKey: "card:american-express-gold-card",
    productKey: "american-express-gold-card",
    exactAliases: ["American Express Gold Card", "American Express Gold Card®", "Amex Gold Card"],
    benefits: [
      usage("benefit:american-express-gold-card:uber-cash:calendar-month", "card:american-express-gold-card", "american-express-gold-card:uber-cash", "calendar-month"),
      usage("benefit:american-express-gold-card:dining:calendar-month", "card:american-express-gold-card", "american-express-gold-card:dining", "calendar-month"),
      usage("benefit:american-express-gold-card:dunkin:calendar-month", "card:american-express-gold-card", "american-express-gold-card:dunkin", "calendar-month"),
      usage("benefit:american-express-gold-card:resy:calendar-half-h1", "card:american-express-gold-card", "american-express-gold-card:resy", "calendar-half-h1"),
      usage("benefit:american-express-gold-card:resy:calendar-half-h2", "card:american-express-gold-card", "american-express-gold-card:resy", "calendar-half-h2"),
    ],
  },
  "American Express Platinum Card": {
    catalogKey: "card:american-express-platinum-card",
    productKey: "american-express-platinum-card",
    exactAliases: ["American Express Platinum Card", "The Platinum Card from American Express", "Platinum Card®"],
    affiliationAliases: ["Morgan Stanley Platinum", "The Platinum Card from American Express Exclusively for Morgan Stanley"],
    benefits: [
      usage("benefit:american-express-platinum-card:airline-fee:calendar-year", "card:american-express-platinum-card", "american-express-platinum-card:airline-fee", "calendar-year"),
      usage("benefit:american-express-platinum-card:uber-cash:calendar-month", "card:american-express-platinum-card", "american-express-platinum-card:uber-cash", "calendar-month"),
      usage("benefit:american-express-platinum-card:uber-cash-december-bonus:calendar-month-december", "card:american-express-platinum-card", "american-express-platinum-card:uber-cash-december-bonus", "calendar-month-december", "american-express-platinum-card:uber-cash"),
      usage("benefit:american-express-platinum-card:saks:calendar-half-h1", "card:american-express-platinum-card", "american-express-platinum-card:saks", "calendar-half-h1"),
      usage("benefit:american-express-platinum-card:saks:calendar-half-h2", "card:american-express-platinum-card", "american-express-platinum-card:saks", "calendar-half-h2"),
      usage("benefit:american-express-platinum-card:resy:calendar-quarter-q1", "card:american-express-platinum-card", "american-express-platinum-card:resy", "calendar-quarter-q1"),
      usage("benefit:american-express-platinum-card:resy:calendar-quarter-q2", "card:american-express-platinum-card", "american-express-platinum-card:resy", "calendar-quarter-q2"),
      usage("benefit:american-express-platinum-card:resy:calendar-quarter-q3", "card:american-express-platinum-card", "american-express-platinum-card:resy", "calendar-quarter-q3"),
      usage("benefit:american-express-platinum-card:resy:calendar-quarter-q4", "card:american-express-platinum-card", "american-express-platinum-card:resy", "calendar-quarter-q4"),
      usage("benefit:american-express-platinum-card:lululemon:calendar-quarter-q1", "card:american-express-platinum-card", "american-express-platinum-card:lululemon", "calendar-quarter-q1"),
      usage("benefit:american-express-platinum-card:lululemon:calendar-quarter-q2", "card:american-express-platinum-card", "american-express-platinum-card:lululemon", "calendar-quarter-q2"),
      usage("benefit:american-express-platinum-card:lululemon:calendar-quarter-q3", "card:american-express-platinum-card", "american-express-platinum-card:lululemon", "calendar-quarter-q3"),
      usage("benefit:american-express-platinum-card:lululemon:calendar-quarter-q4", "card:american-express-platinum-card", "american-express-platinum-card:lululemon", "calendar-quarter-q4"),
      usage("benefit:american-express-platinum-card:hotel:calendar-half-h1", "card:american-express-platinum-card", "american-express-platinum-card:hotel", "calendar-half-h1"),
      usage("benefit:american-express-platinum-card:hotel:calendar-half-h2", "card:american-express-platinum-card", "american-express-platinum-card:hotel", "calendar-half-h2"),
      usage("benefit:american-express-platinum-card:digital-entertainment:calendar-month", "card:american-express-platinum-card", "american-express-platinum-card:digital-entertainment", "calendar-month"),
      usage("benefit:american-express-platinum-card:uber-one:calendar-year", "card:american-express-platinum-card", "american-express-platinum-card:uber-one", "calendar-year"),
      usage("benefit:american-express-platinum-card:oura:calendar-year", "card:american-express-platinum-card", "american-express-platinum-card:oura", "calendar-year"),
      usage("benefit:american-express-platinum-card:walmart-plus:calendar-month", "card:american-express-platinum-card", "american-express-platinum-card:walmart-plus", "calendar-month"),
    ],
  },
  "American Express Business Platinum Card": {
    catalogKey: "card:american-express-business-platinum-card",
    productKey: "american-express-business-platinum-card",
    exactAliases: ["American Express Business Platinum Card", "Business Platinum Card from American Express", "Business Platinum Card®"],
    benefits: [
      usage("benefit:american-express-business-platinum-card:airline-fee:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:airline-fee", "calendar-year"),
      usage("benefit:american-express-business-platinum-card:hotel:calendar-half-h1", "card:american-express-business-platinum-card", "american-express-business-platinum-card:hotel", "calendar-half-h1"),
      usage("benefit:american-express-business-platinum-card:hotel:calendar-half-h2", "card:american-express-business-platinum-card", "american-express-business-platinum-card:hotel", "calendar-half-h2"),
      usage("benefit:american-express-business-platinum-card:dell:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:dell", "calendar-year"),
      excluded("benefit:american-express-business-platinum-card:adobe:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:adobe", "calendar-year", "spend"),
      excluded("benefit:american-express-business-platinum-card:amex-travel-flight:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:amex-travel-flight", "calendar-year", "spend"),
      excluded("benefit:american-express-business-platinum-card:one-ap:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:one-ap", "calendar-year", "spend"),
      usage("benefit:american-express-business-platinum-card:hilton:card-anniversary-quarter", "card:american-express-business-platinum-card", "american-express-business-platinum-card:hilton", "card-anniversary-quarter"),
      usage("benefit:american-express-business-platinum-card:indeed:calendar-quarter", "card:american-express-business-platinum-card", "american-express-business-platinum-card:indeed", "calendar-quarter"),
      usage("benefit:american-express-business-platinum-card:wireless:calendar-month", "card:american-express-business-platinum-card", "american-express-business-platinum-card:wireless", "calendar-month"),
    ],
  },
  "American Express Business Gold Card": {
    catalogKey: "card:american-express-business-gold-card",
    productKey: "american-express-business-gold-card",
    exactAliases: ["American Express Business Gold Card", "Business Gold Card from American Express", "Amex Business Gold Card"],
    benefits: [
      usage("benefit:american-express-business-gold-card:flexible-business:calendar-month", "card:american-express-business-gold-card", "american-express-business-gold-card:flexible-business", "calendar-month"),
      usage("benefit:american-express-business-gold-card:walmart-plus:calendar-month", "card:american-express-business-gold-card", "american-express-business-gold-card:walmart-plus", "calendar-month"),
    ],
  },
  "Hilton Honors American Express Aspire Card": {
    catalogKey: "card:hilton-honors-american-express-aspire-card",
    productKey: "hilton-honors-american-express-aspire-card",
    exactAliases: ["Hilton Honors American Express Aspire Card", "Hilton Honors Aspire Card"],
    benefits: [
      excluded("benefit:hilton-honors-american-express-aspire-card:free-night:card-anniversary-year", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:free-night", "card-anniversary-year", "certificate"),
      usage("benefit:hilton-honors-american-express-aspire-card:flight:calendar-quarter", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:flight", "calendar-quarter"),
      usage("benefit:hilton-honors-american-express-aspire-card:hilton-resort:calendar-half-h1", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:hilton-resort", "calendar-half-h1"),
      usage("benefit:hilton-honors-american-express-aspire-card:hilton-resort:calendar-half-h2", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:hilton-resort", "calendar-half-h2"),
      usage("benefit:hilton-honors-american-express-aspire-card:clear-plus:calendar-year", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:clear-plus", "calendar-year"),
    ],
  },
  "Hilton Honors American Express Surpass Card": {
    catalogKey: "card:hilton-honors-american-express-surpass-card",
    productKey: "hilton-honors-american-express-surpass-card",
    exactAliases: ["Hilton Honors American Express Surpass Card", "Hilton Honors Surpass Card"],
    benefits: [usage("benefit:hilton-honors-american-express-surpass-card:hilton:calendar-quarter", "card:hilton-honors-american-express-surpass-card", "hilton-honors-american-express-surpass-card:hilton", "calendar-quarter")],
  },
  "Hilton Honors American Express Business Card": {
    catalogKey: "card:hilton-honors-american-express-business-card",
    productKey: "hilton-honors-american-express-business-card",
    exactAliases: ["Hilton Honors American Express Business Card", "Hilton Honors Business Card"],
    benefits: [usage("benefit:hilton-honors-american-express-business-card:hilton:card-anniversary-quarter", "card:hilton-honors-american-express-business-card", "hilton-honors-american-express-business-card:hilton", "card-anniversary-quarter")],
  },
  "Delta SkyMiles Gold American Express Card": {
    catalogKey: "card:delta-skymiles-gold-american-express-card",
    productKey: "delta-skymiles-gold-american-express-card",
    exactAliases: ["Delta SkyMiles Gold American Express Card", "Delta SkyMiles Gold Amex Card"],
    benefits: [
      excluded("benefit:delta-skymiles-gold-american-express-card:delta-flight:card-anniversary-year", "card:delta-skymiles-gold-american-express-card", "delta-skymiles-gold-american-express-card:delta-flight", "card-anniversary-year", "spend"),
      usage("benefit:delta-skymiles-gold-american-express-card:delta-stays:card-anniversary-year", "card:delta-skymiles-gold-american-express-card", "delta-skymiles-gold-american-express-card:delta-stays", "card-anniversary-year"),
    ],
  },
  "Delta SkyMiles Platinum American Express Card": {
    catalogKey: "card:delta-skymiles-platinum-american-express-card",
    productKey: "delta-skymiles-platinum-american-express-card",
    exactAliases: ["Delta SkyMiles Platinum American Express Card", "Delta SkyMiles Platinum Amex Card"],
    benefits: [
      usage("benefit:delta-skymiles-platinum-american-express-card:delta-stays:card-anniversary-year", "card:delta-skymiles-platinum-american-express-card", "delta-skymiles-platinum-american-express-card:delta-stays", "card-anniversary-year"),
      usage("benefit:delta-skymiles-platinum-american-express-card:resy:calendar-month", "card:delta-skymiles-platinum-american-express-card", "delta-skymiles-platinum-american-express-card:resy", "calendar-month"),
      usage("benefit:delta-skymiles-platinum-american-express-card:rideshare:calendar-month", "card:delta-skymiles-platinum-american-express-card", "delta-skymiles-platinum-american-express-card:rideshare", "calendar-month"),
    ],
  },
  "Delta SkyMiles Reserve American Express Card": {
    catalogKey: "card:delta-skymiles-reserve-american-express-card",
    productKey: "delta-skymiles-reserve-american-express-card",
    exactAliases: ["Delta SkyMiles Reserve American Express Card", "Delta SkyMiles Reserve Amex Card"],
    benefits: [
      usage("benefit:delta-skymiles-reserve-american-express-card:delta-stays:card-anniversary-year", "card:delta-skymiles-reserve-american-express-card", "delta-skymiles-reserve-american-express-card:delta-stays", "card-anniversary-year"),
      usage("benefit:delta-skymiles-reserve-american-express-card:resy:calendar-month", "card:delta-skymiles-reserve-american-express-card", "delta-skymiles-reserve-american-express-card:resy", "calendar-month"),
      usage("benefit:delta-skymiles-reserve-american-express-card:rideshare:calendar-month", "card:delta-skymiles-reserve-american-express-card", "delta-skymiles-reserve-american-express-card:rideshare", "calendar-month"),
    ],
  },
  "Marriott Bonvoy Brilliant American Express Card": {
    catalogKey: "card:marriott-bonvoy-brilliant-american-express-card",
    productKey: "marriott-bonvoy-brilliant-american-express-card",
    exactAliases: ["Marriott Bonvoy Brilliant American Express Card", "Marriott Bonvoy Brilliant Card"],
    benefits: [
      excluded("benefit:marriott-bonvoy-brilliant-american-express-card:free-night:card-anniversary-year", "card:marriott-bonvoy-brilliant-american-express-card", "marriott-bonvoy-brilliant-american-express-card:free-night", "card-anniversary-year", "certificate"),
      usage("benefit:marriott-bonvoy-brilliant-american-express-card:dining:calendar-month", "card:marriott-bonvoy-brilliant-american-express-card", "marriott-bonvoy-brilliant-american-express-card:dining", "calendar-month"),
    ],
  },
  "Marriott Bonvoy Business American Express Card": {
    catalogKey: "card:marriott-bonvoy-business-american-express-card",
    productKey: "marriott-bonvoy-business-american-express-card",
    exactAliases: ["Marriott Bonvoy Business American Express Card", "Marriott Bonvoy Business Card"],
    benefits: [
      excluded("benefit:marriott-bonvoy-business-american-express-card:free-night:card-anniversary-year", "card:marriott-bonvoy-business-american-express-card", "marriott-bonvoy-business-american-express-card:free-night", "card-anniversary-year", "certificate"),
      excluded("benefit:marriott-bonvoy-business-american-express-card:elite-night-credits:card-anniversary-year", "card:marriott-bonvoy-business-american-express-card", "marriott-bonvoy-business-american-express-card:elite-night-credits", "card-anniversary-year", "status_or_access"),
      excluded("benefit:marriott-bonvoy-business-american-express-card:gold-elite-status:card-anniversary-year", "card:marriott-bonvoy-business-american-express-card", "marriott-bonvoy-business-american-express-card:gold-elite-status", "card-anniversary-year", "status_or_access"),
    ],
  },
} as const satisfies Record<string, AmexCatalogProductIdentity>;

export type AmexCatalogCardName = keyof typeof AMEX_CATALOG_IDENTITY_REGISTRY;

export const AMEX_WRITABLE_DESTINATIONS = Object.values(AMEX_CATALOG_IDENTITY_REGISTRY).flatMap((product) =>
  product.benefits.flatMap((benefit) => benefit.sourceSemantics === "usage" && benefit.sourceCreditKey
    ? [{
      productKey: product.productKey,
      creditFamilyKey: benefit.creditFamilyKey,
      periodKey: benefit.periodKey,
      sourceCreditKey: benefit.sourceCreditKey,
    }]
    : []));
