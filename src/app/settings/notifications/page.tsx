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
      <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>

      {/* Optional: Display status message after form submission */} 
      {/* <FormStatus message={formState?.message} success={formState?.success} /> */}

      <form action={updateNotificationSettingsAction} className="space-y-6 bg-white p-6 rounded-lg shadow">
        
        {/* New Benefit Notification Setting */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="notifyNewBenefit"
              name="notifyNewBenefit"
              type="checkbox"
              defaultChecked={user.notifyNewBenefit} // Set initial state from fetched data
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

        {/* Benefit Expiration Notification Setting */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="notifyBenefitExpiration"
              name="notifyBenefitExpiration"
              type="checkbox"
              defaultChecked={user.notifyBenefitExpiration} // Set initial state
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

        {/* Expiration Days Setting (conditionally relevant) */} 
        {/* You might want to hide/disable this if notifyBenefitExpiration is unchecked using client-side JS if needed */}
        <div>
          <label htmlFor="notifyExpirationDays" className="block text-sm font-medium text-gray-700">
            Days Before Expiration to Notify
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="notifyExpirationDays"
              name="notifyExpirationDays"
              min="1" // Ensure positive number
              defaultValue={user.notifyExpirationDays} // Set initial value
              required // Good practice
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm max-w-xs"
            />
          </div>
           <p className="mt-1 text-xs text-gray-500">Enter the number of days before the cycle end date to receive the reminder.</p>
        </div>

        {/* Submit Button */} 
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