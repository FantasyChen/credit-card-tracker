'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/dateUtils';
import { 
  toggleBenefitStatusAction, 
  markBenefitAsNotUsableAction, 
  deleteCustomBenefitAction,
  addPartialCompletionAction,
  markFullCompletionAction,
  updateBenefitNotesAction,
} from '@/app/benefits/actions';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import type { DisplayBenefitStatus } from '@/app/benefits/page';
import { calculateCompletionPercentage } from '@/lib/partial-completion';

interface BenefitCardClientProps {
  status: DisplayBenefitStatus;
  onStatusChange?: (statusId: string, newIsCompleted: boolean, newUsedAmount?: number) => void;
  onNotUsableChange?: (statusId: string, newIsNotUsable: boolean) => void;
  onDelete?: (benefitId: string) => void;
  onPartialCompletionChange?: (statusId: string, newUsedAmount: number, isNowComplete: boolean) => void;
  isScheduled?: boolean;
}

export default function BenefitCardClient({ status, onStatusChange, onNotUsableChange, onDelete, onPartialCompletionChange, isScheduled = false }: BenefitCardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [notesValue, setNotesValue] = useState(status.notes ?? '');

  const benefitAmount = status.benefit.maxAmount || 0;
  const usedAmount = status.usedAmount ?? 0;
  const remainingAmount = Math.max(0, benefitAmount - usedAmount);
  const completionPercent = calculateCompletionPercentage(usedAmount, benefitAmount);

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

  const handleFullCompletion = async () => {
    const formData = new FormData();
    formData.append('benefitStatusId', status.id);
    
    startTransition(async () => {
      try {
        await markFullCompletionAction(formData);
        onStatusChange?.(status.id, true, benefitAmount);
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
        if (result.success) {
          if (result.isComplete) {
            onStatusChange?.(status.id, true, result.newUsedAmount);
          } else {
            onPartialCompletionChange?.(status.id, result.newUsedAmount, result.isComplete);
          }
          setShowPartialModal(false);
          setPartialAmount('');
        }
      } catch (error) {
        console.error('Failed to add partial completion:', error);
      }
    });
  };

  const handleNotUsableSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newIsNotUsable = !status.isNotUsable;
    
    startTransition(async () => {
      try {
        await markBenefitAsNotUsableAction(formData);
        // Call the callback to update parent state
        onNotUsableChange?.(status.id, newIsNotUsable);
      } catch (error) {
        console.error('Failed to mark benefit as not usable:', error);
        // You might want to show an error message to the user here
      }
    });
  };

  const handleNotesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('benefitStatusId', status.id);
    formData.append('notes', notesValue);

    startTransition(async () => {
      try {
        await updateBenefitNotesAction(formData);
        setShowNotesEditor(false);
        router.refresh();
      } catch (error) {
        console.error('Failed to update notes:', error);
      }
    });
  };

  const handleDeleteCustomBenefit = async () => {
    if (!status.isCustomBenefit) return;
    
    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.append('benefitId', status.benefit.id);
      await deleteCustomBenefitAction(formData);
      onDelete?.(status.benefit.id);
    } catch (error) {
      console.error('Failed to delete custom benefit:', error);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const isCompleted = status.isCompleted;
  const isCustomBenefit = status.isCustomBenefit;
  const isNotUsable = status.isNotUsable;
  const hasPartialProgress = usedAmount > 0 && !isCompleted;

  return (
    <div className={`group relative overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-lg ${
      isScheduled
        ? 'bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 dark:from-purple-900/20 dark:to-violet-900/20 dark:border-purple-700'
        : isCompleted 
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-700' 
          : isNotUsable
            ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 dark:from-gray-900/20 dark:to-slate-900/20 dark:border-gray-700'
            : 'bg-white border-gray-200 hover:border-indigo-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-indigo-600'
    }`}>
      {/* Status indicator */}
      <div className={`absolute top-0 left-0 w-1 h-full ${
        isScheduled ? 'bg-purple-500' : isCompleted ? 'bg-green-500' : isNotUsable ? 'bg-gray-500' : 'bg-indigo-500'
      }`} />
      
      <div className="p-4 sm:p-6">
        {/* Mobile-first layout: Stack content vertically on small screens */}
        <div className="space-y-4">
          {/* Top section: Icon, title, and amount */}
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 p-2 rounded-lg ${
              isScheduled
                ? 'bg-purple-100 dark:bg-purple-800/30'
                : isCompleted 
                  ? 'bg-green-100 dark:bg-green-800/30' 
                  : isNotUsable
                    ? 'bg-gray-100 dark:bg-gray-800/30'
                    : 'bg-indigo-100 dark:bg-indigo-800/30'
            }`}>
              {isScheduled ? (
                <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : isCompleted ? (
                <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : isNotUsable ? (
                <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
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
                {status.benefit.occurrencesInCycle && status.benefit.occurrencesInCycle > 1 && (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({(status.occurrenceIndex || 0) + 1} of {status.benefit.occurrencesInCycle})
                  </span>
                )}
              </h3>
              {benefitAmount > 0 && (
                <div className="mt-1">
                  <p className={`text-lg sm:text-xl font-bold ${
                    isCompleted 
                      ? 'text-green-600 dark:text-green-400' 
                      : isNotUsable
                        ? 'text-gray-600 dark:text-gray-400'
                        : hasPartialProgress
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {hasPartialProgress ? (
                      <span>
                        ${usedAmount.toFixed(2)} <span className="text-sm font-normal text-gray-500">of ${benefitAmount.toFixed(2)}</span>
                      </span>
                    ) : (
                      <span>${benefitAmount.toFixed(2)}</span>
                    )}
                  </p>
                  {/* Progress bar for partial completion */}
                  {hasPartialProgress && (
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-amber-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Card info - more compact on mobile */}
          <div className="pl-11 space-y-1.5">
            {status.benefit.creditCard ? (
              // Regular credit card benefit
              <>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                  <svg className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="font-medium truncate">{status.benefit.creditCard.displayName}</span>
                  <span className="mx-2 hidden sm:inline">•</span>
                  <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">{status.benefit.creditCard.issuer}</span>
                </div>
                {/* Show issuer on mobile in a separate line for better readability */}
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 sm:hidden">
                  <svg className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0V9a1 1 0 011-1h4a1 1 0 011 1v11" />
                  </svg>
                  <span>{status.benefit.creditCard.issuer}</span>
                </div>
              </>
            ) : (
              // Custom/standalone benefit - no credit card
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <svg className="h-4 w-4 mr-2 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="font-medium text-purple-600 dark:text-purple-400">Custom Benefit</span>
                <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                  Personal
                </span>
              </div>
            )}
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
              <svg className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {isScheduled ? (
                <span>Starts: <span className="font-medium text-purple-600 dark:text-purple-400">{formatDate(status.cycleStartDate)}</span></span>
              ) : (
                <span>Due: <span className="font-medium">{formatDate(status.cycleEndDate)}</span></span>
              )}
            </div>
          </div>
          
          {/* Usage Guide Link */}
          {status.usageWaySlug && (
            <div className="pl-11">
              <Link
                href={`/benefits/how-to-use/${status.usageWaySlug}`}
                className="inline-flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
              >
                <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How to use this benefit
                <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}

          {/* Benefit notes */}
          <div className="pl-11">
            {showNotesEditor ? (
              <form onSubmit={handleNotesSubmit} className="space-y-2">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add a note for this benefit cycle..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotesEditor(false);
                      setNotesValue(status.notes ?? '');
                    }}
                    disabled={isPending}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-1">
                {status.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{status.notes}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotesEditor(true)}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 dark:hover:text-gray-400 dark:hover:text-indigo-400 transition-colors"
                  title={status.notes ? 'Edit note' : 'Add note'}
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  {status.notes ? 'Edit note' : 'Add note'}
                </button>
              </div>
            )}
          </div>
          
          {/* Action buttons - full width on mobile, fixed width on larger screens */}
          <div className="pl-11">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Completion buttons - hide for scheduled benefits */}
              {!isScheduled && !isNotUsable && (
                <>
                  {isCompleted ? (
                    // For completed benefits, show "Mark Pending" to undo
                    <form onSubmit={handleSubmit}>
                      <input type="hidden" name="benefitStatusId" value={status.id} />
                      <input type="hidden" name="isCompleted" value={status.isCompleted.toString()} />
                      <button
                        type="submit"
                        disabled={isPending}
                        className={`w-full sm:w-auto relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg hover:shadow-xl focus:ring-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-700 ${isPending ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
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
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Mark Pending
                          </div>
                        )}
                      </button>
                    </form>
                  ) : (
                    // For upcoming benefits with maxAmount, show split buttons
                    <>
                      <button
                        type="button"
                        onClick={handleFullCompletion}
                        disabled={isPending}
                        className={`w-full sm:w-auto relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl focus:ring-green-500 dark:bg-green-600 dark:hover:bg-green-700 ${isPending ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
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
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Mark Complete
                          </div>
                        )}
                      </button>
                      {benefitAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowPartialModal(true)}
                          disabled={isPending}
                          className={`w-full sm:w-auto relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-amber-500 hover:bg-amber-600 text-white shadow-lg hover:shadow-xl focus:ring-amber-500 dark:bg-amber-600 dark:hover:bg-amber-700 ${isPending ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                        >
                          <div className="flex items-center justify-center">
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Partial Complete
                          </div>
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
              
              {/* Not Usable button - only show for upcoming benefits, not scheduled */}
              {!isCompleted && !isScheduled && (
                <form onSubmit={handleNotUsableSubmit}>
                  <input type="hidden" name="benefitStatusId" value={status.id} />
                  <input type="hidden" name="isNotUsable" value={status.isNotUsable.toString()} />
                  <button
                    type="submit"
                    disabled={isPending}
                    className={`w-full sm:w-auto relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isNotUsable
                        ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg hover:shadow-xl focus:ring-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-700'
                        : 'bg-gray-500 hover:bg-gray-600 text-white shadow-lg hover:shadow-xl focus:ring-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700'
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
                        {isNotUsable ? (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Mark Usable
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Not Usable
                          </>
                        )}
                      </div>
                    )}
                  </button>
                </form>
              )}
              
              {/* Delete button - only show for custom benefits */}
              {isCustomBenefit && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending || isDeleting}
                  className="w-full sm:w-auto relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700 hover:scale-105"
                >
                  <div className="flex items-center justify-center">
                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full mr-3">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Custom Benefit</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete <strong>&quot;{status.benefit.description}&quot;</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomBenefit}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Amount Modal */}
      {showPartialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full mr-3">
                <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Partial Amount</h3>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                {status.benefit.description}
              </p>
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Used: ${usedAmount.toFixed(2)}</span>
                <span>Remaining: ${remainingAmount.toFixed(2)}</span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-amber-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <form onSubmit={handlePartialSubmit}>
              <div className="mb-4">
                <label htmlFor="partialAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount to add
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    id="partialAmount"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder={remainingAmount.toFixed(2)}
                    step="0.01"
                    min="0.01"
                    max={remainingAmount}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-700 dark:text-white"
                    autoFocus
                  />
                </div>
                {parseFloat(partialAmount) > remainingAmount && (
                  <p className="mt-1 text-sm text-red-500">
                    Amount exceeds remaining balance of ${remainingAmount.toFixed(2)}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3">
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
                  disabled={isPending || !partialAmount || parseFloat(partialAmount) <= 0 || parseFloat(partialAmount) > remainingAmount}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : (
                    'Add Amount'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 