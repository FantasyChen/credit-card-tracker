import {
  classifyCatalogKeyBackfill,
  executeCatalogKeyBackfill,
  type CatalogBackfillBenefitShape,
  type CatalogBackfillCardShape,
  type CatalogBackfillTemplateCardShape,
} from "../catalog-backfill";

function benefit(id: string, overrides: Partial<CatalogBackfillBenefitShape> = {}): CatalogBackfillBenefitShape {
  return {
    id,
    category: "Dining",
    description: "Synthetic Q3 dining credit",
    percentage: 100,
    maxAmount: 100,
    frequency: "QUARTERLY",
    cycleAlignment: "CALENDAR_FIXED",
    fixedCycleStartMonth: 7,
    fixedCycleDurationMonths: 3,
    occurrencesInCycle: 1,
    productKey: null,
    creditFamilyKey: null,
    periodKey: null,
    ...overrides,
  };
}

const templateBenefit = {
  ...benefit("unused"),
  productKey: "american-express-platinum-card",
  creditFamilyKey: "american-express-platinum-card:resy",
  periodKey: "calendar-quarter-q3",
};
delete (templateBenefit as { id?: string }).id;

const template: CatalogBackfillTemplateCardShape = {
  name: "Synthetic Platinum",
  issuer: "American Express",
  productKey: "american-express-platinum-card",
  benefits: [templateBenefit],
};

function card(overrides: Partial<CatalogBackfillCardShape> = {}): CatalogBackfillCardShape {
  return {
    id: "card-1",
    name: template.name,
    issuer: template.issuer,
    productKey: null,
    benefits: [benefit("benefit-1")],
    ...overrides,
  };
}

describe("catalog key backfill classifier", () => {
  it("returns a deterministic write-free proposal for one exact unedited match", () => {
    const first = classifyCatalogKeyBackfill([card()], [template]);
    const second = classifyCatalogKeyBackfill([card()], [template]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      counts: { cardsExamined: 1, cardsProposed: 1, benefitsExamined: 1, benefitsProposed: 1, conflicts: 0 },
      proposals: [{
        cardId: "card-1",
        productKey: "american-express-platinum-card",
        benefits: [{
          benefitId: "benefit-1",
          creditFamilyKey: "american-express-platinum-card:resy",
          periodKey: "calendar-quarter-q3",
        }],
      }],
    });
  });

  it.each([
    [card({ name: "Edited Platinum" }), [template], "card_template_missing"],
    [card({ productKey: "conflicting-card" }), [template], "card_key_conflict"],
    [card({ benefits: [benefit("benefit-1", { description: "Edited credit" })] }), [template], "benefit_template_missing"],
    [card({ benefits: [benefit("benefit-1", { periodKey: "calendar-quarter-q4" })] }), [template], "benefit_key_conflict"],
    [card({ benefits: [benefit("benefit-1"), benefit("benefit-2")] }), [template], "duplicate_destination_key"],
    [card(), [template, { ...template }], "card_template_ambiguous"],
  ])("leaves unresolved or conflicting records null for case %#", (record, templates, reason) => {
    const result = classifyCatalogKeyBackfill([record as CatalogBackfillCardShape], templates as CatalogBackfillTemplateCardShape[]);
    expect(result.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ reason })]));
    expect(result.counts.conflicts).toBeGreaterThan(0);
    if (reason === "card_template_missing" || reason === "card_template_ambiguous" || reason === "card_key_conflict") {
      expect(result.proposals).toEqual([]);
    } else {
      expect(result.proposals[0]?.benefits ?? []).toEqual([]);
    }
  });

  it("defaults to dry-run and requires explicit additive writer authority for apply", async () => {
    const writer = {
      fillNullCardProductKey: jest.fn().mockResolvedValue(true),
      fillNullBenefitKeys: jest.fn().mockResolvedValue(true),
      materializeMissingStatuses: jest.fn().mockResolvedValue(2),
    };
    await expect(executeCatalogKeyBackfill({ cards: [card()], templates: [template], writer })).resolves.toMatchObject({
      mode: "dry-run",
      applied: { cards: 0, benefits: 0, statusesMaterialized: 0 },
    });
    expect(writer.fillNullCardProductKey).not.toHaveBeenCalled();
    await expect(executeCatalogKeyBackfill({ cards: [card()], templates: [template], mode: "apply" })).rejects.toThrow("authorized");
    await expect(executeCatalogKeyBackfill({ cards: [card()], templates: [template], mode: "apply", writer })).resolves.toMatchObject({
      mode: "apply",
      applied: { cards: 1, benefits: 1, statusesMaterialized: 2 },
    });
  });

  it("does not propose writes for records whose exact keys are already populated", () => {
    const populated = card({
      productKey: "american-express-platinum-card",
      benefits: [benefit("benefit-1", {
        productKey: "american-express-platinum-card",
        creditFamilyKey: "american-express-platinum-card:resy",
        periodKey: "calendar-quarter-q3",
      })],
    });
    expect(classifyCatalogKeyBackfill([populated], [template])).toMatchObject({
      proposals: [],
      counts: { cardsProposed: 0, benefitsProposed: 0, conflicts: 0 },
    });
  });
});
