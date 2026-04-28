import { prisma } from '@/lib/prisma';
import { SubscriptionTier } from '@/generated/prisma';
import { TIER_LIMITS, type TierName } from './subscription-limits';

export { TIER_LIMITS, type TierName } from './subscription-limits';

// Whether the application is in beta mode (all registered users get Pro)
export function isBetaMode(): boolean {
  return process.env.BETA_MODE !== 'false'; // Default true unless explicitly disabled
}

// ---------------------------------------------------------------------------
// Effective Tier
// ---------------------------------------------------------------------------

/**
 * Returns the effective subscription tier for a user.
 * Beta users are treated as Pro regardless of their stored tier.
 */
export function getEffectiveTier(user: {
  subscriptionTier: SubscriptionTier;
  isBetaUser: boolean;
}): TierName {
  if (user.isBetaUser && isBetaMode()) {
    return 'PRO';
  }
  return user.subscriptionTier;
}

/**
 * Fetch a user's effective tier from the database.
 */
export async function getUserTier(userId: string): Promise<TierName> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, isBetaUser: true },
  });
  if (!user) return 'FREE';
  return getEffectiveTier(user);
}

export async function getUserSubscriptionStatus(userId: string): Promise<{
  tier: TierName;
  storedTier: SubscriptionTier;
  isBetaUser: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, isBetaUser: true },
  });

  if (!user) {
    return { tier: 'FREE', storedTier: 'FREE', isBetaUser: false };
  }

  return {
    tier: getEffectiveTier(user),
    storedTier: user.subscriptionTier,
    isBetaUser: user.isBetaUser,
  };
}

// ---------------------------------------------------------------------------
// Card Limits
// ---------------------------------------------------------------------------

/**
 * Check if a user can add another card.
 */
export async function canAddCard(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
  if (limits.maxCards === Infinity) return true;

  const cardCount = await prisma.creditCard.count({
    where: { userId },
  });
  return cardCount < limits.maxCards;
}

/**
 * Get the user's card count and limit for display purposes.
 */
export async function getCardUsage(userId: string): Promise<{
  current: number;
  limit: number | null; // null = unlimited
  canAdd: boolean;
}> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
  const cardCount = await prisma.creditCard.count({
    where: { userId },
  });

  const limit = limits.maxCards === Infinity ? null : limits.maxCards;
  return {
    current: cardCount,
    limit,
    canAdd: limit === null || cardCount < limit,
  };
}

// ---------------------------------------------------------------------------
// Email Alert Limits
// ---------------------------------------------------------------------------

/**
 * Check if a user can receive another email alert this month.
 */
export async function canSendEmailAlert(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      isBetaUser: true,
      emailAlertsUsed: true,
      emailAlertsResetAt: true,
    },
  });
  if (!user) return false;

  const tier = getEffectiveTier(user);
  const limits = TIER_LIMITS[tier];
  if (limits.maxEmailAlertsPerMonth === Infinity) return true;

  // Check if the counter needs resetting (new month)
  const now = new Date();
  const resetAt = user.emailAlertsResetAt;
  if (!resetAt || now.getUTCMonth() !== resetAt.getUTCMonth() || now.getUTCFullYear() !== resetAt.getUTCFullYear()) {
    // Different month — user hasn't used any alerts this month yet
    return true;
  }

  return user.emailAlertsUsed < limits.maxEmailAlertsPerMonth;
}

/**
 * Increment the email alert counter for a user.
 * Resets the counter if we've crossed into a new month.
 */
export async function incrementEmailAlertCount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailAlertsUsed: true, emailAlertsResetAt: true },
  });
  if (!user) return;

  const now = new Date();
  const resetAt = user.emailAlertsResetAt;
  const isNewMonth = !resetAt || 
    now.getUTCMonth() !== resetAt.getUTCMonth() || 
    now.getUTCFullYear() !== resetAt.getUTCFullYear();

  if (isNewMonth) {
    // Reset counter for new month
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailAlertsUsed: 1,
        emailAlertsResetAt: now,
      },
    });
  } else {
    // Increment existing counter
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailAlertsUsed: { increment: 1 },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Email Alert Usage (for display)
// ---------------------------------------------------------------------------

export async function getEmailAlertUsage(userId: string): Promise<{
  used: number;
  limit: number | null; // null = unlimited
  canSend: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      isBetaUser: true,
      emailAlertsUsed: true,
      emailAlertsResetAt: true,
    },
  });
  if (!user) return { used: 0, limit: 2, canSend: false };

  const tier = getEffectiveTier(user);
  const limits = TIER_LIMITS[tier];
  const limit = limits.maxEmailAlertsPerMonth === Infinity ? null : limits.maxEmailAlertsPerMonth;

  // Check if counter should be treated as reset (new month)
  const now = new Date();
  const resetAt = user.emailAlertsResetAt;
  const isNewMonth = !resetAt ||
    now.getUTCMonth() !== resetAt.getUTCMonth() ||
    now.getUTCFullYear() !== resetAt.getUTCFullYear();

  const used = isNewMonth ? 0 : user.emailAlertsUsed;
  const canSend = limit === null || used < limit;

  return { used, limit, canSend };
}

// ---------------------------------------------------------------------------
// Expiration Days
// ---------------------------------------------------------------------------

/**
 * Get the effective expiration days for a user.
 * Free users are locked to the default (7 days).
 */
export function getEffectiveExpirationDays(
  tier: TierName,
  userPreference: number | null | undefined
): number {
  const limits = TIER_LIMITS[tier];
  if (!limits.customExpirationDays) {
    return limits.defaultExpirationDays;
  }
  return userPreference ?? limits.defaultExpirationDays;
}

// ---------------------------------------------------------------------------
// Feature Gating
// ---------------------------------------------------------------------------

export type Feature = 'customExpirationDays' | 'prioritySupport' | 'unlimitedCards' | 'unlimitedEmailAlerts';

export function isFeatureAvailable(tier: TierName, feature: Feature): boolean {
  switch (feature) {
    case 'customExpirationDays':
      return TIER_LIMITS[tier].customExpirationDays;
    case 'prioritySupport':
      return TIER_LIMITS[tier].prioritySupport;
    case 'unlimitedCards':
      return TIER_LIMITS[tier].maxCards === Infinity;
    case 'unlimitedEmailAlerts':
      return TIER_LIMITS[tier].maxEmailAlertsPerMonth === Infinity;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Beta Enrollment
// ---------------------------------------------------------------------------

/**
 * Enroll a user as a beta user (called during signup when BETA_MODE is active).
 */
export async function enrollBetaUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isBetaUser: true,
      betaEnrolledAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Tier Display Helpers
// ---------------------------------------------------------------------------

export function getTierDisplayName(tier: TierName, isBetaUser: boolean): string {
  if (isBetaUser && isBetaMode()) {
    return 'Pro (Beta)';
  }
  return tier === 'PRO' ? 'Pro' : 'Free';
}

export function getTierBadgeColor(tier: TierName, isBetaUser: boolean): string {
  if (tier === 'PRO' || (isBetaUser && isBetaMode())) {
    return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}
