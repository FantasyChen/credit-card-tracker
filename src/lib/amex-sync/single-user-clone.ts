import { migrationFingerprint } from "@/lib/global-benefit-migration";
import type {
  AmexSyncAttempt,
  AmexSyncRowAudit,
  Benefit,
  BenefitStatus,
  BenefitStatusSourceProvenance,
  CreditCard,
  CreditCardEvent,
  ExternalCardMapping,
  LoyaltyAccount,
  LoyaltyCertificate,
  User,
} from "@/generated/prisma";

export const PRODUCTION_DATABASE_HOST_PREFIX = "ep-falling-butterfly" as const;
export const DEVELOPMENT_DATABASE_HOST_PREFIX = "ep-frosty-snowflake" as const;

export const USER_CLONE_TABLES = [
  "User",
  "CreditCard",
  "Benefit",
  "BenefitStatus",
  "CreditCardEvent",
  "LoyaltyAccount",
  "LoyaltyCertificate",
  "ExternalCardMapping",
  "AmexSyncAttempt",
  "BenefitStatusSourceProvenance",
  "AmexSyncRowAudit",
  "CatalogMigrationLedger",
  "GlobalBenefitCategoryRepair",
  "GlobalBenefitCategoryRepairOccurrence",
] as const;

export type UserCloneTable = (typeof USER_CLONE_TABLES)[number];
export type UserCloneCounts = Record<UserCloneTable, number>;

export type CloneUser = Omit<User, "password"> & { password: null };
export type CloneCreditCard = Omit<CreditCard, "cardNumber"> & { cardNumber: null };
export type CloneLoyaltyAccount = Omit<LoyaltyAccount, "accountNumber" | "loyaltyProgramId"> & {
  accountNumber: null;
  loyaltyProgramName: string;
};

export interface CloneCatalogMigrationLedgerBinding {
  id: string;
  legacyBenefitId: string;
  userId: string;
  creditCardId: string | null;
  predefinedCardCatalogKey: string | null;
  predefinedBenefitCatalogKey: string | null;
  classification: "STANDARD" | "CUSTOM";
  phase: "CLASSIFIED" | "BRIDGED" | "CLEANED" | "ROLLED_BACK";
  sourceFingerprint: string;
  destinationFingerprint: string | null;
  classifiedAt: Date;
  bridgedAt: Date | null;
  cleanedAt: Date | null;
  rolledBackAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloneCategoryRepair {
  id: string;
  legacyBenefitId: string;
  catalogMigrationLedgerId: string;
  userId: string;
  creditCardId: string;
  predefinedCardId: string;
  predefinedBenefitId: string;
  resolvedPredefinedCardCatalogKey: string;
  resolvedPredefinedBenefitCatalogKey: string;
  predefinedBenefitParentMatchesCard: boolean;
  targetPredefinedCardCatalogKey: string;
  targetPredefinedBenefitCatalogKey: string;
  definitionFingerprint: string;
  inventoryFingerprint: string;
  graphFingerprint: string;
  reviewedCurrentGraphFingerprint: string;
  destinationFingerprint: string;
  manifestFingerprint: string;
  manifestEntryFingerprint: string;
  planFingerprint: string;
  postimageFingerprint: string;
  evidenceVersion: number;
  phase: "APPLIED" | "ROLLED_BACK";
  appliedAt: Date;
  rolledBackAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloneCategoryRepairOccurrence {
  id: string;
  repairId: string;
  userId: string;
  creditCardId: string;
  predefinedBenefitId: string;
  targetPredefinedBenefitCatalogKey: string;
  action: "PROMOTE_LEGACY_STATUS" | "RETAIN_CANONICAL_STATUS";
  keeperSource: "LEGACY_CUSTOM" | "CANONICAL_STANDARD";
  keeperStatusId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  keeperBaselineVersion: number;
  keeperBaseline: unknown;
  removedStatusId: string | null;
  removedStatusSource: "LEGACY_CUSTOM" | "CANONICAL_STANDARD" | null;
  removedStatusPreimageVersion: number | null;
  removedStatusPreimage: unknown;
  removedStatusPreimageIsSqlNull: boolean;
  removedStatusPreimageJsonType: string | null;
  repairAddedAuditMetadataVersion: number;
  repairAddedAuditMetadata: unknown;
  planFingerprint: string;
  postimageFingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloneGlobalCatalogBindings {
  cards: Array<{ creditCardId: string; catalogKey: string }>;
  statuses: Array<{ benefitStatusId: string; creditCardId: string; catalogKey: string }>;
  audits: Array<{ auditId: string; catalogKey: string; definitionFingerprint: string | null }>;
  ledger: CloneCatalogMigrationLedgerBinding[];
}

export interface CloneCategoryRepairStateFingerprints {
  statuses: Array<{ id: string; stateFingerprint: string }>;
  audits: Array<{ id: string; stateFingerprint: string }>;
  provenance: Array<{ id: string; stateFingerprint: string }>;
}

export interface CloneGlobalCatalogRebindingPlan {
  cards: Array<{ creditCardId: string; predefinedCardId: string }>;
  statuses: Array<{ benefitStatusId: string; creditCardId: string; predefinedBenefitId: string }>;
  audits: Array<{ auditId: string; destinationPredefinedBenefitId: string; definitionFingerprint: string | null }>;
  ledger: Array<Omit<CloneCatalogMigrationLedgerBinding, "predefinedCardCatalogKey" | "predefinedBenefitCatalogKey"> & {
    predefinedCardId: string | null;
    predefinedBenefitId: string | null;
  }>;
}

export interface CloneCategoryRepairRebindingPlan {
  repairs: CloneCategoryRepair[];
  occurrences: CloneCategoryRepairOccurrence[];
}

export function planCloneGlobalCatalogRebindings(
  bindings: CloneGlobalCatalogBindings,
  destination: {
    cards: Array<{ id: string; catalogKey: string }>;
    benefits: Array<{ id: string; catalogKey: string }>;
  },
): CloneGlobalCatalogRebindingPlan {
  const unique = (rows: Array<{ id: string; catalogKey: string }>, kind: string): Map<string, string> => {
    const result = new Map<string, string>();
    for (const row of rows) {
      if (!row.catalogKey || result.has(row.catalogKey)) {
        throw new UserCloneOperatorError(`Destination ${kind} catalog keys are not unique.`);
      }
      result.set(row.catalogKey, row.id);
    }
    return result;
  };
  const cards = unique(destination.cards, "card");
  const benefits = unique(destination.benefits, "benefit");
  const cardId = (key: string | null): string | null => {
    if (key === null) return null;
    const id = cards.get(key);
    if (!id) throw new UserCloneOperatorError("A global card has no exact destination catalog-key match.");
    return id;
  };
  const benefitId = (key: string | null): string | null => {
    if (key === null) return null;
    const id = benefits.get(key);
    if (!id) throw new UserCloneOperatorError("A global benefit has no exact destination catalog-key match.");
    return id;
  };
  return {
    cards: bindings.cards.map((row) => ({
      creditCardId: row.creditCardId,
      predefinedCardId: cardId(row.catalogKey)!,
    })),
    statuses: bindings.statuses.map((row) => ({
      benefitStatusId: row.benefitStatusId,
      creditCardId: row.creditCardId,
      predefinedBenefitId: benefitId(row.catalogKey)!,
    })),
    audits: bindings.audits.map((row) => ({
      auditId: row.auditId,
      destinationPredefinedBenefitId: benefitId(row.catalogKey)!,
      definitionFingerprint: row.definitionFingerprint,
    })),
    ledger: bindings.ledger.map(({ predefinedCardCatalogKey, predefinedBenefitCatalogKey, ...row }) => ({
      ...row,
      predefinedCardId: cardId(predefinedCardCatalogKey),
      predefinedBenefitId: benefitId(predefinedBenefitCatalogKey),
    })),
  };
}

function rebindCategoryRepairJson(
  value: unknown,
  sourcePredefinedBenefitId: string,
  destinationPredefinedBenefitId: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rebindCategoryRepairJson(
      item,
      sourcePredefinedBenefitId,
      destinationPredefinedBenefitId,
    ));
  }
  if (value === null || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'predefinedBenefitId' || key === 'destinationPredefinedBenefitId')
      && item !== null) {
      if (item !== sourcePredefinedBenefitId) {
        throw new UserCloneOperatorError('Category-repair JSON contains an unbound global definition ID.');
      }
      result[key] = destinationPredefinedBenefitId;
    } else {
      result[key] = rebindCategoryRepairJson(
        item,
        sourcePredefinedBenefitId,
        destinationPredefinedBenefitId,
      );
    }
  }
  return result;
}

export function planCloneCategoryRepairRebindings(
  repairs: CloneCategoryRepair[],
  occurrences: CloneCategoryRepairOccurrence[],
  destination: {
    cards: Array<{ id: string; catalogKey: string }>;
    benefits: Array<{ id: string; catalogKey: string; predefinedCardId?: string }>;
  },
): CloneCategoryRepairRebindingPlan {
  const cardIds = new Map<string, string>();
  for (const card of destination.cards) {
    if (!card.catalogKey || cardIds.has(card.catalogKey)) {
      throw new UserCloneOperatorError('Destination card catalog keys are not unique.');
    }
    cardIds.set(card.catalogKey, card.id);
  }
  const benefitRows = new Map<string, { id: string; predefinedCardId?: string }>();
  for (const benefit of destination.benefits) {
    if (!benefit.catalogKey || benefitRows.has(benefit.catalogKey)) {
      throw new UserCloneOperatorError('Destination benefit catalog keys are not unique.');
    }
    benefitRows.set(benefit.catalogKey, benefit);
  }
  const repairById = new Map(repairs.map((repair) => [repair.id, repair]));
  if (repairById.size !== repairs.length) {
    throw new UserCloneOperatorError('The source category-repair graph contains duplicate identifiers.');
  }
  const reboundRepairs = repairs.map((repair) => {
    const predefinedCardId = cardIds.get(repair.targetPredefinedCardCatalogKey);
    const targetBenefit = benefitRows.get(repair.targetPredefinedBenefitCatalogKey);
    if (!predefinedCardId || !targetBenefit
      || (targetBenefit.predefinedCardId !== undefined
        && targetBenefit.predefinedCardId !== predefinedCardId)) {
      throw new UserCloneOperatorError('A category repair has no exact same-product catalog binding.');
    }
    return { ...repair, predefinedCardId, predefinedBenefitId: targetBenefit.id };
  });
  const reboundByRepair = new Map(reboundRepairs.map((repair) => [repair.id, repair]));
  const reboundOccurrences = occurrences.map((occurrence) => {
    const sourceRepair = repairById.get(occurrence.repairId);
    const reboundRepair = reboundByRepair.get(occurrence.repairId);
    if (!sourceRepair || !reboundRepair
      || occurrence.targetPredefinedBenefitCatalogKey
        !== sourceRepair.targetPredefinedBenefitCatalogKey
      || occurrence.predefinedBenefitId !== sourceRepair.predefinedBenefitId) {
      throw new UserCloneOperatorError('A category-repair occurrence has an invalid catalog binding.');
    }
    return {
      ...occurrence,
      predefinedBenefitId: reboundRepair.predefinedBenefitId,
      keeperBaseline: rebindCategoryRepairJson(
        occurrence.keeperBaseline,
        sourceRepair.predefinedBenefitId,
        reboundRepair.predefinedBenefitId,
      ),
      removedStatusPreimage: rebindCategoryRepairJson(
        occurrence.removedStatusPreimage,
        sourceRepair.predefinedBenefitId,
        reboundRepair.predefinedBenefitId,
      ),
      repairAddedAuditMetadata: rebindCategoryRepairJson(
        occurrence.repairAddedAuditMetadata,
        sourceRepair.predefinedBenefitId,
        reboundRepair.predefinedBenefitId,
      ),
    };
  }).sort(compareCloneCategoryRepairOccurrences);
  return { repairs: reboundRepairs, occurrences: reboundOccurrences };
}

export interface UserCloneSnapshot {
  user: CloneUser;
  creditCards: CloneCreditCard[];
  benefits: Benefit[];
  benefitStatuses: BenefitStatus[];
  creditCardEvents: CreditCardEvent[];
  loyaltyAccounts: CloneLoyaltyAccount[];
  loyaltyCertificates: LoyaltyCertificate[];
  externalCardMappings: ExternalCardMapping[];
  amexSyncAttempts: AmexSyncAttempt[];
  benefitStatusSourceProvenance: BenefitStatusSourceProvenance[];
  amexSyncRowAudits: AmexSyncRowAudit[];
  globalCatalogBindings?: CloneGlobalCatalogBindings;
  categoryRepairStateFingerprints?: CloneCategoryRepairStateFingerprints;
  categoryRepairs?: CloneCategoryRepair[];
  categoryRepairOccurrences?: CloneCategoryRepairOccurrence[];
}

export interface InternalDatabaseIdentity {
  host: string;
  database: string;
  schema: string;
  fingerprint: string;
  branchIdFingerprint: string | null;
}

export interface SourceAccountRead {
  matchCount: number;
  snapshot: UserCloneSnapshot | null;
}

export interface UserCloneSourcePort {
  identify(): Promise<InternalDatabaseIdentity>;
  readAccountSnapshot(normalizedEmail: string): Promise<SourceAccountRead>;
}

export interface DestinationPreflight {
  blockingCollisionModels: UserCloneTable[];
}

export interface UserCloneDestinationPort {
  identify(): Promise<InternalDatabaseIdentity>;
  findUsersByNormalizedEmail(normalizedEmail: string): Promise<Array<{ id: string }>>;
  preflight(snapshot: UserCloneSnapshot, replaceableUserId: string | null): Promise<DestinationPreflight>;
  apply(input: {
    snapshot: UserCloneSnapshot;
    normalizedEmail: string;
    replaceableUserId: string | null;
    expectedIdentity: InternalDatabaseIdentity;
  }): Promise<UserCloneCounts>;
}

export interface UserCloneReport {
  mode: "dry-run" | "apply";
  targets: {
    source: "production";
    destination: "development";
  };
  tables: Array<{
    table: UserCloneTable;
    sourceCount: number;
    destinationCount: number;
  }>;
}

export class UserCloneOperatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserCloneOperatorError";
  }
}

export function normalizeCloneEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function userCloneApplyConfirmation(normalizedEmail: string): string {
  return `CLONE PRODUCTION USER ${normalizedEmail} TO DEVELOPMENT`;
}

export function userCloneReplacementConfirmation(normalizedEmail: string): string {
  return `REPLACE DEVELOPMENT USER ${normalizedEmail}`;
}

export function emptyUserCloneCounts(): UserCloneCounts {
  return Object.fromEntries(USER_CLONE_TABLES.map((table) => [table, 0])) as UserCloneCounts;
}

export function countUserCloneSnapshot(snapshot: UserCloneSnapshot): UserCloneCounts {
  return {
    User: 1,
    CreditCard: snapshot.creditCards.length,
    Benefit: snapshot.benefits.length,
    BenefitStatus: snapshot.benefitStatuses.length,
    CreditCardEvent: snapshot.creditCardEvents.length,
    LoyaltyAccount: snapshot.loyaltyAccounts.length,
    LoyaltyCertificate: snapshot.loyaltyCertificates.length,
    ExternalCardMapping: snapshot.externalCardMappings.length,
    AmexSyncAttempt: snapshot.amexSyncAttempts.length,
    BenefitStatusSourceProvenance: snapshot.benefitStatusSourceProvenance.length,
    AmexSyncRowAudit: snapshot.amexSyncRowAudits.length,
    CatalogMigrationLedger: snapshot.globalCatalogBindings?.ledger.length ?? 0,
    GlobalBenefitCategoryRepair: snapshot.categoryRepairs?.length ?? 0,
    GlobalBenefitCategoryRepairOccurrence: snapshot.categoryRepairOccurrences?.length ?? 0,
  };
}

function requireExactNormalizedEmail(email: string): string {
  const normalized = normalizeCloneEmail(email);
  if (!normalized || email !== normalized || normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new UserCloneOperatorError("The clone email must be a valid, already-normalized lowercase email address.");
  }
  return normalized;
}

function isReviewedNeonHost(host: string, endpointPrefix: string): boolean {
  const normalizedHost = host.toLowerCase();
  return normalizedHost.startsWith(`${endpointPrefix}-`)
    && normalizedHost.endsWith(".aws.neon.tech")
    && !normalizedHost.includes("..");
}

function assertTargetIdentities(source: InternalDatabaseIdentity, destination: InternalDatabaseIdentity): void {
  if (!isReviewedNeonHost(source.host, PRODUCTION_DATABASE_HOST_PREFIX)) {
    throw new UserCloneOperatorError("The source database did not match the reviewed production target.");
  }
  if (!isReviewedNeonHost(destination.host, DEVELOPMENT_DATABASE_HOST_PREFIX)) {
    throw new UserCloneOperatorError("The destination database did not match the reviewed development target.");
  }
  if (!source.database || !source.schema || !source.fingerprint
    || !destination.database || !destination.schema || !destination.fingerprint
    || !source.branchIdFingerprint || !destination.branchIdFingerprint) {
    throw new UserCloneOperatorError("Database-side target verification returned an incomplete identity.");
  }
  if (source.fingerprint === destination.fingerprint
    || source.branchIdFingerprint === destination.branchIdFingerprint) {
    throw new UserCloneOperatorError("Source and destination resolve to the same database target.");
  }
}

function assertUniqueIds(values: Array<{ id: string }>, model: UserCloneTable): void {
  if (new Set(values.map((value) => value.id)).size !== values.length) {
    throw new UserCloneOperatorError(`The source ${model} graph contains duplicate identifiers.`);
  }
}

interface CloneCategoryRepairStatusPreimage {
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

interface CloneCategoryRepairAttachmentSnapshot {
  id: string;
  ownerId: string | null;
  stateFingerprint: string;
}

interface CloneCategoryRepairAuditSnapshot extends CloneCategoryRepairAttachmentSnapshot {
  destinationCardId: string | null;
  destinationBenefitId: string | null;
  destinationStatusId: string | null;
  destinationPredefinedBenefitId: string | null;
  destinationDefinitionFingerprint: string | null;
}

interface CloneCategoryRepairAuditPatch {
  auditId: string;
  destinationCardId: string | null;
  destinationBenefitId: string | null;
  destinationStatusId: string;
  before: {
    destinationPredefinedBenefitId: string | null;
    destinationDefinitionFingerprint: string | null;
    stateFingerprint: string;
  };
  after: {
    destinationPredefinedBenefitId: string | null;
    destinationDefinitionFingerprint: string | null;
    stateFingerprint: string;
  };
}

interface CloneStoredKeeperBaseline {
  status: CloneCategoryRepairStatusPreimage;
  audits: CloneCategoryRepairAuditSnapshot[];
  provenance: CloneCategoryRepairAttachmentSnapshot[];
}

const CATEGORY_REPAIR_STATUS_PREIMAGE_KEYS = [
  "id",
  "benefitId",
  "creditCardId",
  "predefinedBenefitId",
  "userId",
  "cycleStartDate",
  "cycleEndDate",
  "occurrenceIndex",
  "usedAmount",
  "isCompleted",
  "completedAt",
  "isNotUsable",
  "orderIndex",
  "createdAt",
  "updatedAt",
  "stateFingerprint",
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isExactIsoInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function parseCategoryRepairStatusPreimage(value: unknown): CloneCategoryRepairStatusPreimage | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, CATEGORY_REPAIR_STATUS_PREIMAGE_KEYS)) return null;
  const preimage = value as unknown as CloneCategoryRepairStatusPreimage;
  if (typeof preimage.id !== "string" || !preimage.id
    || (preimage.benefitId !== null && typeof preimage.benefitId !== "string")
    || (preimage.creditCardId !== null && typeof preimage.creditCardId !== "string")
    || (preimage.predefinedBenefitId !== null && typeof preimage.predefinedBenefitId !== "string")
    || typeof preimage.userId !== "string" || !preimage.userId
    || !isExactIsoInstant(preimage.cycleStartDate)
    || !isExactIsoInstant(preimage.cycleEndDate)
    || !Number.isInteger(preimage.occurrenceIndex)
    || (preimage.usedAmount !== null
      && (typeof preimage.usedAmount !== "number" || !Number.isFinite(preimage.usedAmount)))
    || typeof preimage.isCompleted !== "boolean"
    || (preimage.completedAt !== null && !isExactIsoInstant(preimage.completedAt))
    || typeof preimage.isNotUsable !== "boolean"
    || (preimage.orderIndex !== null && !Number.isInteger(preimage.orderIndex))
    || !isExactIsoInstant(preimage.createdAt)
    || !isExactIsoInstant(preimage.updatedAt)
    || typeof preimage.stateFingerprint !== "string"
    || !/^[a-f0-9]{64}$/.test(preimage.stateFingerprint)) return null;
  return preimage;
}

function parseCategoryRepairAttachmentSnapshot(
  value: unknown,
): CloneCategoryRepairAttachmentSnapshot | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["id", "ownerId", "stateFingerprint"])
    || typeof value.id !== "string" || !value.id
    || (value.ownerId !== null && typeof value.ownerId !== "string")
    || typeof value.stateFingerprint !== "string"
    || !/^[a-f0-9]{64}$/.test(value.stateFingerprint)) return null;
  return value as unknown as CloneCategoryRepairAttachmentSnapshot;
}

function parseCategoryRepairAuditSnapshot(value: unknown): CloneCategoryRepairAuditSnapshot | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, [
    "id",
    "ownerId",
    "stateFingerprint",
    "destinationCardId",
    "destinationBenefitId",
    "destinationStatusId",
    "destinationPredefinedBenefitId",
    "destinationDefinitionFingerprint",
  ])) return null;
  const attachment = parseCategoryRepairAttachmentSnapshot({
    id: value.id,
    ownerId: value.ownerId,
    stateFingerprint: value.stateFingerprint,
  });
  const nullableStrings = [
    value.destinationCardId,
    value.destinationBenefitId,
    value.destinationStatusId,
    value.destinationPredefinedBenefitId,
    value.destinationDefinitionFingerprint,
  ];
  return attachment && nullableStrings.every((item) => item === null || typeof item === "string")
    ? value as unknown as CloneCategoryRepairAuditSnapshot
    : null;
}

function parseCategoryRepairAuditPatch(value: unknown): CloneCategoryRepairAuditPatch | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, [
    "auditId",
    "destinationCardId",
    "destinationBenefitId",
    "destinationStatusId",
    "before",
    "after",
  ]) || typeof value.auditId !== "string" || !value.auditId
    || (value.destinationCardId !== null && typeof value.destinationCardId !== "string")
    || (value.destinationBenefitId !== null && typeof value.destinationBenefitId !== "string")
    || typeof value.destinationStatusId !== "string" || !value.destinationStatusId) return null;
  const metadata = (item: unknown): boolean => isPlainRecord(item)
    && hasExactKeys(item, [
      "destinationPredefinedBenefitId",
      "destinationDefinitionFingerprint",
      "stateFingerprint",
    ])
    && (item.destinationPredefinedBenefitId === null
      || typeof item.destinationPredefinedBenefitId === "string")
    && (item.destinationDefinitionFingerprint === null
      || typeof item.destinationDefinitionFingerprint === "string")
    && typeof item.stateFingerprint === "string"
    && /^[a-f0-9]{64}$/.test(item.stateFingerprint);
  return metadata(value.before) && metadata(value.after)
    ? value as unknown as CloneCategoryRepairAuditPatch
    : null;
}

function parseStoredKeeperBaseline(value: unknown): CloneStoredKeeperBaseline | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["status", "audits", "provenance"])
    || !Array.isArray(value.audits) || !Array.isArray(value.provenance)) return null;
  const status = parseCategoryRepairStatusPreimage(value.status);
  const audits = value.audits.map(parseCategoryRepairAuditSnapshot);
  const provenance = value.provenance.map(parseCategoryRepairAttachmentSnapshot);
  return status === null || audits.some((row) => row === null) || provenance.some((row) => row === null)
    ? null
    : {
      status,
      audits: audits as CloneCategoryRepairAuditSnapshot[],
      provenance: provenance as CloneCategoryRepairAttachmentSnapshot[],
    };
}

function portableCategoryRepairStatusPreimage(
  preimage: CloneCategoryRepairStatusPreimage,
): unknown {
  return {
    ...preimage,
    predefinedBenefitId: preimage.predefinedBenefitId === null ? null : "catalog-bound",
  };
}

function portableCategoryRepairAuditSnapshot(
  audit: CloneCategoryRepairAuditSnapshot,
): unknown {
  return {
    ...audit,
    destinationPredefinedBenefitId: audit.destinationPredefinedBenefitId === null
      ? null
      : "catalog-bound",
  };
}

function portableCategoryRepairAuditPatch(patch: CloneCategoryRepairAuditPatch): unknown {
  const portableMetadata = (metadata: CloneCategoryRepairAuditPatch["before"]): unknown => ({
    ...metadata,
    destinationPredefinedBenefitId: metadata.destinationPredefinedBenefitId === null
      ? null
      : "catalog-bound",
  });
  return {
    ...patch,
    before: portableMetadata(patch.before),
    after: portableMetadata(patch.after),
  };
}

function categoryRepairActionFingerprintsMatch(input: {
  occurrence: CloneCategoryRepairOccurrence;
  keeperBaseline: CloneStoredKeeperBaseline;
  removedPreimage: CloneCategoryRepairStatusPreimage | null;
  auditPatches: CloneCategoryRepairAuditPatch[];
}): boolean {
  const { occurrence, keeperBaseline, removedPreimage, auditPatches } = input;
  const keeperSourceKind = occurrence.keeperSource === "LEGACY_CUSTOM" ? "legacy" : "canonical";
  const removedSourceKind = occurrence.removedStatusSource === null
    ? null
    : occurrence.removedStatusSource === "LEGACY_CUSTOM" ? "legacy" : "canonical";
  const actionInput = {
    kind: occurrence.action,
    userId: occurrence.userId,
    creditCardId: occurrence.creditCardId,
    predefinedBenefitId: occurrence.predefinedBenefitId,
    cycleStartDate: occurrence.cycleStartDate.toISOString(),
    cycleEndDate: occurrence.cycleEndDate.toISOString(),
    occurrenceIndex: occurrence.occurrenceIndex,
    keeperStatusId: occurrence.keeperStatusId,
    keeperSourceKind,
    keeperBaselineVersion: occurrence.keeperBaselineVersion,
    keeperBaseline: keeperBaseline.status,
    keeperAuditBaseline: keeperBaseline.audits,
    keeperProvenanceBaseline: keeperBaseline.provenance,
    removedStatusId: occurrence.removedStatusId,
    removedSourceKind,
    removedPreimageVersion: occurrence.removedStatusPreimageVersion,
    removedPreimage,
    repairAddedAuditMetadataVersion: occurrence.repairAddedAuditMetadataVersion,
    repairAddedAuditMetadata: auditPatches,
  };
  const portableActionInput = {
    ...actionInput,
    predefinedBenefitId: "catalog-bound",
    keeperBaseline: portableCategoryRepairStatusPreimage(keeperBaseline.status),
    keeperAuditBaseline: keeperBaseline.audits.map(portableCategoryRepairAuditSnapshot),
    removedPreimage: removedPreimage === null
      ? null
      : portableCategoryRepairStatusPreimage(removedPreimage),
    repairAddedAuditMetadata: auditPatches.map(portableCategoryRepairAuditPatch),
  };
  const postimageFingerprint = migrationFingerprint({
    ...portableCategoryRepairStatusPreimage(keeperBaseline.status) as Record<string, unknown>,
    benefitId: keeperSourceKind === "legacy" ? keeperBaseline.status.benefitId : null,
    creditCardId: occurrence.creditCardId,
    predefinedBenefitId: "catalog-bound",
    repairAddedAuditMetadata: auditPatches.map(portableCategoryRepairAuditPatch),
  });
  return postimageFingerprint === occurrence.postimageFingerprint
    && migrationFingerprint({ action: portableActionInput, postimageFingerprint })
      === occurrence.planFingerprint;
}

function statusStateMatchesPreimage(
  status: BenefitStatus,
  preimage: CloneCategoryRepairStatusPreimage,
): boolean {
  return status.id === preimage.id
    && status.benefitId === preimage.benefitId
    && status.userId === preimage.userId
    && status.cycleStartDate.toISOString() === preimage.cycleStartDate
    && status.cycleEndDate.toISOString() === preimage.cycleEndDate
    && status.occurrenceIndex === preimage.occurrenceIndex
    && status.usedAmount === preimage.usedAmount
    && status.isCompleted === preimage.isCompleted
    && (status.completedAt === null ? null : status.completedAt.toISOString()) === preimage.completedAt
    && status.isNotUsable === preimage.isNotUsable
    && status.orderIndex === preimage.orderIndex
    && status.createdAt.toISOString() === preimage.createdAt
    && status.updatedAt.toISOString() === preimage.updatedAt;
}

function categoryRepairOccurrenceTuple(row: CloneCategoryRepairOccurrence): string {
  return [
    row.repairId,
    row.userId,
    row.creditCardId,
    row.predefinedBenefitId,
    row.cycleStartDate.getTime(),
    row.cycleEndDate.getTime(),
    row.occurrenceIndex,
  ].join("\u0000");
}

export function compareCloneCategoryRepairOccurrences(
  left: CloneCategoryRepairOccurrence,
  right: CloneCategoryRepairOccurrence,
): number {
  return left.cycleStartDate.getTime() - right.cycleStartDate.getTime()
    || left.cycleEndDate.getTime() - right.cycleEndDate.getTime()
    || left.occurrenceIndex - right.occurrenceIndex
    || left.keeperStatusId.localeCompare(right.keeperStatusId)
    || left.id.localeCompare(right.id);
}

function categoryRepairParentFingerprintsMatch(
  repair: CloneCategoryRepair,
  occurrences: CloneCategoryRepairOccurrence[],
): boolean {
  const ordered = [...occurrences].sort(compareCloneCategoryRepairOccurrences);
  const postimageFingerprint = migrationFingerprint({
    sourceBenefitId: repair.legacyBenefitId,
    cardId: repair.creditCardId,
    targetBenefitCatalogKey: repair.targetPredefinedBenefitCatalogKey,
    statusPostimages: ordered.map((occurrence) => occurrence.postimageFingerprint),
  });
  const planFingerprint = migrationFingerprint({
    immutableGraphFingerprint: repair.graphFingerprint,
    currentGraphFingerprint: repair.reviewedCurrentGraphFingerprint,
    destinationFingerprint: repair.destinationFingerprint,
    postimageFingerprint,
    actionFingerprints: ordered.map((occurrence) => occurrence.planFingerprint),
    stopReasons: [],
  });
  return repair.postimageFingerprint === postimageFingerprint
    && repair.planFingerprint === planFingerprint;
}

export function validateUserCloneSnapshot(snapshot: UserCloneSnapshot, normalizedEmail: string): void {
  const userId = snapshot.user.id;
  if (snapshot.user.email !== normalizedEmail || snapshot.user.password !== null) {
    throw new UserCloneOperatorError("The source user projection violates the sanitized clone policy.");
  }
  if (snapshot.creditCards.some((card) => card.userId !== userId || card.cardNumber !== null)) {
    throw new UserCloneOperatorError("The source CreditCard graph is inconsistent or unsanitized.");
  }
  if (snapshot.loyaltyAccounts.some((account) => account.userId !== userId || account.accountNumber !== null || !account.loyaltyProgramName)) {
    throw new UserCloneOperatorError("The source LoyaltyAccount graph is inconsistent or unsanitized.");
  }

  const cardIds = new Set(snapshot.creditCards.map((card) => card.id));
  const benefitIds = new Set(snapshot.benefits.map((benefit) => benefit.id));
  const statusIds = new Set(snapshot.benefitStatuses.map((status) => status.id));
  const loyaltyAccountIds = new Set(snapshot.loyaltyAccounts.map((account) => account.id));
  const attemptIds = new Set(snapshot.amexSyncAttempts.map((attempt) => attempt.id));
  const bindings = snapshot.globalCatalogBindings;
  const globallyBoundStatusIds = new Set(bindings?.statuses.map((row) => row.benefitStatusId) ?? []);

  for (const benefit of snapshot.benefits) {
    const cardOwned = benefit.creditCardId !== null && cardIds.has(benefit.creditCardId) && benefit.userId === null;
    const standaloneOwned = benefit.creditCardId === null && benefit.userId === userId;
    if (!cardOwned && !standaloneOwned) {
      throw new UserCloneOperatorError("The source Benefit graph contains a cross-user or ambiguous owner.");
    }
  }
  if (snapshot.benefitStatuses.some((status) => {
    const hasLegacyBenefit = status.benefitId !== null;
    const hasGlobalBenefit = globallyBoundStatusIds.has(status.id);
    return status.userId !== userId
      || (hasLegacyBenefit && !benefitIds.has(status.benefitId!))
      || (!hasLegacyBenefit && !hasGlobalBenefit);
  })) {
    throw new UserCloneOperatorError("The source BenefitStatus graph contains a cross-user link.");
  }
  if (snapshot.creditCardEvents.some((event) => event.userId !== userId || !cardIds.has(event.creditCardId))) {
    throw new UserCloneOperatorError("The source CreditCardEvent graph contains a cross-user link.");
  }
  if (snapshot.loyaltyCertificates.some((certificate) => certificate.userId !== userId || !loyaltyAccountIds.has(certificate.loyaltyAccountId))) {
    throw new UserCloneOperatorError("The source LoyaltyCertificate graph contains a cross-user link.");
  }
  if (snapshot.externalCardMappings.some((mapping) => mapping.userId !== userId || !cardIds.has(mapping.creditCardId))) {
    throw new UserCloneOperatorError("The source ExternalCardMapping graph contains a cross-user link.");
  }
  if (snapshot.amexSyncAttempts.some((attempt) => attempt.userId !== userId)) {
    throw new UserCloneOperatorError("The source AmexSyncAttempt graph contains a cross-user owner.");
  }
  if (snapshot.benefitStatusSourceProvenance.some((provenance) =>
    !statusIds.has(provenance.benefitStatusId)
    || (provenance.attemptId !== null && !attemptIds.has(provenance.attemptId)))) {
    throw new UserCloneOperatorError("The source provenance graph contains an invalid destination link.");
  }
  if (snapshot.amexSyncRowAudits.some((audit) =>
    !attemptIds.has(audit.attemptId)
    || (audit.destinationCardId !== null && !cardIds.has(audit.destinationCardId))
    || (audit.destinationBenefitId !== null && !benefitIds.has(audit.destinationBenefitId))
    || (audit.destinationStatusId !== null && !statusIds.has(audit.destinationStatusId)))) {
    throw new UserCloneOperatorError("The source audit graph contains an invalid destination link.");
  }
  const auditIds = new Set(snapshot.amexSyncRowAudits.map((audit) => audit.id));
  if (bindings && (bindings.cards.some((row) => !cardIds.has(row.creditCardId) || !row.catalogKey)
    || bindings.statuses.some((row) => !statusIds.has(row.benefitStatusId) || !cardIds.has(row.creditCardId) || !row.catalogKey)
    || bindings.audits.some((row) => !auditIds.has(row.auditId) || !row.catalogKey)
    || bindings.ledger.some((row) => row.userId !== userId
      || (row.phase !== "CLEANED" && !benefitIds.has(row.legacyBenefitId))
      || (row.creditCardId !== null && !cardIds.has(row.creditCardId))
      || (row.classification === "STANDARD"
        && (!row.predefinedCardCatalogKey || !row.predefinedBenefitCatalogKey))))) {
    throw new UserCloneOperatorError("The source global-catalog bridge graph contains an invalid link.");
  }
  const ledgerById = new Map(bindings?.ledger.map((row) => [row.id, row]) ?? []);
  const benefitById = new Map(snapshot.benefits.map((row) => [row.id, row]));
  const cardById = new Map(snapshot.creditCards.map((row) => [row.id, row]));
  const statusById = new Map(snapshot.benefitStatuses.map((row) => [row.id, row]));
  const cardBindingById = new Map<string, string>();
  let duplicateCardBinding = false;
  for (const binding of bindings?.cards ?? []) {
    if (cardBindingById.has(binding.creditCardId)) duplicateCardBinding = true;
    cardBindingById.set(binding.creditCardId, binding.catalogKey);
  }
  const statusBindingById = new Map<string, { creditCardId: string; catalogKey: string }>();
  let duplicateStatusBinding = false;
  for (const binding of bindings?.statuses ?? []) {
    if (statusBindingById.has(binding.benefitStatusId)) duplicateStatusBinding = true;
    statusBindingById.set(binding.benefitStatusId, binding);
  }
  const auditBindingById = new Map<string, { catalogKey: string; definitionFingerprint: string | null }>();
  let duplicateAuditBinding = false;
  for (const binding of bindings?.audits ?? []) {
    if (auditBindingById.has(binding.auditId)) duplicateAuditBinding = true;
    auditBindingById.set(binding.auditId, binding);
  }
  const repairStateFingerprints = snapshot.categoryRepairStateFingerprints;
  const fingerprintMap = (
    rows: Array<{ id: string; stateFingerprint: string }> | undefined,
  ): Map<string, string> | null => {
    if (!rows) return null;
    const result = new Map<string, string>();
    for (const row of rows) {
      if (!row.id || !/^[a-f0-9]{64}$/.test(row.stateFingerprint) || result.has(row.id)) return null;
      result.set(row.id, row.stateFingerprint);
    }
    return result;
  };
  const statusStateFingerprints = fingerprintMap(repairStateFingerprints?.statuses);
  const auditStateFingerprints = fingerprintMap(repairStateFingerprints?.audits);
  const provenanceStateFingerprints = fingerprintMap(repairStateFingerprints?.provenance);
  const repairs = snapshot.categoryRepairs ?? [];
  const repairById = new Map(repairs.map((repair) => [repair.id, repair]));
  const repairLegacyIds = repairs.map((repair) => repair.legacyBenefitId);
  const repairLedgerIds = repairs.map((repair) => repair.catalogMigrationLedgerId);
  if (duplicateCardBinding
    || duplicateStatusBinding
    || duplicateAuditBinding
    || repairById.size !== repairs.length
    || new Set(repairLegacyIds).size !== repairLegacyIds.length
    || new Set(repairLedgerIds).size !== repairLedgerIds.length
    || (repairs.length > 0 && (
      statusStateFingerprints === null
      || auditStateFingerprints === null
      || provenanceStateFingerprints === null))
    || repairs.some((repair) => {
      const source = benefitById.get(repair.legacyBenefitId);
      const ledger = ledgerById.get(repair.catalogMigrationLedgerId);
      const card = cardById.get(repair.creditCardId);
      return repair.userId !== userId
        || !source
        || source.userId !== null
        || source.creditCardId !== repair.creditCardId
        || !card
        || card.userId !== userId
        || cardBindingById.get(repair.creditCardId) !== repair.targetPredefinedCardCatalogKey
        || !ledger
        || ledger.legacyBenefitId !== repair.legacyBenefitId
        || ledger.userId !== userId
        || ledger.creditCardId !== repair.creditCardId
        || ledger.classification !== "CUSTOM"
        || ledger.phase !== "CLASSIFIED"
        || ledger.predefinedCardCatalogKey !== null
        || ledger.predefinedBenefitCatalogKey !== null
        || repair.evidenceVersion !== 1
        || repair.resolvedPredefinedCardCatalogKey !== repair.targetPredefinedCardCatalogKey
        || repair.resolvedPredefinedBenefitCatalogKey !== repair.targetPredefinedBenefitCatalogKey
        || repair.predefinedBenefitParentMatchesCard !== true
        || !repair.targetPredefinedCardCatalogKey
        || !repair.targetPredefinedBenefitCatalogKey
        || (repair.phase === "APPLIED") !== (repair.rolledBackAt === null);
    })) {
    throw new UserCloneOperatorError("The source category-repair graph contains an invalid parent link.");
  }

  const occurrences = snapshot.categoryRepairOccurrences ?? [];
  const occurrenceTupleKeys = occurrences.map(categoryRepairOccurrenceTuple);
  const keeperStatusIds = occurrences.map((occurrence) => occurrence.keeperStatusId);
  const removedStatusIds = occurrences.flatMap((occurrence) =>
    occurrence.removedStatusId === null ? [] : [occurrence.removedStatusId]);
  const evidenceCollides = occurrences.some((occurrence) =>
    Number.isNaN(occurrence.cycleStartDate.getTime())
    || Number.isNaN(occurrence.cycleEndDate.getTime()))
    || new Set(occurrenceTupleKeys).size !== occurrenceTupleKeys.length
    || new Set(keeperStatusIds).size !== keeperStatusIds.length
    || new Set(removedStatusIds).size !== removedStatusIds.length
    || keeperStatusIds.some((id) => removedStatusIds.includes(id));
  if (evidenceCollides || occurrences.some((occurrence) => {
    const repair = repairById.get(occurrence.repairId);
    const keeper = statusById.get(occurrence.keeperStatusId);
    const keeperBinding = statusBindingById.get(occurrence.keeperStatusId) ?? null;
    const keeperBaseline = parseStoredKeeperBaseline(occurrence.keeperBaseline);
    const removedPreimage = occurrence.removedStatusPreimage === null
      ? null
      : parseCategoryRepairStatusPreimage(occurrence.removedStatusPreimage);
    const auditPatches = Array.isArray(occurrence.repairAddedAuditMetadata)
      ? occurrence.repairAddedAuditMetadata.map(parseCategoryRepairAuditPatch)
      : [];
    if (!repair || !keeper || !keeperBaseline
      || !Array.isArray(occurrence.repairAddedAuditMetadata)
      || auditPatches.some((patch) => patch === null)) return true;
    const parsedAuditPatches = auditPatches as CloneCategoryRepairAuditPatch[];

    const isPromote = occurrence.action === "PROMOTE_LEGACY_STATUS"
      && occurrence.keeperSource === "LEGACY_CUSTOM";
    const isRetain = occurrence.action === "RETAIN_CANONICAL_STATUS"
      && occurrence.keeperSource === "CANONICAL_STANDARD";
    if (!isPromote && !isRetain) return true;
    const expectedRemovedSource = occurrence.removedStatusId === null
      ? null
      : isPromote ? "CANONICAL_STANDARD" : "LEGACY_CUSTOM";
    const baselineStatus = keeperBaseline.status;
    const baselineIsGlobal = isRetain;
    const currentIsGlobal = repair.phase === "APPLIED" || isRetain;
    const currentBindingMatches = currentIsGlobal
      ? keeperBinding?.creditCardId === repair.creditCardId
        && keeperBinding.catalogKey === repair.targetPredefinedBenefitCatalogKey
      : keeperBinding === null;
    const baselineSourceMatches = baselineStatus.id === occurrence.keeperStatusId
      && baselineStatus.userId === userId
      && baselineStatus.benefitId === (isPromote ? repair.legacyBenefitId : null)
      && baselineStatus.creditCardId === (baselineIsGlobal ? repair.creditCardId : null)
      && baselineStatus.predefinedBenefitId === (baselineIsGlobal ? repair.predefinedBenefitId : null)
      && baselineStatus.cycleStartDate === occurrence.cycleStartDate.toISOString()
      && baselineStatus.cycleEndDate === occurrence.cycleEndDate.toISOString()
      && baselineStatus.occurrenceIndex === occurrence.occurrenceIndex;
    const currentSourceMatches = keeper.userId === userId
      && keeper.benefitId === (isPromote ? repair.legacyBenefitId : null)
      && currentBindingMatches
      && keeper.cycleStartDate.getTime() === occurrence.cycleStartDate.getTime()
      && keeper.cycleEndDate.getTime() === occurrence.cycleEndDate.getTime()
      && keeper.occurrenceIndex === occurrence.occurrenceIndex;

    const baselineAuditIds = keeperBaseline.audits.map((audit) => audit.id);
    const baselineProvenanceIds = keeperBaseline.provenance.map((row) => row.id);
    const patchIds = parsedAuditPatches.map((patch) => patch.auditId);
    const attachmentsStructurallyUnique = new Set(baselineAuditIds).size === baselineAuditIds.length
      && new Set(baselineProvenanceIds).size === baselineProvenanceIds.length
      && new Set(patchIds).size === patchIds.length
      && (isPromote
        ? patchIds.length === baselineAuditIds.length
          && patchIds.every((id) => baselineAuditIds.includes(id))
        : patchIds.length === 0);
    const baselineAuditsMatch = keeperBaseline.audits.every((baseline) => {
      const actual = snapshot.amexSyncRowAudits.find((audit) => audit.id === baseline.id);
      const attempt = actual
        ? snapshot.amexSyncAttempts.find((candidate) => candidate.id === actual.attemptId)
        : null;
      const patch = parsedAuditPatches.find((candidate) => candidate.auditId === baseline.id);
      const expectedMetadata = patch
        ? repair.phase === "APPLIED" ? patch.after : patch.before
        : {
          destinationPredefinedBenefitId: baseline.destinationPredefinedBenefitId,
          destinationDefinitionFingerprint: baseline.destinationDefinitionFingerprint,
          stateFingerprint: baseline.stateFingerprint,
        };
      const actualGlobalBinding = auditBindingById.get(baseline.id) ?? null;
      const actualMetadataMatches = expectedMetadata.destinationPredefinedBenefitId === null
        ? actualGlobalBinding === null
          && expectedMetadata.destinationDefinitionFingerprint === null
        : expectedMetadata.destinationPredefinedBenefitId === repair.predefinedBenefitId
          && actualGlobalBinding?.catalogKey === repair.targetPredefinedBenefitCatalogKey
          && actualGlobalBinding.definitionFingerprint === expectedMetadata.destinationDefinitionFingerprint;
      return actual !== undefined
        && attempt?.userId === baseline.ownerId
        && baseline.ownerId === userId
        && auditStateFingerprints?.get(actual.id) === baseline.stateFingerprint
        && actual.destinationCardId === baseline.destinationCardId
        && actual.destinationBenefitId === baseline.destinationBenefitId
        && actual.destinationStatusId === baseline.destinationStatusId
        && baseline.destinationCardId === repair.creditCardId
        && baseline.destinationBenefitId === (isPromote ? repair.legacyBenefitId : null)
        && baseline.destinationStatusId === occurrence.keeperStatusId
        && ((baseline.destinationPredefinedBenefitId === null
          && baseline.destinationDefinitionFingerprint === null)
          || (baseline.destinationPredefinedBenefitId === repair.predefinedBenefitId
            && baseline.destinationDefinitionFingerprint === repair.definitionFingerprint))
        && actualMetadataMatches;
    });
    const baselineProvenanceMatches = keeperBaseline.provenance.every((baseline) => {
      const actual = snapshot.benefitStatusSourceProvenance.find((row) => row.id === baseline.id);
      const attempt = actual?.attemptId === null
        ? null
        : snapshot.amexSyncAttempts.find((candidate) => candidate.id === actual?.attemptId);
      return actual !== undefined
        && actual.benefitStatusId === occurrence.keeperStatusId
        && (attempt?.userId ?? null) === baseline.ownerId
        && (baseline.ownerId === null || baseline.ownerId === userId)
        && provenanceStateFingerprints?.get(actual.id) === baseline.stateFingerprint;
    });
    const auditPatchesMatchRelations = parsedAuditPatches.every((patch) => {
      const baseline = keeperBaseline.audits.find((audit) => audit.id === patch.auditId);
      return baseline !== undefined
        && patch.destinationStatusId === occurrence.keeperStatusId
        && patch.destinationCardId === repair.creditCardId
        && patch.destinationBenefitId === repair.legacyBenefitId
        && patch.before.stateFingerprint === baseline.stateFingerprint
        && patch.before.stateFingerprint === patch.after.stateFingerprint
        && ((patch.before.destinationPredefinedBenefitId === null
          && patch.before.destinationDefinitionFingerprint === null)
          || (patch.before.destinationPredefinedBenefitId === repair.predefinedBenefitId
            && patch.before.destinationDefinitionFingerprint === repair.definitionFingerprint))
        && patch.after.destinationPredefinedBenefitId === repair.predefinedBenefitId
        && patch.after.destinationDefinitionFingerprint === repair.definitionFingerprint;
    });

    const removed = occurrence.removedStatusId === null
      ? null
      : statusById.get(occurrence.removedStatusId) ?? null;
    const removedBinding = occurrence.removedStatusId === null
      ? null
      : statusBindingById.get(occurrence.removedStatusId) ?? null;
    const removedSourceIsGlobal = occurrence.removedStatusSource === "CANONICAL_STANDARD";
    const removedPreimageMatches = occurrence.removedStatusId === null
      ? removedPreimage === null
      : removedPreimage !== null
        && removedPreimage.id === occurrence.removedStatusId
        && removedPreimage.userId === userId
        && removedPreimage.benefitId === (removedSourceIsGlobal ? null : repair.legacyBenefitId)
        && removedPreimage.creditCardId === (removedSourceIsGlobal ? repair.creditCardId : null)
        && removedPreimage.predefinedBenefitId === (removedSourceIsGlobal
          ? repair.predefinedBenefitId
          : null)
        && removedPreimage.cycleStartDate === occurrence.cycleStartDate.toISOString()
        && removedPreimage.cycleEndDate === occurrence.cycleEndDate.toISOString()
        && removedPreimage.occurrenceIndex === occurrence.occurrenceIndex;
    const removedCurrentMatches = repair.phase === "APPLIED"
      ? removed === null && removedBinding === null
      : occurrence.removedStatusId === null
        ? true
        : removed !== null && removedPreimage !== null
          && statusStateMatchesPreimage(removed, removedPreimage)
          && statusStateFingerprints?.get(removed.id) === removedPreimage.stateFingerprint
          && (removedSourceIsGlobal
            ? removedBinding?.creditCardId === repair.creditCardId
              && removedBinding.catalogKey === repair.targetPredefinedBenefitCatalogKey
            : removedBinding === null)
          && !snapshot.benefitStatusSourceProvenance.some((row) =>
            row.benefitStatusId === occurrence.removedStatusId)
          && !snapshot.amexSyncRowAudits.some((row) =>
            row.destinationStatusId === occurrence.removedStatusId);
    const actionFingerprintsMatch = categoryRepairActionFingerprintsMatch({
      occurrence,
      keeperBaseline,
      removedPreimage,
      auditPatches: parsedAuditPatches,
    });
    const removedPreimageStorageMatches = occurrence.removedStatusId === null
      ? occurrence.removedStatusPreimageIsSqlNull === true
        && occurrence.removedStatusPreimageJsonType === null
      : occurrence.removedStatusPreimageIsSqlNull === false
        && occurrence.removedStatusPreimageJsonType === "object";

    return occurrence.userId !== userId
      || occurrence.creditCardId !== repair.creditCardId
      || occurrence.predefinedBenefitId !== repair.predefinedBenefitId
      || occurrence.targetPredefinedBenefitCatalogKey !== repair.targetPredefinedBenefitCatalogKey
      || occurrence.keeperBaselineVersion !== 1
      || occurrence.repairAddedAuditMetadataVersion !== 1
      || (occurrence.removedStatusId === null) !== (occurrence.removedStatusSource === null)
      || (occurrence.removedStatusId === null) !== (occurrence.removedStatusPreimageVersion === null)
      || (occurrence.removedStatusId === null) !== (occurrence.removedStatusPreimage === null)
      || (occurrence.removedStatusPreimageVersion !== null
        && occurrence.removedStatusPreimageVersion !== 1)
      || occurrence.removedStatusSource !== expectedRemovedSource
      || !removedPreimageStorageMatches
      || !baselineSourceMatches
      || !currentSourceMatches
      || !attachmentsStructurallyUnique
      || !baselineAuditsMatch
      || !baselineProvenanceMatches
      || !auditPatchesMatchRelations
      || !actionFingerprintsMatch
      || !removedPreimageMatches
      || !removedCurrentMatches;
  })) {
    throw new UserCloneOperatorError("The source category-repair graph contains invalid or colliding occurrence evidence.");
  }
  if (repairs.some((repair) => !categoryRepairParentFingerprintsMatch(
    repair,
    occurrences.filter((occurrence) => occurrence.repairId === repair.id),
  ))) {
    throw new UserCloneOperatorError("The source category-repair graph contains invalid portable fingerprints.");
  }

  assertUniqueIds([snapshot.user], "User");
  assertUniqueIds(snapshot.creditCards, "CreditCard");
  assertUniqueIds(snapshot.benefits, "Benefit");
  assertUniqueIds(snapshot.benefitStatuses, "BenefitStatus");
  assertUniqueIds(snapshot.creditCardEvents, "CreditCardEvent");
  assertUniqueIds(snapshot.loyaltyAccounts, "LoyaltyAccount");
  assertUniqueIds(snapshot.loyaltyCertificates, "LoyaltyCertificate");
  assertUniqueIds(snapshot.externalCardMappings, "ExternalCardMapping");
  assertUniqueIds(snapshot.amexSyncAttempts, "AmexSyncAttempt");
  assertUniqueIds(snapshot.benefitStatusSourceProvenance, "BenefitStatusSourceProvenance");
  assertUniqueIds(snapshot.amexSyncRowAudits, "AmexSyncRowAudit");
  assertUniqueIds(snapshot.categoryRepairs ?? [], "GlobalBenefitCategoryRepair");
  assertUniqueIds(snapshot.categoryRepairOccurrences ?? [], "GlobalBenefitCategoryRepairOccurrence");
  if (snapshot.globalCatalogBindings) {
    assertUniqueIds(snapshot.globalCatalogBindings.ledger, "CatalogMigrationLedger");
    if (new Set(snapshot.globalCatalogBindings.ledger.map((row) => row.legacyBenefitId)).size
      !== snapshot.globalCatalogBindings.ledger.length) {
      throw new UserCloneOperatorError("The source catalog-migration ledger contains duplicate legacy keys.");
    }
  }
}

export async function runSingleUserCloneOperator(input: {
  email: string;
  mode?: "dry-run" | "apply";
  targetVerified?: boolean;
  applyConfirmation?: string;
  replacementConfirmation?: string;
  source: UserCloneSourcePort;
  destination: UserCloneDestinationPort;
}): Promise<UserCloneReport> {
  const normalizedEmail = requireExactNormalizedEmail(input.email);
  const mode = input.mode ?? "dry-run";

  if (mode === "apply") {
    if (input.targetVerified !== true) {
      throw new UserCloneOperatorError("Apply requires the explicit target-verification attestation.");
    }
    if (input.applyConfirmation !== userCloneApplyConfirmation(normalizedEmail)) {
      throw new UserCloneOperatorError("Apply requires the exact single-user clone confirmation phrase.");
    }
  }

  const [sourceIdentity, destinationIdentity] = await Promise.all([
    input.source.identify(),
    input.destination.identify(),
  ]);
  assertTargetIdentities(sourceIdentity, destinationIdentity);

  const sourceRead = await input.source.readAccountSnapshot(normalizedEmail);
  if (sourceRead.matchCount === 0 || !sourceRead.snapshot) {
    throw new UserCloneOperatorError("The source account match was not exactly one user.");
  }
  if (sourceRead.matchCount !== 1) {
    throw new UserCloneOperatorError("The source account match was not exactly one user.");
  }
  const snapshot = sourceRead.snapshot;
  validateUserCloneSnapshot(snapshot, normalizedEmail);

  const destinationUsers = await input.destination.findUsersByNormalizedEmail(normalizedEmail);
  if (destinationUsers.length > 1) {
    throw new UserCloneOperatorError("The destination email match was not unique.");
  }
  const replaceableUserId = destinationUsers[0]?.id ?? null;
  if (replaceableUserId !== null
    && input.replacementConfirmation !== userCloneReplacementConfirmation(normalizedEmail)) {
    throw new UserCloneOperatorError("An existing development user requires the separate exact replacement confirmation phrase.");
  }

  const preflight = await input.destination.preflight(snapshot, replaceableUserId);
  if (preflight.blockingCollisionModels.length > 0) {
    throw new UserCloneOperatorError("Destination identifier or unique-key collisions block the clone.");
  }

  const sourceCounts = countUserCloneSnapshot(snapshot);
  const destinationCounts = mode === "apply"
    ? await input.destination.apply({
      snapshot,
      normalizedEmail,
      replaceableUserId,
      expectedIdentity: destinationIdentity,
    })
    : sourceCounts;

  for (const table of USER_CLONE_TABLES) {
    if (destinationCounts[table] !== sourceCounts[table]) {
      throw new UserCloneOperatorError("Post-write table counts did not match the source snapshot.");
    }
  }

  return {
    mode,
    targets: {
      source: "production",
      destination: "development",
    },
    tables: USER_CLONE_TABLES.map((table) => ({
      table,
      sourceCount: sourceCounts[table],
      destinationCount: destinationCounts[table],
    })),
  };
}
