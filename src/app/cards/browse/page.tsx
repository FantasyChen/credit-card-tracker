import { Metadata } from 'next';
import Link from 'next/link';
import CardImageWell from '@/components/ui/CardImageWell';
import PageHeader from '@/components/ui/PageHeader';
import { PRIMARY_SITE_URL } from '@/lib/site';
import { calculateAnnualBenefitValue, getPublicStaticCards } from '@/lib/static-catalog';

export const metadata: Metadata = {
  title: 'Browse Credit Cards | Perks Reminder',
  description: 'Browse our complete catalog of credit cards with trackable benefits. Find cards from Chase, American Express, Capital One, Citi, and more.',
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
  const predefinedCards = getPublicStaticCards();

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
  const calculateTotalValue = (benefits: typeof predefinedCards[number]['benefits']) =>
    benefits.reduce((total, benefit) => total + calculateAnnualBenefitValue(benefit.maxAmount, benefit.frequency), 0);

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Supported credit cards in Perks Reminder',
    itemListElement: predefinedCards.map((card, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${PRIMARY_SITE_URL}/cards/browse/${encodeURIComponent(card.name)}`,
      name: card.name,
    })),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <PageHeader
        title="Browse Credit Cards"
        description={`Explore ${predefinedCards.length}+ supported cards with trackable benefits. Sign in to add cards to your collection and start tracking cycles.`}
      >
        <div className="grid w-full grid-cols-3 gap-3 sm:w-auto sm:min-w-[22rem]">
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
      </PageHeader>

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
                    <div className="h-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600">
                      <CardImageWell
                        imageUrl={card.imageUrl}
                        alt={card.name}
                        issuer={card.issuer}
                        className="rounded-none border-x-0 border-t-0"
                        sizes="220px"
                      />
                      
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
      <div className="mt-16 rounded-lg border border-indigo-200 bg-indigo-50 p-8 dark:border-indigo-800 dark:bg-indigo-950/20">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Start Tracking Your Benefits
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
            Create a free account to add these cards to your collection and never miss another credit card benefit.
          </p>
          <Link
            href="/auth/signup?callbackUrl=%2Fcards%2Fnew"
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
