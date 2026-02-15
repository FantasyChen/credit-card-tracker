'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/dateUtils';
import {
  markFullCompletionAction,
  addPartialCompletionAction,
} from '@/app/benefits/actions';

interface DashboardBenefitRowProps {
  status: {
    id: string;
    cycleEndDate: Date;
    usedAmount: number | null;
    isCompleted: boolean;
    benefit: {
      description: string;
      maxAmount: number | null;
      creditCard: { name: string } | null;
    };
  };
  isExpiringSoon?: boolean;
  onComplete?: () => void;
}

export default function DashboardBenefitRow({
  status,
  isExpiringSoon = false,
  onComplete,
}: DashboardBenefitRowProps) {
  const [isPending, startTransition] = useTransition();
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [isRemoved, setIsRemoved] = useState(false);

  const benefitAmount = status.benefit.maxAmount ?? 0;
  const usedAmount = status.usedAmount ?? 0;
  const remainingAmount = Math.max(0, benefitAmount - usedAmount);
  const daysLeft = Math.ceil(
    (new Date(status.cycleEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const handleFullCompletion = () => {
    const formData = new FormData();
    formData.append('benefitStatusId', status.id);

    startTransition(async () => {
      try {
        await markFullCompletionAction(formData);
        setIsRemoved(true);
        onComplete?.();
      } catch (error) {
        console.error('Failed to mark full completion:', error);
      }
    });
  };

  const handlePartialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(partialAmount);
    if (isNaN(amount) || amount <= 0) return;

    const formData = new FormData();
    formData.append('benefitStatusId', status.id);
    formData.append('amount', amount.toString());

    startTransition(async () => {
      try {
        const result = await addPartialCompletionAction(formData);
        if (result?.success) {
          if (result.isComplete) {
            setIsRemoved(true);
            onComplete?.();
          }
          setShowPartialModal(false);
          setPartialAmount('');
        }
      } catch (error) {
        console.error('Failed to add partial completion:', error);
      }
    });
  };

  if (isRemoved) return null;

  return (
    <>
      <li
        className={`group px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200 ${
          isExpiringSoon
            ? 'border-l-4 border-l-orange-500 dark:border-l-orange-500 bg-orange-50/50 dark:bg-orange-900/10'
            : ''
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0 mt-0.5">
              <div
                className={`p-2 rounded-lg ${
                  isExpiringSoon
                    ? 'bg-orange-100 dark:bg-orange-800/30'
                    : 'bg-indigo-100 dark:bg-indigo-800/30'
                }`}
              >
                <svg
                  className={`h-5 w-5 ${
                    isExpiringSoon
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-tight">
                {status.benefit.description}
              </p>
              <div className="mt-1 space-y-1">
                <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {status.benefit.creditCard ? (
                    <span className="truncate">{status.benefit.creditCard.name}</span>
                  ) : (
                    <span className="text-purple-600 dark:text-purple-400">Custom Benefit</span>
                  )}
                </div>
                {benefitAmount > 0 && (
                  <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                    ${benefitAmount.toFixed(2)}
                    {usedAmount > 0 && (
                      <span className="font-normal text-gray-500 dark:text-gray-400">
                        {' '}
                        (used ${usedAmount.toFixed(2)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="text-left sm:text-right">
              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                Due: {formatDate(status.cycleEndDate)}
              </p>
              <p
                className={`text-xs font-medium ${
                  isExpiringSoon && daysLeft <= 3
                    ? 'text-red-600 dark:text-red-400'
                    : isExpiringSoon
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {daysLeft} days left
                {isExpiringSoon && daysLeft <= 3 && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Urgent
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleFullCompletion}
                disabled={isPending}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? (
                  <svg
                    className="animate-spin h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <>
                    <svg
                      className="h-3.5 w-3.5 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Complete
                  </>
                )}
              </button>
              {benefitAmount > 0 && remainingAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPartialModal(true)}
                  disabled={isPending}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Partial
                </button>
              )}
              <Link
                href="/benefits"
                className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="View all benefits"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </li>

      {/* Partial Amount Modal */}
      {showPartialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Add Partial Amount
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {status.benefit.description}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Remaining: ${remainingAmount.toFixed(2)}
            </p>
            <form onSubmit={handlePartialSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="partialAmount"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Amount to add
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    id="partialAmount"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder={remainingAmount.toFixed(2)}
                    step="0.01"
                    min="0.01"
                    max={remainingAmount}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:text-white"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPartialModal(false);
                    setPartialAmount('');
                  }}
                  disabled={isPending}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isPending ||
                    !partialAmount ||
                    parseFloat(partialAmount) <= 0 ||
                    parseFloat(partialAmount) > remainingAmount
                  }
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
