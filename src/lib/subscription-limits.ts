// Pure subscription configuration shared by server and client code.

export const TIER_LIMITS = {
  FREE: {
    maxCards: 5,
    maxEmailAlertsPerMonth: 2,
    customExpirationDays: false,
    defaultExpirationDays: 7,
    prioritySupport: false,
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
