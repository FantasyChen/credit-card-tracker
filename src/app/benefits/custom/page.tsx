'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, SparklesIcon, PlusIcon } from '@heroicons/react/24/outline';
import { createCustomBenefitAction } from '../actions';
import { Metadata } from 'next';

const categories = [
  { value: 'Travel', label: 'Travel', icon: '✈️' },
  { value: 'Dining', label: 'Dining', icon: '🍽️' },
  { value: 'Shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'Entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'Transportation', label: 'Transportation', icon: '🚗' },
  { value: 'Other', label: 'Other', icon: '📦' },
];

const frequencies = [
  { value: 'WEEKLY', label: 'Weekly', description: 'Resets every week' },
  { value: 'MONTHLY', label: 'Monthly', description: 'Resets every month' },
  { value: 'QUARTERLY', label: 'Quarterly', description: 'Resets every 3 months' },
  { value: 'YEARLY', label: 'Yearly', description: 'Resets every year' },
  { value: 'ONE_TIME', label: 'One-Time', description: 'Does not repeat' },
];

export default function AddCustomBenefitPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFrequency, setSelectedFrequency] = useState('MONTHLY');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      try {
        await createCustomBenefitAction(formData);
        // Redirect happens in the action
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create benefit');
      }
    });
  };

  const getDefaultStartDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/benefits" 
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Benefits
        </Link>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
            <SparklesIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Add Custom Benefit
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track your own recurring coupons, discounts, or subscriptions
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
          {/* Description */}
          <div>
            <label 
              htmlFor="description" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Benefit Name *
            </label>
            <input
              type="text"
              id="description"
              name="description"
              required
              maxLength={200}
              placeholder="e.g., Walmart+ Monthly Delivery Credit, Starbucks Stars Reward"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enter a descriptive name for your benefit
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                    selectedCategory === cat.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <span className="text-2xl mb-1">{cat.icon}</span>
                  <span className={`text-xs font-medium ${
                    selectedCategory === cat.value 
                      ? 'text-indigo-600 dark:text-indigo-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
            <input type="hidden" name="category" value={selectedCategory} required />
          </div>

          {/* Value */}
          <div>
            <label 
              htmlFor="maxAmount" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Value ($) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                $
              </span>
              <input
                type="number"
                id="maxAmount"
                name="maxAmount"
                required
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              The value of this benefit per cycle
            </p>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Frequency *
            </label>
            <div className="space-y-2">
              {frequencies.map((freq) => (
                <label
                  key={freq.value}
                  className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedFrequency === freq.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={freq.value}
                    checked={selectedFrequency === freq.value}
                    onChange={(e) => setSelectedFrequency(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <span className={`font-medium ${
                      selectedFrequency === freq.value 
                        ? 'text-indigo-600 dark:text-indigo-400' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {freq.label}
                    </span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      — {freq.description}
                    </span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    selectedFrequency === freq.value
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-gray-300 dark:border-gray-500'
                  }`}>
                    {selectedFrequency === freq.value && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label 
              htmlFor="startDate" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              defaultValue={getDefaultStartDate()}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              When does this benefit start? Defaults to today.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Link
            href="/benefits"
            className="px-6 py-2.5 text-center text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending || !selectedCategory}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors ${
              isPending || !selectedCategory ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <PlusIcon className="h-4 w-4" />
                Add Benefit
              </>
            )}
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          What are custom benefits?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Custom benefits let you track recurring discounts, coupons, or subscriptions that aren&apos;t 
          tied to a specific credit card. Examples include:
        </p>
        <ul className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Weekly store coupons or loyalty rewards</li>
          <li>• Monthly subscription perks (Walmart+, Amazon Prime benefits)</li>
          <li>• Quarterly membership discounts</li>
          <li>• Annual renewal bonuses</li>
        </ul>
      </div>
    </div>
  );
}

