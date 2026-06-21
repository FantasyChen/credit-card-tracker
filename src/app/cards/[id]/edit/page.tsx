'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCardAction } from './actions';
import { isAmexCard } from '@/lib/cardDisplayUtils';
import { formatDateInput, getCardEventLabel } from '@/lib/card-lifecycle';
import { Tooltip } from '@/components/ui/Tooltip';

type CardLifecycleStatus = 'ACTIVE' | 'CLOSED' | 'PRODUCT_CHANGED';
type CardEventType = 'ANNUAL_FEE' | 'RETENTION' | 'PRODUCT_CHANGE' | 'CLOSED' | 'SIGNUP_BONUS' | 'SPEND_DEADLINE' | 'NOTE';

interface CreditCardEvent {
  id: string;
  eventType: CardEventType | 'OPENED';
  eventDate: string | Date;
  description: string;
}

interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  lastFourDigits: string | null;
  openedDate: Date | null;
  nickname: string | null;
  lifecycleStatus: CardLifecycleStatus;
  closedDate: Date | string | null;
  annualFeeAmount: number | null;
  annualFeeDueDate: Date | string | null;
  signupBonusDeadline: Date | string | null;
  spendDeadline: Date | string | null;
  productChangedFrom: string | null;
  productChangedTo: string | null;
  lifecycleNotes: string | null;
  events: CreditCardEvent[];
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
  const [selectedStatus, setSelectedStatus] = useState<CardLifecycleStatus>('ACTIVE');
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
        setSelectedStatus(cardData.lifecycleStatus || 'ACTIVE');
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
          router.refresh();
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
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading card...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center dark:border-gray-700">
          <p className="text-red-500 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => router.push('/cards')}
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-200"
          >
            Back to Cards
          </button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">Card not found</p>
          <button
            onClick={() => router.push('/cards')}
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-200"
          >
            Back to Cards
          </button>
        </div>
      </div>
    );
  }

  const openedDate = card.openedDate ? new Date(card.openedDate) : null;
  const sortedEvents = [...(card.events || [])].sort((a, b) => {
    return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
  });

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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Card settings</p>
            <h1 className="text-2xl font-semibold text-gray-950 dark:text-white">Edit {card.nickname || card.name}</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{card.name} · {card.issuer}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/cards')}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Back to cards
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="cardId" value={cardId || ''} />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-8">
              <section className="border-b border-gray-200 pb-8 dark:border-gray-800">
                <h2 className="text-base font-semibold text-gray-950 dark:text-gray-100">Identity</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Name and distinguish this physical card.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
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
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
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
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                      onInput={(e) => {
                        const target = e.target as HTMLInputElement;
                        const cleaned = target.value.replace(/[^0-9]/g, '');
                        target.value = cleaned.slice(0, maxLength);
                      }}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
                      Anniversary Date <span className="text-xs text-gray-400 ml-1">(optional)</span>
                      <Tooltip content="The card anniversary date affects when annual benefits reset" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        name="openedMonth"
                        className="block w-full rounded-md border-gray-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        defaultValue={openedDate ? openedDate.getUTCMonth() + 1 : ''}
                      >
                        <option value="">Month...</option>
                        {months.map((month) => (
                          <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                      </select>
                      <select
                        name="openedYear"
                        className="block w-full rounded-md border-gray-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        defaultValue={openedDate ? openedDate.getUTCFullYear() : ''}
                      >
                        <option value="">Year...</option>
                        {years.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-b border-gray-200 pb-8 dark:border-gray-800">
                <h2 className="text-base font-semibold text-gray-950 dark:text-gray-100">Lifecycle</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Track dates that affect renewals, bonuses, and product changes.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Status</label>
                    <select
                      name="lifecycleStatus"
                      value={selectedStatus}
                      onChange={(event) => setSelectedStatus(event.target.value as CardLifecycleStatus)}
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="CLOSED">Closed</option>
                      <option value="PRODUCT_CHANGED">Product changed</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Closed date</label>
                    <input
                      type="date"
                      name="closedDate"
                      defaultValue={formatDateInput(card.closedDate)}
                      disabled={selectedStatus !== 'CLOSED'}
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-800"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Annual fee amount</label>
                    <input
                      type="number"
                      name="annualFeeAmount"
                      min="0"
                      step="1"
                      defaultValue={card.annualFeeAmount ?? ''}
                      placeholder="550"
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Next annual fee date</label>
                    <input
                      type="date"
                      name="annualFeeDueDate"
                      defaultValue={formatDateInput(card.annualFeeDueDate)}
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Sign-up bonus deadline</label>
                    <input
                      type="date"
                      name="signupBonusDeadline"
                      defaultValue={formatDateInput(card.signupBonusDeadline)}
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Spend deadline</label>
                    <input
                      type="date"
                      name="spendDeadline"
                      defaultValue={formatDateInput(card.spendDeadline)}
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Product changed from</label>
                    <input
                      type="text"
                      name="productChangedFrom"
                      defaultValue={card.productChangedFrom || ''}
                      disabled={selectedStatus !== 'PRODUCT_CHANGED'}
                      placeholder="Original card"
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:disabled:bg-gray-800"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Product changed to</label>
                    <input
                      type="text"
                      name="productChangedTo"
                      defaultValue={card.productChangedTo || ''}
                      disabled={selectedStatus !== 'PRODUCT_CHANGED'}
                      placeholder="New card"
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:disabled:bg-gray-800"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Lifecycle notes</label>
                    <textarea
                      name="lifecycleNotes"
                      rows={3}
                      defaultValue={card.lifecycleNotes || ''}
                      placeholder="Retention offer, downgrade plan, authorized user notes..."
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                </div>
              </section>

              <section className="border-b border-gray-200 pb-8 dark:border-gray-800">
                <h2 className="text-base font-semibold text-gray-950 dark:text-gray-100">Timeline note</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Optional. Add a dated note when something important happens.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-[180px_160px_minmax(0,1fr)]">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Type</label>
                    <select
                      name="eventType"
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      defaultValue="NOTE"
                    >
                      <option value="NOTE">Note</option>
                      <option value="RETENTION">Retention</option>
                      <option value="ANNUAL_FEE">Annual fee</option>
                      <option value="PRODUCT_CHANGE">Product change</option>
                      <option value="CLOSED">Closed</option>
                      <option value="SIGNUP_BONUS">Sign-up bonus</option>
                      <option value="SPEND_DEADLINE">Spend deadline</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Date</label>
                    <input
                      type="date"
                      name="eventDate"
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-100">Description</label>
                    <input
                      type="text"
                      name="eventDescription"
                      placeholder="Called for retention offer, fee posted, bonus met..."
                      className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => router.push('/cards')}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`inline-flex min-h-10 items-center justify-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-200 ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {isPending ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>

            <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-base font-semibold text-gray-950 dark:text-gray-100">Timeline</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A simple history for this card.</p>
              {sortedEvents.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  No lifecycle events yet.
                </p>
              ) : (
                <ol className="mt-4 space-y-4">
                  {sortedEvents.map((event) => (
                    <li key={event.id} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0 dark:border-gray-800">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                          {getCardEventLabel(event.eventType)}
                        </span>
                        <time className="text-xs text-gray-500 dark:text-gray-400">
                          {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(event.eventDate))}
                        </time>
                      </div>
                      <p className="mt-2 text-sm text-gray-800 dark:text-gray-100">{event.description}</p>
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
}
