export function normalizeAmexSelectionText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

function containsPhrase(value: string, phrase: string): boolean {
  return ` ${value} `.includes(` ${normalizeAmexSelectionText(phrase)} `);
}

const EXCLUDED_NON_CREDIT_TITLE_PHRASES = [
  "car rental loss and damage insurance",
  "cell phone protection",
  "free night",
  "global assist hotline",
  "global dining access",
  "lounge access",
  "priority pass",
  "purchase protection",
  "return protection",
  "elite status",
] as const;

const REVIEWED_IGNORED_CATALOG_TITLES = new Set([
  normalizeAmexSelectionText("35% Airline Bonus"),
  normalizeAmexSelectionText("Link Your Resy Profile"),
]);

export function isIgnoredAmexCatalogBenefitTitle(title: string): boolean {
  return REVIEWED_IGNORED_CATALOG_TITLES.has(normalizeAmexSelectionText(title));
}

function isExplicitlyUnsupportedTitle(normalizedTitle: string): boolean {
  return REVIEWED_IGNORED_CATALOG_TITLES.has(normalizedTitle)
    || EXCLUDED_NON_CREDIT_TITLE_PHRASES.some((phrase) => containsPhrase(normalizedTitle, phrase));
}

/**
 * Local observation is product-independent. This predicate rejects only the
 * reviewed title exclusions and explicit non-credit phrases; exact tracker
 * category `usage` remains the separate source authority.
 */
export function isEligibleLocalAmexUsageTitle(title: string): boolean {
  const normalized = normalizeAmexSelectionText(title);
  return normalized.length > 0 && !isExplicitlyUnsupportedTitle(normalized);
}

export interface AmexBrowserSyncMatch {
  productKey: "american-express-platinum-card";
  creditFamilyKey:
    | "american-express-platinum-card:resy"
    | "american-express-platinum-card:lululemon";
}

const BASE_PLATINUM_SYNC_PRODUCTS = new Set([
  normalizeAmexSelectionText("American Express Platinum Card"),
  normalizeAmexSelectionText("The Platinum Card from American Express"),
  normalizeAmexSelectionText("Platinum Card®"),
]);

const BASE_PLATINUM_SYNC_TITLES = new Map<string, AmexBrowserSyncMatch["creditFamilyKey"]>([
  [normalizeAmexSelectionText("Resy Credit"), "american-express-platinum-card:resy"],
  [normalizeAmexSelectionText("Resy Dining Credit"), "american-express-platinum-card:resy"],
  [normalizeAmexSelectionText("$400 Resy Credit"), "american-express-platinum-card:resy"],
  [normalizeAmexSelectionText("lululemon Credit"), "american-express-platinum-card:lululemon"],
  [normalizeAmexSelectionText("$300 lululemon Credit"), "american-express-platinum-card:lululemon"],
]);

/**
 * Destination authority enters only at handoff projection. Both product and
 * tracker title use a closed exact normalized vocabulary: no substring,
 * amount, cadence, ending-digit, or product-resemblance inference.
 */
export function matchAmexBrowserSyncCredit(
  productName: string,
  trackerTitle: string,
): AmexBrowserSyncMatch | null {
  if (!BASE_PLATINUM_SYNC_PRODUCTS.has(normalizeAmexSelectionText(productName))) return null;
  const creditFamilyKey = BASE_PLATINUM_SYNC_TITLES.get(normalizeAmexSelectionText(trackerTitle));
  return creditFamilyKey
    ? { productKey: "american-express-platinum-card", creditFamilyKey }
    : null;
}
