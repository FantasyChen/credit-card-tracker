import { createHash } from "node:crypto";
import {
  globalDefinitionFingerprint,
  legacyBenefitSourceFingerprint,
  migrationFingerprint,
  type GlobalBenefitDefinition,
  type GlobalCardDefinition,
  type LegacyAuditRelation,
  type LegacyBenefitRecord,
  type LegacyProvenanceRelation,
} from "./global-benefit-migration";

export const GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION =
  "APPLY_REVIEWED_CATEGORY_DRIFT_REPAIR" as const;
export const GLOBAL_BENEFIT_CATEGORY_REPAIR_ROLLBACK_CONFIRMATION =
  "ROLLBACK_REVIEWED_CATEGORY_DRIFT_REPAIR" as const;
export const GLOBAL_BENEFIT_CATEGORY_REPAIR_DEFAULT_LIMIT = 100;
export const GLOBAL_BENEFIT_CATEGORY_REPAIR_MAX_LIMIT = 500;
export const GLOBAL_BENEFIT_CATEGORY_REPAIR_MANIFEST_VERSION = 1 as const;

export type GlobalBenefitCategoryRepairMode =
  | "discover"
  | "dry-run"
  | "rollback-preview"
  | "apply"
  | "rollback";

export type CategoryRepairStopReason =
  | "explicit_custom_owner"
  | "source_not_card_linked"
  | "card_global_link_missing"
  | "ledger_not_custom_classified"
  | "ledger_graph_mismatch"
  | "category_not_different"
  | "destination_not_found"
  | "destination_ambiguous"
  | "source_identity_conflict"
  | "relationship_inconsistent"
  | "duplicate_target"
  | "duplicate_source_occurrence"
  | "duplicate_destination_occurrence"
  | "non_exact_overlap"
  | "dual_attachments"
  | "conflicting_meaningful_state"
  | "losing_status_attached"
  | "audit_metadata_conflict"
  | "repair_evidence_missing"
  | "repair_evidence_invalid"
  | "repair_phase_conflict"
  | "repair_graph_drift";

export type CategoryRepairStatusActionKind =
  | "PROMOTE_LEGACY_STATUS"
  | "RETAIN_CANONICAL_STATUS";

export type CategoryRepairProposalIntent =
  | "APPLY"
  | "APPLY_REPLAY"
  | "ROLLBACK"
  | "ROLLBACK_REPLAY";

export interface CategoryRepairAttachmentSnapshot {
  id: string;
  ownerId: string | null;
  stateFingerprint: string;
}

export interface CategoryRepairAuditSnapshot extends CategoryRepairAttachmentSnapshot {
  destinationCardId: string | null;
  destinationBenefitId: string | null;
  destinationStatusId: string | null;
  destinationPredefinedBenefitId: string | null;
  destinationDefinitionFingerprint: string | null;
}

export interface CategoryRepairStatusSnapshot {
  id: string;
  benefitId: string | null;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  usedAmount: number | null;
  isCompleted: boolean;
  completedAt: Date | null;
  isNotUsable: boolean;
  orderIndex: number | null;
  createdAt: Date;
  updatedAt: Date;
  stateFingerprint: string;
  audits: CategoryRepairAuditSnapshot[];
  provenance: CategoryRepairAttachmentSnapshot[];
}

export interface CategoryRepairLegacyBenefitSnapshot
  extends Omit<LegacyBenefitRecord, "statuses"> {
  statuses: CategoryRepairStatusSnapshot[];
}

export interface CategoryRepairCardSnapshot {
  id: string;
  userId: string;
  predefinedCardId: string | null;
}

export interface CategoryRepairAuditMetadataValue {
  destinationPredefinedBenefitId: string | null;
  destinationDefinitionFingerprint: string | null;
  stateFingerprint: string;
}

export interface CategoryRepairAuditPatch {
  auditId: string;
  destinationCardId: string | null;
  destinationBenefitId: string | null;
  destinationStatusId: string;
  before: CategoryRepairAuditMetadataValue;
  after: CategoryRepairAuditMetadataValue;
}

export interface CategoryRepairStatusPreimage {
  id: string;
  benefitId: string | null;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  cycleStartDate: string;
  cycleEndDate: string;
  occurrenceIndex: number;
  usedAmount: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  isNotUsable: boolean;
  orderIndex: number | null;
  createdAt: string;
  updatedAt: string;
  stateFingerprint: string;
}

export interface CategoryRepairStatusAction {
  kind: CategoryRepairStatusActionKind;
  userId: string;
  creditCardId: string;
  predefinedBenefitId: string;
  cycleStartDate: string;
  cycleEndDate: string;
  occurrenceIndex: number;
  keeperStatusId: string;
  keeperSourceKind: "legacy" | "canonical";
  keeperBaselineVersion: 1;
  keeperBaseline: CategoryRepairStatusPreimage;
  keeperAuditBaseline: CategoryRepairAuditSnapshot[];
  keeperProvenanceBaseline: CategoryRepairAttachmentSnapshot[];
  removedStatusId: string | null;
  removedSourceKind: "legacy" | "canonical" | null;
  removedPreimageVersion: 1 | null;
  removedPreimage: CategoryRepairStatusPreimage | null;
  repairAddedAuditMetadataVersion: 1;
  repairAddedAuditMetadata: CategoryRepairAuditPatch[];
  postimageFingerprint: string;
  actionFingerprint: string;
}

export interface CategoryRepairEvidenceSnapshot {
  repairId: string;
  phase: "APPLIED" | "ROLLED_BACK";
  evidenceVersion: 1;
  sourceBenefitId: string;
  ownerId: string;
  creditCardId: string;
  predefinedCardId: string;
  predefinedBenefitId: string;
  targetCardCatalogKey: string;
  targetBenefitCatalogKey: string;
  definitionFingerprint: string;
  inventoryFingerprint: string;
  immutableGraphFingerprint: string;
  reviewedCurrentGraphFingerprint: string;
  destinationFingerprint: string;
  manifestFingerprint: string;
  manifestEntryFingerprint: string;
  planFingerprint: string;
  postimageFingerprint: string;
  occurrences: CategoryRepairStatusAction[];
}

export interface CategoryRepairUnitSnapshot {
  /** Private stable pagination key. Reports must never contain it. */
  privateKey: string;
  card: CategoryRepairCardSnapshot;
  source: CategoryRepairLegacyBenefitSnapshot;
  predefinedCard: GlobalCardDefinition;
  destinationStatuses: CategoryRepairStatusSnapshot[];
  /** Complete strict-custom source graph for this physical card, including source. */
  cardStrictCustomSources: CategoryRepairLegacyBenefitSnapshot[];
  /** Exact persisted repair evidence, when one already exists. */
  repairEvidence: CategoryRepairEvidenceSnapshot | null;
}

export interface CategoryRepairProposal {
  intent: CategoryRepairProposalIntent;
  privateKey: string;
  sourceBenefitId: string;
  ownerId: string;
  creditCardId: string;
  predefinedCardId: string;
  predefinedBenefitId: string | null;
  targetCardCatalogKey: string | null;
  targetBenefitCatalogKey: string | null;
  definitionFingerprint: string | null;
  immutableGraphFingerprint: string;
  currentGraphFingerprint: string;
  destinationFingerprint: string | null;
  postimageFingerprint: string;
  planFingerprint: string;
  evidenceFingerprint: string | null;
  reviewedManifestFingerprint: string | null;
  actions: CategoryRepairStatusAction[];
  stopReasons: CategoryRepairStopReason[];
  blocked: boolean;
}

export interface CategoryRepairDiscoveryResult {
  inventoryFingerprint: string;
  proposals: CategoryRepairProposal[];
}

export interface CategoryRepairManifestEntry {
  privateKey: string;
  sourceBenefitId: string;
  ownerId: string;
  creditCardId: string;
  predefinedCardId: string;
  predefinedBenefitId: string;
  targetCardCatalogKey: string;
  targetBenefitCatalogKey: string;
  definitionFingerprint: string;
  immutableGraphFingerprint: string;
  currentGraphFingerprint: string;
  destinationFingerprint: string;
  postimageFingerprint: string;
  planFingerprint: string;
  entryFingerprint: string;
}

export interface GlobalBenefitCategoryRepairManifest {
  version: typeof GLOBAL_BENEFIT_CATEGORY_REPAIR_MANIFEST_VERSION;
  /** DB-supplied complete strict-custom inventory fingerprint. */
  inventoryFingerprint: string;
  pageFingerprint: string;
  afterCursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  entries: CategoryRepairManifestEntry[];
  manifestFingerprint: string;
}

export interface CategoryRepairReviewedAuthorityContext {
  mode: "apply" | "rollback";
  inventoryFingerprint: string;
  manifestFingerprint: string;
  pageFingerprint: string;
  afterCursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CategoryRepairBatchSnapshot {
  units: CategoryRepairUnitSnapshot[];
  hasMore: boolean;
  /** Fingerprint of the complete strict-custom inventory, not merely this page. */
  inventoryFingerprint: string;
}

export interface CategoryRepairWriteResult {
  applied: number;
  rolledBack: number;
  idempotent: number;
}

export interface GlobalBenefitCategoryRepairDatabase {
  readBatch(input: {
    mode: GlobalBenefitCategoryRepairMode;
    afterCursorDigest: string | null;
    limit: number;
  }): Promise<CategoryRepairBatchSnapshot>;
  applyRepair(
    proposal: CategoryRepairProposal,
    manifestEntry: CategoryRepairManifestEntry,
    authority: CategoryRepairReviewedAuthorityContext,
  ): Promise<CategoryRepairWriteResult>;
  rollbackRepair(
    proposal: CategoryRepairProposal,
    manifestEntry: CategoryRepairManifestEntry,
    authority: CategoryRepairReviewedAuthorityContext,
  ): Promise<CategoryRepairWriteResult>;
}

export interface GlobalBenefitCategoryRepairReport {
  mode: GlobalBenefitCategoryRepairMode;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  inventoryFingerprint: string;
  pageFingerprint: string;
  manifestFingerprint: string | null;
  counts: {
    definitionsExamined: number;
    proposed: number;
    blocked: number;
    statusActions: number;
    applied: number;
    rolledBack: number;
    idempotent: number;
  };
  actions: Partial<Record<CategoryRepairStatusActionKind, number>>;
  stops: Partial<Record<CategoryRepairStopReason, number>>;
}

export class GlobalBenefitCategoryRepairError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlobalBenefitCategoryRepairError";
  }
}

const NON_CATEGORY_SHAPE_FIELDS = [
  "description",
  "percentage",
  "maxAmount",
  "frequency",
  "cycleAlignment",
  "fixedCycleStartMonth",
  "fixedCycleDurationMonths",
  "occurrencesInCycle",
] as const;

const HEX_SHA256 = /^[a-f0-9]{64}$/;

function exactDate(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new GlobalBenefitCategoryRepairError("A repair snapshot contains an invalid date.");
  }
  return value.toISOString();
}

function comparePrivateKey(
  left: Pick<CategoryRepairUnitSnapshot, "privateKey">,
  right: Pick<CategoryRepairUnitSnapshot, "privateKey">,
): number {
  return left.privateKey.localeCompare(right.privateKey);
}

function sortedAttachments<T extends CategoryRepairAttachmentSnapshot>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function portableAuditFingerprintInput(audit: CategoryRepairAuditSnapshot | LegacyAuditRelation): unknown {
  return {
    ...audit,
    // Environment-local global IDs are validated against exact catalog-bound
    // relations before hashing. Their nullability plus the catalog-key-backed
    // definition fingerprint keeps cloned evidence portable.
    destinationPredefinedBenefitId: audit.destinationPredefinedBenefitId === null
      ? null
      : "catalog-bound",
  };
}

function statusFingerprintInput(status: CategoryRepairStatusSnapshot): unknown {
  return {
    id: status.id,
    benefitId: status.benefitId,
    creditCardId: status.creditCardId,
    predefinedBenefitId: status.predefinedBenefitId === null ? null : "catalog-bound",
    userId: status.userId,
    cycleStartDate: exactDate(status.cycleStartDate),
    cycleEndDate: exactDate(status.cycleEndDate),
    occurrenceIndex: status.occurrenceIndex,
    usedAmount: status.usedAmount,
    isCompleted: status.isCompleted,
    completedAt: status.completedAt === null ? null : exactDate(status.completedAt),
    isNotUsable: status.isNotUsable,
    orderIndex: status.orderIndex,
    createdAt: exactDate(status.createdAt),
    updatedAt: exactDate(status.updatedAt),
    stateFingerprint: status.stateFingerprint,
    audits: sortedAttachments(status.audits).map(portableAuditFingerprintInput),
    provenance: sortedAttachments(status.provenance),
  };
}

function statusPreimage(status: CategoryRepairStatusSnapshot): CategoryRepairStatusPreimage {
  return {
    id: status.id,
    benefitId: status.benefitId,
    creditCardId: status.creditCardId,
    predefinedBenefitId: status.predefinedBenefitId,
    userId: status.userId,
    cycleStartDate: exactDate(status.cycleStartDate),
    cycleEndDate: exactDate(status.cycleEndDate),
    occurrenceIndex: status.occurrenceIndex,
    usedAmount: status.usedAmount,
    isCompleted: status.isCompleted,
    completedAt: status.completedAt === null ? null : exactDate(status.completedAt),
    isNotUsable: status.isNotUsable,
    orderIndex: status.orderIndex,
    createdAt: exactDate(status.createdAt),
    updatedAt: exactDate(status.updatedAt),
    stateFingerprint: status.stateFingerprint,
  };
}

function statusOccurrenceKey(status: CategoryRepairStatusSnapshot): string {
  return [
    status.userId,
    exactDate(status.cycleStartDate),
    exactDate(status.cycleEndDate),
    status.occurrenceIndex,
  ].join("|");
}

function statusMutableState(status: CategoryRepairStatusSnapshot): unknown {
  return {
    usedAmount: status.usedAmount,
    isCompleted: status.isCompleted,
    completedAt: status.completedAt === null ? null : exactDate(status.completedAt),
    isNotUsable: status.isNotUsable,
    orderIndex: status.orderIndex,
  };
}

function hasAttachments(status: CategoryRepairStatusSnapshot): boolean {
  return status.audits.length > 0 || status.provenance.length > 0;
}

export function classifyCategoryRepairStatusState(
  status: CategoryRepairStatusSnapshot,
): "pristine" | "history-bearing" {
  const pristine = (status.usedAmount === null || status.usedAmount === 0)
    && status.isCompleted === false
    && status.completedAt === null
    && status.isNotUsable === false
    && status.orderIndex === null
    && !hasAttachments(status);
  return pristine ? "pristine" : "history-bearing";
}

function attachmentOwnersAgree(
  status: CategoryRepairStatusSnapshot,
  ownerId: string,
): boolean {
  return [...status.audits, ...status.provenance]
    .every((attachment) => attachment.ownerId === null || attachment.ownerId === ownerId);
}

function statusAttachmentGraphAgrees(input: {
  status: CategoryRepairStatusSnapshot;
  sourceKind: "legacy" | "canonical";
  ownerId: string;
  cardId: string;
  sourceBenefitId: string;
  predefinedBenefitId: string;
  definitionFingerprint: string;
}): boolean {
  const { status } = input;
  if (!attachmentOwnersAgree(status, input.ownerId)) return false;
  return status.audits.every((audit) => {
    const globalMetadataAbsent = audit.destinationPredefinedBenefitId === null
      && audit.destinationDefinitionFingerprint === null;
    const globalMetadataExact = audit.destinationPredefinedBenefitId === input.predefinedBenefitId
      && audit.destinationDefinitionFingerprint === input.definitionFingerprint;
    return audit.ownerId === input.ownerId
      && audit.destinationStatusId === status.id
      && audit.destinationCardId === input.cardId
      && audit.destinationBenefitId === (input.sourceKind === "legacy" ? input.sourceBenefitId : null)
      && (input.sourceKind === "legacy" || globalMetadataAbsent || globalMetadataExact);
  });
}

function datesOverlap(
  left: CategoryRepairStatusSnapshot,
  right: CategoryRepairStatusSnapshot,
): boolean {
  return left.cycleStartDate.getTime() <= right.cycleEndDate.getTime()
    && right.cycleStartDate.getTime() <= left.cycleEndDate.getTime();
}

function planAuditPatches(input: {
  keeper: CategoryRepairStatusSnapshot;
  keeperSourceKind: "legacy" | "canonical";
  predefinedBenefitId: string;
  definitionFingerprint: string;
}): { patches: CategoryRepairAuditPatch[]; conflict: boolean } {
  if (input.keeperSourceKind !== "legacy") return { patches: [], conflict: false };
  const patches: CategoryRepairAuditPatch[] = [];
  for (const audit of sortedAttachments(input.keeper.audits)) {
    const bothNull = audit.destinationPredefinedBenefitId === null
      && audit.destinationDefinitionFingerprint === null;
    const bothEqual = audit.destinationPredefinedBenefitId === input.predefinedBenefitId
      && audit.destinationDefinitionFingerprint === input.definitionFingerprint;
    if (!bothNull && !bothEqual) return { patches: [], conflict: true };
    patches.push({
      auditId: audit.id,
      destinationCardId: audit.destinationCardId,
      destinationBenefitId: audit.destinationBenefitId,
      destinationStatusId: input.keeper.id,
      before: {
        destinationPredefinedBenefitId: audit.destinationPredefinedBenefitId,
        destinationDefinitionFingerprint: audit.destinationDefinitionFingerprint,
        stateFingerprint: audit.stateFingerprint,
      },
      after: {
        destinationPredefinedBenefitId: input.predefinedBenefitId,
        destinationDefinitionFingerprint: input.definitionFingerprint,
        // The protected audit fingerprint deliberately excludes these two
        // canonical metadata fields and therefore remains byte-for-byte stable.
        stateFingerprint: audit.stateFingerprint,
      },
    });
  }
  return { patches, conflict: false };
}

function portableStatusPreimage(preimage: CategoryRepairStatusPreimage): unknown {
  return {
    ...preimage,
    predefinedBenefitId: preimage.predefinedBenefitId === null ? null : "catalog-bound",
  };
}

function portableAuditPatch(patch: CategoryRepairAuditPatch): unknown {
  return {
    ...patch,
    before: {
      ...patch.before,
      destinationPredefinedBenefitId: patch.before.destinationPredefinedBenefitId === null
        ? null
        : "catalog-bound",
    },
    after: {
      ...patch.after,
      destinationPredefinedBenefitId: patch.after.destinationPredefinedBenefitId === null
        ? null
        : "catalog-bound",
    },
  };
}

function portableActionInput(
  input: Omit<CategoryRepairStatusAction, "postimageFingerprint" | "actionFingerprint">,
): unknown {
  return {
    ...input,
    predefinedBenefitId: "catalog-bound",
    keeperBaseline: portableStatusPreimage(input.keeperBaseline),
    keeperAuditBaseline: input.keeperAuditBaseline.map(portableAuditFingerprintInput),
    removedPreimage: input.removedPreimage === null
      ? null
      : portableStatusPreimage(input.removedPreimage),
    repairAddedAuditMetadata: input.repairAddedAuditMetadata.map(portableAuditPatch),
  };
}

function makeAction(
  input: Omit<CategoryRepairStatusAction, "postimageFingerprint" | "actionFingerprint">,
): CategoryRepairStatusAction {
  const postimageFingerprint = migrationFingerprint({
    ...portableStatusPreimage(input.keeperBaseline) as Record<string, unknown>,
    benefitId: input.keeperSourceKind === "legacy" ? input.keeperBaseline.benefitId : null,
    creditCardId: input.creditCardId,
    predefinedBenefitId: "catalog-bound",
    repairAddedAuditMetadata: input.repairAddedAuditMetadata.map(portableAuditPatch),
  });
  const withPostimage = { ...input, postimageFingerprint };
  return {
    ...withPostimage,
    actionFingerprint: migrationFingerprint({
      action: portableActionInput(input),
      postimageFingerprint,
    }),
  };
}

function actionForKeeper(input: {
  keeper: CategoryRepairStatusSnapshot;
  keeperSourceKind: "legacy" | "canonical";
  cardId: string;
  definitionId: string;
  definitionFingerprint: string;
  removed: CategoryRepairStatusSnapshot | null;
  removedSourceKind: "legacy" | "canonical" | null;
}): { action: CategoryRepairStatusAction | null; stop: CategoryRepairStopReason | null } {
  const auditPlan = planAuditPatches({
    keeper: input.keeper,
    keeperSourceKind: input.keeperSourceKind,
    predefinedBenefitId: input.definitionId,
    definitionFingerprint: input.definitionFingerprint,
  });
  if (auditPlan.conflict) return { action: null, stop: "audit_metadata_conflict" };
  return {
    action: makeAction({
      kind: input.keeperSourceKind === "legacy"
        ? "PROMOTE_LEGACY_STATUS"
        : "RETAIN_CANONICAL_STATUS",
      userId: input.keeper.userId,
      creditCardId: input.cardId,
      predefinedBenefitId: input.definitionId,
      cycleStartDate: exactDate(input.keeper.cycleStartDate),
      cycleEndDate: exactDate(input.keeper.cycleEndDate),
      occurrenceIndex: input.keeper.occurrenceIndex,
      keeperStatusId: input.keeper.id,
      keeperSourceKind: input.keeperSourceKind,
      keeperBaselineVersion: 1,
      keeperBaseline: statusPreimage(input.keeper),
      keeperAuditBaseline: sortedAttachments(input.keeper.audits),
      keeperProvenanceBaseline: sortedAttachments(input.keeper.provenance),
      removedStatusId: input.removed?.id ?? null,
      removedSourceKind: input.removedSourceKind,
      removedPreimageVersion: input.removed ? 1 : null,
      removedPreimage: input.removed ? statusPreimage(input.removed) : null,
      repairAddedAuditMetadataVersion: 1,
      repairAddedAuditMetadata: auditPlan.patches,
    }),
    stop: null,
  };
}

function pairAction(
  legacy: CategoryRepairStatusSnapshot,
  canonical: CategoryRepairStatusSnapshot,
  cardId: string,
  definitionId: string,
  definitionFingerprint: string,
): { action: CategoryRepairStatusAction | null; stop: CategoryRepairStopReason | null } {
  const legacyAttached = hasAttachments(legacy);
  const canonicalAttached = hasAttachments(canonical);
  if (legacyAttached && canonicalAttached) return { action: null, stop: "dual_attachments" };

  const legacyClass = classifyCategoryRepairStatusState(legacy);
  const canonicalClass = classifyCategoryRepairStatusState(canonical);
  let keeper: CategoryRepairStatusSnapshot;
  let loser: CategoryRepairStatusSnapshot;
  let keeperSourceKind: "legacy" | "canonical";

  if (legacyClass === "history-bearing" && canonicalClass === "pristine") {
    keeper = legacy;
    loser = canonical;
    keeperSourceKind = "legacy";
  } else if (legacyClass === "pristine" && canonicalClass === "history-bearing") {
    keeper = canonical;
    loser = legacy;
    keeperSourceKind = "canonical";
  } else if (legacyClass === "pristine" && canonicalClass === "pristine") {
    keeper = legacy;
    loser = canonical;
    keeperSourceKind = "legacy";
  } else if (migrationFingerprint(statusMutableState(legacy))
    === migrationFingerprint(statusMutableState(canonical))) {
    if (canonicalAttached) {
      keeper = canonical;
      loser = legacy;
      keeperSourceKind = "canonical";
    } else {
      keeper = legacy;
      loser = canonical;
      keeperSourceKind = "legacy";
    }
  } else {
    return { action: null, stop: "conflicting_meaningful_state" };
  }

  if (hasAttachments(loser)) return { action: null, stop: "losing_status_attached" };
  return actionForKeeper({
    keeper,
    keeperSourceKind,
    cardId,
    definitionId,
    definitionFingerprint,
    removed: loser,
    removedSourceKind: keeperSourceKind === "legacy" ? "canonical" : "legacy",
  });
}

function hasNonExactInternalOverlap(statuses: readonly CategoryRepairStatusSnapshot[]): boolean {
  for (let leftIndex = 0; leftIndex < statuses.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < statuses.length; rightIndex += 1) {
      const left = statuses[leftIndex];
      const right = statuses[rightIndex];
      if (left.userId === right.userId
        && left.occurrenceIndex === right.occurrenceIndex
        && statusOccurrenceKey(left) !== statusOccurrenceKey(right)
        && datesOverlap(left, right)) return true;
    }
  }
  return false;
}

export function planCategoryRepairStatusActions(input: {
  ownerId: string;
  cardId: string;
  sourceBenefitId: string;
  predefinedBenefitId: string;
  definitionFingerprint: string;
  legacyStatuses: readonly CategoryRepairStatusSnapshot[];
  canonicalStatuses: readonly CategoryRepairStatusSnapshot[];
}): { actions: CategoryRepairStatusAction[]; stopReasons: CategoryRepairStopReason[] } {
  const stops = new Set<CategoryRepairStopReason>();
  const legacy = [...input.legacyStatuses].sort((left, right) =>
    statusOccurrenceKey(left).localeCompare(statusOccurrenceKey(right)) || left.id.localeCompare(right.id));
  const canonical = [...input.canonicalStatuses].sort((left, right) =>
    statusOccurrenceKey(left).localeCompare(statusOccurrenceKey(right)) || left.id.localeCompare(right.id));

  if (legacy.some((status) => status.creditCardId !== null
    || status.predefinedBenefitId !== null)
    || canonical.some((status) => status.benefitId !== null)) {
    stops.add("dual_attachments");
  }
  if (legacy.some((status) => status.userId !== input.ownerId
    || status.benefitId !== input.sourceBenefitId
    || !statusAttachmentGraphAgrees({
      status,
      sourceKind: "legacy",
      ownerId: input.ownerId,
      cardId: input.cardId,
      sourceBenefitId: input.sourceBenefitId,
      predefinedBenefitId: input.predefinedBenefitId,
      definitionFingerprint: input.definitionFingerprint,
    }))) stops.add("relationship_inconsistent");
  if (canonical.some((status) => status.userId !== input.ownerId
    || status.creditCardId !== input.cardId
    || status.predefinedBenefitId !== input.predefinedBenefitId
    || !statusAttachmentGraphAgrees({
      status,
      sourceKind: "canonical",
      ownerId: input.ownerId,
      cardId: input.cardId,
      sourceBenefitId: input.sourceBenefitId,
      predefinedBenefitId: input.predefinedBenefitId,
      definitionFingerprint: input.definitionFingerprint,
    }))) stops.add("relationship_inconsistent");

  const legacyByOccurrence = new Map<string, CategoryRepairStatusSnapshot[]>();
  const canonicalByOccurrence = new Map<string, CategoryRepairStatusSnapshot[]>();
  for (const status of legacy) {
    const key = statusOccurrenceKey(status);
    legacyByOccurrence.set(key, [...(legacyByOccurrence.get(key) ?? []), status]);
  }
  for (const status of canonical) {
    const key = statusOccurrenceKey(status);
    canonicalByOccurrence.set(key, [...(canonicalByOccurrence.get(key) ?? []), status]);
  }
  if (Array.from(legacyByOccurrence.values()).some((rows) => rows.length > 1)) {
    stops.add("duplicate_source_occurrence");
  }
  if (Array.from(canonicalByOccurrence.values()).some((rows) => rows.length > 1)) {
    stops.add("duplicate_destination_occurrence");
  }
  if (hasNonExactInternalOverlap(legacy) || hasNonExactInternalOverlap(canonical)) {
    stops.add("non_exact_overlap");
  }
  for (const left of legacy) {
    for (const right of canonical) {
      if (left.userId === right.userId
        && left.occurrenceIndex === right.occurrenceIndex
        && statusOccurrenceKey(left) !== statusOccurrenceKey(right)
        && datesOverlap(left, right)) stops.add("non_exact_overlap");
    }
  }
  if (stops.size > 0) return { actions: [], stopReasons: Array.from(stops).sort() };

  const actions: CategoryRepairStatusAction[] = [];
  const keys = new Set([
    ...Array.from(legacyByOccurrence.keys()),
    ...Array.from(canonicalByOccurrence.keys()),
  ]);
  for (const key of Array.from(keys).sort()) {
    const legacyStatus = legacyByOccurrence.get(key)?.[0];
    const canonicalStatus = canonicalByOccurrence.get(key)?.[0];
    let planned: { action: CategoryRepairStatusAction | null; stop: CategoryRepairStopReason | null };
    if (legacyStatus && canonicalStatus) {
      planned = pairAction(
        legacyStatus,
        canonicalStatus,
        input.cardId,
        input.predefinedBenefitId,
        input.definitionFingerprint,
      );
    } else {
      const keeper = legacyStatus ?? canonicalStatus!;
      const keeperSourceKind = legacyStatus ? "legacy" : "canonical";
      planned = actionForKeeper({
        keeper,
        keeperSourceKind,
        cardId: input.cardId,
        definitionId: input.predefinedBenefitId,
        definitionFingerprint: input.definitionFingerprint,
        removed: null,
        removedSourceKind: null,
      });
    }
    if (planned.stop) stops.add(planned.stop);
    else if (planned.action) actions.push(planned.action);
  }
  return stops.size > 0
    ? { actions: [], stopReasons: Array.from(stops).sort() }
    : { actions, stopReasons: [] };
}

function nonCategoryShapeMatches(
  source: CategoryRepairLegacyBenefitSnapshot,
  definition: GlobalBenefitDefinition,
): boolean {
  return NON_CATEGORY_SHAPE_FIELDS.every((field) => source[field] === definition[field]);
}

function providerIdentityAgrees(
  source: CategoryRepairLegacyBenefitSnapshot,
  definition: GlobalBenefitDefinition,
): boolean {
  return (source.productKey === null || source.productKey === definition.productKey)
    && (source.creditFamilyKey === null || source.creditFamilyKey === definition.creditFamilyKey)
    && (source.periodKey === null || source.periodKey === definition.periodKey);
}

function strictCustomSourceImmutableInput(source: CategoryRepairLegacyBenefitSnapshot): unknown {
  return {
    id: source.id,
    creditCardId: source.creditCardId,
    userId: source.userId,
    ledger: source.ledger,
    shape: {
      category: source.category,
      ...Object.fromEntries(NON_CATEGORY_SHAPE_FIELDS.map((field) => [field, source[field]])),
    },
    identity: [source.productKey, source.creditFamilyKey, source.periodKey],
  };
}

function completeCardSourceGraphInput(unit: CategoryRepairUnitSnapshot): unknown[] {
  return [...unit.cardStrictCustomSources]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((source) => ({
      immutable: strictCustomSourceImmutableInput(source),
      currentFingerprint: legacyBenefitSourceFingerprint(source),
    }));
}

function immutableGraphFingerprint(unit: CategoryRepairUnitSnapshot): string {
  return migrationFingerprint({
    sourceBenefitId: unit.source.id,
    cardId: unit.card.id,
    ownerId: unit.card.userId,
    targetCardCatalogKey: unit.predefinedCard.catalogKey,
    source: strictCustomSourceImmutableInput(unit.source),
    completeCardStrictCustomSources: unit.cardStrictCustomSources
      .map(strictCustomSourceImmutableInput)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  });
}

function currentGraphFingerprint(unit: CategoryRepairUnitSnapshot): string {
  return migrationFingerprint({
    immutableGraphFingerprint: immutableGraphFingerprint(unit),
    sourceFingerprint: legacyBenefitSourceFingerprint(unit.source),
    sourceStatuses: unit.source.statuses.map(statusFingerprintInput)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    sourceAudits: [...unit.source.audits]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(portableAuditFingerprintInput),
    sourceProvenance: [...unit.source.provenance].sort((left, right) => left.id.localeCompare(right.id)),
    destinationStatuses: unit.destinationStatuses.map(statusFingerprintInput)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    completeCardStrictCustomSourceGraph: completeCardSourceGraphInput(unit),
  });
}

function destinationGraphFingerprint(
  unit: CategoryRepairUnitSnapshot,
  definition: GlobalBenefitDefinition,
): string {
  return migrationFingerprint({
    cardId: unit.card.id,
    targetCardCatalogKey: unit.predefinedCard.catalogKey,
    targetBenefitCatalogKey: definition.catalogKey,
    definitionFingerprint: globalDefinitionFingerprint(definition),
    statuses: unit.destinationStatuses.map(statusFingerprintInput)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  });
}

function sameSortedIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

function statusAuditMatchesRelation(
  snapshot: CategoryRepairAuditSnapshot,
  relation: LegacyAuditRelation,
): boolean {
  return snapshot.id === relation.id
    && snapshot.ownerId === relation.attemptUserId
    && snapshot.destinationCardId === relation.destinationCardId
    && snapshot.destinationBenefitId === relation.destinationBenefitId
    && snapshot.destinationStatusId === relation.destinationStatusId
    && snapshot.destinationPredefinedBenefitId === relation.destinationPredefinedBenefitId
    && snapshot.destinationDefinitionFingerprint === relation.destinationDefinitionFingerprint
    && snapshot.stateFingerprint === relation.stateFingerprint;
}

function sourceRelationGraphAgrees(
  source: CategoryRepairLegacyBenefitSnapshot,
  card: CategoryRepairCardSnapshot,
): boolean {
  const sourceStatusIds = new Set(source.statuses.map((status) => status.id));
  const auditIds = new Set(source.audits.map((audit) => audit.id));
  const provenanceIds = new Set(source.provenance.map((row) => row.id));
  if (sourceStatusIds.size !== source.statuses.length
    || auditIds.size !== source.audits.length
    || provenanceIds.size !== source.provenance.length) return false;
  if (source.statuses.some((status) => status.userId !== card.userId)
    || source.audits.some((audit: LegacyAuditRelation) =>
      audit.attemptUserId !== card.userId
      || (audit.destinationCardId !== null && audit.destinationCardId !== card.id)
      || (audit.destinationBenefitId !== null && audit.destinationBenefitId !== source.id)
      || (audit.destinationStatusId !== null && !sourceStatusIds.has(audit.destinationStatusId)))) return false;
  if (source.provenance.some((row: LegacyProvenanceRelation) =>
    !sourceStatusIds.has(row.benefitStatusId)
    || (row.attemptUserId !== null && row.attemptUserId !== card.userId))) return false;
  return source.statuses.every((status) => {
    const expectedAudits = source.audits
      .filter((audit) => audit.destinationStatusId === status.id);
    const expectedProvenanceIds = source.provenance
      .filter((row) => row.benefitStatusId === status.id)
      .map((row) => row.id);
    return sameSortedIds(status.audits.map((audit) => audit.id), expectedAudits.map((audit) => audit.id))
      && status.audits.every((audit) => {
        const relation = expectedAudits.find((candidate) => candidate.id === audit.id);
        return relation !== undefined && statusAuditMatchesRelation(audit, relation);
      })
      && sameSortedIds(status.provenance.map((row) => row.id), expectedProvenanceIds);
  });
}

function relationGraphAgrees(unit: CategoryRepairUnitSnapshot): boolean {
  return sourceRelationGraphAgrees(unit.source, unit.card);
}

function sourceIsStrictCustomForCard(
  source: CategoryRepairLegacyBenefitSnapshot,
  card: CategoryRepairCardSnapshot,
): boolean {
  const ledger = source.ledger;
  return source.userId === null
    && source.creditCardId === card.id
    && ledger?.legacyBenefitId === source.id
    && ledger.userId === card.userId
    && ledger.creditCardId === card.id
    && ledger.classification === "CUSTOM"
    && ledger.phase === "CLASSIFIED"
    && ledger.predefinedCardId === null
    && ledger.predefinedBenefitId === null
    && ledger.destinationFingerprint === null
    && source.statuses.every((status) => status.benefitId === source.id
      && status.creditCardId === null
      && status.predefinedBenefitId === null);
}

function completeCardGraphAgrees(unit: CategoryRepairUnitSnapshot): boolean {
  const ids = unit.cardStrictCustomSources.map((source) => source.id);
  if (new Set(ids).size !== ids.length) return false;
  const exactSource = unit.cardStrictCustomSources.filter((source) => source.id === unit.source.id);
  return exactSource.length === 1
    && legacyBenefitSourceFingerprint(exactSource[0]) === legacyBenefitSourceFingerprint(unit.source)
    && unit.cardStrictCustomSources.every((source) =>
      sourceIsStrictCustomForCard(source, unit.card)
      && sourceRelationGraphAgrees(source, unit.card));
}

function initialStops(unit: CategoryRepairUnitSnapshot): CategoryRepairStopReason[] {
  const stops = new Set<CategoryRepairStopReason>();
  const source = unit.source;
  const ledger = source.ledger;
  if (source.userId !== null) stops.add("explicit_custom_owner");
  if (source.creditCardId !== unit.card.id) stops.add("source_not_card_linked");
  if (unit.card.predefinedCardId === null
    || unit.card.predefinedCardId !== unit.predefinedCard.id) stops.add("card_global_link_missing");
  if (!ledger || ledger.classification !== "CUSTOM" || ledger.phase !== "CLASSIFIED") {
    stops.add("ledger_not_custom_classified");
  } else if (ledger.legacyBenefitId !== source.id
    || ledger.userId !== unit.card.userId
    || ledger.creditCardId !== unit.card.id
    || ledger.predefinedCardId !== null
    || ledger.predefinedBenefitId !== null
    || ledger.destinationFingerprint !== null
    || !HEX_SHA256.test(ledger.sourceFingerprint)) {
    stops.add("ledger_graph_mismatch");
  }
  if (!relationGraphAgrees(unit) || !completeCardGraphAgrees(unit)) {
    stops.add("relationship_inconsistent");
  }
  return Array.from(stops).sort();
}

function relaxedDestinationForSource(
  unit: CategoryRepairUnitSnapshot,
  source: CategoryRepairLegacyBenefitSnapshot,
): GlobalBenefitDefinition | null {
  const matches = unit.predefinedCard.benefits
    .filter((definition) => definition.predefinedCardId === unit.predefinedCard.id)
    .filter((definition) => nonCategoryShapeMatches(source, definition))
    .filter((definition) => source.category !== definition.category)
    .filter((definition) => providerIdentityAgrees(source, definition));
  return matches.length === 1 ? matches[0] : null;
}

function hasCompleteCardDuplicateTarget(
  unit: CategoryRepairUnitSnapshot,
  definition: GlobalBenefitDefinition,
): boolean {
  return unit.cardStrictCustomSources
    .filter((source) => source.id !== unit.source.id)
    .some((source) => relaxedDestinationForSource(unit, source)?.id === definition.id);
}

function baseProposal(
  unit: CategoryRepairUnitSnapshot,
  stopReasons: CategoryRepairStopReason[],
  intent: CategoryRepairProposalIntent = "APPLY",
): CategoryRepairProposal {
  const immutable = immutableGraphFingerprint(unit);
  const current = currentGraphFingerprint(unit);
  const plan = migrationFingerprint({ immutable, current, intent, stopReasons });
  return {
    intent,
    privateKey: unit.privateKey,
    sourceBenefitId: unit.source.id,
    ownerId: unit.card.userId,
    creditCardId: unit.card.id,
    predefinedCardId: unit.predefinedCard.id,
    predefinedBenefitId: null,
    targetCardCatalogKey: unit.predefinedCard.catalogKey,
    targetBenefitCatalogKey: null,
    definitionFingerprint: null,
    immutableGraphFingerprint: immutable,
    currentGraphFingerprint: current,
    destinationFingerprint: null,
    postimageFingerprint: migrationFingerprint({ blocked: true, stopReasons }),
    planFingerprint: plan,
    evidenceFingerprint: null,
    reviewedManifestFingerprint: null,
    actions: [],
    stopReasons,
    blocked: true,
  };
}

function planInitialUnit(unit: CategoryRepairUnitSnapshot): CategoryRepairProposal {
  const initial = initialStops(unit);
  if (initial.length > 0) return baseProposal(unit, initial);

  const relaxedShapeMatches = unit.predefinedCard.benefits
    .filter((definition) => definition.predefinedCardId === unit.predefinedCard.id)
    .filter((definition) => nonCategoryShapeMatches(unit.source, definition));
  if (relaxedShapeMatches.length === 0) return baseProposal(unit, ["destination_not_found"]);
  if (relaxedShapeMatches.length > 1) return baseProposal(unit, ["destination_ambiguous"]);
  const definition = relaxedShapeMatches[0];
  if (unit.source.category === definition.category) return baseProposal(unit, ["category_not_different"]);
  if (!providerIdentityAgrees(unit.source, definition)) {
    return baseProposal(unit, ["source_identity_conflict"]);
  }
  if (hasCompleteCardDuplicateTarget(unit, definition)) {
    return baseProposal(unit, ["duplicate_target"]);
  }

  const definitionDigest = globalDefinitionFingerprint(definition);
  const statusPlan = planCategoryRepairStatusActions({
    ownerId: unit.card.userId,
    cardId: unit.card.id,
    sourceBenefitId: unit.source.id,
    predefinedBenefitId: definition.id,
    definitionFingerprint: definitionDigest,
    legacyStatuses: unit.source.statuses,
    canonicalStatuses: unit.destinationStatuses,
  });
  const immutable = immutableGraphFingerprint(unit);
  const current = currentGraphFingerprint(unit);
  const destination = destinationGraphFingerprint(unit, definition);
  const postimage = migrationFingerprint({
    sourceBenefitId: unit.source.id,
    cardId: unit.card.id,
    targetBenefitCatalogKey: definition.catalogKey,
    statusPostimages: statusPlan.actions.map((action) => action.postimageFingerprint),
  });
  const plan = migrationFingerprint({
    immutableGraphFingerprint: immutable,
    currentGraphFingerprint: current,
    destinationFingerprint: destination,
    postimageFingerprint: postimage,
    actionFingerprints: statusPlan.actions.map((action) => action.actionFingerprint),
    stopReasons: statusPlan.stopReasons,
  });
  return {
    intent: "APPLY",
    privateKey: unit.privateKey,
    sourceBenefitId: unit.source.id,
    ownerId: unit.card.userId,
    creditCardId: unit.card.id,
    predefinedCardId: unit.predefinedCard.id,
    predefinedBenefitId: definition.id,
    targetCardCatalogKey: unit.predefinedCard.catalogKey,
    targetBenefitCatalogKey: definition.catalogKey,
    definitionFingerprint: definitionDigest,
    immutableGraphFingerprint: immutable,
    currentGraphFingerprint: current,
    destinationFingerprint: destination,
    postimageFingerprint: postimage,
    planFingerprint: plan,
    evidenceFingerprint: null,
    reviewedManifestFingerprint: null,
    actions: statusPlan.actions,
    stopReasons: statusPlan.stopReasons,
    blocked: statusPlan.stopReasons.length > 0,
  };
}

function actionFingerprintIsValid(action: CategoryRepairStatusAction): boolean {
  if (action.keeperBaselineVersion !== 1
    || action.repairAddedAuditMetadataVersion !== 1
    || (action.removedStatusId === null) !== (action.removedPreimage === null)
    || (action.removedStatusId === null) !== (action.removedSourceKind === null)
    || (action.removedStatusId === null) !== (action.removedPreimageVersion === null)) return false;
  const { actionFingerprint, postimageFingerprint, ...input } = action;
  const rebuilt = makeAction(input);
  return rebuilt.postimageFingerprint === postimageFingerprint
    && rebuilt.actionFingerprint === actionFingerprint;
}

function evidenceStableFingerprint(evidence: CategoryRepairEvidenceSnapshot): string {
  const stable: Partial<CategoryRepairEvidenceSnapshot> = { ...evidence };
  delete stable.phase;
  return migrationFingerprint(stable);
}

function manifestEntryBodyFromEvidence(
  unit: CategoryRepairUnitSnapshot,
  evidence: CategoryRepairEvidenceSnapshot,
): Omit<CategoryRepairManifestEntry, "entryFingerprint"> {
  return {
    privateKey: unit.privateKey,
    sourceBenefitId: evidence.sourceBenefitId,
    ownerId: evidence.ownerId,
    creditCardId: evidence.creditCardId,
    predefinedCardId: evidence.predefinedCardId,
    predefinedBenefitId: evidence.predefinedBenefitId,
    targetCardCatalogKey: evidence.targetCardCatalogKey,
    targetBenefitCatalogKey: evidence.targetBenefitCatalogKey,
    definitionFingerprint: evidence.definitionFingerprint,
    immutableGraphFingerprint: evidence.immutableGraphFingerprint,
    currentGraphFingerprint: evidence.reviewedCurrentGraphFingerprint,
    destinationFingerprint: evidence.destinationFingerprint,
    postimageFingerprint: evidence.postimageFingerprint,
    planFingerprint: evidence.planFingerprint,
  };
}

function allCurrentStatuses(unit: CategoryRepairUnitSnapshot): Map<string, CategoryRepairStatusSnapshot> {
  const result = new Map<string, CategoryRepairStatusSnapshot>();
  for (const status of [...unit.source.statuses, ...unit.destinationStatuses]) {
    const existing = result.get(status.id);
    if (existing && migrationFingerprint(statusFingerprintInput(existing))
      !== migrationFingerprint(statusFingerprintInput(status))) {
      return new Map();
    }
    result.set(status.id, status);
  }
  return result;
}

function auditMatchesValue(
  audit: CategoryRepairAuditSnapshot,
  patch: CategoryRepairAuditPatch,
  value: CategoryRepairAuditMetadataValue,
): boolean {
  return audit.id === patch.auditId
    && audit.destinationCardId === patch.destinationCardId
    && audit.destinationBenefitId === patch.destinationBenefitId
    && audit.destinationStatusId === patch.destinationStatusId
    && audit.destinationPredefinedBenefitId === value.destinationPredefinedBenefitId
    && audit.destinationDefinitionFingerprint === value.destinationDefinitionFingerprint
    && audit.stateFingerprint === value.stateFingerprint;
}

function currentKeeperAttachmentsAgree(
  status: CategoryRepairStatusSnapshot,
  action: CategoryRepairStatusAction,
  phase: CategoryRepairEvidenceSnapshot["phase"],
): boolean {
  if (!sameSortedIds(
    status.provenance.map((row) => row.id),
    action.keeperProvenanceBaseline.map((row) => row.id),
  ) || status.provenance.some((row) => {
    const baseline = action.keeperProvenanceBaseline.find((candidate) => candidate.id === row.id);
    return baseline === undefined || migrationFingerprint(row) !== migrationFingerprint(baseline);
  })) return false;
  if (!sameSortedIds(
    status.audits.map((audit) => audit.id),
    action.keeperAuditBaseline.map((audit) => audit.id),
  )) return false;
  return status.audits.every((audit) => {
    const baseline = action.keeperAuditBaseline.find((candidate) => candidate.id === audit.id);
    if (!baseline) return false;
    const patch = action.repairAddedAuditMetadata.find((candidate) => candidate.auditId === audit.id);
    if (!patch) return migrationFingerprint(audit) === migrationFingerprint(baseline);
    return audit.ownerId === baseline.ownerId
      && auditMatchesValue(audit, patch, phase === "APPLIED" ? patch.after : patch.before);
  });
}

function statusMatchesPreimage(
  status: CategoryRepairStatusSnapshot,
  preimage: CategoryRepairStatusPreimage,
): boolean {
  return migrationFingerprint(statusPreimage(status)) === migrationFingerprint(preimage)
    && status.audits.length === 0
    && status.provenance.length === 0;
}

function evidenceCurrentGraphAgrees(
  unit: CategoryRepairUnitSnapshot,
  evidence: CategoryRepairEvidenceSnapshot,
): boolean {
  const statuses = allCurrentStatuses(unit);
  if (statuses.size === 0 && evidence.occurrences.length > 0) return false;
  for (const action of evidence.occurrences) {
    const keeper = statuses.get(action.keeperStatusId);
    if (!keeper
      || keeper.userId !== action.userId
      || keeper.creditCardId !== (evidence.phase === "APPLIED" || action.keeperSourceKind === "canonical"
        ? action.creditCardId
        : null)
      || keeper.predefinedBenefitId !== (evidence.phase === "APPLIED" || action.keeperSourceKind === "canonical"
        ? action.predefinedBenefitId
        : null)
      || keeper.benefitId !== (action.keeperSourceKind === "legacy" ? unit.source.id : null)
      || exactDate(keeper.cycleStartDate) !== action.cycleStartDate
      || exactDate(keeper.cycleEndDate) !== action.cycleEndDate
      || keeper.occurrenceIndex !== action.occurrenceIndex
      || exactDate(keeper.createdAt) !== action.keeperBaseline.createdAt
      || !currentKeeperAttachmentsAgree(keeper, action, evidence.phase)) return false;
    if (action.removedStatusId !== null) {
      const removed = statuses.get(action.removedStatusId);
      if (evidence.phase === "APPLIED" && removed) return false;
      if (evidence.phase === "ROLLED_BACK"
        && (!removed || !action.removedPreimage || !statusMatchesPreimage(removed, action.removedPreimage))) {
        return false;
      }
    }
  }
  return true;
}

function evidenceIsStructurallyValid(
  unit: CategoryRepairUnitSnapshot,
  evidence: CategoryRepairEvidenceSnapshot,
  definition: GlobalBenefitDefinition,
): boolean {
  if (evidence.evidenceVersion !== 1
    || !HEX_SHA256.test(evidence.inventoryFingerprint)
    || !HEX_SHA256.test(evidence.manifestFingerprint)
    || evidence.sourceBenefitId !== unit.source.id
    || evidence.ownerId !== unit.card.userId
    || evidence.creditCardId !== unit.card.id
    || evidence.predefinedCardId !== unit.predefinedCard.id
    || evidence.predefinedBenefitId !== definition.id
    || evidence.targetCardCatalogKey !== unit.predefinedCard.catalogKey
    || evidence.targetBenefitCatalogKey !== definition.catalogKey
    || evidence.definitionFingerprint !== globalDefinitionFingerprint(definition)
    || evidence.immutableGraphFingerprint !== immutableGraphFingerprint(unit)
    || evidence.occurrences.some((action) => !actionFingerprintIsValid(action))) return false;
  const keeperIds = evidence.occurrences.map((action) => action.keeperStatusId);
  const removedIds = evidence.occurrences
    .map((action) => action.removedStatusId)
    .filter((id): id is string => id !== null);
  const tuples = evidence.occurrences.map((action) => [
    action.userId,
    action.creditCardId,
    action.predefinedBenefitId,
    action.cycleStartDate,
    action.cycleEndDate,
    action.occurrenceIndex,
  ].join("|"));
  if (new Set(keeperIds).size !== keeperIds.length
    || new Set(removedIds).size !== removedIds.length
    || new Set(tuples).size !== tuples.length
    || keeperIds.some((id) => removedIds.includes(id))) return false;
  const expectedPostimage = migrationFingerprint({
    sourceBenefitId: unit.source.id,
    cardId: unit.card.id,
    targetBenefitCatalogKey: definition.catalogKey,
    statusPostimages: evidence.occurrences.map((action) => action.postimageFingerprint),
  });
  const expectedPlan = migrationFingerprint({
    immutableGraphFingerprint: evidence.immutableGraphFingerprint,
    currentGraphFingerprint: evidence.reviewedCurrentGraphFingerprint,
    destinationFingerprint: evidence.destinationFingerprint,
    postimageFingerprint: evidence.postimageFingerprint,
    actionFingerprints: evidence.occurrences.map((action) => action.actionFingerprint),
    stopReasons: [],
  });
  const entryBody = manifestEntryBodyFromEvidence(unit, evidence);
  return evidence.postimageFingerprint === expectedPostimage
    && evidence.planFingerprint === expectedPlan
    && evidence.manifestEntryFingerprint === categoryRepairManifestEntryFingerprint(entryBody)
    && evidenceCurrentGraphAgrees(unit, evidence);
}

function proposalFromEvidence(
  unit: CategoryRepairUnitSnapshot,
  evidence: CategoryRepairEvidenceSnapshot,
  intent: "APPLY_REPLAY" | "ROLLBACK" | "ROLLBACK_REPLAY",
): CategoryRepairProposal {
  const stableEvidenceFingerprint = evidenceStableFingerprint(evidence);
  const rollbackPlanFingerprint = migrationFingerprint({
    operation: "rollback",
    evidenceFingerprint: stableEvidenceFingerprint,
    originalPlanFingerprint: evidence.planFingerprint,
    originalPostimageFingerprint: evidence.postimageFingerprint,
  });
  return {
    intent,
    privateKey: unit.privateKey,
    sourceBenefitId: evidence.sourceBenefitId,
    ownerId: evidence.ownerId,
    creditCardId: evidence.creditCardId,
    predefinedCardId: evidence.predefinedCardId,
    predefinedBenefitId: evidence.predefinedBenefitId,
    targetCardCatalogKey: evidence.targetCardCatalogKey,
    targetBenefitCatalogKey: evidence.targetBenefitCatalogKey,
    definitionFingerprint: evidence.definitionFingerprint,
    immutableGraphFingerprint: evidence.immutableGraphFingerprint,
    currentGraphFingerprint: evidence.reviewedCurrentGraphFingerprint,
    destinationFingerprint: evidence.destinationFingerprint,
    postimageFingerprint: evidence.postimageFingerprint,
    planFingerprint: intent === "APPLY_REPLAY" ? evidence.planFingerprint : rollbackPlanFingerprint,
    evidenceFingerprint: stableEvidenceFingerprint,
    reviewedManifestFingerprint: evidence.manifestFingerprint,
    actions: evidence.occurrences,
    stopReasons: [],
    blocked: false,
  };
}

export function planGlobalBenefitCategoryRepairUnit(
  unit: CategoryRepairUnitSnapshot,
  mode: GlobalBenefitCategoryRepairMode = "discover",
): CategoryRepairProposal {
  const evidence = unit.repairEvidence;
  if (!evidence) {
    if (mode === "rollback" || mode === "rollback-preview") {
      return baseProposal(unit, ["repair_evidence_missing"], "ROLLBACK");
    }
    return planInitialUnit(unit);
  }
  const definition = unit.predefinedCard.benefits.find((candidate) =>
    candidate.id === evidence.predefinedBenefitId
    && candidate.catalogKey === evidence.targetBenefitCatalogKey);
  if (!definition || !evidenceIsStructurallyValid(unit, evidence, definition)) {
    return baseProposal(
      unit,
      ["repair_evidence_invalid"],
      mode === "rollback" || mode === "rollback-preview" ? "ROLLBACK" : "APPLY",
    );
  }
  if (mode === "rollback" || mode === "rollback-preview") {
    return proposalFromEvidence(
      unit,
      evidence,
      evidence.phase === "APPLIED" ? "ROLLBACK" : "ROLLBACK_REPLAY",
    );
  }
  if (mode === "apply") {
    if (evidence.phase === "APPLIED") return proposalFromEvidence(unit, evidence, "APPLY_REPLAY");
    const reapplied = planInitialUnit(unit);
    return reapplied.blocked ? reapplied : { ...reapplied, evidenceFingerprint: evidenceStableFingerprint(evidence) };
  }
  if (evidence.phase === "APPLIED") {
    return baseProposal(unit, ["repair_phase_conflict"]);
  }
  return planInitialUnit(unit);
}

export function categoryRepairInventoryFingerprint(
  units: readonly CategoryRepairUnitSnapshot[],
): string {
  const entries = [...units].sort(comparePrivateKey).map((unit) => ({
    privateKey: unit.privateKey,
    sourceBenefitId: unit.source.id,
    immutableGraphFingerprint: immutableGraphFingerprint(unit),
  }));
  return migrationFingerprint({
    namespace: "global-benefit-category-repair/inventory/v1",
    entries,
  });
}

export function discoverGlobalBenefitCategoryRepairs(
  units: readonly CategoryRepairUnitSnapshot[],
  completeInventoryFingerprint = categoryRepairInventoryFingerprint(units),
  mode: GlobalBenefitCategoryRepairMode = "discover",
): CategoryRepairDiscoveryResult {
  if (!HEX_SHA256.test(completeInventoryFingerprint)) {
    throw new GlobalBenefitCategoryRepairError("The complete strict-custom inventory fingerprint is invalid.");
  }
  const sorted = [...units].sort(comparePrivateKey);
  return {
    inventoryFingerprint: completeInventoryFingerprint,
    proposals: sorted.map((unit) => planGlobalBenefitCategoryRepairUnit(unit, mode)),
  };
}

function portableManifestEntryBody(
  entry: Omit<CategoryRepairManifestEntry, "entryFingerprint">,
): unknown {
  return {
    ...entry,
    predefinedCardId: "catalog-bound",
    predefinedBenefitId: "catalog-bound",
  };
}

export function categoryRepairManifestEntryFingerprint(
  entry: Omit<CategoryRepairManifestEntry, "entryFingerprint">,
): string {
  return migrationFingerprint(portableManifestEntryBody(entry));
}

export function categoryRepairManifestFingerprint(body: {
  version: number;
  inventoryFingerprint: string;
  pageFingerprint: string;
  afterCursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  entries: CategoryRepairManifestEntry[];
}): string {
  return migrationFingerprint({
    ...body,
    entries: body.entries.map(({ entryFingerprint, ...entry }) => ({
      ...portableManifestEntryBody(entry) as Record<string, unknown>,
      entryFingerprint,
    })),
  });
}

function manifestEntryFromProposal(proposal: CategoryRepairProposal): CategoryRepairManifestEntry {
  if (proposal.blocked
    || proposal.intent !== "APPLY"
    || proposal.predefinedBenefitId === null
    || proposal.targetCardCatalogKey === null
    || proposal.targetBenefitCatalogKey === null
    || proposal.definitionFingerprint === null
    || proposal.destinationFingerprint === null) {
    throw new GlobalBenefitCategoryRepairError("A blocked or non-discovery repair proposal cannot enter a manifest.");
  }
  const entryWithoutFingerprint = {
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
  return {
    ...entryWithoutFingerprint,
    entryFingerprint: categoryRepairManifestEntryFingerprint(entryWithoutFingerprint),
  };
}

export function buildGlobalBenefitCategoryRepairManifest(
  discovery: CategoryRepairDiscoveryResult,
  page: {
    afterCursor?: string | null;
    nextCursor?: string | null;
    hasMore?: boolean;
  } = {},
): GlobalBenefitCategoryRepairManifest {
  const entries = discovery.proposals
    .filter((proposal) => !proposal.blocked)
    .map(manifestEntryFromProposal)
    .sort((left, right) => left.privateKey.localeCompare(right.privateKey));
  const body = {
    version: GLOBAL_BENEFIT_CATEGORY_REPAIR_MANIFEST_VERSION,
    inventoryFingerprint: discovery.inventoryFingerprint,
    pageFingerprint: categoryRepairPageFingerprint(discovery.proposals),
    afterCursor: page.afterCursor ?? null,
    nextCursor: page.nextCursor ?? null,
    hasMore: page.hasMore ?? false,
    entries,
  };
  return { ...body, manifestFingerprint: categoryRepairManifestFingerprint(body) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

const MANIFEST_ENTRY_KEYS = [
  "privateKey", "sourceBenefitId", "ownerId", "creditCardId", "predefinedCardId",
  "predefinedBenefitId", "targetCardCatalogKey", "targetBenefitCatalogKey",
  "definitionFingerprint", "immutableGraphFingerprint", "currentGraphFingerprint",
  "destinationFingerprint", "postimageFingerprint", "planFingerprint", "entryFingerprint",
] as const;

export function validateGlobalBenefitCategoryRepairManifest(
  value: unknown,
  expectedInventoryFingerprint?: string,
): GlobalBenefitCategoryRepairManifest {
  if (!isPlainObject(value)
    || !hasExactKeys(value, [
      "version", "inventoryFingerprint", "pageFingerprint", "afterCursor",
      "nextCursor", "hasMore", "entries", "manifestFingerprint",
    ])
    || value.version !== GLOBAL_BENEFIT_CATEGORY_REPAIR_MANIFEST_VERSION
    || typeof value.inventoryFingerprint !== "string"
    || !HEX_SHA256.test(value.inventoryFingerprint)
    || typeof value.pageFingerprint !== "string"
    || !HEX_SHA256.test(value.pageFingerprint)
    || (value.afterCursor !== null && (typeof value.afterCursor !== "string"
      || !/^gbr1\.[a-f0-9]{32}$/.test(value.afterCursor)))
    || (value.nextCursor !== null && (typeof value.nextCursor !== "string"
      || !/^gbr1\.[a-f0-9]{32}$/.test(value.nextCursor)))
    || typeof value.hasMore !== "boolean"
    || (value.hasMore !== (value.nextCursor !== null))
    || typeof value.manifestFingerprint !== "string"
    || !HEX_SHA256.test(value.manifestFingerprint)
    || !Array.isArray(value.entries)) {
    throw new GlobalBenefitCategoryRepairError("The private repair manifest is invalid.");
  }
  if (expectedInventoryFingerprint !== undefined
    && value.inventoryFingerprint !== expectedInventoryFingerprint) {
    throw new GlobalBenefitCategoryRepairError("The strict-custom inventory fingerprint changed.");
  }
  const entries: CategoryRepairManifestEntry[] = [];
  for (const rawEntry of value.entries) {
    if (!isPlainObject(rawEntry)
      || !hasExactKeys(rawEntry, MANIFEST_ENTRY_KEYS)
      || MANIFEST_ENTRY_KEYS.some((key) => typeof rawEntry[key] !== "string")
      || [
        "definitionFingerprint", "immutableGraphFingerprint", "currentGraphFingerprint",
        "destinationFingerprint", "postimageFingerprint", "planFingerprint", "entryFingerprint",
      ].some((key) => !HEX_SHA256.test(rawEntry[key] as string))) {
      throw new GlobalBenefitCategoryRepairError("The private repair manifest is invalid.");
    }
    const entry = rawEntry as unknown as CategoryRepairManifestEntry;
    const { entryFingerprint, ...body } = entry;
    if (entryFingerprint !== categoryRepairManifestEntryFingerprint(body)) {
      throw new GlobalBenefitCategoryRepairError("A private repair manifest entry was modified.");
    }
    entries.push({ ...entry });
  }
  if (entries.some((entry, index) => index > 0
    && entry.privateKey <= entries[index - 1].privateKey)) {
    throw new GlobalBenefitCategoryRepairError("The private repair manifest is not uniquely ordered.");
  }
  const body = {
    version: GLOBAL_BENEFIT_CATEGORY_REPAIR_MANIFEST_VERSION,
    inventoryFingerprint: value.inventoryFingerprint,
    pageFingerprint: value.pageFingerprint as string,
    afterCursor: value.afterCursor as string | null,
    nextCursor: value.nextCursor as string | null,
    hasMore: value.hasMore as boolean,
    entries,
  };
  if (value.manifestFingerprint !== categoryRepairManifestFingerprint(body)) {
    throw new GlobalBenefitCategoryRepairError("The private repair manifest fingerprint is invalid.");
  }
  return { ...body, manifestFingerprint: value.manifestFingerprint };
}

function repairCursorDigest(privateKey: string): string {
  return createHash("md5")
    .update(`global-benefit-category-repair/v1:${privateKey}`)
    .digest("hex");
}

export function encodeGlobalBenefitCategoryRepairCursor(privateKey: string): string {
  if (privateKey.length === 0) {
    throw new GlobalBenefitCategoryRepairError("The repair cursor source is invalid.");
  }
  return `gbr1.${repairCursorDigest(privateKey)}`;
}

export function decodeGlobalBenefitCategoryRepairCursor(
  cursor: string | undefined,
): string | null {
  if (cursor === undefined) return null;
  if (!/^gbr1\.[a-f0-9]{32}$/.test(cursor)) {
    throw new GlobalBenefitCategoryRepairError("The repair cursor is invalid.");
  }
  return cursor.slice("gbr1.".length);
}

function validateWriteGates(input: {
  mode: GlobalBenefitCategoryRepairMode;
  targetVerified?: boolean;
  recoveryPointVerified?: boolean;
  amexOffVerified?: boolean;
  confirmation?: string;
  expectedInventoryFingerprint?: string;
  expectedManifestFingerprint?: string;
  expectedPageFingerprint?: string;
  manifest?: unknown;
}): GlobalBenefitCategoryRepairManifest | null {
  if (input.targetVerified !== true) {
    throw new GlobalBenefitCategoryRepairError(
      "Category-repair database access requires target verification.",
    );
  }
  if (input.mode === "discover") {
    if (input.manifest !== undefined) {
      throw new GlobalBenefitCategoryRepairError("Discovery does not accept write-authority manifest input.");
    }
    return null;
  }
  if (input.mode === "dry-run" || input.mode === "rollback-preview") {
    if (input.manifest === undefined) {
      throw new GlobalBenefitCategoryRepairError(
        input.mode === "rollback-preview"
          ? "A rollback preview requires the original private discovery manifest."
          : "A repair dry-run requires a private discovery manifest.",
      );
    }
    return validateGlobalBenefitCategoryRepairManifest(input.manifest);
  }
  if (input.recoveryPointVerified !== true) {
    throw new GlobalBenefitCategoryRepairError("A repair write requires a verified recovery point.");
  }
  if (input.amexOffVerified !== true) {
    throw new GlobalBenefitCategoryRepairError("A repair write requires effective AMEX off verification.");
  }
  const expectedConfirmation = input.mode === "apply"
    ? GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION
    : GLOBAL_BENEFIT_CATEGORY_REPAIR_ROLLBACK_CONFIRMATION;
  if (input.confirmation !== expectedConfirmation) {
    throw new GlobalBenefitCategoryRepairError("A repair write requires its exact confirmation phrase.");
  }
  if (!input.expectedInventoryFingerprint || !HEX_SHA256.test(input.expectedInventoryFingerprint)
    || !input.expectedManifestFingerprint || !HEX_SHA256.test(input.expectedManifestFingerprint)
    || !input.expectedPageFingerprint || !HEX_SHA256.test(input.expectedPageFingerprint)) {
    throw new GlobalBenefitCategoryRepairError("A repair write requires reviewed inventory, manifest, and page fingerprints.");
  }
  const manifest = validateGlobalBenefitCategoryRepairManifest(
    input.manifest,
    input.expectedInventoryFingerprint,
  );
  if (manifest.manifestFingerprint !== input.expectedManifestFingerprint) {
    throw new GlobalBenefitCategoryRepairError("The private repair manifest does not match the reviewed fingerprint.");
  }
  return manifest;
}

export function categoryRepairPageFingerprint(
  proposals: readonly CategoryRepairProposal[],
): string {
  return migrationFingerprint(proposals.map((proposal) => ({
    privateKey: proposal.privateKey,
    planFingerprint: proposal.planFingerprint,
  })));
}

function manifestEntryMatchesProposal(
  entry: CategoryRepairManifestEntry,
  proposal: CategoryRepairProposal,
  manifestFingerprint: string,
): boolean {
  if (proposal.intent === "APPLY") {
    try {
      return entry.entryFingerprint === manifestEntryFromProposal(proposal).entryFingerprint;
    } catch {
      return false;
    }
  }
  return proposal.evidenceFingerprint !== null
    && proposal.reviewedManifestFingerprint === manifestFingerprint
    && entry.privateKey === proposal.privateKey
    && entry.sourceBenefitId === proposal.sourceBenefitId
    && entry.predefinedBenefitId === proposal.predefinedBenefitId
    && entry.entryFingerprint === categoryRepairManifestEntryFingerprint({
      privateKey: proposal.privateKey,
      sourceBenefitId: proposal.sourceBenefitId,
      ownerId: proposal.ownerId,
      creditCardId: proposal.creditCardId,
      predefinedCardId: proposal.predefinedCardId,
      predefinedBenefitId: proposal.predefinedBenefitId!,
      targetCardCatalogKey: proposal.targetCardCatalogKey!,
      targetBenefitCatalogKey: proposal.targetBenefitCatalogKey!,
      definitionFingerprint: proposal.definitionFingerprint!,
      immutableGraphFingerprint: proposal.immutableGraphFingerprint,
      currentGraphFingerprint: proposal.currentGraphFingerprint,
      destinationFingerprint: proposal.destinationFingerprint!,
      postimageFingerprint: proposal.postimageFingerprint,
      planFingerprint: proposal.intent === "APPLY_REPLAY"
        ? proposal.planFingerprint
        : entry.planFingerprint,
    });
}

function increment<K extends string>(target: Partial<Record<K, number>>, key: K): void {
  target[key] = (target[key] ?? 0) + 1;
}

export async function runGlobalBenefitCategoryRepairOperator(input: {
  mode?: GlobalBenefitCategoryRepairMode;
  limit?: number;
  after?: string;
  targetVerified?: boolean;
  recoveryPointVerified?: boolean;
  amexOffVerified?: boolean;
  confirmation?: string;
  expectedInventoryFingerprint?: string;
  expectedManifestFingerprint?: string;
  expectedPageFingerprint?: string;
  manifest?: unknown;
  onDiscoveryManifest?: (manifest: GlobalBenefitCategoryRepairManifest) => Promise<void>;
  database: GlobalBenefitCategoryRepairDatabase;
}): Promise<GlobalBenefitCategoryRepairReport> {
  const mode = input.mode ?? "dry-run";
  if (mode !== "discover" && input.onDiscoveryManifest) {
    throw new GlobalBenefitCategoryRepairError("Private manifest output is available only in discovery mode.");
  }
  const manifest = validateWriteGates({ ...input, mode });
  const limit = input.limit ?? GLOBAL_BENEFIT_CATEGORY_REPAIR_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > GLOBAL_BENEFIT_CATEGORY_REPAIR_MAX_LIMIT) {
    throw new GlobalBenefitCategoryRepairError(
      `The repair limit must be between 1 and ${GLOBAL_BENEFIT_CATEGORY_REPAIR_MAX_LIMIT}.`,
    );
  }
  const afterCursorDigest = decodeGlobalBenefitCategoryRepairCursor(input.after);
  const snapshot = await input.database.readBatch({ mode, afterCursorDigest, limit });
  if (snapshot.units.length > limit) {
    throw new GlobalBenefitCategoryRepairError("The database returned an unbounded repair batch.");
  }
  if (!HEX_SHA256.test(snapshot.inventoryFingerprint)) {
    throw new GlobalBenefitCategoryRepairError("The database returned an invalid inventory fingerprint.");
  }
  if (snapshot.units.some((unit, index) => index > 0
    && unit.privateKey <= snapshot.units[index - 1].privateKey)) {
    throw new GlobalBenefitCategoryRepairError("The database returned a non-deterministic repair batch.");
  }
  const manifestAuthorityKeys = new Set(manifest?.entries.map((entry) => entry.privateKey) ?? []);
  const manifestUnits = snapshot.units.filter((unit) => manifestAuthorityKeys.has(unit.privateKey));
  if (manifest && manifestUnits.length !== manifest.entries.length) {
    throw new GlobalBenefitCategoryRepairError(
      "The repair page does not contain every manifest-authorized definition.",
    );
  }
  const manifestUnitsAreApplied = manifestUnits.length > 0
    && manifestUnits.every((unit) => unit.repairEvidence?.phase === "APPLIED");
  const relationScopedEvidenceAuthority = mode === "rollback"
    || mode === "rollback-preview"
    || (mode === "apply" && manifestUnitsAreApplied);
  if (relationScopedEvidenceAuthority) {
    if (!manifest || manifestUnits.some((unit) =>
      unit.repairEvidence === null
      || unit.repairEvidence.inventoryFingerprint !== manifest.inventoryFingerprint
      || unit.repairEvidence.manifestFingerprint !== manifest.manifestFingerprint)) {
      throw new GlobalBenefitCategoryRepairError(
        "The repair page mixes incompatible historical evidence authority.",
      );
    }
  } else if (manifest && snapshot.inventoryFingerprint !== manifest.inventoryFingerprint) {
    // Fresh discovery/dry-run/apply and ROLLED_BACK reapply use the current
    // complete membership digest. Historical APPLIED replay/rollback is scoped
    // to its exact stored evidence and intentionally ignores unrelated inventory.
    throw new GlobalBenefitCategoryRepairError("The strict-custom inventory fingerprint changed.");
  }
  const authorityInventoryFingerprint = relationScopedEvidenceAuthority
    ? manifest!.inventoryFingerprint
    : snapshot.inventoryFingerprint;
  if ((mode === "apply" || mode === "rollback")
    && authorityInventoryFingerprint !== input.expectedInventoryFingerprint) {
    throw new GlobalBenefitCategoryRepairError("The reviewed inventory authority changed.");
  }

  const discovery = discoverGlobalBenefitCategoryRepairs(
    snapshot.units,
    snapshot.inventoryFingerprint,
    mode,
  );
  const pageFingerprint = categoryRepairPageFingerprint(discovery.proposals);
  const lastPrivateKey = snapshot.units.at(-1)?.privateKey ?? null;
  const nextCursor = snapshot.hasMore && lastPrivateKey
    ? encodeGlobalBenefitCategoryRepairCursor(lastPrivateKey)
    : null;
  if ((mode === "apply" || mode === "rollback")
    && pageFingerprint !== input.expectedPageFingerprint) {
    throw new GlobalBenefitCategoryRepairError("The repair page changed after review.");
  }
  if (manifest && (
    (mode !== "rollback" && mode !== "rollback-preview"
      && manifest.pageFingerprint !== pageFingerprint)
    || manifest.afterCursor !== (input.after ?? null)
    || manifest.nextCursor !== nextCursor
    || manifest.hasMore !== snapshot.hasMore
  )) {
    throw new GlobalBenefitCategoryRepairError("The private repair manifest page boundary changed.");
  }
  const safeProposalKeys = discovery.proposals
    .filter((proposal) => !proposal.blocked)
    .map((proposal) => proposal.privateKey);
  const manifestProposalKeys = manifest?.entries.map((entry) => entry.privateKey) ?? safeProposalKeys;
  if (manifest && !sameSortedIds(safeProposalKeys, manifestProposalKeys)) {
    throw new GlobalBenefitCategoryRepairError("The private repair manifest does not cover the exact reviewed page.");
  }
  const discoveredManifest = mode === "discover"
    ? buildGlobalBenefitCategoryRepairManifest(discovery, {
      afterCursor: input.after ?? null,
      nextCursor,
      hasMore: snapshot.hasMore,
    })
    : null;
  if (discoveredManifest && input.onDiscoveryManifest) {
    await input.onDiscoveryManifest(discoveredManifest);
  }

  const counts: GlobalBenefitCategoryRepairReport["counts"] = {
    definitionsExamined: discovery.proposals.length,
    proposed: 0,
    blocked: 0,
    statusActions: 0,
    applied: 0,
    rolledBack: 0,
    idempotent: 0,
  };
  const actions: GlobalBenefitCategoryRepairReport["actions"] = {};
  const stops: GlobalBenefitCategoryRepairReport["stops"] = {};
  const manifestByPrivateKey = new Map(manifest?.entries.map((entry) => [entry.privateKey, entry]) ?? []);
  if (manifest && (mode === "apply" || mode === "rollback" || mode === "rollback-preview")) {
    const unauthorized = discovery.proposals
      .filter((proposal) => !proposal.blocked)
      .some((proposal) => {
        const entry = manifestByPrivateKey.get(proposal.privateKey);
        return !entry || !manifestEntryMatchesProposal(
          entry,
          proposal,
          manifest.manifestFingerprint,
        );
      });
    if (unauthorized) {
      throw new GlobalBenefitCategoryRepairError(
        "The reviewed manifest does not authorize the complete repair page.",
      );
    }
  }

  for (const proposal of discovery.proposals) {
    if (proposal.blocked) {
      counts.blocked += 1;
      proposal.stopReasons.forEach((reason) => increment(stops, reason));
      continue;
    }
    counts.proposed += 1;
    counts.statusActions += proposal.actions.length;
    proposal.actions.forEach((action) => increment(actions, action.kind));
    if (mode === "discover" || mode === "dry-run" || mode === "rollback-preview") continue;
    const manifestEntry = manifestByPrivateKey.get(proposal.privateKey);
    if (!manifestEntry || !manifestEntryMatchesProposal(
      manifestEntry,
      proposal,
      manifest!.manifestFingerprint,
    )) {
      throw new GlobalBenefitCategoryRepairError("The reviewed manifest does not authorize this repair definition.");
    }
    const authority: CategoryRepairReviewedAuthorityContext = {
      mode,
      inventoryFingerprint: authorityInventoryFingerprint,
      manifestFingerprint: manifest!.manifestFingerprint,
      pageFingerprint,
      afterCursor: input.after ?? null,
      nextCursor,
      hasMore: snapshot.hasMore,
    };
    const result = mode === "apply"
      ? await input.database.applyRepair(proposal, manifestEntry, authority)
      : await input.database.rollbackRepair(proposal, manifestEntry, authority);
    counts.applied += result.applied;
    counts.rolledBack += result.rolledBack;
    counts.idempotent += result.idempotent;
  }

  return {
    mode,
    limit,
    hasMore: snapshot.hasMore,
    nextCursor,
    inventoryFingerprint: authorityInventoryFingerprint,
    pageFingerprint,
    manifestFingerprint: manifest?.manifestFingerprint
      ?? discoveredManifest?.manifestFingerprint
      ?? null,
    counts,
    actions,
    stops,
  };
}
