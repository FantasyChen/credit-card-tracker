import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import {
  ArrowRightIcon,
  BanknotesIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import SupportedCreditCards from '@/components/SupportedCreditCards';
import DashboardBenefitRow from '@/components/DashboardBenefitRow';
import HowItWorks from '@/components/HowItWorks';
import PricingSection from '@/components/PricingSection';
import FAQ from '@/components/FAQ';
import { PRIMARY_SITE_URL, SITE_NAME } from '@/lib/site';
import { buildFaqJsonLd } from '@/lib/faq-data';

function LandingMetric({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <div className="border-l border-border pl-5 first:border-l-0 first:pl-0 max-sm:border-l-0 max-sm:border-t max-sm:pl-0 max-sm:pt-5 max-sm:first:border-t-0 max-sm:first:pt-0">
      <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function DashboardMetric({
  icon,
  label,
  value,
  detail,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      {content}
    </Link>
  );
}

export default async function Home() {
  const [{ getServerSession }, { authOptions }] = await Promise.all([
    import('next-auth'),
    import('@/lib/auth'),
  ]);
  const session = await getServerSession(authOptions);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": SITE_NAME,
    "description": "Track credit card benefits, maximize rewards, and never miss expiring perks again. Free tool for Chase, Amex, Capital One, and a growing catalog of premium cards.",
    "url": PRIMARY_SITE_URL,
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
    "screenshot": `${PRIMARY_SITE_URL}/hero-image.jpg`
  };

  if (!session?.user?.id) {
    return (
      <div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
        />

        <section className="border-b border-border bg-background">
          <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-muted-foreground shadow-sm shadow-black/[0.03]">
                <ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />
                No bank credentials required
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl xl:text-6xl">
                Track every card perk before it expires.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Monitor recurring credits, reset windows, loyalty expirations, and annual fee ROI in one private checklist.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth/signup?callbackUrl=%2Fcards%2Fnew"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background active:translate-y-px"
                >
                  Get started
                  <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background active:translate-y-px"
                >
                  See workflow
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-xl shadow-black/[0.06] dark:shadow-black/20">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                  <Image
                    src="/hero-image.jpg"
                    alt={`${SITE_NAME} benefit tracking overview`}
                    fill
                    className="object-contain p-4"
                    priority
                  />
                </div>
              </div>
              <div className="absolute -bottom-6 left-6 right-6 rounded-2xl border border-border bg-card/95 p-4 shadow-lg shadow-black/[0.06] backdrop-blur dark:shadow-black/20">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-semibold tabular-nums text-foreground">12</p>
                    <p className="text-xs text-muted-foreground">Credits tracked</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold tabular-nums text-foreground">4</p>
                    <p className="text-xs text-muted-foreground">Due soon</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold tabular-nums text-foreground">$0</p>
                    <p className="text-xs text-muted-foreground">Subscription</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card py-10">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
            <LandingMetric value="$500+" label="Common annual value" detail="Premium cards often carry credits that reset monthly, quarterly, or yearly." />
            <LandingMetric value="2 min" label="Fast setup" detail="Add cards manually and track benefits without linking financial accounts." />
            <LandingMetric value="Free" label="No paid plan" detail="Use reminders, benefit tracking, and ROI summaries without a subscription." />
          </div>
        </section>

        <HowItWorks />
        <SupportedCreditCards />
        <PricingSection />
        <FAQ />

        <section className="border-y border-border bg-card py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Stop losing credits to reset dates.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Build a card checklist, record claimed value, and know when each benefit needs attention.
            </p>
            <Link
              href="/auth/signup?callbackUrl=%2Fcards%2Fnew"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background active:translate-y-px"
            >
              Get started
              <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const userId = session.user.id;

  try {
    const { loadHomeDashboardData } = await import('@/lib/home-dashboard-data');
    const {
      cardCount,
      totalAnnualFees,
      totalClaimedValue,
      expiringSoonBenefits,
      upcomingBenefits,
    } = await loadHomeDashboardData(userId);

    const netRoi = totalClaimedValue - totalAnnualFees;

    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review tracked cards, claimed value, annual fees, and benefits that need attention.
            </p>
          </div>
          <Link
            href="/cards/new"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background active:translate-y-px"
          >
            <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Add card
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric
            href="/cards"
            icon={<CreditCardIcon className="h-5 w-5" aria-hidden="true" />}
            label="Cards tracked"
            value={String(cardCount)}
            detail="Cards with benefits in your account."
          />
          <DashboardMetric
            href="/benefits"
            icon={<CheckCircleIcon className="h-5 w-5" aria-hidden="true" />}
            label="Claimed value"
            value={`$${totalClaimedValue.toFixed(2)}`}
            detail="Value recorded from benefits you marked as used."
          />
          <DashboardMetric
            icon={<BanknotesIcon className="h-5 w-5" aria-hidden="true" />}
            label="Net annual fee position"
            value={`$${netRoi.toFixed(2)}`}
            detail={`$${totalAnnualFees.toFixed(2)} in annual fees tracked.`}
          />
          <DashboardMetric
            href="/benefits"
            icon={<ClockIcon className="h-5 w-5" aria-hidden="true" />}
            label="Due soon"
            value={String(expiringSoonBenefits.length)}
            detail="Benefits expiring in the next 7 days."
          />
        </div>

        {expiringSoonBenefits.length > 0 && (
          <section className="mt-12">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <BellAlertIcon className="h-4 w-4" aria-hidden="true" />
                  Action needed
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">Expiring in 7 days</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use these benefits before they reset.
                </p>
              </div>
              <Link
                href="/benefits"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent"
              >
                View all
                <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-amber-200 bg-card shadow-sm shadow-black/[0.03] dark:border-amber-900/60">
              <ul role="list" className="divide-y divide-border">
                {expiringSoonBenefits.map((status) => (
                  <DashboardBenefitRow
                    key={status.id}
                    status={status}
                    isExpiringSoon
                  />
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Upcoming benefits</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The next benefit cycles that need your attention.
              </p>
            </div>
            <Link
              href="/benefits"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent"
            >
              View benefits
              <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {upcomingBenefits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm shadow-black/[0.03]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <CalendarDaysIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No upcoming benefits</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Add cards with benefits or check back later for upcoming cycles.
              </p>
              <Link
                href="/cards/new"
                className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90"
              >
                <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Add first card
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-black/[0.03]">
              <ul role="list" className="divide-y divide-border">
                {upcomingBenefits.map((status) => (
                  <DashboardBenefitRow key={status.id} status={status} />
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    );
  } catch (error) {
    console.error('Failed to load homepage dashboard:', error);
    return <DashboardUnavailable />;
  }
}

function DashboardUnavailable() {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm shadow-black/[0.03] dark:border-amber-900/60 dark:bg-amber-950/30">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
        <ExclamationTriangleIcon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">
        Dashboard temporarily unavailable
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        We cannot load your card and benefit data right now because the database is unavailable. Your account data is not deleted. Try again after the database connection is restored.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90"
        >
          Try again
        </Link>
        <Link
          href="/pricing"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent"
        >
          View public site
        </Link>
      </div>
    </div>
  );
}
