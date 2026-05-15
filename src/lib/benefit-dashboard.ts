import type { Benefit, BenefitStatus, CreditCard as PrismaCreditCard } from '@/generated/prisma';
import { createCardDisplayNameMap } from '@/lib/cardDisplayUtils';

export type BenefitDashboardFrequency =
  | 'ALL'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'
  | 'ONE_TIME';

export const CUSTOM_BENEFITS_CARD_NAME = '⭐ Custom Benefits';

export interface CreditCardWithDisplayName extends PrismaCreditCard {
  displayName: string;
}

export interface DisplayBenefitStatus extends BenefitStatus {
  benefit: Benefit & {
    creditCard: CreditCardWithDisplayName | null;
  };
  usageWaySlug?: string | null;
  isCustomBenefit?: boolean;
}

export type RawDisplayBenefitStatus = BenefitStatus & {
  benefit: Benefit & {
    creditCard: PrismaCreditCard | null;
  };
};

export interface UsageWayForDashboard {
  slug: string;
  predefinedBenefits: Array<{
    category: string;
    description: string;
  }>;
}

export interface PredefinedCardFee {
  name: string;
  annualFee: number;
}

export interface CardLevelRoi {
  cardDisplayName: string;
  cardName: string;
  annualFee: number;
  claimedValue: number;
  netRoi: number;
}

export interface BenefitDashboardProjection {
  upcomingBenefits: DisplayBenefitStatus[];
  completedBenefits: DisplayBenefitStatus[];
  notUsableBenefits: DisplayBenefitStatus[];
  scheduledBenefits: DisplayBenefitStatus[];
  totalUnusedValue: number;
  totalUsedValue: number;
  totalNotUsableValue: number;
  totalAnnualFees: number;
  cardLevelRoi: CardLevelRoi[];
}

export interface BenefitDashboardFilters {
  frequency: BenefitDashboardFrequency;
  freeNightOnly: boolean;
}

export interface BenefitDashboardStatus {
  id: string;
  cycleEndDate: Date | string;
  isCompleted: boolean;
  isNotUsable?: boolean;
  usedAmount: number | null;
  benefit: {
    description: string;
    category: string;
    frequency: string;
    maxAmount: number | null;
  };
}

export interface BenefitGroupSummary {
  remainingValue: number;
  claimedValue: number;
  partialCount: number;
  soonestDueDate: Date | null;
}

const FREE_NIGHT_TERMS = [
  'free night',
  'award night',
  'certificate',
  'cert',
  'companion',
];

export function isFreeNightOrCertificateBenefit(status: BenefitDashboardStatus): boolean {
  const description = status.benefit.description.toLowerCase();
  return FREE_NIGHT_TERMS.some((term) => description.includes(term));
}

export function applyBenefitDashboardFilters<T extends BenefitDashboardStatus>(
  benefits: T[],
  filters: BenefitDashboardFilters
): T[] {
  return benefits.filter((status) => {
    const matchesFrequency =
      filters.frequency === 'ALL' || status.benefit.frequency === filters.frequency;
    const matchesFreeNight =
      !filters.freeNightOnly || isFreeNightOrCertificateBenefit(status);

    return matchesFrequency && matchesFreeNight;
  });
}

export function resolveBenefitClaimedValue(status: BenefitDashboardStatus): number {
  const usedAmount = Math.max(0, status.usedAmount ?? 0);
  if (status.isCompleted && usedAmount === 0) {
    return Math.max(0, status.benefit.maxAmount ?? 0);
  }
  return usedAmount;
}

export function calculateBenefitGroupSummary(
  benefits: BenefitDashboardStatus[]
): BenefitGroupSummary {
  return benefits.reduce<BenefitGroupSummary>(
    (summary, status) => {
      const maxAmount = Math.max(0, status.benefit.maxAmount ?? 0);
      const claimedValue = resolveBenefitClaimedValue(status);
      const remainingValue = status.isCompleted || status.isNotUsable
        ? 0
        : Math.max(0, maxAmount - claimedValue);
      const cycleEndDate = new Date(status.cycleEndDate);

      return {
        remainingValue: summary.remainingValue + remainingValue,
        claimedValue: summary.claimedValue + claimedValue,
        partialCount:
          summary.partialCount +
          (claimedValue > 0 && !status.isCompleted && !status.isNotUsable ? 1 : 0),
        soonestDueDate:
          summary.soonestDueDate === null || cycleEndDate < summary.soonestDueDate
            ? cycleEndDate
            : summary.soonestDueDate,
      };
    },
    {
      remainingValue: 0,
      claimedValue: 0,
      partialCount: 0,
      soonestDueDate: null,
    }
  );
}

export function buildUsageWaySlugMap(usageWays: UsageWayForDashboard[]): Map<string, string> {
  const usageWayMap = new Map<string, string>();

  for (const way of usageWays) {
    for (const benefit of way.predefinedBenefits) {
      usageWayMap.set(`${benefit.category}:${benefit.description}`, way.slug);
    }
  }

  return usageWayMap;
}

export function augmentBenefitStatusesForDashboard(
  statuses: RawDisplayBenefitStatus[],
  userCards: PrismaCreditCard[],
  usageWays: UsageWayForDashboard[]
): DisplayBenefitStatus[] {
  const cardDisplayNameMap = createCardDisplayNameMap(userCards);
  const usageWayMap = buildUsageWaySlugMap(usageWays);

  return statuses.map((status) => {
    const cardOriginal = status.benefit.creditCard;
    const usageWaySlug =
      usageWayMap.get(`${status.benefit.category}:${status.benefit.description}`) ?? null;

    if (!cardOriginal) {
      return {
        ...status,
        benefit: {
          ...status.benefit,
          creditCard: null,
        },
        usageWaySlug,
        isCustomBenefit: true,
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
      isCustomBenefit: false,
    };
  });
}

export function deduplicateBenefitStatusesForDashboard(
  statuses: DisplayBenefitStatus[]
): DisplayBenefitStatus[] {
  const groups = new Map<string, DisplayBenefitStatus[]>();

  for (const status of statuses) {
    const dateOnly = new Date(status.cycleStartDate).toISOString().split('T')[0];
    const key = `${status.benefitId}|${dateOnly}|${status.occurrenceIndex}`;
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
  const cardCounts = userCards.reduce((acc, card) => {
    acc[card.name] = (acc[card.name] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const annualFeeByCardName = new Map(predefinedCardFees.map((card) => [card.name, card.annualFee]));
  const totalAnnualFees = Object.entries(cardCounts).reduce((total, [cardName, quantity]) => {
    return total + ((annualFeeByCardName.get(cardName) ?? 0) * quantity);
  }, 0);

  const claimedByCardKey = new Map<string, number>();
  for (const status of statuses) {
    const used = resolveBenefitClaimedValue(status);
    const key = status.benefit.creditCard?.name ?? CUSTOM_BENEFITS_CARD_NAME;
    claimedByCardKey.set(key, (claimedByCardKey.get(key) ?? 0) + used);
  }

  const cardLevelRoi: CardLevelRoi[] = Object.entries(cardCounts).map(([cardName, quantity]) => {
    const annualFee = (annualFeeByCardName.get(cardName) ?? 0) * quantity;
    const claimedValue = claimedByCardKey.get(cardName) ?? 0;
    const firstCard = userCards.find((card) => card.name === cardName);
    const cardDisplayName = quantity > 1
      ? `${cardName} (${quantity} cards)`
      : firstCard
        ? (cardDisplayNameMap.get(firstCard.id) ?? cardName)
        : cardName;

    return {
      cardDisplayName,
      cardName,
      annualFee,
      claimedValue,
      netRoi: claimedValue - annualFee,
    };
  });

  const customClaimed = claimedByCardKey.get(CUSTOM_BENEFITS_CARD_NAME) ?? 0;
  if (customClaimed > 0) {
    cardLevelRoi.push({
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
}: {
  statuses: RawDisplayBenefitStatus[];
  userCards: PrismaCreditCard[];
  usageWays: UsageWayForDashboard[];
  predefinedCardFees: PredefinedCardFee[];
  now: Date;
}): BenefitDashboardProjection {
  const augmentedStatuses = augmentBenefitStatusesForDashboard(statuses, userCards, usageWays);
  const deduplicatedStatuses = deduplicateBenefitStatusesForDashboard(augmentedStatuses);
  const partitions = partitionBenefitStatusesForDashboard(deduplicatedStatuses, now);
  const totals = calculateBenefitDashboardTotals(partitions);
  const roi = calculateCardLevelRoi(
    [...partitions.upcomingBenefits, ...partitions.completedBenefits],
    userCards,
    predefinedCardFees
  );

  return {
    ...partitions,
    ...totals,
    ...roi,
  };
}
