import { getEffectiveTier } from '../subscription';

describe('subscription access invariant', () => {
  it('treats every stored tier as free full access', () => {
    expect(getEffectiveTier({ subscriptionTier: 'FREE', isBetaUser: false })).toBe('FREE');
    expect(getEffectiveTier({ subscriptionTier: 'PRO', isBetaUser: true })).toBe('FREE');
  });
});
