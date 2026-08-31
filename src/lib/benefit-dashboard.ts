import type { CreditCard as PrismaCreditCard, Prisma, PrismaClient } from '@/generated/prisma';
import {
  fetchEffectiveBenefitStatuses,
  fetchEffectiveCardTerms,
} from '@/lib/effective-benefit';
import type { EffectiveBenefitStatus } from '@/lib/effective-benefit';
import { createCardDisplayNameMap } from '@/lib/cardDisplayUtils';

import {
  CUSTOM_BENEFITS_CARD_NAME,
  resolveBenefitClaimedValue,
} from '@/lib/benefit-dashboard-client';
import type {
  CardLevelRoi,
  DisplayBenefitStatus,
} from '@/lib/benefit-dashboard-client';

// Keep the established dashboard module as the server orchestration owner,
// while preserving its shared type/helper API for existing server consumers.
export {
  applyBenefitDashboardFilters,
  calculateBenefitGroupSummary,
  CUSTOM_BENEFITS_CARD_NAME,
  isFreeNightOrCertificateBenefit,
  resolveBenefitClaimedValue,
} from '@/lib/benefit-dashboard-client';
export type {
  BenefitDashboardFilters,
  BenefitDashboardFrequency,
  BenefitDashboardStatus,
  BenefitGroupSummary,
  CardLevelRoi,
  CreditCardWithDisplayName,
  DashboardCreditCard,
  DisplayBenefitStatus,
} from '@/lib/benefit-dashboard-client';

import {
  excludeIgnoredBenefits,
  resolveBenefitTrackingMode,
  type BenefitTrackingModeMap,
} from '@/lib/benefit-tracking-modes';
import { loadBenefitTrackingModes } from '@/lib/benefit-tracking-preferences';

export interface UsageWayForDashboard {
  slug: string;
  predefinedBenefits: Array<{
    category: string;
    description: string;
    predefinedCard?: {
      name: string;
    } | null;
  }>;
}

export interface PredefinedCardFee {
  name: string;
  annualFee: number;
}

export interface BenefitDashboardProjection {
  upcomingBenefits: DisplayBenefitStatus[];
  completedBenefits: DisplayBenefitStatus[];
  /** Benefits explicitly excluded from tracking, kept visible for review/restoration. */
  ignoredBenefits: DisplayBenefitStatus[];
  notUsableBenefits: DisplayBenefitStatus[];
  scheduledBenefits: DisplayBenefitStatus[];
  totalUnusedValue: number;
  totalUsedValue: number;
  totalNotUsableValue: number;
  totalAnnualFees: number;
  cardLevelRoi: CardLevelRoi[];
}

export type RawDisplayBenefitStatus = EffectiveBenefitStatus;

export function buildUsageWaySlugMap(usageWays: UsageWayForDashboard[]): Map<string, string> {
  const usageWayMap = new Map<string, string>();

  for (const way of usageWays) {
    for (const benefit of way.predefinedBenefits) {
      usageWayMap.set(`${benefit.category}:${benefit.description}`, way.slug);
      if (benefit.predefinedCard?.name) {
        usageWayMap.set(`${benefit.predefinedCard.name}:${benefit.category}:${benefit.description}`, way.slug);
      }
    }
  }

  return usageWayMap;
}

export function augmentBenefitStatusesForDashboard(
  statuses: RawDisplayBenefitStatus[],
  userCards: PrismaCreditCard[],
  usageWays: UsageWayForDashboard[],
  trackingModes?: BenefitTrackingModeMap
): DisplayBenefitStatus[] {
  const authoritativeCards = new Map<string, {
    id: string;
    name: string;
    issuer: string;
    lastFourDigits: string | null;
    nickname: string | null;
  }>(userCards.map((card) => [card.id, card]));
  for (const status of statuses) {
    const card = status.benefit.creditCard;
    if (card) authoritativeCards.set(card.id, card);
  }
  const cardDisplayNameMap = createCardDisplayNameMap(
    Array.from(authoritativeCards.values())
  );
  const usageWayMap = buildUsageWaySlugMap(usageWays);

  return statuses.map((status) => {
    const cardOriginal = status.benefit.creditCard;
    const usageWaySlug =
      status.usageWaySlug ??
      (cardOriginal
        ? usageWayMap.get(`${cardOriginal.name}:${status.benefit.category}:${status.benefit.description}`)
        : null) ??
      usageWayMap.get(`${status.benefit.category}:${status.benefit.description}`) ?? null;

    if (!cardOriginal) {
      return {
        ...status,
        benefit: {
          ...status.benefit,
          creditCard: null,
        },
        usageWaySlug,
        trackingMode: resolveBenefitTrackingMode(trackingModes, status),
      };
    }

    return {
      ...status,
      benefit: {
        ...status.benefit,
        creditCard: {
          ...cardOriginal,
          displayName: cardDisplayNameMap.get(cardOriginal.id) ?? cardOriginal.name,
        },
      },
      usageWaySlug,
      trackingMode: resolveBenefitTrackingMode(trackingModes, status),
    };
  });
}

export function deduplicateBenefitStatusesForDashboard(
  statuses: DisplayBenefitStatus[]
): DisplayBenefitStatus[] {
  const groups = new Map<string, DisplayBenefitStatus[]>();

  for (const status of statuses) {
    const dateOnly = new Date(status.cycleStartDate).toISOString().split('T')[0];
    const definitionId = status.predefinedBenefitId ?? status.benefitId;
    const cardId = status.creditCardId ?? 'standalone';
    const key = `${cardId}|${definitionId}|${dateOnly}|${status.occurrenceIndex}`;
    const group = groups.get(key) ?? [];
    group.push(status);
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];

    return [...group].sort((a, b) => {
      if (a.isCompleted && !b.isCompleted) return -1;
      if (!a.isCompleted && b.isCompleted) return 1;
      if (a.isNotUsable && !b.isNotUsable) return -1;
      if (!a.isNotUsable && b.isNotUsable) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })[0];
  });
}

export function partitionBenefitStatusesForDashboard(
  statuses: DisplayBenefitStatus[],
  now: Date
): Pick<
  BenefitDashboardProjection,
  'upcomingBenefits' | 'completedBenefits' | 'notUsableBenefits' | 'scheduledBenefits'
> {
  const activeOrPastCycleStatuses = statuses.filter((status) => {
    return new Date(status.cycleStartDate) <= now;
  });

  return {
    upcomingBenefits: activeOrPastCycleStatuses.filter((status) => {
      const cycleStartDate = new Date(status.cycleStartDate);
      const cycleEndDate = new Date(status.cycleEndDate);
      return !status.isCompleted && !status.isNotUsable && cycleStartDate <= now && now <= cycleEndDate;
    }),
    completedBenefits: activeOrPastCycleStatuses.filter((status) => status.isCompleted),
    notUsableBenefits: activeOrPastCycleStatuses.filter((status) => status.isNotUsable),
    scheduledBenefits: statuses.filter((status) => new Date(status.cycleStartDate) > now),
  };
}

export function calculateBenefitDashboardTotals(
  partitions: Pick<
    BenefitDashboardProjection,
    'upcomingBenefits' | 'completedBenefits' | 'notUsableBenefits'
  >
): Pick<
  BenefitDashboardProjection,
  'totalUnusedValue' | 'totalUsedValue' | 'totalNotUsableValue'
> {
  const totalUnusedValue = partitions.upcomingBenefits.reduce((sum, status) => {
    const maxAmount = Math.max(0, status.benefit.maxAmount ?? 0);
    const usedAmount = Math.max(0, status.usedAmount ?? 0);
    return sum + Math.max(0, maxAmount - usedAmount);
  }, 0);

  const totalUsedValue = [
    ...partitions.upcomingBenefits,
    ...partitions.completedBenefits,
  ].reduce((sum, status) => sum + resolveBenefitClaimedValue(status), 0);

  const totalNotUsableValue = partitions.notUsableBenefits.reduce((sum, status) => {
    return sum + Math.max(0, status.benefit.maxAmount ?? 0);
  }, 0);

  return { totalUnusedValue, totalUsedValue, totalNotUsableValue };
}

export function calculateCardLevelRoi(
  statuses: DisplayBenefitStatus[],
  userCards: PrismaCreditCard[],
  predefinedCardFees: PredefinedCardFee[]
): { totalAnnualFees: number; cardLevelRoi: CardLevelRoi[] } {
  const cardDisplayNameMap = createCardDisplayNameMap(userCards);
  const annualFeeByCardName = new Map(predefinedCardFees.map((card) => [card.name, card.annualFee]));
  const totalAnnualFees = userCards.reduce((total, card) => {
    return total + (annualFeeByCardName.get(card.name) ?? 0);
  }, 0);

  const claimedByCardId = new Map<string, number>();
  let customClaimed = 0;
  for (const status of statuses) {
    const used = resolveBenefitClaimedValue(status);
    const cardId = status.benefit.creditCard?.id;
    if (!cardId) {
      customClaimed += used;
      continue;
    }
    claimedByCardId.set(cardId, (claimedByCardId.get(cardId) ?? 0) + used);
  }

  const cardLevelRoi: CardLevelRoi[] = userCards.map((card) => {
    const annualFee = annualFeeByCardName.get(card.name) ?? 0;
    const claimedValue = claimedByCardId.get(card.id) ?? 0;
    const cardDisplayName = cardDisplayNameMap.get(card.id) ?? card.name;

    return {
      cardId: card.id,
      cardDisplayName,
      cardName: card.name,
      annualFee,
      claimedValue,
      netRoi: claimedValue - annualFee,
    };
  });

  if (customClaimed > 0) {
    cardLevelRoi.push({
      cardId: null,
      cardDisplayName: CUSTOM_BENEFITS_CARD_NAME,
      cardName: CUSTOM_BENEFITS_CARD_NAME,
      annualFee: 0,
      claimedValue: customClaimed,
      netRoi: customClaimed,
    });
  }

  cardLevelRoi.sort((a, b) => b.netRoi - a.netRoi || b.claimedValue - a.claimedValue);

  return { totalAnnualFees, cardLevelRoi };
}

export function buildBenefitDashboardProjection({
  statuses,
  userCards,
  usageWays,
  predefinedCardFees,
  now,
  trackingModes,
}: {
  statuses: RawDisplayBenefitStatus[];
  userCards: PrismaCreditCard[];
  usageWays: UsageWayForDashboard[];
  predefinedCardFees: PredefinedCardFee[];
  now: Date;
  trackingModes?: BenefitTrackingModeMap;
}): BenefitDashboardProjection {
  // Keep ignored benefits in a dedicated read-only partition. They remain out
  // of tracked tabs, totals, and card-level ROI, while still being available
  // for users to review and restore.
  const augmentedStatuses = augmentBenefitStatusesForDashboard(statuses, userCards, usageWays, trackingModes);
  const deduplicatedStatuses = deduplicateBenefitStatusesForDashboard(augmentedStatuses);
  const ignoredBenefits = deduplicatedStatuses.filter((status) => status.trackingMode === 'IGNORE');
  const trackedStatuses = excludeIgnoredBenefits(deduplicatedStatuses, trackingModes);
  const partitions = partitionBenefitStatusesForDashboard(trackedStatuses, now);
  const totals = calculateBenefitDashboardTotals(partitions);
  const roi = calculateCardLevelRoi(
    [...partitions.upcomingBenefits, ...partitions.completedBenefits],
    userCards,
    predefinedCardFees
  );

  return {
    ...partitions,
    ignoredBenefits,
    ...totals,
    ...roi,
  };
}

type BenefitDashboardDatabase = Pick<
  PrismaClient,
  '$queryRaw' | 'benefitUsageWay' | 'creditCard' | 'user' | 'benefitTrackingPreference'
>;

export interface LoadedBenefitDashboard extends BenefitDashboardProjection {
  cardCount: number;
  notifyBenefitExpiration: boolean;
  notifyExpirationDays: number;
}

export interface HomeDashboardSummary {
  cardCount: number;
  totalAnnualFees: number;
  totalClaimedValue: number;
  expiringSoonBenefits: EffectiveBenefitStatus[];
  upcomingBenefits: EffectiveBenefitStatus[];
}

function calendarYearStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
}

function calendarYearEnd(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
}

async function fetchDashboardBenefitStatuses(
  database: BenefitDashboardDatabase,
  userId: string,
  now: Date
): Promise<RawDisplayBenefitStatus[]> {
  const historyStart = calendarYearStart(now);
  const statuses = await fetchEffectiveBenefitStatuses(database, {
    userId,
    cycleEndOnOrAfter: historyStart,
  });

  return statuses.filter((status) =>
    status.cycleEndDate >= now || status.isCompleted || status.isNotUsable
  );
}

function buildRelevantBenefitSignatureWhere(
  statuses: RawDisplayBenefitStatus[]
): Prisma.PredefinedBenefitWhereInput | null {
  const seen = new Set<string>();
  const OR: Prisma.PredefinedBenefitWhereInput[] = [];

  for (const status of statuses) {
    if (status.usageWaySlug) continue;
    const key = JSON.stringify([status.benefit.category, status.benefit.description]);
    if (seen.has(key)) continue;
    seen.add(key);
    OR.push({
      category: status.benefit.category,
      description: status.benefit.description,
    });
  }

  return OR.length > 0 ? { OR } : null;
}

async function fetchRelevantUsageWays(
  database: BenefitDashboardDatabase,
  statuses: RawDisplayBenefitStatus[]
): Promise<UsageWayForDashboard[]> {
  const predefinedBenefitWhere = buildRelevantBenefitSignatureWhere(statuses);
  if (!predefinedBenefitWhere) return [];

  const usageWays = await database.benefitUsageWay.findMany({
    where: {
      predefinedBenefits: {
        some: predefinedBenefitWhere,
      },
    },
    select: {
      slug: true,
      predefinedBenefits: {
        where: predefinedBenefitWhere,
        select: {
          category: true,
          description: true,
          predefinedCard: {
            select: { name: true },
          },
        },
      },
    },
  });

  return usageWays as UsageWayForDashboard[];
}

export async function loadBenefitDashboard(
  database: BenefitDashboardDatabase,
  input: { userId: string; now: Date }
): Promise<LoadedBenefitDashboard> {
  const { userId, now } = input;
  const [storedUserCards, cardTerms, statuses, trackingModes, notificationSettings] = await Promise.all([
    database.creditCard.findMany({ where: { userId } }),
    fetchEffectiveCardTerms(database, userId),
    fetchDashboardBenefitStatuses(database, userId, now),
    loadBenefitTrackingModes(database, userId),
    database.user.findUnique({
      where: { id: userId },
      select: {
        notifyBenefitExpiration: true,
        notifyExpirationDays: true,
      },
    }),
  ]);

  const termsByCardId = new Map(cardTerms.map((card) => [card.creditCardId, card]));
  const userCards = storedUserCards.map((card) => {
    const terms = termsByCardId.get(card.id);
    return terms ? { ...card, name: terms.name, issuer: terms.issuer } : card;
  });
  const usageWays = await fetchRelevantUsageWays(database, statuses);
  const projection = buildBenefitDashboardProjection({
    statuses,
    userCards,
    usageWays,
    predefinedCardFees: cardTerms.map((card) => ({
      name: card.name,
      annualFee: card.annualFee,
    })),
    now,
    trackingModes,
  });

  return {
    ...projection,
    cardCount: userCards.length,
    notifyBenefitExpiration: notificationSettings?.notifyBenefitExpiration ?? false,
    notifyExpirationDays: notificationSettings?.notifyExpirationDays ?? 7,
  };
}

export async function loadHomeDashboardSummary(
  database: BenefitDashboardDatabase,
  input: { userId: string; now: Date }
): Promise<HomeDashboardSummary> {
  const { userId, now } = input;
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [cardTerms, currentYearStatuses, rawActiveStatuses, trackingModes] = await Promise.all([
    fetchEffectiveCardTerms(database, userId),
    fetchEffectiveBenefitStatuses(database, {
      userId,
      cycleStartOnOrBefore: calendarYearEnd(now),
      cycleEndOnOrAfter: calendarYearStart(now),
    }),
    fetchEffectiveBenefitStatuses(database, {
      userId,
      completed: false,
      notUsable: false,
      cycleStartOnOrBefore: now,
      cycleEndOnOrAfter: now,
    }),
    loadBenefitTrackingModes(database, userId),
  ]);

  // Ignored benefits stay out of the home summary the same way they stay out
  // of the dashboard projection.
  const activeStatuses = excludeIgnoredBenefits(rawActiveStatuses, trackingModes);
  const yearStart = calendarYearStart(now);
  const yearEnd = calendarYearEnd(now);
  const claimedStatuses = deduplicateBenefitStatusesForDashboard(
    augmentBenefitStatusesForDashboard(
      excludeIgnoredBenefits(currentYearStatuses, trackingModes).filter((status) =>
        status.cycleStartDate <= yearEnd && status.cycleEndDate >= yearStart
      ),
      [],
      []
    )
  );
  const totalClaimedValue = claimedStatuses.reduce((total, status) => {
    return status.isNotUsable ? total : total + resolveBenefitClaimedValue(status);
  }, 0);

  return {
    cardCount: cardTerms.length,
    totalAnnualFees: cardTerms.reduce((total, card) => total + card.annualFee, 0),
    totalClaimedValue,
    expiringSoonBenefits: activeStatuses
      .filter((status) => status.cycleEndDate <= sevenDaysFromNow)
      .sort((left, right) => left.cycleEndDate.getTime() - right.cycleEndDate.getTime()),
    upcomingBenefits: activeStatuses
      .filter((status) => status.cycleEndDate > sevenDaysFromNow)
      .sort((left, right) => left.cycleEndDate.getTime() - right.cycleEndDate.getTime())
      .slice(0, 5),
  };
}
