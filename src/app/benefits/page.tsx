import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BenefitsDisplayClient from '@/components/BenefitsDisplayClient';
import { Metadata } from 'next';
import {
  buildBenefitDashboardProjection,
  type DisplayBenefitStatus,
} from '@/lib/benefit-dashboard';

export const metadata: Metadata = {
  title: "Benefits Dashboard - Track All Your Credit Card Benefits",
  description: "Track and manage all your credit card benefits in one place. Monitor upcoming credits, expiring benefits, and maximize your annual fee ROI.",
  keywords: [
    'credit card benefits dashboard',
    'track credit card benefits',
    'benefits tracker',
    'credit card perks',
    'annual fee ROI'
  ],
  alternates: {
    canonical: '/benefits',
  },
};

export type { DisplayBenefitStatus };

export default async function BenefitsDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/benefits');
  }
  const userId = session.user.id;
  const now = new Date(); // Revert to actual system time

  // Fetch source records, then let the dashboard projection module own display shaping.
  const userCards = await prisma.creditCard.findMany({
    where: { userId },
  });

  const usageWays = await prisma.benefitUsageWay.findMany({
    include: {
      predefinedBenefits: {
        select: {
          category: true,
          description: true,
        },
      },
    },
  });

  const allStatusesRaw = await prisma.benefitStatus.findMany({
    where: {
      userId: userId,
    },
    include: {
      benefit: {
        include: {
          creditCard: true, 
        },
      },
    },
    orderBy: [
      {
        orderIndex: 'asc', // Primary sort by user's preferred order
      },
      {
        cycleEndDate: 'asc', // Secondary sort by cycle end date
      },
    ],
  });

  const predefinedCardsForRoi = await prisma.predefinedCard.findMany({
    where: { name: { in: userCards.map((card) => card.name) } },
    select: { name: true, annualFee: true },
  });

  const projection = buildBenefitDashboardProjection({
    statuses: allStatusesRaw,
    userCards,
    usageWays,
    predefinedCardFees: predefinedCardsForRoi,
    now,
  });

  // --- Render Component ---
  return (
    <BenefitsDisplayClient
      {...projection}
    />
  );
}
