import {
  formatAmexBenefitTitle,
  formatAmexSourcePeriod,
} from "../presentation";

describe("AMEX client-safe presentation", () => {
  it("formats inert provider titles without interpreting markup", () => {
    expect(formatAmexBenefitTitle("Resy&#174;<sup>‡</sup> Statement Credit"))
      .toBe("Resy® Statement Credit");
    expect(formatAmexBenefitTitle("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>");
  });

  it("formats structured UTC periods deterministically", () => {
    expect(formatAmexSourcePeriod({
      kind: "calendar_date_range",
      startDate: "2026-12-01",
      endDate: "2026-12-31",
      timeZone: "UTC",
    })).toBe("Dec 2026");
    expect(formatAmexSourcePeriod({
      kind: "calendar_date_range",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      timeZone: "UTC",
    })).toBe("Jul–Sep 2026");
  });
});
