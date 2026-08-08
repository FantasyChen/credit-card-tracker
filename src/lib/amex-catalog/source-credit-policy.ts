import { normalizeAmexSelectionText } from "./normalization";
import type { AmexPeriodKey } from "./catalog-registry";
import { periodKeysForExactRange } from "./period-resolution";

export interface AmexPolicyQuantity {
  value: string;
  unit: string;
  currency?: string | null;
}

export interface AmexSourceCreditEvidence {
  sourcePeriod?: {
    kind: "calendar_date_range";
    startDate: string;
    endDate: string;
    timeZone: "UTC";
  } | null;
  earnedOrUsed?: AmexPolicyQuantity | null;
}

export interface AmexAmountConstraint {
  currency: "USD";
  minimumUsd: number;
  maximumUsd?: number;
}

export interface AmexSourceCreditPolicy {
  productKey: string;
  sourceCreditKey: string;
  creditFamilyKey: string;
  exactAliases: readonly string[];
  requiredTokenGroups: readonly (readonly string[])[];
  forbiddenTokenGroups: readonly (readonly string[])[];
  compatiblePeriodKeys: readonly AmexPeriodKey[];
  amountConstraint?: AmexAmountConstraint;
}

export const GENERIC_FORBIDDEN_AMEX_CREDIT_TOKEN_GROUPS = [
  ["spend"],
  ["free", "night"],
  ["certificate"],
  ["elite"],
  ["access"],
  ["status"],
  ["insurance"],
  ["protection"],
  ["loan"],
  ["link", "profile"],
] as const;

function normalizedTokens(value: string): Set<string> {
  return new Set(normalizeAmexSelectionText(value).split(" ").filter(Boolean));
}

export function titleSatisfiesAmexPolicy(policy: AmexSourceCreditPolicy, title: string): boolean {
  const normalized = normalizeAmexSelectionText(title);
  const tokens = normalizedTokens(title);
  if (policy.forbiddenTokenGroups.some((group) => group.every((token) => tokens.has(token)))) return false;
  if (policy.exactAliases.some((alias) => normalizeAmexSelectionText(alias) === normalized)) return true;
  return policy.requiredTokenGroups.every((group) => group.some((token) => tokens.has(token)));
}

function parseUsd(quantity: AmexPolicyQuantity): number | null {
  if (quantity.unit !== "USD" || quantity.currency !== "USD") return null;
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(quantity.value)) return null;
  const value = Number(quantity.value);
  return Number.isFinite(value) ? value : null;
}

export function evidenceSatisfiesAmexPolicy(
  policy: AmexSourceCreditPolicy,
  evidence: AmexSourceCreditEvidence = {},
): boolean {
  if (evidence.sourcePeriod) {
    const sourceKeys = periodKeysForExactRange(
      evidence.sourcePeriod.startDate,
      evidence.sourcePeriod.endDate,
    );
    if (!sourceKeys.some((key) => policy.compatiblePeriodKeys.includes(key))) return false;
  }
  if (evidence.earnedOrUsed && policy.amountConstraint) {
    const amount = parseUsd(evidence.earnedOrUsed);
    if (amount === null
      || amount < policy.amountConstraint.minimumUsd
      || (policy.amountConstraint.maximumUsd !== undefined
        && amount > policy.amountConstraint.maximumUsd)) return false;
  }
  return true;
}
