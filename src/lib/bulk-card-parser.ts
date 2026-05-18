export interface BulkCardCatalogItem {
  id: string;
  name: string;
  issuer: string;
}

export interface ParsedBulkCardItem {
  input: string;
  copyIndex: number;
  totalCopies: number;
  matchedCard: BulkCardCatalogItem | null;
  candidates: BulkCardCatalogItem[];
  error?: string;
}

const CARD_ALIASES: Record<string, string> = {
  plat: 'American Express Platinum Card',
  platinum: 'American Express Platinum Card',
  'amex plat': 'American Express Platinum Card',
  'amex platinum': 'American Express Platinum Card',
  bizplat: 'American Express Business Platinum Card',
  'biz plat': 'American Express Business Platinum Card',
  'business plat': 'American Express Business Platinum Card',
  gold: 'American Express Gold Card',
  'amex gold': 'American Express Gold Card',
  bizgold: 'American Express Business Gold Card',
  'biz gold': 'American Express Business Gold Card',
  'business gold': 'American Express Business Gold Card',
  csr: 'Chase Sapphire Reserve',
  csp: 'Chase Sapphire Preferred',
  aspire: 'Hilton Honors American Express Aspire Card',
  surpass: 'Hilton Honors American Express Surpass Card',
  brilliant: 'Marriott Bonvoy Brilliant American Express Card',
  boundless: 'Marriott Bonvoy Boundless Credit Card',
  ritz: 'The Ritz-Carlton Credit Card',
  venturex: 'Capital One Venture X',
  'venture x': 'Capital One Venture X',
};

export function normalizeBulkCardToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseToken(rawToken: string): { query: string; count: number } {
  const trimmed = rawToken.trim();
  const match = trimmed.match(/^(.*?)\s*(?:x|\*)\s*(\d{1,2})$/i);
  if (!match) {
    return { query: trimmed, count: 1 };
  }

  return {
    query: match[1].trim(),
    count: Math.max(1, Math.min(50, Number.parseInt(match[2], 10))),
  };
}

function scoreCard(query: string, card: BulkCardCatalogItem): number {
  const normalizedQuery = normalizeBulkCardToken(query);
  const normalizedName = normalizeBulkCardToken(card.name);
  const normalizedIssuer = normalizeBulkCardToken(card.issuer);
  const words = normalizedQuery.split(' ').filter(Boolean);

  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.includes(normalizedQuery)) return 85;

  let score = 0;
  for (const word of words) {
    if (normalizedName.split(' ').includes(word)) score += 18;
    else if (normalizedName.includes(word)) score += 10;
    if (normalizedIssuer.includes(word)) score += 6;
  }

  return score;
}

function resolveCard(query: string, catalog: BulkCardCatalogItem[]): { matchedCard: BulkCardCatalogItem | null; candidates: BulkCardCatalogItem[] } {
  const normalizedQuery = normalizeBulkCardToken(query);
  const aliasTarget = CARD_ALIASES[normalizedQuery.replace(/\s/g, '')] ?? CARD_ALIASES[normalizedQuery];
  if (aliasTarget) {
    const aliasMatch = catalog.find((card) => card.name === aliasTarget) ?? null;
    if (aliasMatch) return { matchedCard: aliasMatch, candidates: [aliasMatch] };
  }

  const scored = catalog
    .map((card) => ({ card, score: scoreCard(query, card) }))
    .filter((result) => result.score >= 18)
    .sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name));

  return {
    matchedCard: scored[0]?.score >= 55 ? scored[0].card : null,
    candidates: scored.slice(0, 5).map((result) => result.card),
  };
}

export function parseBulkCardInput(input: string, catalog: BulkCardCatalogItem[]): ParsedBulkCardItem[] {
  const tokens = input
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.flatMap((token) => {
    const parsed = parseToken(token);
    const resolved = resolveCard(parsed.query, catalog);

    return Array.from({ length: parsed.count }, (_, index) => ({
      input: parsed.query,
      copyIndex: index + 1,
      totalCopies: parsed.count,
      matchedCard: resolved.matchedCard,
      candidates: resolved.candidates,
      error: resolved.matchedCard ? undefined : `Could not confidently match "${parsed.query}"`,
    }));
  });
}
