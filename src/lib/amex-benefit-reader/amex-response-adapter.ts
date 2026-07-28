import type {
  BenefitTrackerResponseItem,
  CatalogBenefitResponseItem,
  CatalogResponse,
  MemberResponse,
  TrackerResponse,
} from "./amex-api-contract";
import {
  normalizedBenefitObservationV3Schema,
  sourcePeriodV2Schema,
  type ActivityKind,
  type IssueCode,
  type NormalizedBenefitObservationV3,
  type ObservedField,
  type QuantityV1,
  type SourcePeriodV2,
} from "./contract";
import { createBenefitKey } from "./identity";
import {
  isEligibleLocalAmexUsageTitle,
  isIgnoredAmexCatalogBenefitTitle,
} from "./supported-card-credits";

export interface TransientAccountCard {
  rawAccountToken: string;
  productName: string;
  endingDigits: string;
}

export interface AccountDiscovery {
  cards: TransientAccountCard[];
  knownNonCardCount: number;
  unknownVariantCount: number;
  issueCodes: IssueCode[];
}

export const BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS = [
  "tracker_state_collision",
  "tracker_catalog_key_mismatch",
  "ambiguous_catalog_join",
  "tracker_catalog_candidate_collision",
] as const;

export type BenefitIdentityConflictDiagnostic =
  (typeof BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS)[number];

export const BENEFIT_IDENTITY_CONFLICT_DETAIL_LIMIT = 24;
export const BENEFIT_IDENTITY_CONFLICT_CANDIDATE_LIMIT = 4;
const BENEFIT_IDENTITY_CONFLICT_TOTAL_LIMIT = 100;

export type BenefitIdentityConflictSourceRole =
  | "tracker"
  | "joined_catalog"
  | "catalog_enrollment_candidate";

export type BenefitIdentityConflictRelation = "same" | "different" | "unavailable";

export type ConflictDiagnosticField<T> =
  | { state: "observed"; value: T }
  | { state: "not_exposed" }
  | { state: "unrecognized" };

export type ConflictCatalogLayout = "ENROLLED" | "NOTENROLLED" | "LOGGEDIN" | "SUPP";

export interface BenefitIdentityConflictCandidateDetail {
  candidateIndex: number;
  sourceRole: BenefitIdentityConflictSourceRole;
  displayTitle: string | null;
  supportedCreditKey: string | null;
  supportedCreditFamily: string | null;
  category: ConflictDiagnosticField<string>;
  activityKind: ConflictDiagnosticField<ActivityKind>;
  enrollmentState: ConflictDiagnosticField<"enrolled" | "required" | "linking_required" | "not_required">;
  trackerState: ConflictDiagnosticField<"not_started" | "in_progress" | "earned" | "completed">;
  completionState: ConflictDiagnosticField<"complete" | "incomplete">;
  earnedOrUsed: ConflictDiagnosticField<QuantityV1>;
  targetOrLimit: ConflictDiagnosticField<QuantityV1>;
  remaining: ConflictDiagnosticField<QuantityV1>;
  period: ConflictDiagnosticField<string>;
  catalogLayout: ConflictDiagnosticField<ConflictCatalogLayout>;
  catalogEnrollable: ConflictDiagnosticField<boolean>;
}

export interface BenefitIdentityConflictDetail {
  conflictKey: string;
  category: BenefitIdentityConflictDiagnostic;
  reviewedCreditKeys: string[];
  reviewedCreditFamilies: string[];
  candidateCount: number;
  candidatesTruncated: boolean;
  candidates: BenefitIdentityConflictCandidateDetail[];
  relations: {
    sameJoinId: BenefitIdentityConflictRelation;
    period: BenefitIdentityConflictRelation;
    amount: BenefitIdentityConflictRelation;
    state: BenefitIdentityConflictRelation;
  };
}

export interface BenefitIdentityConflictDetailSet {
  details: BenefitIdentityConflictDetail[];
  totalCount: number;
  truncated: boolean;
}

export interface BenefitNormalizationResult {
  benefits: NormalizedBenefitObservationV3[];
  issueCodes: IssueCode[];
  conflictDiagnostics: BenefitIdentityConflictDiagnostic[];
  conflictDetails: BenefitIdentityConflictDetailSet;
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
      if (supplementaryRelationship === "SUPP") {
        // Nested supplementary cards are an understood policy exclusion. Do not
        // inspect their identity fields or let inherited product text turn them
        // into primary-card scan work.
        continue;
      }
      unknownVariantCount += 1;
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

function sourcePeriodField(tracker: BenefitTrackerResponseItem): ObservedField<SourcePeriodV2> {
  const start = tracker.periodStartDate;
  const end = tracker.periodEndDate;
  if (start == null && end == null) return notExposed();
  if (typeof start !== "string" || typeof end !== "string") return unrecognized("unknown_status");
  const parsed = sourcePeriodV2Schema.safeParse({
    kind: "calendar_date_range",
    startDate: start,
    endDate: end,
    timeZone: "UTC",
  });
  return parsed.success ? observed(parsed.data) : unrecognized("unknown_status");
}

function trackerStatusFields(statusValue: unknown, activityKind: ActivityKind, issues: Set<IssueCode>): {
  trackerState: NormalizedBenefitObservationV3["trackerState"];
  completionState: NormalizedBenefitObservationV3["completionState"];
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

function enrollmentField(catalog: CatalogBenefitResponseItem | undefined, issues: Set<IssueCode>): NormalizedBenefitObservationV3["enrollmentState"] {
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

function catalogTitle(catalog: CatalogBenefitResponseItem): string | null {
  return text(catalog.benefitShortTitle, 200)
    ?? text(catalog.benefitTitle, 200)
    ?? text(catalog.benefitName, 200);
}

function isIgnoredCatalogBenefit(catalog: CatalogBenefitResponseItem): boolean {
  return [catalog.benefitShortTitle, catalog.benefitTitle, catalog.benefitName]
    .some((candidate) => {
      const title = text(candidate, 200);
      return title !== null && isIgnoredAmexCatalogBenefitTitle(title);
    });
}

function creditFamily(creditKey: string): string {
  return creditKey.slice(creditKey.lastIndexOf(":") + 1);
}

function diagnosticField<T>(field: ObservedField<T>): ConflictDiagnosticField<T> {
  if (field.state === "observed") return { state: "observed", value: field.value };
  return { state: field.state };
}

function catalogLayoutField(catalog: CatalogBenefitResponseItem): ConflictDiagnosticField<ConflictCatalogLayout> {
  if (catalog.layoutType == null) return { state: "not_exposed" };
  const layout = exactString(catalog.layoutType)?.toUpperCase();
  if (layout === "ENROLLED" || layout === "NOTENROLLED" || layout === "LOGGEDIN" || layout === "SUPP") {
    return { state: "observed", value: layout };
  }
  return { state: "unrecognized" };
}

function catalogEnrollableField(catalog: CatalogBenefitResponseItem): ConflictDiagnosticField<boolean> {
  return typeof catalog.isEnrollable === "boolean"
    ? { state: "observed", value: catalog.isEnrollable }
    : { state: "not_exposed" };
}

interface ConflictCandidateDraft extends Omit<BenefitIdentityConflictCandidateDetail, "candidateIndex"> {
  joinId: string | null;
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

function orderedConflictDiagnostics(
  diagnostics: ReadonlySet<BenefitIdentityConflictDiagnostic>,
): BenefitIdentityConflictDiagnostic[] {
  return BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS.filter((diagnostic) => diagnostics.has(diagnostic));
}

const CONFLICT_SOURCE_ORDER: Record<BenefitIdentityConflictSourceRole, number> = {
  tracker: 0,
  joined_catalog: 1,
  catalog_enrollment_candidate: 2,
};

function candidateSafeValue(candidate: ConflictCandidateDraft): Omit<ConflictCandidateDraft, "joinId"> {
  const safe: Partial<ConflictCandidateDraft> = { ...candidate };
  delete safe.joinId;
  return safe as Omit<ConflictCandidateDraft, "joinId">;
}

function candidateSignature(candidate: ConflictCandidateDraft): string {
  return JSON.stringify(candidateSafeValue(candidate));
}

function compareCandidates(left: ConflictCandidateDraft, right: ConflictCandidateDraft): number {
  return CONFLICT_SOURCE_ORDER[left.sourceRole] - CONFLICT_SOURCE_ORDER[right.sourceRole]
    || (left.supportedCreditKey ?? "").localeCompare(right.supportedCreditKey ?? "")
    || (left.displayTitle ?? "").localeCompare(right.displayTitle ?? "")
    || candidateSignature(left).localeCompare(candidateSignature(right));
}

interface ConflictDraft {
  category: BenefitIdentityConflictDiagnostic;
  reviewedCreditKeys: Set<string>;
  candidates: Map<string, ConflictCandidateDraft>;
}

interface JoinIdEvidence {
  ids: Set<string>;
  unavailable: boolean;
}

type ConflictCandidatesByCreditKey = ReadonlyMap<string, ReadonlyMap<string, ConflictCandidateDraft>>;
type JoinIdEvidenceByCreditKey = ReadonlyMap<string, ReadonlyMap<string, JoinIdEvidence>>;

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && Array.from(left).every((item) => right.has(item));
}

function candidateFieldRelation(
  candidates: ConflictCandidateDraft[],
  selectors: Array<(candidate: ConflictCandidateDraft) => ConflictDiagnosticField<unknown>>,
): BenefitIdentityConflictRelation {
  if (candidates.length < 2) return "unavailable";
  let hasCompleteComparison = false;
  let hasIncompleteEvidence = false;
  for (const select of selectors) {
    const fields = candidates.map(select);
    const observedValues = fields.flatMap((field) => field.state === "observed" ? [field.value] : []);
    if (observedValues.length >= 2) {
      const serialized = observedValues.map((value) => JSON.stringify(value));
      if (new Set(serialized).size > 1) return "different";
    }
    if (observedValues.length === candidates.length) hasCompleteComparison = true;
    else if (observedValues.length > 0) hasIncompleteEvidence = true;
  }
  if (hasIncompleteEvidence) return "unavailable";
  return hasCompleteComparison ? "same" : "unavailable";
}

function stateRelation(candidates: ConflictCandidateDraft[]): BenefitIdentityConflictRelation {
  return candidateFieldRelation(candidates, [
    (candidate) => candidate.activityKind,
    (candidate) => candidate.enrollmentState,
    (candidate) => candidate.trackerState,
    (candidate) => candidate.completionState,
  ]);
}

function amountRelation(candidates: ConflictCandidateDraft[]): BenefitIdentityConflictRelation {
  return candidateFieldRelation(candidates, [
    (candidate) => candidate.earnedOrUsed,
    (candidate) => candidate.targetOrLimit,
    (candidate) => candidate.remaining,
  ]);
}

class ConflictDetailCollector {
  private readonly drafts: ConflictDraft[] = [];

  add(
    category: BenefitIdentityConflictDiagnostic,
    candidates: ConflictCandidateDraft[],
    explicitCreditKeys: string[] = [],
  ): void {
    const uniqueCandidates = new Map(candidates.map((candidate) => [candidateSignature(candidate), candidate]));
    const reviewedCreditKeys = new Set([
      ...explicitCreditKeys,
      ...candidates.flatMap((candidate) => candidate.supportedCreditKey ? [candidate.supportedCreditKey] : []),
    ]);
    const candidateSignatures = new Set(uniqueCandidates.keys());
    const existing = this.drafts.find((draft) =>
      draft.category === category
      && sameSet(draft.reviewedCreditKeys, reviewedCreditKeys)
      && Array.from(candidateSignatures).some((signature) => draft.candidates.has(signature)));
    if (existing) {
      uniqueCandidates.forEach((candidate, signature) => existing.candidates.set(signature, candidate));
      return;
    }
    this.drafts.push({ category, reviewedCreditKeys, candidates: uniqueCandidates });
  }

  finish(
    candidatesByCreditKey: ConflictCandidatesByCreditKey,
    joinIdEvidenceByCreditKey: JoinIdEvidenceByCreditKey,
  ): BenefitIdentityConflictDetailSet {
    const categoryOrder = new Map(BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS.map((category, index) => [category, index]));
    const drafts = [...this.drafts].sort((left, right) => {
      const leftKeys = Array.from(left.reviewedCreditKeys).sort().join("|");
      const rightKeys = Array.from(right.reviewedCreditKeys).sort().join("|");
      const leftCandidates = Array.from(left.candidates.values()).sort(compareCandidates).map(candidateSignature).join("|");
      const rightCandidates = Array.from(right.candidates.values()).sort(compareCandidates).map(candidateSignature).join("|");
      return (categoryOrder.get(left.category) ?? 0) - (categoryOrder.get(right.category) ?? 0)
        || leftKeys.localeCompare(rightKeys)
        || leftCandidates.localeCompare(rightCandidates);
    });
    const limitedTotal = Math.min(drafts.length, BENEFIT_IDENTITY_CONFLICT_TOTAL_LIMIT);
    const detailOrdinals = new Map<string, number>();
    const details = drafts.slice(0, BENEFIT_IDENTITY_CONFLICT_DETAIL_LIMIT).map((draft) => {
      const reviewedCreditKeys = Array.from(draft.reviewedCreditKeys).sort().slice(0, BENEFIT_IDENTITY_CONFLICT_CANDIDATE_LIMIT);
      const reviewedCreditFamilies = Array.from(new Set(reviewedCreditKeys.map(creditFamily))).sort();
      const ordinalKey = `${draft.category}:${reviewedCreditFamilies.join("+") || "unresolved"}`;
      const ordinal = (detailOrdinals.get(ordinalKey) ?? 0) + 1;
      detailOrdinals.set(ordinalKey, ordinal);
      const allCandidateMap = new Map(draft.candidates);
      const contextualRoles: ReadonlySet<BenefitIdentityConflictSourceRole> | null =
        draft.category === "tracker_state_collision"
          ? new Set<BenefitIdentityConflictSourceRole>(["tracker"])
          : draft.category === "tracker_catalog_candidate_collision"
            ? new Set<BenefitIdentityConflictSourceRole>(["tracker", "catalog_enrollment_candidate"])
            : null;
      if (contextualRoles) {
        reviewedCreditKeys.forEach((key) => {
          candidatesByCreditKey.get(key)?.forEach((candidate, signature) => {
            if (contextualRoles.has(candidate.sourceRole)) allCandidateMap.set(signature, candidate);
          });
        });
      }
      const allCandidates = Array.from(allCandidateMap.values()).sort(compareCandidates);
      const candidates = allCandidates.slice(0, BENEFIT_IDENTITY_CONFLICT_CANDIDATE_LIMIT);
      const directJoinIds = allCandidates.flatMap((candidate) => candidate.joinId === null ? [] : [candidate.joinId]);
      const contextualJoinEvidence = allCandidates.flatMap((candidate) => {
        if (!candidate.supportedCreditKey) return [];
        const evidence = joinIdEvidenceByCreditKey
          .get(candidate.supportedCreditKey)
          ?.get(candidateSignature(candidate));
        return evidence ? [evidence] : [];
      });
      const joinIds = new Set([
        ...directJoinIds,
        ...contextualJoinEvidence.flatMap((evidence) => Array.from(evidence.ids)),
      ]);
      const sameJoinId: BenefitIdentityConflictRelation = allCandidates.length < 2
        || allCandidates.some((candidate) => candidate.joinId === null)
        || contextualJoinEvidence.some((evidence) => evidence.unavailable)
        ? "unavailable"
        : joinIds.size === 1 ? "same" : "different";
      return {
        conflictKey: `${ordinalKey}:${String(ordinal).padStart(2, "0")}`,
        category: draft.category,
        reviewedCreditKeys,
        reviewedCreditFamilies,
        candidateCount: Math.min(allCandidates.length, BENEFIT_IDENTITY_CONFLICT_TOTAL_LIMIT),
        candidatesTruncated: allCandidates.length > BENEFIT_IDENTITY_CONFLICT_CANDIDATE_LIMIT,
        candidates: candidates.map((candidate, index) => ({
          candidateIndex: index + 1,
          ...candidateSafeValue(candidate),
        })),
        relations: {
          sameJoinId,
          period: candidateFieldRelation(allCandidates, [(candidate) => candidate.period]),
          amount: amountRelation(allCandidates),
          state: stateRelation(allCandidates),
        },
      };
    });
    return {
      details,
      totalCount: limitedTotal,
      truncated: drafts.length > BENEFIT_IDENTITY_CONFLICT_DETAIL_LIMIT,
    };
  }
}

function v3TrackerDiagnosticCandidate(
  benefit: NormalizedBenefitObservationV3,
): ConflictCandidateDraft {
  return {
    sourceRole: "tracker",
    displayTitle: benefit.title,
    supportedCreditKey: null,
    supportedCreditFamily: null,
    category: diagnosticField(benefit.category),
    activityKind: { state: "observed", value: benefit.activityKind },
    enrollmentState: diagnosticField(benefit.enrollmentState),
    trackerState: diagnosticField(benefit.trackerState),
    completionState: diagnosticField(benefit.completionState),
    earnedOrUsed: diagnosticField(benefit.earnedOrUsed),
    targetOrLimit: diagnosticField(benefit.targetOrLimit),
    remaining: diagnosticField(benefit.remaining),
    period: diagnosticField(benefit.period),
    catalogLayout: { state: "not_exposed" },
    catalogEnrollable: { state: "not_exposed" },
    joinId: null,
  };
}

function v3CatalogDiagnosticCandidate(catalog: CatalogBenefitResponseItem): ConflictCandidateDraft {
  return {
    sourceRole: "joined_catalog",
    displayTitle: catalogTitle(catalog),
    supportedCreditKey: null,
    supportedCreditFamily: null,
    category: { state: "not_exposed" },
    activityKind: { state: "not_exposed" },
    enrollmentState: { state: "not_exposed" },
    trackerState: { state: "not_exposed" },
    completionState: { state: "not_exposed" },
    earnedOrUsed: { state: "not_exposed" },
    targetOrLimit: { state: "not_exposed" },
    remaining: { state: "not_exposed" },
    period: { state: "not_exposed" },
    catalogLayout: catalogLayoutField(catalog),
    catalogEnrollable: catalogEnrollableField(catalog),
    joinId: null,
  };
}

function sameV3Observation(
  left: NormalizedBenefitObservationV3,
  right: NormalizedBenefitObservationV3,
): boolean {
  return JSON.stringify({ ...left, title: undefined, benefitKey: undefined })
    === JSON.stringify({ ...right, title: undefined, benefitKey: undefined });
}

export function normalizeBenefits(input: {
  productName: string;
  trackerResponse: TrackerResponse;
  catalogResponse: CatalogResponse;
}): BenefitNormalizationResult {
  const issues = new Set<IssueCode>();
  const conflictDiagnostics = new Set<BenefitIdentityConflictDiagnostic>();
  const conflictDetailCollector = new ConflictDetailCollector();
  const selectedCatalogs = Object.values(input.catalogResponse.benefits)
    .filter((catalog) => !isIgnoredCatalogBenefit(catalog));
  const catalogsByIssuerId = new Map<string, CatalogBenefitResponseItem[]>();
  for (const catalog of selectedCatalogs) {
    const issuerId = exactString(catalog.sorBenefitId);
    if (!issuerId) continue;
    const group = catalogsByIssuerId.get(issuerId) ?? [];
    if (!group.some((existing) => sameCatalogObservation(existing, catalog))) group.push(catalog);
    catalogsByIssuerId.set(issuerId, group);
  }

  const normalized = new Map<string, NormalizedBenefitObservationV3>();
  for (const block of input.trackerResponse) {
    for (const tracker of block.trackers) {
      const normalizedCategory = exactString(tracker.category)?.toLocaleLowerCase("en-US") ?? null;
      if (normalizedCategory !== "usage") continue;
      const title = text(tracker.benefitName, 200);
      if (!title || !isEligibleLocalAmexUsageTitle(title)) continue;

      const itemIssues = new Set<IssueCode>();
      const issuerId = exactString(tracker.sorBenefitId);
      const catalogGroup = issuerId ? catalogsByIssuerId.get(issuerId) ?? [] : [];
      const ambiguousCatalog = catalogGroup.length > 1;
      if (ambiguousCatalog) {
        itemIssues.add("benefit_identity_conflict");
        issues.add("benefit_identity_conflict");
        conflictDiagnostics.add("ambiguous_catalog_join");
      }
      const category = observed("usage");
      const activityKind: ActivityKind = exactString(tracker.status)?.toUpperCase() === "ACHIEVED"
        ? "completed"
        : "credit_usage";
      const statusFields = trackerStatusFields(tracker.status, activityKind, itemIssues);
      const period = periodField(tracker);
      if (period.state === "unrecognized") itemIssues.add(period.issueCode);
      const sourcePeriod = sourcePeriodField(tracker);
      if (sourcePeriod.state === "unrecognized") itemIssues.add(sourcePeriod.issueCode);
      const benefit = normalizedBenefitObservationV3Schema.parse({
        benefitKey: benefitKey(title, category, "credit_usage"),
        sourcePeriod,
        title,
        category,
        activityKind,
        enrollmentState: enrollmentField(ambiguousCatalog ? undefined : catalogGroup[0], itemIssues),
        trackerState: statusFields.trackerState,
        completionState: statusFields.completionState,
        earnedOrUsed: quantityField(tracker.tracker?.spentAmount, tracker.tracker, itemIssues),
        targetOrLimit: quantityField(tracker.tracker?.targetAmount, tracker.tracker, itemIssues),
        remaining: quantityField(tracker.tracker?.remainingAmount, tracker.tracker, itemIssues),
        period,
        confidence: itemIssues.size === 0 ? "high" : "medium",
        issueCodes: Array.from(itemIssues).sort(),
      });

      if (ambiguousCatalog) {
        conflictDetailCollector.add("ambiguous_catalog_join", [
          v3TrackerDiagnosticCandidate(benefit),
          ...catalogGroup.map(v3CatalogDiagnosticCandidate),
        ]);
      }

      const existing = normalized.get(benefit.benefitKey);
      if (!existing) {
        normalized.set(benefit.benefitKey, benefit);
      } else {
        if (!sameV3Observation(existing, benefit)) {
          issues.add("benefit_identity_conflict");
          conflictDiagnostics.add("tracker_state_collision");
          conflictDetailCollector.add("tracker_state_collision", [
            v3TrackerDiagnosticCandidate(existing),
            v3TrackerDiagnosticCandidate(benefit),
          ]);
        }
        // Equivalent display variants share a normalized local key. Choose one
        // deterministically so provider response order cannot change storage.
        if (JSON.stringify(benefit) < JSON.stringify(existing)) {
          normalized.set(benefit.benefitKey, benefit);
        }
      }
      itemIssues.forEach((issue) => issues.add(issue));
    }
  }

  return {
    benefits: Array.from(normalized.values()).sort((left, right) =>
      left.title.localeCompare(right.title) || left.benefitKey.localeCompare(right.benefitKey)),
    issueCodes: Array.from(issues).sort(),
    conflictDiagnostics: orderedConflictDiagnostics(conflictDiagnostics),
    conflictDetails: conflictDetailCollector.finish(new Map(), new Map()),
  };
}
