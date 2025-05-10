import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { BenefitStatus, Benefit, CreditCard as PrismaCreditCard } from '@/generated/prisma';
import { formatDate } from '@/lib/dateUtils';
import { CreditCardIcon } from '@heroicons/react/24/outline';

// Define a type for the upcoming benefits data
interface UpcomingBenefit extends BenefitStatus {
  benefit: Benefit & { creditCard: PrismaCreditCard };
}

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // If not signed in, show a landing page with a sign-in button
    return (
      <section className="bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto grid min-h-screen max-w-screen-xl px-4 py-8 lg:grid-cols-12 lg:gap-8 lg:py-16 xl:gap-0">
          <div className="mr-auto place-self-center lg:col-span-7">
            <h1 className="mb-4 max-w-2xl text-4xl font-extrabold leading-none tracking-tight text-gray-900 dark:text-white md:text-5xl xl:text-6xl">
              Never Miss a Credit Card Benefit Again.
            </h1>
            <p className="mb-6 max-w-2xl font-light text-gray-500 dark:text-gray-300 md:text-lg lg:mb-8 lg:text-xl">
              CouponCycle helps you track every perk, understand your benefit cycles, and maximize the value from your annual fees.
            </p>
            <Link
              href="/api/auth/signin"
              className="mb-2 mr-2 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-center text-base font-medium text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-900"
            >
              Get Started - Sign In
              <svg className="ml-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
              </svg>
            </Link>
            {/* Optional: Secondary CTA if you add a features section later */}
            {/* <Link href="#features" className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-center text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700 dark:focus:ring-gray-800">
              Learn More
            </Link> */}
          </div>
          <div className="hidden lg:col-span-5 lg:mt-0 lg:flex lg:items-center lg:justify-center">
            <img src="/hero-image.jpg" alt="CouponCycle - Maximize your credit card benefits" className="rounded-lg object-contain w-full h-auto max-h-[70vh]" />
          </div>
        </div>
      </section>
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
          <h1 className="text-2xl font-semibold leading-6 text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
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
        <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
          <div className="p-6">
             <div className="flex items-center">
                <div className="flex-shrink-0">
                    <CreditCardIcon className="h-8 w-8 text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                    <dl>
                        <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Cards</dt>
                        <dd>
                            <div className="text-lg font-medium text-gray-900 dark:text-white">{cardCount}</div>
                        </dd>
                    </dl>
                </div>
            </div>
          </div>
           <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3">
                <div className="text-sm">
                    <Link href="/cards" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
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
            <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
              Upcoming Benefits
            </h2>
             <div className="mt-3 sm:ml-4 sm:mt-0">
                <Link href="/benefits" className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-600">
                    View all benefits
                </Link>
            </div>
        </div>
        
        {upcomingBenefits.length === 0 ? (
           <div className="mt-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No upcoming benefits</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add cards with benefits or check back later.</p>
           </div>
        ) : (
          <div className="mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
             <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                {upcomingBenefits.map((status) => (
                    <li key={status.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <div className="flex items-center justify-between">
                            <div className="truncate">
                                <p className="truncate text-sm font-medium text-indigo-600 dark:text-indigo-400">{status.benefit.description}</p>
                                <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">Card: {status.benefit.creditCard.name}</p>
                            </div>
                            <div className="ml-4 flex-shrink-0">
                                <p className="text-sm text-gray-900 dark:text-white">Due: {formatDate(status.cycleEndDate)}</p>
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
