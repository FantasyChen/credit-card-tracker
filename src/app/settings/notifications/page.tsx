import React from 'react';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { updateNotificationSettingsAction } from './actions'; // Import the server action
import NotificationSettingsForm from './NotificationSettingsForm'; // New client component

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/settings/notifications');
  }

  // Fetch current user settings
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      notifyNewBenefit: true,
      notifyBenefitExpiration: true,
      notifyExpirationDays: true,
      notifyPointsExpiration: true,
      pointsExpirationDays: true,
    },
  });

  if (!user) {
    // Should not happen if session is valid, but good practice
    throw new Error('User not found.');
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">Notification Settings</h1>

      <NotificationSettingsForm 
        initialSettings={user}
        updateAction={updateNotificationSettingsAction}
      />

      {/* Additional Settings Section */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow dark:bg-gray-800 dark:shadow-lg dark:shadow-indigo-500/20">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Additional Settings</h2>
        <div className="space-y-4">
          <div>
            <a
              href="/loyalty"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
            >
              Loyalty Programs
            </a>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage your loyalty program accounts and point balances
            </p>
          </div>
          <div>
            <a
              href="/settings/data"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
            >
              Data Management
            </a>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Import and export your credit card and benefit data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 