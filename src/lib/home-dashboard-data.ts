import { prisma } from '@/lib/prisma';
import {
  fetchEffectiveBenefitStatuses,
  fetchEffectiveCardTerms,
  type EffectiveBenefitStatus,
} from '@/lib/effective-benefit';

export type UpcomingBenefit = EffectiveBenefitStatus;

export async function loadHomeDashboardData(userId: string) {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [cardTerms, claimedStatuses, activeStatuses] = await Promise.all([
    fetchEffectiveCardTerms(prisma, userId),
    prisma.benefitStatus.findMany({
      where: { userId, isNotUsable: false },
      select: { usedAmount: true },
    }),
    fetchEffectiveBenefitStatuses(prisma, {
      userId,
      completed: false,
      notUsable: false,
      cycleStartOnOrBefore: now,
      cycleEndOnOrAfter: now,
    }),
  ]);

  const cardCount = cardTerms.length;
  const totalAnnualFees = cardTerms.reduce((total, card) => total + card.annualFee, 0);
  const totalClaimedValue = claimedStatuses.reduce(
    (total, status) => total + (status.usedAmount ?? 0),
    0
  );
  const expiringSoonBenefits = activeStatuses
    .filter((status) => status.cycleEndDate <= sevenDaysFromNow)
    .sort((left, right) => left.cycleEndDate.getTime() - right.cycleEndDate.getTime());
  const upcomingBenefits = activeStatuses
    .filter((status) => status.cycleEndDate > sevenDaysFromNow)
    .sort((left, right) => left.cycleEndDate.getTime() - right.cycleEndDate.getTime())
    .slice(0, 5);

  return {
    cardCount,
    totalAnnualFees,
    totalClaimedValue,
    expiringSoonBenefits,
    upcomingBenefits,
  };
}
