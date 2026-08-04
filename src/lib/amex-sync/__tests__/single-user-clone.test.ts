import { migrationFingerprint } from "@/lib/global-benefit-migration";
import type { UserCloneSnapshot } from "../single-user-clone";
import {
  compareCloneCategoryRepairOccurrences,
  countUserCloneSnapshot,
  planCloneGlobalCatalogRebindings,
  planCloneCategoryRepairRebindings,
  runSingleUserCloneOperator,
  userCloneApplyConfirmation,
  userCloneReplacementConfirmation,
  validateUserCloneSnapshot,
  type CloneCategoryRepairOccurrence,
  type InternalDatabaseIdentity,
  type UserCloneDestinationPort,
  type UserCloneSourcePort,
  type UserCloneTable,
} from "../single-user-clone";

const EMAIL = "owner@example.test";

function identity(kind: "source" | "destination", fingerprint: string = kind): InternalDatabaseIdentity {
  return {
    host: kind === "source"
      ? "ep-falling-butterfly-pooler.us-east-2.aws.neon.tech"
      : "ep-frosty-snowflake-pooler.us-east-2.aws.neon.tech",
    database: "neondb",
    schema: "public",
    fingerprint,
    branchIdFingerprint: `${kind}-branch-fingerprint`,
  };
}

function snapshot(): UserCloneSnapshot {
  return {
    user: { id: "user-source", email: EMAIL, password: null, emailVerified: new Date("2026-01-01T00:00:00Z") } as UserCloneSnapshot["user"],
    creditCards: [{ id: "card-1", userId: "user-source", cardNumber: null }] as UserCloneSnapshot["creditCards"],
    benefits: [
      { id: "benefit-card", creditCardId: "card-1", userId: null },
      { id: "benefit-standalone", creditCardId: null, userId: "user-source" },
    ] as UserCloneSnapshot["benefits"],
    benefitStatuses: [{ id: "status-1", userId: "user-source", benefitId: "benefit-card" }] as UserCloneSnapshot["benefitStatuses"],
    creditCardEvents: [{ id: "event-1", userId: "user-source", creditCardId: "card-1", metadata: { safe: true } }] as unknown as UserCloneSnapshot["creditCardEvents"],
    loyaltyAccounts: [{
      id: "loyalty-1",
      userId: "user-source",
      accountNumber: null,
      loyaltyProgramName: "Invented Rewards",
    }] as UserCloneSnapshot["loyaltyAccounts"],
    loyaltyCertificates: [{ id: "certificate-1", userId: "user-source", loyaltyAccountId: "loyalty-1" }] as UserCloneSnapshot["loyaltyCertificates"],
    externalCardMappings: [{ id: "mapping-1", userId: "user-source", creditCardId: "card-1" }] as UserCloneSnapshot["externalCardMappings"],
    amexSyncAttempts: [{ id: "attempt-1", userId: "user-source" }] as UserCloneSnapshot["amexSyncAttempts"],
    benefitStatusSourceProvenance: [{ id: "provenance-1", benefitStatusId: "status-1", attemptId: "attempt-1" }] as UserCloneSnapshot["benefitStatusSourceProvenance"],
    amexSyncRowAudits: [{
      id: "audit-1",
      attemptId: "attempt-1",
      destinationCardId: "card-1",
      destinationBenefitId: "benefit-card",
      destinationStatusId: "status-1",
    }] as UserCloneSnapshot["amexSyncRowAudits"],
  };
}

const CYCLE_START = new Date("2026-07-01T00:00:00.000Z");
const CYCLE_END = new Date("2026-09-30T23:59:59.999Z");
const CREATED_AT = new Date("2026-06-30T12:00:00.000Z");

function repairStatus(
  id: string,
  benefitId: string | null,
  overrides: Partial<UserCloneSnapshot["benefitStatuses"][number]> = {},
): UserCloneSnapshot["benefitStatuses"][number] {
  return {
    id,
    benefitId,
    userId: "user-source",
    cycleStartDate: CYCLE_START,
    cycleEndDate: CYCLE_END,
    occurrenceIndex: 0,
    usedAmount: 0,
    isCompleted: false,
    completedAt: null,
    isNotUsable: false,
    orderIndex: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  } as UserCloneSnapshot["benefitStatuses"][number];
}

function repairStatusPreimage(
  status: UserCloneSnapshot["benefitStatuses"][number],
  links: { creditCardId: string | null; predefinedBenefitId: string | null },
): Record<string, unknown> {
  const state = {
    id: status.id,
    benefitId: status.benefitId,
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
  };
  return { ...state, ...links, stateFingerprint: migrationFingerprint(state) };
}

function portableRepairJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(portableRepairJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    (key === "predefinedBenefitId" || key === "destinationPredefinedBenefitId") && item !== null
      ? "catalog-bound"
      : portableRepairJson(item),
  ]));
}

function setOccurrenceFingerprints(occurrence: CloneCategoryRepairOccurrence): void {
  const baseline = occurrence.keeperBaseline as {
    status: Record<string, unknown>;
    audits: unknown[];
    provenance: unknown[];
  };
  const keeperSourceKind = occurrence.keeperSource === "LEGACY_CUSTOM" ? "legacy" : "canonical";
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
    keeperBaseline: baseline.status,
    keeperAuditBaseline: baseline.audits,
    keeperProvenanceBaseline: baseline.provenance,
    removedStatusId: occurrence.removedStatusId,
    removedSourceKind: occurrence.removedStatusSource === null
      ? null
      : occurrence.removedStatusSource === "LEGACY_CUSTOM" ? "legacy" : "canonical",
    removedPreimageVersion: occurrence.removedStatusPreimageVersion,
    removedPreimage: occurrence.removedStatusPreimage,
    repairAddedAuditMetadataVersion: occurrence.repairAddedAuditMetadataVersion,
    repairAddedAuditMetadata: occurrence.repairAddedAuditMetadata,
  };
  const portableBaseline = portableRepairJson(baseline.status) as Record<string, unknown>;
  occurrence.postimageFingerprint = migrationFingerprint({
    ...portableBaseline,
    benefitId: keeperSourceKind === "legacy" ? baseline.status.benefitId : null,
    creditCardId: occurrence.creditCardId,
    predefinedBenefitId: "catalog-bound",
    repairAddedAuditMetadata: portableRepairJson(occurrence.repairAddedAuditMetadata),
  });
  occurrence.planFingerprint = migrationFingerprint({
    action: portableRepairJson(actionInput),
    postimageFingerprint: occurrence.postimageFingerprint,
  });
}

function setParentFingerprints(snapshot: UserCloneSnapshot): void {
  for (const repair of snapshot.categoryRepairs ?? []) {
    const occurrences = (snapshot.categoryRepairOccurrences ?? [])
      .filter((occurrence) => occurrence.repairId === repair.id)
      .sort(compareCloneCategoryRepairOccurrences);
    repair.postimageFingerprint = migrationFingerprint({
      sourceBenefitId: repair.legacyBenefitId,
      cardId: repair.creditCardId,
      targetBenefitCatalogKey: repair.targetPredefinedBenefitCatalogKey,
      statusPostimages: occurrences.map((occurrence) => occurrence.postimageFingerprint),
    });
    repair.planFingerprint = migrationFingerprint({
      immutableGraphFingerprint: repair.graphFingerprint,
      currentGraphFingerprint: repair.reviewedCurrentGraphFingerprint,
      destinationFingerprint: repair.destinationFingerprint,
      postimageFingerprint: repair.postimageFingerprint,
      actionFingerprints: occurrences.map((occurrence) => occurrence.planFingerprint),
      stopReasons: [],
    });
  }
}

function categoryRepairSnapshot(phase: "APPLIED" | "ROLLED_BACK"): UserCloneSnapshot {
  const result = snapshot();
  const baselineKeeper = repairStatus("status-keeper", "benefit-card");
  const currentKeeper = repairStatus("status-keeper", "benefit-card", {
    usedAmount: 37,
    isCompleted: true,
    completedAt: new Date("2026-07-15T10:00:00.000Z"),
    updatedAt: new Date("2026-07-15T10:00:00.000Z"),
  });
  const removed = repairStatus("status-removed", null);
  result.benefitStatuses = phase === "APPLIED"
    ? [currentKeeper]
    : [currentKeeper, removed];
  result.benefitStatusSourceProvenance = [];
  result.amexSyncRowAudits = [];
  result.amexSyncAttempts = [];
  result.globalCatalogBindings = {
    cards: [{ creditCardId: "card-1", catalogKey: "catalog-card" }],
    statuses: phase === "APPLIED"
      ? [{ benefitStatusId: "status-keeper", creditCardId: "card-1", catalogKey: "catalog-benefit" }]
      : [{ benefitStatusId: "status-removed", creditCardId: "card-1", catalogKey: "catalog-benefit" }],
    audits: [],
    ledger: [{
      id: "ledger-1",
      legacyBenefitId: "benefit-card",
      userId: "user-source",
      creditCardId: "card-1",
      predefinedCardCatalogKey: null,
      predefinedBenefitCatalogKey: null,
      classification: "CUSTOM",
      phase: "CLASSIFIED",
      sourceFingerprint: "source-fingerprint",
      destinationFingerprint: null,
      classifiedAt: CREATED_AT,
      bridgedAt: null,
      cleanedAt: null,
      rolledBackAt: null,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    }],
  };
  result.categoryRepairs = [{
    id: "repair-1",
    legacyBenefitId: "benefit-card",
    catalogMigrationLedgerId: "ledger-1",
    userId: "user-source",
    creditCardId: "card-1",
    predefinedCardId: "source-global-card",
    predefinedBenefitId: "source-global-benefit",
    resolvedPredefinedCardCatalogKey: "catalog-card",
    resolvedPredefinedBenefitCatalogKey: "catalog-benefit",
    predefinedBenefitParentMatchesCard: true,
    targetPredefinedCardCatalogKey: "catalog-card",
    targetPredefinedBenefitCatalogKey: "catalog-benefit",
    definitionFingerprint: "definition-fingerprint",
    inventoryFingerprint: "inventory-fingerprint",
    graphFingerprint: "graph-fingerprint",
    reviewedCurrentGraphFingerprint: "reviewed-graph-fingerprint",
    destinationFingerprint: "destination-fingerprint",
    manifestFingerprint: "manifest-fingerprint",
    manifestEntryFingerprint: "entry-fingerprint",
    planFingerprint: "plan-fingerprint",
    postimageFingerprint: "postimage-fingerprint",
    evidenceVersion: 1,
    phase,
    appliedAt: CREATED_AT,
    rolledBackAt: phase === "APPLIED" ? null : new Date("2026-07-20T00:00:00.000Z"),
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }];
  result.categoryRepairOccurrences = [{
    id: "occurrence-1",
    repairId: "repair-1",
    userId: "user-source",
    creditCardId: "card-1",
    predefinedBenefitId: "source-global-benefit",
    targetPredefinedBenefitCatalogKey: "catalog-benefit",
    action: "PROMOTE_LEGACY_STATUS",
    keeperSource: "LEGACY_CUSTOM",
    keeperStatusId: "status-keeper",
    cycleStartDate: CYCLE_START,
    cycleEndDate: CYCLE_END,
    occurrenceIndex: 0,
    keeperBaselineVersion: 1,
    keeperBaseline: {
      status: repairStatusPreimage(baselineKeeper, {
        creditCardId: null,
        predefinedBenefitId: null,
      }),
      audits: [],
      provenance: [],
    },
    removedStatusId: "status-removed",
    removedStatusSource: "CANONICAL_STANDARD",
    removedStatusPreimageVersion: 1,
    removedStatusPreimage: repairStatusPreimage(removed, {
      creditCardId: "card-1",
      predefinedBenefitId: "source-global-benefit",
    }),
    removedStatusPreimageIsSqlNull: false,
    removedStatusPreimageJsonType: "object",
    repairAddedAuditMetadataVersion: 1,
    repairAddedAuditMetadata: [],
    planFingerprint: "action-fingerprint",
    postimageFingerprint: "action-postimage-fingerprint",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }];
  setOccurrenceFingerprints(result.categoryRepairOccurrences[0]);
  setParentFingerprints(result);
  result.categoryRepairStateFingerprints = {
    statuses: result.benefitStatuses.map((status) => ({
      id: status.id,
      stateFingerprint: repairStatusPreimage(status, {
        creditCardId: null,
        predefinedBenefitId: null,
      }).stateFingerprint as string,
    })),
    audits: [],
    provenance: [],
  };
  return result;
}

function ports(options: {
  sourceIdentity?: InternalDatabaseIdentity;
  destinationIdentity?: InternalDatabaseIdentity;
  matchCount?: number;
  sourceSnapshot?: UserCloneSnapshot | null;
  destinationUsers?: Array<{ id: string }>;
  collisions?: UserCloneTable[];
  applyError?: Error;
  applyCounts?: ReturnType<typeof countUserCloneSnapshot>;
} = {}) {
  const sourceSnapshot = options.sourceSnapshot === undefined ? snapshot() : options.sourceSnapshot;
  const source: UserCloneSourcePort = {
    identify: jest.fn().mockResolvedValue(options.sourceIdentity ?? identity("source")),
    readAccountSnapshot: jest.fn().mockResolvedValue({
      matchCount: options.matchCount ?? (sourceSnapshot ? 1 : 0),
      snapshot: sourceSnapshot,
    }),
  };
  const apply = options.applyError
    ? jest.fn().mockRejectedValue(options.applyError)
    : options.applyCounts
      ? jest.fn().mockResolvedValue(options.applyCounts)
      : jest.fn().mockImplementation(async ({ snapshot: inputSnapshot }) => countUserCloneSnapshot(inputSnapshot));
  const destination: UserCloneDestinationPort = {
    identify: jest.fn().mockResolvedValue(options.destinationIdentity ?? identity("destination")),
    findUsersByNormalizedEmail: jest.fn().mockResolvedValue(options.destinationUsers ?? []),
    preflight: jest.fn().mockResolvedValue({ blockingCollisionModels: options.collisions ?? [] }),
    apply,
  };
  return { source, destination, apply };
}

describe("single-user production-to-development clone policy", () => {
  it("defaults to dry-run and never invokes the destination transaction", async () => {
    const { source, destination, apply } = ports();
    const report = await runSingleUserCloneOperator({ email: EMAIL, source, destination });
    expect(report.mode).toBe("dry-run");
    expect(report.tables).toEqual(expect.arrayContaining([
      { table: "User", sourceCount: 1, destinationCount: 1 },
      { table: "Benefit", sourceCount: 2, destinationCount: 2 },
    ]));
    expect(apply).not.toHaveBeenCalled();
  });

  it("requires an already-normalized exact email before touching either target", async () => {
    const { source, destination } = ports();
    await expect(runSingleUserCloneOperator({ email: " Owner@Example.test ", source, destination }))
      .rejects.toThrow("already-normalized");
    expect(source.identify).not.toHaveBeenCalled();
  });

  it("rejects target-role mismatch, incomplete branch identity, and same-target identity", async () => {
    const wrong = ports({
      sourceIdentity: { ...identity("source"), host: "ep-other.neon.tech" },
    });
    await expect(runSingleUserCloneOperator({ email: EMAIL, source: wrong.source, destination: wrong.destination }))
      .rejects.toThrow("production target");

    const spoofedSuffix = ports({
      sourceIdentity: {
        ...identity("source"),
        host: "ep-falling-butterfly-pooler.attacker.example",
      },
    });
    await expect(runSingleUserCloneOperator({
      email: EMAIL,
      source: spoofedSuffix.source,
      destination: spoofedSuffix.destination,
    })).rejects.toThrow("production target");

    const missingBranch = ports({
      sourceIdentity: { ...identity("source"), branchIdFingerprint: null },
    });
    await expect(runSingleUserCloneOperator({
      email: EMAIL,
      source: missingBranch.source,
      destination: missingBranch.destination,
    })).rejects.toThrow("incomplete identity");

    const sameFingerprint = ports({
      sourceIdentity: identity("source", "same"),
      destinationIdentity: identity("destination", "same"),
    });
    await expect(runSingleUserCloneOperator({
      email: EMAIL,
      source: sameFingerprint.source,
      destination: sameFingerprint.destination,
    })).rejects.toThrow("same database target");

    const sameBranch = ports({
      sourceIdentity: { ...identity("source"), branchIdFingerprint: "same-branch" },
      destinationIdentity: { ...identity("destination"), branchIdFingerprint: "same-branch" },
    });
    await expect(runSingleUserCloneOperator({
      email: EMAIL,
      source: sameBranch.source,
      destination: sameBranch.destination,
    })).rejects.toThrow("same database target");
  });

  it.each([
    [0, null],
    [2, null],
  ])("requires exactly one source match (count %s)", async (matchCount, sourceSnapshot) => {
    const { source, destination } = ports({ matchCount, sourceSnapshot });
    await expect(runSingleUserCloneOperator({ email: EMAIL, source, destination }))
      .rejects.toThrow("exactly one user");
  });

  it("aborts for an existing destination user unless the separate replacement phrase is exact", async () => {
    const blocked = ports({ destinationUsers: [{ id: "existing-dev-user" }] });
    await expect(runSingleUserCloneOperator({ email: EMAIL, source: blocked.source, destination: blocked.destination }))
      .rejects.toThrow("replacement confirmation");

    const allowed = ports({ destinationUsers: [{ id: "existing-dev-user" }] });
    await expect(runSingleUserCloneOperator({
      email: EMAIL,
      replacementConfirmation: userCloneReplacementConfirmation(EMAIL),
      source: allowed.source,
      destination: allowed.destination,
    })).resolves.toMatchObject({ mode: "dry-run" });
    expect(allowed.destination.preflight).toHaveBeenCalledWith(expect.anything(), "existing-dev-user");
  });

  it("blocks identifier collisions owned outside the replaceable development user", async () => {
    const { source, destination, apply } = ports({ collisions: ["CreditCard"] });
    await expect(runSingleUserCloneOperator({ email: EMAIL, source, destination }))
      .rejects.toThrow("collisions block");
    expect(apply).not.toHaveBeenCalled();
  });

  it("requires both apply gates and propagates transaction rollback failures without a success report", async () => {
    const missingAttestation = ports();
    await expect(runSingleUserCloneOperator({
      email: EMAIL,
      mode: "apply",
      applyConfirmation: userCloneApplyConfirmation(EMAIL),
      source: missingAttestation.source,
      destination: missingAttestation.destination,
    })).rejects.toThrow("target-verification");

    const rollback = ports({ applyError: new Error("synthetic rollback") });
    await expect(runSingleUserCloneOperator({
      email: EMAIL,
      mode: "apply",
      targetVerified: true,
      applyConfirmation: userCloneApplyConfirmation(EMAIL),
      source: rollback.source,
      destination: rollback.destination,
    })).rejects.toThrow("synthetic rollback");
  });

  it("rejects an apply whose post-write destination counts do not match", async () => {
    const mismatched = countUserCloneSnapshot(snapshot());
    mismatched.BenefitStatus = 0;
    const { source, destination } = ports({ applyCounts: mismatched });
    await expect(runSingleUserCloneOperator({
      email: EMAIL,
      mode: "apply",
      targetVerified: true,
      applyConfirmation: userCloneApplyConfirmation(EMAIL),
      source,
      destination,
    })).rejects.toThrow("table counts");
  });

  it("rejects unsanitized fields and cross-user optional audit links", () => {
    const unsafeCard = snapshot();
    (unsafeCard.creditCards[0] as { cardNumber: string | null }).cardNumber = "not-copyable";
    expect(() => validateUserCloneSnapshot(unsafeCard, EMAIL)).toThrow("unsanitized");

    const invalidAudit = snapshot();
    invalidAudit.amexSyncRowAudits[0].destinationStatusId = "foreign-status";
    expect(() => validateUserCloneSnapshot(invalidAudit, EMAIL)).toThrow("audit graph");
  });

  it("accepts a standard status only when its null legacy link has an owned global binding", () => {
    const standard = snapshot();
    standard.benefitStatuses[0].benefitId = null;
    standard.globalCatalogBindings = {
      cards: [],
      statuses: [{
        benefitStatusId: "status-1",
        creditCardId: "card-1",
        catalogKey: "catalog-benefit",
      }],
      audits: [],
      ledger: [],
    };

    expect(() => validateUserCloneSnapshot(standard, EMAIL)).not.toThrow();

    standard.globalCatalogBindings.statuses = [];
    expect(() => validateUserCloneSnapshot(standard, EMAIL)).toThrow("BenefitStatus graph");
  });

  it("rejects an invalid legacy benefit link even when the status also has a global binding", () => {
    const invalidBridge = snapshot();
    invalidBridge.benefitStatuses[0].benefitId = "foreign-benefit";
    invalidBridge.globalCatalogBindings = {
      cards: [],
      statuses: [{
        benefitStatusId: "status-1",
        creditCardId: "card-1",
        catalogKey: "catalog-benefit",
      }],
      audits: [],
      ledger: [],
    };

    expect(() => validateUserCloneSnapshot(invalidBridge, EMAIL)).toThrow("BenefitStatus graph");
  });

  it("returns only target roles and table counts without identity hashes or cloned payloads", async () => {
    const { source, destination } = ports();
    const report = await runSingleUserCloneOperator({ email: EMAIL, source, destination });
    const serialized = JSON.stringify(report);
    expect(Object.keys(report).sort()).toEqual(["mode", "tables", "targets"]);
    for (const forbidden of [
      EMAIL,
      identity("source").host,
      "neondb",
      "fingerprint",
      "branch",
      "password",
      "databaseUrl",
      "username",
      "query",
      "token",
      "metadata",
      "ipAddress",
      "userAgent",
      "lastFourDigits",
      "accountNumber",
      "cardNumber",
      "branch_id",
      "user-source",
      "card-1",
      "benefit-card",
      "attempt-1",
      "safe",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(report.targets).toEqual({
      source: "production",
      destination: "development",
    });
  });
});

describe("single-user clone category-repair evidence validation", () => {
  it("accepts mutable APPLIED keeper state while requiring the removed row to stay absent", () => {
    const applied = categoryRepairSnapshot("APPLIED");
    expect(() => validateUserCloneSnapshot(applied, EMAIL)).not.toThrow();

    const removed = repairStatus("status-removed", null);
    applied.benefitStatuses.push(removed);
    applied.globalCatalogBindings!.statuses.push({
      benefitStatusId: removed.id,
      creditCardId: "card-1",
      catalogKey: "catalog-benefit",
    });
    expect(() => validateUserCloneSnapshot(applied, EMAIL)).toThrow("occurrence evidence");
  });

  it("accepts a ROLLED_BACK restored canonical loser through catalog bindings and rejects state drift", () => {
    const rolledBack = categoryRepairSnapshot("ROLLED_BACK");
    expect(() => validateUserCloneSnapshot(rolledBack, EMAIL)).not.toThrow();

    rolledBack.benefitStatuses.find((status) => status.id === "status-removed")!.usedAmount = 1;
    expect(() => validateUserCloneSnapshot(rolledBack, EMAIL)).toThrow("occurrence evidence");
  });

  it("rejects source global IDs whose stored catalog relationships do not match", () => {
    const wrongCardKey = categoryRepairSnapshot("APPLIED");
    wrongCardKey.categoryRepairs![0].resolvedPredefinedCardCatalogKey = "different-card-key";
    expect(() => validateUserCloneSnapshot(wrongCardKey, EMAIL)).toThrow("parent link");

    const wrongBenefitKey = categoryRepairSnapshot("APPLIED");
    wrongBenefitKey.categoryRepairs![0].resolvedPredefinedBenefitCatalogKey = "different-benefit-key";
    expect(() => validateUserCloneSnapshot(wrongBenefitKey, EMAIL)).toThrow("parent link");

    const crossProduct = categoryRepairSnapshot("APPLIED");
    crossProduct.categoryRepairs![0].predefinedBenefitParentMatchesCard = false;
    expect(() => validateUserCloneSnapshot(crossProduct, EMAIL)).toThrow("parent link");

    const portableFingerprintDrift = categoryRepairSnapshot("APPLIED");
    portableFingerprintDrift.categoryRepairs![0].planFingerprint = "f".repeat(64);
    expect(() => validateUserCloneSnapshot(portableFingerprintDrift, EMAIL))
      .toThrow("portable fingerprints");
  });

  it("cryptographically validates preimages, attachment snapshots, and action fingerprints", () => {
    const preimageTamper = categoryRepairSnapshot("APPLIED");
    const baseline = preimageTamper.categoryRepairOccurrences![0].keeperBaseline as {
      status: { stateFingerprint: string };
    };
    baseline.status.stateFingerprint = "0".repeat(64);
    expect(() => validateUserCloneSnapshot(preimageTamper, EMAIL)).toThrow("occurrence evidence");

    const attachmentTamper = categoryRepairSnapshot("APPLIED");
    const provenance = {
      id: "provenance-repair",
      benefitStatusId: "status-keeper",
      source: "AMEX",
      sourceObservationIdentity: "observation",
      sourceObservationDigest: "digest",
      observedAt: CREATED_AT,
      contractVersion: "contract",
      parserVersion: "parser",
      productKey: "product",
      creditFamilyKey: "family",
      periodKey: "period",
      appliedAt: CREATED_AT,
      attemptId: null,
    } as UserCloneSnapshot["benefitStatusSourceProvenance"][number];
    attachmentTamper.benefitStatusSourceProvenance = [provenance];
    attachmentTamper.categoryRepairStateFingerprints!.provenance = [{
      id: provenance.id,
      stateFingerprint: migrationFingerprint(provenance),
    }];
    const storedProvenance = attachmentTamper.categoryRepairOccurrences![0].keeperBaseline as {
      provenance: Array<{ id: string; ownerId: null; stateFingerprint: string }>;
    };
    storedProvenance.provenance = [{
      id: provenance.id,
      ownerId: null,
      stateFingerprint: migrationFingerprint(provenance),
    }];
    setOccurrenceFingerprints(attachmentTamper.categoryRepairOccurrences![0]);
    setParentFingerprints(attachmentTamper);
    expect(() => validateUserCloneSnapshot(attachmentTamper, EMAIL)).not.toThrow();
    storedProvenance.provenance[0].stateFingerprint = "1".repeat(64);
    setOccurrenceFingerprints(attachmentTamper.categoryRepairOccurrences![0]);
    setParentFingerprints(attachmentTamper);
    expect(() => validateUserCloneSnapshot(attachmentTamper, EMAIL)).toThrow("occurrence evidence");

    const actionTamper = categoryRepairSnapshot("APPLIED");
    actionTamper.categoryRepairOccurrences![0].planFingerprint = "f".repeat(64);
    expect(() => validateUserCloneSnapshot(actionTamper, EMAIL)).toThrow("occurrence evidence");
  });

  it("rejects JSONB null where removed preimage storage must be SQL NULL", () => {
    const jsonNull = categoryRepairSnapshot("APPLIED");
    jsonNull.benefitStatuses = [jsonNull.benefitStatuses[0]];
    jsonNull.globalCatalogBindings!.statuses = [jsonNull.globalCatalogBindings!.statuses[0]];
    const occurrence = jsonNull.categoryRepairOccurrences![0];
    occurrence.removedStatusId = null;
    occurrence.removedStatusSource = null;
    occurrence.removedStatusPreimageVersion = null;
    occurrence.removedStatusPreimage = null;
    occurrence.removedStatusPreimageIsSqlNull = false;
    occurrence.removedStatusPreimageJsonType = "null";
    setOccurrenceFingerprints(occurrence);
    setParentFingerprints(jsonNull);
    expect(() => validateUserCloneSnapshot(jsonNull, EMAIL)).toThrow("occurrence evidence");
  });

  it("rejects incomplete preimages, source-kind mismatches, and colliding occurrence evidence", () => {
    const incomplete = categoryRepairSnapshot("APPLIED");
    delete (incomplete.categoryRepairOccurrences![0].keeperBaseline as {
      status: Record<string, unknown>;
    }).status.stateFingerprint;
    expect(() => validateUserCloneSnapshot(incomplete, EMAIL)).toThrow("occurrence evidence");

    const wrongSource = categoryRepairSnapshot("APPLIED");
    wrongSource.categoryRepairOccurrences![0].removedStatusSource = "LEGACY_CUSTOM";
    expect(() => validateUserCloneSnapshot(wrongSource, EMAIL)).toThrow("occurrence evidence");

    const colliding = categoryRepairSnapshot("APPLIED");
    colliding.categoryRepairOccurrences!.push({
      ...colliding.categoryRepairOccurrences![0],
      id: "occurrence-2",
    });
    expect(() => validateUserCloneSnapshot(colliding, EMAIL)).toThrow("colliding occurrence evidence");
  });

  it("accepts an APPLIED parent with no current occurrence evidence", () => {
    const withoutStatuses = categoryRepairSnapshot("APPLIED");
    withoutStatuses.benefitStatuses = [];
    withoutStatuses.globalCatalogBindings!.statuses = [];
    withoutStatuses.categoryRepairStateFingerprints!.statuses = [];
    withoutStatuses.categoryRepairOccurrences = [];
    setParentFingerprints(withoutStatuses);
    expect(() => validateUserCloneSnapshot(withoutStatuses, EMAIL)).not.toThrow();
  });
});

describe("single-user clone category-repair rebinding", () => {
  const repair = {
    id: 'repair-1',
    legacyBenefitId: 'benefit-card',
    catalogMigrationLedgerId: 'ledger-1',
    userId: 'user-source',
    creditCardId: 'card-1',
    predefinedCardId: 'source-global-card',
    predefinedBenefitId: 'source-global-benefit',
    resolvedPredefinedCardCatalogKey: 'catalog-card',
    resolvedPredefinedBenefitCatalogKey: 'catalog-benefit',
    predefinedBenefitParentMatchesCard: true,
    targetPredefinedCardCatalogKey: 'catalog-card',
    targetPredefinedBenefitCatalogKey: 'catalog-benefit',
    definitionFingerprint: 'definition-fingerprint',
    inventoryFingerprint: 'inventory-fingerprint',
    graphFingerprint: 'graph-fingerprint',
    reviewedCurrentGraphFingerprint: 'reviewed-graph-fingerprint',
    destinationFingerprint: 'destination-fingerprint',
    manifestFingerprint: 'manifest-fingerprint',
    manifestEntryFingerprint: 'entry-fingerprint',
    planFingerprint: 'plan-fingerprint',
    postimageFingerprint: 'postimage-fingerprint',
    evidenceVersion: 1,
    phase: 'APPLIED' as const,
    appliedAt: new Date('2026-08-01T00:00:00.000Z'),
    rolledBackAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
  const occurrence = {
    id: 'occurrence-1',
    repairId: 'repair-1',
    userId: 'user-source',
    creditCardId: 'card-1',
    predefinedBenefitId: 'source-global-benefit',
    targetPredefinedBenefitCatalogKey: 'catalog-benefit',
    action: 'PROMOTE_LEGACY_STATUS' as const,
    keeperSource: 'LEGACY_CUSTOM' as const,
    keeperStatusId: 'status-1',
    cycleStartDate: new Date('2026-07-01T00:00:00.000Z'),
    cycleEndDate: new Date('2026-09-30T23:59:59.999Z'),
    occurrenceIndex: 0,
    keeperBaselineVersion: 1,
    keeperBaseline: { predefinedBenefitId: 'source-global-benefit' },
    removedStatusId: null,
    removedStatusSource: null,
    removedStatusPreimageVersion: null,
    removedStatusPreimage: null,
    removedStatusPreimageIsSqlNull: true,
    removedStatusPreimageJsonType: null,
    repairAddedAuditMetadataVersion: 1,
    repairAddedAuditMetadata: {
      destinationPredefinedBenefitId: 'source-global-benefit',
      nested: [{ predefinedBenefitId: 'source-global-benefit' }],
    },
    planFingerprint: 'plan-fingerprint',
    postimageFingerprint: 'postimage-fingerprint',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
  const destination = {
    cards: [{ id: 'destination-global-card', catalogKey: 'catalog-card' }],
    benefits: [{
      id: 'destination-global-benefit',
      catalogKey: 'catalog-benefit',
      predefinedCardId: 'destination-global-card',
    }],
  };

  it('rebinds parent, occurrence, and versioned JSON evidence by catalog key', () => {
    const plan = planCloneCategoryRepairRebindings([repair], [occurrence], destination);
    expect(plan.repairs[0]).toMatchObject({
      predefinedCardId: 'destination-global-card',
      predefinedBenefitId: 'destination-global-benefit',
      targetPredefinedCardCatalogKey: 'catalog-card',
      targetPredefinedBenefitCatalogKey: 'catalog-benefit',
    });
    expect(plan.occurrences[0]).toMatchObject({
      predefinedBenefitId: 'destination-global-benefit',
      keeperBaseline: { predefinedBenefitId: 'destination-global-benefit' },
      repairAddedAuditMetadata: {
        destinationPredefinedBenefitId: 'destination-global-benefit',
        nested: [{ predefinedBenefitId: 'destination-global-benefit' }],
      },
    });
    expect(JSON.stringify(plan)).not.toContain('source-global-benefit');
  });

  it("orders occurrence evidence by the semantic tuple rather than evidence UUID", () => {
    const laterWithEarlierId = {
      ...occurrence,
      id: "occurrence-a",
      keeperStatusId: "status-later",
      cycleStartDate: new Date("2026-08-01T00:00:00.000Z"),
      cycleEndDate: new Date("2026-08-31T23:59:59.999Z"),
    };
    const earlierWithLaterId = {
      ...occurrence,
      id: "occurrence-z",
      keeperStatusId: "status-earlier",
    };
    const plan = planCloneCategoryRepairRebindings(
      [repair],
      [laterWithEarlierId, earlierWithLaterId],
      destination,
    );
    expect(plan.occurrences.map((row) => row.id)).toEqual(["occurrence-z", "occurrence-a"]);
    expect(compareCloneCategoryRepairOccurrences(
      plan.occurrences[0],
      plan.occurrences[1],
    )).toBeLessThan(0);
  });

  it('rejects unbound JSON IDs and cross-product destination definitions', () => {
    expect(() => planCloneCategoryRepairRebindings([repair], [{
      ...occurrence,
      keeperBaseline: { predefinedBenefitId: 'unreviewed-global-benefit' },
    }], destination)).toThrow('unbound global definition ID');
    expect(() => planCloneCategoryRepairRebindings([repair], [occurrence], {
      ...destination,
      benefits: [{ ...destination.benefits[0], predefinedCardId: 'other-global-card' }],
    })).toThrow('same-product catalog binding');
  });
});

describe("single-user clone global catalog rebinding", () => {
  const bindings = {
    cards: [{ creditCardId: "card-1", catalogKey: "catalog-card" }],
    statuses: [{ benefitStatusId: "status-1", creditCardId: "card-1", catalogKey: "catalog-benefit" }],
    audits: [{ auditId: "audit-1", catalogKey: "catalog-benefit", definitionFingerprint: "definition-fingerprint" }],
    ledger: [{
      id: "ledger-1",
      legacyBenefitId: "benefit-card",
      userId: "user-source",
      creditCardId: "card-1",
      predefinedCardCatalogKey: "catalog-card",
      predefinedBenefitCatalogKey: "catalog-benefit",
      classification: "STANDARD" as const,
      phase: "BRIDGED" as const,
      sourceFingerprint: "source-fingerprint",
      destinationFingerprint: "definition-fingerprint",
      classifiedAt: new Date("2026-01-01T00:00:00Z"),
      bridgedAt: new Date("2026-01-01T00:00:00Z"),
      cleanedAt: null,
      rolledBackAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    }],
  };

  it("rebinds every global relationship by immutable catalog key, never source IDs", () => {
    const plan = planCloneGlobalCatalogRebindings(bindings, {
      cards: [{ id: "destination-card-definition", catalogKey: "catalog-card" }],
      benefits: [{ id: "destination-benefit-definition", catalogKey: "catalog-benefit" }],
    });
    expect(plan.cards).toEqual([{ creditCardId: "card-1", predefinedCardId: "destination-card-definition" }]);
    expect(plan.statuses).toEqual([{
      benefitStatusId: "status-1",
      creditCardId: "card-1",
      predefinedBenefitId: "destination-benefit-definition",
    }]);
    expect(plan.audits[0]).toMatchObject({
      destinationPredefinedBenefitId: "destination-benefit-definition",
      definitionFingerprint: "definition-fingerprint",
    });
    expect(plan.ledger[0]).toMatchObject({
      predefinedCardId: "destination-card-definition",
      predefinedBenefitId: "destination-benefit-definition",
      classification: "STANDARD",
      phase: "BRIDGED",
    });
  });

  it("fails closed when a key is missing or duplicated", () => {
    expect(() => planCloneGlobalCatalogRebindings(bindings, { cards: [], benefits: [] }))
      .toThrow("exact destination catalog-key match");
    expect(() => planCloneGlobalCatalogRebindings(bindings, {
      cards: [
        { id: "one", catalogKey: "catalog-card" },
        { id: "two", catalogKey: "catalog-card" },
      ],
      benefits: [{ id: "benefit", catalogKey: "catalog-benefit" }],
    })).toThrow("not unique");
  });
});
