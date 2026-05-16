'use client'; // Make this a Client Component because we need interactivity

import React, { useState, useEffect, useTransition, useMemo } from 'react'; // Add useMemo
import Link from 'next/link';
import { deleteCardAction } from './actions'; // Import the delete action
import type { CreditCard, Benefit } from '@/generated/prisma'; // Removed unused PredefinedCard
import { generateCardDisplayNames } from '@/lib/cardDisplayUtils';
import { CardsPageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import CardImageWell from '@/components/ui/CardImageWell';
import PageHeader from '@/components/ui/PageHeader';

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
  const totalPotentialValue = card.benefits.reduce((total, benefit) => total + (benefit.maxAmount ?? 0), 0);

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
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600">
       <div> {/* Content wrapper */}
        {/* Card Image */}
        <CardImageWell
          imageUrl={card.imageUrl}
          alt={card.displayName || card.name}
          issuer={card.issuer}
          className="h-40 rounded-none border-x-0 border-t-0"
          imageClassName="p-2"
          sizes="220px"
          unoptimized
        />
        
        <div className="flex-grow p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              {card.issuer}
            </span>
            {totalPotentialValue > 0 && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800">
                ${totalPotentialValue.toFixed(0)} tracked value
              </span>
            )}
          </div>
          <h2 className="mb-3 text-lg font-semibold leading-snug text-gray-950 dark:text-gray-100">{card.displayName || card.name}</h2> {/* Use displayName */}
          <div className="space-y-1.5 mb-3">
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
            <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                Key benefits ({card.benefits.length})
              </h3>
              <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {card.benefits.slice(0, 3).map(benefit => (
                  <li key={benefit.id} className="leading-relaxed">- {benefit.description}</li>
                ))}
                {card.benefits.length > 3 && (
                  <li className="text-blue-600 dark:text-blue-400 font-medium">
                    +{card.benefits.length - 3} more benefit{card.benefits.length - 3 > 1 ? 's' : ''}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
       </div>

       {/* Action Buttons */}
       <div className="flex items-center justify-between gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
          <Link
            href={`/cards/${card.id}/edit`}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Edit
          </Link>
          <form onSubmit={handleDelete} className="flex-1">
            <input type="hidden" name="cardId" value={card.id} />
            <button
               type="submit"
               disabled={isPending} // Disable button while deleting
               className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isPending ? 'bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400' : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-800/30'}`}
             >
               {isPending ? 'Removing...' : 'Remove'}
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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="My Cards" description="Manage the cards whose benefits you track.">
        {!isLoading && !error && (
          <Link href="/cards/new" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
            Add New Card
          </Link>
        )}
      </PageHeader>

      {isLoading && <CardsPageSkeleton />}
      
      {/* Updated error handling */}
      {error && (
        <div className="overflow-hidden rounded-xl border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-green-50 px-6 py-10 text-center dark:border-indigo-800 dark:from-indigo-950/30 dark:via-gray-900 dark:to-green-950/20">
          {error === "Please sign in to view your cards." ? (
            <div className="mx-auto max-w-2xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <span aria-hidden="true" className="text-xl">💳</span>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Track your card perks in one place
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-300">
                Add your cards once, then let Perks Reminder calculate every cycle, from monthly credits to annual anniversary perks.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/auth/signin?callbackUrl=/cards" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors">
                  Sign in to view cards
                </Link>
                <Link href="/auth/signup?callbackUrl=/cards" className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
                  Create free account
                </Link>
              </div>
              <div className="mt-6 grid gap-3 text-left text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-3">
                <div className="rounded-lg bg-white/70 p-3 ring-1 ring-gray-200 dark:bg-gray-800/60 dark:ring-gray-700">Automatic cycle dates</div>
                <div className="rounded-lg bg-white/70 p-3 ring-1 ring-gray-200 dark:bg-gray-800/60 dark:ring-gray-700">Annual fee ROI</div>
                <div className="rounded-lg bg-white/70 p-3 ring-1 ring-gray-200 dark:bg-gray-800/60 dark:ring-gray-700">Expiration reminders</div>
              </div>
            </div>
          ) : (
            <p className="text-red-500 dark:text-red-400">Error: {error}</p>
          )}
        </div>
      )}

      {/* Display when no cards and not loading and no error */}
      {!isLoading && !error && cards.length === 0 && (
        <EmptyState
          icon="credit-card"
          title="No cards yet"
          description="You haven't added any cards yet. Get started by adding your first card to track benefits!"
          actionLabel="Add Your First Card"
          actionHref="/cards/new"
        />
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
