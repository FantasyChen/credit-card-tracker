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
    <div className={`border rounded-lg p-4 shadow-sm flex items-center justify-between ${status.isCompleted ? 'bg-green-50' : 'bg-white'}`}>
      <div>
        <p className="font-medium text-lg">{status.benefit.description}</p>
        <p className="text-sm text-gray-600">
          Card: {status.benefit.creditCard.displayName} ({status.benefit.creditCard.issuer})
        </p>
        <p className="text-sm text-gray-500">
          Current Cycle Ends: {formatDate(status.cycleEndDate)}
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="benefitStatusId" value={status.id} />
        <input type="hidden" name="isCompleted" value={status.isCompleted.toString()} />
        <button
          type="submit"
          disabled={isPending}
          className={`py-2 px-4 rounded text-sm font-medium transition duration-150 ease-in-out 
            ${status.isCompleted
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'}
            ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isPending ? 'Updating...' : (status.isCompleted ? 'Mark Pending' : 'Mark Complete')}
        </button>
      </form>
    </div>
  );
} 