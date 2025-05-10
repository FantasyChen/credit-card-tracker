'use client';

import React, { useTransition } from 'react';
import { formatDate } from '@/lib/dateUtils';
import { toggleBenefitStatusAction } from '@/app/benefits/actions'; // Ensure this path is correct
import type { DisplayBenefitStatus } from '@/app/benefits/page'; // Import the shared type

export default function BenefitCardClient({ status }: { status: DisplayBenefitStatus }) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      toggleBenefitStatusAction(formData);
    });
  };

  return (
    <div className={`border rounded-lg p-4 shadow-sm flex items-center justify-between dark:border-gray-700 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-indigo-500/10 ${status.isCompleted ? 'bg-green-50 dark:bg-green-800 dark:bg-opacity-30' : 'bg-white dark:bg-gray-800'}`}>
      <div>
        <p className="font-medium text-lg dark:text-gray-100">{status.benefit.description}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Card: {status.benefit.creditCard.displayName} ({status.benefit.creditCard.issuer})
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Current Cycle Ends: {formatDate(status.cycleEndDate)}
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="benefitStatusId" value={status.id} />
        <input type="hidden" name="isCompleted" value={status.isCompleted.toString()} />
        <button
          type="submit"
          disabled={isPending}
          className={`py-2 px-4 rounded text-sm font-medium transition duration-150 ease-in-out text-white 
            ${status.isCompleted
              ? 'bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700'
              : 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700'}
            ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isPending ? 'Updating...' : (status.isCompleted ? 'Mark Pending' : 'Mark Complete')}
        </button>
      </form>
    </div>
  );
} 