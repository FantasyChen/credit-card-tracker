'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { resetBenefitTrackingPreferenceAction } from '@/app/benefits/actions';

export interface TrackedBenefitPreference {
  id: string;
  mode: 'AUTO_CLAIM' | 'IGNORE';
  description: string;
  category: string;
  cardLabel: string;
}

const MODE_COPY: Record<TrackedBenefitPreference['mode'], { label: string; detail: string }> = {
  AUTO_CLAIM: {
    label: 'Auto-claimed',
    detail: 'Each new cycle opens already claimed and still counts toward ROI.',
  },
  IGNORE: {
    label: 'Ignored',
    detail: 'Hidden from the dashboard and excluded from claimed value and ROI.',
  },
};

export default function BenefitTrackingClient({
  preferences,
}: {
  preferences: TrackedBenefitPreference[];
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = (preferenceId: string) => {
    const formData = new FormData();
    formData.append('preferenceId', preferenceId);
    setPendingId(preferenceId);

    startTransition(async () => {
      try {
        setError(null);
        await resetBenefitTrackingPreferenceAction(formData);
      } catch (resetError) {
        console.error('Failed to reset tracking preference:', resetError);
        setError(
          resetError instanceof Error ? resetError.message : 'Failed to reset tracking preference.'
        );
      } finally {
        setPendingId(null);
      }
    });
  };

  if (preferences.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Every benefit is tracked normally. Use the tracking menu on any benefit to claim it
          automatically or ignore it.
        </p>
        <Link
          href="/benefits"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Go to benefits
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      {preferences.map((preference) => (
        <div
          key={preference.id}
          className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {preference.description}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  preference.mode === 'AUTO_CLAIM'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {MODE_COPY[preference.mode].label}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {preference.cardLabel} · {preference.category}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {MODE_COPY[preference.mode].detail}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleReset(preference.id)}
            disabled={isPending && pendingId === preference.id}
            className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {isPending && pendingId === preference.id ? 'Resetting…' : 'Track normally'}
          </button>
        </div>
      ))}
    </div>
  );
}
