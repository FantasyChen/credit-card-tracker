'use client';

import React, { useTransition } from 'react';
import { formatDate } from '@/lib/dateUtils';
import { toggleBenefitStatusAction } from '@/app/benefits/actions'; // Ensure this path is correct
import type { DisplayBenefitStatus } from '@/app/benefits/page'; // Import the shared type

interface BenefitCardClientProps {
  status: DisplayBenefitStatus;
  onStatusChange?: (statusId: string, newIsCompleted: boolean) => void;
}

export default function BenefitCardClient({ status, onStatusChange }: BenefitCardClientProps) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newIsCompleted = !status.isCompleted;
    
    startTransition(async () => {
      try {
        await toggleBenefitStatusAction(formData);
        // Call the callback to update parent state
        onStatusChange?.(status.id, newIsCompleted);
      } catch (error) {
        console.error('Failed to toggle benefit status:', error);
        // You might want to show an error message to the user here
      }
    });
  };

  const isCompleted = status.isCompleted;
  const benefitAmount = status.benefit.maxAmount || 0;

  return (
    <div className={`group relative overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-lg ${
      isCompleted 
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-700' 
        : 'bg-white border-gray-200 hover:border-indigo-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-indigo-600'
    }`}>
      {/* Status indicator */}
      <div className={`absolute top-0 left-0 w-1 h-full ${
        isCompleted ? 'bg-green-500' : 'bg-indigo-500'
      }`} />
      
      <div className="p-4 sm:p-6">
        {/* Mobile-first layout: Stack content vertically on small screens */}
        <div className="space-y-4">
          {/* Top section: Icon, title, and amount */}
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 p-2 rounded-lg ${
              isCompleted 
                ? 'bg-green-100 dark:bg-green-800/30' 
                : 'bg-indigo-100 dark:bg-indigo-800/30'
            }`}>
              {isCompleted ? (
                <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">
                {status.benefit.description}
              </h3>
              {benefitAmount > 0 && (
                <p className={`text-lg sm:text-xl font-bold mt-1 ${
                  isCompleted 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-indigo-600 dark:text-indigo-400'
                }`}>
                  ${benefitAmount.toFixed(2)}
                </p>
              )}
            </div>
          </div>
          
          {/* Card info - more compact on mobile */}
          <div className="pl-11 space-y-1.5">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
              <svg className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="font-medium truncate">{status.benefit.creditCard.displayName}</span>
              <span className="mx-2 hidden sm:inline">•</span>
              <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">{status.benefit.creditCard.issuer}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
              <svg className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Due: <span className="font-medium">{formatDate(status.cycleEndDate)}</span></span>
            </div>
            {/* Show issuer on mobile in a separate line for better readability */}
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 sm:hidden">
              <svg className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0V9a1 1 0 011-1h4a1 1 0 011 1v11" />
              </svg>
              <span>{status.benefit.creditCard.issuer}</span>
            </div>
          </div>
          
          {/* Action button - full width on mobile, fixed width on larger screens */}
          <div className="pl-11">
            <form onSubmit={handleSubmit}>
              <input type="hidden" name="benefitStatusId" value={status.id} />
              <input type="hidden" name="isCompleted" value={status.isCompleted.toString()} />
              <button
                type="submit"
                disabled={isPending}
                className={`w-full sm:w-auto relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isCompleted
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg hover:shadow-xl focus:ring-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-700'
                    : 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl focus:ring-green-500 dark:bg-green-600 dark:hover:bg-green-700'
                } ${isPending ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
              >
                {isPending ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    {isCompleted ? (
                      <>
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Mark Pending
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mark Complete
                      </>
                    )}
                  </div>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 