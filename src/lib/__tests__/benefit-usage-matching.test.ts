import { inferBenefitUsageWaySlug } from '../benefit-usage-matching';

describe('inferBenefitUsageWaySlug', () => {
  it('matches specific redemption families before generic categories', () => {
    expect(inferBenefitUsageWaySlug({
      category: 'Dining',
      description: '$50 Resy Credit (Jan-Jun)',
    })).toBe('resy-toast-gift-cards');

    expect(inferBenefitUsageWaySlug({
      category: 'Shopping',
      description: '$50 Saks Fifth Avenue Credit (Jan-Jun)',
    })).toBe('saks-credit');

    expect(inferBenefitUsageWaySlug({
      category: 'Travel',
      description: '$120 Security Screening Credit (Global Entry/TSA PreCheck, every 4.5 years)',
    })).toBe('security-screening-credits');
  });

  it('splits hotel and travel credits into targeted usage guides', () => {
    expect(inferBenefitUsageWaySlug({
      category: 'Travel',
      description: '$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jan-Jun)',
    })).toBe('amex-fhr-thc-hotel-credit');

    expect(inferBenefitUsageWaySlug({
      category: 'Travel',
      description: '$250 Hotel Credit (The Edit by Chase Properties - Jul-Dec)',
    })).toBe('chase-the-edit-hotel-credit');

    expect(inferBenefitUsageWaySlug({
      category: 'Travel',
      description: '$200 Semi-Annual Hilton Resort Credit (Jan-Jun)',
    })).toBe('hilton-property-credits');

    expect(inferBenefitUsageWaySlug({
      category: 'Travel',
      description: '$150 Delta Stays Credit',
    })).toBe('delta-stays-credit');

    expect(inferBenefitUsageWaySlug({
      category: 'Travel',
      description: 'Up to $300 Annual Hotel Benefit (2+ nights via Citi Travel)',
    })).toBe('citi-travel-hotel-benefit');
  });

  it('splits shopping, dining, delivery, and membership credits into targeted guides', () => {
    expect(inferBenefitUsageWaySlug({
      category: 'Dining',
      description: '$25 Monthly Dining Credit',
      cardName: 'Marriott Bonvoy Brilliant American Express Card',
    })).toBe('brilliant-doordash-amazon-gift-card');

    expect(inferBenefitUsageWaySlug({
      category: 'Business',
      description: '$20 Monthly Flexible Business Credit (FedEx, Grubhub, Office Supply)',
      cardName: 'American Express Business Gold Card',
    })).toBe('business-gold-office-supply-gift-cards');

    expect(inferBenefitUsageWaySlug({
      category: 'Shopping',
      description: '$75 Quarterly Lululemon Credit (Q1: Jan-Mar)',
    })).toBe('lululemon-credit');

    expect(inferBenefitUsageWaySlug({
      category: 'Shopping',
      description: 'Up to $200 Annual Splurge Credit (select brands)',
    })).toBe('citi-splurge-credit');

    expect(inferBenefitUsageWaySlug({
      category: 'Entertainment',
      description: '$150 Semi-Annual StubHub Credit (Event Tickets - Jan-Jun)',
    })).toBe('stubhub-credit');

    expect(inferBenefitUsageWaySlug({
      category: 'Food Delivery',
      description: '$10 Monthly Instacart credit',
    })).toBe('delivery-grocery-credits');

    expect(inferBenefitUsageWaySlug({
      category: 'Travel',
      description: '$120 Annual Uber One Membership Credit',
    })).toBe('uber-one-credit');

    expect(inferBenefitUsageWaySlug({
      category: 'Travel',
      description: '$189 CLEAR Plus Credit',
    })).toBe('clear-credit');
  });

  it('falls back to a sensible generic checklist for non-credit perks', () => {
    expect(inferBenefitUsageWaySlug({
      category: 'Bonus',
      description: '10,000 Anniversary Bonus Miles',
    })).toBe('benefit-checklist');
  });
});
