import type { PredefinedCard, PredefinedBenefit } from '@/generated/prisma';

export type CardWithBenefits = PredefinedCard & {
  benefits: PredefinedBenefit[];
};

export interface SearchResult {
  card: CardWithBenefits;
  score: number;
  matchedFields: string[];
}

// Common abbreviations and aliases for credit card companies
const ISSUER_ALIASES: Record<string, string[]> = {
  'american express': ['amex', 'ae'],
  'bank of america': ['boa', 'bofa'],
  'jp morgan chase': ['chase', 'jpm'],
  'jpmorgan chase': ['chase', 'jpm'],
  'capital one': ['cap1', 'capital1'],
  'wells fargo': ['wf'],
  'citi': ['citibank', 'citicorp'],
  'us bank': ['usb', 'us bancorp'],
  'synchrony': ['synchrony bank'],
  'barclays': ['barclaycard'],
};

// Common benefit category aliases based on actual database categories
const BENEFIT_ALIASES: Record<string, string[]> = {
  'travel': ['trip', 'flights', 'airlines', 'hotels', 'airline', 'hotel'],
  'dining': ['food', 'restaurants', 'eating', 'restaurant'],
  'food delivery': ['delivery', 'doordash', 'grubhub', 'uber eats', 'instacart'],
  'grocery': ['groceries', 'supermarket', 'food shopping', 'instacart'],
  'entertainment': ['streaming', 'netflix', 'hulu', 'disney', 'subscription', 'digital entertainment'],
  'transportation': ['rideshare', 'uber', 'lyft', 'taxi', 'rideshare credit'],
  'shopping': ['retail', 'saks', 'stores'],
  'wellness': ['fitness', 'gym', 'equinox', 'health'],
  'membership': ['walmart', 'costco', 'memberships'],
  'electronics': ['dell', 'tech', 'technology', 'computers'],
  'utilities': ['wireless', 'phone', 'cellular', 'mobile'],
  'business services': ['business', 'indeed', 'services'],
  'software': ['adobe', 'apps', 'applications'],
  'statement credit': ['cashback', 'cash back', 'cash reward', 'credit'],
};

/**
 * Normalizes a string for better matching
 */
function normalizeString(str: string): string {
  return str.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace special characters with spaces
    .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
    .trim();
}

/**
 * Calculates similarity score between two strings using simple fuzzy matching
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  
  // Exact match
  if (norm1 === norm2) return 100;
  
  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 80;
  
  // Word-level matching
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  let matchingWords = 0;
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchingWords++;
        break;
      }
    }
  }
  
  const wordMatchRatio = matchingWords / Math.max(words1.length, words2.length);
  return wordMatchRatio * 60;
}

/**
 * Checks if a search term matches any aliases for a given text
 */
function matchesAlias(searchTerm: string, text: string, aliases: Record<string, string[]>): boolean {
  const normalizedText = normalizeString(text);
  const normalizedSearch = normalizeString(searchTerm);
  
  // Direct match
  if (normalizedText.includes(normalizedSearch) || normalizedSearch.includes(normalizedText)) {
    return true;
  }
  
  // Check aliases
  for (const [key, aliasArray] of Object.entries(aliases)) {
    if (normalizedText.includes(key)) {
      return aliasArray.some(alias => 
        alias.includes(normalizedSearch) || normalizedSearch.includes(alias)
      );
    }
  }
  
  return false;
}

/**
 * Searches credit cards with enhanced functionality
 */
export function searchCards(cards: CardWithBenefits[], searchTerm: string): SearchResult[] {
  if (!searchTerm.trim()) {
    return cards.map(card => ({
      card,
      score: 0,
      matchedFields: []
    }));
  }

  const results: SearchResult[] = [];
  const normalizedSearch = normalizeString(searchTerm);

  for (const card of cards) {
    let totalScore = 0;
    const matchedFields: string[] = [];

    // Search card name (highest priority)
    const nameScore = calculateSimilarity(card.name, searchTerm);
    if (nameScore > 30) {
      totalScore += nameScore * 3; // 3x weight for name matches
      matchedFields.push('name');
    }

    // Search issuer (high priority)
    const issuerScore = calculateSimilarity(card.issuer, searchTerm);
    if (issuerScore > 30 || matchesAlias(searchTerm, card.issuer, ISSUER_ALIASES)) {
      totalScore += Math.max(issuerScore, 50) * 2; // 2x weight for issuer matches
      matchedFields.push('issuer');
    }

    // Search annual fee (exact or range match, plus "no annual fee")
    const feeStr = card.annualFee.toString();
    if (feeStr.includes(normalizedSearch.replace(/\D/g, '')) && normalizedSearch.replace(/\D/g, '')) {
      totalScore += 40;
      matchedFields.push('annual fee');
    }
    
    // Special handling for "no annual fee" searches
    if (normalizedSearch.includes('no annual fee') || normalizedSearch.includes('no fee')) {
      if (card.annualFee === 0) {
        totalScore += 80;
        matchedFields.push('annual fee');
      }
    }

    // Search benefits
    for (const benefit of card.benefits) {
      // Benefit description
      const benefitScore = calculateSimilarity(benefit.description, searchTerm);
      if (benefitScore > 20) {
        totalScore += benefitScore * 0.8; // 0.8x weight for benefit matches
        matchedFields.push('benefit');
      }
      
      // Special handling for "cashback" searches - look for "credit" in descriptions
      if ((normalizedSearch.includes('cashback') || normalizedSearch.includes('cash back')) && 
          normalizeString(benefit.description).includes('credit')) {
        totalScore += 50;
        matchedFields.push('benefit');
      }

      // Benefit category
      const categoryScore = calculateSimilarity(benefit.category, searchTerm);
      if (categoryScore > 20 || matchesAlias(searchTerm, benefit.category, BENEFIT_ALIASES)) {
        totalScore += Math.max(categoryScore, 40) * 1.2; // 1.2x weight for category matches
        matchedFields.push('category');
      }
    }

    // Only include cards with meaningful matches
    if (totalScore > 10) {
      results.push({
        card,
        score: totalScore,
        matchedFields: Array.from(new Set(matchedFields)) // Remove duplicates
      });
    }
  }

  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Get search suggestions based on available cards
 */
export function getSearchSuggestions(cards: CardWithBenefits[]): string[] {
  const suggestions = new Set<string>();
  
  // Add common issuers
  cards.forEach(card => {
    suggestions.add(card.issuer);
    
    // Add aliases for issuers
    const normalizedIssuer = normalizeString(card.issuer);
    for (const [key, aliases] of Object.entries(ISSUER_ALIASES)) {
      if (normalizedIssuer.includes(key)) {
        aliases.forEach(alias => suggestions.add(alias));
      }
    }
  });
  
  // Add common benefit categories
  cards.forEach(card => {
    card.benefits.forEach(benefit => {
      suggestions.add(benefit.category);
    });
  });
  
  // Add common terms based on actual data
  suggestions.add('travel');
  suggestions.add('dining');
  suggestions.add('business');
  suggestions.add('uber');
  suggestions.add('entertainment');
  suggestions.add('credit');
  
  return Array.from(suggestions).sort();
} 