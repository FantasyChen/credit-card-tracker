import {
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
    ]) {
      expect(isEligibleLocalAmexUsageTitle(title)).toBe(false);
    }
  });
});

describe("Amex browser sync mapping", () => {
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
      });
    }
  });

  it("fails closed for unreviewed products and near-title matches", () => {
    for (const [productName, title] of [
      ["Morgan Stanley Platinum", "$400 Resy Credit"],
      ["Hilton Honors Card", "$400 Resy Credit"],
      ["Delta SkyMiles Gold Business Card", "$150 Delta Stays Credit"],
      ["American Express Platinum Card Extra", "$400 Resy Credit"],
      ["Platinum Card® Extra", "Resy Credit"],
      ["American Express Platinum Card", "$401 Resy Credit"],
      ["American Express Platinum Card", "Monthly Resy Credit"],
      ["American Express Platinum Card", "$219 CLEAR+ Credit"],
      ["American Express Platinum Card", "$300 Equinox Credit"],
      ["American Express Platinum Card", "$200 Airline Fee Credit"],
    ]) {
      expect(matchAmexBrowserSyncCredit(productName, title)).toBeNull();
    }
  });
});
