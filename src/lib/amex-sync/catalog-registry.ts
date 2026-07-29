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
  creditFamilyKey: string;
  periodKey: AmexPeriodKey;
  sourceSemantics: AmexSourceSemantics;
  sourceCreditKey: string | null;
}

export interface AmexCatalogProductIdentity {
  productKey: string;
  exactAliases: readonly string[];
  affiliationAliases?: readonly string[];
  benefits: readonly AmexCatalogBenefitIdentity[];
}

const usage = (family: string, periodKey: AmexPeriodKey, sourceCreditKey = family): AmexCatalogBenefitIdentity => ({
  creditFamilyKey: family,
  periodKey,
  sourceSemantics: "usage",
  sourceCreditKey,
});
const excluded = (
  family: string,
  periodKey: AmexPeriodKey,
  sourceSemantics: Exclude<AmexSourceSemantics, "usage">,
): AmexCatalogBenefitIdentity => ({ creditFamilyKey: family, periodKey, sourceSemantics, sourceCreditKey: null });
const q = (product: string, family: string): AmexCatalogBenefitIdentity[] => [1, 2, 3, 4].map((number) =>
  usage(`${product}:${family}`, `calendar-quarter-q${number}` as AmexPeriodKey));

export const AMEX_CATALOG_IDENTITY_REGISTRY = {
  "American Express Gold Card": {
    productKey: "american-express-gold-card",
    exactAliases: ["American Express Gold Card", "American Express Gold Card®", "Amex Gold Card"],
    benefits: [
      usage("american-express-gold-card:uber-cash", "calendar-month"),
      usage("american-express-gold-card:dining", "calendar-month"),
      usage("american-express-gold-card:dunkin", "calendar-month"),
      usage("american-express-gold-card:resy", "calendar-half-h1"),
      usage("american-express-gold-card:resy", "calendar-half-h2"),
    ],
  },
  "American Express Platinum Card": {
    productKey: "american-express-platinum-card",
    exactAliases: ["American Express Platinum Card", "The Platinum Card from American Express", "Platinum Card®"],
    affiliationAliases: ["Morgan Stanley Platinum", "The Platinum Card from American Express Exclusively for Morgan Stanley"],
    benefits: [
      usage("american-express-platinum-card:airline-fee", "calendar-year"),
      usage("american-express-platinum-card:uber-cash", "calendar-month"),
      usage("american-express-platinum-card:uber-cash-december-bonus", "calendar-month-december", "american-express-platinum-card:uber-cash"),
      usage("american-express-platinum-card:saks", "calendar-half-h1"),
      usage("american-express-platinum-card:saks", "calendar-half-h2"),
      ...q("american-express-platinum-card", "resy"),
      ...q("american-express-platinum-card", "lululemon"),
      usage("american-express-platinum-card:hotel", "calendar-half-h1"),
      usage("american-express-platinum-card:hotel", "calendar-half-h2"),
      usage("american-express-platinum-card:digital-entertainment", "calendar-month"),
      usage("american-express-platinum-card:uber-one", "calendar-year"),
      usage("american-express-platinum-card:oura", "calendar-year"),
      usage("american-express-platinum-card:walmart-plus", "calendar-month"),
    ],
  },
  "American Express Business Platinum Card": {
    productKey: "american-express-business-platinum-card",
    exactAliases: ["American Express Business Platinum Card", "Business Platinum Card from American Express", "Business Platinum Card®"],
    benefits: [
      usage("american-express-business-platinum-card:airline-fee", "calendar-year"),
      usage("american-express-business-platinum-card:hotel", "calendar-half-h1"),
      usage("american-express-business-platinum-card:hotel", "calendar-half-h2"),
      usage("american-express-business-platinum-card:dell", "calendar-year"),
      excluded("american-express-business-platinum-card:adobe", "calendar-year", "spend"),
      excluded("american-express-business-platinum-card:amex-travel-flight", "calendar-year", "spend"),
      excluded("american-express-business-platinum-card:one-ap", "calendar-year", "spend"),
      usage("american-express-business-platinum-card:hilton", "card-anniversary-quarter"),
      usage("american-express-business-platinum-card:indeed", "calendar-quarter"),
      usage("american-express-business-platinum-card:wireless", "calendar-month"),
    ],
  },
  "American Express Business Gold Card": {
    productKey: "american-express-business-gold-card",
    exactAliases: ["American Express Business Gold Card", "Business Gold Card from American Express", "Amex Business Gold Card"],
    benefits: [
      usage("american-express-business-gold-card:flexible-business", "calendar-month"),
      usage("american-express-business-gold-card:walmart-plus", "calendar-month"),
    ],
  },
  "Hilton Honors American Express Aspire Card": {
    productKey: "hilton-honors-american-express-aspire-card",
    exactAliases: ["Hilton Honors American Express Aspire Card", "Hilton Honors Aspire Card"],
    benefits: [
      excluded("hilton-honors-american-express-aspire-card:free-night", "card-anniversary-year", "certificate"),
      usage("hilton-honors-american-express-aspire-card:flight", "calendar-quarter"),
      usage("hilton-honors-american-express-aspire-card:hilton-resort", "calendar-half-h1"),
      usage("hilton-honors-american-express-aspire-card:hilton-resort", "calendar-half-h2"),
      usage("hilton-honors-american-express-aspire-card:clear-plus", "calendar-year"),
    ],
  },
  "Hilton Honors American Express Surpass Card": {
    productKey: "hilton-honors-american-express-surpass-card",
    exactAliases: ["Hilton Honors American Express Surpass Card", "Hilton Honors Surpass Card"],
    benefits: [usage("hilton-honors-american-express-surpass-card:hilton", "calendar-quarter")],
  },
  "Hilton Honors American Express Business Card": {
    productKey: "hilton-honors-american-express-business-card",
    exactAliases: ["Hilton Honors American Express Business Card", "Hilton Honors Business Card"],
    benefits: [usage("hilton-honors-american-express-business-card:hilton", "card-anniversary-quarter")],
  },
  "Delta SkyMiles Gold American Express Card": {
    productKey: "delta-skymiles-gold-american-express-card",
    exactAliases: ["Delta SkyMiles Gold American Express Card", "Delta SkyMiles Gold Amex Card"],
    benefits: [
      excluded("delta-skymiles-gold-american-express-card:delta-flight", "card-anniversary-year", "spend"),
      usage("delta-skymiles-gold-american-express-card:delta-stays", "card-anniversary-year"),
    ],
  },
  "Delta SkyMiles Platinum American Express Card": {
    productKey: "delta-skymiles-platinum-american-express-card",
    exactAliases: ["Delta SkyMiles Platinum American Express Card", "Delta SkyMiles Platinum Amex Card"],
    benefits: [
      usage("delta-skymiles-platinum-american-express-card:delta-stays", "card-anniversary-year"),
      usage("delta-skymiles-platinum-american-express-card:resy", "calendar-month"),
      usage("delta-skymiles-platinum-american-express-card:rideshare", "calendar-month"),
    ],
  },
  "Delta SkyMiles Reserve American Express Card": {
    productKey: "delta-skymiles-reserve-american-express-card",
    exactAliases: ["Delta SkyMiles Reserve American Express Card", "Delta SkyMiles Reserve Amex Card"],
    benefits: [
      usage("delta-skymiles-reserve-american-express-card:delta-stays", "card-anniversary-year"),
      usage("delta-skymiles-reserve-american-express-card:resy", "calendar-month"),
      usage("delta-skymiles-reserve-american-express-card:rideshare", "calendar-month"),
    ],
  },
  "Marriott Bonvoy Brilliant American Express Card": {
    productKey: "marriott-bonvoy-brilliant-american-express-card",
    exactAliases: ["Marriott Bonvoy Brilliant American Express Card", "Marriott Bonvoy Brilliant Card"],
    benefits: [
      excluded("marriott-bonvoy-brilliant-american-express-card:free-night", "card-anniversary-year", "certificate"),
      usage("marriott-bonvoy-brilliant-american-express-card:dining", "calendar-month"),
    ],
  },
  "Marriott Bonvoy Business American Express Card": {
    productKey: "marriott-bonvoy-business-american-express-card",
    exactAliases: ["Marriott Bonvoy Business American Express Card", "Marriott Bonvoy Business Card"],
    benefits: [
      excluded("marriott-bonvoy-business-american-express-card:free-night", "card-anniversary-year", "certificate"),
      excluded("marriott-bonvoy-business-american-express-card:elite-night-credits", "card-anniversary-year", "status_or_access"),
      excluded("marriott-bonvoy-business-american-express-card:gold-elite-status", "card-anniversary-year", "status_or_access"),
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
