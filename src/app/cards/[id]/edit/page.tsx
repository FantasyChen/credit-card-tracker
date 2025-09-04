'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCardAction } from './actions';
import { isAmexCard } from '@/lib/cardDisplayUtils';

interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  lastFourDigits: string | null;
  openedDate: Date | null;
}

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

export default function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const [card, setCard] = useState<CreditCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cardId, setCardId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchCard() {
      try {
        const { id } = await params;
        setCardId(id);
        const response = await fetch(`/api/user-cards/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Card not found');
          }
          throw new Error('Failed to fetch card');
        }
        const cardData = await response.json();
        setCard(cardData);
      } catch (error) {
        console.error('Error fetching card:', error);
        setError(error instanceof Error ? error.message : 'Failed to load card');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCard();
  }, [params]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    startTransition(async () => {
      try {
        const result = await updateCardAction(formData);
        if (result.success) {
          router.push('/cards');
        } else {
          setError(result.error || 'Failed to update card');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update card');
      }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-center text-gray-500 mt-10 dark:text-gray-400">Loading card...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-10 px-4 border border-dashed rounded-lg dark:border-gray-700">
          <p className="text-red-500 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => router.push('/cards')}
            className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Back to Cards
          </button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-10 px-4 border border-dashed rounded-lg dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">Card not found</p>
          <button
            onClick={() => router.push('/cards')}
            className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Back to Cards
          </button>
        </div>
      </div>
    );
  }

  const openedDate = card.openedDate ? new Date(card.openedDate) : null;

  // Check if this is an AMEX card for dynamic form constraints
  const isAmex = isAmexCard(card.issuer);
  const maxLength = isAmex ? 5 : 4;
  const pattern = isAmex ? "[0-9]{4,5}" : "[0-9]{4}";
  const placeholder = isAmex ? "12345" : "1234";
  const label = isAmex ? "Last 5 Digits (Optional)" : "Last 4 Digits (Optional)";
  const helperText = isAmex 
    ? "Enter the last 5 digits from your AMEX card (4 digits also accepted)"
    : "Helps identify your specific card if you have multiple of the same type";

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">Edit Card</h1>
        
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="cardId" value={cardId || ''} />
          
          <div className="border rounded-lg p-6 shadow-md bg-white dark:bg-gray-800 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">{card.name}</h2>
            <p className="text-gray-600 mb-4 dark:text-gray-300">Issuer: {card.issuer}</p>

            {/* Last Digits Field (Dynamic for AMEX) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-100">
                {label}
              </label>
              <input
                type="text"
                name="lastFourDigits"
                maxLength={maxLength}
                pattern={pattern}
                placeholder={placeholder}
                defaultValue={card.lastFourDigits || ''}
                className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500 dark:placeholder-gray-400"
                onInput={(e) => {
                  // Only allow numbers and enforce length limits
                  const target = e.target as HTMLInputElement;
                  const cleaned = target.value.replace(/[^0-9]/g, '');
                  target.value = cleaned.slice(0, maxLength);
                }}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {helperText}
              </p>
            </div>

            {/* Anniversary Date Fields */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-100">
                Anniversary Date (Optional)
              </label>
              <div className="flex space-x-2">
                {/* Month Select */}
                <select
                  name="openedMonth"
                  className="mt-1 block w-1/2 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                  defaultValue={openedDate ? openedDate.getUTCMonth() + 1 : ''}
                >
                  <option value="">Month...</option>
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
                {/* Year Select */}
                <select
                  name="openedYear"
                  className="mt-1 block w-1/2 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                  defaultValue={openedDate ? openedDate.getUTCFullYear() : ''}
                >
                  <option value="">Year...</option>
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                The card anniversary date affects when annual benefits reset
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => router.push('/cards')}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition duration-200 dark:bg-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={`flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 dark:bg-blue-600 dark:hover:bg-blue-700 ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 