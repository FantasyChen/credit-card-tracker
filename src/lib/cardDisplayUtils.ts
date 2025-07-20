interface CardForDisplay {
  id: string;
  name: string;
  issuer: string;
  lastFourDigits?: string | null;
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

    // Only modify display name if there are duplicates
    if (cardCounts[cardKey] > 1) {
      if (card.lastFourDigits && card.lastFourDigits.trim()) {
        // Prefer last 4 digits if available
        displayName = `${card.name} (••${card.lastFourDigits})`;
      } else {
        // Fall back to numeric index if no last 4 digits
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