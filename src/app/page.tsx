import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BenefitStatus, Benefit, CreditCard } from '@/generated/prisma';
import { formatDate } from '@/lib/dateUtils';

// Define a type for the upcoming benefits data
interface UpcomingBenefit extends BenefitStatus {
  benefit: Benefit & { creditCard: CreditCard };
}

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // If not signed in, show a landing page with a sign-in button
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            {/* You might want to add a logo here */}
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Welcome to CardTracker
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Track your credit cards and maximize your rewards.
            </p>
          </div>
          <div className="mt-8 space-y-6">
             <p className="text-center text-sm text-gray-600">
              Sign in to manage your cards and benefits.
            </p>
            <div>
              <Link
                href="/api/auth/signin"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userId = session.user.id;

  // Fetch card count
  const cardCount = await prisma.creditCard.count({
    where: { userId: userId },
  });

  // Fetch upcoming benefits (not completed, ordered by cycle end date, limit 5)
  const upcomingBenefits = await prisma.benefitStatus.findMany({
    where: {
      userId: userId,
      isCompleted: false,
      // Optional: Add a filter for cycleEndDate if needed, e.g., only show benefits ending soon
      // cycleEndDate: { gte: new Date() } 
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
    take: 5, // Limit to the next 5 upcoming benefits
  }) as UpcomingBenefit[]; // Type assertion

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold leading-6 text-gray-900">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            A quick overview of your cards and upcoming benefits.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link
            href="/cards/new"
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Add Card
          </Link>
        </div>
      </div>

      {/* Card Summary Section */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-6">
             <div className="flex items-center">
                <div className="flex-shrink-0">
                    {/* Placeholder icon, replace with a suitable one */}
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                    </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                    <dl>
                        <dt className="truncate text-sm font-medium text-gray-500">Total Cards</dt>
                        <dd>
                            <div className="text-lg font-medium text-gray-900">{cardCount}</div>
                        </dd>
                    </dl>
                </div>
            </div>
          </div>
           <div className="bg-gray-50 px-6 py-3">
                <div className="text-sm">
                    <Link href="/cards" className="font-medium text-indigo-600 hover:text-indigo-500">
                        View all cards
                    </Link>
                </div>
            </div>
        </div>
        {/* Add more summary cards here if needed */}
      </div>

      {/* Upcoming Benefits Section */}
      <div className="mt-8">
        <div className="sm:flex sm:items-center sm:justify-between">
            <h2 className="text-lg font-medium leading-6 text-gray-900">
              Upcoming Benefits
            </h2>
             <div className="mt-3 sm:ml-4 sm:mt-0">
                <Link href="/benefits" className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                    View all benefits
                </Link>
            </div>
        </div>
        
        {upcomingBenefits.length === 0 ? (
           <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-8 text-center">
                <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming benefits</h3>
                <p className="mt-1 text-sm text-gray-500">Add cards with benefits or check back later.</p>
           </div>
        ) : (
          <div className="mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
             <ul role="list" className="divide-y divide-gray-200 bg-white">
                {upcomingBenefits.map((status) => (
                    <li key={status.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="truncate">
                                <p className="truncate text-sm font-medium text-indigo-600">{status.benefit.description}</p>
                                <p className="mt-1 truncate text-sm text-gray-500">Card: {status.benefit.creditCard.name}</p>
                            </div>
                            <div className="ml-4 flex-shrink-0">
                                <p className="text-sm text-gray-900">Due: {formatDate(status.cycleEndDate)}</p>
                                {/* Optionally add a quick action link here */} 
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
           </div>
        )}
      </div>
    </div>
  );
}
