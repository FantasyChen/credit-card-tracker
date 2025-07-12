import React from 'react';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { updateNotificationSettingsAction } from './actions'; // Import the server action

// Simple component to display potential status messages from the action
// function FormStatus({ message, success }: { message?: string; success?: boolean }) {
//   if (!message) return null;
//   return (
//     <p className={`text-sm mb-4 ${success ? 'text-green-600' : 'text-red-600'}`}>
//       {message}
//     </p>
//   );
// }

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

  // We can potentially get the status message from the form submission if needed
  // const formState = await updateNotificationSettingsAction(); // This needs useFormState hook if we want client-side feedback before revalidation

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">Notification Settings</h1>

      {/* Optional: Display status message after form submission */} 
      {/* <FormStatus message={formState?.message} success={formState?.success} /> */}

      <form action={updateNotificationSettingsAction} className="space-y-6 bg-white p-6 rounded-lg shadow dark:bg-gray-800 dark:shadow-lg dark:shadow-indigo-500/20">
        
        {/* New Benefit Notification Setting */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="notifyNewBenefit"
              name="notifyNewBenefit"
              type="checkbox"
              defaultChecked={user.notifyNewBenefit} // Set initial state from fetched data
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600 dark:focus:ring-offset-gray-800"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="notifyNewBenefit" className="font-medium text-gray-700 dark:text-gray-100">
              New Benefit Notifications
            </label>
            <p className="text-gray-500 dark:text-gray-400">Send an email when a new benefit cycle becomes available (e.g., start of month/quarter/year).</p>
          </div>
        </div>

        {/* Benefit Expiration Notification Setting */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="notifyBenefitExpiration"
              name="notifyBenefitExpiration"
              type="checkbox"
              defaultChecked={user.notifyBenefitExpiration} // Set initial state
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600 dark:focus:ring-offset-gray-800"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="notifyBenefitExpiration" className="font-medium text-gray-700 dark:text-gray-100">
              Benefit Expiration Reminder
            </label>
            <p className="text-gray-500 dark:text-gray-400">Send an email reminder before a benefit cycle is about to expire.</p>
          </div>
        </div>

        {/* Benefit Expiration Days Setting */}
        <div>
          <label htmlFor="notifyExpirationDays" className="block text-sm font-medium text-gray-700 dark:text-gray-100">
            Days Before Benefit Expiration to Notify
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="notifyExpirationDays"
              name="notifyExpirationDays"
              min="1"
              defaultValue={user.notifyExpirationDays}
              required
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-500 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
            />
          </div>
           <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter the number of days before the benefit cycle end date to receive the reminder.</p>
        </div>

        {/* Loyalty Points Expiration Notification Setting */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="notifyPointsExpiration"
              name="notifyPointsExpiration"
              type="checkbox"
              defaultChecked={user.notifyPointsExpiration ?? true}
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600 dark:focus:ring-offset-gray-800"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="notifyPointsExpiration" className="font-medium text-gray-700 dark:text-gray-100">
              Loyalty Points Expiration Notifications
            </label>
            <p className="text-gray-500 dark:text-gray-400">Send an email reminder before your loyalty program points/miles are about to expire.</p>
          </div>
        </div>

        {/* Points Expiration Days Setting */}
        <div>
          <label htmlFor="pointsExpirationDays" className="block text-sm font-medium text-gray-700 dark:text-gray-100">
            Days Before Points Expiration to Notify
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="pointsExpirationDays"
              name="pointsExpirationDays"
              min="1"
              defaultValue={user.pointsExpirationDays ?? 30}
              required
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-500 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
            />
          </div>
           <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter the number of days before your points/miles expire to receive the reminder.</p>
        </div>

        {/* Submit Button */} 
        <div>
          <button
            type="submit"
            // disabled // Enable the button
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-offset-gray-800"
          >
            Save Settings
          </button>
        </div>
      </form>

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