import {
  getEffectiveExpirationDays,
  getEffectiveTier,
  getTierDisplayName,
  isBetaMode,
  TIER_LIMITS,
} from '../subscription';

describe('subscription access invariant', () => {
  it('treats every stored tier as free full access', () => {
    expect(getEffectiveTier({ subscriptionTier: 'FREE', isBetaUser: false })).toBe('FREE');
    expect(getEffectiveTier({ subscriptionTier: 'PRO', isBetaUser: true })).toBe('FREE');
    expect(isBetaMode()).toBe(false);
  });

  it('includes formerly paid capabilities for free users', () => {
    expect(TIER_LIMITS.FREE.maxCards).toBe(Infinity);
    expect(TIER_LIMITS.FREE.maxEmailAlertsPerMonth).toBe(Infinity);
    expect(TIER_LIMITS.FREE.customExpirationDays).toBe(true);
    expect(getEffectiveExpirationDays('FREE', 30)).toBe(30);
    expect(getTierDisplayName('PRO', true)).toBe('Free');
  });
});
