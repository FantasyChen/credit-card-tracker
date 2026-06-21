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
import { formatDateInput } from '@/lib/card-lifecycle';

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
  const annualFeeText = card.annualFeeDueDate
    ? `${formatDateInput(card.annualFeeDueDate)}${typeof card.annualFeeAmount === 'number' ? `, $${card.annualFeeAmount.toFixed(0)}` : ''}`
    : null;

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
    <article className="group grid gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 sm:grid-cols-[180px_minmax(0,1fr)_160px] sm:items-center">
      <div className="overflow-hidden rounded-md bg-gray-50 dark:bg-gray-950">
        <CardImageWell
          imageUrl={card.imageUrl}
          alt={card.displayName || card.name}
          issuer={card.issuer}
          className="h-28 rounded-md border-0"
          imageClassName="p-2"
          sizes="180px"
          unoptimized
        />
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          <span>{card.issuer}</span>
          {card.lastFourDigits && <span>•••• {card.lastFourDigits}</span>}
          {card.lifecycleStatus && card.lifecycleStatus !== 'ACTIVE' && (
            <span>{card.lifecycleStatus === 'CLOSED' ? 'Closed' : 'Product changed'}</span>
          )}
        </div>
        <h2 className="truncate text-base font-semibold text-gray-950 dark:text-gray-100">{card.displayName || card.name}</h2>
        <dl className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Opened</dt>
            <dd className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">{formatOpenedDate(card.openedDate)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Annual fee</dt>
            <dd className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">{annualFeeText || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Tracked value</dt>
            <dd className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">{totalPotentialValue > 0 ? `$${totalPotentialValue.toFixed(0)}` : 'No credits'}</dd>
          </div>
        </dl>
        {card.benefits.length > 0 && (
          <p className="mt-3 truncate text-sm text-gray-500 dark:text-gray-400">
            {card.benefits[0].description}
            {card.benefits.length > 1 ? `, plus ${card.benefits.length - 1} more` : ''}
          </p>
        )}
      </div>

      <div className="flex gap-2 sm:flex-col">
        <Link
          href={`/cards/${card.id}/edit`}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-200"
        >
          Edit
        </Link>
        <form onSubmit={handleDelete} className="flex-1">
          <input type="hidden" name="cardId" value={card.id} />
          <button
            type="submit"
            disabled={isPending}
            className={`inline-flex min-h-10 w-full items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${isPending ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500' : 'border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300'}`}
          >
            {isPending ? 'Removing...' : 'Remove'}
          </button>
        </form>
      </div>
    </article>
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
          <div className="flex flex-wrap gap-2">
            <Link href="/cards/calendar" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
              Calendar
            </Link>
            <Link href="/cards/new" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
              Add New Card
            </Link>
          </div>
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
        <div className="space-y-3">
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
