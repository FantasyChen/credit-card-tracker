import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { BenefitStatus, Benefit, CreditCard as PrismaCreditCard } from '@/generated/prisma';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import SupportedCreditCards from '@/components/SupportedCreditCards';
import DashboardBenefitRow from '@/components/DashboardBenefitRow';

// Define a type for the upcoming benefits data
interface UpcomingBenefit extends BenefitStatus {
  benefit: Benefit & { creditCard: PrismaCreditCard };
}

export default async function Home() {
  const session = await getServerSession(authOptions);

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "CouponCycle",
    "description": "Track credit card benefits, maximize rewards, and never miss expiring perks again. Free tool for Chase, Amex, Capital One, and 50+ premium cards.",
    "url": "https://www.coupon-cycle.site",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "creator": {
      "@type": "Person",
      "name": "FantasyChen",
      "url": "https://github.com/FantasyChen"
    },
    "featureList": [
      "Credit Card Benefits Tracking",
      "Annual Fee ROI Analysis", 
      "Smart Notifications",
      "Loyalty Program Management",
      "Data Export/Import"
    ],
    "screenshot": "https://www.coupon-cycle.site/hero-image.jpg"
  };

  if (!session?.user?.id) {
    // If not signed in, show a landing page with a sign-in button
    return (
      <div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      <section className="bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto grid min-h-screen max-w-screen-xl px-4 py-8 lg:grid-cols-12 lg:gap-8 lg:py-16 xl:gap-0">
          <div className="mr-auto place-self-center lg:col-span-7">
            <h1 className="mb-4 max-w-2xl text-4xl font-extrabold leading-none tracking-tight text-gray-900 dark:text-white md:text-5xl xl:text-6xl">
              Never Miss a Credit Card Benefit Again
            </h1>
            <p className="mb-6 max-w-2xl font-light text-gray-500 dark:text-gray-300 md:text-lg lg:mb-8 lg:text-xl">
              Track credit card benefits, maximize rewards, and never miss expiring perks. Free tool for Chase Sapphire, Amex Platinum, Capital One Venture, and 50+ premium cards. Get ROI insights and smart notifications.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-center text-base font-medium text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-900"
              >
                Get Started - Sign In
                <svg className="ml-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
                </svg>
              </Link>
              <Link 
                href="/guide" 
                className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-center text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700 dark:focus:ring-gray-800"
              >
                Learn How to Maximize Benefits
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {/* 100% Free Badge */}
              <div className="inline-flex items-center gap-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 px-4 py-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">100% Free Forever</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">No subscriptions, no premium tiers, no hidden fees</p>
                </div>
              </div>

              {/* Privacy Badge */}
              <div className="inline-flex items-center gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-4 py-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-200">No bank access required</p>
                  <p className="text-xs text-green-600 dark:text-green-400">We never ask for banking credentials</p>
                </div>
              </div>
            </div>
          </div>
          <div className="hidden lg:col-span-5 lg:mt-0 lg:flex lg:items-center lg:justify-center relative">
            <Image 
              src="/hero-image.jpg" 
              alt="CouponCycle - Maximize your credit card benefits" 
              fill
              className="rounded-lg object-contain"
              priority
            />
          </div>
        </div>
      </section>

      {/* Value Stats Section */}
      <section className="bg-white dark:bg-gray-800 py-12 border-y border-gray-200 dark:border-gray-700">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6">
              <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">$500+</div>
              <div className="text-gray-600 dark:text-gray-300 font-medium">Average yearly benefit value</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Per premium card holder</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-bold text-red-500 dark:text-red-400 mb-2">80%</div>
              <div className="text-gray-600 dark:text-gray-300 font-medium">Benefits go unused</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Without proper tracking</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">2 min</div>
              <div className="text-gray-600 dark:text-gray-300 font-medium">Setup time</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add cards and start tracking</div>
            </div>
          </div>
        </div>
      </section>

        {/* Add the Supported Credit Cards section */}
        <SupportedCreditCards />
      </div>
    );
  }

  const userId = session.user.id;

  // Fetch card count
  const cardCount = await prisma.creditCard.count({
    where: { userId: userId },
  });

  // Calculate total annual fees and claimed benefits value
  const userCards = await prisma.creditCard.findMany({
    where: { userId },
    select: { name: true }
  });

  // Count the quantity of each card type
  const cardCounts = userCards.reduce((acc, card) => {
    acc[card.name] = (acc[card.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalAnnualFees = await prisma.predefinedCard.findMany({
    where: {
      name: {
        in: Object.keys(cardCounts)
      }
    }
  }).then(predefinedCards => {
    return predefinedCards.reduce((total, card) => {
      const quantity = cardCounts[card.name] || 1;
      return total + (card.annualFee * quantity);
    }, 0);
  });

  // Calculate total claimed value using usedAmount (includes partial completions)
  const totalClaimedValue = await prisma.benefitStatus.findMany({
    where: {
      userId: userId,
      isNotUsable: false, // Exclude not usable benefits
    },
    select: {
      usedAmount: true,
    }
  }).then(statuses => {
    return statuses.reduce((total, status) => total + (status.usedAmount ?? 0), 0);
  });

  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Fetch benefits expiring within 7 days (urgent)
  const expiringSoonBenefits = await prisma.benefitStatus.findMany({
    where: {
      userId: userId,
      isCompleted: false,
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

  // Fetch upcoming benefits (expiring after 7 days, limit 5)
  const upcomingBenefits = await prisma.benefitStatus.findMany({
    where: {
      userId: userId,
      isCompleted: false,
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
        {/* Total Cards Widget */}
        <div className="group overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 shadow-lg hover:shadow-xl transition-all duration-300 dark:from-indigo-900/20 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-700">
          <div className="p-4 sm:p-6">
             <div className="flex items-center">
                <div className="flex-shrink-0">
                    <div className="p-2 sm:p-3 bg-indigo-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <CreditCardIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" aria-hidden="true" />
                    </div>
                </div>
                <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                    <dl>
                        <dt className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Total Cards</dt>
                        <dd>
                            <div className="text-lg sm:text-2xl font-bold text-indigo-900 dark:text-indigo-100">{cardCount}</div>
                        </dd>
                    </dl>
                </div>
            </div>
          </div>
           <div className="bg-indigo-100/50 dark:bg-indigo-800/30 px-6 py-3 border-t border-indigo-200 dark:border-indigo-700">
                <div className="text-sm">
                    <Link href="/cards" className="font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center group">
                        View all cards
                        <svg className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            </div>
        </div>

        {/* Benefits Claimed Widget */}
        <div className="group overflow-hidden rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 shadow-lg hover:shadow-xl transition-all duration-300 dark:from-green-900/20 dark:to-emerald-800/20 border border-green-200 dark:border-green-700">
          <div className="p-4 sm:p-6">
             <div className="flex items-center">
                <div className="flex-shrink-0">
                    <div className="p-2 sm:p-3 bg-green-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                </div>
                <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                    <dl>
                        <dt className="text-sm font-medium text-green-600 dark:text-green-300">Benefits Claimed</dt>
                        <dd>
                            <div className="text-lg sm:text-2xl font-bold text-green-900 dark:text-green-100">${totalClaimedValue.toFixed(2)}</div>
                        </dd>
                    </dl>
                </div>
            </div>
          </div>
           <div className="bg-green-100/50 dark:bg-green-800/30 px-6 py-3 border-t border-green-200 dark:border-green-700">
                <div className="text-sm">
                    <Link href="/benefits" className="font-medium text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 flex items-center group">
                        View all benefits
                        <svg className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            </div>
        </div>

        {/* Annual Fee ROI Widget */}
        <div className={`group overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border ${
          totalClaimedValue >= totalAnnualFees 
            ? 'bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-800/20 border-emerald-200 dark:border-emerald-700' 
            : 'bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-900/20 dark:to-red-800/20 border-orange-200 dark:border-orange-700'
        }`}>
          <div className="p-4 sm:p-6">
             <div className="flex items-center">
                <div className="flex-shrink-0">
                    <div className={`p-2 sm:p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                      totalClaimedValue >= totalAnnualFees 
                        ? 'bg-emerald-500' 
                        : 'bg-orange-500'
                    }`}>
                      {totalClaimedValue >= totalAnnualFees ? (
                        <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      )}
                    </div>
                </div>
                <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                    <dl>
                        <dt className={`text-sm font-medium ${
                          totalClaimedValue >= totalAnnualFees 
                            ? 'text-emerald-600 dark:text-emerald-300' 
                            : 'text-orange-600 dark:text-orange-300'
                        }`}>
                          Annual Fee ROI
                        </dt>
                        <dd>
                            <div className={`text-lg sm:text-2xl font-bold ${
                              totalClaimedValue >= totalAnnualFees 
                                ? 'text-emerald-900 dark:text-emerald-100' 
                                : 'text-orange-900 dark:text-orange-100'
                            }`}>
                              ${(totalClaimedValue - totalAnnualFees).toFixed(2)}
                            </div>
                        </dd>
                    </dl>
                </div>
            </div>
          </div>
           <div className={`px-6 py-3 border-t ${
             totalClaimedValue >= totalAnnualFees 
               ? 'bg-emerald-100/50 dark:bg-emerald-800/30 border-emerald-200 dark:border-emerald-700' 
               : 'bg-orange-100/50 dark:bg-orange-800/30 border-orange-200 dark:border-orange-700'
           }`}>
                <div className="text-sm">
                    <span className={`font-medium ${
                      totalClaimedValue >= totalAnnualFees 
                        ? 'text-emerald-700 dark:text-emerald-300' 
                        : 'text-orange-700 dark:text-orange-300'
                    }`}>
                      ${totalAnnualFees.toFixed(2)} in annual fees
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* Expiring in 7 Days Section */}
      {expiringSoonBenefits.length > 0 && (
        <div className="mt-12">
          <div className="sm:flex sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold leading-6 text-orange-700 dark:text-orange-400 flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                  Urgent
                </span>
                Expiring in 7 Days
              </h2>
              <p className="mt-1 text-sm text-orange-600/80 dark:text-orange-400/80">
                These benefits expire soon — use them before they reset
              </p>
            </div>
            <Link
              href="/benefits"
              className="mt-2 sm:mt-0 inline-flex items-center rounded-lg bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm ring-1 ring-inset ring-orange-200 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:ring-orange-800 dark:hover:bg-orange-900/30 transition-colors duration-200"
            >
              View all
              <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="overflow-hidden shadow-lg ring-1 ring-orange-200 dark:ring-orange-800 rounded-xl bg-white dark:bg-gray-800">
            <ul role="list" className="divide-y divide-orange-100 dark:divide-orange-900/50">
              {expiringSoonBenefits.map((status) => (
                <DashboardBenefitRow
                  key={status.id}
                  status={status}
                  isExpiringSoon
                />
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Upcoming Benefits Section */}
      <div className="mt-12">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold leading-6 text-gray-900 dark:text-white">
                Upcoming Benefits
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Benefits expiring soon that need your attention
              </p>
            </div>
             <div className="mt-4 sm:ml-4 sm:mt-0">
                <Link href="/benefits" className="inline-flex items-center rounded-lg bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:ring-indigo-800 dark:hover:bg-indigo-900/30 transition-colors duration-200">
                    View all benefits
                    <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
        
        {upcomingBenefits.length === 0 ? (
           <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center bg-gray-50/50 dark:bg-gray-800/50">
                <div className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No upcoming benefits</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">Add cards with benefits or check back later for upcoming cycles.</p>
                <Link
                  href="/cards/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Your First Card
                </Link>
           </div>
        ) : (
          <div className="overflow-hidden shadow-lg ring-1 ring-black ring-opacity-5 rounded-xl">
             <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                {upcomingBenefits.map((status) => (
                  <DashboardBenefitRow key={status.id} status={status} />
                ))}
            </ul>
           </div>
        )}
      </div>
    </div>
  );
}
