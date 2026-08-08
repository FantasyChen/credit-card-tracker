import type { SubscriptionTier } from '@/generated/prisma';

export type EffectiveSubscriptionTier = 'FREE';

/**
 * Stored subscription fields remain for compatibility, but Perks Reminder has
 * one product policy: every account receives the full free product.
 */
export function getEffectiveTier(user: {
  subscriptionTier: SubscriptionTier;
  isBetaUser: boolean;
}): EffectiveSubscriptionTier {
  void user;
  return 'FREE';
}
