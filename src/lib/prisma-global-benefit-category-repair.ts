import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma";
import {
  GlobalBenefitCategoryRepairError,
  categoryRepairManifestEntryFingerprint,
  encodeGlobalBenefitCategoryRepairCursor,
  planGlobalBenefitCategoryRepairUnit,
  type CategoryRepairAttachmentSnapshot,
  type CategoryRepairAuditPatch,
  type CategoryRepairAuditSnapshot,
  type CategoryRepairBatchSnapshot,
  type CategoryRepairEvidenceSnapshot,
  type CategoryRepairLegacyBenefitSnapshot,
  type CategoryRepairManifestEntry,
  type GlobalBenefitCategoryRepairManifest,
  type CategoryRepairProposal,
  type CategoryRepairReviewedAuthorityContext,
  type CategoryRepairStatusAction,
  type CategoryRepairStatusPreimage,
  type CategoryRepairStatusSnapshot,
  type CategoryRepairUnitSnapshot,
  type CategoryRepairWriteResult,
  type GlobalBenefitCategoryRepairDatabase,
  type GlobalBenefitCategoryRepairMode,
} from "./global-benefit-category-repair";
import {
  migrationFingerprint,
  type ExistingMigrationLedger,
  type GlobalBenefitDefinition,
  type GlobalCardDefinition,
  type LegacyAuditRelation,
  type LegacyProvenanceRelation,
} from "./global-benefit-migration";
import type {
  CategoryRepairParityAggregateState,
  CategoryRepairParityManifestScope,
  CategoryRepairParityScope,
} from "./global-benefit-category-repair-parity";
import { parityScopeFromUnits } from "./global-benefit-category-repair-parity";

type QueryClient = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;
type TransactionClient = QueryClient;

/**
 * Parity reads cover the complete repair graph and aggregate every relevant
 * table in one repeatable-read snapshot. Keep that potentially expensive
 * interactive transaction bounded independently from the process-wide Prisma
 * default, while still allowing enough time for a reviewed production page.
 */
export const GLOBAL_BENEFIT_CATEGORY_REPAIR_PARITY_TRANSACTION_TIMEOUT_MS = 120_000;
const GLOBAL_BENEFIT_CATEGORY_REPAIR_PARITY_TRANSACTION_MAX_WAIT_MS = 5_000;
const CATEGORY_REPAIR_PARITY_TRANSACTION_TIMEOUT_MESSAGE =
  "The category-repair parity transaction timed out safely.";

interface PrivateKeyRow { privateKey: string }
interface InventoryRow { inventoryFingerprint: string }
interface PageSourceRow { id: string; creditCardId: string }
interface CardRow { id: string; userId: string; predefinedCardId: string }
interface SourceRow {
  id: string;
  category: string;
  description: string;
  percentage: number;
  maxAmount: number | null;
  frequency: string;
  creditCardId: string;
  userId: string | null;
  cycleAlignment: string | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number;
  productKey: string | null;
  creditFamilyKey: string | null;
  periodKey: string | null;
  ledgerId: string;
  ledgerUserId: string;
  ledgerCreditCardId: string | null;
  ledgerPredefinedCardId: string | null;
  ledgerPredefinedBenefitId: string | null;
  ledgerClassification: "STANDARD" | "CUSTOM";
  ledgerPhase: "CLASSIFIED" | "BRIDGED" | "CLEANED" | "ROLLED_BACK";
  ledgerSourceFingerprint: string;
  ledgerDestinationFingerprint: string | null;
}
interface DefinitionCardRow {
  id: string;
  catalogKey: string;
  name: string;
  issuer: string;
  productKey: string | null;
  retiredAt: Date | string | null;
}
interface DefinitionBenefitRow {
  id: string;
  catalogKey: string;
  predefinedCardId: string;
  category: string;
  description: string;
  percentage: number;
  maxAmount: number | null;
  frequency: string;
  cycleAlignment: string | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number;
  productKey: string | null;
  creditFamilyKey: string | null;
  periodKey: string | null;
  retiredAt: Date | string | null;
}
interface StatusRow {
  id: string;
  benefitId: string | null;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  cycleStartDate: Date | string;
  cycleEndDate: Date | string;
  occurrenceIndex: number;
  usedAmount: number | null;
  isCompleted: boolean;
  completedAt: Date | string | null;
  isNotUsable: boolean;
  orderIndex: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  stateJson: unknown;
}
interface AuditRow {
  id: string;
  attemptUserId: string;
  destinationCardId: string | null;
  destinationBenefitId: string | null;
  destinationPredefinedBenefitId: string | null;
  destinationStatusId: string | null;
  destinationDefinitionFingerprint: string | null;
  stateJson: unknown;
}
interface ProvenanceRow {
  id: string;
  benefitStatusId: string;
  attemptUserId: string | null;
  stateJson: unknown;
}
interface RepairRow {
  id: string;
  legacyBenefitId: string;
  catalogMigrationLedgerId: string;
  userId: string;
  creditCardId: string;
  predefinedCardId: string;
  predefinedBenefitId: string;
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
}
interface OccurrenceRow {
  id: string;
  repairId: string;
  userId: string;
  creditCardId: string;
  predefinedBenefitId: string;
  targetPredefinedBenefitCatalogKey: string;
  action: "PROMOTE_LEGACY_STATUS" | "RETAIN_CANONICAL_STATUS";
  keeperSource: "LEGACY_CUSTOM" | "CANONICAL_STANDARD";
  keeperStatusId: string;
  cycleStartDate: Date | string;
  cycleEndDate: Date | string;
  occurrenceIndex: number;
  keeperBaselineVersion: number;
  keeperBaseline: unknown;
  removedStatusId: string | null;
  removedStatusSource: "LEGACY_CUSTOM" | "CANONICAL_STANDARD" | null;
  removedStatusPreimageVersion: number | null;
  removedStatusPreimage: unknown;
  repairAddedAuditMetadataVersion: number;
  repairAddedAuditMetadata: unknown;
  planFingerprint: string;
  postimageFingerprint: string;
}
interface CountRow { count: bigint | number }

interface StoredKeeperBaseline {
  status: CategoryRepairStatusPreimage;
  audits: CategoryRepairAuditSnapshot[];
  provenance: CategoryRepairAttachmentSnapshot[];
}

interface LoadedGraph {
  units: CategoryRepairUnitSnapshot[];
  ledgerIds: Map<string, string>;
  /**
   * All strict-custom sources on the loaded physical cards.  `units` remains
   * page/request scoped; the wider view lets the writer verify and normalize
   * only exact APPLIED sibling effects that belong to the same reviewed page.
   */
  allUnits: CategoryRepairUnitSnapshot[];
}

const NON_CATEGORY_FIELDS = [
  "description",
  "percentage",
  "maxAmount",
  "frequency",
  "cycleAlignment",
  "fixedCycleStartMonth",
  "fixedCycleDurationMonths",
  "occurrencesInCycle",
] as const;

function rawJson(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new GlobalBenefitCategoryRepairError("The category-repair database returned malformed JSON evidence.");
}

function jsonValue<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function asDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new GlobalBenefitCategoryRepairError("The category-repair database returned an invalid date.");
  }
  return date;
}

function nullableDate(value: Date | string | null): Date | null {
  return value === null ? null : asDate(value);
}

function stableStatusFingerprint(row: StatusRow): string {
  const state = { ...rawJson(row.stateJson) };
  delete state.creditCardId;
  delete state.predefinedBenefitId;
  return migrationFingerprint(state);
}

function stableAuditFingerprint(row: AuditRow): string {
  const state = { ...rawJson(row.stateJson) };
  delete state.destinationPredefinedBenefitId;
  delete state.destinationDefinitionFingerprint;
  return migrationFingerprint(state);
}

function stableProvenanceFingerprint(row: ProvenanceRow): string {
  return migrationFingerprint(rawJson(row.stateJson));
}

function sqlText(value: unknown): string {
  return String(value);
}

function sanitized(error: unknown): GlobalBenefitCategoryRepairError {
  if (error instanceof GlobalBenefitCategoryRepairError) return error;
  void sqlText(error);
  return new GlobalBenefitCategoryRepairError("The category-repair database operation failed safely.");
}

function isParityTransactionTimeout(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { error?: unknown };
  };
  if (candidate.code !== "P2028") return false;
  const message = [
    candidate.message,
    candidate.meta?.error,
  ].filter((value): value is string => typeof value === "string").join(" ");
  if (message.length === 0) return false;
  return /(?:timed?\s*out|timeout|expired|transaction\s+(?:already\s+)?(?:closed|not\s+found))/i
    .test(message);
}

function sanitizedParity(error: unknown): GlobalBenefitCategoryRepairError {
  if (isParityTransactionTimeout(error)) {
    return new GlobalBenefitCategoryRepairError(CATEGORY_REPAIR_PARITY_TRANSACTION_TIMEOUT_MESSAGE);
  }
  return sanitized(error);
}

function emptyResult(): CategoryRepairWriteResult {
  return { applied: 0, rolledBack: 0, idempotent: 0 };
}

function exactIso(value: Date | string): string {
  return asDate(value).toISOString();
}

async function readInventoryFingerprint(client: QueryClient): Promise<string> {
  const rows = await client.$queryRaw<InventoryRow[]>(Prisma.sql`
    WITH strict_custom AS (
      SELECT
        ('repair:' || b."id")::text AS "privateKey",
        b."id" AS "sourceBenefitId",
        b."creditCardId", b."userId", b."category", b."description",
        b."percentage", b."maxAmount", b."frequency"::text AS "frequency",
        b."cycleAlignment"::text AS "cycleAlignment", b."fixedCycleStartMonth",
        b."fixedCycleDurationMonths", b."occurrencesInCycle", b."productKey",
        b."creditFamilyKey", b."periodKey", c."userId" AS "cardUserId",
        c."predefinedCardId", pc."catalogKey" AS "cardCatalogKey",
        l."id" AS "ledgerId", l."userId" AS "ledgerUserId",
        l."creditCardId" AS "ledgerCreditCardId",
        l."predefinedCardId" AS "ledgerPredefinedCardId",
        l."predefinedBenefitId" AS "ledgerPredefinedBenefitId",
        l."classification"::text AS "classification", l."phase"::text AS "phase",
        l."sourceFingerprint", l."destinationFingerprint"
      FROM "CatalogMigrationLedger" l
      JOIN "Benefit" b ON b."id" = l."legacyBenefitId"
      JOIN "CreditCard" c ON c."id" = b."creditCardId"
      JOIN "PredefinedCard" pc ON pc."id" = c."predefinedCardId"
      WHERE l."classification" = 'CUSTOM' AND l."phase" = 'CLASSIFIED'
    ), payload AS (
      SELECT jsonb_build_object(
        'namespace', 'global-benefit-category-repair/db-inventory/v1',
        'entries', COALESCE(jsonb_agg(to_jsonb(strict_custom) ORDER BY "privateKey"), '[]'::jsonb)
      )::text AS value
      FROM strict_custom
    )
    SELECT encode(sha256(convert_to(value, 'UTF8')), 'hex') AS "inventoryFingerprint"
    FROM payload
  `);
  const fingerprint = rows[0]?.inventoryFingerprint;
  if (!fingerprint || !/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new GlobalBenefitCategoryRepairError("The database returned an invalid complete inventory digest.");
  }
  return fingerprint;
}

async function readPageKeys(
  client: QueryClient,
  afterCursorDigest: string | null,
  limit: number,
): Promise<{ sourceIds: string[]; hasMore: boolean }> {
  let afterPrivateKey: string | null = null;
  if (afterCursorDigest !== null) {
    const resolved = await client.$queryRaw<PrivateKeyRow[]>(Prisma.sql`
      SELECT ('repair:' || l."legacyBenefitId")::text AS "privateKey"
      FROM "CatalogMigrationLedger" l
      JOIN "Benefit" b ON b."id" = l."legacyBenefitId"
      JOIN "CreditCard" c ON c."id" = b."creditCardId"
      WHERE l."classification" = 'CUSTOM' AND l."phase" = 'CLASSIFIED'
        AND c."predefinedCardId" IS NOT NULL
        AND md5('global-benefit-category-repair/v1:' || ('repair:' || l."legacyBenefitId")) = ${afterCursorDigest}
      ORDER BY "privateKey" ASC
      LIMIT 2
    `);
    if (resolved.length !== 1) {
      throw new GlobalBenefitCategoryRepairError("The repair cursor is invalid for the current source.");
    }
    afterPrivateKey = resolved[0].privateKey;
  }
  const rows = await client.$queryRaw<PrivateKeyRow[]>(Prisma.sql`
    SELECT ('repair:' || l."legacyBenefitId")::text AS "privateKey"
    FROM "CatalogMigrationLedger" l
    JOIN "Benefit" b ON b."id" = l."legacyBenefitId"
    JOIN "CreditCard" c ON c."id" = b."creditCardId"
    WHERE l."classification" = 'CUSTOM' AND l."phase" = 'CLASSIFIED'
      AND c."predefinedCardId" IS NOT NULL
      AND ${afterPrivateKey === null
        ? Prisma.sql`TRUE`
        : Prisma.sql`('repair:' || l."legacyBenefitId") > ${afterPrivateKey}`}
    ORDER BY "privateKey" ASC
    LIMIT ${limit + 1}
  `);
  const privateKeys = rows.slice(0, limit).map((row) => row.privateKey);
  if (privateKeys.some((key) => !key.startsWith("repair:") || key.length === "repair:".length)) {
    throw new GlobalBenefitCategoryRepairError("The database returned an invalid private repair key.");
  }
  return {
    sourceIds: privateKeys.map((key) => key.slice("repair:".length)),
    hasMore: rows.length > limit,
  };
}

async function readDefinitions(
  client: QueryClient,
  predefinedCardIds: readonly string[],
): Promise<GlobalCardDefinition[]> {
  if (predefinedCardIds.length === 0) return [];
  const [cards, benefits] = await Promise.all([
    client.$queryRaw<DefinitionCardRow[]>(Prisma.sql`
      SELECT "id", "catalogKey", "name", "issuer", "productKey", "retiredAt"
      FROM "PredefinedCard"
      WHERE "id" IN (${Prisma.join(predefinedCardIds)})
      ORDER BY "id" ASC
    `),
    client.$queryRaw<DefinitionBenefitRow[]>(Prisma.sql`
      SELECT "id", "catalogKey", "predefinedCardId", "category", "description",
        "percentage", "maxAmount", "frequency"::text AS "frequency",
        "cycleAlignment"::text AS "cycleAlignment", "fixedCycleStartMonth",
        "fixedCycleDurationMonths", "occurrencesInCycle", "productKey",
        "creditFamilyKey", "periodKey", "retiredAt"
      FROM "PredefinedBenefit"
      WHERE "predefinedCardId" IN (${Prisma.join(predefinedCardIds)})
      ORDER BY "predefinedCardId" ASC, "id" ASC
    `),
  ]);
  return cards.map((card) => ({
    ...card,
    catalogKey: card.catalogKey,
    retiredAt: nullableDate(card.retiredAt),
    benefits: benefits.filter((benefit) => benefit.predefinedCardId === card.id).map((benefit) => ({
      ...benefit,
      catalogKey: benefit.catalogKey,
      retiredAt: nullableDate(benefit.retiredAt),
    })),
  }));
}

function relaxedDestination(
  source: SourceRow,
  definition: GlobalCardDefinition,
): GlobalBenefitDefinition | null {
  const matches = definition.benefits.filter((candidate) =>
    NON_CATEGORY_FIELDS.every((field) => source[field] === candidate[field]));
  return matches.length === 1 ? matches[0] : null;
}

function occurrenceAction(row: OccurrenceRow): CategoryRepairStatusAction {
  const stored = jsonValue<StoredKeeperBaseline>(row.keeperBaseline);
  if (!stored || typeof stored !== "object" || !stored.status
    || !Array.isArray(stored.audits) || !Array.isArray(stored.provenance)) {
    throw new GlobalBenefitCategoryRepairError("Stored category-repair keeper evidence is malformed.");
  }
  const removedPreimage = row.removedStatusPreimage === null
    ? null
    : jsonValue<CategoryRepairStatusPreimage>(row.removedStatusPreimage);
  const patches = jsonValue<CategoryRepairAuditPatch[]>(row.repairAddedAuditMetadata);
  if (!Array.isArray(patches)) {
    throw new GlobalBenefitCategoryRepairError("Stored category-repair audit evidence is malformed.");
  }
  return {
    kind: row.action,
    userId: row.userId,
    creditCardId: row.creditCardId,
    predefinedBenefitId: row.predefinedBenefitId,
    cycleStartDate: exactIso(row.cycleStartDate),
    cycleEndDate: exactIso(row.cycleEndDate),
    occurrenceIndex: row.occurrenceIndex,
    keeperStatusId: row.keeperStatusId,
    keeperSourceKind: row.keeperSource === "LEGACY_CUSTOM" ? "legacy" : "canonical",
    keeperBaselineVersion: row.keeperBaselineVersion as 1,
    keeperBaseline: stored.status,
    keeperAuditBaseline: stored.audits,
    keeperProvenanceBaseline: stored.provenance,
    removedStatusId: row.removedStatusId,
    removedSourceKind: row.removedStatusSource === null
      ? null
      : row.removedStatusSource === "LEGACY_CUSTOM" ? "legacy" : "canonical",
    removedPreimageVersion: row.removedStatusPreimageVersion as 1 | null,
    removedPreimage,
    repairAddedAuditMetadataVersion: row.repairAddedAuditMetadataVersion as 1,
    repairAddedAuditMetadata: patches,
    actionFingerprint: row.planFingerprint,
    postimageFingerprint: row.postimageFingerprint,
  };
}

function repairEvidence(
  row: RepairRow,
  occurrences: readonly OccurrenceRow[],
): CategoryRepairEvidenceSnapshot {
  return {
    repairId: row.id,
    phase: row.phase,
    evidenceVersion: row.evidenceVersion as 1,
    sourceBenefitId: row.legacyBenefitId,
    ownerId: row.userId,
    creditCardId: row.creditCardId,
    predefinedCardId: row.predefinedCardId,
    predefinedBenefitId: row.predefinedBenefitId,
    targetCardCatalogKey: row.targetPredefinedCardCatalogKey,
    targetBenefitCatalogKey: row.targetPredefinedBenefitCatalogKey,
    definitionFingerprint: row.definitionFingerprint,
    inventoryFingerprint: row.inventoryFingerprint,
    immutableGraphFingerprint: row.graphFingerprint,
    reviewedCurrentGraphFingerprint: row.reviewedCurrentGraphFingerprint,
    destinationFingerprint: row.destinationFingerprint,
    manifestFingerprint: row.manifestFingerprint,
    manifestEntryFingerprint: row.manifestEntryFingerprint,
    planFingerprint: row.planFingerprint,
    postimageFingerprint: row.postimageFingerprint,
    occurrences: occurrences
      .filter((occurrence) => occurrence.repairId === row.id)
      .sort((left, right) => exactIso(left.cycleStartDate).localeCompare(exactIso(right.cycleStartDate))
        || exactIso(left.cycleEndDate).localeCompare(exactIso(right.cycleEndDate))
        || left.occurrenceIndex - right.occurrenceIndex
        || left.keeperStatusId.localeCompare(right.keeperStatusId))
      .map(occurrenceAction),
  };
}

async function readGraphBySourceIds(
  client: QueryClient,
  requestedSourceIds: readonly string[],
): Promise<LoadedGraph> {
  if (requestedSourceIds.length === 0) return { units: [], ledgerIds: new Map(), allUnits: [] };
  const pageSources = await client.$queryRaw<PageSourceRow[]>(Prisma.sql`
    SELECT b."id", b."creditCardId"
    FROM "Benefit" b
    JOIN "CatalogMigrationLedger" l ON l."legacyBenefitId" = b."id"
    WHERE b."id" IN (${Prisma.join(requestedSourceIds)})
      AND l."classification" = 'CUSTOM' AND l."phase" = 'CLASSIFIED'
    ORDER BY b."id" ASC
  `);
  if (pageSources.length !== requestedSourceIds.length
    || new Set(pageSources.map((row) => row.id)).size !== requestedSourceIds.length) {
    throw new GlobalBenefitCategoryRepairError("A repair source changed while its page was loaded.");
  }
  const cardIds = Array.from(new Set(pageSources.map((row) => row.creditCardId)));
  const [cards, sources] = await Promise.all([
    client.$queryRaw<CardRow[]>(Prisma.sql`
      SELECT c."id", c."userId", c."predefinedCardId"
      FROM "CreditCard" c
      WHERE c."id" IN (${Prisma.join(cardIds)})
      ORDER BY c."id" ASC
    `),
    client.$queryRaw<SourceRow[]>(Prisma.sql`
      SELECT b."id", b."category", b."description", b."percentage", b."maxAmount",
        b."frequency"::text AS "frequency", b."creditCardId", b."userId",
        b."cycleAlignment"::text AS "cycleAlignment", b."fixedCycleStartMonth",
        b."fixedCycleDurationMonths", b."occurrencesInCycle", b."productKey",
        b."creditFamilyKey", b."periodKey", l."id" AS "ledgerId",
        l."userId" AS "ledgerUserId", l."creditCardId" AS "ledgerCreditCardId",
        l."predefinedCardId" AS "ledgerPredefinedCardId",
        l."predefinedBenefitId" AS "ledgerPredefinedBenefitId",
        l."classification"::text AS "ledgerClassification",
        l."phase"::text AS "ledgerPhase", l."sourceFingerprint" AS "ledgerSourceFingerprint",
        l."destinationFingerprint" AS "ledgerDestinationFingerprint"
      FROM "Benefit" b
      JOIN "CatalogMigrationLedger" l ON l."legacyBenefitId" = b."id"
      WHERE b."creditCardId" IN (${Prisma.join(cardIds)})
        AND l."classification" = 'CUSTOM' AND l."phase" = 'CLASSIFIED'
      ORDER BY b."creditCardId" ASC, b."id" ASC
    `),
  ]);
  if (cards.length !== cardIds.length || cards.some((card) => !card.predefinedCardId)) {
    throw new GlobalBenefitCategoryRepairError("A repair card changed while its graph was loaded.");
  }
  const definitions = await readDefinitions(client, Array.from(new Set(cards.map((card) => card.predefinedCardId))));
  const sourceIds = sources.map((source) => source.id);
  const definitionIds = definitions.flatMap((card) => card.benefits.map((benefit) => benefit.id));
  const statuses = await client.$queryRaw<StatusRow[]>(Prisma.sql`
    SELECT bs."id", bs."benefitId", bs."creditCardId", bs."predefinedBenefitId",
      bs."userId", bs."cycleStartDate", bs."cycleEndDate", bs."occurrenceIndex",
      bs."usedAmount", bs."isCompleted", bs."completedAt", bs."isNotUsable",
      bs."orderIndex", bs."createdAt", bs."updatedAt", to_jsonb(bs) AS "stateJson"
    FROM "BenefitStatus" bs
    WHERE ${Prisma.join([
      sourceIds.length > 0 ? Prisma.sql`bs."benefitId" IN (${Prisma.join(sourceIds)})` : Prisma.sql`FALSE`,
      cardIds.length > 0 ? Prisma.sql`bs."creditCardId" IN (${Prisma.join(cardIds)})` : Prisma.sql`FALSE`,
      definitionIds.length > 0
        ? Prisma.sql`(bs."predefinedBenefitId" IN (${Prisma.join(definitionIds)}) AND bs."creditCardId" IN (${Prisma.join(cardIds)}))`
        : Prisma.sql`FALSE`,
    ], " OR ")}
    ORDER BY bs."id" ASC
  `);
  const statusIds = statuses.map((status) => status.id);
  const [audits, provenance, repairs] = await Promise.all([
    client.$queryRaw<AuditRow[]>(Prisma.sql`
      SELECT r."id", a."userId" AS "attemptUserId", r."destinationCardId",
        r."destinationBenefitId", r."destinationPredefinedBenefitId",
        r."destinationStatusId", r."destinationDefinitionFingerprint", to_jsonb(r) AS "stateJson"
      FROM "AmexSyncRowAudit" r
      JOIN "AmexSyncAttempt" a ON a."id" = r."attemptId"
      WHERE ${Prisma.join([
        sourceIds.length > 0 ? Prisma.sql`r."destinationBenefitId" IN (${Prisma.join(sourceIds)})` : Prisma.sql`FALSE`,
        statusIds.length > 0 ? Prisma.sql`r."destinationStatusId" IN (${Prisma.join(statusIds)})` : Prisma.sql`FALSE`,
        cardIds.length > 0 ? Prisma.sql`r."destinationCardId" IN (${Prisma.join(cardIds)})` : Prisma.sql`FALSE`,
      ], " OR ")}
      ORDER BY r."id" ASC
    `),
    statusIds.length === 0 ? Promise.resolve([] as ProvenanceRow[]) : client.$queryRaw<ProvenanceRow[]>(Prisma.sql`
      SELECT p."id", p."benefitStatusId", a."userId" AS "attemptUserId", to_jsonb(p) AS "stateJson"
      FROM "BenefitStatusSourceProvenance" p
      LEFT JOIN "AmexSyncAttempt" a ON a."id" = p."attemptId"
      WHERE p."benefitStatusId" IN (${Prisma.join(statusIds)})
      ORDER BY p."id" ASC
    `),
    client.$queryRaw<RepairRow[]>(Prisma.sql`
      SELECT r."id", r."legacyBenefitId", r."catalogMigrationLedgerId", r."userId",
        r."creditCardId", r."predefinedCardId", r."predefinedBenefitId",
        r."targetPredefinedCardCatalogKey", r."targetPredefinedBenefitCatalogKey",
        r."definitionFingerprint", r."inventoryFingerprint", r."graphFingerprint",
        r."reviewedCurrentGraphFingerprint", r."destinationFingerprint",
        r."manifestFingerprint", r."manifestEntryFingerprint", r."planFingerprint",
        r."postimageFingerprint", r."evidenceVersion", r."phase"::text AS "phase"
      FROM "GlobalBenefitCategoryRepair" r
      WHERE r."legacyBenefitId" IN (${Prisma.join(sourceIds)})
      ORDER BY r."legacyBenefitId" ASC
    `),
  ]);
  const repairIds = repairs.map((repair) => repair.id);
  const occurrences = repairIds.length === 0 ? [] : await client.$queryRaw<OccurrenceRow[]>(Prisma.sql`
    SELECT o."id", o."repairId", o."userId", o."creditCardId", o."predefinedBenefitId",
      o."targetPredefinedBenefitCatalogKey", o."action"::text AS "action",
      o."keeperSource"::text AS "keeperSource", o."keeperStatusId", o."cycleStartDate",
      o."cycleEndDate", o."occurrenceIndex", o."keeperBaselineVersion", o."keeperBaseline",
      o."removedStatusId", o."removedStatusSource"::text AS "removedStatusSource",
      o."removedStatusPreimageVersion", o."removedStatusPreimage",
      o."repairAddedAuditMetadataVersion", o."repairAddedAuditMetadata",
      o."planFingerprint", o."postimageFingerprint"
    FROM "GlobalBenefitCategoryRepairOccurrence" o
    WHERE o."repairId" IN (${Prisma.join(repairIds)})
    ORDER BY o."repairId" ASC, o."cycleStartDate" ASC, o."cycleEndDate" ASC,
      o."occurrenceIndex" ASC, o."keeperStatusId" ASC
  `);

  const auditSnapshots = new Map(audits.map((audit): [string, CategoryRepairAuditSnapshot] => [audit.id, {
    id: audit.id,
    ownerId: audit.attemptUserId,
    stateFingerprint: stableAuditFingerprint(audit),
    destinationCardId: audit.destinationCardId,
    destinationBenefitId: audit.destinationBenefitId,
    destinationStatusId: audit.destinationStatusId,
    destinationPredefinedBenefitId: audit.destinationPredefinedBenefitId,
    destinationDefinitionFingerprint: audit.destinationDefinitionFingerprint,
  }]));
  const provenanceSnapshots = new Map(provenance.map((row): [string, CategoryRepairAttachmentSnapshot] => [row.id, {
    id: row.id,
    ownerId: row.attemptUserId,
    stateFingerprint: stableProvenanceFingerprint(row),
  }]));
  const statusSnapshots = new Map(statuses.map((status): [string, CategoryRepairStatusSnapshot] => [status.id, {
    id: status.id,
    benefitId: status.benefitId,
    creditCardId: status.creditCardId,
    predefinedBenefitId: status.predefinedBenefitId,
    userId: status.userId,
    cycleStartDate: asDate(status.cycleStartDate),
    cycleEndDate: asDate(status.cycleEndDate),
    occurrenceIndex: status.occurrenceIndex,
    usedAmount: status.usedAmount,
    isCompleted: status.isCompleted,
    completedAt: nullableDate(status.completedAt),
    isNotUsable: status.isNotUsable,
    orderIndex: status.orderIndex,
    createdAt: asDate(status.createdAt),
    updatedAt: asDate(status.updatedAt),
    stateFingerprint: stableStatusFingerprint(status),
    audits: audits.filter((audit) => audit.destinationStatusId === status.id)
      .map((audit) => auditSnapshots.get(audit.id)!),
    provenance: provenance.filter((row) => row.benefitStatusId === status.id)
      .map((row) => provenanceSnapshots.get(row.id)!),
  }]));
  const sourceSnapshots = new Map<string, CategoryRepairLegacyBenefitSnapshot>();
  const ledgerIds = new Map<string, string>();
  for (const source of sources) {
    const sourceStatuses = statuses.filter((status) => status.benefitId === source.id);
    const sourceStatusIds = new Set(sourceStatuses.map((status) => status.id));
    const ledger: ExistingMigrationLedger = {
      legacyBenefitId: source.id,
      userId: source.ledgerUserId,
      creditCardId: source.ledgerCreditCardId,
      predefinedCardId: source.ledgerPredefinedCardId,
      predefinedBenefitId: source.ledgerPredefinedBenefitId,
      classification: source.ledgerClassification,
      phase: source.ledgerPhase,
      sourceFingerprint: source.ledgerSourceFingerprint,
      destinationFingerprint: source.ledgerDestinationFingerprint,
    };
    const sourceAudits = audits.filter((audit) =>
      audit.destinationBenefitId === source.id
      || (audit.destinationStatusId !== null && sourceStatusIds.has(audit.destinationStatusId)));
    const sourceProvenance = provenance.filter((row) => sourceStatusIds.has(row.benefitStatusId));
    const snapshot: CategoryRepairLegacyBenefitSnapshot = {
      id: source.id,
      category: source.category,
      description: source.description,
      percentage: source.percentage,
      maxAmount: source.maxAmount,
      frequency: source.frequency,
      creditCardId: source.creditCardId,
      userId: source.userId,
      cycleAlignment: source.cycleAlignment,
      fixedCycleStartMonth: source.fixedCycleStartMonth,
      fixedCycleDurationMonths: source.fixedCycleDurationMonths,
      occurrencesInCycle: source.occurrencesInCycle,
      productKey: source.productKey,
      creditFamilyKey: source.creditFamilyKey,
      periodKey: source.periodKey,
      statuses: sourceStatuses.map((status) => statusSnapshots.get(status.id)!),
      audits: sourceAudits.map((audit): LegacyAuditRelation => ({
        id: audit.id,
        attemptUserId: audit.attemptUserId,
        destinationCardId: audit.destinationCardId,
        destinationBenefitId: audit.destinationBenefitId,
        destinationPredefinedBenefitId: audit.destinationPredefinedBenefitId,
        destinationStatusId: audit.destinationStatusId,
        destinationDefinitionFingerprint: audit.destinationDefinitionFingerprint,
        stateFingerprint: stableAuditFingerprint(audit),
      })),
      provenance: sourceProvenance.map((row): LegacyProvenanceRelation => ({
        id: row.id,
        benefitStatusId: row.benefitStatusId,
        attemptUserId: row.attemptUserId,
      })),
      ledger,
    };
    sourceSnapshots.set(source.id, snapshot);
    ledgerIds.set(source.id, source.ledgerId);
  }
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
  const repairBySource = new Map(repairs.map((repair) => [repair.legacyBenefitId, repair]));
  const sourceRowById = new Map(sources.map((source) => [source.id, source]));
  const allUnits = sources.map((sourceRow): CategoryRepairUnitSnapshot => {
    const sourceId = sourceRow.id;
    const source = sourceSnapshots.get(sourceId);
    const loadedSourceRow = sourceRowById.get(sourceId);
    if (!source || !loadedSourceRow) {
      throw new GlobalBenefitCategoryRepairError("A repair source disappeared while its graph was assembled.");
    }
    const card = cardById.get(loadedSourceRow.creditCardId);
    const definition = card ? definitionById.get(card.predefinedCardId) : undefined;
    if (!card || !definition) {
      throw new GlobalBenefitCategoryRepairError("A repair card or global product disappeared while its graph was assembled.");
    }
    const target = relaxedDestination(loadedSourceRow, definition);
    const repair = repairBySource.get(sourceId);
    return {
      privateKey: `repair:${sourceId}`,
      card: { id: card.id, userId: card.userId, predefinedCardId: card.predefinedCardId },
      source,
      predefinedCard: definition,
      destinationStatuses: target === null ? [] : statuses
        .filter((status) => status.creditCardId === card.id && status.predefinedBenefitId === target.id)
        .map((status) => statusSnapshots.get(status.id)!),
      cardStrictCustomSources: sources
        .filter((candidate) => candidate.creditCardId === card.id)
        .map((candidate) => sourceSnapshots.get(candidate.id)!),
      repairEvidence: repair ? repairEvidence(repair, occurrences) : null,
    };
  });
  const requested = requestedSourceIds.map((sourceId) => {
    const unit = allUnits.find((candidate) => candidate.source.id === sourceId);
    if (!unit) {
      throw new GlobalBenefitCategoryRepairError("A requested repair definition disappeared while its graph was assembled.");
    }
    return unit;
  });
  return {
    units: requested,
    ledgerIds,
    // `validateCurrentAllUnits` requires deterministic private-key order;
    // the SQL source query is card-ordered because it serves same-card graph
    // loading, so normalize the private view before returning it.
    allUnits: allUnits.sort((left, right) => left.privateKey.localeCompare(right.privateKey)),
  };
}

function selectManifestPageKeys(
  allKeys: readonly PrivateKeyRow[],
  page: GlobalBenefitCategoryRepairManifest,
): PrivateKeyRow[] {
  const cursorIndex = (cursor: string | null): number | null => {
    if (cursor === null) return null;
    const index = allKeys.findIndex((row) =>
      encodeGlobalBenefitCategoryRepairCursor(row.privateKey).slice("gbr1.".length) === cursor.slice("gbr1.".length));
    if (index < 0) {
      throw new GlobalBenefitCategoryRepairError("The private parity manifest cursor is not covered by the current inventory.");
    }
    return index;
  };
  const afterIndex = cursorIndex(page.afterCursor);
  const nextIndex = cursorIndex(page.nextCursor);
  if ((page.hasMore !== (page.nextCursor !== null))
    || (afterIndex !== null && nextIndex !== null && afterIndex >= nextIndex)) {
    throw new GlobalBenefitCategoryRepairError("The private parity manifest page chain is invalid.");
  }
  const start = afterIndex === null ? 0 : afterIndex + 1;
  const end = nextIndex === null ? allKeys.length : nextIndex + 1;
  if (start > end) {
    throw new GlobalBenefitCategoryRepairError("The private parity manifest page chain is invalid.");
  }
  return allKeys.slice(start, end);
}

async function readOneUnit(client: QueryClient, privateKey: string): Promise<LoadedGraph> {
  if (!privateKey.startsWith("repair:") || privateKey.length === "repair:".length) {
    throw new GlobalBenefitCategoryRepairError("The private repair key is invalid.");
  }
  const graph = await readGraphBySourceIds(client, [privateKey.slice("repair:".length)]);
  if (graph.units.length !== 1) {
    throw new GlobalBenefitCategoryRepairError("The repair definition no longer exists.");
  }
  return graph;
}

type ParityTableName =
  | "User"
  | "CreditCard"
  | "Benefit"
  | "PredefinedCard"
  | "PredefinedBenefit"
  | "BenefitStatus"
  | "AmexSyncRowAudit"
  | "BenefitStatusSourceProvenance"
  | "CatalogMigrationLedger"
  | "GlobalBenefitCategoryRepair"
  | "GlobalBenefitCategoryRepairOccurrence"
  | "AmexSyncAttempt"
  | "CreditCardEvent"
  | "ExternalCardMapping";

interface ParityAggregateRow { count: bigint | number; digest: string }

function sqlIdList(values: readonly string[]): ReturnType<typeof Prisma.sql> {
  return values.length === 0
    ? Prisma.sql`FALSE`
    : Prisma.sql`t."id" IN (${Prisma.join(values)})`;
}

function parityScopeCondition(
  table: ParityTableName,
  scope: CategoryRepairParityScope,
): ReturnType<typeof Prisma.sql> {
  switch (table) {
    // These tables are never changed by a category repair. Keeping them in the
    // unrelated digest makes an unexpected owner/card/catalog edit visible.
    case "User":
    case "CreditCard":
    case "Benefit":
    case "PredefinedCard":
    case "PredefinedBenefit":
    case "BenefitStatusSourceProvenance":
    case "AmexSyncAttempt":
    case "CreditCardEvent":
    case "ExternalCardMapping":
      return Prisma.sql`FALSE`;
    case "BenefitStatus":
      return sqlIdList(scope.statusIds);
    case "AmexSyncRowAudit":
      return sqlIdList(scope.auditIds);
    case "CatalogMigrationLedger":
      return scope.sourceBenefitIds.length === 0
        ? Prisma.sql`FALSE`
        : Prisma.sql`t."legacyBenefitId" IN (${Prisma.join(scope.sourceBenefitIds)})`;
    case "GlobalBenefitCategoryRepair":
      return scope.sourceBenefitIds.length === 0
        ? Prisma.sql`FALSE`
        : Prisma.sql`t."legacyBenefitId" IN (${Prisma.join(scope.sourceBenefitIds)})`;
    case "GlobalBenefitCategoryRepairOccurrence": {
      const sourceParent = scope.sourceBenefitIds.length === 0
        ? Prisma.sql`FALSE`
        : Prisma.sql`p."legacyBenefitId" IN (${Prisma.join(scope.sourceBenefitIds)})`;
      const knownParent = scope.repairIds && scope.repairIds.length > 0
        ? Prisma.sql`t."repairId" IN (${Prisma.join(scope.repairIds)})`
        : Prisma.sql`FALSE`;
      return Prisma.sql`(${knownParent} OR EXISTS (
        SELECT 1 FROM "GlobalBenefitCategoryRepair" p
        WHERE p."id" = t."repairId" AND ${sourceParent}
      ))`;
    }
  }
}

function parityRowJson(table: ParityTableName): ReturnType<typeof Prisma.sql> {
  // Never return row values to the application. Drop credential/card-number
  // columns before hashing; those secrets are not repair authority and should
  // not be read into a JS object even transiently.
  if (table === "User") return Prisma.sql`to_jsonb(t) - ARRAY['password']::text[]`;
  if (table === "CreditCard") return Prisma.sql`to_jsonb(t) - ARRAY['cardNumber']::text[]`;
  return Prisma.sql`to_jsonb(t)`;
}

function parityAggregateQuery(
  table: ParityTableName,
  scope: CategoryRepairParityScope,
): ReturnType<typeof Prisma.sql> {
  const excluded = parityScopeCondition(table, scope);
  const rowHash = Prisma.sql`encode(sha256(convert_to((${parityRowJson(table)})::text, 'UTF8')), 'hex')`;
  const digest = Prisma.sql`encode(sha256(convert_to(COALESCE(
    string_agg(${rowHash}, E'\\n' ORDER BY t."id") FILTER (WHERE NOT (${excluded})),
    ''
  ), 'UTF8')), 'hex')`;
  switch (table) {
    case "User": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "User" t`;
    case "CreditCard": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "CreditCard" t`;
    case "Benefit": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "Benefit" t`;
    case "PredefinedCard": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "PredefinedCard" t`;
    case "PredefinedBenefit": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "PredefinedBenefit" t`;
    case "BenefitStatus": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "BenefitStatus" t`;
    case "AmexSyncRowAudit": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "AmexSyncRowAudit" t`;
    case "BenefitStatusSourceProvenance": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "BenefitStatusSourceProvenance" t`;
    case "CatalogMigrationLedger": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "CatalogMigrationLedger" t`;
    case "GlobalBenefitCategoryRepair": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "GlobalBenefitCategoryRepair" t`;
    case "GlobalBenefitCategoryRepairOccurrence": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "GlobalBenefitCategoryRepairOccurrence" t`;
    case "AmexSyncAttempt": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "AmexSyncAttempt" t`;
    case "CreditCardEvent": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "CreditCardEvent" t`;
    case "ExternalCardMapping": return Prisma.sql`SELECT count(*)::bigint AS "count", ${digest} AS "digest" FROM "ExternalCardMapping" t`;
  }
}

async function readParityTableAggregate(
  client: QueryClient,
  table: ParityTableName,
  scope: CategoryRepairParityScope,
): Promise<ParityAggregateRow> {
  const rows = await client.$queryRaw<ParityAggregateRow[]>(parityAggregateQuery(table, scope));
  const row = rows[0];
  if (!row || !/^[a-f0-9]{64}$/.test(row.digest)) {
    throw new GlobalBenefitCategoryRepairError("The category-repair parity database returned malformed aggregate evidence.");
  }
  return row;
}

async function readCategoryRepairParityAggregate(
  client: QueryClient,
  scope: CategoryRepairParityScope,
): Promise<CategoryRepairParityAggregateState> {
  const tables: readonly ParityTableName[] = [
    "User", "CreditCard", "Benefit", "PredefinedCard", "PredefinedBenefit", "BenefitStatus",
    "AmexSyncRowAudit", "BenefitStatusSourceProvenance", "CatalogMigrationLedger",
    "GlobalBenefitCategoryRepair", "GlobalBenefitCategoryRepairOccurrence", "AmexSyncAttempt",
    "CreditCardEvent", "ExternalCardMapping",
  ];
  const rows = await Promise.all(tables.map((table) => readParityTableAggregate(client, table, scope)));
  const count = (index: number): number => {
    const value = rows[index].count;
    const number = typeof value === "bigint" ? Number(value) : value;
    if (!Number.isSafeInteger(number) || number < 0) {
      throw new GlobalBenefitCategoryRepairError("The category-repair parity database returned malformed counts.");
    }
    return number;
  };
  const unrelatedRowsDigest = migrationFingerprint(tables.map((table, index) => [
    table,
    rows[index].digest,
  ]));
  return {
    counts: {
      users: count(0),
      cards: count(1),
      benefits: count(2),
      predefinedCards: count(3),
      predefinedBenefits: count(4),
      statuses: count(5),
      audits: count(6),
      provenance: count(7),
      ledgers: count(8),
      repairs: count(9),
      occurrences: count(10),
    },
    unrelatedRowsDigest,
  };
}

function entryBody(entry: CategoryRepairManifestEntry): Omit<CategoryRepairManifestEntry, "entryFingerprint"> {
  const body = { ...entry } as Partial<CategoryRepairManifestEntry>;
  delete body.entryFingerprint;
  return body as Omit<CategoryRepairManifestEntry, "entryFingerprint">;
}

function validateWriterAuthority(input: {
  expectedMode: "apply" | "rollback";
  proposal: CategoryRepairProposal;
  entry: CategoryRepairManifestEntry;
  authority: CategoryRepairReviewedAuthorityContext;
}): void {
  const { proposal, entry, authority } = input;
  const manifestEntryFingerprints = authority.manifestEntryFingerprints;
  const validEntryAuthorities = manifestEntryFingerprints === undefined
    || (manifestEntryFingerprints.length > 0
      && manifestEntryFingerprints.every((fingerprint) => /^[a-f0-9]{64}$/.test(fingerprint))
      && new Set(manifestEntryFingerprints).size === manifestEntryFingerprints.length);
  if (authority.mode !== input.expectedMode
    || !/^[a-f0-9]{64}$/.test(authority.inventoryFingerprint)
    || !/^[a-f0-9]{64}$/.test(authority.manifestFingerprint)
    || !/^[a-f0-9]{64}$/.test(authority.pageFingerprint)
    || categoryRepairManifestEntryFingerprint(entryBody(entry)) !== entry.entryFingerprint
    || entry.privateKey !== proposal.privateKey
    || entry.sourceBenefitId !== proposal.sourceBenefitId
    || entry.ownerId !== proposal.ownerId
    || entry.creditCardId !== proposal.creditCardId
    || entry.predefinedCardId !== proposal.predefinedCardId
    || entry.predefinedBenefitId !== proposal.predefinedBenefitId
    || entry.targetCardCatalogKey !== proposal.targetCardCatalogKey
    || entry.targetBenefitCatalogKey !== proposal.targetBenefitCatalogKey
    || entry.definitionFingerprint !== proposal.definitionFingerprint
    || entry.immutableGraphFingerprint !== proposal.immutableGraphFingerprint
    || !validEntryAuthorities
    || (manifestEntryFingerprints !== undefined && !manifestEntryFingerprints.includes(entry.entryFingerprint))
    || (input.expectedMode === "apply" && (
      entry.currentGraphFingerprint !== proposal.currentGraphFingerprint
      || entry.destinationFingerprint !== proposal.destinationFingerprint
      || entry.postimageFingerprint !== proposal.postimageFingerprint
      || entry.planFingerprint !== proposal.planFingerprint
    ))
    || proposal.blocked) {
    throw new GlobalBenefitCategoryRepairError("The reviewed repair authority is inconsistent.");
  }
  if (input.expectedMode === "apply" && proposal.intent !== "APPLY" && proposal.intent !== "APPLY_REPLAY") {
    throw new GlobalBenefitCategoryRepairError("The reviewed repair proposal has the wrong apply intent.");
  }
  if (input.expectedMode === "rollback" && proposal.intent !== "ROLLBACK" && proposal.intent !== "ROLLBACK_REPLAY") {
    throw new GlobalBenefitCategoryRepairError("The reviewed repair proposal has the wrong rollback intent.");
  }
}

function proposalsExactlyEqual(left: CategoryRepairProposal, right: CategoryRepairProposal): boolean {
  return migrationFingerprint(left) === migrationFingerprint(right);
}

function occurrenceKeeperBaseline(action: CategoryRepairStatusAction): StoredKeeperBaseline {
  return {
    status: action.keeperBaseline,
    audits: action.keeperAuditBaseline,
    provenance: action.keeperProvenanceBaseline,
  };
}

async function insertParentEvidence(
  client: QueryClient,
  input: {
    repairId: string;
    ledgerId: string;
    proposal: CategoryRepairProposal;
    entry: CategoryRepairManifestEntry;
    authority: CategoryRepairReviewedAuthorityContext;
    existingPhase: "none" | "ROLLED_BACK";
  },
): Promise<void> {
  const { proposal, entry, authority } = input;
  if (proposal.predefinedBenefitId === null || proposal.targetCardCatalogKey === null
    || proposal.targetBenefitCatalogKey === null || proposal.definitionFingerprint === null
    || proposal.destinationFingerprint === null) {
    throw new GlobalBenefitCategoryRepairError("A category repair without exact global authority reached the writer.");
  }
  if (input.existingPhase === "none") {
    const inserted = await client.$executeRaw(Prisma.sql`
      INSERT INTO "GlobalBenefitCategoryRepair" (
        "id", "legacyBenefitId", "catalogMigrationLedgerId", "userId", "creditCardId",
        "predefinedCardId", "predefinedBenefitId", "targetPredefinedCardCatalogKey",
        "targetPredefinedBenefitCatalogKey", "definitionFingerprint", "inventoryFingerprint",
        "graphFingerprint", "reviewedCurrentGraphFingerprint", "destinationFingerprint",
        "manifestFingerprint", "manifestEntryFingerprint", "planFingerprint",
        "postimageFingerprint", "evidenceVersion", "phase", "appliedAt", "rolledBackAt",
        "createdAt", "updatedAt"
      ) VALUES (
        ${input.repairId}, ${proposal.sourceBenefitId}, ${input.ledgerId}, ${proposal.ownerId},
        ${proposal.creditCardId}, ${proposal.predefinedCardId}, ${proposal.predefinedBenefitId},
        ${proposal.targetCardCatalogKey}, ${proposal.targetBenefitCatalogKey},
        ${proposal.definitionFingerprint}, ${authority.inventoryFingerprint},
        ${proposal.immutableGraphFingerprint}, ${proposal.currentGraphFingerprint},
        ${proposal.destinationFingerprint}, ${authority.manifestFingerprint},
        ${entry.entryFingerprint}, ${proposal.planFingerprint}, ${proposal.postimageFingerprint},
        1, 'APPLIED'::"GlobalBenefitCategoryRepairPhase", CURRENT_TIMESTAMP, NULL,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);
    if (inserted !== 1) throw new GlobalBenefitCategoryRepairError("Repair parent evidence was not persisted.");
    return;
  }
  const updated = await client.$executeRaw(Prisma.sql`
    UPDATE "GlobalBenefitCategoryRepair"
    SET "catalogMigrationLedgerId" = ${input.ledgerId}, "userId" = ${proposal.ownerId},
      "creditCardId" = ${proposal.creditCardId}, "predefinedCardId" = ${proposal.predefinedCardId},
      "predefinedBenefitId" = ${proposal.predefinedBenefitId},
      "targetPredefinedCardCatalogKey" = ${proposal.targetCardCatalogKey},
      "targetPredefinedBenefitCatalogKey" = ${proposal.targetBenefitCatalogKey},
      "definitionFingerprint" = ${proposal.definitionFingerprint},
      "inventoryFingerprint" = ${authority.inventoryFingerprint},
      "graphFingerprint" = ${proposal.immutableGraphFingerprint},
      "reviewedCurrentGraphFingerprint" = ${proposal.currentGraphFingerprint},
      "destinationFingerprint" = ${proposal.destinationFingerprint},
      "manifestFingerprint" = ${authority.manifestFingerprint},
      "manifestEntryFingerprint" = ${entry.entryFingerprint},
      "planFingerprint" = ${proposal.planFingerprint},
      "postimageFingerprint" = ${proposal.postimageFingerprint},
      "evidenceVersion" = 1, "phase" = 'APPLIED', "appliedAt" = CURRENT_TIMESTAMP,
      "rolledBackAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.repairId} AND "legacyBenefitId" = ${proposal.sourceBenefitId}
      AND "phase" = 'ROLLED_BACK'
  `);
  if (updated !== 1) throw new GlobalBenefitCategoryRepairError("Rolled-back repair evidence changed before reapply.");
}

async function upsertOccurrenceEvidence(
  client: QueryClient,
  repairId: string,
  targetBenefitCatalogKey: string,
  action: CategoryRepairStatusAction,
): Promise<void> {
  const keeperBaseline = JSON.stringify(occurrenceKeeperBaseline(action));
  const removedPreimage = action.removedPreimage === null ? null : JSON.stringify(action.removedPreimage);
  const auditMetadata = JSON.stringify(action.repairAddedAuditMetadata);
  const changed = await client.$executeRaw(Prisma.sql`
    INSERT INTO "GlobalBenefitCategoryRepairOccurrence" (
      "id", "repairId", "userId", "creditCardId", "predefinedBenefitId",
      "targetPredefinedBenefitCatalogKey", "action", "keeperSource", "keeperStatusId",
      "cycleStartDate", "cycleEndDate", "occurrenceIndex", "keeperBaselineVersion",
      "keeperBaseline", "removedStatusId", "removedStatusSource",
      "removedStatusPreimageVersion", "removedStatusPreimage",
      "repairAddedAuditMetadataVersion", "repairAddedAuditMetadata", "planFingerprint",
      "postimageFingerprint", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${repairId}, ${action.userId}, ${action.creditCardId},
      ${action.predefinedBenefitId}, ${targetBenefitCatalogKey},
      ${action.kind}::"GlobalBenefitCategoryRepairAction",
      ${action.keeperSourceKind === "legacy" ? "LEGACY_CUSTOM" : "CANONICAL_STANDARD"}::"GlobalBenefitCategoryRepairStatusSource",
      ${action.keeperStatusId}, ${new Date(action.cycleStartDate)}, ${new Date(action.cycleEndDate)},
      ${action.occurrenceIndex}, 1, ${keeperBaseline}::jsonb, ${action.removedStatusId},
      ${action.removedSourceKind === null
        ? Prisma.sql`NULL`
        : Prisma.sql`${action.removedSourceKind === "legacy" ? "LEGACY_CUSTOM" : "CANONICAL_STANDARD"}::"GlobalBenefitCategoryRepairStatusSource"`},
      ${action.removedPreimageVersion}, ${removedPreimage === null ? Prisma.sql`NULL` : Prisma.sql`${removedPreimage}::jsonb`},
      1, ${auditMetadata}::jsonb, ${action.actionFingerprint}, ${action.postimageFingerprint},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("repairId", "userId", "creditCardId", "predefinedBenefitId",
      "cycleStartDate", "cycleEndDate", "occurrenceIndex") DO UPDATE SET
      "targetPredefinedBenefitCatalogKey" = EXCLUDED."targetPredefinedBenefitCatalogKey",
      "action" = EXCLUDED."action", "keeperSource" = EXCLUDED."keeperSource",
      "keeperStatusId" = EXCLUDED."keeperStatusId", "keeperBaselineVersion" = 1,
      "keeperBaseline" = EXCLUDED."keeperBaseline", "removedStatusId" = EXCLUDED."removedStatusId",
      "removedStatusSource" = EXCLUDED."removedStatusSource",
      "removedStatusPreimageVersion" = EXCLUDED."removedStatusPreimageVersion",
      "removedStatusPreimage" = EXCLUDED."removedStatusPreimage",
      "repairAddedAuditMetadataVersion" = 1,
      "repairAddedAuditMetadata" = EXCLUDED."repairAddedAuditMetadata",
      "planFingerprint" = EXCLUDED."planFingerprint",
      "postimageFingerprint" = EXCLUDED."postimageFingerprint", "updatedAt" = CURRENT_TIMESTAMP
    WHERE "GlobalBenefitCategoryRepairOccurrence"."repairId" = EXCLUDED."repairId"
  `);
  if (changed !== 1) throw new GlobalBenefitCategoryRepairError("Repair occurrence evidence was not persisted.");
}

async function removeObsoleteOccurrenceEvidence(
  client: QueryClient,
  repairId: string,
  actions: readonly CategoryRepairStatusAction[],
): Promise<void> {
  if (actions.length === 0) {
    const removed = await client.$executeRaw(Prisma.sql`
      DELETE FROM "GlobalBenefitCategoryRepairOccurrence" WHERE "repairId" = ${repairId}
    `);
    if (removed !== 0) {
      throw new GlobalBenefitCategoryRepairError("A suppression-only repair contained stale occurrence evidence.");
    }
    return;
  }
  const keepers = actions.map((action) => action.keeperStatusId);
  await client.$executeRaw(Prisma.sql`
    DELETE FROM "GlobalBenefitCategoryRepairOccurrence"
    WHERE "repairId" = ${repairId} AND "keeperStatusId" NOT IN (${Prisma.join(keepers)})
  `);
  const counts = await client.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT count(*)::bigint AS "count"
    FROM "GlobalBenefitCategoryRepairOccurrence" WHERE "repairId" = ${repairId}
  `);
  if (Number(counts[0]?.count ?? -1) !== actions.length) {
    throw new GlobalBenefitCategoryRepairError("Repair occurrence evidence is incomplete.");
  }
}

function statusCasPredicates(preimage: CategoryRepairStatusPreimage): Prisma.Sql {
  return Prisma.sql`
    "id" = ${preimage.id}
    AND "benefitId" IS NOT DISTINCT FROM ${preimage.benefitId}
    AND "creditCardId" IS NOT DISTINCT FROM ${preimage.creditCardId}
    AND "predefinedBenefitId" IS NOT DISTINCT FROM ${preimage.predefinedBenefitId}
    AND "userId" = ${preimage.userId}
    AND "cycleStartDate" = ${new Date(preimage.cycleStartDate)}
    AND "cycleEndDate" = ${new Date(preimage.cycleEndDate)}
    AND "occurrenceIndex" = ${preimage.occurrenceIndex}
    AND "usedAmount" IS NOT DISTINCT FROM ${preimage.usedAmount}
    AND "isCompleted" = ${preimage.isCompleted}
    AND "completedAt" IS NOT DISTINCT FROM ${preimage.completedAt === null ? null : new Date(preimage.completedAt)}
    AND "isNotUsable" = ${preimage.isNotUsable}
    AND "orderIndex" IS NOT DISTINCT FROM ${preimage.orderIndex}
    AND "createdAt" = ${new Date(preimage.createdAt)}
    AND "updatedAt" = ${new Date(preimage.updatedAt)}
  `;
}

async function deleteLoser(client: QueryClient, action: CategoryRepairStatusAction): Promise<void> {
  if (!action.removedPreimage || !action.removedStatusId) return;
  const removed = await client.$executeRaw(Prisma.sql`
    DELETE FROM "BenefitStatus" bs
    WHERE ${statusCasPredicates(action.removedPreimage)}
      AND NOT EXISTS (SELECT 1 FROM "AmexSyncRowAudit" a WHERE a."destinationStatusId" = bs."id")
      AND NOT EXISTS (SELECT 1 FROM "BenefitStatusSourceProvenance" p WHERE p."benefitStatusId" = bs."id")
      AND NOT EXISTS (
        SELECT 1 FROM "GlobalBenefitCategoryRepairOccurrence" e
        WHERE e."keeperStatusId" = bs."id"
      )
  `);
  if (removed !== 1) throw new GlobalBenefitCategoryRepairError("A repair loser compare-and-set failed.");
}

async function promoteKeeper(client: QueryClient, action: CategoryRepairStatusAction): Promise<void> {
  if (action.kind !== "PROMOTE_LEGACY_STATUS") return;
  const changed = await client.$executeRaw(Prisma.sql`
    UPDATE "BenefitStatus"
    SET "creditCardId" = ${action.creditCardId}, "predefinedBenefitId" = ${action.predefinedBenefitId}
    WHERE ${statusCasPredicates(action.keeperBaseline)}
      AND "creditCardId" IS NULL AND "predefinedBenefitId" IS NULL
  `);
  if (changed !== 1) throw new GlobalBenefitCategoryRepairError("A repair keeper compare-and-set failed.");
}

async function applyAuditPatch(client: QueryClient, patch: CategoryRepairAuditPatch): Promise<void> {
  if (patch.before.destinationPredefinedBenefitId === patch.after.destinationPredefinedBenefitId
    && patch.before.destinationDefinitionFingerprint === patch.after.destinationDefinitionFingerprint) return;
  const changed = await client.$executeRaw(Prisma.sql`
    UPDATE "AmexSyncRowAudit"
    SET "destinationPredefinedBenefitId" = ${patch.after.destinationPredefinedBenefitId},
      "destinationDefinitionFingerprint" = ${patch.after.destinationDefinitionFingerprint}
    WHERE "id" = ${patch.auditId}
      AND "destinationCardId" IS NOT DISTINCT FROM ${patch.destinationCardId}
      AND "destinationBenefitId" IS NOT DISTINCT FROM ${patch.destinationBenefitId}
      AND "destinationStatusId" = ${patch.destinationStatusId}
      AND "destinationPredefinedBenefitId" IS NOT DISTINCT FROM ${patch.before.destinationPredefinedBenefitId}
      AND "destinationDefinitionFingerprint" IS NOT DISTINCT FROM ${patch.before.destinationDefinitionFingerprint}
  `);
  if (changed !== 1) throw new GlobalBenefitCategoryRepairError("A repair audit compare-and-set failed.");
}

function findStatus(unit: CategoryRepairUnitSnapshot, id: string): CategoryRepairStatusSnapshot | null {
  const values = [...unit.source.statuses, ...unit.destinationStatuses].filter((status) => status.id === id);
  if (values.length === 0) return null;
  if (values.some((status) => migrationFingerprint(status) !== migrationFingerprint(values[0]))) return null;
  return values[0];
}

function currentPreimage(status: CategoryRepairStatusSnapshot): CategoryRepairStatusPreimage {
  return {
    id: status.id,
    benefitId: status.benefitId,
    creditCardId: status.creditCardId,
    predefinedBenefitId: status.predefinedBenefitId,
    userId: status.userId,
    cycleStartDate: status.cycleStartDate.toISOString(),
    cycleEndDate: status.cycleEndDate.toISOString(),
    occurrenceIndex: status.occurrenceIndex,
    usedAmount: status.usedAmount,
    isCompleted: status.isCompleted,
    completedAt: status.completedAt?.toISOString() ?? null,
    isNotUsable: status.isNotUsable,
    orderIndex: status.orderIndex,
    createdAt: status.createdAt.toISOString(),
    updatedAt: status.updatedAt.toISOString(),
    stateFingerprint: status.stateFingerprint,
  };
}

function verifyImmediateApply(
  unit: CategoryRepairUnitSnapshot,
  proposal: CategoryRepairProposal,
  repairId: string,
): void {
  const evidenceChecks = {
    historical: unit.source.ledger?.classification === "CUSTOM"
      && unit.source.ledger.phase === "CLASSIFIED",
    phase: unit.repairEvidence?.phase === "APPLIED",
    repair: unit.repairEvidence?.repairId === repairId,
    plan: unit.repairEvidence?.planFingerprint === proposal.planFingerprint,
    postimage: unit.repairEvidence?.postimageFingerprint === proposal.postimageFingerprint,
  };
  if (Object.values(evidenceChecks).some((value) => !value)) {
    throw new GlobalBenefitCategoryRepairError(
      `Post-apply repair evidence verification failed (${Object.entries(evidenceChecks)
        .filter(([, value]) => !value).map(([key]) => key).join(",")}).`,
    );
  }
  for (const action of proposal.actions) {
    const keeper = findStatus(unit, action.keeperStatusId);
    if (!keeper) throw new GlobalBenefitCategoryRepairError("Post-apply keeper verification failed.");
    const expected = {
      ...action.keeperBaseline,
      creditCardId: action.creditCardId,
      predefinedBenefitId: action.predefinedBenefitId,
    };
    if (migrationFingerprint(currentPreimage(keeper)) !== migrationFingerprint(expected)
      || (action.removedStatusId !== null && findStatus(unit, action.removedStatusId) !== null)) {
      throw new GlobalBenefitCategoryRepairError("Post-apply protected-state verification failed.");
    }
  }
  const replay = planGlobalBenefitCategoryRepairUnit(unit, "apply");
  if (replay.blocked || replay.intent !== "APPLY_REPLAY") {
    throw new GlobalBenefitCategoryRepairError("Post-apply canonical-authority verification failed.");
  }
}

function snapshotFromPreimage(
  preimage: CategoryRepairStatusPreimage,
  audits: CategoryRepairAuditSnapshot[] = [],
  provenance: CategoryRepairAttachmentSnapshot[] = [],
): CategoryRepairStatusSnapshot {
  return {
    id: preimage.id,
    benefitId: preimage.benefitId,
    creditCardId: preimage.creditCardId,
    predefinedBenefitId: preimage.predefinedBenefitId,
    userId: preimage.userId,
    cycleStartDate: new Date(preimage.cycleStartDate),
    cycleEndDate: new Date(preimage.cycleEndDate),
    occurrenceIndex: preimage.occurrenceIndex,
    usedAmount: preimage.usedAmount,
    isCompleted: preimage.isCompleted,
    completedAt: preimage.completedAt === null ? null : new Date(preimage.completedAt),
    isNotUsable: preimage.isNotUsable,
    orderIndex: preimage.orderIndex,
    createdAt: new Date(preimage.createdAt),
    updatedAt: new Date(preimage.updatedAt),
    stateFingerprint: preimage.stateFingerprint,
    audits,
    provenance,
  };
}

function sortedById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function exactAppliedAuditBaseline(
  status: CategoryRepairStatusSnapshot,
  action: CategoryRepairStatusAction,
): boolean {
  const expectedAudits = action.keeperAuditBaseline.map((baseline) => {
    const patch = action.repairAddedAuditMetadata.find((candidate) => candidate.auditId === baseline.id);
    return patch ? {
      ...baseline,
      destinationPredefinedBenefitId: patch.after.destinationPredefinedBenefitId,
      destinationDefinitionFingerprint: patch.after.destinationDefinitionFingerprint,
    } : baseline;
  });
  const expectedProvenance = action.keeperProvenanceBaseline;
  return migrationFingerprint(sortedById(status.audits)) === migrationFingerprint(sortedById(expectedAudits))
    && migrationFingerprint(sortedById(status.provenance)) === migrationFingerprint(sortedById(expectedProvenance));
}

function exactAppliedKeeperState(
  status: CategoryRepairStatusSnapshot,
  action: CategoryRepairStatusAction,
): boolean {
  const expected = action.keeperSourceKind === "legacy"
    ? {
      ...action.keeperBaseline,
      creditCardId: action.creditCardId,
      predefinedBenefitId: action.predefinedBenefitId,
    }
    : action.keeperBaseline;
  return migrationFingerprint(currentPreimage(status)) === migrationFingerprint(expected)
    && exactAppliedAuditBaseline(status, action);
}

function allCurrentStatuses(
  unit: CategoryRepairUnitSnapshot,
): Map<string, CategoryRepairStatusSnapshot> | null {
  const statuses = new Map<string, CategoryRepairStatusSnapshot>();
  for (const status of [...unit.source.statuses, ...unit.destinationStatuses]) {
    const existing = statuses.get(status.id);
    if (existing && migrationFingerprint(existing) !== migrationFingerprint(status)) return null;
    statuses.set(status.id, status);
  }
  return statuses;
}

function sourceAttachmentGraphIsExact(unit: CategoryRepairUnitSnapshot): boolean {
  const source = unit.source;
  const sourceStatusIds = new Set(source.statuses.map((status) => status.id));
  const auditIds = new Set(source.audits.map((audit) => audit.id));
  const provenanceIds = new Set(source.provenance.map((row) => row.id));
  if (sourceStatusIds.size !== source.statuses.length
    || auditIds.size !== source.audits.length
    || provenanceIds.size !== source.provenance.length
    || source.statuses.some((status) => status.userId !== unit.card.userId
      || status.benefitId !== source.id)
    || source.audits.some((audit) => audit.attemptUserId !== unit.card.userId
      || (audit.destinationCardId !== null && audit.destinationCardId !== unit.card.id)
      || (audit.destinationBenefitId !== null && audit.destinationBenefitId !== source.id)
      || (audit.destinationStatusId !== null && !sourceStatusIds.has(audit.destinationStatusId)))
    || source.provenance.some((row) => !sourceStatusIds.has(row.benefitStatusId)
      || (row.attemptUserId !== null && row.attemptUserId !== unit.card.userId))) {
    return false;
  }
  const attachedAuditIds = new Set(source.statuses.flatMap((status) => status.audits.map((audit) => audit.id)));
  const attachedProvenanceIds = new Set(source.statuses.flatMap((status) => status.provenance.map((row) => row.id)));
  if (attachedAuditIds.size !== source.audits.length
    || Array.from(attachedAuditIds).some((id) => !auditIds.has(id))
    || attachedProvenanceIds.size !== source.provenance.length
    || Array.from(attachedProvenanceIds).some((id) => !provenanceIds.has(id))) return false;
  return source.statuses.every((status) => {
    const expectedAudits = source.audits.filter((audit) => audit.destinationStatusId === status.id);
    const expectedProvenance = source.provenance.filter((row) => row.benefitStatusId === status.id);
    return sameIds(status.audits.map((audit) => audit.id), expectedAudits.map((audit) => audit.id))
      && status.audits.every((audit) => {
        const relation = expectedAudits.find((candidate) => candidate.id === audit.id);
        return relation !== undefined
          && audit.ownerId === relation.attemptUserId
          && audit.destinationCardId === relation.destinationCardId
          && audit.destinationBenefitId === relation.destinationBenefitId
          && audit.destinationStatusId === relation.destinationStatusId
          && audit.destinationPredefinedBenefitId === relation.destinationPredefinedBenefitId
          && audit.destinationDefinitionFingerprint === relation.destinationDefinitionFingerprint
          && audit.stateFingerprint === relation.stateFingerprint;
      })
      && sameIds(status.provenance.map((row) => row.id), expectedProvenance.map((row) => row.id))
      && status.provenance.every((row) => {
        const relation = expectedProvenance.find((candidate) => candidate.id === row.id);
        return relation !== undefined
          && row.ownerId === relation.attemptUserId;
      });
  });
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

function siblingEvidenceIsAuthorized(
  sibling: CategoryRepairUnitSnapshot,
  authority: CategoryRepairReviewedAuthorityContext,
): boolean {
  const evidence = sibling.repairEvidence;
  if (!evidence || evidence.phase !== "APPLIED"
    || evidence.inventoryFingerprint !== authority.inventoryFingerprint
    || evidence.manifestFingerprint !== authority.manifestFingerprint
    || authority.manifestEntryFingerprints === undefined
    || !authority.manifestEntryFingerprints.includes(evidence.manifestEntryFingerprint)) {
    return false;
  }
  const replay = planGlobalBenefitCategoryRepairUnit(sibling, "apply");
  if (replay.blocked || replay.intent !== "APPLY_REPLAY") return false;
  const statuses = allCurrentStatuses(sibling);
  const keeperIds = new Set(evidence.occurrences.map((action) => action.keeperStatusId));
  if (!statuses || statuses.size !== keeperIds.size
    || Array.from(statuses.keys()).some((id) => !keeperIds.has(id))
    || !sourceAttachmentGraphIsExact(sibling)) return false;
  for (const action of evidence.occurrences) {
    const keeper = findStatus(sibling, action.keeperStatusId);
    if (!keeper || !exactAppliedKeeperState(keeper, action)) return false;
    if (action.removedStatusId !== null && findStatus(sibling, action.removedStatusId) !== null) return false;
  }
  return true;
}

function normalizeSiblingRepairEffects(
  unit: CategoryRepairUnitSnapshot,
  allUnits: readonly CategoryRepairUnitSnapshot[],
  authority: CategoryRepairReviewedAuthorityContext,
): CategoryRepairUnitSnapshot {
  const siblings = allUnits
    .filter((candidate) => candidate.card.id === unit.card.id && candidate.source.id !== unit.source.id)
    .filter((candidate) => candidate.repairEvidence !== null);
  if (siblings.length === 0) return unit;
  if (siblings.some((sibling) => !siblingEvidenceIsAuthorized(sibling, authority))) {
    throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
  }

  const statuses = new Map<string, CategoryRepairStatusSnapshot>();
  const audits = new Map<string, LegacyAuditRelation>();
  const provenance = new Map<string, LegacyProvenanceRelation>();
  for (const candidate of allUnits.filter((entry) => entry.card.id === unit.card.id)) {
    for (const status of candidate.destinationStatuses) {
      const existing = statuses.get(status.id);
      if (existing && migrationFingerprint(existing) !== migrationFingerprint(status)) {
        throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
      }
      statuses.set(status.id, status);
      for (const audit of status.audits) {
        const relation: LegacyAuditRelation = {
          id: audit.id,
          attemptUserId: audit.ownerId ?? "",
          destinationCardId: audit.destinationCardId,
          destinationBenefitId: audit.destinationBenefitId,
          destinationPredefinedBenefitId: audit.destinationPredefinedBenefitId,
          destinationStatusId: audit.destinationStatusId,
          destinationDefinitionFingerprint: audit.destinationDefinitionFingerprint,
          stateFingerprint: audit.stateFingerprint,
        };
        const existingAudit = audits.get(audit.id);
        if (existingAudit && migrationFingerprint(existingAudit) !== migrationFingerprint(relation)) {
          throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
        }
        audits.set(audit.id, relation);
      }
      for (const row of status.provenance) {
        const relation: LegacyProvenanceRelation = {
          id: row.id,
          benefitStatusId: status.id,
          attemptUserId: row.ownerId,
        };
        const existingProvenance = provenance.get(row.id);
        if (existingProvenance && migrationFingerprint(existingProvenance) !== migrationFingerprint(relation)) {
          throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
        }
        provenance.set(row.id, relation);
      }
    }
    for (const source of candidate.cardStrictCustomSources) {
      for (const status of source.statuses) {
        const existing = statuses.get(status.id);
        if (existing && migrationFingerprint(existing) !== migrationFingerprint(status)) {
          throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
        }
        statuses.set(status.id, status);
      }
      for (const audit of source.audits) {
        const existing = audits.get(audit.id);
        if (existing && migrationFingerprint(existing) !== migrationFingerprint(audit)) {
          throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
        }
        audits.set(audit.id, audit);
      }
      for (const row of source.provenance) {
        const existing = provenance.get(row.id);
        if (existing && migrationFingerprint(existing) !== migrationFingerprint(row)) {
          throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
        }
        provenance.set(row.id, row);
      }
    }
  }

  for (const sibling of siblings) {
    const evidence = sibling.repairEvidence!;
    for (const action of evidence.occurrences) {
      const keeper = statuses.get(action.keeperStatusId);
      if (!keeper || !exactAppliedKeeperState(keeper, action)) {
        throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
      }
      statuses.set(action.keeperStatusId, snapshotFromPreimage(
        action.keeperBaseline,
        action.keeperAuditBaseline,
        action.keeperProvenanceBaseline,
      ));
      if (action.removedStatusId !== null && action.removedPreimage !== null) {
        if (statuses.has(action.removedStatusId)) {
          throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
        }
        statuses.set(action.removedStatusId, snapshotFromPreimage(action.removedPreimage));
      }
      for (const patch of action.repairAddedAuditMetadata) {
        const audit = audits.get(patch.auditId);
        if (!audit
          || audit.destinationCardId !== patch.destinationCardId
          || audit.destinationBenefitId !== patch.destinationBenefitId
          || audit.destinationStatusId !== patch.destinationStatusId
          || audit.destinationPredefinedBenefitId !== patch.after.destinationPredefinedBenefitId
          || audit.destinationDefinitionFingerprint !== patch.after.destinationDefinitionFingerprint
          || audit.stateFingerprint !== patch.after.stateFingerprint) {
          throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
        }
        audits.set(patch.auditId, {
          ...audit,
          destinationPredefinedBenefitId: patch.before.destinationPredefinedBenefitId,
          destinationDefinitionFingerprint: patch.before.destinationDefinitionFingerprint,
        });
      }
    }
  }

  const statusSnapshot = (status: CategoryRepairStatusSnapshot): CategoryRepairStatusSnapshot => ({
    ...status,
    audits: status.audits.map((audit) => {
      const relation = audits.get(audit.id);
      if (!relation) throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
      return {
        ...audit,
        ownerId: relation.attemptUserId,
        destinationCardId: relation.destinationCardId,
        destinationBenefitId: relation.destinationBenefitId,
        destinationStatusId: relation.destinationStatusId,
        destinationPredefinedBenefitId: relation.destinationPredefinedBenefitId,
        destinationDefinitionFingerprint: relation.destinationDefinitionFingerprint,
      };
    }),
    provenance: status.provenance.map((attachment) => {
      const relation = provenance.get(attachment.id);
      if (!relation) throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
      return { ...attachment, ownerId: relation.attemptUserId };
    }),
  });

  const rebuiltSources = new Map<string, CategoryRepairLegacyBenefitSnapshot>();
  for (const candidate of allUnits.filter((entry) => entry.card.id === unit.card.id)) {
    for (const source of candidate.cardStrictCustomSources) {
      if (rebuiltSources.has(source.id)) continue;
      const sourceStatuses = sortedById(Array.from(statuses.values()).filter((status) => status.benefitId === source.id))
        .map(statusSnapshot);
      const sourceStatusIds = new Set(sourceStatuses.map((status) => status.id));
      rebuiltSources.set(source.id, {
        ...source,
        statuses: sourceStatuses,
        audits: sortedById(Array.from(audits.values()).filter((audit) =>
          audit.destinationBenefitId === source.id
          || (audit.destinationStatusId !== null && sourceStatusIds.has(audit.destinationStatusId)))),
        provenance: sortedById(Array.from(provenance.values()).filter((row) => sourceStatusIds.has(row.benefitStatusId))),
      });
    }
  }

  const rebuildUnit = (candidate: CategoryRepairUnitSnapshot): CategoryRepairUnitSnapshot => {
    const source = rebuiltSources.get(candidate.source.id);
    if (!source) throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
    const targets = candidate.predefinedCard.benefits
      .filter((definition) => definition.predefinedCardId === candidate.predefinedCard.id)
      .filter((definition) => NON_CATEGORY_FIELDS.every((field) => source[field] === definition[field]));
    const target = targets.length === 1 ? targets[0] : null;
    const destinationStatuses = target === null ? [] : sortedById(Array.from(statuses.values())
      .filter((status) => status.creditCardId === candidate.card.id && status.predefinedBenefitId === target.id))
      .map(statusSnapshot);
    return {
      ...candidate,
      source,
      destinationStatuses,
      cardStrictCustomSources: Array.from(rebuiltSources.values())
        .filter((sourceSnapshot) => sourceSnapshot.creditCardId === candidate.card.id),
    };
  };
  return rebuildUnit(unit);
}

function reviewedGraphStillMatches(
  unit: CategoryRepairUnitSnapshot,
  evidence: CategoryRepairEvidenceSnapshot,
): boolean {
  const reviewedStatuses: CategoryRepairStatusSnapshot[] = [];
  for (const action of evidence.occurrences) {
    reviewedStatuses.push(snapshotFromPreimage(
      action.keeperBaseline,
      action.keeperAuditBaseline,
      action.keeperProvenanceBaseline,
    ));
    if (action.removedPreimage) reviewedStatuses.push(snapshotFromPreimage(action.removedPreimage));
  }
  const statusById = new Map(reviewedStatuses.map((status) => [status.id, status]));
  const baselineAudits = new Map(evidence.occurrences
    .flatMap((action) => action.keeperAuditBaseline)
    .map((audit) => [audit.id, audit]));
  const baselineProvenance = new Map(evidence.occurrences
    .flatMap((action) => action.keeperProvenanceBaseline.map((row) => ({
      ...row,
      benefitStatusId: action.keeperStatusId,
    })))
    .map((row) => [row.id, row]));
  const sourceStatusIds = new Set(reviewedStatuses
    .filter((status) => status.benefitId === unit.source.id)
    .map((status) => status.id));
  const sourceAudits = unit.source.audits.map((audit) => {
    const baseline = baselineAudits.get(audit.id);
    return baseline ? {
      id: baseline.id,
      attemptUserId: baseline.ownerId ?? "",
      destinationCardId: baseline.destinationCardId,
      destinationBenefitId: baseline.destinationBenefitId,
      destinationPredefinedBenefitId: baseline.destinationPredefinedBenefitId,
      destinationStatusId: baseline.destinationStatusId,
      destinationDefinitionFingerprint: baseline.destinationDefinitionFingerprint,
      stateFingerprint: baseline.stateFingerprint,
    } : audit;
  });
  const sourceProvenance = unit.source.provenance.map((row) => {
    const baseline = baselineProvenance.get(row.id);
    return baseline ? {
      id: baseline.id,
      benefitStatusId: baseline.benefitStatusId,
      attemptUserId: baseline.ownerId,
    } : row;
  });
  const source = {
    ...unit.source,
    statuses: reviewedStatuses.filter((status) => status.benefitId === unit.source.id),
    audits: sourceAudits,
    provenance: sourceProvenance,
  };
  // Every status attachment represented in the historical source relation must be
  // covered by one occurrence baseline. A new benefit-only audit remains in the
  // reconstructed graph and therefore changes the reviewed graph fingerprint.
  if (sourceAudits.some((audit) => audit.destinationStatusId !== null
    && sourceStatusIds.has(audit.destinationStatusId)
    && !baselineAudits.has(audit.id))
    || sourceProvenance.some((row) => sourceStatusIds.has(row.benefitStatusId)
      && !baselineProvenance.has(row.id))) return false;
  const reconstructed: CategoryRepairUnitSnapshot = {
    ...unit,
    source,
    destinationStatuses: reviewedStatuses.filter((status) =>
      status.creditCardId === evidence.creditCardId
      && status.predefinedBenefitId === evidence.predefinedBenefitId),
    cardStrictCustomSources: unit.cardStrictCustomSources.map((candidate) =>
      candidate.id === source.id ? source : candidate),
    repairEvidence: null,
  };
  if (statusById.size !== reviewedStatuses.length) return false;
  const reviewed = planGlobalBenefitCategoryRepairUnit(reconstructed, "discover");
  return !reviewed.blocked
    && reviewed.immutableGraphFingerprint === evidence.immutableGraphFingerprint
    && reviewed.currentGraphFingerprint === evidence.reviewedCurrentGraphFingerprint
    && reviewed.destinationFingerprint === evidence.destinationFingerprint
    && reviewed.planFingerprint === evidence.planFingerprint;
}

function mutableKeeperState(status: CategoryRepairStatusSnapshot): object {
  return {
    usedAmount: status.usedAmount,
    isCompleted: status.isCompleted,
    completedAt: status.completedAt?.toISOString() ?? null,
    isNotUsable: status.isNotUsable,
    orderIndex: status.orderIndex,
    updatedAt: status.updatedAt.toISOString(),
  };
}

async function ensureRestoreSlotFree(
  client: QueryClient,
  action: CategoryRepairStatusAction,
  sourceBenefitId: string,
): Promise<void> {
  const preimage = action.removedPreimage;
  if (!preimage || !action.removedStatusId) return;
  const rows = await client.$queryRaw<Array<{ idCount: bigint | number; tupleCount: bigint | number }>>(Prisma.sql`
    SELECT
      (SELECT count(*) FROM "BenefitStatus" WHERE "id" = ${action.removedStatusId})::bigint AS "idCount",
      (SELECT count(*) FROM "BenefitStatus"
        WHERE "userId" = ${preimage.userId}
          AND "cycleStartDate" = ${new Date(preimage.cycleStartDate)}
          AND "occurrenceIndex" = ${preimage.occurrenceIndex}
          AND ${action.removedSourceKind === "legacy"
            ? Prisma.sql`"benefitId" = ${sourceBenefitId}`
            : Prisma.sql`"creditCardId" = ${action.creditCardId} AND "predefinedBenefitId" = ${action.predefinedBenefitId}`}
          AND ${action.kind === "PROMOTE_LEGACY_STATUS"
            // The promoted keeper temporarily occupies the canonical tuple. It is
            // cleared by CAS before the removed canonical row is restored in this
            // same serializable transaction; only another occupant blocks rollback.
            ? Prisma.sql`"id" <> ${action.keeperStatusId}`
            : Prisma.sql`TRUE`}
      )::bigint AS "tupleCount"
  `);
  if (Number(rows[0]?.idCount ?? 1) !== 0 || Number(rows[0]?.tupleCount ?? 1) !== 0) {
    throw new GlobalBenefitCategoryRepairError("A rollback restore identity is occupied.");
  }
}

async function reverseAuditPatch(client: QueryClient, patch: CategoryRepairAuditPatch): Promise<void> {
  if (patch.before.destinationPredefinedBenefitId === patch.after.destinationPredefinedBenefitId
    && patch.before.destinationDefinitionFingerprint === patch.after.destinationDefinitionFingerprint) return;
  const changed = await client.$executeRaw(Prisma.sql`
    UPDATE "AmexSyncRowAudit"
    SET "destinationPredefinedBenefitId" = ${patch.before.destinationPredefinedBenefitId},
      "destinationDefinitionFingerprint" = ${patch.before.destinationDefinitionFingerprint}
    WHERE "id" = ${patch.auditId}
      AND "destinationCardId" IS NOT DISTINCT FROM ${patch.destinationCardId}
      AND "destinationBenefitId" IS NOT DISTINCT FROM ${patch.destinationBenefitId}
      AND "destinationStatusId" = ${patch.destinationStatusId}
      AND "destinationPredefinedBenefitId" IS NOT DISTINCT FROM ${patch.after.destinationPredefinedBenefitId}
      AND "destinationDefinitionFingerprint" IS NOT DISTINCT FROM ${patch.after.destinationDefinitionFingerprint}
  `);
  if (changed !== 1) throw new GlobalBenefitCategoryRepairError("A rollback audit compare-and-set failed.");
}

async function clearPromotedKeeper(
  client: QueryClient,
  action: CategoryRepairStatusAction,
  current: CategoryRepairStatusSnapshot,
): Promise<void> {
  if (action.kind !== "PROMOTE_LEGACY_STATUS") return;
  const snapshot = currentPreimage(current);
  const changed = await client.$executeRaw(Prisma.sql`
    UPDATE "BenefitStatus"
    SET "creditCardId" = NULL, "predefinedBenefitId" = NULL
    WHERE ${statusCasPredicates(snapshot)}
      AND "benefitId" = ${action.keeperBaseline.benefitId}
      AND "creditCardId" = ${action.creditCardId}
      AND "predefinedBenefitId" = ${action.predefinedBenefitId}
  `);
  if (changed !== 1) throw new GlobalBenefitCategoryRepairError("A rollback keeper compare-and-set failed.");
}

async function restoreRemovedStatus(
  client: QueryClient,
  action: CategoryRepairStatusAction,
  sourceBenefitId: string,
  reboundPredefinedBenefitId: string,
): Promise<void> {
  const preimage = action.removedPreimage;
  if (!preimage || !action.removedStatusId) return;
  const benefitId = action.removedSourceKind === "legacy" ? sourceBenefitId : null;
  const creditCardId = action.removedSourceKind === "canonical" ? action.creditCardId : null;
  const predefinedBenefitId = action.removedSourceKind === "canonical" ? reboundPredefinedBenefitId : null;
  const inserted = await client.$executeRaw(Prisma.sql`
    INSERT INTO "BenefitStatus" (
      "id", "benefitId", "creditCardId", "predefinedBenefitId", "userId",
      "cycleStartDate", "cycleEndDate", "occurrenceIndex", "usedAmount", "isCompleted",
      "completedAt", "isNotUsable", "orderIndex", "createdAt", "updatedAt"
    ) VALUES (
      ${preimage.id}, ${benefitId}, ${creditCardId}, ${predefinedBenefitId}, ${preimage.userId},
      ${new Date(preimage.cycleStartDate)}, ${new Date(preimage.cycleEndDate)},
      ${preimage.occurrenceIndex}, ${preimage.usedAmount}, ${preimage.isCompleted},
      ${preimage.completedAt === null ? null : new Date(preimage.completedAt)},
      ${preimage.isNotUsable}, ${preimage.orderIndex}, ${new Date(preimage.createdAt)},
      ${new Date(preimage.updatedAt)}
    )
  `);
  if (inserted !== 1) throw new GlobalBenefitCategoryRepairError("A rollback status restore failed.");
}

function verifyRollback(
  unit: CategoryRepairUnitSnapshot,
  beforeMutable: ReadonlyMap<string, string>,
): void {
  if (unit.source.ledger?.classification !== "CUSTOM" || unit.source.ledger.phase !== "CLASSIFIED"
    || unit.repairEvidence?.phase !== "ROLLED_BACK") {
    throw new GlobalBenefitCategoryRepairError("Post-rollback historical evidence verification failed.");
  }
  for (const action of unit.repairEvidence.occurrences) {
    const keeper = findStatus(unit, action.keeperStatusId);
    if (!keeper || migrationFingerprint(mutableKeeperState(keeper)) !== beforeMutable.get(action.keeperStatusId)) {
      throw new GlobalBenefitCategoryRepairError("Post-rollback mutable keeper preservation failed.");
    }
    if (action.kind === "PROMOTE_LEGACY_STATUS"
      && (keeper.creditCardId !== null || keeper.predefinedBenefitId !== null)) {
      throw new GlobalBenefitCategoryRepairError("Post-rollback keeper relation verification failed.");
    }
    if (action.removedStatusId !== null && findStatus(unit, action.removedStatusId) === null) {
      throw new GlobalBenefitCategoryRepairError("Post-rollback restored status verification failed.");
    }
  }
  const replay = planGlobalBenefitCategoryRepairUnit(unit, "rollback");
  if (replay.blocked || replay.intent !== "ROLLBACK_REPLAY") {
    throw new GlobalBenefitCategoryRepairError(
      `Post-rollback relation postimage verification failed (${replay.intent}:${replay.stopReasons.join(",")}).`,
    );
  }
}

export class PrismaGlobalBenefitCategoryRepairDatabase
implements GlobalBenefitCategoryRepairDatabase {
  constructor(private readonly client: PrismaClient) {}

  async readParitySnapshot(input: {
    targetVerified?: boolean;
    manifests: readonly GlobalBenefitCategoryRepairManifest[];
    scope: CategoryRepairParityScope | null;
    manifestScope?: CategoryRepairParityManifestScope | null;
  }): Promise<{
    snapshot: CategoryRepairBatchSnapshot;
    aggregate: CategoryRepairParityAggregateState;
  }> {
    if (input.targetVerified !== true) {
      throw new GlobalBenefitCategoryRepairError("Category-repair parity requires target verification.");
    }
    if (input.manifestScope !== undefined && input.manifestScope !== null) {
      const page = input.manifests[input.manifestScope.pageIndex];
      if (!page
        || page.pageFingerprint !== input.manifestScope.pageFingerprint
        || page.manifestFingerprint !== input.manifestScope.manifestFingerprint) {
        throw new GlobalBenefitCategoryRepairError("The private parity page selector is outside the manifest bundle.");
      }
    }
    try {
      const readSnapshot = async (client: QueryClient): Promise<{
        snapshot: CategoryRepairBatchSnapshot;
        aggregate: CategoryRepairParityAggregateState;
      }> => {
        const completeKeys = await client.$queryRaw<PrivateKeyRow[]>(Prisma.sql`
        SELECT ('repair:' || l."legacyBenefitId")::text AS "privateKey"
        FROM "CatalogMigrationLedger" l
        JOIN "Benefit" b ON b."id" = l."legacyBenefitId"
        JOIN "CreditCard" c ON c."id" = b."creditCardId"
        WHERE l."classification" = 'CUSTOM' AND l."phase" = 'CLASSIFIED'
          AND c."predefinedCardId" IS NOT NULL
        ORDER BY "privateKey" ASC
      `);
        const keys = input.manifestScope === undefined || input.manifestScope === null
          ? completeKeys
          : selectManifestPageKeys(completeKeys, input.manifests[input.manifestScope.pageIndex]);
        const sourceIds = keys.map((row) => row.privateKey.slice("repair:".length));
        const graph = await readGraphBySourceIds(client, sourceIds);
        const manifestKeys = (input.manifestScope === undefined || input.manifestScope === null
          ? input.manifests
          : [input.manifests[input.manifestScope.pageIndex]])
          .flatMap((manifest) => manifest.entries.map((entry) => entry.privateKey));
        const graphKeys = new Set(graph.units.map((unit) => unit.privateKey));
        if (manifestKeys.some((key) => !graphKeys.has(key))) {
          throw new GlobalBenefitCategoryRepairError("The private parity manifest is not covered by the current inventory.");
        }
        const inventoryFingerprint = await readInventoryFingerprint(client);
        const aggregate = await readCategoryRepairParityAggregate(
          client,
          input.scope ?? parityScopeFromUnits(
            graph.units,
            input.manifestScope === undefined || input.manifestScope === null,
          ),
        );
        return {
          // Keep the selected page in `units`, but retain the complete
          // same-card source graph privately so parity can reverse exact
          // APPLIED sibling effects when a card spans multiple pages.
          snapshot: {
            units: graph.units,
            allUnits: graph.allUnits,
            hasMore: false,
            inventoryFingerprint,
          },
          aggregate,
        };
      };
      return await this.client.$transaction(
        (transaction) => readSnapshot(transaction as unknown as QueryClient),
        {
          maxWait: GLOBAL_BENEFIT_CATEGORY_REPAIR_PARITY_TRANSACTION_MAX_WAIT_MS,
          timeout: GLOBAL_BENEFIT_CATEGORY_REPAIR_PARITY_TRANSACTION_TIMEOUT_MS,
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        },
      );
    } catch (error) {
      throw sanitizedParity(error);
    }
  }

  async readBatch(input: {
    mode: GlobalBenefitCategoryRepairMode;
    afterCursorDigest: string | null;
    limit: number;
  }): Promise<CategoryRepairBatchSnapshot> {
    try {
      const [page, inventoryFingerprint] = await Promise.all([
        readPageKeys(this.client, input.afterCursorDigest, input.limit),
        readInventoryFingerprint(this.client),
      ]);
      const graph = await readGraphBySourceIds(this.client, page.sourceIds);
      return { units: graph.units, allUnits: graph.allUnits, hasMore: page.hasMore, inventoryFingerprint };
    } catch (error) {
      throw sanitized(error);
    }
  }

  async applyRepair(
    proposal: CategoryRepairProposal,
    manifestEntry: CategoryRepairManifestEntry,
    authority: CategoryRepairReviewedAuthorityContext,
  ): Promise<CategoryRepairWriteResult> {
    validateWriterAuthority({ expectedMode: "apply", proposal, entry: manifestEntry, authority });
    try {
      return await this.client.$transaction(async (transaction) => {
        const tx = transaction as unknown as TransactionClient;
        const graph = await readOneUnit(tx, proposal.privateKey);
        const unit = normalizeSiblingRepairEffects(graph.units[0], graph.allUnits, authority);
        const current = planGlobalBenefitCategoryRepairUnit(unit, "apply");
        if (!proposalsExactlyEqual(current, proposal)) {
          throw new GlobalBenefitCategoryRepairError("The repair graph changed; review a new page.");
        }
        if (current.intent === "APPLY_REPLAY") return { ...emptyResult(), idempotent: 1 };
        const inventoryFingerprint = await readInventoryFingerprint(tx);
        if (inventoryFingerprint !== authority.inventoryFingerprint) {
          throw new GlobalBenefitCategoryRepairError("The complete repair inventory changed before apply.");
        }
        const existing = unit.repairEvidence;
        if (existing && existing.phase !== "ROLLED_BACK") {
          throw new GlobalBenefitCategoryRepairError("Mixed repair evidence cannot be applied.");
        }
        const repairId = existing?.repairId ?? randomUUID();
        const ledgerId = graph.ledgerIds.get(proposal.sourceBenefitId);
        if (!ledgerId || !proposal.targetBenefitCatalogKey) {
          throw new GlobalBenefitCategoryRepairError("The repair source lost its exact historical authority.");
        }
        await insertParentEvidence(tx, {
          repairId,
          ledgerId,
          proposal,
          entry: manifestEntry,
          authority,
          existingPhase: existing ? "ROLLED_BACK" : "none",
        });
        for (const action of proposal.actions) {
          await upsertOccurrenceEvidence(tx, repairId, proposal.targetBenefitCatalogKey, action);
        }
        await removeObsoleteOccurrenceEvidence(tx, repairId, proposal.actions);
        for (const action of proposal.actions) {
          await deleteLoser(tx, action);
          await promoteKeeper(tx, action);
          for (const patch of action.repairAddedAuditMetadata) await applyAuditPatch(tx, patch);
        }
        const after = await readOneUnit(tx, proposal.privateKey);
        verifyImmediateApply(after.units[0], proposal, repairId);
        return { ...emptyResult(), applied: 1 };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      throw sanitized(error);
    }
  }

  async rollbackRepair(
    proposal: CategoryRepairProposal,
    manifestEntry: CategoryRepairManifestEntry,
    authority: CategoryRepairReviewedAuthorityContext,
  ): Promise<CategoryRepairWriteResult> {
    validateWriterAuthority({ expectedMode: "rollback", proposal, entry: manifestEntry, authority });
    try {
      return await this.client.$transaction(async (transaction) => {
        const tx = transaction as unknown as TransactionClient;
        const graph = await readOneUnit(tx, proposal.privateKey);
        const unit = graph.units[0];
        const current = planGlobalBenefitCategoryRepairUnit(unit, "rollback");
        if (!proposalsExactlyEqual(current, proposal)) {
          throw new GlobalBenefitCategoryRepairError("The applied repair graph changed before rollback.");
        }
        if (current.intent === "ROLLBACK_REPLAY") return { ...emptyResult(), idempotent: 1 };
        const evidence = unit.repairEvidence;
        if (!evidence || evidence.phase !== "APPLIED"
          || evidence.manifestFingerprint !== authority.manifestFingerprint
          || evidence.inventoryFingerprint !== authority.inventoryFingerprint
          || evidence.manifestEntryFingerprint !== manifestEntry.entryFingerprint) {
          throw new GlobalBenefitCategoryRepairError("Rollback lacks exact original evidence authority.");
        }
        if (!reviewedGraphStillMatches(unit, evidence)) {
          throw new GlobalBenefitCategoryRepairError(
            "Rollback source, attachment, or reviewed graph evidence changed.",
          );
        }
        const definition = unit.predefinedCard.benefits.filter((candidate) =>
          candidate.catalogKey === evidence.targetBenefitCatalogKey
          && candidate.predefinedCardId === unit.predefinedCard.id);
        if (definition.length !== 1 || definition[0].id !== evidence.predefinedBenefitId) {
          throw new GlobalBenefitCategoryRepairError("Rollback catalog-key rebinding failed.");
        }
        const beforeMutable = new Map<string, string>();
        for (const action of evidence.occurrences) {
          const keeper = findStatus(unit, action.keeperStatusId);
          if (!keeper) throw new GlobalBenefitCategoryRepairError("Rollback keeper evidence is missing.");
          beforeMutable.set(action.keeperStatusId, migrationFingerprint(mutableKeeperState(keeper)));
          await ensureRestoreSlotFree(tx, action, evidence.sourceBenefitId);
        }
        for (const action of evidence.occurrences) {
          const keeper = findStatus(unit, action.keeperStatusId)!;
          for (const patch of action.repairAddedAuditMetadata) await reverseAuditPatch(tx, patch);
          await clearPromotedKeeper(tx, action, keeper);
          await restoreRemovedStatus(tx, action, evidence.sourceBenefitId, definition[0].id);
        }
        const parent = await tx.$executeRaw(Prisma.sql`
          UPDATE "GlobalBenefitCategoryRepair"
          SET "phase" = 'ROLLED_BACK', "rolledBackAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${evidence.repairId} AND "phase" = 'APPLIED'
            AND "legacyBenefitId" = ${evidence.sourceBenefitId}
            AND "catalogMigrationLedgerId" = ${graph.ledgerIds.get(evidence.sourceBenefitId)}
            AND "inventoryFingerprint" = ${evidence.inventoryFingerprint}
            AND "manifestFingerprint" = ${evidence.manifestFingerprint}
            AND "manifestEntryFingerprint" = ${evidence.manifestEntryFingerprint}
            AND "planFingerprint" = ${evidence.planFingerprint}
            AND "postimageFingerprint" = ${evidence.postimageFingerprint}
        `);
        if (parent !== 1) throw new GlobalBenefitCategoryRepairError("Rollback parent compare-and-set failed.");
        const after = await readOneUnit(tx, proposal.privateKey);
        verifyRollback(after.units[0], beforeMutable);
        return { ...emptyResult(), rolledBack: 1 };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      throw sanitized(error);
    }
  }
}

export function createPrismaGlobalBenefitCategoryRepairDatabase(
  client: unknown,
): GlobalBenefitCategoryRepairDatabase {
  return new PrismaGlobalBenefitCategoryRepairDatabase(client as PrismaClient);
}
