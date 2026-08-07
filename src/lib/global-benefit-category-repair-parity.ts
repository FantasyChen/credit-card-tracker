import {
  categoryRepairManifestEntryFingerprint,
  categoryRepairPageFingerprint,
  encodeGlobalBenefitCategoryRepairCursor,
  normalizeCategoryRepairSiblingEffects,
  planGlobalBenefitCategoryRepairUnit,
  validateGlobalBenefitCategoryRepairManifest,
  type CategoryRepairBatchSnapshot,
  type CategoryRepairManifestEntry,
  type CategoryRepairProposal,
  type CategoryRepairReviewedAuthorityContext,
  type CategoryRepairStatusAction,
  type CategoryRepairUnitSnapshot,
  type GlobalBenefitCategoryRepairManifest,
} from "./global-benefit-category-repair";
import { migrationFingerprint } from "./global-benefit-migration";

// The page selector is part of the private baseline authority. Bump the
// version so a baseline captured by the previous global-only shape cannot be
// mistaken for this scoped shape.
export const GLOBAL_BENEFIT_CATEGORY_REPAIR_PARITY_BASELINE_VERSION = 2 as const;

export type GlobalBenefitCategoryRepairParityMode = "capture" | "verify";

export type CategoryRepairParityStopReason =
  | "target_not_verified"
  | "baseline_invalid"
  | "manifest_invalid"
  | "manifest_drift"
  | "inventory_drift"
  | "unit_missing"
  | "unit_unexpected"
  | "manifest_coverage_missing"
  | "blocked_unit_changed"
  | "repair_evidence_missing"
  | "repair_evidence_invalid"
  | "keeper_state_changed"
  | "loser_not_removed"
  | "canonical_authority_invalid"
  | "duplicate_effective_authority"
  | "allowed_delta_mismatch"
  | "unrelated_rows_changed"
  | "aggregate_mismatch";

export interface CategoryRepairParityTableCounts {
  users: number;
  cards: number;
  benefits: number;
  predefinedCards: number;
  predefinedBenefits: number;
  statuses: number;
  audits: number;
  provenance: number;
  ledgers: number;
  repairs: number;
  occurrences: number;
}

export interface CategoryRepairParityAggregateState {
  counts: CategoryRepairParityTableCounts;
  /** Digest over rows outside the manifest-scoped graph. */
  unrelatedRowsDigest: string;
}

export interface CategoryRepairParityScope {
  sourceBenefitIds: readonly string[];
  ownerIds: readonly string[];
  cardIds: readonly string[];
  predefinedCardIds: readonly string[];
  predefinedBenefitIds: readonly string[];
  statusIds: readonly string[];
  auditIds: readonly string[];
  provenanceIds: readonly string[];
  ledgerIds: readonly string[];
  /** Existing parent evidence IDs are optional because pre-apply baselines have none. */
  repairIds?: readonly string[];
}

/**
 * A page selector is bound to the complete, ordered manifest bundle by its
 * index and both page fingerprints.  It deliberately carries no path or row
 * authority; the CLI resolves the private path to this value only after all
 * manifests have been validated.
 */
export interface CategoryRepairParityManifestScope {
  pageIndex: number;
  pageFingerprint: string;
  manifestFingerprint: string;
}

export interface CategoryRepairParityDatabase {
  readParitySnapshot(input: {
    targetVerified?: boolean;
    manifests: readonly GlobalBenefitCategoryRepairManifest[];
    scope: CategoryRepairParityScope | null;
    manifestScope?: CategoryRepairParityManifestScope | null;
  }): Promise<{
    snapshot: CategoryRepairBatchSnapshot;
    aggregate: CategoryRepairParityAggregateState;
  }>;
}

interface CategoryRepairParityUnitBaseline {
  privateKey: string;
  unit: CategoryRepairUnitSnapshot;
  proposal: CategoryRepairProposal;
}

export interface GlobalBenefitCategoryRepairParityManifestBundle {
  pages: GlobalBenefitCategoryRepairManifest[];
  inventoryFingerprint: string;
  bundleFingerprint: string;
}

export interface GlobalBenefitCategoryRepairParityBaseline {
  version: typeof GLOBAL_BENEFIT_CATEGORY_REPAIR_PARITY_BASELINE_VERSION;
  inventoryFingerprint: string;
  bundleFingerprint: string;
  scope: CategoryRepairParityManifestScope | null;
  manifests: GlobalBenefitCategoryRepairManifest[];
  units: CategoryRepairParityUnitBaseline[];
  aggregate: CategoryRepairParityAggregateState;
  baselineFingerprint: string;
}

export interface CategoryRepairParityCounts {
  definitionsExamined: number;
  manifestEntries: number;
  eligible: number;
  blocked: number;
  appliedValid: number;
  unchanged: number;
  idempotent: number;
  expectedRemovedStatuses: number;
  expectedAddedRepairs: number;
  expectedAddedOccurrences: number;
}

export interface CategoryRepairParityReport {
  mode: GlobalBenefitCategoryRepairParityMode;
  gates: {
    targetVerified: boolean;
    baselineValid: boolean;
    manifestCoverage: boolean;
    repairAuthority: boolean;
    protectedState: boolean;
    allowedDelta: boolean;
    unrelatedRows: boolean;
  };
  counts: CategoryRepairParityCounts;
  actions: {
    expectedRemovedStatuses: number;
    observedRemovedStatuses: number;
    expectedAddedRepairs: number;
    observedAddedRepairs: number;
    expectedAddedOccurrences: number;
    observedAddedOccurrences: number;
  };
  stops: Partial<Record<CategoryRepairParityStopReason, number>>;
}

export type CategoryRepairParityAggregateReport = Pick<
  CategoryRepairParityReport,
  "mode" | "gates" | "counts" | "actions" | "stops"
>;

export class GlobalBenefitCategoryRepairParityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlobalBenefitCategoryRepairParityError";
  }
}

/**
 * A post-read gate mismatch is a valid aggregate outcome, not an unavailable
 * diagnostic. Keep only the already-closed report so callers can serialize
 * counts/gates/actions/stops without retaining private authority or row data.
 */
export class GlobalBenefitCategoryRepairParityVerificationError extends GlobalBenefitCategoryRepairParityError {
  readonly report: CategoryRepairParityAggregateReport;

  constructor(report: CategoryRepairParityAggregateReport) {
    super("Category-repair parity verification failed safely.");
    this.name = "GlobalBenefitCategoryRepairParityVerificationError";
    this.report = report;
  }
}

const HEX_SHA256 = /^[a-f0-9]{64}$/;

const TABLE_COUNT_KEYS: readonly (keyof CategoryRepairParityTableCounts)[] = [
  "users", "cards", "benefits", "predefinedCards", "predefinedBenefits", "statuses",
  "audits", "provenance", "ledgers", "repairs", "occurrences",
];

const UNIT_KEYS = ["privateKey", "unit", "proposal"] as const;
const BASELINE_KEYS = [
  "version", "inventoryFingerprint", "bundleFingerprint", "scope", "manifests", "units", "aggregate",
  "baselineFingerprint",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function increment(
  target: Partial<Record<CategoryRepairParityStopReason, number>>,
  key: CategoryRepairParityStopReason,
): void {
  target[key] = (target[key] ?? 0) + 1;
}

function safeDate(value: unknown): Date {
  if (!(value instanceof Date) && typeof value !== "string") {
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
  }
  return date;
}

function hydrateStatusDates(status: Record<string, unknown>): void {
  for (const key of ["cycleStartDate", "cycleEndDate", "createdAt", "updatedAt"] as const) {
    status[key] = safeDate(status[key]);
  }
  status.completedAt = status.completedAt === null ? null : safeDate(status.completedAt);
}

function hydrateUnit(value: unknown): CategoryRepairUnitSnapshot {
  if (!isPlainObject(value)
    || !exactKeys(value, [
      "privateKey", "card", "source", "predefinedCard", "destinationStatuses",
      "cardStrictCustomSources", "repairEvidence",
    ])) throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
  const unit = JSON.parse(JSON.stringify(value)) as CategoryRepairUnitSnapshot;
  const source = unit.source as unknown as Record<string, unknown>;
  for (const status of source.statuses as unknown as Record<string, unknown>[]) hydrateStatusDates(status);
  for (const status of unit.destinationStatuses as unknown as Record<string, unknown>[]) hydrateStatusDates(status);
  for (const candidate of unit.cardStrictCustomSources) {
    for (const status of candidate.statuses as unknown as Record<string, unknown>[]) hydrateStatusDates(status);
  }
  if (unit.predefinedCard.retiredAt !== null) unit.predefinedCard.retiredAt = safeDate(unit.predefinedCard.retiredAt);
  for (const benefit of unit.predefinedCard.benefits) {
    if (benefit.retiredAt !== null) benefit.retiredAt = safeDate(benefit.retiredAt);
  }
  if (typeof unit.privateKey !== "string" || unit.privateKey.length === 0) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
  }
  return unit;
}

function validateAggregate(value: unknown): CategoryRepairParityAggregateState {
  if (!isPlainObject(value) || !exactKeys(value, ["counts", "unrelatedRowsDigest"])
    || typeof value.unrelatedRowsDigest !== "string" || !HEX_SHA256.test(value.unrelatedRowsDigest)
    || !isPlainObject(value.counts) || !exactKeys(value.counts, TABLE_COUNT_KEYS)) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
  }
  const counts = {} as CategoryRepairParityTableCounts;
  for (const key of TABLE_COUNT_KEYS) {
    const count = value.counts[key];
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
    }
    counts[key] = count;
  }
  return { counts, unrelatedRowsDigest: value.unrelatedRowsDigest };
}

function baselineFingerprintBody(value: Omit<GlobalBenefitCategoryRepairParityBaseline, "baselineFingerprint">): unknown {
  return {
    version: value.version,
    inventoryFingerprint: value.inventoryFingerprint,
    bundleFingerprint: value.bundleFingerprint,
    scope: value.scope,
    manifests: value.manifests,
    units: value.units,
    aggregate: value.aggregate,
  };
}

function unitScope(
  units: readonly CategoryRepairParityUnitBaseline[],
  includeSiblingSources = true,
): CategoryRepairParityScope {
  const unique = (values: readonly string[]) => Array.from(new Set(values)).sort();
  const selectedSources = units.map(({ unit }) => unit.source);
  const graphSources = includeSiblingSources
    ? units.flatMap(({ unit }) => unit.cardStrictCustomSources)
    : selectedSources;
  const statuses = graphSources.flatMap((source) => source.statuses)
    .concat(units.flatMap(({ unit }) => unit.destinationStatuses));
  const audits = graphSources.flatMap((source) => [
    ...source.audits,
    ...source.statuses.flatMap((status) => status.audits),
  ]).concat(units.flatMap(({ unit }) => [
    ...unit.source.audits,
    ...unit.destinationStatuses.flatMap((status) => status.audits),
  ]));
  const provenance = graphSources.flatMap((source) => [
    ...source.provenance,
    ...source.statuses.flatMap((status) => status.provenance),
  ]).concat(units.flatMap(({ unit }) => [
    ...unit.source.provenance,
    ...unit.destinationStatuses.flatMap((status) => status.provenance),
  ]));
  return {
    sourceBenefitIds: unique(graphSources.map((source) => source.id)),
    ownerIds: unique(units.map(({ unit }) => unit.card.userId)),
    cardIds: unique(units.map(({ unit }) => unit.card.id)),
    predefinedCardIds: unique(units.map(({ unit }) => unit.predefinedCard.id)),
    predefinedBenefitIds: unique(units.flatMap(({ unit }) => unit.predefinedCard.benefits.map((benefit) => benefit.id))),
    statusIds: unique(statuses.map((status) => status.id)),
    auditIds: unique(audits.map((audit) => audit.id)),
    provenanceIds: unique(provenance.map((row) => row.id)),
    ledgerIds: unique(graphSources.map((source) => source.ledger).filter(Boolean).map((ledger) => ledger!.legacyBenefitId)),
    repairIds: unique(units.map(({ unit }) => unit.repairEvidence?.repairId).filter((id): id is string => id !== undefined)),
  };
}

function sortedManifestBody(manifest: GlobalBenefitCategoryRepairManifest): unknown {
  return {
    version: manifest.version,
    inventoryFingerprint: manifest.inventoryFingerprint,
    pageFingerprint: manifest.pageFingerprint,
    afterCursor: manifest.afterCursor,
    nextCursor: manifest.nextCursor,
    hasMore: manifest.hasMore,
    entries: manifest.entries.map((entry) => ({ ...entry })),
    manifestFingerprint: manifest.manifestFingerprint,
  };
}

export function categoryRepairParityManifestBundleFingerprint(
  pages: readonly GlobalBenefitCategoryRepairManifest[],
): string {
  return migrationFingerprint(pages.map(sortedManifestBody));
}

export function validateGlobalBenefitCategoryRepairParityManifests(
  value: unknown,
): GlobalBenefitCategoryRepairParityManifestBundle {
  if (!Array.isArray(value) || value.length === 0) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity manifest bundle is invalid.");
  }
  const pages = value.map((page) => validateGlobalBenefitCategoryRepairManifest(page));
  for (const page of pages) {
    if (!isPlainObject(page)
      || page.version !== 1
      || typeof page.inventoryFingerprint !== "string" || !HEX_SHA256.test(page.inventoryFingerprint)
      || typeof page.pageFingerprint !== "string" || !HEX_SHA256.test(page.pageFingerprint)
      || typeof page.manifestFingerprint !== "string" || !HEX_SHA256.test(page.manifestFingerprint)
      || !Array.isArray(page.entries)
      || (page.hasMore !== (page.nextCursor !== null))) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity manifest bundle is invalid.");
    }
    if (page.entries.some((entry) => entry.privateKey.length === 0
      || !entry.privateKey.startsWith("repair:")
      || entry.privateKey === "repair:"
      || entry.privateKey !== `repair:${entry.sourceBenefitId}`
      || [
        entry.sourceBenefitId,
        entry.ownerId,
        entry.creditCardId,
        entry.predefinedCardId,
        entry.predefinedBenefitId,
        entry.targetCardCatalogKey,
        entry.targetBenefitCatalogKey,
      ].some((value) => value.length === 0))) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity manifest bundle is invalid.");
    }
  }
  const inventoryFingerprint = pages[0].inventoryFingerprint;
  if (pages.some((page) => page.inventoryFingerprint !== inventoryFingerprint)) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity manifest bundle changed inventory authority.");
  }
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if ((index === 0 && page.afterCursor !== null)
      || (index > 0 && (!pages[index - 1].hasMore
        || pages[index - 1].nextCursor === null
        || page.afterCursor !== pages[index - 1].nextCursor))
      || (index < pages.length - 1 && (!page.hasMore || page.nextCursor === null))) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity manifest page chain is invalid.");
    }
  }
  const last = pages.at(-1)!;
  if (last.hasMore || last.nextCursor !== null) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity manifest bundle is incomplete.");
  }
  const entries = pages.flatMap((page) => page.entries);
  const privateKeys = entries.map((entry) => entry.privateKey);
  if (new Set(privateKeys).size !== privateKeys.length) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity manifest bundle contains duplicate authority.");
  }
  const bundleFingerprint = categoryRepairParityManifestBundleFingerprint(pages);
  return { pages: [...pages], inventoryFingerprint, bundleFingerprint };
}

export function validateGlobalBenefitCategoryRepairParityScope(
  bundle: GlobalBenefitCategoryRepairParityManifestBundle,
  scope: CategoryRepairParityManifestScope | null | undefined,
): CategoryRepairParityManifestScope | null {
  if (scope === undefined || scope === null) return null;
  if (!isPlainObject(scope)
    || !exactKeys(scope, ["pageIndex", "pageFingerprint", "manifestFingerprint"])
    || !Number.isSafeInteger(scope.pageIndex)
    || !HEX_SHA256.test(scope.pageFingerprint)
    || !HEX_SHA256.test(scope.manifestFingerprint)) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity page selector is invalid.");
  }
  if (scope.pageIndex < 0 || scope.pageIndex >= bundle.pages.length) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity page selector is outside the manifest bundle.");
  }
  const page = bundle.pages[scope.pageIndex];
  if (page.pageFingerprint !== scope.pageFingerprint
    || page.manifestFingerprint !== scope.manifestFingerprint) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity page selector is outside the manifest bundle.");
  }
  return {
    pageIndex: scope.pageIndex,
    pageFingerprint: scope.pageFingerprint,
    manifestFingerprint: scope.manifestFingerprint,
  };
}

function expectedManifestEntries(
  bundle: GlobalBenefitCategoryRepairParityManifestBundle,
  scope: CategoryRepairParityManifestScope | null = null,
): Map<string, CategoryRepairManifestEntry> {
  const pages = scope === null ? bundle.pages : [bundle.pages[scope.pageIndex]];
  return new Map(pages.flatMap((page) => page.entries).map((entry) => [entry.privateKey, entry]));
}

interface CategoryRepairParityPageAuthority {
  pageIndex: number;
  pageFingerprint: string;
  manifestFingerprint: string;
  manifestEntryFingerprints: readonly string[];
  afterCursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
}

function pageAuthorityFromManifest(
  page: GlobalBenefitCategoryRepairManifest,
  pageIndex: number,
): CategoryRepairParityPageAuthority {
  return {
    pageIndex,
    pageFingerprint: page.pageFingerprint,
    manifestFingerprint: page.manifestFingerprint,
    manifestEntryFingerprints: page.entries.map((entry) => entry.entryFingerprint),
    afterCursor: page.afterCursor,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

/**
 * Reconstruct page membership from the complete baseline rather than treating
 * eligible manifest entries as the page boundary.  Page fingerprints include
 * blocked proposals, so a boundary is accepted only when its exact proposal
 * slice and cursor agree with the reviewed manifest.
 */
function pageAuthoritiesForBaseline(
  units: readonly CategoryRepairParityUnitBaseline[],
  bundle: GlobalBenefitCategoryRepairParityManifestBundle,
  scope: CategoryRepairParityManifestScope | null,
): Map<string, CategoryRepairParityPageAuthority> {
  const authorities = bundle.pages.map(pageAuthorityFromManifest);
  const result = new Map<string, CategoryRepairParityPageAuthority>();
  if (scope !== null) {
    const authority = authorities[scope.pageIndex];
    if (!authority) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity page selector is outside the manifest bundle.");
    }
    for (const baseline of units) result.set(baseline.privateKey, authority);
    return result;
  }

  let offset = 0;
  for (const authority of authorities) {
    const page = bundle.pages[authority.pageIndex];
    const matches: number[] = [];
    for (let end = offset; end <= units.length; end += 1) {
      if (end === offset && !(offset === units.length && !page.hasMore && page.nextCursor === null)) continue;
      const proposals = units.slice(offset, end).map(({ proposal }) => proposal);
      if (categoryRepairPageFingerprint(proposals) !== page.pageFingerprint) continue;
      const expectedNextCursor = end === offset || !page.hasMore
        ? null
        : encodeGlobalBenefitCategoryRepairCursor(units[end - 1].privateKey);
      if (expectedNextCursor !== page.nextCursor || (expectedNextCursor !== null) !== page.hasMore) continue;
      matches.push(end);
    }
    if (matches.length !== 1) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity page boundaries changed.");
    }
    const end = matches[0];
    for (const baseline of units.slice(offset, end)) result.set(baseline.privateKey, authority);
    offset = end;
  }
  if (offset !== units.length || result.size !== units.length) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity page boundaries changed.");
  }
  return result;
}

function manifestAuthoritiesForSiblingNormalization(
  authorities: readonly CategoryRepairParityPageAuthority[],
): CategoryRepairReviewedAuthorityContext["manifestAuthorities"] {
  return authorities.map((authority) => ({
    manifestFingerprint: authority.manifestFingerprint,
    pageFingerprint: authority.pageFingerprint,
    manifestEntryFingerprints: authority.manifestEntryFingerprints,
  }));
}

function validateCurrentAllUnits(
  snapshot: CategoryRepairBatchSnapshot,
): readonly CategoryRepairUnitSnapshot[] {
  const allUnits = snapshot.allUnits ?? snapshot.units;
  if (snapshot.allUnits === undefined) return allUnits;
  try {
    validateSnapshotUnits({
      units: allUnits,
      hasMore: false,
      inventoryFingerprint: snapshot.inventoryFingerprint,
    });
  } catch {
    throw new GlobalBenefitCategoryRepairParityError("The current parity snapshot is invalid.");
  }
  const allByKey = new Map(allUnits.map((unit) => [unit.privateKey, unit]));
  if (allByKey.size !== allUnits.length
    || snapshot.units.some((unit) => {
      const complete = allByKey.get(unit.privateKey);
      return complete === undefined || migrationFingerprint(complete) !== migrationFingerprint(unit);
    })) {
    throw new GlobalBenefitCategoryRepairParityError("The current parity snapshot is invalid.");
  }
  return allUnits;
}

function validateSnapshotUnits(
  snapshot: Pick<CategoryRepairBatchSnapshot, "units" | "hasMore" | "inventoryFingerprint">,
): void {
  if (!HEX_SHA256.test(snapshot.inventoryFingerprint)
    || snapshot.hasMore !== false
    || !Array.isArray(snapshot.units)
    || snapshot.units.some((unit) => !isPlainObject(unit))) {
    throw new GlobalBenefitCategoryRepairParityError("The complete repair snapshot is invalid.");
  }
  const keys = snapshot.units.map((unit) => unit.privateKey);
  if (keys.some((key) => typeof key !== "string" || key.length === 0)
    || new Set(keys).size !== keys.length
    || keys.some((key, index) => index > 0 && key <= keys[index - 1])) {
    throw new GlobalBenefitCategoryRepairParityError("The complete repair snapshot is not deterministic.");
  }
}

function scopedSnapshot(
  snapshot: CategoryRepairBatchSnapshot,
  bundle: GlobalBenefitCategoryRepairParityManifestBundle,
  scope: CategoryRepairParityManifestScope | null,
  expectedScopeKeys?: ReadonlySet<string>,
): CategoryRepairBatchSnapshot {
  validateSnapshotUnits(snapshot);
  if (scope === null) return snapshot;
  const page = bundle.pages[scope.pageIndex];
  if (expectedScopeKeys === undefined) {
    // Capture is pre-apply, so the page fingerprint can prove the complete
    // page slice (including blocked proposals) without trusting entry count.
    const pageFingerprint = categoryRepairPageFingerprint(snapshot.units.map((unit) =>
      planGlobalBenefitCategoryRepairUnit(unit, "discover")));
    if (pageFingerprint !== page.pageFingerprint) {
      throw new GlobalBenefitCategoryRepairParityError("The parity snapshot crosses the selected manifest page.");
    }
  }
  const allowed = expectedScopeKeys ?? new Set(page.entries.map((entry) => entry.privateKey));
  if (snapshot.units.length !== allowed.size
    || Array.from(allowed).some((privateKey) => !snapshot.units.some((unit) => unit.privateKey === privateKey))) {
    throw new GlobalBenefitCategoryRepairParityError("The selected parity page is not fully covered.");
  }
  return snapshot;
}

function manifestEntryForProposal(proposal: CategoryRepairProposal): CategoryRepairManifestEntry | null {
  if (proposal.blocked
    || proposal.intent !== "APPLY"
    || proposal.predefinedBenefitId === null
    || proposal.targetCardCatalogKey === null
    || proposal.targetBenefitCatalogKey === null
    || proposal.definitionFingerprint === null
    || proposal.destinationFingerprint === null) return null;
  const body = {
    privateKey: proposal.privateKey,
    sourceBenefitId: proposal.sourceBenefitId,
    ownerId: proposal.ownerId,
    creditCardId: proposal.creditCardId,
    predefinedCardId: proposal.predefinedCardId,
    predefinedBenefitId: proposal.predefinedBenefitId,
    targetCardCatalogKey: proposal.targetCardCatalogKey,
    targetBenefitCatalogKey: proposal.targetBenefitCatalogKey,
    definitionFingerprint: proposal.definitionFingerprint,
    immutableGraphFingerprint: proposal.immutableGraphFingerprint,
    currentGraphFingerprint: proposal.currentGraphFingerprint,
    destinationFingerprint: proposal.destinationFingerprint,
    postimageFingerprint: proposal.postimageFingerprint,
    planFingerprint: proposal.planFingerprint,
  };
  return { ...body, entryFingerprint: categoryRepairManifestEntryFingerprint(body) };
}

function validateManifestCoverage(
  units: readonly CategoryRepairParityUnitBaseline[],
  bundle: GlobalBenefitCategoryRepairParityManifestBundle,
  scope: CategoryRepairParityManifestScope | null = null,
): void {
  const entries = expectedManifestEntries(bundle, scope);
  const unitKeys = new Set(units.map(({ privateKey }) => privateKey));
  if (unitKeys.size !== units.length
    || units.some(({ privateKey }, index) => index > 0 && privateKey <= units[index - 1].privateKey)) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity snapshot is not deterministic.");
  }
  for (const { privateKey, proposal } of units) {
    const entry = entries.get(privateKey);
    const expected = manifestEntryForProposal(proposal);
    if (expected === null) {
      if (entry !== undefined) {
        throw new GlobalBenefitCategoryRepairParityError("A blocked repair unit entered the private manifest.");
      }
      continue;
    }
    if (entry === undefined || migrationFingerprint(entry) !== migrationFingerprint(expected)) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity manifest does not match the repair plan.");
    }
  }
  if (Array.from(entries.keys()).some((key) => !unitKeys.has(key))) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity manifest does not cover the complete page.");
  }
}

function actionRemovedCount(proposal: CategoryRepairProposal): number {
  return proposal.actions.filter((action) => action.removedStatusId !== null).length;
}

function actionCount(proposal: CategoryRepairProposal): number {
  return proposal.actions.length;
}

function proposalsExactlyEqual(left: CategoryRepairProposal, right: CategoryRepairProposal): boolean {
  return migrationFingerprint(left) === migrationFingerprint(right);
}

function expectedCounts(
  units: readonly CategoryRepairParityUnitBaseline[],
  bundle: GlobalBenefitCategoryRepairParityManifestBundle,
  scope: CategoryRepairParityManifestScope | null = null,
): CategoryRepairParityCounts {
  const entries = expectedManifestEntries(bundle, scope);
  const safe = units.filter(({ privateKey, proposal }) => !proposal.blocked && entries.has(privateKey));
  const removed = safe
    .filter(({ unit }) => unit.repairEvidence?.phase !== "APPLIED")
    .reduce((sum, { proposal }) => sum + actionRemovedCount(proposal), 0);
  const addedRepairs = safe.filter(({ unit }) => unit.repairEvidence === null).length;
  const addedOccurrences = safe
    .filter(({ unit }) => unit.repairEvidence === null)
    .reduce((sum, { proposal }) => sum + actionCount(proposal), 0);
  return {
    definitionsExamined: units.length,
    manifestEntries: entries.size,
    eligible: safe.length,
    blocked: units.length - safe.length,
    appliedValid: 0,
    unchanged: 0,
    idempotent: 0,
    expectedRemovedStatuses: removed,
    expectedAddedRepairs: addedRepairs,
    expectedAddedOccurrences: addedOccurrences,
  };
}

function baselineUnitFromSnapshot(
  unit: CategoryRepairUnitSnapshot,
): CategoryRepairParityUnitBaseline {
  return {
    privateKey: unit.privateKey,
    unit,
    proposal: planGlobalBenefitCategoryRepairUnit(unit, "discover"),
  };
}

export function captureGlobalBenefitCategoryRepairParityBaseline(input: {
  targetVerified?: boolean;
  manifests: unknown;
  scope?: CategoryRepairParityManifestScope | null;
  snapshot: CategoryRepairBatchSnapshot;
  aggregate: CategoryRepairParityAggregateState;
}): GlobalBenefitCategoryRepairParityBaseline {
  if (input.targetVerified !== true) {
    throw new GlobalBenefitCategoryRepairParityError("Category-repair parity requires target verification.");
  }
  const bundle = validateGlobalBenefitCategoryRepairParityManifests(input.manifests);
  const scope = validateGlobalBenefitCategoryRepairParityScope(bundle, input.scope);
  const scoped = scopedSnapshot(input.snapshot, bundle, scope);
  const aggregate = validateAggregate(input.aggregate);
  if (scoped.inventoryFingerprint !== bundle.inventoryFingerprint
    || !HEX_SHA256.test(scoped.inventoryFingerprint)) {
    throw new GlobalBenefitCategoryRepairParityError("The complete repair inventory fingerprint changed.");
  }
  const units = scoped.units.map(baselineUnitFromSnapshot);
  validateManifestCoverage(units, bundle, scope);
  const body = {
    version: GLOBAL_BENEFIT_CATEGORY_REPAIR_PARITY_BASELINE_VERSION,
    inventoryFingerprint: bundle.inventoryFingerprint,
    bundleFingerprint: bundle.bundleFingerprint,
    scope,
    manifests: bundle.pages,
    units,
    aggregate,
  } satisfies Omit<GlobalBenefitCategoryRepairParityBaseline, "baselineFingerprint">;
  return {
    ...body,
    baselineFingerprint: migrationFingerprint(baselineFingerprintBody(body)),
  };
}

function statusById(unit: CategoryRepairUnitSnapshot): Map<string, CategoryRepairUnitSnapshot["source"]["statuses"][number]> {
  const statuses = [...unit.source.statuses, ...unit.destinationStatuses];
  const result = new Map<string, CategoryRepairUnitSnapshot["source"]["statuses"][number]>();
  for (const status of statuses) {
    if (result.has(status.id) && migrationFingerprint(result.get(status.id)) !== migrationFingerprint(status)) {
      return new Map();
    }
    result.set(status.id, status);
  }
  return result;
}

function protectedKeeperMatches(
  current: CategoryRepairUnitSnapshot["source"]["statuses"][number],
  action: CategoryRepairStatusAction,
): boolean {
  const expected = {
    ...action.keeperBaseline,
    creditCardId: action.creditCardId,
    predefinedBenefitId: action.predefinedBenefitId,
  };
  const currentComparable = {
    id: current.id,
    benefitId: current.benefitId,
    creditCardId: current.creditCardId,
    predefinedBenefitId: current.predefinedBenefitId,
    userId: current.userId,
    cycleStartDate: current.cycleStartDate.toISOString(),
    cycleEndDate: current.cycleEndDate.toISOString(),
    occurrenceIndex: current.occurrenceIndex,
    usedAmount: current.usedAmount,
    isCompleted: current.isCompleted,
    completedAt: current.completedAt?.toISOString() ?? null,
    isNotUsable: current.isNotUsable,
    orderIndex: current.orderIndex,
    createdAt: current.createdAt.toISOString(),
    updatedAt: current.updatedAt.toISOString(),
    stateFingerprint: current.stateFingerprint,
  };
  return migrationFingerprint(currentComparable) === migrationFingerprint(expected)
    && current.audits.length === action.keeperAuditBaseline.length
    && current.provenance.length === action.keeperProvenanceBaseline.length
    && current.audits.every((audit) => action.keeperAuditBaseline.some((baseline) =>
      baseline.id === audit.id && baseline.stateFingerprint === audit.stateFingerprint
      && baseline.ownerId === audit.ownerId))
    && current.provenance.every((row) => action.keeperProvenanceBaseline.some((baseline) =>
      baseline.id === row.id && baseline.stateFingerprint === row.stateFingerprint
      && baseline.ownerId === row.ownerId));
}

function safeUnitMatches(
  baseline: CategoryRepairParityUnitBaseline,
  current: CategoryRepairUnitSnapshot,
  entry: CategoryRepairManifestEntry,
  reviewedManifestFingerprint: string,
  reviewedInventoryFingerprint: string,
): { authority: boolean; protectedState: boolean; removed: number; duplicate: boolean } {
  const currentPlan = planGlobalBenefitCategoryRepairUnit(current, "apply");
  if (currentPlan.blocked || currentPlan.intent !== "APPLY_REPLAY") {
    return { authority: false, protectedState: false, removed: 0, duplicate: false };
  }
  const evidence = current.repairEvidence;
  const expectedEvidence = baseline.unit.repairEvidence;
  const evidenceMatches = evidence !== null
    && evidence.phase === "APPLIED"
    && evidence.sourceBenefitId === baseline.proposal.sourceBenefitId
    && evidence.ownerId === baseline.proposal.ownerId
    && evidence.creditCardId === baseline.proposal.creditCardId
    && evidence.predefinedCardId === baseline.proposal.predefinedCardId
    && evidence.predefinedBenefitId === baseline.proposal.predefinedBenefitId
    && evidence.targetCardCatalogKey === entry.targetCardCatalogKey
    && evidence.targetBenefitCatalogKey === entry.targetBenefitCatalogKey
    && evidence.definitionFingerprint === entry.definitionFingerprint
    && evidence.inventoryFingerprint === reviewedInventoryFingerprint
    && evidence.immutableGraphFingerprint === entry.immutableGraphFingerprint
    && evidence.reviewedCurrentGraphFingerprint === entry.currentGraphFingerprint
    && evidence.destinationFingerprint === entry.destinationFingerprint
    && evidence.manifestFingerprint === reviewedManifestFingerprint
    && evidence.manifestEntryFingerprint === entry.entryFingerprint
    && evidence.planFingerprint === entry.planFingerprint
    && evidence.postimageFingerprint === entry.postimageFingerprint
    && evidence.occurrences.length === baseline.proposal.actions.length
    && evidence.occurrences.every((action) => baseline.proposal.actions.some((expected) =>
      expected.actionFingerprint === action.actionFingerprint
      && expected.postimageFingerprint === action.postimageFingerprint
      && expected.keeperStatusId === action.keeperStatusId));
  // A baseline with no evidence is the normal capture state. If a prior rolled
  // back parent exists, its manifest fingerprint remains the authority.
  const baselineManifestFingerprint = expectedEvidence?.manifestFingerprint ?? null;
  const currentEvidenceManifestMatches = baselineManifestFingerprint === null
    || evidence?.manifestFingerprint === baselineManifestFingerprint;
  const statuses = statusById(current);
  let protectedState = evidenceMatches && currentEvidenceManifestMatches && statuses.size > 0;
  let removed = 0;
  let duplicate = false;
  if (protectedState) {
    for (const action of baseline.proposal.actions) {
      const keeper = statuses.get(action.keeperStatusId);
      if (!keeper || !protectedKeeperMatches(keeper, action)) protectedState = false;
      if (action.removedStatusId !== null) {
        if (statuses.has(action.removedStatusId)) protectedState = false;
        else removed += 1;
      }
    }
    const keeperIds = new Set(baseline.proposal.actions.map((action) => action.keeperStatusId));
    const visible = Array.from(new Map(
      [...current.source.statuses, ...current.destinationStatuses].map((status) => [status.id, status]),
    ).values());
    if (visible.some((status) => !keeperIds.has(status.id))) duplicate = true;
    if (new Set(visible.map((status) => [
      status.userId, status.cycleStartDate.toISOString(), status.cycleEndDate.toISOString(), status.occurrenceIndex,
    ].join("|"))).size !== visible.length) duplicate = true;
  }
  return { authority: evidenceMatches && currentEvidenceManifestMatches, protectedState, removed, duplicate };
}

function compareTableCounts(
  baseline: CategoryRepairParityAggregateState,
  current: CategoryRepairParityAggregateState,
  expected: CategoryRepairParityCounts,
): { ok: boolean; observedRemoved: number; observedRepairs: number; observedOccurrences: number } {
  const observedRemoved = baseline.counts.statuses - current.counts.statuses;
  const observedRepairs = current.counts.repairs - baseline.counts.repairs;
  const observedOccurrences = current.counts.occurrences - baseline.counts.occurrences;
  const countDeltaOk = observedRemoved === expected.expectedRemovedStatuses
    && observedRepairs === expected.expectedAddedRepairs
    && observedOccurrences === expected.expectedAddedOccurrences;
  const unrelatedTables = TABLE_COUNT_KEYS.every((key) => {
    if (key === "statuses" || key === "repairs" || key === "occurrences") return true;
    return baseline.counts[key] === current.counts[key];
  });
  return {
    ok: countDeltaOk && unrelatedTables,
    observedRemoved,
    observedRepairs,
    observedOccurrences,
  };
}

export function parseGlobalBenefitCategoryRepairParityBaseline(
  value: unknown,
): GlobalBenefitCategoryRepairParityBaseline {
  if (!isPlainObject(value) || !exactKeys(value, BASELINE_KEYS)
    || value.version !== GLOBAL_BENEFIT_CATEGORY_REPAIR_PARITY_BASELINE_VERSION
    || typeof value.inventoryFingerprint !== "string" || !HEX_SHA256.test(value.inventoryFingerprint)
    || typeof value.bundleFingerprint !== "string" || !HEX_SHA256.test(value.bundleFingerprint)
    || !Array.isArray(value.manifests) || !Array.isArray(value.units)
    || typeof value.baselineFingerprint !== "string" || !HEX_SHA256.test(value.baselineFingerprint)) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
  }
  const bundle = validateGlobalBenefitCategoryRepairParityManifests(value.manifests);
  if (bundle.inventoryFingerprint !== value.inventoryFingerprint
    || bundle.bundleFingerprint !== value.bundleFingerprint) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline authority changed.");
  }
  let scope: CategoryRepairParityManifestScope | null = null;
  if (value.scope !== null) {
    if (!isPlainObject(value.scope) || !exactKeys(value.scope, ["pageIndex", "pageFingerprint", "manifestFingerprint"])) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity baseline scope is invalid.");
    }
    scope = validateGlobalBenefitCategoryRepairParityScope(bundle, {
      pageIndex: value.scope.pageIndex as number,
      pageFingerprint: value.scope.pageFingerprint as string,
      manifestFingerprint: value.scope.manifestFingerprint as string,
    });
  }
  const units: CategoryRepairParityUnitBaseline[] = value.units.map((raw) => {
    if (!isPlainObject(raw) || !exactKeys(raw, UNIT_KEYS)
      || typeof raw.privateKey !== "string" || !isPlainObject(raw.proposal)) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
    }
    const unit = hydrateUnit(raw.unit);
    const proposal = raw.proposal as unknown as CategoryRepairProposal;
    let planned: CategoryRepairProposal;
    try {
      planned = planGlobalBenefitCategoryRepairUnit(unit, "discover");
    } catch {
      throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
    }
    if (unit.privateKey !== raw.privateKey || !proposalsExactlyEqual(planned, proposal)) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity baseline is invalid.");
    }
    return {
      privateKey: raw.privateKey,
      unit,
      proposal,
    };
  });
  const aggregate = validateAggregate(value.aggregate);
  validateManifestCoverage(units, bundle, scope);
  const body = {
    version: GLOBAL_BENEFIT_CATEGORY_REPAIR_PARITY_BASELINE_VERSION,
    inventoryFingerprint: value.inventoryFingerprint,
    bundleFingerprint: value.bundleFingerprint,
    scope,
    manifests: bundle.pages,
    units,
    aggregate,
  } satisfies Omit<GlobalBenefitCategoryRepairParityBaseline, "baselineFingerprint">;
  if (migrationFingerprint(baselineFingerprintBody(body)) !== value.baselineFingerprint) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline fingerprint is invalid.");
  }
  try {
    if (scope === null) {
      pageAuthoritiesForBaseline(units, bundle, null);
    } else if (categoryRepairPageFingerprint(units.map(({ proposal }) => proposal))
      !== bundle.pages[scope.pageIndex].pageFingerprint) {
      throw new GlobalBenefitCategoryRepairParityError("The private parity baseline page authority is invalid.");
    }
  } catch {
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline page authority is invalid.");
  }
  return { ...body, baselineFingerprint: value.baselineFingerprint };
}

export function verifyGlobalBenefitCategoryRepairParity(input: {
  targetVerified?: boolean;
  baseline: unknown;
  manifests: unknown;
  scope?: CategoryRepairParityManifestScope | null;
  snapshot: CategoryRepairBatchSnapshot;
  aggregate: CategoryRepairParityAggregateState;
}): CategoryRepairParityReport {
  const report: CategoryRepairParityReport = {
    mode: "verify",
    gates: {
      targetVerified: input.targetVerified === true,
      baselineValid: false,
      manifestCoverage: false,
      repairAuthority: false,
      protectedState: false,
      allowedDelta: false,
      unrelatedRows: false,
    },
    counts: {
      definitionsExamined: 0,
      manifestEntries: 0,
      eligible: 0,
      blocked: 0,
      appliedValid: 0,
      unchanged: 0,
      idempotent: 0,
      expectedRemovedStatuses: 0,
      expectedAddedRepairs: 0,
      expectedAddedOccurrences: 0,
    },
    actions: {
      expectedRemovedStatuses: 0,
      observedRemovedStatuses: 0,
      expectedAddedRepairs: 0,
      observedAddedRepairs: 0,
      expectedAddedOccurrences: 0,
      observedAddedOccurrences: 0,
    },
    stops: {},
  };
  if (!report.gates.targetVerified) {
    increment(report.stops, "target_not_verified");
    throw new GlobalBenefitCategoryRepairParityError("Category-repair parity requires target verification.");
  }
  let baseline: GlobalBenefitCategoryRepairParityBaseline;
  let bundle: GlobalBenefitCategoryRepairParityManifestBundle;
  let scope: CategoryRepairParityManifestScope | null;
  try {
    baseline = parseGlobalBenefitCategoryRepairParityBaseline(input.baseline);
    bundle = validateGlobalBenefitCategoryRepairParityManifests(input.manifests);
    scope = validateGlobalBenefitCategoryRepairParityScope(bundle, input.scope);
  } catch {
    increment(report.stops, "baseline_invalid");
    throw new GlobalBenefitCategoryRepairParityError("The private parity authority is invalid.");
  }
  report.gates.baselineValid = true;
  // A complete pre-repair baseline may be verified once per selected page
  // after the bounded rollout has accumulated.  A page-scoped baseline remains
  // bound to that same page; only the global baseline can be narrowed at verify
  // time without synthesizing a post-repair baseline.
  if (baseline.bundleFingerprint !== bundle.bundleFingerprint
    || baseline.inventoryFingerprint !== bundle.inventoryFingerprint
    || (baseline.scope !== null && migrationFingerprint(baseline.scope) !== migrationFingerprint(scope))) {
    increment(report.stops, "manifest_drift");
    throw new GlobalBenefitCategoryRepairParityError("The private parity manifest authority changed.");
  }
  report.gates.manifestCoverage = true;
  let baselinePageAuthorities: Map<string, CategoryRepairParityPageAuthority> | null = null;
  let pageAuthorities: Map<string, CategoryRepairParityPageAuthority>;
  try {
    baselinePageAuthorities = baseline.scope === null
      ? pageAuthoritiesForBaseline(baseline.units, bundle, null)
      : null;
    pageAuthorities = baseline.scope === null
      ? baselinePageAuthorities!
      : pageAuthoritiesForBaseline(baseline.units, bundle, baseline.scope);
  } catch {
    increment(report.stops, "manifest_drift");
    throw new GlobalBenefitCategoryRepairParityError("The private parity manifest authority changed.");
  }
  const scopedBaselineUnits = scope === null || baseline.scope !== null
    ? baseline.units
    : baseline.units.filter((entry) => baselinePageAuthorities!.get(entry.privateKey)?.pageIndex === scope.pageIndex);
  report.counts = expectedCounts(scopedBaselineUnits, bundle, scope);
  let currentAggregate: CategoryRepairParityAggregateState;
  let currentSnapshot: CategoryRepairBatchSnapshot;
  try {
    currentSnapshot = scopedSnapshot(
      input.snapshot,
      bundle,
      scope,
      scope === null ? undefined : new Set(scopedBaselineUnits.map((entry) => entry.privateKey)),
    );
    currentAggregate = validateAggregate(input.aggregate);
  } catch {
    increment(report.stops, "aggregate_mismatch");
    throw new GlobalBenefitCategoryRepairParityError("The current parity snapshot is invalid.");
  }
  const baselineByKey = new Map(scopedBaselineUnits.map((entry) => [entry.privateKey, entry]));
  const currentByKey = new Map(currentSnapshot.units.map((unit) => [unit.privateKey, unit]));
  if (currentSnapshot.inventoryFingerprint !== baseline.inventoryFingerprint) {
    increment(report.stops, "inventory_drift");
    throw new GlobalBenefitCategoryRepairParityError("The complete repair inventory changed.");
  }
  if (baselineByKey.size !== currentByKey.size
    || Array.from(baselineByKey.keys()).some((key) => !currentByKey.has(key))) {
    increment(report.stops, baselineByKey.size > currentByKey.size ? "unit_missing" : "unit_unexpected");
    throw new GlobalBenefitCategoryRepairParityError("The complete repair inventory changed.");
  }
  let allCurrentUnits: readonly CategoryRepairUnitSnapshot[];
  try {
    allCurrentUnits = validateCurrentAllUnits(currentSnapshot);
  } catch {
    increment(report.stops, "aggregate_mismatch");
    throw new GlobalBenefitCategoryRepairParityError("The current parity snapshot is invalid.");
  }
  const allPageAuthorities = bundle.pages.map(pageAuthorityFromManifest);
  const entries = expectedManifestEntries(bundle, scope);
  const scopedPages = scope === null ? bundle.pages : [bundle.pages[scope.pageIndex]];
  const manifestFingerprints = new Map(scopedPages.flatMap((page) =>
    page.entries.map((entry) => [entry.privateKey, page.manifestFingerprint] as const)));
  let authority = true;
  let protectedState = true;
  let observedRemoved = 0;
  let observedRepairs = 0;
  let observedOccurrences = 0;
  let appliedValid = 0;
  for (const [privateKey, baselineUnit] of Array.from(baselineByKey.entries())) {
    const current = currentByKey.get(privateKey)!;
    const entry = entries.get(privateKey);
    const safe = !baselineUnit.proposal.blocked && entry !== undefined;
    if (safe) {
      if (!entry) {
        authority = false;
        increment(report.stops, "manifest_coverage_missing");
        continue;
      }
      const result = safeUnitMatches(
        baselineUnit,
        current,
        entry,
        manifestFingerprints.get(privateKey)!,
        baseline.inventoryFingerprint,
      );
      authority &&= result.authority;
      protectedState &&= result.protectedState;
      observedRemoved += result.removed;
      if (baselineUnit.unit.repairEvidence === null && current.repairEvidence?.phase === "APPLIED") {
        observedRepairs += 1;
        observedOccurrences += current.repairEvidence.occurrences.length;
      }
      if (result.duplicate) increment(report.stops, "duplicate_effective_authority");
      if (!result.authority) increment(report.stops, "repair_evidence_invalid");
      if (!result.protectedState) increment(report.stops, "keeper_state_changed");
      if (result.authority && result.protectedState && !result.duplicate) appliedValid += 1;
    } else {
      const pageAuthority = pageAuthorities.get(privateKey);
      let comparisonUnit = current;
      let siblingNormalizationFailed = pageAuthority === undefined;
      if (pageAuthority !== undefined) {
        const siblingAuthority: CategoryRepairReviewedAuthorityContext = {
          mode: "apply",
          inventoryFingerprint: baseline.inventoryFingerprint,
          manifestFingerprint: pageAuthority.manifestFingerprint,
          pageFingerprint: pageAuthority.pageFingerprint,
          afterCursor: pageAuthority.afterCursor,
          nextCursor: pageAuthority.nextCursor,
          hasMore: pageAuthority.hasMore,
          manifestEntryFingerprints: pageAuthority.manifestEntryFingerprints,
          manifestAuthorities: manifestAuthoritiesForSiblingNormalization(allPageAuthorities),
        };
        try {
          comparisonUnit = normalizeCategoryRepairSiblingEffects(current, allCurrentUnits, siblingAuthority);
          siblingNormalizationFailed = false;
        } catch {
          siblingNormalizationFailed = true;
        }
      }
      const currentProposal = planGlobalBenefitCategoryRepairUnit(comparisonUnit, "discover");
      if (!currentProposal.blocked
        || currentProposal.stopReasons.join("|") !== baselineUnit.proposal.stopReasons.join("|")
        || currentProposal.currentGraphFingerprint !== baselineUnit.proposal.currentGraphFingerprint
        || migrationFingerprint(comparisonUnit.repairEvidence) !== migrationFingerprint(baselineUnit.unit.repairEvidence)
        || siblingNormalizationFailed) {
        protectedState = false;
        increment(report.stops, "blocked_unit_changed");
      } else {
        report.counts.unchanged += 1;
      }
    }
  }
  report.gates.repairAuthority = authority;
  report.gates.protectedState = protectedState;
  report.counts.appliedValid = appliedValid;
  report.actions.expectedRemovedStatuses = report.counts.expectedRemovedStatuses;
  report.actions.observedRemovedStatuses = observedRemoved;
  report.actions.expectedAddedRepairs = report.counts.expectedAddedRepairs;
  report.actions.observedAddedRepairs = observedRepairs;
  report.actions.expectedAddedOccurrences = report.counts.expectedAddedOccurrences;
  report.actions.observedAddedOccurrences = observedOccurrences;
  // Aggregate counts use the capture scope.  For a complete global baseline,
  // a selected page is still verified against the complete manifest-authorized
  // delta so effects already committed on other reviewed pages are allowed.
  const aggregateExpected = baseline.scope === null && scope !== null
    ? expectedCounts(baseline.units, bundle, null)
    : report.counts;
  const countCheck = compareTableCounts(baseline.aggregate, currentAggregate, aggregateExpected);
  const selectedActionCheck = observedRemoved === report.counts.expectedRemovedStatuses
    && observedRepairs === report.counts.expectedAddedRepairs
    && observedOccurrences === report.counts.expectedAddedOccurrences;
  report.gates.allowedDelta = countCheck.ok && selectedActionCheck;
  if (!report.gates.allowedDelta) increment(report.stops, "allowed_delta_mismatch");
  report.gates.unrelatedRows = baseline.aggregate.unrelatedRowsDigest === currentAggregate.unrelatedRowsDigest;
  if (!report.gates.unrelatedRows) increment(report.stops, "unrelated_rows_changed");
  if (!report.gates.repairAuthority) increment(report.stops, "canonical_authority_invalid");
  if (Object.values(report.gates).some((value) => !value)) {
    throw new GlobalBenefitCategoryRepairParityVerificationError(
      aggregateGlobalBenefitCategoryRepairParityReport(report),
    );
  }
  report.counts.idempotent = report.counts.eligible;
  return report;
}

export function aggregateGlobalBenefitCategoryRepairParityReport(
  report: CategoryRepairParityReport,
): CategoryRepairParityAggregateReport {
  return {
    mode: report.mode,
    gates: report.gates,
    counts: report.counts,
    actions: report.actions,
    stops: report.stops,
  };
}

export function captureGlobalBenefitCategoryRepairParityReport(
  baseline: GlobalBenefitCategoryRepairParityBaseline,
): CategoryRepairParityReport {
  const counts = expectedCounts(
    baseline.units,
    validateGlobalBenefitCategoryRepairParityManifests(baseline.manifests),
    baseline.scope,
  );
  return {
    mode: "capture",
    gates: {
      targetVerified: true,
      baselineValid: true,
      manifestCoverage: true,
      repairAuthority: true,
      protectedState: true,
      allowedDelta: true,
      unrelatedRows: true,
    },
    counts,
    actions: {
      expectedRemovedStatuses: counts.expectedRemovedStatuses,
      observedRemovedStatuses: 0,
      expectedAddedRepairs: 0,
      observedAddedRepairs: 0,
      expectedAddedOccurrences: 0,
      observedAddedOccurrences: 0,
    },
    stops: {},
  };
}

// Kept exported for the CLI and tests; callers must never print this value.
export function parityScopeFromBaseline(
  baseline: GlobalBenefitCategoryRepairParityBaseline,
): CategoryRepairParityScope {
  // Preserve the global baseline's historical sibling exclusion. A selected
  // page intentionally leaves off-page siblings in the unrelated digest.
  return unitScope(baseline.units, baseline.scope === null);
}

/** Build the database aggregate exclusion scope for a freshly captured page. */
export function parityScopeFromUnits(
  units: readonly CategoryRepairUnitSnapshot[],
  includeSiblingSources = true,
): CategoryRepairParityScope {
  return unitScope(units.map((unit) => ({
    privateKey: unit.privateKey,
    unit,
    proposal: planGlobalBenefitCategoryRepairUnit(unit, "discover"),
  })), includeSiblingSources);
}
