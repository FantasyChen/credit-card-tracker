'use client'; // Make this a Client Component because we need interactivity

import React, { useState, useEffect, useTransition, useMemo } from 'react'; // Add useMemo
import Link from 'next/link';
import Image from 'next/image';
import { deleteCardAction } from './actions'; // Import the delete action
import type { CreditCard, Benefit } from '@/generated/prisma'; // Removed unused PredefinedCard
import { generateCardDisplayNames } from '@/lib/cardDisplayUtils';

// Type for cards fetched from the API, assuming benefits are included
interface FetchedUserCard extends CreditCard {
  benefits: Benefit[];
  imageUrl?: string | null; // Add imageUrl field
}

// Correctly type the card data fetched/used client-side
// Add displayName for indexed card names
interface DisplayUserCard extends FetchedUserCard { // Inherit from FetchedUserCard
  displayName?: string; 
}

// Helper function to format Date as "Month Year" or return 'N/A'
const formatOpenedDate = (date: Date | null): string => {
  if (!date) return 'N/A';
  // Ensure it's a Date object (Prisma might return string)
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'N/A'; // Invalid date
  
  // Use UTC methods to avoid timezone conversion issues
  const utcMonth = dateObj.getUTCMonth();
  const utcYear = dateObj.getUTCFullYear();
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return `${monthNames[utcMonth]} ${utcYear}`;
};

// Client Component for displaying a single card with delete functionality
function CardItem({ card, setCards }: { card: DisplayUserCard, setCards: React.Dispatch<React.SetStateAction<FetchedUserCard[]>> }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirm(`Are you sure you want to remove the card "${card.displayName || card.name}"? This action cannot be undone.`)) {
      const formData = new FormData(event.currentTarget);
      startTransition(async () => {
        const result = await deleteCardAction(formData);
        if (result?.success) {
          setCards(currentRawCards => currentRawCards.filter(c => c.id !== card.id));
        } else {
          alert(result?.error || 'Failed to delete card. Please try again.');
        }
      });
    }
  };

  return (
    <div className="border rounded-lg p-4 shadow-md bg-white flex flex-col justify-between h-full dark:bg-gray-800 dark:border-gray-700 dark:shadow-lg dark:shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200">
       <div> {/* Content wrapper */}
        {/* Card Image */}
        {card.imageUrl ? (
          <div className="relative h-40 w-full mb-4 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-700">
            <Image
              src={card.imageUrl}
              alt={card.displayName || card.name}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        ) : (
          <div className="relative h-40 w-full mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-8 mx-auto mb-2 bg-gray-300 dark:bg-gray-600 rounded border-2 border-gray-400 dark:border-gray-500 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">💳</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {card.issuer}
              </p>
            </div>
          </div>
        )}
        
        <div className="flex-grow">
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100 leading-tight">{card.displayName || card.name}</h2> {/* Use displayName */}
          <div className="space-y-1 mb-3">
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              <span className="font-medium">Issuer:</span> {card.issuer}
            </p>
            {card.lastFourDigits && (
               <p className="text-gray-500 dark:text-gray-400 text-sm">
                 <span className="font-medium">Last {card.lastFourDigits.length}:</span> {'•'.repeat(card.lastFourDigits.length)}{card.lastFourDigits}
               </p>
            )}
            {card.openedDate && (
               <p className="text-gray-500 dark:text-gray-400 text-sm">
                 <span className="font-medium">Opened:</span> {formatOpenedDate(card.openedDate)}
               </p>
            )}
          </div>

          {card.benefits.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                Key Benefits ({card.benefits.length}):
              </h3>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 dark:text-gray-300">
                {card.benefits.slice(0, 3).map(benefit => (
                  <li key={benefit.id} className="leading-relaxed">{benefit.description}</li>
                ))}
                {card.benefits.length > 3 && (
                  <li className="text-blue-600 dark:text-blue-400 font-medium">
                    +{card.benefits.length - 3} more benefit{card.benefits.length - 3 > 1 ? 's' : ''}
                  </li>
                )}
              </ul>
              <div className="mt-2 text-right">
                <Link
                  href={`/settings/suggest?type=EDIT_CARD&cardName=${encodeURIComponent(card.name)}&issuer=${encodeURIComponent(card.issuer)}`}
                  className="text-xs text-blue-600 underline"
                >
                  Suggest an edit
                </Link>
              </div>
            </div>
          )}
        </div>
       </div>

       {/* Action Buttons */}
       <div className="mt-6 flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
          <Link
            href={`/cards/${card.id}/edit`}
            className="flex-1 mr-2 text-center text-sm px-4 py-2 rounded-md transition duration-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-800/30 font-medium"
          >
            ✏️ Edit
          </Link>
          <form onSubmit={handleDelete} className="flex-1 ml-2">
            <input type="hidden" name="cardId" value={card.id} />
            <button
               type="submit"
               disabled={isPending} // Disable button while deleting
               className={`w-full text-sm px-4 py-2 rounded-md transition duration-200 font-medium ${isPending ? 'bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400' : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-800/30'}`}
             >
               {isPending ? '🔄 Removing...' : '🗑️ Remove'}
             </button>
          </form>
       </div>
    </div>
  );
}

// Main Page Component (remains mostly server-side fetching, passes data to client component)
export default function UserCardsPage() {
  const [rawCards, setRawCards] = useState<FetchedUserCard[]>([]); // Store raw cards from fetch
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch cards client-side (alternative to RSC fetch if needed)
    // You might need to adjust this based on whether session needs to be checked client-side
    async function fetchUserCards() {
      try {
        // This assumes an API route /api/user-cards exists that fetches cards for the logged-in user
        // Alternatively, if this page MUST remain RSC, fetch data server-side and pass as props.
        const response = await fetch('/api/user-cards'); // Adjust API route if necessary
        if (!response.ok) {
          if (response.status === 401) {
             // Handle unauthorized - maybe redirect or show login prompt
             setError("Please sign in to view your cards.");
             // Set cards to empty array or handle appropriately
             setRawCards([]); 
             return; // Stop execution for this case
          } else {
             throw new Error('Failed to fetch cards');
          }
        }
        const data: FetchedUserCard[] = await response.json();
        setRawCards(data);
      } catch (err: unknown) { // Use unknown for caught errors
        console.error("Error fetching user cards:", err);
        setError(err instanceof Error ? err.message : "Could not load cards."); // Use type guard for error
      } finally {
        setIsLoading(false);
      }
    }
    fetchUserCards();
  }, []);

  // Process cards to add displayName for duplicates
  const cards = useMemo(() => {
    return generateCardDisplayNames(rawCards);
  }, [rawCards]);

  // Get searchParams client-side if modal logic is active
  // const searchParams = useSearchParams(); 
  // const isModalOpen = searchParams?.get('addCard') === 'true'; 
  
  // Fetch predefined cards if modal logic is active
  // const allPredefinedCards: PredefinedCard[] = []; 

  // --- Rendering Logic --- 

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-white">My Cards</h1>
        {/* Conditionally render Add New Card button */}
        {!isLoading && !error && (
          <Link href="/cards/new" className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 transition duration-200 dark:bg-green-600 dark:hover:bg-green-700">
            Add New Card
          </Link>
        )}
      </div>

      {isLoading && <p className="text-center text-gray-500 mt-10 dark:text-gray-400">Loading cards...</p>}
      
      {/* Updated error handling */}
      {error && (
        <div className="text-center py-10 px-4 border border-dashed rounded-lg dark:border-gray-700">
          {error === "Please sign in to view your cards." ? (
            <>
              <p className="text-gray-500 mb-4 dark:text-gray-400">
                Please sign in to manage your cards.
              </p>
              <Link href="/api/auth/signin?callbackUrl=/cards" className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 dark:bg-blue-600 dark:hover:bg-blue-700">
                Sign In
              </Link>
            </>
          ) : (
            <p className="text-red-500 dark:text-red-400">Error: {error}</p>
          )}
        </div>
      )}

      {/* Display when no cards and not loading and no error */}
      {!isLoading && !error && cards.length === 0 && (
        <div className="text-center py-10 px-4 border border-dashed rounded-lg dark:border-gray-700">
          <p className="text-gray-500 mb-4 dark:text-gray-400">
            You haven&apos;t added any cards yet. Get started by adding your first card!
          </p>
          <Link href="/cards/new" className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 dark:bg-blue-600 dark:hover:bg-blue-700">
             Add Card
          </Link>
        </div>
      )}

      {!isLoading && !error && cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => (
            <CardItem key={card.id} card={card} setCards={setRawCards} />
          ))}
        </div>
      )}

      {/* Render AddCardModal conditionally, ensure correct import/definition */}
      {/* <AddCardModal
        isOpen={isModalOpen}
        predefinedCards={allPredefinedCards} // Pass predefined cards here
      /> */}
    </div>
  );
} 