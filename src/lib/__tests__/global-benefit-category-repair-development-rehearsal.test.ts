import type { PrismaClient } from "@/generated/prisma";
import {
  GLOBAL_BENEFIT_CATEGORY_REPAIR_DEVELOPMENT_REHEARSAL_CONFIRMATION,
  GlobalBenefitCategoryRepairDevelopmentRehearsalError,
  runGlobalBenefitCategoryRepairDevelopmentRehearsal,
  serializeGlobalBenefitCategoryRepairDevelopmentRehearsalReport,
  validateGlobalBenefitCategoryRepairDevelopmentRehearsalInput,
  type GlobalBenefitCategoryRepairDevelopmentRehearsalDependencies,
  type GlobalBenefitCategoryRepairDevelopmentRehearsalInput,
  type GlobalBenefitCategoryRepairDevelopmentRehearsalReport,
} from "../global-benefit-category-repair-development-rehearsal";
import type {
  GlobalBenefitCategoryRepairManifest,
  GlobalBenefitCategoryRepairReport,
} from "../global-benefit-category-repair";
import {
  parseDevelopmentCategoryRepairRehearsalArguments,
} from "../../../scripts/rehearse-global-benefit-category-repair-development";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const DEV_HOST = "development.example.test";
const PROD_HOST = "production.example.test";
const DEV_BRANCH = "1".repeat(16);
const PROD_BRANCH = "2".repeat(16);
const DEV_IDENTITY = "3".repeat(16);

function input(overrides: Partial<GlobalBenefitCategoryRepairDevelopmentRehearsalInput> = {}) {
  return {
    databaseUrlDev: `postgresql://private:private@${DEV_HOST}/private`,
    expectedDevelopmentHost: DEV_HOST,
    expectedDevelopmentIdentityFingerprint: DEV_IDENTITY,
    expectedDevelopmentBranchFingerprint: DEV_BRANCH,
    forbiddenProductionHost: PROD_HOST,
    forbiddenProductionBranchFingerprint: PROD_BRANCH,
    rawAmexSyncMode: "off",
    confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_DEVELOPMENT_REHEARSAL_CONFIRMATION,
    recoveryPointVerified: true,
    ...overrides,
  };
}

function manifest(fingerprint = HASH_B): GlobalBenefitCategoryRepairManifest {
  return {
    version: 1,
    inventoryFingerprint: HASH_A,
    pageFingerprint: HASH_C,
    afterCursor: null,
    nextCursor: null,
    hasMore: false,
    entries: [{
      privateKey: "private-fixture-key",
      sourceBenefitId: "private-source-id",
      ownerId: "private-owner-id",
      creditCardId: "private-card-id",
      predefinedCardId: "private-global-card-id",
      predefinedBenefitId: "private-global-benefit-id",
      targetCardCatalogKey: "private-card-key",
      targetBenefitCatalogKey: "private-benefit-key",
      definitionFingerprint: HASH_A,
      immutableGraphFingerprint: HASH_A,
      currentGraphFingerprint: HASH_A,
      destinationFingerprint: HASH_A,
      postimageFingerprint: HASH_A,
      planFingerprint: HASH_A,
      entryFingerprint: HASH_A,
    }],
    manifestFingerprint: fingerprint,
  };
}

function report(
  mode: GlobalBenefitCategoryRepairReport["mode"],
  overrides: Partial<GlobalBenefitCategoryRepairReport["counts"]> = {},
  stops: GlobalBenefitCategoryRepairReport["stops"] = {},
): GlobalBenefitCategoryRepairReport {
  return {
    mode,
    limit: 1,
    hasMore: false,
    nextCursor: null,
    inventoryFingerprint: HASH_A,
    pageFingerprint: HASH_C,
    manifestFingerprint: HASH_B,
    counts: {
      definitionsExamined: 1,
      proposed: 1,
      blocked: 0,
      statusActions: 1,
      applied: 0,
      rolledBack: 0,
      idempotent: 0,
      ...overrides,
    },
    actions: { PROMOTE_LEGACY_STATUS: 1 },
    stops,
  };
}

function successfulDependencies(options: {
  failRuntime?: boolean;
  failFirstRollback?: boolean;
  cleanupResult?: boolean;
  driftPreviewBlocked?: boolean;
} = {}) {
  const client = {} as PrismaClient;
  const database = { readBatch: jest.fn(), applyRepair: jest.fn(), rollbackRepair: jest.fn() };
  const fixture = { private: "fixture" };
  const selection = { private: "selection" };
  const reviewedManifest = manifest();
  let phase: "APPLIED" | "ROLLED_BACK" | null = null;
  let provenanceCount = 0;
  let applyCount = 0;
  let rollbackPreviewCount = 0;
  let rollbackAttemptCount = 0;
  const operatorInputs: unknown[] = [];

  const runOperator = jest.fn(async (operatorInput: Record<string, unknown>) => {
    operatorInputs.push(operatorInput);
    const mode = operatorInput.mode as GlobalBenefitCategoryRepairReport["mode"];
    if (mode === "discover") {
      await (operatorInput.onDiscoveryManifest as ((value: GlobalBenefitCategoryRepairManifest) => Promise<void>))(
        reviewedManifest,
      );
      return report("discover");
    }
    if (mode === "dry-run") return report("dry-run");
    if (mode === "apply") {
      expect(operatorInput.manifest).toBe(reviewedManifest);
      expect(operatorInput.expectedInventoryFingerprint).toBe(reviewedManifest.inventoryFingerprint);
      expect(operatorInput.expectedManifestFingerprint).toBe(reviewedManifest.manifestFingerprint);
      expect(operatorInput.expectedPageFingerprint).toBe(reviewedManifest.pageFingerprint);
      applyCount += 1;
      phase = "APPLIED";
      return applyCount === 2
        ? report("apply", { proposed: 1, idempotent: 1 })
        : report("apply", { proposed: 1, applied: 1 });
    }
    if (mode === "rollback-preview") {
      rollbackPreviewCount += 1;
      if (provenanceCount === 1 && options.driftPreviewBlocked !== false) {
        return report(
          "rollback-preview",
          { proposed: 0, blocked: 1, statusActions: 0 },
          { repair_evidence_invalid: 1 },
        );
      }
      return report("rollback-preview");
    }
    if (mode === "rollback") {
      expect(operatorInput.expectedPageFingerprint).toBe(HASH_C);
      rollbackAttemptCount += 1;
      if (options.failFirstRollback && rollbackAttemptCount === 1) {
        throw new Error("private transient rollback failure");
      }
      phase = "ROLLED_BACK";
      return report("rollback", { rolledBack: 1 });
    }
    throw new Error("unexpected mode");
  }) as unknown as GlobalBenefitCategoryRepairDevelopmentRehearsalDependencies["runOperator"];

  const dependencies = {
    createClient: jest.fn(() => ({ client, disconnect: jest.fn().mockResolvedValue(undefined) })),
    identify: jest.fn().mockResolvedValue({
      host: DEV_HOST,
      database: "private_database",
      schema: "private_schema",
      fingerprint: DEV_IDENTITY,
      branchIdFingerprint: DEV_BRANCH,
    }),
    createRepairDatabase: jest.fn(() => database),
    ensureRepairSchema: jest.fn().mockResolvedValue(undefined),
    selectDefinition: jest.fn().mockResolvedValue(selection),
    createFixture: jest.fn(async (_client, _database, _selection, beforeBootstrapWrite) => {
      await beforeBootstrapWrite();
      return fixture;
    }),
    runOperator,
    verifyAppliedRuntime: options.failRuntime
      ? jest.fn().mockRejectedValue(new Error("private native failure"))
      : jest.fn().mockResolvedValue(1),
    mutateKeeper: jest.fn().mockResolvedValue({
      usedAmount: 11,
      isCompleted: true,
      completedAt: "2040-01-15T12:00:00.000Z",
      isNotUsable: false,
      orderIndex: 23,
      cycleStartDate: "2040-01-01T00:00:00.000Z",
      cycleEndDate: "2040-01-31T23:59:59.999Z",
      occurrenceIndex: 0,
    }),
    readKeeperState: jest.fn().mockResolvedValue({
      usedAmount: 11,
      isCompleted: true,
      completedAt: "2040-01-15T12:00:00.000Z",
      isNotUsable: false,
      orderIndex: 23,
      cycleStartDate: "2040-01-01T00:00:00.000Z",
      cycleEndDate: "2040-01-31T23:59:59.999Z",
      occurrenceIndex: 0,
    }),
    captureRolledBackGraph: jest.fn().mockResolvedValue({ exact: "private graph" }),
    countFixtureStatuses: jest.fn().mockResolvedValue(2),
    insertProvenance: jest.fn(async () => { provenanceCount = 1; }),
    removeProvenance: jest.fn(async () => { provenanceCount = 0; }),
    countProvenance: jest.fn(async () => provenanceCount),
    repairPhase: jest.fn(async () => phase),
    cleanup: jest.fn(async () => options.cleanupResult ?? true),
  } as unknown as GlobalBenefitCategoryRepairDevelopmentRehearsalDependencies;

  return {
    dependencies,
    operatorInputs,
    get applyCount() { return applyCount; },
    get rollbackPreviewCount() { return rollbackPreviewCount; },
  };
}

describe("development category-repair rehearsal target gates", () => {
  it("rejects every target and mode input before constructing a client", async () => {
    const cases = [
      input({ databaseUrlDev: undefined }),
      input({ databaseUrlDev: `postgresql://private:private@${PROD_HOST}/private` }),
      input({ expectedDevelopmentIdentityFingerprint: "not-a-fingerprint" }),
      input({ expectedDevelopmentBranchFingerprint: PROD_BRANCH }),
      input({ rawAmexSyncMode: "preview" }),
      input({ rawAmexSyncMode: "off\n" }),
      input({ recoveryPointVerified: false }),
      input({ confirmation: "wrong" }),
    ];
    for (const invalid of cases) {
      const harness = successfulDependencies();
      await expect(runGlobalBenefitCategoryRepairDevelopmentRehearsal(invalid, harness.dependencies))
        .rejects.toBeInstanceOf(GlobalBenefitCategoryRepairDevelopmentRehearsalError);
      expect(harness.dependencies.createClient).not.toHaveBeenCalled();
    }
  });

  it("accepts only exact private development target inputs", () => {
    expect(validateGlobalBenefitCategoryRepairDevelopmentRehearsalInput(input())).toMatchObject({
      expectedDevelopmentHost: DEV_HOST,
      expectedDevelopmentIdentityFingerprint: DEV_IDENTITY,
      expectedDevelopmentBranchFingerprint: DEV_BRANCH,
    });
    expect(parseDevelopmentCategoryRepairRehearsalArguments([
      "--recovery-point-verified",
      `--confirm=${GLOBAL_BENEFIT_CATEGORY_REPAIR_DEVELOPMENT_REHEARSAL_CONFIRMATION}`,
    ])).toEqual({
      confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_DEVELOPMENT_REHEARSAL_CONFIRMATION,
      recoveryPointVerified: true,
    });
  });

  it("rejects a missing repair schema before creating fixture rows", async () => {
    const harness = successfulDependencies();
    (harness.dependencies.ensureRepairSchema as jest.Mock)
      .mockRejectedValue(new Error("private missing relation"));

    await expect(runGlobalBenefitCategoryRepairDevelopmentRehearsal(input(), harness.dependencies))
      .rejects.toBeInstanceOf(GlobalBenefitCategoryRepairDevelopmentRehearsalError);
    expect(harness.dependencies.ensureRepairSchema).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.selectDefinition).not.toHaveBeenCalled();
    expect(harness.dependencies.createFixture).not.toHaveBeenCalled();
  });

  it("rejects database-side production or changed identities without another client", async () => {
    for (const identity of [{
      host: PROD_HOST,
      database: "private",
      schema: "private",
      fingerprint: DEV_IDENTITY,
      branchIdFingerprint: PROD_BRANCH,
    }, {
      host: DEV_HOST,
      database: "wrong_database",
      schema: "wrong_schema",
      fingerprint: "4".repeat(16),
      branchIdFingerprint: DEV_BRANCH,
    }]) {
      const harness = successfulDependencies();
      (harness.dependencies.identify as jest.Mock).mockResolvedValue(identity);
      await expect(runGlobalBenefitCategoryRepairDevelopmentRehearsal(input(), harness.dependencies))
        .rejects.toBeInstanceOf(GlobalBenefitCategoryRepairDevelopmentRehearsalError);
      expect(harness.dependencies.createClient).toHaveBeenCalledTimes(1);
      expect(harness.dependencies.createFixture).not.toHaveBeenCalled();
    }
  });
});

describe("development category-repair rehearsal orchestration", () => {
  it("runs deterministic review, exact writes, runtime checks, drift close, and cleanup", async () => {
    const harness = successfulDependencies();
    const result = await runGlobalBenefitCategoryRepairDevelopmentRehearsal(input(), harness.dependencies);

    expect(result).toMatchObject({
      completed: true,
      deterministicReviewPassed: true,
      applyPassed: true,
      replayPassed: true,
      runtimeAuthorityPassed: true,
      keeperMutationPassed: true,
      rollbackPassed: true,
      rollbackStatePreserved: true,
      reapplyPassed: true,
      graphDriftBlocked: true,
      provenanceRemoved: true,
      finalRollbackPassed: true,
      finalStateMatched: true,
      cleanupComplete: true,
    });
    expect(result.counts).toMatchObject({ applied: 2, idempotent: 1, rolledBack: 2 });
    expect(harness.applyCount).toBe(3);
    expect(harness.rollbackPreviewCount).toBe(3);
    expect(harness.dependencies.verifyAppliedRuntime).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.mutateKeeper).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.insertProvenance).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.removeProvenance).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.cleanup).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.identify).toHaveBeenCalledTimes(12);
  });

  it("attempts ordinary rollback and exact cleanup after an injected failure", async () => {
    const harness = successfulDependencies({ failRuntime: true });
    await expect(runGlobalBenefitCategoryRepairDevelopmentRehearsal(input(), harness.dependencies))
      .rejects.toMatchObject({ safeReport: expect.objectContaining({ cleanupComplete: true }) });
    expect(harness.dependencies.repairPhase).toHaveBeenCalled();
    expect(harness.dependencies.cleanup).toHaveBeenCalledTimes(1);
    expect(harness.operatorInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ mode: "rollback-preview" }),
      expect.objectContaining({ mode: "rollback" }),
    ]));
  });

  it("uses a fresh rollback preview and ordinary rollback during recovery after a rollback failure", async () => {
    const harness = successfulDependencies({ failFirstRollback: true });

    await expect(runGlobalBenefitCategoryRepairDevelopmentRehearsal(input(), harness.dependencies))
      .rejects.toMatchObject({
        safeReport: expect.objectContaining({
          rollbackPassed: false,
          cleanupComplete: true,
        }),
      });
    expect(harness.dependencies.runOperator).toHaveBeenCalledWith(expect.objectContaining({
      mode: "rollback-preview",
    }));
    expect(harness.dependencies.runOperator).toHaveBeenCalledWith(expect.objectContaining({
      mode: "rollback",
      expectedPageFingerprint: HASH_C,
    }));
    expect(harness.dependencies.cleanup).toHaveBeenCalledTimes(1);
  });

  it("reports cleanup incomplete rather than force-deleting active evidence", async () => {
    const harness = successfulDependencies({ failRuntime: true, driftPreviewBlocked: true });
    (harness.dependencies.runOperator as jest.Mock).mockImplementationOnce(async (value) => {
      await value.onDiscoveryManifest(manifest());
      return report("discover");
    });
    // Preserve the normal operator after the first discover while making recovery
    // preview close; cleanup must not be invoked against APPLIED evidence.
    let calls = 0;
    const original = harness.dependencies.runOperator as jest.Mock;
    original.mockImplementation(async (value: Record<string, unknown>) => {
      calls += 1;
      if (value.mode === "discover") {
        await (value.onDiscoveryManifest as (m: GlobalBenefitCategoryRepairManifest) => Promise<void>)(manifest());
        return report("discover");
      }
      if (value.mode === "dry-run") return report("dry-run");
      if (value.mode === "apply") return calls < 6
        ? report("apply", { applied: 1 })
        : report("apply", { idempotent: 1 });
      if (value.mode === "rollback-preview") {
        return report("rollback-preview", { proposed: 0, blocked: 1, statusActions: 0 }, {
          repair_evidence_invalid: 1,
        });
      }
      return report("rollback");
    });
    (harness.dependencies.repairPhase as jest.Mock).mockResolvedValue("APPLIED");

    await expect(runGlobalBenefitCategoryRepairDevelopmentRehearsal(input(), harness.dependencies))
      .rejects.toMatchObject({ safeReport: expect.objectContaining({ cleanupComplete: false }) });
    expect(harness.dependencies.cleanup).not.toHaveBeenCalled();
  });
});

describe("development category-repair rehearsal report privacy", () => {
  it("serializes only fixed booleans and aggregate counts", () => {
    const reportValue: GlobalBenefitCategoryRepairDevelopmentRehearsalReport = {
      completed: true,
      targetValidated: true,
      prerequisitesPassed: true,
      deterministicReviewPassed: true,
      applyPassed: true,
      replayPassed: true,
      runtimeAuthorityPassed: true,
      keeperMutationPassed: true,
      rollbackPassed: true,
      rollbackStatePreserved: true,
      reapplyPassed: true,
      graphDriftBlocked: true,
      provenanceRemoved: true,
      finalRollbackPassed: true,
      finalStateMatched: true,
      cleanupComplete: true,
      counts: {
        definitionsExamined: 1,
        statusActions: 1,
        applied: 2,
        idempotent: 1,
        rolledBack: 2,
        effectiveStatuses: 1,
        restoredStatuses: 2,
      },
    };
    const serialized = serializeGlobalBenefitCategoryRepairDevelopmentRehearsalReport(reportValue);
    expect(JSON.parse(serialized)).toEqual(reportValue);
    expect(serialized).not.toMatch(/private|example\.invalid|postgres|fingerprint|cursor|manifest|catalogKey|host|email|Id/);
  });

  it("rejects extra report fields", () => {
    const invalid = {
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
        definitionsExamined: 0, statusActions: 0, applied: 0, idempotent: 0,
        rolledBack: 0, effectiveStatuses: 0, restoredStatuses: 0,
      },
      nativeError: "private",
    };
    expect(() => serializeGlobalBenefitCategoryRepairDevelopmentRehearsalReport(invalid as never))
      .toThrow(GlobalBenefitCategoryRepairDevelopmentRehearsalError);
  });
});
