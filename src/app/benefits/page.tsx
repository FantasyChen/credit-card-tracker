import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BenefitFrequency, BenefitStatus, Benefit, CreditCard } from '@/generated/prisma'; // Import types
import { toggleBenefitStatusAction } from './actions';
import { formatDate } from '@/lib/dateUtils'; // Import the shared formatter

// Type combining BenefitStatus with Benefit and Card details for display
interface DisplayBenefitStatus extends BenefitStatus {
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
        {upcomingBenefits.length === 0 ? (
          <p className="text-gray-500">No upcoming benefits found for the current cycles.</p>
        ) : (
          <div className="space-y-4">
            {upcomingBenefits.map(status => (
              <BenefitCard key={status.id} status={status} />
            ))}
          </div>
        )}
      </section>

      {/* Completed Benefits Section */} 
      <section>
        <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Completed Benefits</h2>
        {completedBenefits.length === 0 ? (
          <p className="text-gray-500">No benefits marked as completed yet.</p>
        ) : (
          <div className="space-y-4">
            {completedBenefits.map(status => (
              <BenefitCard key={status.id} status={status} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// --- Sub-component for displaying a benefit card --- 
function BenefitCard({ status }: { status: DisplayBenefitStatus }) {
  return (
    <div className={`border rounded-lg p-4 shadow-sm flex items-center justify-between ${status.isCompleted ? 'bg-green-50' : 'bg-white'}`}>
      <div>
        <p className="font-medium text-lg">{status.benefit.description}</p>
        <p className="text-sm text-gray-600">
          Card: {status.benefit.creditCard.name} ({status.benefit.creditCard.issuer})
        </p>
        <p className="text-sm text-gray-500">
          Current Cycle Ends: {formatDate(status.cycleEndDate)}
        </p>
      </div>
      <form action={toggleBenefitStatusAction}>
        <input type="hidden" name="benefitStatusId" value={status.id} />
        <input type="hidden" name="isCompleted" value={status.isCompleted.toString()} />
        <button
          type="submit"
          className={`py-2 px-4 rounded text-sm font-medium transition duration-150 ease-in-out 
            ${status.isCompleted
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'}`}
        >
          {status.isCompleted ? 'Mark Pending' : 'Mark Complete'}
        </button>
      </form>
    </div>
  );
} 