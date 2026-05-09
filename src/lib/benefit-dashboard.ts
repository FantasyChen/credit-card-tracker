export type BenefitDashboardFrequency =
  | 'ALL'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'
  | 'ONE_TIME';

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
