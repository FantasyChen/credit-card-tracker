import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const usageWay = await prisma.benefitUsageWay.findUnique({
    where: { slug: params.slug },
  });

  if (!usageWay) {
    return {
      title: 'Usage Guide Not Found',
    };
  }

  return {
    title: `${usageWay.title} | CouponCycle`,
    description: usageWay.description || `Learn how to maximize your credit card benefits with our comprehensive guide: ${usageWay.title}`,
    keywords: [
      usageWay.title,
      'credit card benefits',
      'how to use',
      usageWay.category || 'rewards',
    ],
  };
}

export async function generateStaticParams() {
  try {
    const usageWays = await prisma.benefitUsageWay.findMany({
      select: { slug: true },
    });

    return usageWays.map((way) => ({
      slug: way.slug,
    }));
  } catch {
    console.warn('BenefitUsageWay table not found, returning empty params');
    return [];
  }
}

export default async function UsageWayDetailPage({ params }: PageProps) {
  let usageWay;
  try {
    usageWay = await prisma.benefitUsageWay.findUnique({
      where: { slug: params.slug },
      include: {
        predefinedBenefits: {
          include: {
            predefinedCard: true,
          },
        },
      },
    });
  } catch {
    console.warn('BenefitUsageWay table not found');
    notFound();
  }

  if (!usageWay) {
    notFound();
  }

  // Get related cards
  const relatedCards = usageWay.predefinedBenefits
    .map((benefit) => benefit.predefinedCard)
    .filter((card, index, self) => 
      index === self.findIndex((c) => c.id === card.id)
    );

  // Simple markdown-like content rendering
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let inList = false;
    let listItems: string[] = [];
    let key = 0;

    const flushList = () => {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={key++} className="list-disc list-inside space-y-2 mb-6 ml-4 text-gray-700 dark:text-gray-300">
            {listItems.map((item, i) => (
              <li key={i} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={key++} className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
            {trimmed.replace('## ', '')}
          </h2>
        );
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        flushList();
        elements.push(
          <h3 key={key++} className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
            {trimmed.replace(/\*\*/g, '')}
          </h3>
        );
      } else if (trimmed.startsWith('- ')) {
        if (!inList) {
          inList = true;
        }
        listItems.push(trimmed.replace('- ', ''));
      } else if (trimmed.match(/^\d+\.\s/)) {
        // Numbered list item
        if (!inList) {
          flushList();
          inList = true;
        }
        listItems.push(trimmed.replace(/^\d+\.\s/, ''));
      } else if (trimmed === '') {
        flushList();
      } else if (trimmed.length > 0) {
        flushList();
        elements.push(
          <p key={key++} className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
            {trimmed}
          </p>
        );
      }
    });

    flushList();
    return elements;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center text-sm text-gray-600 dark:text-gray-400">
        <Link href="/benefits" className="hover:text-indigo-600 dark:hover:text-indigo-400">
          Benefits
        </Link>
        <svg className="h-4 w-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href="/benefits/how-to-use" className="hover:text-indigo-600 dark:hover:text-indigo-400">
          How to Use
        </Link>
        <svg className="h-4 w-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 dark:text-white">{usageWay.title}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          {usageWay.category && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">
              {usageWay.category}
            </span>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {usageWay.title}
        </h1>
        {usageWay.description && (
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {usageWay.description}
          </p>
        )}
      </div>

      {/* Pro Tips Box */}
      {usageWay.tips && usageWay.tips.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6 mb-8">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-3">
                💡 Pro Tips
              </h3>
              <ul className="space-y-2">
                {usageWay.tips.map((tip, index) => (
                  <li key={index} className="flex items-start text-amber-800 dark:text-amber-300">
                    <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <article className="prose prose-lg max-w-none mb-12">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          {renderContent(usageWay.content)}
        </div>
      </article>

      {/* Related Cards */}
      {relatedCards.length > 0 && (
        <div className="mt-12 bg-gray-50 dark:bg-gray-900 rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Credit Cards with This Benefit
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {relatedCards.map((card) => (
              <div
                key={card.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
              >
                <div className="font-semibold text-gray-900 dark:text-white mb-1">
                  {card.name}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {card.issuer}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  ${card.annualFee} annual fee
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-between items-center pt-8 border-t border-gray-200 dark:border-gray-700">
        <Link
          href="/benefits/how-to-use"
          className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to All Guides
        </Link>
        <Link
          href="/benefits"
          className="inline-flex items-center px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
        >
          Track Your Benefits
          <svg className="h-5 w-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

