import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { BenefitUsageWay } from '@/generated/prisma';
import PageHeader from '@/components/ui/PageHeader';
import SuggestCorrectionLink from '@/components/SuggestCorrectionLink';

export const metadata: Metadata = {
  title: 'How to Use Credit Card Benefits - Complete Guide',
  description: 'Step-by-step guides on maximizing your credit card benefits including airline credits, hotel stays, dining credits, and more.',
  keywords: [
    'credit card benefits guide',
    'how to use airline credits',
    'hotel credit card benefits',
    'dining credits guide',
    'maximize credit card rewards'
  ],
  alternates: {
    canonical: '/benefits/how-to-use',
  },
};

export default async function HowToUseIndexPage() {
  let usageWays: BenefitUsageWay[] = [];
  try {
    usageWays = await prisma.benefitUsageWay.findMany({
      orderBy: {
        category: 'asc',
      },
    });
  } catch {
    console.warn('BenefitUsageWay table not found, skipping how-to-use content');
  }

  // Group by category
  const groupedByCategory = usageWays.reduce((acc, way) => {
    const category = way.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(way);
    return acc;
  }, {} as Record<string, BenefitUsageWay[]>);

  const categoryIcons: Record<string, string> = {
    'Travel': '✈️',
    'Transportation': '🚗',
    'Dining': '🍽️',
    'Entertainment': '🎬',
    'General': '📋',
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="How to Use Your Credit Card Benefits"
        description="Step-by-step guides for credits, certificates, travel perks, and dining rewards, written for quick use before a benefit expires."
      />

      {/* Guides Grid by Category */}
      <div className="space-y-12">
        {Object.entries(groupedByCategory).map(([category, ways]) => (
          <section key={category}>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <span className="mr-3 text-3xl">{categoryIcons[category] || '📌'}</span>
              {category}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ways.map((way) => (
                <Link
                  key={way.id}
                  href={`/benefits/how-to-use/${way.slug}`}
                  className="group block"
                >
                  <div className="h-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {way.title}
                    </h3>
                    
                    {way.description && (
                      <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                        {way.description}
                      </p>
                    )}
                    
                    {way.tips && way.tips.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-start text-sm text-gray-500 dark:text-gray-400">
                          <svg className="h-5 w-5 mr-2 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span>{way.tips.length} pro tips included</span>
                        </div>
                      </div>
                    )}

                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {['qualifies', 'trigger', 'timing', 'caveats', 'avoid'].map((label) => (
                        <span
                          key={label}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-medium text-sm group-hover:translate-x-1 transition-transform">
                        Read guide
                        <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Updated {way.updatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Community-maintained playbooks</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Guides are written from issuer terms, public data points, and repeatable community patterns. If something changed, send the card, benefit, and source.
            </p>
          </div>
          <SuggestCorrectionLink
            subject="Correction: benefit usage guide library"
            context="Page: /benefits/how-to-use"
          />
        </div>
      </div>

      {/* CTA Section */}
      <div className="mt-16 rounded-lg border border-indigo-200 bg-indigo-50 p-8 dark:border-indigo-800 dark:bg-indigo-950/20">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Track Your Benefits Automatically
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
            Don&apos;t just learn how to use your benefits — let Perks Reminder track them for you. 
            Get reminders before credits expire and maximize your credit card ROI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/benefits"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
            >
              View My Benefits
              <svg className="h-5 w-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/cards"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-semibold border-2 border-indigo-600 dark:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
            >
              Manage Cards
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
