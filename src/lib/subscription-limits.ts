// Pure access configuration shared by server and client code.
// Paid tiers are deprecated: every account gets the full product.

export const TIER_LIMITS = {
  FREE: {
    maxCards: Infinity,
    maxEmailAlertsPerMonth: Infinity,
    customExpirationDays: true,
    defaultExpirationDays: 7,
    prioritySupport: true,
  },
  PRO: {
    maxCards: Infinity,
    maxEmailAlertsPerMonth: Infinity,
    customExpirationDays: true,
    defaultExpirationDays: 7,
    prioritySupport: true,
  },
} as const;

export type TierName = keyof typeof TIER_LIMITS;
