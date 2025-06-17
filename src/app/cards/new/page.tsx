'use client'; // Make this a Client Component

import React, { useState, useEffect, useTransition } from 'react'; // Import useTransition
import Image from 'next/image';
import { addCardAction } from './actions'; // Import the action from the new file
import type { PredefinedCard } from '@/generated/prisma'; // Import type

// Helper arrays
const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i); // Last 10 years

// --- Sub-component for the card form with its own transition state ---
function PredefinedCardForm({ card }: { card: PredefinedCard }) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      // Consider adding error handling or success feedback here if addCardAction returns status
      addCardAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit}> 
      <input type="hidden" name="predefinedCardId" value={card.id} />
      <div className="border rounded-lg p-4 shadow-md flex flex-col justify-between h-full bg-white dark:bg-gray-800 dark:border-gray-700 dark:shadow-lg dark:shadow-indigo-500/20">
        <div>
          {card.imageUrl && (
            <div className="relative h-40 w-full mb-4 rounded overflow-hidden">
              <Image
                src={card.imageUrl}
                alt={card.name}
                layout="fill"
                objectFit="contain"
                unoptimized
              />
            </div>
          )}
          <h2 className="text-xl font-semibold mb-2 dark:text-gray-100">{card.name}</h2>
          <p className="text-gray-600 mb-1 dark:text-gray-300">Issuer: {card.issuer}</p>
          <p className="text-gray-600 mb-4 dark:text-gray-300">Annual Fee: ${card.annualFee}</p>

          {/* --- Add Last 4 Digits Field --- */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-100">
              Last 4 Digits (Optional)
            </label>
            <input
              type="text"
              id={`lastFourDigits-${card.id}`}
              name="lastFourDigits"
              maxLength={4}
              pattern="[0-9]{4}"
              placeholder="1234"
              className="mt-1 block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500 dark:placeholder-gray-400"
              onInput={(e) => {
                // Only allow numbers
                const target = e.target as HTMLInputElement;
                target.value = target.value.replace(/[^0-9]/g, '');
              }}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Helps identify your specific card if you have multiple of the same type
            </p>
          </div>
          {/* --- End Last 4 Digits Field --- */}

          {/* --- Add Opened Month and Year Select --- */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-100">
              Date Card Opened (Optional)
            </label>
            <div className="flex space-x-2">
              {/* Month Select */}
              <select
                id={`openedMonth-${card.id}`}
                name="openedMonth"
                className="mt-1 block w-1/2 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                defaultValue=""
              >
                <option value="" disabled>Month...</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
              {/* Year Select */}
              <select
                id={`openedYear-${card.id}`}
                name="openedYear"
                className="mt-1 block w-1/2 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                defaultValue=""
              >
                <option value="" disabled>Year...</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Helps track annual fees/benefits. Check your credit report (
              <a href="https://www.creditkarma.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Credit Karma</a>,
              <a href="https://www.experian.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Experian</a>, etc.)
               if unsure.
            </p>
          </div>
          {/* --- End Opened Month and Year Select --- */}
        </div>
        <button
          type="submit"
          disabled={isPending}
          className={`mt-auto w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isPending ? 'Adding...' : 'Add Card'}
        </button>
      </div>
    </form>
  );
}

// --- Page Component --- 
export default function AddNewCardPage() {
  // State for cards and search term
  const [predefinedCards, setPredefinedCards] = useState<PredefinedCard[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Loading state for fetching predefined cards

  // Fetch data using useEffect
  useEffect(() => {
    async function fetchCards() {
      try {
        const response = await fetch('/api/predefined-cards');
        if (!response.ok) {
          throw new Error('Failed to fetch cards');
        }
        const data: PredefinedCard[] = await response.json();
        setPredefinedCards(data);
      } catch (error) {
        console.error("Error fetching predefined cards:", error);
        // Handle error state if needed (e.g., show error message)
      } finally {
        setIsLoading(false); // Set loading to false after fetch (success or error)
      }
    }

    fetchCards();
  }, []); // Empty dependency array means this runs once on mount

  // Filter logic
  const filteredCards = predefinedCards.filter(card => 
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.issuer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Select a Card to Add</h1>
      <div className="mb-6">
        <input 
          type="text"
          placeholder="Search by card name or issuer..."
          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
         <p className="dark:text-gray-400">Loading cards...</p> // Basic loading indicator
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCards.map((card) => (
            <PredefinedCardForm key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
} 