'use client';

import React, { useState, useTransition } from 'react';
import BenefitCardClient from '@/components/BenefitCardClient';
import { batchCompleteBenefitsByCategoryAction } from '@/app/benefits/actions';
import type { DisplayBenefitStatus } from '@/app/benefits/page';

interface CategoryBenefitsGroupProps {
  category: string;
  benefits: DisplayBenefitStatus[];
  onStatusChange?: (statusId: string, newIsCompleted: boolean) => void;
  onNotUsableChange?: (statusId: string, newIsNotUsable: boolean) => void;
}

// Category icons mapping
const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'travel':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      );
    case 'dining':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3zM9 9h6v6H9z" />
        </svg>
      );
    case 'food delivery':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'shopping':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    case 'entertainment':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0v16l4-2 4 2V4H7z" />
        </svg>
      );
    case 'wellness':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case 'membership':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'transportation':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'grocery':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
        </svg>
      );
    case 'rewards':
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      );
    default:
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      );
  }
};

export default function CategoryBenefitsGroup({ 
  category, 
  benefits, 
  onStatusChange, 
  onNotUsableChange 
}: CategoryBenefitsGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filter benefits that can be batch completed (not completed and not marked as not usable)
  const completableBenefits = benefits.filter(benefit => !benefit.isCompleted && !benefit.isNotUsable);
  const categoryTotal = benefits.reduce((sum, benefit) => sum + (benefit.benefit.maxAmount || 0), 0);
  const completedTotal = benefits
    .filter(benefit => benefit.isCompleted)
    .reduce((sum, benefit) => sum + (benefit.benefit.maxAmount || 0), 0);

  const handleBatchComplete = async () => {
    if (completableBenefits.length === 0) return;

    const benefitStatusIds = completableBenefits.map(benefit => benefit.id);
    
    startTransition(async () => {
      try {
        await batchCompleteBenefitsByCategoryAction(category, benefitStatusIds);
        // Update parent state for each completed benefit
        if (onStatusChange) {
          completableBenefits.forEach(benefit => {
            onStatusChange(benefit.id, true);
          });
        }
      } catch (error) {
        console.error('Failed to batch complete benefits:', error);
        // You might want to show an error message to the user here
      }
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Category Header */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-3 text-left w-full hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <div className="p-2 bg-indigo-100 dark:bg-indigo-800/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                {getCategoryIcon(category)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {category}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {benefits.length} benefit{benefits.length !== 1 ? 's' : ''} • ${categoryTotal.toFixed(2)} total
                  {completedTotal > 0 && ` • $${completedTotal.toFixed(2)} claimed`}
                </p>
              </div>
            </button>
            <div className="ml-auto">
              <svg 
                className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          
          {/* Batch Complete Button */}
          {completableBenefits.length > 0 && (
            <button
              onClick={handleBatchComplete}
              disabled={isPending}
              className={`ml-4 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isPending
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md'
              }`}
            >
              {isPending ? 'Completing...' : `Complete All (${completableBenefits.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Benefits List */}
      {isExpanded && (
        <div className="p-6">
          <div className="space-y-4">
            {benefits.map(benefit => (
              <BenefitCardClient 
                key={benefit.id} 
                status={benefit} 
                onStatusChange={onStatusChange}
                onNotUsableChange={onNotUsableChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 