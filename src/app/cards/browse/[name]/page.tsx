import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BenefitFrequency } from '@/generated/prisma';
import CardImageWell from '@/components/ui/CardImageWell';

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const cardName = decodeURIComponent(name);
  const card = await prisma.predefinedCard.findUnique({
    where: { name: cardName },
  });

  if (!card) {
    return {
      title: 'Card Not Found | Perks Reminder',
    };
  }

  return {
    title: `${card.name} Benefits | Perks Reminder`,
    description: `Track ${card.name} benefits including all recurring credits and perks. ${card.issuer} card with $${card.annualFee} annual fee.`,
    keywords: [
      card.name,
      card.issuer,
      'credit card benefits',
      'credit card tracker',
    ],
    alternates: {
      canonical: `/cards/browse/${encodeURIComponent(card.name)}`,
    },
  };
}

export async function generateStaticParams() {
  const cards = await prisma.predefinedCard.findMany({
    select: { name: true },
  });

  return cards.map((card) => ({
    name: encodeURIComponent(card.name),
  }));
}

// Helper to get frequency display label
function getFrequencyLabel(frequency: BenefitFrequency): string {
  switch (frequency) {
    case 'WEEKLY': return 'Weekly';
    case 'MONTHLY': return 'Monthly';
    case 'QUARTERLY': return 'Quarterly';
    case 'YEARLY': return 'Yearly';
    case 'ONE_TIME': return 'One-time';
    default: return '';
  }
}

// Helper to calculate annual value of a benefit
function calculateAnnualValue(maxAmount: number | null, frequency: BenefitFrequency): number {
  if (!maxAmount) return 0;
  switch (frequency) {
    case 'WEEKLY': return maxAmount * 52;
    case 'MONTHLY': return maxAmount * 12;
    case 'QUARTERLY': return maxAmount * 4;
    case 'YEARLY':
    case 'ONE_TIME':
    default: return maxAmount;
  }
}

// Issuer URLs mapping
const issuerUrls: Record<string, string> = {
  'American Express': 'https://www.americanexpress.com/us/credit-cards/',
  'Chase': 'https://creditcards.chase.com/',
  'Capital One': 'https://www.capitalone.com/credit-cards/',
  'Citi': 'https://www.citi.com/credit-cards/',
  'Bank of America': 'https://www.bankofamerica.com/credit-cards/',
  'US Bank': 'https://www.usbank.com/credit-cards/',
  'Wells Fargo': 'https://www.wellsfargo.com/credit-cards/',
  'Discover': 'https://www.discover.com/credit-cards/',
  'Barclays': 'https://cards.barclaycardus.com/',
};

export default async function CardDetailPage({ params }: PageProps) {
  const { name } = await params;
  const cardName = decodeURIComponent(name);
  
  const card = await prisma.predefinedCard.findUnique({
    where: { name: cardName },
    include: {
      benefits: {
        include: {
          usageWay: true,
        },
        orderBy: {
          maxAmount: 'desc',
        },
      },
    },
  });

  if (!card) {
    notFound();
  }

  // Get other cards from the same issuer
  const relatedCards = await prisma.predefinedCard.findMany({
    where: {
      issuer: card.issuer,
      id: { not: card.id },
    },
    include: {
      benefits: true,
    },
    take: 4,
  });

  // Calculate total annual value
  const totalAnnualValue = card.benefits.reduce((total, benefit) => {
    return total + calculateAnnualValue(benefit.maxAmount, benefit.frequency);
  }, 0);

  const netValue = totalAnnualValue - card.annualFee;

  // Group benefits by category
  const benefitsByCategory = card.benefits.reduce((acc, benefit) => {
    if (!acc[benefit.category]) {
      acc[benefit.category] = [];
    }
    acc[benefit.category].push(benefit);
    return acc;
  }, {} as Record<string, typeof card.benefits>);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center text-sm text-gray-600 dark:text-gray-400">
        <Link href="/cards/browse" className="hover:text-indigo-600 dark:hover:text-indigo-400">
          Browse Cards
        </Link>
        <svg className="h-4 w-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 dark:text-white">{card.name}</span>
      </nav>

      {/* Card Header */}
      <div className="mb-8 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="md:flex">
          <div className="md:w-1/3">
            <CardImageWell
              imageUrl={card.imageUrl}
              alt={card.name}
              issuer={card.issuer}
              className="h-full min-h-64 rounded-none border-0 md:aspect-auto"
              priority
              sizes="280px"
            />
          </div>

          {/* Card Info */}
          <div className="md:w-2/3 p-6 md:p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{card.issuer}</p>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  {card.name}
                </h1>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                {card.benefits.length} benefits
              </span>
            </div>

            {/* Value Stats */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-900/40">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${card.annualFee}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Annual Fee</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-950/20">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${totalAnnualValue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Potential Value/yr</div>
              </div>
              <div className={`rounded-lg border p-4 text-center ${netValue >= 0 ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'}`}>
                <div className={`text-2xl font-bold ${netValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {netValue >= 0 ? '+' : ''}${netValue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Net Value/yr</div>
              </div>
            </div>

            {/* External Links */}
            <div className="flex flex-wrap gap-3">
              {issuerUrls[card.issuer] && (
                <a
                  href={issuerUrls[card.issuer]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Official {card.issuer} Page
                </a>
              )}
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add to My Cards
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Card Benefits
        </h2>
        
        <div className="space-y-8">
          {Object.entries(benefitsByCategory).map(([category, benefits]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {category}
                </span>
                <span className="text-sm font-normal text-gray-500">({benefits.length})</span>
              </h3>
              
              <div className="grid gap-4">
                {benefits.map((benefit) => (
                  <div
                    key={benefit.id}
                    className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {benefit.maxAmount && (
                            <span className="text-lg font-bold text-green-600 dark:text-green-400">
                              ${benefit.maxAmount}
                            </span>
                          )}
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                            {getFrequencyLabel(benefit.frequency)}
                          </span>
                        </div>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {benefit.description}
                        </p>
                        {benefit.maxAmount && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Annual value: ${calculateAnnualValue(benefit.maxAmount, benefit.frequency).toLocaleString()}
                          </p>
                        )}
                      </div>
                      
                      {benefit.usageWay && (
                        <Link
                          href={`/benefits/how-to-use/${benefit.usageWay.slug}`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-sm font-medium"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          How to Use
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Related Cards */}
      {relatedCards.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            More from {card.issuer}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedCards.map((relatedCard) => (
              <Link
                key={relatedCard.id}
                href={`/cards/browse/${encodeURIComponent(relatedCard.name)}`}
                className="group block"
              >
                <div className="h-full overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600">
                  <CardImageWell
                    imageUrl={relatedCard.imageUrl}
                    alt={relatedCard.name}
                    issuer={relatedCard.issuer}
                    className="rounded-none border-x-0 border-t-0 p-3"
                    sizes="140px"
                  />
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm truncate">
                      {relatedCard.name}
                    </h3>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>${relatedCard.annualFee}/yr</span>
                      <span>{relatedCard.benefits.length} benefits</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-8 text-center dark:border-indigo-800 dark:bg-indigo-950/20">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Track Your {card.name} Benefits
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
          Sign in to add this card to your collection and never miss a benefit again.
        </p>
        <Link
          href="/auth/signin"
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
        >
          Start Tracking Free
          <svg className="h-5 w-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
