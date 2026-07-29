import { BROWSER_AMEX_SOURCE_CREDIT_DESCRIPTORS } from "@/lib/amex-benefit-reader/supported-card-credits";
import { AMEX_WRITABLE_DESTINATIONS } from "../catalog-registry";
import {
  AMEX_SERVER_PRODUCT_MATCH_MIN_MARGIN,
  AMEX_SERVER_PRODUCT_MATCH_MIN_SCORE,
  evaluateServerAmexProductScores,
  resolveServerAmexCredit,
  resolveServerAmexProduct,
  SERVER_AMEX_PRODUCTS,
  SERVER_AMEX_SOURCE_CREDITS,
} from "../server-evidence";

describe("independent server AMEX evidence authority", () => {
  it("accepts exact server score and margin boundaries but rejects values immediately below", () => {
    expect(evaluateServerAmexProductScores(AMEX_SERVER_PRODUCT_MATCH_MIN_SCORE, 0)).toBe("accepted");
    expect(evaluateServerAmexProductScores(AMEX_SERVER_PRODUCT_MATCH_MIN_SCORE - 0.000001, 0)).toBe("low_confidence");
    expect(evaluateServerAmexProductScores(0.88, 0.88 - AMEX_SERVER_PRODUCT_MATCH_MIN_MARGIN)).toBe("accepted");
    expect(evaluateServerAmexProductScores(0.88, 0.88 - AMEX_SERVER_PRODUCT_MATCH_MIN_MARGIN + 0.000001)).toBe("ambiguous");
  });

  it("enumerates and resolves all 12 reviewed products independently", () => {
    expect(SERVER_AMEX_PRODUCTS).toHaveLength(12);
    for (const product of SERVER_AMEX_PRODUCTS) {
      expect(resolveServerAmexProduct(product.aliases[0])).toBe(product.productKey);
    }
    expect(resolveServerAmexProduct("Morgan Stanley Platinum")).toBe("american-express-platinum-card");
    expect(resolveServerAmexProduct("Delta SkyMiles Gold Business Card")).toBeNull();
    expect(resolveServerAmexProduct("Hilton Honors Card")).toBeNull();
  });

  it("resolves every separately enumerated source credit within its product", () => {
    for (const descriptor of SERVER_AMEX_SOURCE_CREDITS) {
      const title = descriptor.aliases?.[0]
        ?? `${descriptor.requiredTokens.join(" ")} Credit`;
      const resolved = resolveServerAmexCredit(descriptor.productKey, title);
      if (!resolved) throw new Error(`Unresolved server descriptor: ${descriptor.sourceCreditKey} from ${title}`);
      expect(resolved).toMatchObject({
        productKey: descriptor.productKey,
        sourceCreditKey: descriptor.sourceCreditKey,
        creditFamilyKey: descriptor.creditFamilyKey,
      });
    }
    expect(resolveServerAmexCredit("american-express-platinum-card", "Hilton Resort Statement Credit")).toBeNull();
  });

  it("requires complete policy fields and fails closed on incompatible evidence", () => {
    for (const descriptor of SERVER_AMEX_SOURCE_CREDITS) {
      expect(descriptor.exactAliases.length).toBeGreaterThan(0);
      expect(descriptor.requiredTokenGroups.length).toBeGreaterThan(0);
      expect(descriptor.forbiddenTokenGroups.length).toBeGreaterThan(0);
      expect(descriptor.compatiblePeriodKeys.length).toBeGreaterThan(0);
      expect(descriptor.amountConstraint).toMatchObject({ currency: "USD", minimumUsd: 0 });
    }
    expect(resolveServerAmexCredit(
      "american-express-platinum-card",
      "Resy Spend Credit",
    )).toBeNull();
    expect(resolveServerAmexCredit(
      "american-express-gold-card",
      "Dining Access Credit",
    )).toBeNull();
    expect(resolveServerAmexCredit(
      "american-express-platinum-card",
      "Resy Credit",
      { sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-07-31", timeZone: "UTC" } },
    )).toBeNull();
    expect(resolveServerAmexCredit(
      "american-express-platinum-card",
      "Uber Cash",
      {
        sourcePeriod: { kind: "calendar_date_range", startDate: "2026-12-01", endDate: "2026-12-31", timeZone: "UTC" },
        earnedOrUsed: { value: "35.01", unit: "USD", currency: "USD" },
      },
    )).toBeNull();
  });

  it("matches the reviewed catalog source-claim set without sharing its objects", () => {
    const catalogClaims = new Set(AMEX_WRITABLE_DESTINATIONS
      .filter((entry) => entry.sourceCreditKey === entry.creditFamilyKey)
      .map((entry) => `${entry.productKey}|${entry.sourceCreditKey}|${entry.creditFamilyKey}`));
    const serverClaims = new Set(SERVER_AMEX_SOURCE_CREDITS
      .map((entry) => `${entry.productKey}|${entry.sourceCreditKey}|${entry.creditFamilyKey}`));
    expect(Array.from(serverClaims).sort()).toEqual(Array.from(catalogClaims).sort());
    const browserPeriods = BROWSER_AMEX_SOURCE_CREDIT_DESCRIPTORS.map((entry) =>
      `${entry.productKey}|${entry.sourceCreditKey}|${[...entry.compatiblePeriodKeys].sort().join(",")}`).sort();
    const serverPeriods = SERVER_AMEX_SOURCE_CREDITS.map((entry) =>
      `${entry.productKey}|${entry.sourceCreditKey}|${[...entry.compatiblePeriodKeys].sort().join(",")}`).sort();
    expect(serverPeriods).toEqual(browserPeriods);
  });
});
