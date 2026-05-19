/**
 * Loyalty URL helper tests
 */

import { buildLoyaltyCallbackUrl, buildLoyaltySignInRedirect } from '../loyalty-links';

describe('loyalty link helpers', () => {
  it('builds callback URLs only for loyalty hosts', () => {
    expect(buildLoyaltyCallbackUrl('loyalty.perks-reminder.com')).toBe(
      'https://loyalty.perks-reminder.com/loyalty'
    );
    expect(buildLoyaltyCallbackUrl('loyalty.localhost:3000')).toBe(
      'http://loyalty.localhost:3000/loyalty'
    );
    expect(buildLoyaltyCallbackUrl('localhost:3000')).toBeNull();
  });

  it('builds loyalty sign-in redirects from an explicit host', () => {
    expect(buildLoyaltySignInRedirect('loyalty.perks-reminder.com')).toBe(
      'https://www.perks-reminder.com/api/auth/signin?callbackUrl=https%3A%2F%2Floyalty.perks-reminder.com%2Floyalty'
    );
    expect(buildLoyaltySignInRedirect('loyalty.localhost:3000')).toBe(
      'http://localhost:3000/api/auth/signin?callbackUrl=http%3A%2F%2Floyalty.localhost%3A3000%2Floyalty'
    );
    expect(buildLoyaltySignInRedirect('localhost:3000')).toBe('/api/auth/signin?callbackUrl=/loyalty');
  });
});
