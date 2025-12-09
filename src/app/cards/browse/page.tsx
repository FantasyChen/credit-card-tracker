import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Browse Credit Cards | CouponCycle',
  description: 'Browse our complete catalog of 50+ credit cards with trackable benefits. Find cards from Chase, American Express, Capital One, Citi, and more.',
  keywords: [
    'credit cards',
    'credit card benefits',
    'Chase Sapphire',
    'Amex Platinum',
    'Capital One Venture',
    'credit card tracker',
  ],
  alternates: {
    canonical: '/cards/browse',
  },
};

export default async function BrowseCardsPage() {
  const predefinedCards = await prisma.predefinedCard.findMany({
    include: {
      benefits: true,
    },
    orderBy: [
      { issuer: 'asc' },
      { name: 'asc' },
    ],
  });

  // Group cards by issuer
  const cardsByIssuer = predefinedCards.reduce((acc, card) => {
    if (!acc[card.issuer]) {
      acc[card.issuer] = [];
    }
    acc[card.issuer].push(card);
    return acc;
  }, {} as Record<string, typeof predefinedCards>);

  // Sort issuers alphabetically
  const sortedIssuers = Object.keys(cardsByIssuer).sort();

  // Calculate total benefits value for a card
  const calculateTotalValue = (benefits: { maxAmount: number | null; frequency: string }[]) => {
    return benefits.reduce((total, benefit) => {
      if (!benefit.maxAmount) return total;
      switch (benefit.frequency) {
        case 'WEEKLY':
          return total + benefit.maxAmount * 52;
        case 'MONTHLY':
          return total + benefit.maxAmount * 12;
        case 'QUARTERLY':
          return total + benefit.maxAmount * 4;
        case 'YEARLY':
        case 'ONE_TIME':
        default:
          return total + benefit.maxAmount;
      }
    }, 0);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Browse Credit Cards
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl">
          Explore our complete catalog of {predefinedCards.length}+ credit cards with trackable benefits. 
          Sign in to add cards to your collection and start tracking your benefits.
        </p>
        
        {/* Quick Stats */}
        <div className="mt-6 flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{predefinedCards.length}</span>
            <span className="text-gray-600 dark:text-gray-400">Cards</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{sortedIssuers.length}</span>
            <span className="text-gray-600 dark:text-gray-400">Issuers</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {predefinedCards.reduce((total, card) => total + card.benefits.length, 0)}
            </span>
            <span className="text-gray-600 dark:text-gray-400">Benefits</span>
          </div>
        </div>
      </div>

      {/* Cards by Issuer */}
      <div className="space-y-12">
        {sortedIssuers.map((issuer) => (
          <section key={issuer} id={issuer.toLowerCase().replace(/\s+/g, '-')}>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              {issuer}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({cardsByIssuer[issuer].length} cards)
              </span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cardsByIssuer[issuer].map((card) => {
                const totalAnnualValue = calculateTotalValue(card.benefits);
                const netValue = totalAnnualValue - card.annualFee;
                
                return (
                  <Link
                    key={card.id}
                    href={`/cards/browse/${encodeURIComponent(card.name)}`}
                    className="group block"
                  >
                    <div className="h-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-600">
                      {/* Card Image - fixed aspect ratio container */}
                      <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center p-4" style={{ aspectRatio: '16/10' }}>
                        {card.imageUrl ? (
                          <div className="relative w-full h-full max-w-[200px]" style={{ aspectRatio: '1.586/1' }}>
                            <Image
                              src={card.imageUrl}
                              alt={card.name}
                              fill
                              className="object-contain drop-shadow-md"
                              sizes="200px"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <svg className="h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Card Info */}
                      <div className="p-5">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {card.name}
                        </h3>
                        
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            ${card.annualFee} annual fee
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                            {card.benefits.length} benefits
                          </span>
                        </div>
                        
                        {/* Value Summary */}
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Potential value:</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              ${totalAnnualValue.toLocaleString()}/yr
                            </span>
                          </div>
                          {card.annualFee > 0 && (
                            <div className="flex items-center justify-between text-sm mt-1">
                              <span className="text-gray-500 dark:text-gray-400">Net value:</span>
                              <span className={`font-semibold ${netValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {netValue >= 0 ? '+' : ''}${netValue.toLocaleString()}/yr
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* CTA Section */}
      <div className="mt-16 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-8 border border-indigo-200 dark:border-indigo-700">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Start Tracking Your Benefits
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
            Sign in to add these cards to your collection and never miss another credit card benefit.
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Get Started Free
            <svg className="h-5 w-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

