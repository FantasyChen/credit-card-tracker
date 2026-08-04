import type { PrismaClient } from "@/generated/prisma";
import {
  classifyLegacyMigrationUnit,
  encodeGlobalBenefitMigrationCursor,
  globalDefinitionFingerprint,
  migrationFingerprint,
  type ExistingMigrationLedger,
  type GlobalCardDefinition,
  type LegacyMigrationUnit,
} from "../global-benefit-migration";
import { PrismaGlobalBenefitMigrationDatabase } from "../prisma-global-benefit-migration";

const START = new Date("2026-01-01T00:00:00.000Z");
const END = new Date("2026-01-31T23:59:59.999Z");
const CREATED = new Date("2025-12-01T00:00:00.000Z");
const UPDATED = new Date("2025-12-02T00:00:00.000Z");

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join(" ") ?? String(query);
}

function createAdapterHarness(
  initialPhase: "unbridged" | "rolled-back" = "unbridged",
  options: {
    statusCasFails?: boolean;
    mutateStatusDuringBridge?: boolean;
    cardOnlyAudit?: boolean;
    customOnly?: boolean;
    activeCategoryRepair?: boolean;
  } = {},
) {
  const definition: GlobalCardDefinition = {
    id: "global-card-1",
    catalogKey: "card-1",
    name: "Exact Card",
    issuer: "Exact Issuer",
    productKey: "product-1",
    retiredAt: null,
    benefits: [{
      id: "global-benefit-1",
      catalogKey: "card:benefit-1",
      predefinedCardId: "global-card-1",
      category: "Travel",
      description: "Exact persisted definition",
      percentage: 100,
      maxAmount: 20,
      frequency: "MONTHLY",
      cycleAlignment: "CALENDAR_FIXED",
      fixedCycleStartMonth: 1,
      fixedCycleDurationMonths: 1,
      occurrencesInCycle: 1,
      productKey: "product-1",
      creditFamilyKey: "product-1:credit",
      periodKey: "calendar-month",
      retiredAt: null,
    }],
  };
  const state = {
    benefitExists: true,
    statusBenefitId: "legacy-benefit-1" as string | null,
    cardPredefinedCardId: null as string | null,
    statusCreditCardId: null as string | null,
    statusPredefinedBenefitId: null as string | null,
    statusUsedAmount: 7,
    statusUpdatedAt: UPDATED,
    auditDestinationBenefitId: options.cardOnlyAudit ? null : "legacy-benefit-1" as string | null,
    auditPredefinedBenefitId: null as string | null,
    auditDefinitionFingerprint: null as string | null,
    auditReasonCode: "preserved-reason",
    ledger: null as ExistingMigrationLedger | null,
  };
  const statusJson = () => ({
    id: "status-1",
    benefitId: state.statusBenefitId,
    creditCardId: state.statusCreditCardId,
    predefinedBenefitId: state.statusPredefinedBenefitId,
    userId: "owner-1",
    cycleStartDate: START,
    cycleEndDate: END,
    isCompleted: false,
    completedAt: null,
    isNotUsable: false,
    usedAmount: state.statusUsedAmount,
    createdAt: CREATED,
    updatedAt: state.statusUpdatedAt,
    orderIndex: 3,
    occurrenceIndex: 0,
  });
  const auditJson = () => ({
    id: "audit-1",
    attemptId: "attempt-1",
    sourceRowIdentity: "source-row-1",
    sourceObservationIdentity: "observation-1",
    observedAt: START,
    contractVersion: "contract-1",
    parserVersion: "parser-1",
    disposition: "UPDATED",
    reasonCode: state.auditReasonCode,
    destinationCardId: "owned-card-1",
    destinationBenefitId: state.auditDestinationBenefitId,
    destinationPredefinedBenefitId: state.auditPredefinedBenefitId,
    destinationDefinitionFingerprint: state.auditDefinitionFingerprint,
    destinationStatusId: options.cardOnlyAudit ? null : "status-1",
    beforeUsedAmount: 0,
    afterUsedAmount: 7,
    beforeIsCompleted: false,
    afterIsCompleted: false,
    beforeCompletedAt: null,
    afterCompletedAt: null,
    beforeIsNotUsable: false,
    afterIsNotUsable: false,
    createdAt: CREATED,
  });
  const stableStatusFingerprint = () => {
    const value = statusJson();
    const { creditCardId, predefinedBenefitId, ...preserved } = value;
    void creditCardId;
    void predefinedBenefitId;
    return migrationFingerprint(preserved);
  };
  const stableAuditFingerprint = () => {
    const value = auditJson();
    const { destinationPredefinedBenefitId, destinationDefinitionFingerprint, ...preserved } = value;
    void destinationPredefinedBenefitId;
    void destinationDefinitionFingerprint;
    return migrationFingerprint(preserved);
  };
  const migrationUnit = (): LegacyMigrationUnit => ({
    key: "card:owned-card-1",
    card: {
      id: "owned-card-1",
      name: "Exact Card",
      issuer: "Exact Issuer",
      userId: "owner-1",
      productKey: null,
      predefinedCardId: state.cardPredefinedCardId,
    },
    benefits: [{
      id: "legacy-benefit-1",
      creditCardId: "owned-card-1",
      userId: null,
      category: "Travel",
      description: options.customOnly ? "User custom definition" : "Exact persisted definition",
      percentage: 100,
      maxAmount: 20,
      frequency: "MONTHLY",
      cycleAlignment: "CALENDAR_FIXED",
      fixedCycleStartMonth: 1,
      fixedCycleDurationMonths: 1,
      occurrencesInCycle: 1,
      productKey: null,
      creditFamilyKey: null,
      periodKey: null,
      statuses: [{
        id: "status-1",
        benefitId: state.statusBenefitId,
        creditCardId: state.statusCreditCardId,
        predefinedBenefitId: state.statusPredefinedBenefitId,
        userId: "owner-1",
        cycleStartDate: START,
        cycleEndDate: END,
        occurrenceIndex: 0,
        stateFingerprint: stableStatusFingerprint(),
      }],
      audits: options.cardOnlyAudit ? [] : [{
        id: "audit-1",
        attemptUserId: "owner-1",
        destinationCardId: "owned-card-1",
        destinationBenefitId: "legacy-benefit-1",
        destinationPredefinedBenefitId: state.auditPredefinedBenefitId,
        destinationStatusId: "status-1",
        destinationDefinitionFingerprint: state.auditDefinitionFingerprint,
        stateFingerprint: stableAuditFingerprint(),
      }],
      provenance: [],
      ledger: state.ledger,
      categoryRepairAuthority: options.activeCategoryRepair ? "APPLIED_VALID" : undefined,
    }],
    cardAudits: options.cardOnlyAudit ? [{
      id: "audit-1",
      attemptUserId: "owner-1",
      destinationCardId: "owned-card-1",
      destinationBenefitId: null,
      destinationPredefinedBenefitId: null,
      destinationStatusId: null,
      destinationDefinitionFingerprint: null,
      stateFingerprint: stableAuditFingerprint(),
    }] : [],
  });
  const unbridged = classifyLegacyMigrationUnit(migrationUnit(), [definition]);
  const destinationFingerprint = globalDefinitionFingerprint(definition.benefits[0]);
  if (initialPhase === "rolled-back") {
    state.ledger = {
      legacyBenefitId: "legacy-benefit-1",
      userId: "owner-1",
      creditCardId: "owned-card-1",
      predefinedCardId: "global-card-1",
      predefinedBenefitId: "global-benefit-1",
      classification: "STANDARD",
      phase: "ROLLED_BACK",
      sourceFingerprint: unbridged.benefits[0].sourceFingerprint,
      destinationFingerprint,
    };
  }
  if (options.activeCategoryRepair) {
    state.ledger = {
      legacyBenefitId: "legacy-benefit-1",
      userId: "owner-1",
      creditCardId: "owned-card-1",
      predefinedCardId: null,
      predefinedBenefitId: null,
      classification: "CUSTOM",
      phase: "CLASSIFIED",
      sourceFingerprint: unbridged.benefits[0].sourceFingerprint,
      destinationFingerprint: null,
    };
    state.cardPredefinedCardId = "global-card-1";
    state.statusCreditCardId = "owned-card-1";
    state.statusPredefinedBenefitId = "global-benefit-1";
  }

  const queryRaw = jest.fn(async (query: unknown) => {
    const text = sqlText(query);
    if (text.includes('AS "benefitCount"')) {
      return [{
        benefitCount: state.benefitExists ? BigInt(1) : BigInt(0),
        legacyStatusCount: state.statusBenefitId === null ? BigInt(0) : BigInt(1),
        ledgerCount: state.ledger?.phase === "CLEANED" ? BigInt(1) : BigInt(0),
      }];
    }
    if (text.includes('FROM "PredefinedCard"')) return [{
      id: definition.id,
      catalogKey: definition.catalogKey,
      name: definition.name,
      issuer: definition.issuer,
      productKey: definition.productKey,
      retiredAt: null,
    }];
    if (text.includes('FROM "PredefinedBenefit"')) return definition.benefits;
    if (text.includes('FROM "CreditCard" WHERE "id" IN')) return [{
      id: "owned-card-1",
      name: "Exact Card",
      issuer: "Exact Issuer",
      userId: "owner-1",
      productKey: null,
      predefinedCardId: state.cardPredefinedCardId,
    }];
    if (text.includes('FROM "Benefit"')) return state.benefitExists ? [{
      id: "legacy-benefit-1",
      category: "Travel",
      description: options.customOnly ? "User custom definition" : "Exact persisted definition",
      percentage: 100,
      maxAmount: 20,
      frequency: "MONTHLY",
      creditCardId: "owned-card-1",
      userId: null,
      cycleAlignment: "CALENDAR_FIXED",
      fixedCycleDurationMonths: 1,
      fixedCycleStartMonth: 1,
      occurrencesInCycle: 1,
      productKey: null,
      creditFamilyKey: null,
      periodKey: null,
    }] : [];
    if (text.includes('FROM "BenefitStatus" bs')) return [{
      id: "status-1",
      benefitId: state.statusBenefitId,
      creditCardId: state.statusCreditCardId,
      predefinedBenefitId: state.statusPredefinedBenefitId,
      userId: "owner-1",
      cycleStartDate: START,
      cycleEndDate: END,
      occurrenceIndex: 0,
      stateJson: statusJson(),
    }];
    if (text.includes('FROM "BenefitStatusSourceProvenance"')) return [];
    if (text.includes('FROM "GlobalBenefitCategoryRepair" repair')) {
      if (text.includes('SELECT EXISTS')) return [{ exists: false }];
      return options.activeCategoryRepair ? [{
        sourceBenefitId: 'legacy-benefit-1',
        repairId: 'repair-1',
        repairLegacyBenefitId: 'legacy-benefit-1',
        repairLedgerId: 'ledger-1',
        repairUserId: 'owner-1',
        repairCreditCardId: 'owned-card-1',
        repairPredefinedCardId: 'global-card-1',
        repairPredefinedBenefitId: 'global-benefit-1',
        targetCardCatalogKey: 'card-1',
        targetBenefitCatalogKey: 'card:benefit-1',
        definitionFingerprint: destinationFingerprint,
        evidenceVersion: 1,
        repairPhase: 'APPLIED',
        repairRolledBackAt: null,
        occurrenceRepairId: 'repair-1',
        occurrenceUserId: 'owner-1',
        occurrenceCreditCardId: 'owned-card-1',
        occurrencePredefinedBenefitId: 'global-benefit-1',
        occurrenceTargetBenefitCatalogKey: 'card:benefit-1',
        occurrenceAction: 'PROMOTE_LEGACY_STATUS',
        occurrenceKeeperSource: 'LEGACY_CUSTOM',
        occurrenceKeeperStatusId: 'status-1',
        occurrenceCycleStartDate: START,
        occurrenceCycleEndDate: END,
        occurrenceIndexEvidence: 0,
        keeperBaselineVersion: 1,
        removedStatusPreimageVersion: null,
        auditMetadataVersion: 1,
        keeperBenefitId: 'legacy-benefit-1',
        keeperCreditCardId: 'owned-card-1',
        keeperPredefinedBenefitId: 'global-benefit-1',
        keeperUserId: 'owner-1',
        keeperCycleStartDate: START,
        keeperCycleEndDate: END,
        keeperOccurrenceIndex: 0,
      }] : [];
    }
    if (text.includes('FROM "AmexSyncRowAudit" r')) return [{
      id: "audit-1",
      attemptUserId: "owner-1",
      destinationCardId: "owned-card-1",
      destinationBenefitId: state.auditDestinationBenefitId,
      destinationPredefinedBenefitId: state.auditPredefinedBenefitId,
      destinationStatusId: options.cardOnlyAudit ? null : "status-1",
      destinationDefinitionFingerprint: state.auditDefinitionFingerprint,
      stateJson: auditJson(),
    }];
    if (text.includes('count(*)') && text.includes('FROM "CatalogMigrationLedger"')) {
      return [{ count: state.ledger?.phase === "BRIDGED" ? BigInt(1) : BigInt(0) }];
    }
    if (text.includes('FROM "CatalogMigrationLedger"')) {
      return state.ledger ? [{ id: 'ledger-1', ...state.ledger }] : [];
    }
    throw new Error(`Unexpected mocked query: ${text}`);
  });
  const executeRaw = jest.fn(async (query: unknown) => {
    const text = sqlText(query);
    if (text.includes('UPDATE "CreditCard" SET "predefinedCardId"')) {
      state.cardPredefinedCardId = text.includes('SET "predefinedCardId" = NULL') ? null : "global-card-1";
      return 1;
    }
    if (text.includes('UPDATE "BenefitStatus"')) {
      if (options.statusCasFails) return 0;
      if (text.includes('SET "benefitId" = NULL')) {
        state.statusBenefitId = null;
        return 1;
      }
      state.statusCreditCardId = text.includes('SET "creditCardId" = NULL') ? null : "owned-card-1";
      state.statusPredefinedBenefitId = text.includes('SET "creditCardId" = NULL') ? null : "global-benefit-1";
      if (options.mutateStatusDuringBridge) state.statusUsedAmount = 99;
      return 1;
    }
    if (text.includes('UPDATE "AmexSyncRowAudit"')) {
      const clearing = text.includes('SET "destinationPredefinedBenefitId" = NULL');
      state.auditPredefinedBenefitId = clearing ? null : "global-benefit-1";
      state.auditDefinitionFingerprint = clearing ? null : destinationFingerprint;
      return 1;
    }
    if (text.includes('INSERT INTO "CatalogMigrationLedger"')) {
      state.ledger = {
        legacyBenefitId: "legacy-benefit-1",
        userId: "owner-1",
        creditCardId: "owned-card-1",
        predefinedCardId: options.customOnly ? null : "global-card-1",
        predefinedBenefitId: options.customOnly ? null : "global-benefit-1",
        classification: options.customOnly ? "CUSTOM" : "STANDARD",
        phase: options.customOnly ? "CLASSIFIED" : "BRIDGED",
        sourceFingerprint: unbridged.benefits[0].sourceFingerprint,
        destinationFingerprint: options.customOnly ? null : destinationFingerprint,
      };
      return 1;
    }
    if (text.includes('DELETE FROM "Benefit"')) {
      state.benefitExists = false;
      state.auditDestinationBenefitId = null;
      return 1;
    }
    if (text.includes('UPDATE "CatalogMigrationLedger"')) {
      const phase = text.includes("'CLEANED'") ? "CLEANED" : "ROLLED_BACK";
      state.ledger = state.ledger ? { ...state.ledger, phase } : null;
      return 1;
    }
    throw new Error(`Unexpected mocked write: ${text}`);
  });
  const transaction = { $queryRaw: queryRaw, $executeRaw: executeRaw };
  const client = {
    $transaction: jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => {
      const before = { ...state };
      try {
        return await callback(transaction);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    }),
  } as unknown as PrismaClient;

  return {
    adapter: new PrismaGlobalBenefitMigrationDatabase(client),
    definition,
    executeRaw,
    migrationUnit,
    state,
  };
}

describe("Prisma global-benefit migration adapter", () => {
  it("bridges only relation metadata and proves unrelated status/audit state stayed unchanged", async () => {
    const harness = createAdapterHarness();
    const expected = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);

    await expect(harness.adapter.applyBridge(expected)).resolves.toMatchObject({ standard: 1 });
    expect(harness.state).toMatchObject({
      cardPredefinedCardId: "global-card-1",
      statusCreditCardId: "owned-card-1",
      statusPredefinedBenefitId: "global-benefit-1",
      statusUsedAmount: 7,
      statusUpdatedAt: UPDATED,
      auditPredefinedBenefitId: "global-benefit-1",
      auditReasonCode: "preserved-reason",
      ledger: { phase: "BRIDGED" },
    });
  });

  it("links a custom-only card and records exact custom evidence without rewriting statuses or audits", async () => {
    const harness = createAdapterHarness("unbridged", { customOnly: true });
    const expected = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);

    expect(expected.benefits).toEqual([
      expect.objectContaining({ disposition: "custom" }),
    ]);
    await expect(harness.adapter.applyBridge(expected)).resolves.toMatchObject({ custom: 1 });

    const statusOrAuditUpdates = harness.executeRaw.mock.calls.filter(([query]) => {
      const text = sqlText(query);
      return text.includes('UPDATE "BenefitStatus"')
        || text.includes('UPDATE "AmexSyncRowAudit"');
    });
    expect(statusOrAuditUpdates).toHaveLength(0);
    expect(harness.state).toMatchObject({
      cardPredefinedCardId: "global-card-1",
      statusCreditCardId: null,
      statusPredefinedBenefitId: null,
      auditPredefinedBenefitId: null,
      ledger: {
        classification: "CUSTOM",
        phase: "CLASSIFIED",
        predefinedCardId: null,
        predefinedBenefitId: null,
      },
    });
  });

  it("hydrates exact active category-repair evidence as a replayable historical custom unit", async () => {
    const harness = createAdapterHarness('unbridged', {
      customOnly: true,
      activeCategoryRepair: true,
    });
    const expected = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);

    expect(expected).toMatchObject({
      blocked: false,
      benefits: [{ disposition: 'custom', ledgerPhase: 'CLASSIFIED' }],
    });
    await expect(harness.adapter.applyBridge(expected)).resolves.toMatchObject({
      idempotent: 1,
      custom: 0,
    });
  });

  it("uses card-only audits as ownership evidence without rewriting them as benefit destinations", async () => {
    const harness = createAdapterHarness("unbridged", { cardOnlyAudit: true });
    const expected = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);

    await expect(harness.adapter.applyBridge(expected)).resolves.toMatchObject({ standard: 1 });
    const auditUpdates = harness.executeRaw.mock.calls.filter(([query]) =>
      sqlText(query).includes('UPDATE "AmexSyncRowAudit"'));
    expect(auditUpdates).toHaveLength(0);
    expect(harness.state).toMatchObject({
      auditPredefinedBenefitId: null,
      auditDefinitionFingerprint: null,
    });
  });

  it("fails a relation compare-and-set atomically before recording a bridge ledger", async () => {
    const harness = createAdapterHarness("unbridged", { statusCasFails: true });
    const expected = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);

    await expect(harness.adapter.applyBridge(expected)).rejects.toThrow("status bridge compare-and-set");
    expect(harness.state).toMatchObject({
      cardPredefinedCardId: null,
      statusCreditCardId: null,
      statusPredefinedBenefitId: null,
      ledger: null,
    });
  });

  it("rolls back when post-write verification observes unrelated status drift", async () => {
    const harness = createAdapterHarness("unbridged", { mutateStatusDuringBridge: true });
    const expected = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);

    await expect(harness.adapter.applyBridge(expected)).rejects.toThrow("Post-bridge preservation verification");
    expect(harness.state).toMatchObject({
      cardPredefinedCardId: null,
      statusCreditCardId: null,
      statusPredefinedBenefitId: null,
      statusUsedAmount: 7,
      ledger: null,
    });
  });

  it("cleans only an exact bridged copy while preserving the existing status state and global links", async () => {
    const harness = createAdapterHarness();
    const bridge = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);
    await harness.adapter.applyBridge(bridge);
    const cleanup = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);

    await expect(harness.adapter.cleanupBridge(cleanup)).resolves.toMatchObject({ cleaned: 1 });
    expect(harness.state).toMatchObject({
      benefitExists: false,
      statusBenefitId: null,
      statusCreditCardId: "owned-card-1",
      statusPredefinedBenefitId: "global-benefit-1",
      statusUsedAmount: 7,
      statusUpdatedAt: UPDATED,
      auditDestinationBenefitId: null,
      auditPredefinedBenefitId: "global-benefit-1",
      auditReasonCode: "preserved-reason",
      ledger: { phase: "CLEANED" },
    });
  });

  it("rolls back only bridge-added links and retains the legacy status state", async () => {
    const harness = createAdapterHarness();
    const bridge = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);
    await harness.adapter.applyBridge(bridge);
    const rollback = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);

    await expect(harness.adapter.rollbackBridge(rollback)).resolves.toMatchObject({ rolledBack: 1 });
    expect(harness.state).toMatchObject({
      cardPredefinedCardId: null,
      statusCreditCardId: null,
      statusPredefinedBenefitId: null,
      statusUsedAmount: 7,
      statusUpdatedAt: UPDATED,
      auditPredefinedBenefitId: null,
      auditDefinitionFingerprint: null,
      auditReasonCode: "preserved-reason",
      ledger: { phase: "ROLLED_BACK" },
    });
  });

  it("treats a second pre-cleanup rollback as idempotent without rewriting an already-null card link", async () => {
    const harness = createAdapterHarness("rolled-back");
    const expected = classifyLegacyMigrationUnit(harness.migrationUnit(), [harness.definition]);

    await expect(harness.adapter.rollbackBridge(expected)).resolves.toMatchObject({ idempotent: 1, rolledBack: 0 });
    expect(harness.executeRaw).not.toHaveBeenCalled();
  });

  it("resolves a continuation cursor after cleanup deletes the final unit's copied benefits", async () => {
    const cursor = encodeGlobalBenefitMigrationCursor("card:cleaned-card");
    const queryRaw = jest.fn(async (query: unknown) => {
      const text = sqlText(query);
      if (text.includes("md5('global-benefit-migration/v2:'")) {
        expect(text).toContain('FROM "CatalogMigrationLedger"');
        return [{ unitKey: "card:cleaned-card" }];
      }
      if (text.includes('ORDER BY "unitKey" ASC')) return [];
      if (text.includes('FROM "PredefinedCard"') || text.includes('FROM "PredefinedBenefit"')) return [];
      throw new Error(`Unexpected mocked query: ${text}`);
    });
    const adapter = new PrismaGlobalBenefitMigrationDatabase({
      $queryRaw: queryRaw,
    } as unknown as PrismaClient);

    await expect(adapter.readBatch({
      afterCursorDigest: cursor.slice("v2.".length),
      limit: 100,
    })).resolves.toEqual({ definitions: [], units: [], hasMore: false });
  });
});
