interface CardForDisplay {
  id: string;
  name: string;
  issuer: string;
  lastFourDigits?: string | null;
  nickname?: string | null;
}

// Utility functions for AMEX card digit handling

/**
 * Determines if a card is an American Express card based on issuer
 */
export function isAmexCard(issuer: string): boolean {
  return issuer === 'American Express';
}

/**
 * Gets the expected number of last digits for a card type
 * @param issuer Card issuer name
 * @returns 5 for AMEX (4-5 accepted), 4 for others
 */
export function getExpectedDigitsCount(issuer: string): number {
  return isAmexCard(issuer) ? 5 : 4;
}

/**
 * Validates last digits input for a specific card type
 * @param digits The digits string to validate
 * @param issuer Card issuer name
 * @returns Validation result with success/error message
 */
export function validateCardDigits(digits: string, issuer: string): { valid: boolean, error?: string } {
  if (!digits || !digits.trim()) return { valid: true }; // Optional field
  
  const trimmed = digits.trim();
  const isAmex = isAmexCard(issuer);
  
  if (isAmex) {
    // AMEX: Accept 4 or 5 digits
    if ((trimmed.length === 4 || trimmed.length === 5) && /^\d{4,5}$/.test(trimmed)) {
      return { valid: true };
    }
    return { valid: false, error: 'AMEX cards require 4 or 5 digits.' };
  } else {
    // Other cards: Exactly 4 digits (unchanged)
    if (trimmed.length === 4 && /^\d{4}$/.test(trimmed)) {
      return { valid: true };
    }
    return { valid: false, error: 'Last digits must be exactly 4 numeric digits.' };
  }
}


/**
 * Generates display names for cards, preferring last 4 digits over numeric indices for duplicates
 * @param cards Array of cards that need display names
 * @returns Array of cards with displayName property added
 */
export function generateCardDisplayNames<T extends CardForDisplay>(
  cards: T[]
): (T & { displayName: string })[] {
  // Count duplicates by card name + issuer combination
  const cardCounts: { [key: string]: number } = {};
  cards.forEach(card => {
    const cardKey = `${card.name}-${card.issuer}`;
    cardCounts[cardKey] = (cardCounts[cardKey] || 0) + 1;
  });

  // Track numeric indices for cards without lastFourDigits
  const cardIndices: { [key: string]: number } = {};

  return cards.map(card => {
    const cardKey = `${card.name}-${card.issuer}`;
    let displayName = card.name;

    // If card has a nickname, use it directly
    if (card.nickname && card.nickname.trim()) {
      displayName = card.nickname.trim();
    } 
    // Only modify display name if there are duplicates and no nickname
    else if (cardCounts[cardKey] > 1) {
      if (card.lastFourDigits && card.lastFourDigits.trim()) {
        // Prefer last digits if available (4 or 5 for AMEX, 4 for others)
        const length = card.lastFourDigits.length;
        const mask = '•'.repeat(length);
        displayName = `${card.name} (${mask}${card.lastFourDigits})`;
      } else {
        // Fall back to numeric index if no last digits
        cardIndices[cardKey] = (cardIndices[cardKey] || 0) + 1;
        displayName = `${card.name} #${cardIndices[cardKey]}`;
      }
    }

    return {
      ...card,
      displayName,
    };
  });
}

/**
 * Creates a map of card ID to display name for quick lookup
 * @param cards Array of cards
 * @returns Map of card ID to display name
 */
export function createCardDisplayNameMap<T extends CardForDisplay>(
  cards: T[]
): Map<string, string> {
  const cardsWithDisplayNames = generateCardDisplayNames(cards);
  return new Map(
    cardsWithDisplayNames.map(card => [card.id, card.displayName])
  );
} 