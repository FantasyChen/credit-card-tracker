/**
 * Optimized search functionality with database-level filtering and caching
 * This module provides server-side search capabilities with better performance
 */

import { prisma } from '@/lib/prisma';
import type { PredefinedCard, PredefinedBenefit } from '@/generated/prisma';

export type CardWithBenefits = PredefinedCard & {
  benefits: PredefinedBenefit[];
};

export interface SearchResult {
  card: CardWithBenefits;
  score: number;
  matchedFields: string[];
}

export interface SearchOptions {
  limit?: number;
  includeBenefits?: boolean;
  sortBy?: 'relevance' | 'name' | 'issuer' | 'annualFee';
  minScore?: number;
}

/**
 * Server-side optimized search with database filtering
 * Reduces client-side processing by filtering at database level
 */
export async function searchCardsOptimized(
  searchTerm: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = 50,
    includeBenefits = true,
    sortBy = 'relevance',
    minScore = 10
  } = options;

  if (!searchTerm.trim()) {
    // Return all cards with no search term
    const cards = await prisma.predefinedCard.findMany({
      include: includeBenefits ? {
        benefits: {
          orderBy: { maxAmount: 'desc' },
        },
      } : undefined,
      orderBy: [
        { issuer: 'asc' },
        { name: 'asc' }
      ],
      take: limit,
    });

    return cards.map(card => ({
      card: card as CardWithBenefits,
      score: 0,
      matchedFields: []
    }));
  }

  const normalizedSearch = normalizeString(searchTerm);
  
  // Build database query with text search
  const cards = await prisma.predefinedCard.findMany({
    where: {
      OR: [
        // Name search
        {
          name: {
            contains: searchTerm,
            mode: 'insensitive' as const,
          },
        },
        // Issuer search
        {
          issuer: {
            contains: searchTerm,
            mode: 'insensitive' as const,
          },
        },
        // Annual fee search (numeric)
        ...(isNumericSearch(normalizedSearch) ? [{
          annualFee: {
            equals: parseInt(normalizedSearch.replace(/\D/g, ''), 10) || undefined,
          },
        }] : []),
        // No annual fee search
        ...(normalizedSearch.includes('no annual fee') || normalizedSearch.includes('no fee') ? [{
          annualFee: 0,
        }] : []),
        // Benefit category search (if including benefits)
        ...(includeBenefits ? [{
          benefits: {
            some: {
              OR: [
                {
                  category: {
                    contains: searchTerm,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  description: {
                    contains: searchTerm,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            },
          },
        }] : []),
      ],
    },
    include: includeBenefits ? {
      benefits: {
        orderBy: { maxAmount: 'desc' },
      },
    } : undefined,
    orderBy: getSortOrder(sortBy),
    take: limit * 2, // Get more results to allow for client-side scoring
  });

  // Apply client-side scoring and filtering
  const results = await scoreAndFilterResults(cards as CardWithBenefits[], searchTerm, minScore);
  
  return results.slice(0, limit);
}

/**
 * Hybrid search: combines database filtering with client-side scoring
 * Best of both worlds - database performance + advanced scoring
 */
export async function hybridSearch(
  searchTerm: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = 50, minScore = 10 } = options;

  // First, get a broader set from database
  const dbResults = await searchCardsOptimized(searchTerm, {
    ...options,
    limit: limit * 3, // Get more results for better scoring
    minScore: 0, // Don't filter by score yet
  });

  // Then apply advanced client-side scoring
  const scoredResults = await scoreAndFilterResults(
    dbResults.map(r => r.card),
    searchTerm,
    minScore
  );

  return scoredResults.slice(0, limit);
}

/**
 * Get search suggestions with caching
 */
export async function getSearchSuggestionsOptimized(): Promise<string[]> {
  // For now, generate fresh suggestions
  const [issuers, categories] = await Promise.all([
    prisma.predefinedCard.findMany({
      select: { issuer: true },
      distinct: ['issuer'],
      orderBy: { issuer: 'asc' },
    }),
    prisma.predefinedBenefit.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    }),
  ]);

  const suggestions = new Set<string>();
  
  // Add issuers and their aliases
  issuers.forEach(({ issuer }) => {
    suggestions.add(issuer);
    // Add common aliases
    if (issuer.toLowerCase().includes('american express')) suggestions.add('amex');
    if (issuer.toLowerCase().includes('chase')) suggestions.add('chase');
    if (issuer.toLowerCase().includes('capital one')) suggestions.add('capital one');
  });

  // Add categories
  categories.forEach(({ category }) => {
    suggestions.add(category);
  });

  // Add common search terms
  const commonTerms = [
    'travel', 'dining', 'business', 'uber', 'entertainment', 'credit',
    'no annual fee', 'cashback', 'hotels', 'airlines', 'restaurants'
  ];
  commonTerms.forEach(term => suggestions.add(term));

  return Array.from(suggestions).sort();
}

// Helper functions
function normalizeString(str: string): string {
  return str.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNumericSearch(searchTerm: string): boolean {
  return /^\d+$/.test(searchTerm.replace(/\D/g, ''));
}

function getSortOrder(sortBy: string) {
  switch (sortBy) {
    case 'name':
      return [{ name: 'asc' as const }];
    case 'issuer':
      return [{ issuer: 'asc' as const }, { name: 'asc' as const }];
    case 'annualFee':
      return [{ annualFee: 'asc' as const }, { name: 'asc' as const }];
    default:
      return [{ issuer: 'asc' as const }, { name: 'asc' as const }];
  }
}

async function scoreAndFilterResults(
  cards: CardWithBenefits[],
  searchTerm: string,
  minScore: number
): Promise<SearchResult[]> {
  // Import the existing scoring logic
  const { searchCards } = await import('@/lib/cardSearchUtils');
  
  // Use the existing client-side scoring
  const results = searchCards(cards, searchTerm);
  
  // Filter by minimum score
  return results.filter(result => result.score >= minScore);
}

/**
 * Get popular search terms for analytics
 */
export async function getPopularSearchTerms(limit: number = 10): Promise<string[]> {
  // This would ideally come from a search analytics table
  // For now, return common terms based on benefit categories
  const popularCategories = await prisma.predefinedBenefit.groupBy({
    by: ['category'],
    _count: {
      category: true,
    },
    orderBy: {
      _count: {
        category: 'desc',
      },
    },
    take: limit,
  });

  return popularCategories.map(cat => cat.category);
}
