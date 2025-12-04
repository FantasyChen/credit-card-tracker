import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  BellIcon,
  ArrowDownTrayIcon,
  CreditCardIcon,
  UserCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

export const metadata: Metadata = {
  title: "Settings - Manage Your Preferences",
  description: "Manage your CouponCycle account settings, notification preferences, and data.",
  alternates: {
    canonical: '/settings',
  },
};

interface SettingsCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

function SettingsCard({ href, icon, title, description, badge }: SettingsCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex items-start gap-4 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg transition-all duration-200"
    >
      <div className="flex-shrink-0 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {title}
          </h3>
          {badge && (
            <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
      <div className="flex-shrink-0 self-center">
        <svg className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/settings');
  }

  const settingsItems = [
    {
      href: '/settings/notifications',
      icon: <BellIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
      title: 'Notifications',
      description: 'Configure email alerts for expiring benefits and new cycles.',
    },
    {
      href: '/settings/data',
      icon: <ArrowDownTrayIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
      title: 'Import & Export Data',
      description: 'Backup your data or import from a previous export.',
    },
  ];

  const quickActions = [
    {
      href: '/cards',
      icon: <CreditCardIcon className="h-5 w-5" />,
      label: 'Manage Cards',
    },
    {
      href: '/benefits',
      icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>,
      label: 'View Benefits',
    },
    {
      href: '/loyalty',
      icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>,
      label: 'Loyalty Programs',
    },
  ];

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account preferences and data.
        </p>
      </div>

      {/* Account Info */}
      <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="h-16 w-16 rounded-full ring-4 ring-white dark:ring-gray-800"
              />
            ) : (
              <UserCircleIcon className="h-16 w-16 text-indigo-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              {session.user.name || 'User'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {session.user.email}
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
            <ShieldCheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Verified
            </span>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Preferences
        </h2>
        <div className="grid gap-4">
          {settingsItems.map((item) => (
            <SettingsCard key={item.href} {...item} />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              {action.icon}
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="mt-12 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your data is stored securely and never shared with third parties.
              Read our{' '}
              <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Privacy Policy
              </Link>{' '}
              to learn more.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

