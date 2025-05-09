import React from 'react'; // useTransition will be in the client component
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BenefitStatus, Benefit, CreditCard as PrismaCreditCard } from '@/generated/prisma';
import { formatDate } from '@/lib/dateUtils';
import BenefitCardClient from '@/components/BenefitCardClient'; // Import the new client component
// We will create a new client component for the list and cards
// import BenefitListClient from '@/components/BenefitListClient'; 

// Type for CreditCard that includes its displayName
interface CreditCardWithDisplayName extends PrismaCreditCard {
  displayName: string;
  // If FetchedUserCard from cards/page.tsx includes benefits on the card itself, ensure consistency or map as needed
  // For this page, benefits come via BenefitStatus -> Benefit -> CreditCard, so card.benefits isn't directly on the card here
}

// Updated Type combining BenefitStatus with Benefit and Card details (with displayName) for display
export interface DisplayBenefitStatus extends BenefitStatus { // Export for use in client component
  benefit: Benefit & { creditCard: CreditCardWithDisplayName };
}

export default async function BenefitsDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/benefits');
  }
  const userId = session.user.id;

  // 1. Fetch all user's cards to determine display names
  const userCards = await prisma.creditCard.findMany({
    where: { userId },
    // No need to include benefits here, as displayName logic only uses name and issuer
  });

  // 2. Calculate displayNames for each card
  const cardCounts: { [key: string]: number } = {};
  userCards.forEach(card => {
    const cardKey = `${card.name}-${card.issuer}`; 
    cardCounts[cardKey] = (cardCounts[cardKey] || 0) + 1;
  });

  const cardIndices: { [key: string]: number } = {};
  const cardsWithDisplayName: CreditCardWithDisplayName[] = userCards.map(card => {
    const cardKey = `${card.name}-${card.issuer}`;
    let determinedDisplayName = card.name; // Use a different variable name to avoid conflict with card.displayName if it ever exists
    if (cardCounts[cardKey] > 1) {
      cardIndices[cardKey] = (cardIndices[cardKey] || 0) + 1;
      determinedDisplayName = `${card.name} #${cardIndices[cardKey]}`;
    }
    return {
        ...card, 
        displayName: determinedDisplayName,
    };
  });
  
  const cardDisplayNameMap = new Map<string, string>(
    cardsWithDisplayName.map(card => [card.id, card.displayName])
  );

  // Fetch All Relevant Benefit Statuses for Display
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
    orderBy: {
      cycleEndDate: 'asc',
    },
  });

  // 3. Augment statuses with card displayName
  const allStatuses: DisplayBenefitStatus[] = allStatusesRaw.map(status => {
    const cardOriginal = status.benefit.creditCard;
    const resolvedDisplayName = cardDisplayNameMap.get(cardOriginal.id) || cardOriginal.name;
    return {
      ...status,
      benefit: {
        ...status.benefit,
        creditCard: {
          ...cardOriginal,
          displayName: resolvedDisplayName,
        },
      },
    };
  });

  const upcomingBenefits = allStatuses.filter(status => !status.isCompleted);
  const completedBenefits = allStatuses.filter(status => status.isCompleted);

  // --- Render Component --- 
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Benefits Dashboard</h1>

      {/* Upcoming Benefits Section */} 
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Upcoming / Pending Benefits</h2>
        {/* Replace with client component, passing upcomingBenefits */}
        {/* <BenefitListClient benefits={upcomingBenefits} listTitle="Upcoming / Pending Benefits" /> */}
        {/* For now, let's put the direct map here and move BenefitCard to a new file */}
        {upcomingBenefits.length === 0 ? <p className="text-gray-500">No upcoming benefits found.</p> : 
          upcomingBenefits.map(status => <BenefitCardClient key={status.id} status={status} />)
        }
      </section>

      {/* Completed Benefits Section */} 
      <section>
        <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Completed Benefits</h2>
        {/* Replace with client component, passing completedBenefits */}
        {/* <BenefitListClient benefits={completedBenefits} listTitle="Completed Benefits" /> */}
        {completedBenefits.length === 0 ? <p className="text-gray-500">No completed benefits.</p> : 
          completedBenefits.map(status => <BenefitCardClient key={status.id} status={status} />)
        }
      </section>
    </div>
  );
}

// --- BenefitCard will be moved to BenefitCardClient.tsx --- 