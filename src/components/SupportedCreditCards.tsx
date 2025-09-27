'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { PredefinedCard, PredefinedBenefit } from '@/generated/prisma';
import { searchCards } from '@/lib/cardSearchUtils';
import SearchInput from './SearchInput';

// Interface for card with benefits
interface CardWithBenefits extends PredefinedCard {
  benefits: PredefinedBenefit[];
}

export default function SupportedCreditCards() {
  const [cards, setCards] = useState<CardWithBenefits[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchCards() {
      try {
        const response = await fetch('/api/predefined-cards-with-benefits');
        if (!response.ok) {
          // Fallback to basic predefined cards API if the detailed one doesn't exist yet
          const basicResponse = await fetch('/api/predefined-cards');
          if (!basicResponse.ok) {
            throw new Error('Failed to fetch cards');
          }
          const basicData: PredefinedCard[] = await basicResponse.json();
          setCards(basicData.map(card => ({ ...card, benefits: [] })));
        } else {
          const data: CardWithBenefits[] = await response.json();
          setCards(data);
        }
      } catch (error) {
        console.error("Error fetching cards:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCards();
  }, []);

  // Enhanced search functionality with server-side optimization
  const [searchResults, setSearchResults] = useState<Array<{card: CardWithBenefits, score: number, matchedFields: string[]}>>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Use client-side search as fallback
  const fallbackResults = searchCards(cards, searchTerm);
  const filteredCards = searchResults.length > 0 ? searchResults.map(result => result.card) : fallbackResults.map(result => result.card);

  // Show only first 6 cards initially, or all if showAll is true
  const displayedCards = showAll ? filteredCards : filteredCards.slice(0, 6);

  // Group cards by issuer for better organization
  const cardsByIssuer = displayedCards.reduce((acc, card) => {
    if (!acc[card.issuer]) {
      acc[card.issuer] = [];
    }
    acc[card.issuer].push(card);
    return acc;
  }, {} as Record<string, CardWithBenefits[]>);

  if (isLoading) {
    return (
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-64 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-96 mx-auto"></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div>
      {/* Features Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Why CouponCycle?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Never miss another credit card benefit again with automated tracking and smart notifications.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Automated Tracking</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Automatically tracks monthly, quarterly, and annual benefit cycles. Never manually calculate dates again.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">ROI Analysis</h3>
              <p className="text-gray-600 dark:text-gray-300">
                See if your annual fees are worth it with real-time ROI calculations based on claimed benefits.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Smart Notifications</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Get email reminders for new benefit cycles and upcoming expirations. Stay on top of deadlines effortlessly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Cards Section */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Supported Credit Cards
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Track benefits from {cards.length}+ popular credit cards. We support cards from major issuers with detailed benefit tracking and automated cycle management.
            </p>
            {cards.length > 0 && (
              <div className="mt-8 flex justify-center space-x-8 text-sm text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {new Set(cards.map(card => card.issuer)).size}
                  </div>
                  <div>Major Issuers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {cards.reduce((total, card) => total + (card.benefits?.length || 0), 0)}
                  </div>
                  <div>Tracked Benefits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    ${cards.reduce((total, card) => total + (card.benefits?.reduce((sum, benefit) => sum + (benefit.maxAmount || 0), 0) || 0), 0).toLocaleString()}
                  </div>
                  <div>Annual Value</div>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Search Bar */}
          <div className="max-w-lg mx-auto mb-8 space-y-4">
            <SearchInput
              onSearch={(query, results) => {
                setSearchTerm(query);
                setSearchResults(results);
                setIsSearching(false);
              }}
              placeholder="Search cards, issuers, benefits... Try 'amex', 'travel', 'dining', 'uber'"
              showSuggestions={true}
              debounceMs={300}
            />
            
            {/* Search results count */}
            {searchTerm && (
              <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {isSearching ? (
                  <span className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin mr-2" />
                    Searching...
                  </span>
                ) : (
                  <>
                    Found {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''} matching &ldquo;{searchTerm}&rdquo;
                    {searchResults.length > 0 && (
                      <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                        Optimized
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Cards Grid */}
          <div className="space-y-8">
            {Object.entries(cardsByIssuer).map(([issuer, issuerCards]) => (
              <div key={issuer}>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                  {issuer}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {issuerCards.map((card) => (
                    <div
                      key={card.id}
                      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200"
                    >
                      {card.imageUrl && (
                        <div className="relative h-32 w-full mb-4 rounded-lg overflow-hidden bg-white">
                          <Image
                            src={card.imageUrl}
                            alt={card.name}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      )}
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {card.name}
                      </h4>
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <p>
                          <span className="font-medium">Annual Fee:</span> ${card.annualFee}
                        </p>
                        {card.benefits && card.benefits.length > 0 && (
                          <p>
                            <span className="font-medium">Benefits:</span> {card.benefits.length} tracked benefits
                          </p>
                        )}
                      </div>
                      {card.benefits && card.benefits.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Popular benefits include:</p>
                          <div className="space-y-1">
                            {card.benefits.slice(0, 2).map((benefit, index) => (
                              <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                                • {benefit.description}
                              </div>
                            ))}
                            {card.benefits.length > 2 && (
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                ...and {card.benefits.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Show More/Less Button */}
          {filteredCards.length > 6 && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAll(!showAll)}
                className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {showAll ? (
                  <>
                    Show Less
                    <ChevronUpIcon className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show All {filteredCards.length} Cards
                    <ChevronDownIcon className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* CTA */}
          <div className="text-center mt-12">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Ready to start tracking your credit card benefits?
            </p>
            <Link
              href="/api/auth/signin"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-900 transition-colors duration-200"
            >
              Get Started Free
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
} 