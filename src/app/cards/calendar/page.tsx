import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/ui/PageHeader';
import { buildCardCalendarEvents } from '@/lib/card-lifecycle';

export const dynamic = 'force-dynamic';

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function getKindLabel(kind: string) {
  switch (kind) {
    case 'annual_fee':
      return 'Annual fee';
    case 'anniversary':
      return 'Anniversary';
    case 'signup_bonus_deadline':
      return 'Sign-up bonus';
    case 'spend_deadline':
      return 'Spend deadline';
    case 'benefit_expires':
      return 'Benefit expires';
    default:
      return 'Timeline';
  }
}

function getKindClass(kind: string) {
  switch (kind) {
    case 'annual_fee':
      return 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800';
    case 'benefit_expires':
      return 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800';
    case 'signup_bonus_deadline':
    case 'spend_deadline':
      return 'bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:ring-indigo-800';
    case 'anniversary':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800';
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600';
  }
}

export default async function CardCalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/cards/calendar');
  }

  const referenceDate = new Date();
  const horizonDate = new Date(referenceDate.getTime() + 120 * 24 * 60 * 60 * 1000);

  const cards = await prisma.creditCard.findMany({
    where: { userId: session.user.id },
    orderBy: [{ annualFeeDueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      events: {
        orderBy: { eventDate: 'asc' },
      },
      benefits: {
        select: {
          id: true,
          description: true,
          benefitStatuses: {
            where: {
              cycleEndDate: {
                gte: referenceDate,
                lte: horizonDate,
              },
              isCompleted: false,
              isNotUsable: false,
            },
            orderBy: { cycleEndDate: 'asc' },
            select: {
              id: true,
              cycleEndDate: true,
              isCompleted: true,
              isNotUsable: true,
            },
          },
        },
      },
    },
  });

  const events = buildCardCalendarEvents(cards, { referenceDate, daysAhead: 120 });
  const annualFeeCount = events.filter((event) => event.kind === 'annual_fee').length;
  const benefitExpirationCount = events.filter((event) => event.kind === 'benefit_expires').length;
  const groupedEvents = events.reduce<Record<string, typeof events>>((groups, event) => {
    const key = formatMonth(event.date);
    groups[key] = groups[key] || [];
    groups[key].push(event);
    return groups;
  }, {});

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Card Calendar"
        description="Upcoming card dates and expiring benefit cycles."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/cards" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
            Cards
          </Link>
          <Link href="/cards/new" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
            Add Card
          </Link>
        </div>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-gray-200 pb-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
        <span><span className="font-semibold text-gray-950 dark:text-white">{cards.length}</span> cards</span>
        <span><span className="font-semibold text-gray-950 dark:text-white">{events.length}</span> upcoming</span>
        <span><span className="font-semibold text-gray-950 dark:text-white">{annualFeeCount}</span> annual fees</span>
        <span><span className="font-semibold text-gray-950 dark:text-white">{benefitExpirationCount}</span> benefit expirations</span>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-950 dark:text-white">No upcoming card dates</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-300">
            Add annual fee dates, spend deadlines, or timeline entries on each card to populate this view.
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <section key={month} className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
              <h2 className="pt-3 text-sm font-semibold text-gray-500 dark:text-gray-400">{month}</h2>
              <ol className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
                {monthEvents.map((event) => (
                  <li key={event.id} className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-3 sm:hidden">
                      <time className="text-sm font-medium text-gray-700 dark:text-gray-200">{formatDay(event.date)}</time>
                      <Link
                        href={`/cards/${event.cardId}/edit`}
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                      >
                        Edit
                      </Link>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[132px_minmax(0,1fr)_auto] sm:items-center">
                      <time className="hidden text-sm font-medium text-gray-700 dark:text-gray-200 sm:block">{formatDay(event.date)}</time>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getKindClass(event.kind)}`}>
                            {getKindLabel(event.kind)}
                          </span>
                          {typeof event.amount === 'number' && (
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">${event.amount.toFixed(0)}</span>
                          )}
                        </div>
                        <h3 className="mt-2 truncate text-sm font-semibold text-gray-950 dark:text-white">{event.title}</h3>
                        <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{event.cardIssuer} · {event.cardName}</p>
                      </div>
                      <Link
                        href={`/cards/${event.cardId}/edit`}
                        className="hidden min-h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800 sm:inline-flex"
                      >
                        Edit
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
