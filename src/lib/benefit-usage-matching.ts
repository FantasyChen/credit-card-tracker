type BenefitForUsageMatch = {
  category: string;
  description: string;
  cardName?: string | null;
};

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function inferBenefitUsageWaySlug(benefit: BenefitForUsageMatch): string {
  const text = `${benefit.category} ${benefit.description}`.toLowerCase();
  const cardName = benefit.cardName?.toLowerCase() ?? '';

  if (includesAny(text, ['global entry', 'tsa precheck', 'security screening'])) {
    return 'security-screening-credits';
  }

  if (includesAny(text, ['dunkin'])) return 'amex-gold-dunkin-credit';
  if (includesAny(text, ['resy'])) return 'resy-toast-gift-cards';
  if (includesAny(text, ['uber one'])) return 'uber-one-credit';
  if (includesAny(text, ['blacklane'])) return 'blacklane-credit';
  if (includesAny(text, ['uber cash', 'lyft', 'rideshare'])) return 'rideshare-credits';

  if (cardName.includes('marriott bonvoy brilliant') && includesAny(text, ['dining credit', 'restaurant'])) {
    return 'brilliant-doordash-amazon-gift-card';
  }

  if (cardName.includes('american express business gold') && includesAny(text, ['flexible business', 'office supply'])) {
    return 'business-gold-office-supply-gift-cards';
  }

  if (includesAny(text, ['doordash', 'instacart', 'grubhub'])) return 'delivery-grocery-credits';
  if (includesAny(text, ['fine dining'])) return 'chase-fine-dining-credit';

  if (includesAny(text, ['dining credit', 'restaurant'])) {
    return 'dining-credits';
  }

  if (includesAny(text, ['southwest annual travel'])) return 'southwest-travel-credit';

  if (includesAny(text, ['airline fee', 'flight credit', 'farelock'])) {
    return 'airline-fee-credits';
  }

  if (includesAny(text, ['fhr', 'thc'])) return 'amex-fhr-thc-hotel-credit';
  if (includesAny(text, ['the edit'])) return 'chase-the-edit-hotel-credit';
  if (includesAny(text, ['hilton resort', 'hilton credit', 'hilton properties'])) return 'hilton-property-credits';
  if (includesAny(text, ['delta stays'])) return 'delta-stays-credit';
  if (includesAny(text, ['citi travel', 'annual hotel benefit'])) return 'citi-travel-hotel-benefit';
  if (includesAny(text, ['renowned hotels', 'united hotels', 'united travel credit', 'united purchase credit'])) {
    return 'united-hotel-travel-credits';
  }
  if (includesAny(text, ['travel portal', 'capital one travel', 'hsbc travel', 'travel bookings', 'travel credit'])) {
    return 'travel-portal-credits';
  }

  if (includesAny(text, ['hotel'])) {
    return 'hotel-credits';
  }

  if (includesAny(text, ['saks'])) return 'saks-credit';
  if (includesAny(text, ['lululemon'])) return 'lululemon-credit';
  if (includesAny(text, ['splurge'])) return 'citi-splurge-credit';

  if (includesAny(text, ['dell', 'adobe', 'indeed', 'wireless', 'fedex', 'office supply', 'openai', 'one ap', 'flexible business'])) {
    return 'business-service-credits';
  }

  if (includesAny(text, ['stubhub'])) return 'stubhub-credit';
  if (includesAny(text, ['entertainment', 'apple subscriptions'])) {
    return 'entertainment-credits';
  }

  if (includesAny(text, ['clear'])) return 'clear-credit';
  if (includesAny(text, ['oura'])) return 'oura-credit';
  if (includesAny(text, ['walmart+', 'priority pass', 'united club', 'admirals club'])) {
    return 'membership-credits';
  }

  if (includesAny(text, ['free night', 'companion', 'anniversary', 'earlybird', 'upgraded boarding', 'lounge passes', 'elite status', 'points boost', 'quarterly categories'])) {
    return 'benefit-checklist';
  }

  return 'statement-credits';
}
