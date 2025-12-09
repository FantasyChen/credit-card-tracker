import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Credit Card Referral Links | CouponCycle',
  description: 'Support CouponCycle by using our referral links when applying for credit cards. Same great bonuses, and you help keep our free service running.',
  keywords: [
    'credit card referral',
    'credit card application',
    'Chase referral',
    'Amex referral',
    'Capital One referral',
  ],
  alternates: {
    canonical: '/referrals',
  },
};

// Referral links data - these would typically come from a database or CMS
// For now, we'll use placeholder links that should be updated with actual affiliate links
const referralData: Record<string, { cards: { name: string; description: string; referralUrl?: string }[] }> = {
  'American Express': {
    cards: [
      {
        name: 'American Express Platinum Card',
        description: 'Premium travel card with airport lounge access, hotel credits, and comprehensive travel benefits.',
        referralUrl: undefined, // Add actual referral link when available
      },
      {
        name: 'American Express Business Platinum Card',
        description: 'Business-focused premium card with Dell, Indeed, and Adobe credits plus travel benefits.',
        referralUrl: undefined,
      },
      {
        name: 'American Express Gold Card',
        description: 'Excellent for dining and groceries with 4x points on restaurants and supermarkets.',
        referralUrl: undefined,
      },
    ],
  },
  'Chase': {
    cards: [
      {
        name: 'Chase Sapphire Reserve',
        description: '$300 travel credit, Priority Pass lounge access, and premium travel insurance.',
        referralUrl: undefined,
      },
      {
        name: 'Chase Sapphire Preferred',
        description: 'Great starter travel card with valuable Ultimate Rewards points.',
        referralUrl: undefined,
      },
      {
        name: 'Chase Ink Business Preferred',
        description: '3x points on travel, shipping, internet, and phone services.',
        referralUrl: undefined,
      },
    ],
  },
  'Capital One': {
    cards: [
      {
        name: 'Capital One Venture X',
        description: 'Premium travel card with $300 travel credit, lounge access, and great transfer partners.',
        referralUrl: undefined,
      },
      {
        name: 'Capital One Venture X Business',
        description: 'Business version with similar premium benefits for business travelers.',
        referralUrl: undefined,
      },
    ],
  },
};

export default async function ReferralsPage() {
  // Get predefined cards to show images
  const predefinedCards = await prisma.predefinedCard.findMany({
    where: {
      name: {
        in: Object.values(referralData).flatMap(issuer => issuer.cards.map(c => c.name)),
      },
    },
  });

  const cardImageMap = predefinedCards.reduce((acc, card) => {
    acc[card.name] = card.imageUrl;
    return acc;
  }, {} as Record<string, string | null>);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Credit Card Referral Links
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Support CouponCycle by using our referral links when applying for credit cards. 
          You get the same great welcome bonuses, and you help keep our free service running.
        </p>
      </div>

      {/* Why Use Referrals */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 md:p-8 border border-indigo-200 dark:border-indigo-700 mb-12">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          Why Use Our Referral Links?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Same Bonuses</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You get the exact same welcome bonuses as applying directly
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Support Free Tools</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Helps us maintain and improve CouponCycle for everyone
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No Extra Cost</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Using referral links costs you nothing extra
            </p>
          </div>
        </div>
      </div>

      {/* Cards by Issuer */}
      <div className="space-y-12">
        {Object.entries(referralData).map(([issuer, data]) => (
          <section key={issuer}>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {issuer}
            </h2>
            
            <div className="grid gap-6">
              {data.cards.map((card) => (
                <div
                  key={card.name}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="md:flex">
                    {/* Card Image */}
                    <div className="md:w-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 p-6 flex items-center justify-center">
                      {cardImageMap[card.name] ? (
                        <div className="relative w-32 h-20">
                          <Image
                            src={cardImageMap[card.name]!}
                            alt={card.name}
                            fill
                            className="object-contain"
                            sizes="128px"
                          />
                        </div>
                      ) : (
                        <svg className="h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      )}
                    </div>

                    {/* Card Info */}
                    <div className="flex-1 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {card.name}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {card.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-3">
                        {card.referralUrl ? (
                          <a
                            href={card.referralUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Apply with Referral
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Coming Soon
                          </span>
                        )}
                        <Link
                          href={`/cards/browse/${encodeURIComponent(card.name)}`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                        >
                          View Card Details
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Affiliate Disclosure
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          CouponCycle may receive compensation when you apply for credit cards through our referral links. 
          This helps support our free service. All opinions and recommendations are our own, and we only 
          recommend cards we believe provide genuine value. Your approval is not guaranteed and depends 
          on your creditworthiness.
        </p>
      </div>

      {/* Other Ways to Support */}
      <div className="mt-8 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Want to support CouponCycle in other ways?
        </p>
        <a
          href="https://coff.ee/fantasy_c"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors font-medium"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 21V19H4V12C4 10.15 4.5 8.517 5.5 7.1C6.5 5.683 7.867 4.767 9.6 4.35V3.5C9.6 2.95 9.796 2.479 10.188 2.087C10.58 1.695 11.05 1.5 11.6 1.5H12.4C12.95 1.5 13.42 1.696 13.812 2.088C14.204 2.48 14.4 2.95 14.4 3.5V4.35C16.133 4.767 17.5 5.683 18.5 7.1C19.5 8.517 20 10.15 20 12V19H22V21H2ZM12 24C11.45 24 10.979 23.804 10.587 23.412C10.195 23.02 10 22.55 10 22H14C14 22.55 13.804 23.021 13.412 23.413C13.02 23.805 12.55 24 12 24Z"/>
          </svg>
          Buy Me a Coffee
        </a>
      </div>
    </div>
  );
}




