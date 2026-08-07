import { americanExpressCardCatalog } from "@/lib/american-express-card-catalog";
import { AMEX_CATALOG_IDENTITY_REGISTRY, type AmexCatalogCardName } from "@/lib/amex-catalog/catalog-registry";
import {
  AMEX_BROWSER_PRODUCT_MATCH_MIN_MARGIN,
  AMEX_BROWSER_PRODUCT_MATCH_MIN_SCORE,
  BROWSER_AMEX_SOURCE_CREDIT_DESCRIPTORS,
  evaluateAmexBrowserProductScores,
  isEligibleLocalAmexUsageTitle,
  isIgnoredAmexCatalogBenefitTitle,
  matchAmexBrowserSyncCredit,
} from "../supported-card-credits";

describe("Amex local title eligibility", () => {
  it("admits ordinary usage-credit titles independent of card product", () => {
    for (const title of [
      "$219 CLEAR+ Credit",
      "Dell Technologies Credit",
      "Delta Stays Credit",
      "Hilton Resort Statement Credit",
      "Resy Credit",
    ]) {
      expect(isEligibleLocalAmexUsageTitle(title)).toBe(true);
    }
  });

  it("rejects the reviewed exact catalog exclusions", () => {
    expect(isIgnoredAmexCatalogBenefitTitle("35% Airline Bonus")).toBe(true);
    expect(isIgnoredAmexCatalogBenefitTitle("Link Your Resy Profile")).toBe(true);
    expect(isIgnoredAmexCatalogBenefitTitle("$200 Airline Fee Credit")).toBe(false);
    expect(isIgnoredAmexCatalogBenefitTitle("Resy Credit")).toBe(false);

    expect(isEligibleLocalAmexUsageTitle("35% Airline Bonus")).toBe(false);
    expect(isEligibleLocalAmexUsageTitle("Link Your Resy Profile")).toBe(false);
  });

  it("rejects empty titles and explicit non-credit phrases", () => {
    for (const title of [
      "",
      "   ",
      "Car Rental Loss and Damage Insurance",
      "Cell Phone Protection",
      "Annual Free Night Reward",
      "Premium Global Assist Hotline",
      "Global Dining Access by Resy",
      "Centurion Lounge Access",
      "Priority Pass Select Membership",
      "Saks Fifth Avenue Purchase Protection",
      "Return Protection",
      "Marriott Bonvoy Elite Status",
      "Dining Access Credit",
      "Travel Insurance Credit",
      "Purchase Protection Credit",
    ]) {
      expect(isEligibleLocalAmexUsageTitle(title)).toBe(false);
    }
  });
});

describe("Amex browser sync mapping", () => {
  it("accepts the exact product score and margin boundaries but rejects values immediately below", () => {
    expect(evaluateAmexBrowserProductScores(AMEX_BROWSER_PRODUCT_MATCH_MIN_SCORE, 0)).toBe("accepted");
    expect(evaluateAmexBrowserProductScores(AMEX_BROWSER_PRODUCT_MATCH_MIN_SCORE - 0.000001, 0)).toBe("low_confidence");
    expect(evaluateAmexBrowserProductScores(0.88, 0.88 - AMEX_BROWSER_PRODUCT_MATCH_MIN_MARGIN)).toBe("accepted");
    expect(evaluateAmexBrowserProductScores(0.88, 0.88 - AMEX_BROWSER_PRODUCT_MATCH_MIN_MARGIN + 0.000001)).toBe("ambiguous");
  });

  it("maps only the reviewed exact base Platinum product-title pairs", () => {
    for (const [productName, title, creditFamilyKey] of [
      [
        "The Platinum Card from American Express",
        "$400 Resy Credit",
        "american-express-platinum-card:resy",
      ],
      [
        "American Express Platinum Card",
        "Resy Dining Credit",
        "american-express-platinum-card:resy",
      ],
      [
        "American Express Platinum Card",
        "$300 lululemon Credit",
        "american-express-platinum-card:lululemon",
      ],
      [
        "The Platinum Card from American Express",
        "lululemon Credit",
        "american-express-platinum-card:lululemon",
      ],
      [
        "Platinum Card®",
        "Resy Credit",
        "american-express-platinum-card:resy",
      ],
    ] as const) {
      expect(matchAmexBrowserSyncCredit(productName, title)).toEqual({
        productKey: "american-express-platinum-card",
        creditFamilyKey,
        sourceCreditKey: creditFamilyKey,
      });
    }
  });

  it("accepts the reviewed Morgan Stanley affiliation alias", () => {
    expect(matchAmexBrowserSyncCredit("Morgan Stanley Platinum", "$400 Resy Credit")).toMatchObject({
      productKey: "american-express-platinum-card",
      sourceCreditKey: "american-express-platinum-card:resy",
    });
  });

  it("resolves every reviewed writable source credit from its product-scoped catalog evidence", () => {
    for (const [cardName, descriptor] of Object.entries(AMEX_CATALOG_IDENTITY_REGISTRY)) {
      const card = americanExpressCardCatalog[cardName as AmexCatalogCardName];
      descriptor.benefits.forEach((identity, index) => {
        if (identity.sourceSemantics !== "usage"
          || !identity.sourceCreditKey
          || identity.sourceCreditKey !== identity.creditFamilyKey) return;
        expect(matchAmexBrowserSyncCredit(
          descriptor.exactAliases[0],
          card.benefits[index].description,
        )).toMatchObject({
          productKey: descriptor.productKey,
          sourceCreditKey: identity.sourceCreditKey,
          creditFamilyKey: identity.creditFamilyKey,
        });
      });
    }
  });

  it("uses one unique product-scoped structured core match when no exact title alias exists", () => {
    expect(matchAmexBrowserSyncCredit(
      "American Express Gold Card",
      "Dining Credit",
      { sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-07-31", timeZone: "UTC" } },
    )).toMatchObject({
      productKey: "american-express-gold-card",
      sourceCreditKey: "american-express-gold-card:dining",
    });
    expect(matchAmexBrowserSyncCredit(
      "American Express Gold Card",
      "Uber Cash Dining Credit",
      { sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-07-31", timeZone: "UTC" } },
    )).toBeNull();
  });

  it("defines complete browser policies for every approved source credit", () => {
    for (const descriptor of BROWSER_AMEX_SOURCE_CREDIT_DESCRIPTORS) {
      expect(descriptor.exactAliases.length).toBeGreaterThan(0);
      expect(descriptor.requiredTokenGroups.length).toBeGreaterThan(0);
      expect(descriptor.forbiddenTokenGroups.length).toBeGreaterThan(0);
      expect(descriptor.compatiblePeriodKeys.length).toBeGreaterThan(0);
      expect(descriptor.amountConstraint).toMatchObject({ currency: "USD", minimumUsd: 0 });
    }
  });

  it("fails closed on forbidden tokens, incompatible periods, and reviewed amount constraints", () => {
    expect(matchAmexBrowserSyncCredit(
      "American Express Platinum Card",
      "Resy Spend Credit",
    )).toBeNull();
    expect(matchAmexBrowserSyncCredit(
      "American Express Platinum Card",
      "Resy Credit",
      { sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-07-31", timeZone: "UTC" } },
    )).toBeNull();
    expect(matchAmexBrowserSyncCredit(
      "American Express Platinum Card",
      "Uber Cash",
      {
        sourcePeriod: { kind: "calendar_date_range", startDate: "2026-12-01", endDate: "2026-12-31", timeZone: "UTC" },
        earnedOrUsed: { value: "35.01", unit: "USD", currency: "USD" },
      },
    )).toBeNull();
  });

  it("fails closed for hard product conflicts and unsupported titles", () => {
    for (const [productName, title] of [
      ["Hilton Honors Card", "$400 Resy Credit"],
      ["Delta SkyMiles Gold Business Card", "$150 Delta Stays Credit"],
      ["American Express Platinum Card Extra", "$400 Resy Credit"],
      ["Platinum Card® Extra", "Resy Credit"],
      ["American Express Platinum Card", "$219 CLEAR+ Credit"],
      ["American Express Platinum Card", "$300 Equinox Credit"],
    ]) {
      expect(matchAmexBrowserSyncCredit(productName, title)).toBeNull();
    }
  });
});
