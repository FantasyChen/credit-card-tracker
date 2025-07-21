'use client';

import React, { useState, useTransition } from 'react';

interface NotificationSettings {
  notifyNewBenefit: boolean;
  notifyBenefitExpiration: boolean;
  notifyExpirationDays: number;
  notifyPointsExpiration: boolean | null;
  pointsExpirationDays: number | null;
}

interface NotificationSettingsFormProps {
  initialSettings: NotificationSettings;
  updateAction: (formData: FormData) => Promise<void>;
}

export default function NotificationSettingsForm({
  initialSettings,
  updateAction,
}: NotificationSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await updateAction(formData);
        setSaveStatus({
          type: 'success',
          message: 'Settings saved successfully!',
        });
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveStatus({ type: null, message: '' });
        }, 3000);
      } catch (error) {
        console.error('Failed to update notification settings:', error);
        setSaveStatus({
          type: 'error',
          message: 'Failed to save settings. Please try again.',
        });
        // Clear error message after 5 seconds
        setTimeout(() => {
          setSaveStatus({ type: null, message: '' });
        }, 5000);
      }
    });
  };

  return (
    <div>
      {/* Status Message */}
      {saveStatus.type && (
        <div className={`mb-4 p-3 rounded-md ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
            : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
        }`}>
          <div className="flex items-center">
            {saveStatus.type === 'success' ? (
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {saveStatus.message}
          </div>
        </div>
      )}

      <form 
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-6 rounded-lg shadow dark:bg-gray-800 dark:shadow-lg dark:shadow-indigo-500/20"
      >
        {/* New Benefit Notification Setting */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="notifyNewBenefit"
              name="notifyNewBenefit"
              type="checkbox"
              defaultChecked={initialSettings.notifyNewBenefit}
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
              defaultChecked={initialSettings.notifyBenefitExpiration}
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
              defaultValue={initialSettings.notifyExpirationDays}
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
              defaultChecked={initialSettings.notifyPointsExpiration ?? true}
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
              defaultValue={initialSettings.pointsExpirationDays ?? 30}
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
            disabled={isPending}
            className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-offset-gray-800 transition-all duration-200"
          >
            {isPending ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </div>
            ) : (
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Settings
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 