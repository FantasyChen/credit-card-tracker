import { z } from "zod";

export const AMEX_API_CONTRACT_VERSION = "amex-private-read/1" as const;
export const AMEX_API_TIMEOUT_MS = 15_000;

const responseText = (maxLength: number) => z.string().max(maxLength).nullish();

const accountProductSchema = z.object({
  description: responseText(160),
  product_description: responseText(160),
}).strip();

const accountDisplayFields = {
  relationship: responseText(40),
  display_account_number: responseText(100),
  account_number: responseText(100),
  display_number: responseText(100),
  card_number: responseText(100),
};

const supplementaryAccountDetailsSchema = z.object({
  account_token: responseText(4096),
  product: accountProductSchema.optional(),
  ...accountDisplayFields,
}).strip();

// Current owner validation characterized only relationship and explicit display
// ending fields inside a top-level account's nested `account` projection. Keep
// this narrower than the supplementary shape so nested raw tokens, products,
// and unrelated objects are discarded at the transport boundary.
const topLevelNestedAccountSchema = z.object(accountDisplayFields).strip();

const supplementaryAccountSchema = z.object({
  account_token: responseText(4096),
  product: accountProductSchema.optional(),
  ...accountDisplayFields,
  account: supplementaryAccountDetailsSchema.optional(),
}).strip();

const memberAccountSchema = z.object({
  account_token: responseText(4096),
  product: accountProductSchema.optional(),
  ...accountDisplayFields,
  account: topLevelNestedAccountSchema.optional(),
  supplementary_accounts: z.array(supplementaryAccountSchema).optional(),
}).strip();

export const memberResponseSchema = z.object({
  accounts: z.array(memberAccountSchema),
}).strip();
export type MemberResponse = z.infer<typeof memberResponseSchema>;

const trackerQuantitySchema = z.object({
  targetAmount: responseText(100),
  spentAmount: responseText(100),
  remainingAmount: responseText(100),
  targetCurrencySymbol: responseText(20),
  targetCurrency: responseText(20),
  targetUnit: responseText(40),
}).strip();

const benefitTrackerSchema = z.object({
  sorBenefitId: responseText(500),
  benefitId: responseText(500),
  benefitName: responseText(200),
  category: responseText(100),
  status: responseText(100),
  periodStartDate: responseText(70),
  periodEndDate: responseText(70),
  trackerDuration: responseText(160),
  tracker: trackerQuantitySchema.optional(),
}).strip();

export const trackerResponseSchema = z.array(z.object({
  trackers: z.array(benefitTrackerSchema),
}).strip());
export type TrackerResponse = z.infer<typeof trackerResponseSchema>;
export type BenefitTrackerResponseItem = z.infer<typeof benefitTrackerSchema>;

const catalogBenefitSchema = z.object({
  sorBenefitId: responseText(500),
  benefitShortTitle: responseText(200),
  benefitTitle: responseText(200),
  benefitName: responseText(200),
  layoutType: responseText(100),
  isEnrollable: z.boolean().nullish(),
}).strip();

export const catalogResponseSchema = z.object({
  benefits: z.record(catalogBenefitSchema),
}).strip();
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type CatalogBenefitResponseItem = z.infer<typeof catalogBenefitSchema>;

export const MEMBER_READ_ENDPOINT = Object.freeze({
  origin: "https://global.americanexpress.com",
  path: "/api/servicing/v1/member",
  method: "GET" as const,
  headers: Object.freeze({ Accept: "application/json" }),
});

export const TRACKER_READ_ENDPOINT = Object.freeze({
  origin: "https://functions.americanexpress.com",
  path: "/ReadBestLoyaltyBenefitsTrackers.v1",
  method: "POST" as const,
  headers: Object.freeze({
    Accept: "*/*",
    "Content-Type": "application/json",
  }),
});

export const CATALOG_READ_ENDPOINT = Object.freeze({
  origin: "https://functions.americanexpress.com",
  path: "/ReadLoyaltyBenefits.v2",
  method: "POST" as const,
  headers: Object.freeze({
    Accept: "application/json",
    "Content-Type": "application/json",
  }),
});

export function buildTrackerRequestBody(accountToken: string): string {
  requireTransientAccountToken(accountToken);
  return JSON.stringify([{ accountToken, locale: "en-US", limit: "ALL" }]);
}

export function buildCatalogRequestBody(accountToken: string): string {
  requireTransientAccountToken(accountToken);
  return JSON.stringify({ accountToken, locale: "en-US" });
}

function requireTransientAccountToken(accountToken: string): void {
  if (typeof accountToken !== "string" || accountToken.length === 0 || accountToken.length > 4096) {
    throw new Error("A transient account identity is required.");
  }
}
