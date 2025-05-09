'use client'; // Make this a Client Component because we need interactivity

import React, { useState, useEffect, useTransition, useMemo } from 'react'; // Add useMemo
import Link from 'next/link';
import { deleteCardAction } from './actions'; // Import the delete action
import type { CreditCard, Benefit } from '@/generated/prisma'; // Removed unused PredefinedCard

// Type for cards fetched from the API, assuming benefits are included
interface FetchedUserCard extends CreditCard {
  benefits: Benefit[];
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
  return dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
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
    <div className="border rounded-lg p-4 shadow-md bg-white flex flex-col justify-between h-full">
       <div> {/* Content wrapper */}
        <h2 className="text-xl font-semibold mb-2">{card.displayName || card.name}</h2> {/* Use displayName */}
        <p className="text-gray-600 mb-1">Issuer: {card.issuer}</p>
        {card.openedDate && (
           <p className="text-sm text-gray-500 mb-3">Opened: {formatOpenedDate(card.openedDate)}</p>
        )}

        {card.benefits.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <h3 className="text-md font-medium mb-2">Key Benefits:</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {card.benefits.slice(0, 3).map(benefit => (
                <li key={benefit.id}>{benefit.description}</li>
              ))}
              {card.benefits.length > 3 && <li>...and more</li>}
            </ul>
          </div>
        )}
       </div>

       {/* Delete Form and Button */}
       <form onSubmit={handleDelete} className="mt-4 text-right">
          <input type="hidden" name="cardId" value={card.id} />
          <button
             type="submit"
             disabled={isPending} // Disable button while deleting
             className={`text-xs px-3 py-1 rounded transition duration-200 ${isPending ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
           >
             {isPending ? 'Removing...' : 'Remove'}
           </button>
        </form>
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
    const cardCounts: { [key: string]: number } = {};
    const cardIndices: { [key: string]: number } = {};

    // First pass: count occurrences of each card name (name + issuer might be better for uniqueness)
    rawCards.forEach(card => {
      const cardKey = `${card.name}-${card.issuer}`;
      cardCounts[cardKey] = (cardCounts[cardKey] || 0) + 1;
    });

    // Second pass: assign displayName if duplicates exist
    return rawCards.map(card => {
      const cardKey = `${card.name}-${card.issuer}`;
      if (cardCounts[cardKey] > 1) {
        cardIndices[cardKey] = (cardIndices[cardKey] || 0) + 1;
        return { ...card, displayName: `${card.name} #${cardIndices[cardKey]}` };
      }
      return { ...card }; // card is FetchedUserCard
    });
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
        <h1 className="text-3xl font-bold">My Cards</h1>
        <Link href="/cards/new" className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 transition duration-200">
          Add New Card
        </Link>
      </div>

      {isLoading && <p className="text-center text-gray-500 mt-10">Loading cards...</p>}
      
      {error && <p className="text-center text-red-500 mt-10">Error: {error}</p>}

      {!isLoading && !error && cards.length === 0 && (
        <div className="text-center py-10 px-4 border border-dashed rounded-lg">
          <p className="text-gray-500 mb-4">
            You haven&apos;t added any cards yet. Get started by adding your first card!
          </p>
          <Link href="/cards?addCard=true" className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200">
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