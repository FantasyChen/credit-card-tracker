'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCardAction } from './actions';
import { isAmexCard } from '@/lib/cardDisplayUtils';
import { Tooltip } from '@/components/ui/Tooltip';

interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  lastFourDigits: string | null;
  openedDate: Date | null;
  nickname: string | null;
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
  const label = isAmex ? "Last 5 Digits" : "Last 4 Digits";
  const helperText = isAmex 
    ? "Enter the last 5 digits from your AMEX card (4 digits also accepted)"
    : "Helps identify your specific card if you have multiple of the same type";

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">Edit Card</h1>
        
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="cardId" value={cardId || ''} />
          
          <div className="border rounded-lg p-4 shadow-md bg-white dark:bg-gray-800 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-2 dark:text-gray-100">{card.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">{card.issuer}</p>

            {/* Nickname Field */}
            <div className="mb-3">
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
                Nickname <span className="text-xs text-gray-400 ml-1">(optional)</span>
                <Tooltip content="Give this card a nickname to easily identify it" />
              </label>
              <input
                type="text"
                name="nickname"
                maxLength={50}
                placeholder="Work Card, Personal Travel..."
                defaultValue={card.nickname || ''}
                className="block w-full px-3 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500 dark:placeholder-gray-400"
              />
            </div>

            {/* Last Digits Field (Dynamic for AMEX) */}
            <div className="mb-3">
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
                {label} <span className="text-xs text-gray-400 ml-1">(optional)</span>
                <Tooltip content={helperText} />
              </label>
              <input
                type="text"
                name="lastFourDigits"
                maxLength={maxLength}
                pattern={pattern}
                placeholder={placeholder}
                defaultValue={card.lastFourDigits || ''}
                className="block w-full px-3 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500 dark:placeholder-gray-400"
                onInput={(e) => {
                  const target = e.target as HTMLInputElement;
                  const cleaned = target.value.replace(/[^0-9]/g, '');
                  target.value = cleaned.slice(0, maxLength);
                }}
              />
            </div>

            {/* Anniversary Date Fields */}
            <div className="mb-4">
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
                Anniversary Date <span className="text-xs text-gray-400 ml-1">(optional)</span>
                <Tooltip content="The card anniversary date affects when annual benefits reset" />
              </label>
              <div className="flex gap-2">
                <select
                  name="openedMonth"
                  className="block w-1/2 px-2 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                  defaultValue={openedDate ? openedDate.getUTCMonth() + 1 : ''}
                >
                  <option value="">Month...</option>
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
                <select
                  name="openedYear"
                  className="block w-1/2 px-2 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                  defaultValue={openedDate ? openedDate.getUTCFullYear() : ''}
                >
                  <option value="">Year...</option>
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => router.push('/cards')}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors dark:bg-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={`flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors dark:bg-blue-600 dark:hover:bg-blue-700 ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
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