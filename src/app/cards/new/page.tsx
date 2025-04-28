'use client'; // Make this a Client Component

import React, { useState, useEffect } from 'react'; // Import hooks
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

// --- Page Component --- 
export default function AddNewCardPage() {
  // State for cards and search term
  const [predefinedCards, setPredefinedCards] = useState<PredefinedCard[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Loading state

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

  // TODO: Add loading indicator
  // TODO: Add search input field
  // TODO: Map over filteredCards instead of predefinedCards

  // --- TEMPORARY return - will be replaced --- 
  // return <div>Loading... (Component structure needs update)</div>;

  // --- ORIGINAL return structure (to be adapted) ---
  // const predefinedCards = await prisma.predefinedCard.findMany(); // REMOVE THIS LINE

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Select a Card to Add</h1>
      {/* Add Search Input Here */}
      <div className="mb-6">
        <input 
          type="text"
          placeholder="Search by card name or issuer..."
          className="w-full p-2 border border-gray-300 rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
         <p>Loading cards...</p> // Basic loading indicator
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCards.map((card) => (
            <form key={card.id} action={addCardAction}> {/* Use the imported action */}
              <input type="hidden" name="predefinedCardId" value={card.id} />
              <div className="border rounded-lg p-4 shadow-md flex flex-col justify-between h-full">
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
                  <h2 className="text-xl font-semibold mb-2">{card.name}</h2>
                  <p className="text-gray-600 mb-1">Issuer: {card.issuer}</p>
                  <p className="text-gray-600 mb-4">Annual Fee: ${card.annualFee}</p>

                  {/* --- Add Opened Month and Year Select --- */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Card Opened (Optional)
                    </label>
                    <div className="flex space-x-2">
                      {/* Month Select */}
                      <select
                        id={`openedMonth-${card.id}`}
                        name="openedMonth"
                        className="mt-1 block w-1/2 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
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
                        className="mt-1 block w-1/2 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        defaultValue=""
                      >
                        <option value="" disabled>Year...</option>
                        {years.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Helps track annual fees/benefits. Check your credit report (
                      <a href="https://www.creditkarma.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Credit Karma</a>,
                      <a href="https://www.experian.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Experian</a>, etc.)
                       if unsure.
                    </p>
                  </div>
                  {/* --- End Opened Month and Year Select --- */}
                </div>
                <button
                  type="submit"
                  className="mt-auto w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                >
                  Add Card
                </button>
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
} 