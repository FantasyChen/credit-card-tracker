import { prisma } from '@/lib/prisma';
import type { Benefit, BenefitStatus, CreditCard } from '@/generated/prisma';

export interface UpcomingBenefit extends BenefitStatus {
  benefit: Benefit & { creditCard: CreditCard };
}

export async function loadHomeDashboardData(userId: string) {
  const cardCount = await prisma.creditCard.count({
    where: { userId },
  });

  const userCards = await prisma.creditCard.findMany({
    where: { userId },
    select: { name: true },
  });

  const cardCounts = userCards.reduce((acc, card) => {
    acc[card.name] = (acc[card.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalAnnualFees = await prisma.predefinedCard.findMany({
    where: {
      name: {
        in: Object.keys(cardCounts),
      },
    },
  }).then((predefinedCards) => {
    return predefinedCards.reduce((total, card) => {
      const quantity = cardCounts[card.name] || 1;
      return total + (card.annualFee * quantity);
    }, 0);
  });

  const totalClaimedValue = await prisma.benefitStatus.findMany({
    where: {
      userId,
      isNotUsable: false,
    },
    select: {
      usedAmount: true,
    },
  }).then((statuses) => {
    return statuses.reduce((total, status) => total + (status.usedAmount ?? 0), 0);
  });

  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const expiringSoonBenefits = await prisma.benefitStatus.findMany({
    where: {
      userId,
      isCompleted: false,
      cycleStartDate: { lte: now },
      cycleEndDate: { gte: now, lte: sevenDaysFromNow },
    },
    include: {
      benefit: {
        include: {
          creditCard: true,
        },
      },
    },
    orderBy: {
      cycleEndDate: 'asc',
    },
  }) as UpcomingBenefit[];

  const upcomingBenefits = await prisma.benefitStatus.findMany({
    where: {
      userId,
      isCompleted: false,
      cycleStartDate: { lte: now },
      cycleEndDate: { gt: sevenDaysFromNow },
    },
    include: {
      benefit: {
        include: {
          creditCard: true,
        },
      },
    },
    orderBy: {
      cycleEndDate: 'asc',
    },
    take: 5,
  }) as UpcomingBenefit[];

  return {
    cardCount,
    totalAnnualFees,
    totalClaimedValue,
    expiringSoonBenefits,
    upcomingBenefits,
  };
}
