'use client'; // Make this a Client Component

import React, { useState, useEffect, useTransition } from 'react'; // Import useTransition
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { addCardAction, bulkAddCardsAction } from './actions'; // Import the actions from the new file
import { searchCards, type CardWithBenefits } from '@/lib/cardSearchUtils';
import { isAmexCard } from '@/lib/cardDisplayUtils';
import { parseBulkCardInput } from '@/lib/bulk-card-parser';
import { Tooltip } from '@/components/ui/Tooltip';
import CardImageWell from '@/components/ui/CardImageWell';
import PageHeader from '@/components/ui/PageHeader';

// Helper arrays
const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i); // Last 10 years

interface BulkReviewRow {
  rowId: string;
  input: string;
  cardId: string;
  owner: string;
  nickname: string;
  lastFourDigits: string;
  candidates: CardWithBenefits[];
  error?: string;
}

// --- Sub-component for the card form with its own transition state ---
function PredefinedCardForm({ card, matchedFields }: { card: CardWithBenefits; matchedFields?: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [showBenefits, setShowBenefits] = useState(false);

  // Check if this is an AMEX card for dynamic form constraints
  const isAmex = isAmexCard(card.issuer);
  const maxLength = isAmex ? 5 : 4;
  const pattern = isAmex ? "[0-9]{4,5}" : "[0-9]{4}";
  const placeholder = isAmex ? "12345" : "1234";
  const label = isAmex ? "Last 5 Digits" : "Last 4 Digits";
  const helperText = isAmex
    ? "Enter the last 5 digits from your AMEX card (4 digits also accepted)"
    : "Helps identify your specific card if you have multiple of the same type";

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
      <div className="flex h-full flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600">
        <div>
          {/* Card Image - Slightly Smaller */}
          <CardImageWell
            imageUrl={card.imageUrl}
            alt={card.name}
            issuer={card.issuer}
            className="h-36 rounded-none border-x-0 border-t-0"
            imageClassName="p-2"
            sizes="220px"
            unoptimized
          />

          {/* Card Name and Match Badges */}
          <div className="space-y-3 p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className={`text-lg font-semibold leading-snug text-gray-950 dark:text-gray-100 ${matchedFields?.includes('name') ? 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded' : ''}`}>
                {card.name}
              </h2>
              {matchedFields && matchedFields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {matchedFields.map(field => (
                    <span key={field} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                      {field}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Issuer and Annual Fee - More Compact */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
              <p className={`text-xs text-gray-500 dark:text-gray-400 ${matchedFields?.includes('issuer') ? 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded' : ''}`}>
                {card.issuer}
              </p>
              <p className={`rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300 ${matchedFields?.includes('annual fee') ? 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded' : ''}`}>
                ${card.annualFee}/year
              </p>
            </div>
          </div>

          {/* Collapsible Benefits Section */}
          {card.benefits && card.benefits.length > 0 && (
            <div className="px-4 pb-3">
              <button
                type="button"
                onClick={() => setShowBenefits(!showBenefits)}
                className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800">
                    {card.benefits.length} {card.benefits.length === 1 ? 'benefit' : 'benefits'}
                  </span>
                </span>
                {showBenefits ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </button>

              {showBenefits && (
                <div className="mt-2 space-y-1 border-l-2 border-emerald-200 pl-2 dark:border-emerald-800">
                  {card.benefits.map((benefit, index) => (
                    <div key={index} className={`text-xs text-gray-600 dark:text-gray-400 ${matchedFields?.includes('benefit') || matchedFields?.includes('category') ? 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded' : ''}`}>
                      - {benefit.description} {benefit.maxAmount && `($${benefit.maxAmount})`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nickname Field with Tooltip */}
          <div className="px-4 pb-3">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
              Nickname <span className="text-xs text-gray-400 ml-1">(optional)</span>
              <Tooltip content="Helpful for identifying cards when you have multiple of the same type" />
            </label>
            <input
              type="text"
              id={`nickname-${card.id}`}
              name="nickname"
              maxLength={50}
              placeholder="My Travel Card, Work Card..."
              className="block w-full px-3 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500 dark:placeholder-gray-400"
            />
          </div>

          {/* Last Digits Field with Tooltip */}
          <div className="px-4 pb-3">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
              {label} <span className="text-xs text-gray-400 ml-1">(optional)</span>
              <Tooltip content={helperText} />
            </label>
            <input
              type="text"
              id={`lastFourDigits-${card.id}`}
              name="lastFourDigits"
              maxLength={maxLength}
              pattern={pattern}
              placeholder={placeholder}
              className="block w-full px-3 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500 dark:placeholder-gray-400"
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                const cleaned = target.value.replace(/[^0-9]/g, '');
                target.value = cleaned.slice(0, maxLength);
              }}
            />
          </div>

          {/* Opened Date with Tooltip */}
          <div className="px-4 pb-4">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-100 mb-1">
              Opened Date <span className="text-xs text-gray-400 ml-1">(optional)</span>
              <Tooltip
                content={
                  <>
                    Helps track annual fees/benefits. Check your credit report (
                    <a href="https://www.creditkarma.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Credit Karma</a>
                    {', '}
                    <a href="https://www.experian.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Experian</a>
                    , etc.) if unsure.
                  </>
                }
              />
            </label>
            <div className="flex gap-2">
              <select
                id={`openedMonth-${card.id}`}
                name="openedMonth"
                className="block w-1/2 px-2 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                defaultValue=""
              >
                <option value="" disabled>Month...</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
              <select
                id={`openedYear-${card.id}`}
                name="openedYear"
                className="block w-1/2 px-2 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                defaultValue=""
              >
                <option value="" disabled>Year...</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className={`mt-auto w-full border-t border-indigo-500 bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 dark:border-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-700 ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
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
  const [predefinedCards, setPredefinedCards] = useState<CardWithBenefits[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Loading state for fetching predefined cards
  const [groupByIssuer, setGroupByIssuer] = useState(true); // Toggle for grouping by issuer
  const [bulkInput, setBulkInput] = useState('plat x2, gold, csr, aspire x3');
  const [bulkRows, setBulkRows] = useState<BulkReviewRow[]>([]);


  // Fetch data using useEffect
  useEffect(() => {
    async function fetchCards() {
      try {
        const response = await fetch('/api/predefined-cards-with-benefits?source=db');
        if (!response.ok) {
          throw new Error('Failed to fetch cards');
        }
        const data: CardWithBenefits[] = await response.json();
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

  // Enhanced search logic
  const searchResults = searchCards(predefinedCards, searchTerm);
  const filteredCards = searchResults.map(result => result.card);
  const cardById = React.useMemo(
    () => new Map(predefinedCards.map((card) => [card.id, card])),
    [predefinedCards]
  );
  const bulkPayload = React.useMemo(() => {
    return JSON.stringify(
      bulkRows
        .filter((row) => row.cardId)
        .map((row) => ({
          predefinedCardId: row.cardId,
          owner: row.owner,
          nickname: row.nickname,
          lastFourDigits: row.lastFourDigits,
        }))
    );
  }, [bulkRows]);

  const parseBulkInput = () => {
    const parsed = parseBulkCardInput(bulkInput, predefinedCards);
    setBulkRows(parsed.map((item, index) => ({
      rowId: `${index}-${item.input}-${item.copyIndex}`,
      input: item.input,
      cardId: item.matchedCard?.id ?? '',
      owner: '',
      nickname: item.totalCopies > 1 ? `${item.input} ${item.copyIndex}` : '',
      lastFourDigits: '',
      candidates: item.candidates as CardWithBenefits[],
      error: item.error,
    })));
  };

  const updateBulkRow = (rowId: string, updates: Partial<BulkReviewRow>) => {
    setBulkRows((rows) => rows.map((row) => row.rowId === rowId ? { ...row, ...updates } : row));
  };

  // Group cards by issuer if groupByIssuer is true
  const groupedCards = React.useMemo(() => {
    if (!groupByIssuer) return { 'All Cards': filteredCards };

    const grouped = filteredCards.reduce((acc, card) => {
      const issuer = card.issuer;
      if (!acc[issuer]) {
        acc[issuer] = [];
      }
      acc[issuer].push(card);
      return acc;
    }, {} as Record<string, CardWithBenefits[]>);

    // Sort issuers alphabetically
    const sortedGrouped = Object.keys(grouped)
      .sort()
      .reduce((acc, issuer) => {
        acc[issuer] = grouped[issuer];
        return acc;
      }, {} as Record<string, CardWithBenefits[]>);

    return sortedGrouped;
  }, [filteredCards, groupByIssuer]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Select a Card to Add"
        description="Search the predefined catalog, add optional identifiers, and Perks Reminder will create the trackable benefits."
      />

      <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/20">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-950 dark:text-white">Bulk add cards</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
              Paste shorthand like <span className="font-mono">plat x2, gold, csr, aspire x3</span>, review the matches, then add owner labels, nicknames, and last digits before confirming.
            </p>
          </div>
          <button
            type="button"
            onClick={parseBulkInput}
            disabled={isLoading || bulkInput.trim().length === 0}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Parse wallet
          </button>
        </div>
        <textarea
          value={bulkInput}
          onChange={(event) => setBulkInput(event.target.value)}
          rows={3}
          className="mt-4 w-full rounded-lg border border-indigo-200 bg-white p-3 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-indigo-800 dark:bg-gray-900 dark:text-white"
          placeholder="plat x2, gold, csr, aspire x3"
        />

        {bulkRows.length > 0 && (
          <form action={bulkAddCardsAction} className="mt-4 space-y-3" autoComplete="off">
            <input type="hidden" name="bulkCards" value={bulkPayload} />
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="grid grid-cols-12 gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-normal text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                <div className="col-span-12 sm:col-span-4">Matched card</div>
                <div className="col-span-4 sm:col-span-2">Owner</div>
                <div className="col-span-4 sm:col-span-3">Nickname</div>
                <div className="col-span-4 sm:col-span-2">Last digits</div>
                <div className="hidden sm:block sm:col-span-1">Status</div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {bulkRows.map((row) => {
                  const selectedCard = cardById.get(row.cardId);
                  const candidateOptions = row.candidates.length > 0 ? row.candidates : predefinedCards;
                  const maxLength = selectedCard && isAmexCard(selectedCard.issuer) ? 5 : 4;
                  const pattern = selectedCard && isAmexCard(selectedCard.issuer) ? '[0-9]{4,5}' : '[0-9]{4}';

                  return (
                    <div key={row.rowId} className="grid grid-cols-12 gap-2 px-3 py-3">
                      <div className="col-span-12 sm:col-span-4">
                        <label className="sr-only" htmlFor={`bulk-card-${row.rowId}`}>Matched card for {row.input}</label>
                        <select
                          id={`bulk-card-${row.rowId}`}
                          value={row.cardId}
                          onChange={(event) => updateBulkRow(row.rowId, { cardId: event.target.value, error: undefined })}
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          required
                        >
                          <option value="">Choose match for &ldquo;{row.input}&rdquo;</option>
                          {candidateOptions.map((card) => (
                            <option key={card.id} value={card.id}>{card.name}</option>
                          ))}
                        </select>
                        {selectedCard && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedCard.issuer}</p>
                        )}
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="sr-only" htmlFor={`bulk-owner-${row.rowId}`}>Owner</label>
                        <input
                          id={`bulk-owner-${row.rowId}`}
                          value={row.owner}
                          onChange={(event) => updateBulkRow(row.rowId, { owner: event.target.value })}
                          maxLength={50}
                          placeholder="P1"
                          autoComplete="off"
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-3">
                        <label className="sr-only" htmlFor={`bulk-nickname-${row.rowId}`}>Nickname</label>
                        <input
                          id={`bulk-nickname-${row.rowId}`}
                          value={row.nickname}
                          onChange={(event) => updateBulkRow(row.rowId, { nickname: event.target.value })}
                          maxLength={50}
                          placeholder="Travel, sock drawer..."
                          autoComplete="off"
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="sr-only" htmlFor={`bulk-digits-${row.rowId}`}>Last digits</label>
                        <input
                          id={`bulk-digits-${row.rowId}`}
                          value={row.lastFourDigits}
                          onChange={(event) => updateBulkRow(row.rowId, {
                            lastFourDigits: event.target.value.replace(/[^0-9]/g, '').slice(0, maxLength),
                          })}
                          maxLength={maxLength}
                          pattern={pattern}
                          placeholder={maxLength === 5 ? '12345' : '1234'}
                          autoComplete="off"
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-1 sm:flex sm:items-center">
                        {row.error ? (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Review</span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Ready</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {bulkRows.filter((row) => row.cardId).length} card{bulkRows.filter((row) => row.cardId).length === 1 ? '' : 's'} ready. Owner is saved into the card label so duplicate cards stay identifiable.
              </p>
              <button
                type="submit"
                disabled={bulkRows.length === 0 || bulkRows.some((row) => !row.cardId)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add reviewed cards
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Search and Toggle Controls */}
      <div className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by card name, issuer, benefits, or try 'amex', 'travel', 'dining', 'uber'..."
            className="w-full rounded-lg border border-gray-300 p-3 pr-10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

                 {/* Show search results count */}
         {searchTerm && (
           <div className="text-sm text-gray-600 dark:text-gray-400">
             Found {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''} matching &ldquo;{searchTerm}&rdquo;
           </div>
         )}

         {/* Quick search examples */}
         {!searchTerm && (
           <div className="flex flex-wrap gap-2 text-sm">
             <span className="text-gray-500 dark:text-gray-400">Try searching:</span>
             {['amex', 'travel', 'dining', 'uber', 'business'].map(example => (
               <button
                 key={example}
                 onClick={() => setSearchTerm(example)}
                 className="rounded-md bg-gray-100 px-2 py-1 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
               >
                 {example}
               </button>
             ))}
           </div>
         )}

        {/* Toggle for grouping by issuer */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="groupByIssuer"
            checked={groupByIssuer}
            onChange={(e) => setGroupByIssuer(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-indigo-600 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-indigo-600"
          />
          <label htmlFor="groupByIssuer" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Group by Issuing Bank
          </label>
        </div>
      </div>

      {isLoading ? (
         <p className="dark:text-gray-400">Loading cards...</p> // Basic loading indicator
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedCards).map(([issuer, cards]) => (
            <div key={issuer} className="space-y-4">
              {/* Issuer Header - only show if grouping and not 'All Cards' */}
              {groupByIssuer && issuer !== 'All Cards' && (
                <div className="border-b border-gray-200 pb-2 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium mr-3">
                      {cards.length} card{cards.length !== 1 ? 's' : ''}
                    </span>
                    {issuer}
                  </h2>
                </div>
              )}

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cards.map((card) => {
                  const matchedFields = searchResults.find(result => result.card.id === card.id)?.matchedFields || [];
                  return (
                    <div key={card.id}>
                      <PredefinedCardForm card={card} matchedFields={matchedFields} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* No results message */}
          {Object.keys(groupedCards).length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No cards found matching your search criteria.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
