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
import {
  fetchDashboardBenefitStatuses,
  fetchRelevantUsageWays,
} from '@/lib/benefit-dashboard-data';
import { fetchEffectiveCardTerms } from '@/lib/effective-benefit';

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
  const [storedUserCards, cardTerms, allStatusesRaw, notificationSettings] = await Promise.all([
    prisma.creditCard.findMany({
      where: { userId },
    }),
    fetchEffectiveCardTerms(prisma, userId),
    fetchDashboardBenefitStatuses(prisma, userId, now),
    prisma.user.findUnique({
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
  const usageWays = await fetchRelevantUsageWays(prisma, allStatusesRaw);

  const projection = buildBenefitDashboardProjection({
    statuses: allStatusesRaw,
    userCards,
    usageWays,
    predefinedCardFees: cardTerms.map((card) => ({
      name: card.name,
      annualFee: card.annualFee,
    })),
    now,
  });

  // --- Render Component ---
  return (
    <BenefitsDisplayClient
      {...projection}
      cardCount={userCards.length}
      notifyBenefitExpiration={notificationSettings?.notifyBenefitExpiration ?? false}
      notifyExpirationDays={notificationSettings?.notifyExpirationDays ?? 7}
    />
  );
}
