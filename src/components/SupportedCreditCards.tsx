'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { searchCards } from '@/lib/cardSearchUtils';
import CardImageWell from '@/components/ui/CardImageWell';
import { getPublicStaticCards, type PublicStaticCard } from '@/lib/static-catalog';

export default function SupportedCreditCards() {
  const [cards] = useState(() => getPublicStaticCards());
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const fallbackResults = searchCards(cards, searchTerm);
  const filteredCards = fallbackResults.map(result => result.card);

  // Show only first 6 cards initially, or all if showAll is true
  const displayedCards = showAll ? filteredCards : filteredCards.slice(0, 6);
  const cardCountLabel = `${cards.length} popular credit card${cards.length === 1 ? '' : 's'}`;

  // Group cards by issuer for better organization
  const cardsByIssuer = displayedCards.reduce((acc, card) => {
    if (!acc[card.issuer]) {
      acc[card.issuer] = [];
    }
    acc[card.issuer].push(card);
    return acc;
  }, {} as Record<string, PublicStaticCard[]>);

  return (
    <div>
      <section className="border-b border-border bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground mb-4">
              Why Perks Reminder?
            </h2>
            <p className="text-base leading-7 text-muted-foreground max-w-2xl mx-auto">
              Never miss another credit card benefit again with automated tracking and smart notifications.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm shadow-black/[0.03]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Automated Tracking</h3>
              <p className="text-muted-foreground">
                Automatically tracks monthly, quarterly, and annual benefit cycles. Never manually calculate dates again.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm shadow-black/[0.03]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">ROI Analysis</h3>
              <p className="text-muted-foreground">
                See if your annual fees are worth it with real-time ROI calculations based on claimed benefits.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm shadow-black/[0.03]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Smart Notifications</h3>
              <p className="text-muted-foreground">
                Get email reminders for new benefit cycles and upcoming expirations. Stay on top of deadlines effortlessly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground mb-4">
              Supported Credit Cards
            </h2>
            <p className="text-base leading-7 text-muted-foreground max-w-2xl mx-auto">
              Track benefits from {cardCountLabel}. We support cards from major issuers with detailed benefit tracking and automated cycle management.
            </p>
            {cards.length > 0 && (
              <div className="mt-8 flex justify-center space-x-8 text-sm text-muted-foreground">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {new Set(cards.map(card => card.issuer)).size}
                  </div>
                  <div>Major Issuers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {cards.reduce((total, card) => total + (card.benefits?.length || 0), 0)}
                  </div>
                  <div>Tracked Benefits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    ${cards.reduce((total, card) => total + (card.benefits?.reduce((sum, benefit) => sum + (benefit.maxAmount || 0), 0) || 0), 0).toLocaleString()}
                  </div>
                  <div>Annual Value</div>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Search Bar */}
          <div className="max-w-lg mx-auto mb-8 space-y-4">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search cards, issuers, benefits... Try 'amex', 'travel', 'dining', 'uber'"
              className="w-full rounded-lg border border-input bg-card px-4 py-3 text-foreground shadow-sm shadow-black/[0.02] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            
            {/* Search results count */}
            {searchTerm && (
              <div className="text-sm text-muted-foreground text-center">
                Found {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''} matching &ldquo;{searchTerm}&rdquo;
              </div>
            )}
          </div>

          {/* Cards Grid */}
          <div className="space-y-8">
            {Object.entries(cardsByIssuer).map(([issuer, issuerCards]) => (
              <div key={issuer}>
                <h3 className="text-xl font-semibold text-foreground mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                  {issuer}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {issuerCards.map((card) => (
                    <div
                      key={card.id}
                      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent/35"
                    >
                      <CardImageWell
                        imageUrl={card.imageUrl}
                        alt={card.name}
                        issuer={card.issuer}
                        className="h-32 rounded-none border-x-0 border-t-0"
                        sizes="220px"
                        unoptimized
                      />
                      <div className="p-5">
                      <h4 className="mb-2 text-lg font-semibold leading-snug text-foreground">
                        {card.name}
                      </h4>
                      <div className="space-y-2 text-sm text-muted-foreground">
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
                          <p className="text-xs text-muted-foreground mb-2">Popular benefits include:</p>
                          <div className="space-y-1">
                            {card.benefits.slice(0, 2).map((benefit, index) => (
                              <div key={index} className="text-xs text-muted-foreground">
                                {benefit.description}
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
            <p className="text-muted-foreground mb-4">
              Ready to start tracking your credit card benefits?
            </p>
            <Link
              href="/auth/signup?callbackUrl=%2Fcards%2Fnew"
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background"
            >
              Get started
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
