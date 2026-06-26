import {
  benefitUsageWays,
  calculateAnnualBenefitValue,
  getPublicStaticCardByName,
  getPublicStaticCards,
  getStaticSearchSuggestions,
  predefinedCardsData,
} from '../static-catalog';

describe('static catalog', () => {
  it('projects predefined cards with stable public ids and usage-guide links', () => {
    const cards = getPublicStaticCards();

    expect(cards.length).toBe(predefinedCardsData.length);
    expect(cards[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      benefits: expect.any(Array),
    }));
    expect(cards.flatMap((card) => card.benefits).every((benefit) => benefit.id.length > 0)).toBe(true);
    expect(cards.flatMap((card) => card.benefits).every((benefit) => benefit.usageWay?.slug)).toBe(true);
  });

  it('finds cards by public route name', () => {
    expect(getPublicStaticCardByName('American Express Gold Card')).toEqual(expect.objectContaining({
      issuer: 'American Express',
    }));
  });

  it('keeps annual value and suggestions available without a database', () => {
    expect(calculateAnnualBenefitValue(10, 'MONTHLY')).toBe(120);
    expect(getStaticSearchSuggestions()).toEqual(expect.arrayContaining(['American Express', 'Dining', 'amex']));
    expect(benefitUsageWays.length).toBeGreaterThan(0);
  });
});
