import React from 'react';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { updateNotificationSettingsAction } from './actions';

// Component to display a success message
function SuccessMessage() {
  return (
    <div className="mb-4 p-3 rounded-md bg-green-100 border border-green-300 text-green-800 text-sm">
      Settings saved successfully!
    </div>
  );
}

// Define the props structure explicitly
interface NotificationSettingsPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

// Use the defined interface
export default async function NotificationSettingsPage({ searchParams }: NotificationSettingsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/notifications');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      notifyNewBenefit: true,
      notifyBenefitExpiration: true,
      notifyExpirationDays: true,
    },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>
      <form action={updateNotificationSettingsAction} className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="notifyNewBenefit"
              name="notifyNewBenefit"
              type="checkbox"
              defaultChecked={user.notifyNewBenefit}
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="notifyNewBenefit" className="font-medium text-gray-700">
              New Benefit Notifications
            </label>
            <p className="text-gray-500">Send an email when a new benefit cycle becomes available (e.g., start of month/quarter/year).</p>
          </div>
        </div>

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="notifyBenefitExpiration"
              name="notifyBenefitExpiration"
              type="checkbox"
              defaultChecked={user.notifyBenefitExpiration}
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="notifyBenefitExpiration" className="font-medium text-gray-700">
              Benefit Expiration Reminder
            </label>
            <p className="text-gray-500">Send an email reminder before a benefit cycle is about to expire.</p>
          </div>
        </div>

        <div>
          <label htmlFor="notifyExpirationDays" className="block text-sm font-medium text-gray-700">
            Days Before Expiration to Notify
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="notifyExpirationDays"
              name="notifyExpirationDays"
              min="1"
              defaultValue={user.notifyExpirationDays}
              required
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm max-w-xs"
            />
          </div>
           <p className="mt-1 text-xs text-gray-500">Enter the number of days before the cycle end date to receive the reminder.</p>
        </div>

        <div>
          <button
            type="submit"
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
} 