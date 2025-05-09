import React from 'react'; // useTransition will be in the client component
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BenefitStatus, Benefit, CreditCard } from '@/generated/prisma';
import { formatDate } from '@/lib/dateUtils';
import BenefitCardClient from '@/components/BenefitCardClient'; // Import the new client component
// We will create a new client component for the list and cards
// import BenefitListClient from '@/components/BenefitListClient'; 

// Type combining BenefitStatus with Benefit and Card details for display
export interface DisplayBenefitStatus extends BenefitStatus { // Export for use in client component
  benefit: Benefit & { creditCard: CreditCard };
}

export default async function BenefitsDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/benefits');
  }
  const userId = session.user.id;

  // --- Fetch All Relevant Statuses for Display ---
  const allStatuses = await prisma.benefitStatus.findMany({
    where: {
      userId: userId,
      // Optional: Add condition to only fetch statuses for cycles ending recently or in the future
      // cycleEndDate: { gte: somePastDate }, 
    },
    include: {
      benefit: {
        include: {
          creditCard: true, // Include card details for context
        },
      },
    },
    orderBy: {
      cycleEndDate: 'asc', // Order by end date
    },
  });

  // Filter into upcoming and completed
  const upcomingBenefits = allStatuses.filter(status => !status.isCompleted) as DisplayBenefitStatus[];
  const completedBenefits = allStatuses.filter(status => status.isCompleted) as DisplayBenefitStatus[];

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