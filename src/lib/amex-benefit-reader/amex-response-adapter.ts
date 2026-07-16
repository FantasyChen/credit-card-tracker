import type {
  BenefitTrackerResponseItem,
  CatalogBenefitResponseItem,
  CatalogResponse,
  MemberResponse,
  TrackerResponse,
} from "./amex-api-contract";
import {
  normalizedBenefitObservationSchema,
  type ActivityKind,
  type IssueCode,
  type NormalizedBenefitObservationV1,
  type ObservedField,
  type QuantityV1,
} from "./contract";
import { createBenefitKey } from "./identity";

export interface TransientAccountCard {
  rawAccountToken: string;
  productName: string;
  endingDigits: string;
  relationship: "BASIC" | "SUPP";
}

export interface AccountDiscovery {
  cards: TransientAccountCard[];
  knownNonCardCount: number;
  unknownVariantCount: number;
  issueCodes: IssueCode[];
}

export interface BenefitNormalizationResult {
  benefits: NormalizedBenefitObservationV1[];
  issueCodes: IssueCode[];
}

const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const VISIBLE_DIGITS = /\d/g;

type ExtractedText =
  | { state: "absent" }
  | { state: "valid"; value: string }
  | { state: "invalid" };

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function uniqueText(values: unknown[], maxLength: number): ExtractedText {
  const provided = values.filter((value) => value != null);
  if (provided.length === 0) return { state: "absent" };
  const normalized = provided.map((value) => text(value, maxLength));
  if (normalized.some((value) => value === null)) return { state: "invalid" };
  const unique = new Set(normalized as string[]);
  return unique.size === 1 ? { state: "valid", value: Array.from(unique)[0] } : { state: "invalid" };
}

function productDescription(product: unknown): ExtractedText {
  if (product == null) return { state: "absent" };
  if (typeof product !== "object" || Array.isArray(product)) return { state: "invalid" };
  const candidate = product as { description?: unknown; product_description?: unknown };
  return uniqueText([candidate.description, candidate.product_description], 160);
}

function endingDigitsFromFields(source: {
  display_account_number?: unknown;
  account_number?: unknown;
  display_number?: unknown;
  card_number?: unknown;
}): ExtractedText {
  const provided = [
    source.display_account_number,
    source.account_number,
    source.display_number,
    source.card_number,
  ].filter((value) => value != null);
  if (provided.length === 0) return { state: "absent" };
  if (provided.some((value) => typeof value !== "string")) return { state: "invalid" };
  const endings = provided.map((value) => (value as string).match(VISIBLE_DIGITS)?.join("") ?? "");
  if (endings.some((digits) => digits.length !== 4 && digits.length !== 5)) return { state: "invalid" };
  const unique = new Set(endings);
  return unique.size === 1 ? { state: "valid", value: Array.from(unique)[0] } : { state: "invalid" };
}

function resolvedRelationship(...values: unknown[]): string | null {
  const extracted = uniqueText(values, 40);
  return extracted.state === "valid" ? extracted.value.toUpperCase() : null;
}

function resolvedSupplementaryProduct(
  supplementaryProduct: unknown,
  nestedProduct: unknown,
  parentProduct: unknown,
): string | null {
  const supplementary = productDescription(supplementaryProduct);
  const nested = productDescription(nestedProduct);
  if (supplementary.state === "invalid" || nested.state === "invalid") return null;
  if (supplementary.state === "valid" && nested.state === "valid") {
    return supplementary.value === nested.value ? supplementary.value : null;
  }
  if (supplementary.state === "valid") return supplementary.value;
  if (nested.state === "valid") return nested.value;
  const parent = productDescription(parentProduct);
  return parent.state === "valid" ? parent.value : null;
}

function resolvedLayeredEnding(
  outer: Parameters<typeof endingDigitsFromFields>[0],
  nested: Parameters<typeof endingDigitsFromFields>[0] | undefined,
): string | null {
  const outerEnding = endingDigitsFromFields(outer);
  const nestedEnding = nested ? endingDigitsFromFields(nested) : { state: "absent" as const };
  if (outerEnding.state === "invalid" || nestedEnding.state === "invalid") return null;
  if (outerEnding.state === "valid" && nestedEnding.state === "valid") {
    return outerEnding.value === nestedEnding.value ? outerEnding.value : null;
  }
  return outerEnding.state === "valid"
    ? outerEnding.value
    : nestedEnding.state === "valid" ? nestedEnding.value : null;
}

export function parseAccountDiscovery(response: MemberResponse): AccountDiscovery {
  const cards: TransientAccountCard[] = [];
  const seenTokens = new Set<string>();
  let unknownVariantCount = 0;
  let duplicateCount = 0;

  const addCard = (candidate: TransientAccountCard | null): void => {
    if (!candidate) {
      unknownVariantCount += 1;
      return;
    }
    if (seenTokens.has(candidate.rawAccountToken)) {
      duplicateCount += 1;
      return;
    }
    seenTokens.add(candidate.rawAccountToken);
    cards.push(candidate);
  };

  for (const account of response.accounts) {
    const accountRelationship = resolvedRelationship(
      account.relationship,
      account.account?.relationship,
    );
    if (accountRelationship === "BASIC") {
      const rawAccountToken = uniqueText([account.account_token], 4096);
      const productName = productDescription(account.product);
      const endingDigits = resolvedLayeredEnding(account, account.account);
      addCard(rawAccountToken.state === "valid" && productName.state === "valid" && endingDigits
        ? {
            rawAccountToken: rawAccountToken.value,
            productName: productName.value,
            endingDigits,
            relationship: "BASIC",
          }
        : null);
    } else {
      // The pinned public source does not characterize a reliable non-card
      // discriminator. Unknown top-level relationships are therefore never
      // guessed to be either cards or known non-cards.
      unknownVariantCount += 1;
    }

    for (const supplementary of account.supplementary_accounts ?? []) {
      const supplementaryRelationship = resolvedRelationship(
        supplementary.account?.relationship,
        supplementary.relationship,
      );
      if (supplementaryRelationship !== "SUPP") {
        unknownVariantCount += 1;
        continue;
      }
      const rawAccountToken = uniqueText([
        supplementary.account_token,
        supplementary.account?.account_token,
      ], 4096);
      const productName = resolvedSupplementaryProduct(
        supplementary.product,
        supplementary.account?.product,
        account.product,
      );
      const endingDigits = resolvedLayeredEnding(supplementary, supplementary.account);
      addCard(rawAccountToken.state === "valid" && productName && endingDigits
        ? { rawAccountToken: rawAccountToken.value, productName, endingDigits, relationship: "SUPP" }
        : null);
    }
  }

  const issueCodes: IssueCode[] = [];
  if (unknownVariantCount) issueCodes.push("unknown_account_variant");
  if (duplicateCount) issueCodes.push("duplicate_card_entry");
  return {
    cards,
    knownNonCardCount: 0,
    unknownVariantCount: unknownVariantCount + duplicateCount,
    issueCodes,
  };
}

function notExposed<T>(): ObservedField<T> {
  return { state: "not_exposed" };
}

function unrecognized<T>(issueCode: IssueCode): ObservedField<T> {
  return { state: "unrecognized", issueCode };
}

function observed<T>(value: T): ObservedField<T> {
  return { state: "observed", value };
}

function exactString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function quantityUnit(tracker: BenefitTrackerResponseItem["tracker"]): {
  unit: QuantityV1["unit"];
  currency: QuantityV1["currency"];
  recognized: boolean;
} {
  const currency = exactString(tracker?.targetCurrency)?.toUpperCase() ?? null;
  const unit = exactString(tracker?.targetUnit)?.toUpperCase() ?? null;
  // Owner validation characterized only MONETARY and PASSES. Require both the
  // explicit monetary unit and USD currency rather than inferring either from
  // the other; every other combination remains safely unknown.
  if (unit === "MONETARY" && currency === "USD") {
    return { unit: "USD", currency: "USD", recognized: true };
  }
  if (unit === "PASSES" && currency === null) {
    return { unit: "count", currency: null, recognized: true };
  }
  return { unit: "unknown", currency: null, recognized: false };
}

function quantityField(
  value: unknown,
  tracker: BenefitTrackerResponseItem["tracker"],
  issues: Set<IssueCode>,
): ObservedField<QuantityV1> {
  if (value == null) return notExposed();
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    issues.add("unknown_quantity");
    return unrecognized("unknown_quantity");
  }
  const unit = quantityUnit(tracker);
  if (!unit.recognized) issues.add("unknown_quantity");
  return observed({ value, unit: unit.unit, currency: unit.currency });
}

function categoryField(value: unknown): ObservedField<string> {
  if (value == null) return notExposed();
  const normalized = text(value, 100);
  return normalized ? observed(normalized) : unrecognized("unknown_activity_kind");
}

function periodField(tracker: BenefitTrackerResponseItem): ObservedField<string> {
  const duration = text(tracker.trackerDuration, 160);
  if (duration) return observed(duration);
  const start = text(tracker.periodStartDate, 70);
  const end = text(tracker.periodEndDate, 70);
  if (start && end) return observed(`${start} to ${end}`);
  if (start || end) return observed(start ?? end!);
  if (tracker.trackerDuration != null || tracker.periodStartDate != null || tracker.periodEndDate != null) {
    return unrecognized("unknown_status");
  }
  return notExposed();
}

function trackerStatusFields(statusValue: unknown, activityKind: ActivityKind, issues: Set<IssueCode>): {
  trackerState: NormalizedBenefitObservationV1["trackerState"];
  completionState: NormalizedBenefitObservationV1["completionState"];
} {
  if (statusValue == null) {
    return { trackerState: notExposed(), completionState: notExposed() };
  }
  const status = exactString(statusValue)?.toUpperCase();
  if (status === "ACHIEVED") {
    return { trackerState: observed("completed"), completionState: observed("complete") };
  }
  if (status === "IN_PROGRESS") {
    return { trackerState: observed("in_progress"), completionState: observed("incomplete") };
  }
  if (status === "ACTIVE") {
    return {
      trackerState: observed(activityKind === "credit_earned" ? "earned" : "in_progress"),
      completionState: observed("incomplete"),
    };
  }
  issues.add("unknown_status");
  return {
    trackerState: unrecognized("unknown_status"),
    completionState: unrecognized("unknown_status"),
  };
}

function activityKindForTracker(tracker: BenefitTrackerResponseItem, issues: Set<IssueCode>): ActivityKind | null {
  const status = exactString(tracker.status)?.toUpperCase();
  if (status === "ACHIEVED") return "completed";
  const category = exactString(tracker.category)?.toLocaleLowerCase("en-US") ?? null;
  if (["spend", "usage", "access", "loan"].includes(category ?? "")) return "spend_progress";
  issues.add("unknown_activity_kind");
  return null;
}

function enrollmentField(catalog: CatalogBenefitResponseItem | undefined, issues: Set<IssueCode>): NormalizedBenefitObservationV1["enrollmentState"] {
  if (!catalog) return notExposed();
  const layout = exactString(catalog.layoutType)?.toUpperCase();
  if (layout === "ENROLLED") return observed("enrolled");
  if (layout === "NOTENROLLED") {
    return catalog.isEnrollable === true ? observed("required") : notExposed();
  }
  if (layout === "LOGGEDIN" || layout === "SUPP") return notExposed();
  if (catalog.layoutType == null && catalog.isEnrollable == null) return notExposed();
  issues.add("unknown_status");
  return unrecognized("unknown_status");
}

function trackerTitle(tracker: BenefitTrackerResponseItem, catalog: CatalogBenefitResponseItem | undefined): string | null {
  return text(catalog?.benefitTitle, 200) ?? text(tracker.benefitName, 200);
}

function catalogTitle(catalog: CatalogBenefitResponseItem): string | null {
  return text(catalog.benefitShortTitle, 200)
    ?? text(catalog.benefitTitle, 200)
    ?? text(catalog.benefitName, 200);
}

function benefitKey(title: string, category: ObservedField<string>, activityKind: ActivityKind): string {
  return createBenefitKey({
    title,
    category: category.state === "observed" ? category.value : undefined,
    activityKind,
  });
}

function sameCatalogObservation(
  left: CatalogBenefitResponseItem,
  right: CatalogBenefitResponseItem,
): boolean {
  return exactString(left.sorBenefitId) === exactString(right.sorBenefitId)
    && exactString(left.benefitShortTitle) === exactString(right.benefitShortTitle)
    && exactString(left.benefitTitle) === exactString(right.benefitTitle)
    && exactString(left.benefitName) === exactString(right.benefitName)
    && exactString(left.layoutType) === exactString(right.layoutType)
    && left.isEnrollable === right.isEnrollable;
}

export function normalizeBenefits(
  trackerResponse: TrackerResponse,
  catalogResponse: CatalogResponse,
): BenefitNormalizationResult {
  const issues = new Set<IssueCode>();
  const catalogByIssuerId = new Map<string, CatalogBenefitResponseItem>();
  const ambiguousCatalogIds = new Set<string>();
  for (const catalog of Object.values(catalogResponse.benefits)) {
    const issuerId = exactString(catalog.sorBenefitId);
    if (!issuerId || ambiguousCatalogIds.has(issuerId)) continue;
    const existing = catalogByIssuerId.get(issuerId);
    if (existing) {
      if (!sameCatalogObservation(existing, catalog)) {
        issues.add("benefit_identity_conflict");
        catalogByIssuerId.delete(issuerId);
        ambiguousCatalogIds.add(issuerId);
      }
      continue;
    }
    catalogByIssuerId.set(issuerId, catalog);
  }

  const normalized = new Map<string, NormalizedBenefitObservationV1>();
  const add = (benefit: NormalizedBenefitObservationV1): void => {
    const existing = normalized.get(benefit.benefitKey);
    if (!existing) {
      normalized.set(benefit.benefitKey, normalizedBenefitObservationSchema.parse(benefit));
      return;
    }
    if (JSON.stringify(existing) !== JSON.stringify(benefit)) issues.add("benefit_identity_conflict");
  };

  for (const block of trackerResponse) {
    for (const tracker of block.trackers) {
      const itemIssues = new Set<IssueCode>();
      const activityKind = activityKindForTracker(tracker, itemIssues);
      if (!activityKind) {
        itemIssues.forEach((issue) => issues.add(issue));
        continue;
      }
      const issuerId = exactString(tracker.sorBenefitId);
      const catalog = issuerId ? catalogByIssuerId.get(issuerId) : undefined;
      const title = trackerTitle(tracker, catalog);
      if (!title) {
        issues.add("benefit_identity_conflict");
        continue;
      }
      const category = categoryField(tracker.category);
      if (category.state === "unrecognized") itemIssues.add(category.issueCode);
      const statusFields = trackerStatusFields(tracker.status, activityKind, itemIssues);
      const earnedOrUsed = quantityField(tracker.tracker?.spentAmount, tracker.tracker, itemIssues);
      const targetOrLimit = quantityField(tracker.tracker?.targetAmount, tracker.tracker, itemIssues);
      const remaining = quantityField(tracker.tracker?.remainingAmount, tracker.tracker, itemIssues);
      const period = periodField(tracker);
      if (period.state === "unrecognized") itemIssues.add(period.issueCode);
      const enrollmentState = enrollmentField(catalog, itemIssues);
      const benefit: NormalizedBenefitObservationV1 = {
        benefitKey: benefitKey(title, category, activityKind),
        title,
        category,
        activityKind,
        enrollmentState,
        trackerState: statusFields.trackerState,
        completionState: statusFields.completionState,
        earnedOrUsed,
        targetOrLimit,
        remaining,
        period,
        confidence: itemIssues.size === 0 ? "high" : "medium",
        issueCodes: Array.from(itemIssues),
      };
      add(benefit);
      itemIssues.forEach((issue) => issues.add(issue));
    }
  }

  for (const catalog of Object.values(catalogResponse.benefits)) {
    const issuerId = exactString(catalog.sorBenefitId);
    if (issuerId && ambiguousCatalogIds.has(issuerId)) continue;
    const layout = exactString(catalog.layoutType)?.toUpperCase();
    if (layout !== "NOTENROLLED" || catalog.isEnrollable !== true) {
      if (
        catalog.layoutType != null
        && layout !== "ENROLLED"
        && layout !== "NOTENROLLED"
        && layout !== "LOGGEDIN"
        && layout !== "SUPP"
      ) {
        issues.add("unknown_status");
      }
      continue;
    }
    const hasJoinedTracker = issuerId && trackerResponse.some((block) =>
      block.trackers.some((tracker) => exactString(tracker.sorBenefitId) === issuerId));
    if (hasJoinedTracker) continue;
    const title = catalogTitle(catalog);
    if (!title) {
      issues.add("benefit_identity_conflict");
      continue;
    }
    const category = notExposed<string>();
    add({
      benefitKey: benefitKey(title, category, "enrollment_candidate"),
      title,
      category,
      activityKind: "enrollment_candidate",
      enrollmentState: observed("required"),
      trackerState: notExposed(),
      completionState: notExposed(),
      earnedOrUsed: notExposed(),
      targetOrLimit: notExposed(),
      remaining: notExposed(),
      period: notExposed(),
      confidence: "high",
      issueCodes: [],
    });
  }

  return { benefits: Array.from(normalized.values()), issueCodes: Array.from(issues) };
}
