import type {
  BenefitTrackerResponseItem,
  CatalogBenefitResponseItem,
  CatalogResponse,
  MemberResponse,
  TrackerResponse,
} from "./amex-api-contract";
import {
  normalizedBenefitObservationV2Schema,
  sourcePeriodV2Schema,
  type ActivityKind,
  type IssueCode,
  type NormalizedBenefitObservationV2,
  type ObservedField,
  type QuantityV1,
  type SourcePeriodV2,
} from "./contract";
import { createBenefitKey } from "./identity";
import {
  isIgnoredAmexCatalogBenefitTitle,
  isSupportedAmexCatalogCard,
  matchSupportedAmexCardCredit,
  type SupportedAmexCardCreditMatch,
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
  benefits: NormalizedBenefitObservationV2[];
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
  trackerState: NormalizedBenefitObservationV2["trackerState"];
  completionState: NormalizedBenefitObservationV2["completionState"];
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

function enrollmentField(catalog: CatalogBenefitResponseItem | undefined, issues: Set<IssueCode>): NormalizedBenefitObservationV2["enrollmentState"] {
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

function isQualifyingSpendTracker(tracker: BenefitTrackerResponseItem): boolean {
  return exactString(tracker.category)?.toLocaleLowerCase("en-US") === "spend";
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

function trackerDiagnosticCandidate(
  tracker: BenefitTrackerResponseItem,
  title: string,
  match: SupportedAmexCardCreditMatch,
): ConflictCandidateDraft {
  const candidateIssues = new Set<IssueCode>();
  const activityKind = activityKindForTracker(tracker, candidateIssues);
  const statusFields = activityKind
    ? trackerStatusFields(tracker.status, activityKind, candidateIssues)
    : tracker.status == null
      ? { trackerState: notExposed<"not_started" | "in_progress" | "earned" | "completed">(), completionState: notExposed<"complete" | "incomplete">() }
      : { trackerState: unrecognized<"not_started" | "in_progress" | "earned" | "completed">("unknown_status"), completionState: unrecognized<"complete" | "incomplete">("unknown_status") };
  const category = categoryField(tracker.category);
  return {
    sourceRole: "tracker",
    displayTitle: title,
    supportedCreditKey: match.creditKey,
    supportedCreditFamily: creditFamily(match.creditKey),
    category: diagnosticField(category),
    activityKind: activityKind ? { state: "observed", value: activityKind } : tracker.status == null && tracker.category == null ? { state: "not_exposed" } : { state: "unrecognized" },
    enrollmentState: { state: "not_exposed" },
    trackerState: diagnosticField(statusFields.trackerState),
    completionState: diagnosticField(statusFields.completionState),
    earnedOrUsed: diagnosticField(quantityField(tracker.tracker?.spentAmount, tracker.tracker, candidateIssues)),
    targetOrLimit: diagnosticField(quantityField(tracker.tracker?.targetAmount, tracker.tracker, candidateIssues)),
    remaining: diagnosticField(quantityField(tracker.tracker?.remainingAmount, tracker.tracker, candidateIssues)),
    period: diagnosticField(periodField(tracker)),
    catalogLayout: { state: "not_exposed" },
    catalogEnrollable: { state: "not_exposed" },
    joinId: exactString(tracker.sorBenefitId),
  };
}

function catalogDiagnosticCandidate(
  productName: string,
  catalog: CatalogBenefitResponseItem,
  sourceRole: "joined_catalog" | "catalog_enrollment_candidate",
): ConflictCandidateDraft {
  const title = catalogTitle(catalog);
  const match = title ? matchSupportedAmexCardCredit(productName, title) : null;
  const candidateIssues = new Set<IssueCode>();
  return {
    sourceRole,
    displayTitle: title,
    supportedCreditKey: match?.creditKey ?? null,
    supportedCreditFamily: match ? creditFamily(match.creditKey) : null,
    category: { state: "not_exposed" },
    activityKind: sourceRole === "catalog_enrollment_candidate"
      ? { state: "observed", value: "enrollment_candidate" }
      : { state: "not_exposed" },
    enrollmentState: diagnosticField(enrollmentField(catalog, candidateIssues)),
    trackerState: { state: "not_exposed" },
    completionState: { state: "not_exposed" },
    earnedOrUsed: { state: "not_exposed" },
    targetOrLimit: { state: "not_exposed" },
    remaining: { state: "not_exposed" },
    period: { state: "not_exposed" },
    catalogLayout: catalogLayoutField(catalog),
    catalogEnrollable: catalogEnrollableField(catalog),
    joinId: exactString(catalog.sorBenefitId),
  };
}

function normalizedDiagnosticCandidate(
  sourceRole: "tracker" | "catalog_enrollment_candidate",
  benefit: NormalizedBenefitObservationV2,
  supportedCreditKey: string,
  joinId: string | null,
): ConflictCandidateDraft {
  return {
    sourceRole,
    displayTitle: benefit.title,
    supportedCreditKey,
    supportedCreditFamily: creditFamily(supportedCreditKey),
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
    joinId,
  };
}

interface SupportedTrackerTitle {
  kind: "supported";
  title: string;
  match: SupportedAmexCardCreditMatch;
  catalog: CatalogBenefitResponseItem | undefined;
}

interface ConflictingSupportedTrackerTitle {
  kind: "conflict";
  trackerTitle: string;
  trackerMatch: SupportedAmexCardCreditMatch;
  catalogTitle: string;
  catalogMatch: SupportedAmexCardCreditMatch;
  catalog: CatalogBenefitResponseItem;
}

function supportedTrackerTitle(
  productName: string,
  tracker: BenefitTrackerResponseItem,
  catalog: CatalogBenefitResponseItem | undefined,
): SupportedTrackerTitle | ConflictingSupportedTrackerTitle | null {
  const trackerTitle = text(tracker.benefitName, 200);
  const catalogBenefitTitle = catalog ? catalogTitle(catalog) : null;
  const trackerMatch = trackerTitle ? matchSupportedAmexCardCredit(productName, trackerTitle) : null;
  const catalogMatch = catalogBenefitTitle
    ? matchSupportedAmexCardCredit(productName, catalogBenefitTitle)
    : null;
  if (
    trackerMatch
    && trackerTitle
    && catalogMatch
    && catalogBenefitTitle
    && catalog
    && trackerMatch.creditKey !== catalogMatch.creditKey
  ) {
    return {
      kind: "conflict",
      trackerTitle,
      trackerMatch,
      catalogTitle: catalogBenefitTitle,
      catalogMatch,
      catalog,
    };
  }
  if (catalogMatch && catalogBenefitTitle) {
    return { kind: "supported", title: catalogBenefitTitle, match: catalogMatch, catalog };
  }
  if (trackerMatch && trackerTitle) {
    return { kind: "supported", title: trackerTitle, match: trackerMatch, catalog: undefined };
  }
  return null;
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

function supportedCreditState(benefit: NormalizedBenefitObservationV2): unknown {
  return {
    category: benefit.category,
    activityKind: benefit.activityKind,
    enrollmentState: benefit.enrollmentState,
    trackerState: benefit.trackerState,
    completionState: benefit.completionState,
    earnedOrUsed: benefit.earnedOrUsed,
    targetOrLimit: benefit.targetOrLimit,
    remaining: benefit.remaining,
    period: benefit.period,
    creditFamilyKey: benefit.creditFamilyKey,
    sourcePeriod: benefit.sourcePeriod,
    confidence: benefit.confidence,
    issueCodes: benefit.issueCodes,
  };
}

function sameSupportedCreditObservation(
  left: NormalizedBenefitObservationV2,
  right: NormalizedBenefitObservationV2,
): boolean {
  return JSON.stringify(supportedCreditState(left)) === JSON.stringify(supportedCreditState(right));
}

type SupportedCreditCandidateSource = "tracker" | "catalog_candidate";

interface SupportedCreditCandidate {
  benefit: NormalizedBenefitObservationV2;
  source: SupportedCreditCandidateSource;
  diagnosticCandidate: ConflictCandidateDraft;
}

function collisionDiagnostic(
  left: SupportedCreditCandidateSource,
  right: SupportedCreditCandidateSource,
): BenefitIdentityConflictDiagnostic {
  if (left === "tracker" && right === "tracker") return "tracker_state_collision";
  if (left !== right) return "tracker_catalog_candidate_collision";
  return "ambiguous_catalog_join";
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

function recordCandidateEvidence(
  candidatesByCreditKey: Map<string, Map<string, ConflictCandidateDraft>>,
  joinIdEvidenceByCreditKey: Map<string, Map<string, JoinIdEvidence>>,
  supportedCreditKey: string,
  candidate: ConflictCandidateDraft,
): void {
  const signature = candidateSignature(candidate);
  const candidates = candidatesByCreditKey.get(supportedCreditKey) ?? new Map<string, ConflictCandidateDraft>();
  if (!candidates.has(signature)) candidates.set(signature, candidate);
  candidatesByCreditKey.set(supportedCreditKey, candidates);

  const evidenceBySignature = joinIdEvidenceByCreditKey.get(supportedCreditKey)
    ?? new Map<string, JoinIdEvidence>();
  const evidence = evidenceBySignature.get(signature) ?? {
    ids: new Set<string>(),
    unavailable: false,
  };
  if (candidate.joinId === null) evidence.unavailable = true;
  else evidence.ids.add(candidate.joinId);
  evidenceBySignature.set(signature, evidence);
  joinIdEvidenceByCreditKey.set(supportedCreditKey, evidenceBySignature);
}

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

function emptyConflictDetails(): BenefitIdentityConflictDetailSet {
  return { details: [], totalCount: 0, truncated: false };
}

export function normalizeBenefits(input: {
  productName: string;
  trackerResponse: TrackerResponse;
  catalogResponse: CatalogResponse;
}): BenefitNormalizationResult {
  const { productName, trackerResponse, catalogResponse } = input;
  if (!isSupportedAmexCatalogCard(productName)) {
    return { benefits: [], issueCodes: [], conflictDiagnostics: [], conflictDetails: emptyConflictDetails() };
  }

  const issues = new Set<IssueCode>();
  const conflictDiagnostics = new Set<BenefitIdentityConflictDiagnostic>();
  const conflictDetailCollector = new ConflictDetailCollector();
  const conflictCandidatesByCreditKey = new Map<string, Map<string, ConflictCandidateDraft>>();
  const joinIdEvidenceByCreditKey = new Map<string, Map<string, JoinIdEvidence>>();
  const catalogByIssuerId = new Map<string, CatalogBenefitResponseItem>();
  const catalogsByIssuerId = new Map<string, CatalogBenefitResponseItem[]>();
  const ambiguousCatalogIds = new Set<string>();
  const selectedCatalogs = Object.values(catalogResponse.benefits)
    .filter((catalog) => !isIgnoredCatalogBenefit(catalog));
  for (const catalog of selectedCatalogs) {
    const issuerId = exactString(catalog.sorBenefitId);
    if (!issuerId) continue;
    const group = catalogsByIssuerId.get(issuerId) ?? [];
    if (!group.some((existing) => sameCatalogObservation(existing, catalog))) group.push(catalog);
    catalogsByIssuerId.set(issuerId, group);
  }
  catalogsByIssuerId.forEach((catalogs, issuerId) => {
    if (catalogs.length === 1) catalogByIssuerId.set(issuerId, catalogs[0]);
    else ambiguousCatalogIds.add(issuerId);
  });

  const normalized = new Map<string, SupportedCreditCandidate>();
  const add = (
    supportedCreditKey: string,
    benefit: NormalizedBenefitObservationV2,
    source: SupportedCreditCandidateSource,
    joinId: string | null,
    diagnosticOverride?: ConflictCandidateDraft,
  ): void => {
    const validated = normalizedBenefitObservationV2Schema.parse(benefit);
    const diagnosticCandidate = diagnosticOverride ?? normalizedDiagnosticCandidate(
      source === "tracker" ? "tracker" : "catalog_enrollment_candidate",
      validated,
      supportedCreditKey,
      joinId,
    );
    recordCandidateEvidence(
      conflictCandidatesByCreditKey,
      joinIdEvidenceByCreditKey,
      supportedCreditKey,
      diagnosticCandidate,
    );
    const existing = normalized.get(supportedCreditKey);
    if (!existing) {
      normalized.set(supportedCreditKey, { benefit: validated, source, diagnosticCandidate });
      return;
    }
    if (!sameSupportedCreditObservation(existing.benefit, validated)) {
      const diagnostic = collisionDiagnostic(existing.source, source);
      issues.add("benefit_identity_conflict");
      conflictDiagnostics.add(diagnostic);
      conflictDetailCollector.add(diagnostic, [existing.diagnosticCandidate, diagnosticCandidate], [supportedCreditKey]);
    }
  };

  for (const block of trackerResponse) {
    for (const tracker of block.trackers) {
      if (isQualifyingSpendTracker(tracker)) continue;
      const issuerId = exactString(tracker.sorBenefitId);
      const catalog = issuerId && !ambiguousCatalogIds.has(issuerId)
        ? catalogByIssuerId.get(issuerId)
        : undefined;
      const supported = supportedTrackerTitle(productName, tracker, catalog);
      if (!supported) continue;
      if (supported.kind === "conflict") {
        issues.add("benefit_identity_conflict");
        conflictDiagnostics.add("tracker_catalog_key_mismatch");
        conflictDetailCollector.add("tracker_catalog_key_mismatch", [
          trackerDiagnosticCandidate(tracker, supported.trackerTitle, supported.trackerMatch),
          catalogDiagnosticCandidate(productName, supported.catalog, "joined_catalog"),
        ], [supported.trackerMatch.creditKey, supported.catalogMatch.creditKey]);
        continue;
      }

      const itemIssues = new Set<IssueCode>();
      if (issuerId && ambiguousCatalogIds.has(issuerId)) {
        itemIssues.add("benefit_identity_conflict");
        conflictDiagnostics.add("ambiguous_catalog_join");
        conflictDetailCollector.add("ambiguous_catalog_join", [
          trackerDiagnosticCandidate(tracker, supported.title, supported.match),
          ...(catalogsByIssuerId.get(issuerId) ?? []).map((candidate) =>
            catalogDiagnosticCandidate(productName, candidate, "joined_catalog")),
        ], [supported.match.creditKey]);
      }
      const activityKind = activityKindForTracker(tracker, itemIssues);
      if (!activityKind) {
        itemIssues.forEach((issue) => issues.add(issue));
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
      const sourcePeriod = sourcePeriodField(tracker);
      if (sourcePeriod.state === "unrecognized") itemIssues.add(sourcePeriod.issueCode);
      const enrollmentState = enrollmentField(supported.catalog, itemIssues);
      const benefit: NormalizedBenefitObservationV2 = {
        benefitKey: benefitKey(supported.title, category, activityKind),
        creditFamilyKey: supported.match.creditKey,
        sourcePeriod,
        title: supported.title,
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
      add(supported.match.creditKey, benefit, "tracker", issuerId);
      itemIssues.forEach((issue) => issues.add(issue));
    }
  }

  for (const catalog of selectedCatalogs) {
    const title = catalogTitle(catalog);
    const supported = title ? matchSupportedAmexCardCredit(productName, title) : null;
    if (!title || !supported) continue;

    const issuerId = exactString(catalog.sorBenefitId);
    if (issuerId && ambiguousCatalogIds.has(issuerId)) {
      issues.add("benefit_identity_conflict");
      conflictDiagnostics.add("ambiguous_catalog_join");
      conflictDetailCollector.add(
        "ambiguous_catalog_join",
        (catalogsByIssuerId.get(issuerId) ?? []).map((candidate) =>
          catalogDiagnosticCandidate(productName, candidate, "joined_catalog")),
        [supported.creditKey],
      );
      continue;
    }
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
    const category = notExposed<string>();
    add(supported.creditKey, {
      benefitKey: benefitKey(title, category, "enrollment_candidate"),
      creditFamilyKey: supported.creditKey,
      sourcePeriod: notExposed(),
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
    }, "catalog_candidate", issuerId, catalogDiagnosticCandidate(productName, catalog, "catalog_enrollment_candidate"));
  }

  return {
    benefits: Array.from(normalized.values(), (candidate) => candidate.benefit),
    issueCodes: Array.from(issues),
    conflictDiagnostics: orderedConflictDiagnostics(conflictDiagnostics),
    conflictDetails: conflictDetailCollector.finish(
      conflictCandidatesByCreditKey,
      joinIdEvidenceByCreditKey,
    ),
  };
}
