'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { deleteCardAction } from './actions';
import type { CreditCard, Benefit } from '@/generated/prisma';
import { generateCardDisplayNames } from '@/lib/cardDisplayUtils';
import { CardsPageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import CardImageWell from '@/components/ui/CardImageWell';
import PageHeader from '@/components/ui/PageHeader';
import { formatDateInput } from '@/lib/card-lifecycle';
import { CalendarDaysIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

interface FetchedUserCard extends CreditCard {
  benefits: Benefit[];
  imageUrl?: string | null;
}

interface DisplayUserCard extends FetchedUserCard {
  displayName?: string;
}

const formatOpenedDate = (date: Date | null): string => {
  if (!date) return 'N/A';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'N/A';

  const utcMonth = dateObj.getUTCMonth();
  const utcYear = dateObj.getUTCFullYear();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return `${monthNames[utcMonth]} ${utcYear}`;
};

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
    <article className="group grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent/35 sm:grid-cols-[176px_minmax(0,1fr)_150px] sm:items-center">
      <div className="overflow-hidden rounded-xl border border-border bg-muted/50">
        <CardImageWell
          imageUrl={card.imageUrl}
          alt={card.displayName || card.name}
          issuer={card.issuer}
          className="h-28 rounded-xl border-0 !p-2"
          sizes="180px"
          unoptimized
        />
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
          <span>{card.issuer}</span>
          {card.lastFourDigits && <span>Ending {card.lastFourDigits}</span>}
          {card.lifecycleStatus && card.lifecycleStatus !== 'ACTIVE' && (
            <span>{card.lifecycleStatus === 'CLOSED' ? 'Closed' : 'Product changed'}</span>
          )}
        </div>
        <h2 className="truncate text-base font-semibold text-foreground">{card.displayName || card.name}</h2>
        <dl className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Opened</dt>
            <dd className="mt-1 font-semibold text-foreground">{formatOpenedDate(card.openedDate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Annual fee</dt>
            <dd className="mt-1 font-semibold text-foreground">{annualFeeText || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Tracked value</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{totalPotentialValue > 0 ? `$${totalPotentialValue.toFixed(0)}` : 'No credits'}</dd>
          </div>
        </dl>
        {card.benefits.length > 0 && (
          <p className="mt-3 truncate text-sm text-muted-foreground">
            {card.benefits[0].description}
            {card.benefits.length > 1 ? `, plus ${card.benefits.length - 1} more` : ''}
          </p>
        )}
      </div>

      <div className="flex gap-2 sm:flex-col">
        <Link
          href={`/cards/${card.id}/edit`}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90"
        >
          <PencilSquareIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          Edit
        </Link>
        <form onSubmit={handleDelete} className="flex-1">
          <input type="hidden" name="cardId" value={card.id} />
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm shadow-black/[0.03] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-200"
          >
            <TrashIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            {isPending ? 'Removing' : 'Remove'}
          </button>
        </form>
      </div>
    </article>
  );
}

export default function UserCardsPage() {
  const [rawCards, setRawCards] = useState<FetchedUserCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserCards() {
      try {
        const response = await fetch('/api/user-cards');
        if (!response.ok) {
          if (response.status === 401) {
            setError('Please sign in to view your cards.');
            setRawCards([]);
            return;
          }
          throw new Error('Failed to fetch cards');
        }
        const data: FetchedUserCard[] = await response.json();
        setRawCards(data);
      } catch (err: unknown) {
        console.error('Error fetching user cards:', err);
        setError(err instanceof Error ? err.message : 'Could not load cards.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchUserCards();
  }, []);

  const cards = useMemo(() => {
    return generateCardDisplayNames(rawCards);
  }, [rawCards]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="My Cards" description="Manage the cards whose benefits you track.">
        {!isLoading && !error && (
          <div className="flex flex-wrap gap-2">
            <Link href="/cards/calendar" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent">
              <CalendarDaysIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              Calendar
            </Link>
            <Link href="/cards/new" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90">
              Add card
            </Link>
          </div>
        )}
      </PageHeader>

      {isLoading && <CardsPageSkeleton />}

      {error && (
        error === 'Please sign in to view your cards.' ? (
          <EmptyState
            icon="credit-card"
            title="Track your card perks in one place"
            description="Add your cards once, then let Perks Reminder calculate every cycle, from monthly credits to annual anniversary perks."
            actionLabel="Sign in to view cards"
            actionHref="/auth/signin?callbackUrl=/cards"
            secondaryActionLabel="Create free account"
            secondaryActionHref="/auth/signup?callbackUrl=/cards"
          />
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm shadow-black/[0.03] dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">
            Error: {error}
          </div>
        )
      )}

      {!isLoading && !error && cards.length === 0 && (
        <EmptyState
          icon="credit-card"
          title="No cards yet"
          description="Add your first card to start tracking credits, fee dates, and expiring benefits."
          actionLabel="Add first card"
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
    </div>
  );
}
