import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CouponCycle Loyalty - Never Let Points Expire Again',
  description:
    'Track airline miles, hotel points, and loyalty program expirations. Get alerts before your points expire. Free, private, no bank access required.',
  keywords: [
    'loyalty program tracker',
    'airline miles expiration',
    'hotel points tracker',
    'points expiration alerts',
    'miles tracker free',
  ],
};

export default async function LoyaltyLandingPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect('/loyalty');
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto grid min-h-[70vh] max-w-screen-xl px-4 py-8 lg:grid-cols-12 lg:gap-8 lg:py-16 xl:gap-0">
          <div className="mr-auto place-self-center lg:col-span-7">
            <div className="mb-4 inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              Loyalty Program Tracker
            </div>
            <h1 className="mb-4 max-w-2xl text-4xl font-extrabold leading-none tracking-tight text-gray-900 dark:text-white md:text-5xl xl:text-6xl">
              Stop Losing Points &amp; Miles to Expiration
            </h1>
            <p className="mb-6 max-w-2xl font-light text-gray-500 dark:text-gray-300 md:text-lg lg:mb-8 lg:text-xl">
              Airlines, hotels, and loyalty programs quietly expire your hard-earned points. CouponCycle tracks every program, sends timely alerts, and helps you keep your rewards alive.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-5 py-3 text-center text-base font-medium text-white hover:bg-purple-700 focus:ring-4 focus:ring-purple-300 dark:focus:ring-purple-900"
              >
                Get Started Free
                <svg
                  className="ml-2 h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-3 text-base font-medium text-gray-900 hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-800"
              >
                Sign In
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <div className="inline-flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-700 dark:bg-purple-900/20">
                <svg
                  className="h-6 w-6 flex-shrink-0 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                    Smart Alerts
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    Email notifications before points expire
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-700 dark:bg-green-900/20">
                <svg
                  className="h-6 w-6 flex-shrink-0 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                    100% Free &amp; Private
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    No bank access, no data selling
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:col-span-5 lg:mt-0 lg:flex lg:items-center lg:justify-center">
            <div className="grid grid-cols-2 gap-4">
              {/* Program cards preview */}
              {[
                { name: 'United MileagePlus', type: 'Airline', color: 'blue' },
                { name: 'Hilton Honors', type: 'Hotel', color: 'indigo' },
                { name: 'Delta SkyMiles', type: 'Airline', color: 'red' },
                { name: 'Marriott Bonvoy', type: 'Hotel', color: 'purple' },
              ].map((program) => (
                <div
                  key={program.name}
                  className={`rounded-xl border border-${program.color}-200 dark:border-${program.color}-700 bg-white p-4 shadow-lg dark:bg-gray-800`}
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {program.type}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {program.name}
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-purple-500"
                      style={{
                        width: `${Math.floor(Math.random() * 60 + 30)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-800">
        <div className="container mx-auto max-w-screen-xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">
            How It Works
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Add Your Programs',
                description:
                  'Select from 30+ airline, hotel, and loyalty programs. We know the expiration rules so you don\'t have to.',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                ),
              },
              {
                step: '2',
                title: 'Track Activity',
                description:
                  'Log your last activity date. We calculate when your points expire and countdown the days remaining.',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                ),
              },
              {
                step: '3',
                title: 'Get Alerts',
                description:
                  'Receive email alerts 30 days before points expire. Customize your notification window.',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                ),
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <svg
                    className="h-7 w-7 text-purple-600 dark:text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {item.icon}
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Programs */}
      <section className="py-16">
        <div className="container mx-auto max-w-screen-xl px-4">
          <h2 className="mb-4 text-center text-3xl font-bold text-gray-900 dark:text-white">
            Programs We Track
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-gray-600 dark:text-gray-400">
            We support all major airline, hotel, and loyalty programs with built-in expiration rules.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {[
              'United MileagePlus',
              'Delta SkyMiles',
              'American Airlines',
              'Southwest',
              'JetBlue',
              'Alaska Airlines',
              'Hilton Honors',
              'Marriott Bonvoy',
              'IHG Rewards',
              'World of Hyatt',
              'Choice Privileges',
              'Wyndham Rewards',
            ].map((name) => (
              <div
                key={name}
                className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-4 text-center text-sm font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {name}
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            And more — including rental car programs and credit card points systems
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-purple-600 py-16 dark:bg-purple-800">
        <div className="container mx-auto max-w-screen-xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">
            Start Protecting Your Points Today
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-purple-100">
            Join CouponCycle and never lose another mile or point to expiration. It&apos;s free forever.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-medium text-purple-600 hover:bg-purple-50 focus:ring-4 focus:ring-purple-300"
            >
              Create Free Account
            </Link>
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center rounded-lg border border-white px-6 py-3 text-base font-medium text-white hover:bg-purple-700 focus:ring-4 focus:ring-purple-300"
            >
              Sign In with Google or GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Also track benefits */}
      <section className="border-t border-gray-200 bg-gray-50 py-12 dark:border-gray-700 dark:bg-gray-900">
        <div className="container mx-auto max-w-screen-xl px-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            CouponCycle also helps you{' '}
            <Link
              href="/"
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              track credit card benefits
            </Link>{' '}
            — maximize annual fee ROI, track Uber credits, airline credits, and more.
          </p>
        </div>
      </section>
    </div>
  );
}
