import { americanExpressCardCatalog } from "@/lib/american-express-card-catalog";
import {
  isSupportedAmexCatalogCard,
  matchSupportedAmexCardCredit,
} from "../supported-card-credits";

describe("supported Amex card credit vocabulary", () => {
  it("matches represented usable credits through conservative product and title variants", () => {
    expect(matchSupportedAmexCardCredit(
      "The Platinum Card® from American Express",
      "Up to $200 Airline Fee Credit",
    )).toEqual({
      catalogCardName: "American Express Platinum Card",
      creditKey: "american-express-platinum-card:airline-fee",
    });
    expect(matchSupportedAmexCardCredit(
      "Hilton Honors Aspire Card",
      "Hilton Resort Statement Credit",
    )).toEqual({
      catalogCardName: "Hilton Honors American Express Aspire Card",
      creditKey: "hilton-honors-american-express-aspire-card:hilton-resort",
    });
    expect(matchSupportedAmexCardCredit(
      "Delta SkyMiles Platinum Card",
      "Your Monthly Rideshare Credit",
    )).toEqual({
      catalogCardName: "Delta SkyMiles Platinum American Express Card",
      creditKey: "delta-skymiles-platinum-american-express-card:rideshare",
    });
  });

  it("omits informational, protection, access-only, and non-credit benefits even when they mention a supported brand", () => {
    const product = "American Express Platinum Card";
    expect(matchSupportedAmexCardCredit(product, "Premium Global Assist Hotline")).toBeNull();
    expect(matchSupportedAmexCardCredit(product, "Cell Phone Protection")).toBeNull();
    expect(matchSupportedAmexCardCredit(product, "Centurion Lounge Access")).toBeNull();
    expect(matchSupportedAmexCardCredit(product, "Priority Pass Select Membership")).toBeNull();
    expect(matchSupportedAmexCardCredit(product, "Global Dining Access by Resy")).toBeNull();
    expect(matchSupportedAmexCardCredit(product, "Saks Fifth Avenue Purchase Protection")).toBeNull();
    expect(matchSupportedAmexCardCredit("Hilton Honors Aspire Card", "Annual Free Night Reward")).toBeNull();
    expect(matchSupportedAmexCardCredit(
      "Marriott Bonvoy Brilliant American Express Card",
      "Marriott Bonvoy Elite Status",
    )).toBeNull();
  });

  it("covers every positive-amount Amex catalog benefit while omitting zero-value awards and statuses", () => {
    for (const card of Object.values(americanExpressCardCatalog)) {
      for (const benefit of card.benefits) {
        const match = matchSupportedAmexCardCredit(card.name, benefit.description);
        if (benefit.maxAmount > 0) {
          expect(match).not.toBeNull();
          expect(match?.catalogCardName).toBe(card.name);
        } else {
          expect(match).toBeNull();
        }
      }
    }
  });

  it("requires the credit to be represented on the matched card", () => {
    expect(matchSupportedAmexCardCredit(
      "American Express Gold Card",
      "Saks Fifth Avenue Credit",
    )).toBeNull();
    expect(matchSupportedAmexCardCredit(
      "Delta SkyMiles Gold American Express Card",
      "Monthly Resy Credit",
    )).toBeNull();
  });

  it("fails closed for unknown card products and ambiguous near matches", () => {
    expect(isSupportedAmexCatalogCard("Unknown Platinum-Like Product")).toBe(false);
    expect(matchSupportedAmexCardCredit("Unknown Platinum-Like Product", "Airline Fee Credit")).toBeNull();
    expect(matchSupportedAmexCardCredit("Platinum Card Extra", "Airline Fee Credit")).toBeNull();
  });
});
