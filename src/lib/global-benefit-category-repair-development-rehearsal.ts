import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@/generated/prisma";
import {
  AMEX_CATALOG_IDENTITY_REGISTRY,
  type AmexCatalogBenefitIdentity,
} from "@/lib/amex-sync/catalog-registry";
import {
  resolveAmexGlobalDefinitionAuthority,
  type DestinationPredefinedBenefitSnapshot,
  type DestinationPredefinedCardSnapshot,
} from "@/lib/amex-sync/authority";
import { resolveAmexSyncConfiguration } from "@/lib/amex-sync/mode";
import { PrismaUserCloneDestination } from "@/lib/amex-sync/prisma-single-user-clone";
import type { InternalDatabaseIdentity } from "@/lib/amex-sync/single-user-clone";
import { loadAmexSyncDestinationContext } from "@/lib/amex-sync/repository";
import { fetchEffectiveBenefitStatuses } from "@/lib/effective-benefit";
import {
  GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION,
  GLOBAL_BENEFIT_CATEGORY_REPAIR_ROLLBACK_CONFIRMATION,
  runGlobalBenefitCategoryRepairOperator,
  type CategoryRepairBatchSnapshot,
  type GlobalBenefitCategoryRepairDatabase,
  type GlobalBenefitCategoryRepairManifest,
  type GlobalBenefitCategoryRepairReport,
} from "@/lib/global-benefit-category-repair";
import { legacyBenefitSourceFingerprint } from "@/lib/global-benefit-migration";
import { createPrismaGlobalBenefitCategoryRepairDatabase } from "@/lib/prisma-global-benefit-category-repair";

export const GLOBAL_BENEFIT_CATEGORY_REPAIR_DEVELOPMENT_REHEARSAL_CONFIRMATION =
  "REHEARSE_CATEGORY_DRIFT_REPAIR_ON_VERIFIED_DEVELOPMENT" as const;

const TARGET_FINGERPRINT = /^[a-f0-9]{16}$/;
const GENERIC_REHEARSAL_ERROR = "The development category-repair rehearsal failed safely.";
const FIXTURE_LIMIT = 1;
const PLACEHOLDER_FINGERPRINT = "0".repeat(64);
const CYCLE_START = new Date("2040-01-01T00:00:00.000Z");
const CYCLE_END = new Date("2040-01-31T23:59:59.999Z");
const COMPLETED_AT = new Date("2040-01-15T12:00:00.000Z");

export interface GlobalBenefitCategoryRepairDevelopmentRehearsalInput {
  databaseUrlDev: string | undefined;
  expectedDevelopmentHost: string | undefined;
  expectedDevelopmentIdentityFingerprint: string | undefined;
  expectedDevelopmentBranchFingerprint: string | undefined;
  forbiddenProductionHost: string | undefined;
  forbiddenProductionBranchFingerprint: string | undefined;
  rawAmexSyncMode: string | undefined;
  confirmation: string | undefined;
  recoveryPointVerified: boolean;
}

export interface ValidatedDevelopmentRehearsalTarget {
  databaseUrlDev: string;
  expectedDevelopmentHost: string;
  expectedDevelopmentIdentityFingerprint: string;
  expectedDevelopmentBranchFingerprint: string;
  forbiddenProductionHost: string;
  forbiddenProductionBranchFingerprint: string;
}

export interface DevelopmentRehearsalCounts {
  definitionsExamined: number;
  statusActions: number;
  applied: number;
  idempotent: number;
  rolledBack: number;
  effectiveStatuses: number;
  restoredStatuses: number;
}

/** This is the complete stdout allowlist. It intentionally has no string fields. */
export interface GlobalBenefitCategoryRepairDevelopmentRehearsalReport {
  completed: boolean;
  targetValidated: boolean;
  prerequisitesPassed: boolean;
  deterministicReviewPassed: boolean;
  applyPassed: boolean;
  replayPassed: boolean;
  runtimeAuthorityPassed: boolean;
  keeperMutationPassed: boolean;
  rollbackPassed: boolean;
  rollbackStatePreserved: boolean;
  reapplyPassed: boolean;
  graphDriftBlocked: boolean;
  provenanceRemoved: boolean;
  finalRollbackPassed: boolean;
  finalStateMatched: boolean;
  cleanupComplete: boolean;
  counts: DevelopmentRehearsalCounts;
}

interface SelectedAmexDefinition {
  product: DestinationPredefinedCardSnapshot;
  benefit: DestinationPredefinedBenefitSnapshot;
  sourceIdentity: AmexCatalogBenefitIdentity;
}

interface DevelopmentRehearsalFixture {
  userId: string;
  email: string;
  cardId: string;
  legacyBenefitId: string;
  ledgerId: string;
  keeperStatusId: string;
  loserStatusId: string;
  provenanceId: string;
  predefinedCardId: string;
  predefinedBenefitId: string;
}

interface MutableKeeperState {
  usedAmount: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  isNotUsable: boolean;
  orderIndex: number | null;
  cycleStartDate: string;
  cycleEndDate: string;
  occurrenceIndex: number;
}

interface RehearsalClientHandle {
  client: PrismaClient;
  disconnect(): Promise<void>;
}

export interface GlobalBenefitCategoryRepairDevelopmentRehearsalDependencies {
  createClient(databaseUrlDev: string): RehearsalClientHandle;
  identify(client: PrismaClient, databaseUrlDev: string): Promise<InternalDatabaseIdentity>;
  createRepairDatabase(client: PrismaClient): GlobalBenefitCategoryRepairDatabase;
  ensureRepairSchema(client: PrismaClient): Promise<void>;
  selectDefinition(client: PrismaClient): Promise<SelectedAmexDefinition>;
  createFixture(
    client: PrismaClient,
    database: GlobalBenefitCategoryRepairDatabase,
    selection: SelectedAmexDefinition,
    beforeBootstrapWrite: () => Promise<void>,
  ): Promise<DevelopmentRehearsalFixture>;
  runOperator: typeof runGlobalBenefitCategoryRepairOperator;
  verifyAppliedRuntime(
    client: PrismaClient,
    fixture: DevelopmentRehearsalFixture,
    selection: SelectedAmexDefinition,
  ): Promise<number>;
  mutateKeeper(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<MutableKeeperState>;
  readKeeperState(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<MutableKeeperState>;
  captureRolledBackGraph(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<unknown>;
  countFixtureStatuses(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<number>;
  insertProvenance(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<void>;
  removeProvenance(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<void>;
  countProvenance(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<number>;
  repairPhase(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<"APPLIED" | "ROLLED_BACK" | null>;
  cleanup(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<boolean>;
}

export class GlobalBenefitCategoryRepairDevelopmentRehearsalError extends Error {
  readonly safeReport?: GlobalBenefitCategoryRepairDevelopmentRehearsalReport;

  constructor(report?: GlobalBenefitCategoryRepairDevelopmentRehearsalReport) {
    super(GENERIC_REHEARSAL_ERROR);
    this.name = "GlobalBenefitCategoryRepairDevelopmentRehearsalError";
    this.safeReport = report;
  }
}

function normalizeHost(value: string | undefined): string {
  if (!value || value !== value.trim()) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  const host = value.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host) || host.includes("..") || host.startsWith(".") || host.endsWith(".")) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
  return host;
}

/** Pure validation. It must run before a Prisma client is constructed. */
export function validateGlobalBenefitCategoryRepairDevelopmentRehearsalInput(
  input: GlobalBenefitCategoryRepairDevelopmentRehearsalInput,
): ValidatedDevelopmentRehearsalTarget {
  if (input.confirmation !== GLOBAL_BENEFIT_CATEGORY_REPAIR_DEVELOPMENT_REHEARSAL_CONFIRMATION
    || input.recoveryPointVerified !== true
    || input.rawAmexSyncMode !== "off"
    || resolveAmexSyncConfiguration({ AMEX_SYNC_MODE: input.rawAmexSyncMode }).mode !== "off"
    || !input.databaseUrlDev) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }

  let parsed: URL;
  try {
    parsed = new URL(input.databaseUrlDev);
  } catch {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
  if ((parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") || !parsed.hostname) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }

  const expectedDevelopmentHost = normalizeHost(input.expectedDevelopmentHost);
  const forbiddenProductionHost = normalizeHost(input.forbiddenProductionHost);
  const expectedDevelopmentIdentityFingerprint = input.expectedDevelopmentIdentityFingerprint;
  const expectedDevelopmentBranchFingerprint = input.expectedDevelopmentBranchFingerprint;
  const forbiddenProductionBranchFingerprint = input.forbiddenProductionBranchFingerprint;
  if (!expectedDevelopmentIdentityFingerprint
    || !expectedDevelopmentBranchFingerprint
    || !forbiddenProductionBranchFingerprint
    || !TARGET_FINGERPRINT.test(expectedDevelopmentIdentityFingerprint)
    || !TARGET_FINGERPRINT.test(expectedDevelopmentBranchFingerprint)
    || !TARGET_FINGERPRINT.test(forbiddenProductionBranchFingerprint)
    || expectedDevelopmentHost === forbiddenProductionHost
    || expectedDevelopmentBranchFingerprint === forbiddenProductionBranchFingerprint
    || parsed.hostname.toLowerCase() !== expectedDevelopmentHost
    || parsed.hostname.toLowerCase() === forbiddenProductionHost) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }

  return {
    databaseUrlDev: input.databaseUrlDev,
    expectedDevelopmentHost,
    expectedDevelopmentIdentityFingerprint,
    expectedDevelopmentBranchFingerprint,
    forbiddenProductionHost,
    forbiddenProductionBranchFingerprint,
  };
}

function emptyReport(): GlobalBenefitCategoryRepairDevelopmentRehearsalReport {
  return {
    completed: false,
    targetValidated: false,
    prerequisitesPassed: false,
    deterministicReviewPassed: false,
    applyPassed: false,
    replayPassed: false,
    runtimeAuthorityPassed: false,
    keeperMutationPassed: false,
    rollbackPassed: false,
    rollbackStatePreserved: false,
    reapplyPassed: false,
    graphDriftBlocked: false,
    provenanceRemoved: false,
    finalRollbackPassed: false,
    finalStateMatched: false,
    cleanupComplete: false,
    counts: {
      definitionsExamined: 0,
      statusActions: 0,
      applied: 0,
      idempotent: 0,
      rolledBack: 0,
      effectiveStatuses: 0,
      restoredStatuses: 0,
    },
  };
}

function exactPrivateValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactKeeperState(left: MutableKeeperState, right: MutableKeeperState): boolean {
  return exactPrivateValue(left, right);
}

function captureManifest(): {
  sink: (manifest: GlobalBenefitCategoryRepairManifest) => Promise<void>;
  value: () => GlobalBenefitCategoryRepairManifest;
} {
  let manifest: GlobalBenefitCategoryRepairManifest | null = null;
  return {
    sink: async (value) => {
      if (manifest !== null) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
      manifest = value;
    },
    value: () => {
      if (manifest === null) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
      return manifest;
    },
  };
}

function operatorCounts(report: GlobalBenefitCategoryRepairReport): DevelopmentRehearsalCounts {
  return {
    definitionsExamined: report.counts.definitionsExamined,
    statusActions: report.counts.statusActions,
    applied: report.counts.applied,
    idempotent: report.counts.idempotent,
    rolledBack: report.counts.rolledBack,
    effectiveStatuses: 0,
    restoredStatuses: 0,
  };
}

function applyInput(
  database: GlobalBenefitCategoryRepairDatabase,
  manifest: GlobalBenefitCategoryRepairManifest,
) {
  return {
    mode: "apply" as const,
    limit: FIXTURE_LIMIT,
    targetVerified: true,
    recoveryPointVerified: true,
    amexOffVerified: true,
    confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION,
    expectedInventoryFingerprint: manifest.inventoryFingerprint,
    expectedManifestFingerprint: manifest.manifestFingerprint,
    expectedPageFingerprint: manifest.pageFingerprint,
    manifest,
    database,
  };
}

function rollbackInput(
  database: GlobalBenefitCategoryRepairDatabase,
  manifest: GlobalBenefitCategoryRepairManifest,
  pageFingerprint: string,
) {
  return {
    mode: "rollback" as const,
    limit: FIXTURE_LIMIT,
    targetVerified: true,
    recoveryPointVerified: true,
    amexOffVerified: true,
    confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_ROLLBACK_CONFIRMATION,
    expectedInventoryFingerprint: manifest.inventoryFingerprint,
    expectedManifestFingerprint: manifest.manifestFingerprint,
    expectedPageFingerprint: pageFingerprint,
    manifest,
    database,
  };
}

async function discoverTwice(input: {
  database: GlobalBenefitCategoryRepairDatabase;
  runOperator: typeof runGlobalBenefitCategoryRepairOperator;
}): Promise<{ manifest: GlobalBenefitCategoryRepairManifest; report: GlobalBenefitCategoryRepairReport }> {
  const firstCapture = captureManifest();
  const secondCapture = captureManifest();
  const first = await input.runOperator({
    mode: "discover",
    limit: FIXTURE_LIMIT,
    targetVerified: true,
    database: input.database,
    onDiscoveryManifest: firstCapture.sink,
  });
  const second = await input.runOperator({
    mode: "discover",
    limit: FIXTURE_LIMIT,
    targetVerified: true,
    database: input.database,
    onDiscoveryManifest: secondCapture.sink,
  });
  const firstManifest = firstCapture.value();
  if (!exactPrivateValue(first, second)
    || !exactPrivateValue(firstManifest, secondCapture.value())
    || first.counts.definitionsExamined !== 1
    || first.counts.proposed !== 1
    || first.counts.blocked !== 0
    || firstManifest.entries.length !== 1) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
  const firstDryRun = await input.runOperator({
    mode: "dry-run",
    limit: FIXTURE_LIMIT,
    targetVerified: true,
    manifest: firstManifest,
    database: input.database,
  });
  const secondDryRun = await input.runOperator({
    mode: "dry-run",
    limit: FIXTURE_LIMIT,
    targetVerified: true,
    manifest: firstManifest,
    database: input.database,
  });
  if (!exactPrivateValue(firstDryRun, secondDryRun)
    || firstDryRun.counts.proposed !== 1
    || firstDryRun.counts.blocked !== 0) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
  return { manifest: firstManifest, report: first };
}

async function verifyTarget(
  dependencies: GlobalBenefitCategoryRepairDevelopmentRehearsalDependencies,
  client: PrismaClient,
  target: ValidatedDevelopmentRehearsalTarget,
): Promise<void> {
  const identity = await dependencies.identify(client, target.databaseUrlDev);
  if (identity.host.toLowerCase() !== target.expectedDevelopmentHost
    || identity.host.toLowerCase() === target.forbiddenProductionHost
    || identity.fingerprint !== target.expectedDevelopmentIdentityFingerprint
    || identity.branchIdFingerprint !== target.expectedDevelopmentBranchFingerprint
    || identity.branchIdFingerprint === target.forbiddenProductionBranchFingerprint
    || !identity.database
    || !identity.schema
    || !TARGET_FINGERPRINT.test(identity.fingerprint)) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
}

async function rollbackPreview(input: {
  database: GlobalBenefitCategoryRepairDatabase;
  manifest: GlobalBenefitCategoryRepairManifest;
  runOperator: typeof runGlobalBenefitCategoryRepairOperator;
}): Promise<GlobalBenefitCategoryRepairReport> {
  return input.runOperator({
    mode: "rollback-preview",
    limit: FIXTURE_LIMIT,
    targetVerified: true,
    manifest: input.manifest,
    database: input.database,
  });
}

async function safeRecovery(input: {
  dependencies: GlobalBenefitCategoryRepairDevelopmentRehearsalDependencies;
  client: PrismaClient;
  target: ValidatedDevelopmentRehearsalTarget;
  database: GlobalBenefitCategoryRepairDatabase;
  fixture: DevelopmentRehearsalFixture;
  manifest: GlobalBenefitCategoryRepairManifest | null;
}): Promise<boolean> {
  try {
    await verifyTarget(input.dependencies, input.client, input.target);
    const phase = await input.dependencies.repairPhase(input.client, input.fixture);
    if (phase === "APPLIED") {
      if (!input.manifest) return false;
      const preview = await rollbackPreview({
        database: input.database,
        manifest: input.manifest,
        runOperator: input.dependencies.runOperator,
      });
      if (preview.counts.proposed !== 1 || preview.counts.blocked !== 0) return false;
      await verifyTarget(input.dependencies, input.client, input.target);
      const rolledBack = await input.dependencies.runOperator(
        rollbackInput(input.database, input.manifest, preview.pageFingerprint),
      );
      if (rolledBack.counts.rolledBack !== 1 && rolledBack.counts.idempotent !== 1) return false;
    }
    if (await input.dependencies.repairPhase(input.client, input.fixture) === "APPLIED") return false;
    await verifyTarget(input.dependencies, input.client, input.target);
    return input.dependencies.cleanup(input.client, input.fixture);
  } catch {
    return false;
  }
}

export async function runGlobalBenefitCategoryRepairDevelopmentRehearsal(
  input: GlobalBenefitCategoryRepairDevelopmentRehearsalInput,
  dependencies: GlobalBenefitCategoryRepairDevelopmentRehearsalDependencies =
    defaultGlobalBenefitCategoryRepairDevelopmentRehearsalDependencies,
): Promise<GlobalBenefitCategoryRepairDevelopmentRehearsalReport> {
  // No client or database object exists before all process-supplied values pass.
  const target = validateGlobalBenefitCategoryRepairDevelopmentRehearsalInput(input);
  const report = emptyReport();
  report.targetValidated = true;

  let handle: RehearsalClientHandle | null = null;
  let fixture: DevelopmentRehearsalFixture | null = null;
  let database: GlobalBenefitCategoryRepairDatabase | null = null;
  let activeManifest: GlobalBenefitCategoryRepairManifest | null = null;
  try {
    handle = dependencies.createClient(target.databaseUrlDev);
    await verifyTarget(dependencies, handle.client, target);
    database = dependencies.createRepairDatabase(handle.client);
    await dependencies.ensureRepairSchema(handle.client);
    const selection = await dependencies.selectDefinition(handle.client);
    report.prerequisitesPassed = true;

    await verifyTarget(dependencies, handle.client, target);
    fixture = await dependencies.createFixture(
      handle.client,
      database,
      selection,
      () => verifyTarget(dependencies, handle!.client, target),
    );

    const initialReview = await discoverTwice({ database, runOperator: dependencies.runOperator });
    activeManifest = initialReview.manifest;
    report.deterministicReviewPassed = true;
    report.counts = operatorCounts(initialReview.report);

    await verifyTarget(dependencies, handle.client, target);
    const applied = await dependencies.runOperator(applyInput(database, activeManifest));
    if (applied.counts.applied !== 1 || applied.counts.blocked !== 0) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.applyPassed = true;
    report.counts.applied += applied.counts.applied;

    await verifyTarget(dependencies, handle.client, target);
    const replay = await dependencies.runOperator(applyInput(database, activeManifest));
    if (replay.counts.idempotent !== 1 || replay.counts.applied !== 0) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.replayPassed = true;
    report.counts.idempotent += replay.counts.idempotent;

    report.counts.effectiveStatuses = await dependencies.verifyAppliedRuntime(
      handle.client,
      fixture,
      selection,
    );
    if (report.counts.effectiveStatuses !== 1) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.runtimeAuthorityPassed = true;

    await verifyTarget(dependencies, handle.client, target);
    const keeperState = await dependencies.mutateKeeper(handle.client, fixture);
    report.keeperMutationPassed = true;

    const firstRollbackPreview = await rollbackPreview({
      database,
      manifest: activeManifest,
      runOperator: dependencies.runOperator,
    });
    if (firstRollbackPreview.counts.proposed !== 1 || firstRollbackPreview.counts.blocked !== 0) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    await verifyTarget(dependencies, handle.client, target);
    const firstRollback = await dependencies.runOperator(
      rollbackInput(database, activeManifest, firstRollbackPreview.pageFingerprint),
    );
    if (firstRollback.counts.rolledBack !== 1) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.rollbackPassed = true;
    report.counts.rolledBack += firstRollback.counts.rolledBack;
    if (!exactKeeperState(keeperState, await dependencies.readKeeperState(handle.client, fixture))) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.rollbackStatePreserved = true;
    report.counts.restoredStatuses = await dependencies.countFixtureStatuses(handle.client, fixture);
    if (report.counts.restoredStatuses !== 2) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    const firstRolledBackGraph = await dependencies.captureRolledBackGraph(handle.client, fixture);

    const freshReview = await discoverTwice({ database, runOperator: dependencies.runOperator });
    activeManifest = freshReview.manifest;
    await verifyTarget(dependencies, handle.client, target);
    const reapplied = await dependencies.runOperator(applyInput(database, activeManifest));
    if (reapplied.counts.applied !== 1) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.reapplyPassed = true;
    report.counts.applied += reapplied.counts.applied;

    await verifyTarget(dependencies, handle.client, target);
    await dependencies.insertProvenance(handle.client, fixture);
    const beforeDriftPreviewPhase = await dependencies.repairPhase(handle.client, fixture);
    const driftPreview = await rollbackPreview({
      database,
      manifest: activeManifest,
      runOperator: dependencies.runOperator,
    });
    const afterDriftPreviewPhase = await dependencies.repairPhase(handle.client, fixture);
    if (driftPreview.counts.proposed !== 0
      || driftPreview.counts.blocked !== 1
      || driftPreview.stops.repair_evidence_invalid !== 1
      || beforeDriftPreviewPhase !== "APPLIED"
      || afterDriftPreviewPhase !== "APPLIED"
      || await dependencies.countProvenance(handle.client, fixture) !== 1) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.graphDriftBlocked = true;

    await verifyTarget(dependencies, handle.client, target);
    await dependencies.removeProvenance(handle.client, fixture);
    if (await dependencies.countProvenance(handle.client, fixture) !== 0) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.provenanceRemoved = true;

    const finalPreview = await rollbackPreview({
      database,
      manifest: activeManifest,
      runOperator: dependencies.runOperator,
    });
    if (finalPreview.counts.proposed !== 1 || finalPreview.counts.blocked !== 0) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    await verifyTarget(dependencies, handle.client, target);
    const finalRollback = await dependencies.runOperator(
      rollbackInput(database, activeManifest, finalPreview.pageFingerprint),
    );
    if (finalRollback.counts.rolledBack !== 1) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.finalRollbackPassed = true;
    report.counts.rolledBack += finalRollback.counts.rolledBack;
    if (!exactPrivateValue(
      firstRolledBackGraph,
      await dependencies.captureRolledBackGraph(handle.client, fixture),
    )) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    report.finalStateMatched = true;

    await verifyTarget(dependencies, handle.client, target);
    report.cleanupComplete = await dependencies.cleanup(handle.client, fixture);
    if (!report.cleanupComplete) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    report.completed = true;
    return report;
  } catch {
    if (handle && database && fixture) {
      report.cleanupComplete = await safeRecovery({
        dependencies,
        client: handle.client,
        target,
        database,
        fixture,
        manifest: activeManifest,
      });
    }
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError(report);
  } finally {
    if (handle) await handle.disconnect().catch(() => undefined);
  }
}

function selectionCandidates(): Array<{
  productCatalogKey: string;
  benefitCatalogKey: string;
  sourceCreditKey: string;
}> {
  return Object.values(AMEX_CATALOG_IDENTITY_REGISTRY).flatMap((product) =>
    product.benefits.flatMap((benefit) => benefit.sourceSemantics === "usage" && benefit.sourceCreditKey
      ? [{
        productCatalogKey: product.catalogKey,
        benefitCatalogKey: benefit.catalogKey,
        sourceCreditKey: benefit.sourceCreditKey,
      }]
      : []))
    .sort((left, right) => left.productCatalogKey.localeCompare(right.productCatalogKey)
      || left.benefitCatalogKey.localeCompare(right.benefitCatalogKey));
}

async function selectDefinition(client: PrismaClient): Promise<SelectedAmexDefinition> {
  for (const candidate of selectionCandidates()) {
    const row = await client.predefinedCard.findUnique({
      where: { catalogKey: candidate.productCatalogKey },
      select: {
        id: true,
        catalogKey: true,
        name: true,
        issuer: true,
        productKey: true,
        retiredAt: true,
        benefits: {
          where: { catalogKey: candidate.benefitCatalogKey },
          select: {
            id: true,
            catalogKey: true,
            predefinedCardId: true,
            category: true,
            description: true,
            percentage: true,
            maxAmount: true,
            frequency: true,
            cycleAlignment: true,
            fixedCycleDurationMonths: true,
            fixedCycleStartMonth: true,
            occurrencesInCycle: true,
            productKey: true,
            creditFamilyKey: true,
            periodKey: true,
            retiredAt: true,
          },
        },
      },
    });
    if (!row || row.retiredAt !== null || row.benefits.length !== 1 || row.benefits[0].retiredAt !== null) continue;
    const product: DestinationPredefinedCardSnapshot = {
      ...row,
      benefits: [],
    };
    const benefit: DestinationPredefinedBenefitSnapshot = {
      ...row.benefits[0],
      frequency: row.benefits[0].frequency,
      cycleAlignment: row.benefits[0].cycleAlignment,
      statuses: [],
    };
    const sourceIdentity = resolveAmexGlobalDefinitionAuthority({
      product,
      benefit,
      sourceCreditKey: candidate.sourceCreditKey,
    });
    if (sourceIdentity) return { product, benefit, sourceIdentity };
  }
  throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
}

function fixtureId(kind: string, nonce: string): string {
  return `00000000-rehearsal-${kind}-${nonce}`;
}

async function createFixture(
  client: PrismaClient,
  database: GlobalBenefitCategoryRepairDatabase,
  selection: SelectedAmexDefinition,
  beforeBootstrapWrite: () => Promise<void>,
): Promise<DevelopmentRehearsalFixture> {
  const nonce = randomUUID();
  const fixture: DevelopmentRehearsalFixture = {
    userId: fixtureId("user", nonce),
    email: `${nonce}@example.invalid`,
    cardId: fixtureId("card", nonce),
    legacyBenefitId: fixtureId("benefit", nonce),
    ledgerId: fixtureId("ledger", nonce),
    keeperStatusId: fixtureId("keeper", nonce),
    loserStatusId: fixtureId("loser", nonce),
    provenanceId: fixtureId("provenance", nonce),
    predefinedCardId: selection.product.id,
    predefinedBenefitId: selection.benefit.id,
  };
  const historicalCategory = `${selection.benefit.category} (historical rehearsal)`;
  try {
    await client.$transaction(async (tx) => {
    await tx.user.create({ data: { id: fixture.userId, email: fixture.email, name: "Development rehearsal fixture" } });
    await tx.creditCard.create({
      data: {
        id: fixture.cardId,
        userId: fixture.userId,
        name: selection.product.name,
        issuer: selection.product.issuer,
        lastFourDigits: "12345",
        lifecycleStatus: "ACTIVE",
        predefinedCardId: selection.product.id,
      },
    });
    await tx.benefit.create({
      data: {
        id: fixture.legacyBenefitId,
        category: historicalCategory,
        description: selection.benefit.description,
        percentage: selection.benefit.percentage,
        maxAmount: selection.benefit.maxAmount,
        startDate: CYCLE_START,
        endDate: CYCLE_END,
        frequency: selection.benefit.frequency as never,
        creditCardId: fixture.cardId,
        userId: null,
        cycleAlignment: selection.benefit.cycleAlignment as never,
        fixedCycleDurationMonths: selection.benefit.fixedCycleDurationMonths,
        fixedCycleStartMonth: selection.benefit.fixedCycleStartMonth,
        occurrencesInCycle: selection.benefit.occurrencesInCycle,
        productKey: selection.benefit.productKey,
        creditFamilyKey: selection.benefit.creditFamilyKey,
        periodKey: selection.benefit.periodKey,
      },
    });
    await tx.benefitStatus.create({
      data: {
        id: fixture.keeperStatusId,
        benefitId: fixture.legacyBenefitId,
        userId: fixture.userId,
        cycleStartDate: CYCLE_START,
        cycleEndDate: CYCLE_END,
        occurrenceIndex: 0,
        usedAmount: 7,
        isCompleted: false,
        completedAt: null,
        isNotUsable: false,
        orderIndex: 17,
      },
    });
    await tx.benefitStatus.create({
      data: {
        id: fixture.loserStatusId,
        benefitId: null,
        creditCardId: fixture.cardId,
        predefinedBenefitId: selection.benefit.id,
        userId: fixture.userId,
        cycleStartDate: CYCLE_START,
        cycleEndDate: CYCLE_END,
        occurrenceIndex: 0,
        usedAmount: 0,
        isCompleted: false,
        completedAt: null,
        isNotUsable: false,
        orderIndex: null,
      },
    });
    await tx.catalogMigrationLedger.create({
      data: {
        id: fixture.ledgerId,
        legacyBenefitId: fixture.legacyBenefitId,
        userId: fixture.userId,
        creditCardId: fixture.cardId,
        classification: "CUSTOM",
        phase: "CLASSIFIED",
        sourceFingerprint: PLACEHOLDER_FINGERPRINT,
        destinationFingerprint: null,
      },
    });
  }, { isolationLevel: "Serializable" });

  // Bootstrap through the production adapter shape and canonical source digest.
  const bootstrap = await database.readBatch({ mode: "discover", afterCursorDigest: null, limit: FIXTURE_LIMIT });
  assertFixtureOnlyPage(bootstrap, fixture);
  const sourceFingerprint = legacyBenefitSourceFingerprint(bootstrap.units[0].source);
  await beforeBootstrapWrite();
  const updated = await client.catalogMigrationLedger.updateMany({
    where: {
      id: fixture.ledgerId,
      legacyBenefitId: fixture.legacyBenefitId,
      sourceFingerprint: PLACEHOLDER_FINGERPRINT,
    },
    data: { sourceFingerprint },
  });
  if (updated.count !== 1) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  const verified = await database.readBatch({ mode: "discover", afterCursorDigest: null, limit: FIXTURE_LIMIT });
  assertFixtureOnlyPage(verified, fixture);
    if (verified.units[0].source.ledger?.sourceFingerprint !== sourceFingerprint) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
    return fixture;
  } catch {
    try {
      await beforeBootstrapWrite();
      await cleanup(client, fixture);
    } catch {
      // Target uncertainty forbids compensating writes. The aggregate failure
      // report will truthfully leave cleanup incomplete.
    }
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
}

function assertFixtureOnlyPage(
  snapshot: CategoryRepairBatchSnapshot,
  fixture: DevelopmentRehearsalFixture,
): void {
  if (snapshot.units.length !== 1
    || snapshot.units[0].source.id !== fixture.legacyBenefitId
    || snapshot.units[0].privateKey !== `repair:${fixture.legacyBenefitId}`) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
}

async function verifyAppliedRuntime(
  client: PrismaClient,
  fixture: DevelopmentRehearsalFixture,
  selection: SelectedAmexDefinition,
): Promise<number> {
  const effective = await fetchEffectiveBenefitStatuses(client, { userId: fixture.userId });
  if (effective.length !== 1
    || effective[0].id !== fixture.keeperStatusId
    || effective[0].benefit.id !== fixture.predefinedBenefitId
    || effective[0].benefit.category !== selection.benefit.category
    || effective[0].isCustomBenefit
    || effective[0].canMutateDefinition
    || effective[0].source.kind !== "bridge") {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }

  const context = await loadAmexSyncDestinationContext(fixture.userId, client as never);
  const destinationStatus = context.cards
    .find((card) => card.id === fixture.cardId)?.predefinedCard?.benefits
    .find((benefit) => benefit.id === fixture.predefinedBenefitId)?.statuses
    .find((candidate) => candidate.id === fixture.keeperStatusId);
  const globalAuthority = resolveAmexGlobalDefinitionAuthority({
    product: selection.product,
    benefit: selection.benefit,
    sourceCreditKey: selection.sourceIdentity.sourceCreditKey!,
  });
  if (!globalAuthority || destinationStatus?.legacyAuthority?.kind !== "ACTIVE_CATEGORY_REPAIR") {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
  return effective.length;
}

function mutableState(status: {
  usedAmount: number | null;
  isCompleted: boolean;
  completedAt: Date | null;
  isNotUsable: boolean;
  orderIndex: number | null;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
}): MutableKeeperState {
  return {
    usedAmount: status.usedAmount,
    isCompleted: status.isCompleted,
    completedAt: status.completedAt?.toISOString() ?? null,
    isNotUsable: status.isNotUsable,
    orderIndex: status.orderIndex,
    cycleStartDate: status.cycleStartDate.toISOString(),
    cycleEndDate: status.cycleEndDate.toISOString(),
    occurrenceIndex: status.occurrenceIndex,
  };
}

async function readKeeperState(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<MutableKeeperState> {
  const status = await client.benefitStatus.findUnique({ where: { id: fixture.keeperStatusId } });
  if (!status) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  return mutableState(status);
}

async function mutateKeeper(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<MutableKeeperState> {
  const before = await client.benefitStatus.findUnique({ where: { id: fixture.keeperStatusId } });
  if (!before) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  const changed = await client.benefitStatus.updateMany({
    where: {
      id: fixture.keeperStatusId,
      userId: fixture.userId,
      benefitId: fixture.legacyBenefitId,
      creditCardId: fixture.cardId,
      predefinedBenefitId: fixture.predefinedBenefitId,
      usedAmount: before.usedAmount,
      isCompleted: before.isCompleted,
      completedAt: before.completedAt,
      isNotUsable: before.isNotUsable,
      orderIndex: before.orderIndex,
      updatedAt: before.updatedAt,
    },
    data: { usedAmount: 11, isCompleted: true, completedAt: COMPLETED_AT, orderIndex: 23 },
  });
  if (changed.count !== 1) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  return readKeeperState(client, fixture);
}

async function captureRolledBackGraph(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<unknown> {
  const [benefit, ledger, statuses] = await Promise.all([
    client.benefit.findUnique({
      where: { id: fixture.legacyBenefitId },
      select: {
        id: true, creditCardId: true, userId: true, category: true, description: true,
        percentage: true, maxAmount: true, startDate: true, endDate: true, frequency: true,
        cycleAlignment: true, fixedCycleStartMonth: true, fixedCycleDurationMonths: true,
        occurrencesInCycle: true, productKey: true, creditFamilyKey: true, periodKey: true,
      },
    }),
    client.catalogMigrationLedger.findUnique({
      where: { id: fixture.ledgerId },
      select: {
        id: true, legacyBenefitId: true, userId: true, creditCardId: true,
        predefinedCardId: true, predefinedBenefitId: true, classification: true,
        phase: true, sourceFingerprint: true, destinationFingerprint: true,
      },
    }),
    client.benefitStatus.findMany({
      where: { id: { in: [fixture.keeperStatusId, fixture.loserStatusId] } },
      orderBy: { id: "asc" },
      select: {
        id: true, benefitId: true, creditCardId: true, predefinedBenefitId: true,
        userId: true, cycleStartDate: true, cycleEndDate: true, occurrenceIndex: true,
        usedAmount: true, isCompleted: true, completedAt: true, isNotUsable: true,
        orderIndex: true, createdAt: true, updatedAt: true,
      },
    }),
  ]);
  return JSON.parse(JSON.stringify({ benefit, ledger, statuses })) as unknown;
}

async function insertProvenance(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<void> {
  await client.benefitStatusSourceProvenance.create({
    data: {
      id: fixture.provenanceId,
      benefitStatusId: fixture.keeperStatusId,
      source: "AMEX",
      sourceObservationIdentity: "1".repeat(64),
      sourceObservationDigest: "2".repeat(64),
      observedAt: new Date("2040-01-20T00:00:00.000Z"),
      contractVersion: "development-rehearsal/1",
      parserVersion: "development-rehearsal/1",
      productKey: "development-rehearsal",
      creditFamilyKey: "development-rehearsal",
      periodKey: "development-rehearsal",
      attemptId: null,
    },
  });
}

async function removeProvenance(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<void> {
  const removed = await client.benefitStatusSourceProvenance.deleteMany({
    where: {
      id: fixture.provenanceId,
      benefitStatusId: fixture.keeperStatusId,
      source: "AMEX",
      sourceObservationIdentity: "1".repeat(64),
      sourceObservationDigest: "2".repeat(64),
      attemptId: null,
    },
  });
  if (removed.count !== 1) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
}

async function cleanup(client: PrismaClient, fixture: DevelopmentRehearsalFixture): Promise<boolean> {
  try {
    return await client.$transaction(async (tx) => {
      const repairs = await tx.$queryRaw<Array<{
        id: string;
        phase: string;
        catalogMigrationLedgerId: string;
        userId: string;
        creditCardId: string;
        predefinedCardId: string;
        predefinedBenefitId: string;
      }>>(Prisma.sql`
        SELECT "id", "phase"::text AS "phase", "catalogMigrationLedgerId", "userId",
          "creditCardId", "predefinedCardId", "predefinedBenefitId"
        FROM "GlobalBenefitCategoryRepair"
        WHERE "legacyBenefitId" = ${fixture.legacyBenefitId}
      `);
      if (repairs.length > 1 || repairs[0]?.phase === "APPLIED") {
        throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
      }
      const repair = repairs[0];
      if (repair) {
        const occurrences = await tx.$queryRaw<Array<{
          repairId: string;
          userId: string;
          creditCardId: string;
          predefinedBenefitId: string;
          action: string;
          keeperSource: string;
          keeperStatusId: string;
          cycleStartDate: Date;
          cycleEndDate: Date;
          occurrenceIndex: number;
          removedStatusId: string | null;
          removedStatusSource: string | null;
        }>>(Prisma.sql`
          SELECT "repairId", "userId", "creditCardId", "predefinedBenefitId",
            "action"::text AS "action", "keeperSource"::text AS "keeperSource", "keeperStatusId",
            "cycleStartDate", "cycleEndDate", "occurrenceIndex", "removedStatusId",
            "removedStatusSource"::text AS "removedStatusSource"
          FROM "GlobalBenefitCategoryRepairOccurrence"
          WHERE "repairId" = ${repair.id}
        `);
        if (repair.phase !== "ROLLED_BACK"
          || repair.catalogMigrationLedgerId !== fixture.ledgerId
          || repair.userId !== fixture.userId
          || repair.creditCardId !== fixture.cardId
          || repair.predefinedCardId !== fixture.predefinedCardId
          || repair.predefinedBenefitId !== fixture.predefinedBenefitId
          || occurrences.length !== 1
          || occurrences[0].repairId !== repair.id
          || occurrences[0].userId !== fixture.userId
          || occurrences[0].creditCardId !== fixture.cardId
          || occurrences[0].predefinedBenefitId !== fixture.predefinedBenefitId
          || occurrences[0].action !== "PROMOTE_LEGACY_STATUS"
          || occurrences[0].keeperSource !== "LEGACY_CUSTOM"
          || occurrences[0].keeperStatusId !== fixture.keeperStatusId
          || occurrences[0].cycleStartDate.toISOString() !== CYCLE_START.toISOString()
          || occurrences[0].cycleEndDate.toISOString() !== CYCLE_END.toISOString()
          || occurrences[0].occurrenceIndex !== 0
          || occurrences[0].removedStatusId !== fixture.loserStatusId
          || occurrences[0].removedStatusSource !== "CANONICAL_STANDARD") {
          throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
        }
        const occurrenceCount = await tx.$executeRaw(Prisma.sql`
          DELETE FROM "GlobalBenefitCategoryRepairOccurrence"
          WHERE "repairId" = ${repair.id} AND "userId" = ${fixture.userId}
            AND "creditCardId" = ${fixture.cardId}
            AND "predefinedBenefitId" = ${fixture.predefinedBenefitId}
            AND "keeperStatusId" = ${fixture.keeperStatusId}
        `);
        const parentCount = await tx.$executeRaw(Prisma.sql`
          DELETE FROM "GlobalBenefitCategoryRepair"
          WHERE "id" = ${repair.id} AND "legacyBenefitId" = ${fixture.legacyBenefitId}
            AND "userId" = ${fixture.userId} AND "creditCardId" = ${fixture.cardId}
            AND "phase" = 'ROLLED_BACK'
        `);
        if (occurrenceCount !== 1 || parentCount !== 1) {
          throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
        }
      }
      await tx.benefitStatusSourceProvenance.deleteMany({
        where: { id: fixture.provenanceId, benefitStatusId: fixture.keeperStatusId },
      });
      const statuses = await tx.benefitStatus.deleteMany({
        where: { id: { in: [fixture.keeperStatusId, fixture.loserStatusId] }, userId: fixture.userId },
      });
      const ledger = await tx.catalogMigrationLedger.deleteMany({
        where: { id: fixture.ledgerId, legacyBenefitId: fixture.legacyBenefitId, userId: fixture.userId },
      });
      const benefit = await tx.benefit.deleteMany({
        where: { id: fixture.legacyBenefitId, creditCardId: fixture.cardId, userId: null },
      });
      const card = await tx.creditCard.deleteMany({ where: { id: fixture.cardId, userId: fixture.userId } });
      const user = await tx.user.deleteMany({ where: { id: fixture.userId, email: fixture.email } });
      if (statuses.count !== 2 || ledger.count !== 1 || benefit.count !== 1
        || card.count !== 1 || user.count !== 1) {
        throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
      }
      const remaining = await Promise.all([
        tx.user.count({ where: { id: fixture.userId } }),
        tx.creditCard.count({ where: { id: fixture.cardId } }),
        tx.benefit.count({ where: { id: fixture.legacyBenefitId } }),
        tx.benefitStatus.count({ where: { id: { in: [fixture.keeperStatusId, fixture.loserStatusId] } } }),
        tx.catalogMigrationLedger.count({ where: { id: fixture.ledgerId } }),
        tx.benefitStatusSourceProvenance.count({ where: { id: fixture.provenanceId } }),
      ]);
      return remaining.every((count: number) => count === 0);
    }, { isolationLevel: "Serializable" });
  } catch {
    return false;
  }
}

export const defaultGlobalBenefitCategoryRepairDevelopmentRehearsalDependencies:
GlobalBenefitCategoryRepairDevelopmentRehearsalDependencies = {
  createClient: (databaseUrlDev) => {
    const client = new PrismaClient({ datasourceUrl: databaseUrlDev });
    return { client, disconnect: () => client.$disconnect() };
  },
  identify: (client, databaseUrlDev) =>
    new PrismaUserCloneDestination(client, databaseUrlDev).identify(),
  createRepairDatabase: createPrismaGlobalBenefitCategoryRepairDatabase,
  ensureRepairSchema: async (client) => {
    const rows = await client.$queryRaw<Array<{ repair: string | null; occurrence: string | null }>>(
      Prisma.sql`SELECT to_regclass('"GlobalBenefitCategoryRepair"')::text AS "repair",
        to_regclass('"GlobalBenefitCategoryRepairOccurrence"')::text AS "occurrence"`,
    );
    if (rows.length !== 1 || !rows[0].repair || !rows[0].occurrence) {
      throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    }
  },
  selectDefinition,
  createFixture,
  runOperator: runGlobalBenefitCategoryRepairOperator,
  verifyAppliedRuntime,
  mutateKeeper,
  readKeeperState,
  captureRolledBackGraph,
  countFixtureStatuses: (client, fixture) => client.benefitStatus.count({
    where: { id: { in: [fixture.keeperStatusId, fixture.loserStatusId] }, userId: fixture.userId },
  }),
  insertProvenance,
  removeProvenance,
  countProvenance: (client, fixture) => client.benefitStatusSourceProvenance.count({
    where: { id: fixture.provenanceId, benefitStatusId: fixture.keeperStatusId },
  }),
  repairPhase: async (client, fixture) => {
    const rows = await client.$queryRaw<Array<{ phase: "APPLIED" | "ROLLED_BACK" }>>(Prisma.sql`
      SELECT "phase"::text AS "phase"
      FROM "GlobalBenefitCategoryRepair"
      WHERE "legacyBenefitId" = ${fixture.legacyBenefitId}
    `);
    if (rows.length > 1) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
    return rows[0]?.phase ?? null;
  },
  cleanup,
};

const REPORT_KEYS = [
  "completed", "targetValidated", "prerequisitesPassed", "deterministicReviewPassed",
  "applyPassed", "replayPassed", "runtimeAuthorityPassed", "keeperMutationPassed",
  "rollbackPassed", "rollbackStatePreserved", "reapplyPassed", "graphDriftBlocked",
  "provenanceRemoved", "finalRollbackPassed", "finalStateMatched", "cleanupComplete", "counts",
] as const;
const COUNT_KEYS = [
  "definitionsExamined", "statusActions", "applied", "idempotent", "rolledBack",
  "effectiveStatuses", "restoredStatuses",
] as const;

export function serializeGlobalBenefitCategoryRepairDevelopmentRehearsalReport(
  report: GlobalBenefitCategoryRepairDevelopmentRehearsalReport,
): string {
  const record = report as unknown as Record<string, unknown>;
  if (Object.keys(record).sort().join("|") !== [...REPORT_KEYS].sort().join("|")
    || REPORT_KEYS.slice(0, -1).some((key) => typeof report[key] !== "boolean")
    || Object.keys(report.counts).sort().join("|") !== [...COUNT_KEYS].sort().join("|")
    || COUNT_KEYS.some((key) => !Number.isSafeInteger(report.counts[key]) || report.counts[key] < 0)) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
  return JSON.stringify(report);
}
