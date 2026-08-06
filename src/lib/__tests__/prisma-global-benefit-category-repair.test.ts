import type { PrismaClient } from "@/generated/prisma";
import {
  buildGlobalBenefitCategoryRepairManifest,
  discoverGlobalBenefitCategoryRepairs,
  encodeGlobalBenefitCategoryRepairCursor,
  planGlobalBenefitCategoryRepairUnit,
  type CategoryRepairProposal,
  type CategoryRepairStatusAction,
  type GlobalBenefitCategoryRepairManifest,
} from "../global-benefit-category-repair";
import { migrationFingerprint } from "../global-benefit-migration";
import { PrismaGlobalBenefitCategoryRepairDatabase } from "../prisma-global-benefit-category-repair";

const START = new Date("2026-01-01T00:00:00.000Z");
const END = new Date("2026-01-31T23:59:59.999Z");
const CREATED = new Date("2025-12-01T00:00:00.000Z");
const UPDATED = new Date("2025-12-02T00:00:00.000Z");
const INVENTORY = "a".repeat(64);

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join(" ") ?? String(query);
}

function sqlValues(query: unknown): readonly unknown[] {
  return (query as { values?: readonly unknown[] }).values ?? [];
}

interface MutableStatus {
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
}

interface MutableAudit {
  id: string;
  attemptUserId: string;
  destinationCardId: string | null;
  destinationBenefitId: string | null;
  destinationPredefinedBenefitId: string | null;
  destinationStatusId: string | null;
  destinationDefinitionFingerprint: string | null;
  reasonCode: string;
}

interface StoredRepair {
  id: string;
  phase: "APPLIED" | "ROLLED_BACK";
  proposal: CategoryRepairProposal;
  manifest: GlobalBenefitCategoryRepairManifest;
  occurrences: CategoryRepairStatusAction[];
}

function cloneStatus(status: MutableStatus): MutableStatus {
  return {
    ...status,
    cycleStartDate: new Date(status.cycleStartDate),
    cycleEndDate: new Date(status.cycleEndDate),
    completedAt: status.completedAt === null ? null : new Date(status.completedAt),
    createdAt: new Date(status.createdAt),
    updatedAt: new Date(status.updatedAt),
  };
}

function statusJson(status: MutableStatus): object {
  return { ...status };
}

function auditJson(audit: MutableAudit): object {
  return {
    id: audit.id,
    attemptId: "attempt-1",
    sourceRowIdentity: `row:${audit.id}`,
    sourceObservationIdentity: "observation-1",
    observedAt: START,
    contractVersion: "contract-1",
    parserVersion: "parser-1",
    disposition: "UPDATED",
    reasonCode: audit.reasonCode,
    destinationCardId: audit.destinationCardId,
    destinationBenefitId: audit.destinationBenefitId,
    destinationPredefinedBenefitId: audit.destinationPredefinedBenefitId,
    destinationDefinitionFingerprint: audit.destinationDefinitionFingerprint,
    destinationStatusId: audit.destinationStatusId,
    beforeUsedAmount: 0,
    afterUsedAmount: 7,
    beforeIsCompleted: false,
    afterIsCompleted: false,
    beforeCompletedAt: null,
    afterCompletedAt: null,
    beforeIsNotUsable: false,
    afterIsNotUsable: false,
    createdAt: CREATED,
  };
}

function createHarness(options: {
  direction?: "promote" | "retain" | "suppression";
  sibling?: boolean;
  failWriteContaining?: string;
  nativeFailureContaining?: string;
  mutateOnPromote?: boolean;
  mutateOnRestore?: boolean;
  multiOccurrence?: boolean;
  reverseEvidenceRows?: boolean;
} = {}) {
  const direction = options.direction ?? "promote";
  const definition = {
    id: "global-benefit-1",
    catalogKey: "card:benefit-1",
    predefinedCardId: "global-card-1",
    category: "Dining",
    description: "Exact terms except category",
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
  };
  const sources = [{
    id: "legacy-benefit-1",
    category: "Travel",
    description: "Exact terms except category",
    percentage: 100,
    maxAmount: 20,
    frequency: "MONTHLY",
    creditCardId: "owned-card-1",
    userId: null,
    cycleAlignment: "CALENDAR_FIXED",
    fixedCycleStartMonth: 1,
    fixedCycleDurationMonths: 1,
    occurrencesInCycle: 1,
    productKey: null,
    creditFamilyKey: null,
    periodKey: null,
    ledgerId: "ledger-1",
    ledgerUserId: "owner-1",
    ledgerCreditCardId: "owned-card-1",
    ledgerPredefinedCardId: null,
    ledgerPredefinedBenefitId: null,
    ledgerClassification: "CUSTOM" as const,
    ledgerPhase: "CLASSIFIED" as const,
    ledgerSourceFingerprint: "b".repeat(64),
    ledgerDestinationFingerprint: null,
  }];
  if (options.sibling) {
    sources.push({
      ...sources[0],
      id: "legacy-benefit-off-page",
      category: "Entertainment",
      description: "Different source",
      ledgerId: "ledger-off-page",
      ledgerSourceFingerprint: "c".repeat(64),
    });
  }
  const statuses: MutableStatus[] = direction === "suppression" ? [] : [{
    id: "legacy-status-1",
    benefitId: "legacy-benefit-1",
    creditCardId: null,
    predefinedBenefitId: null,
    userId: "owner-1",
    cycleStartDate: START,
    cycleEndDate: END,
    occurrenceIndex: 0,
    usedAmount: direction === "promote" ? 7 : null,
    isCompleted: direction === "promote",
    completedAt: direction === "promote" ? UPDATED : null,
    isNotUsable: false,
    orderIndex: direction === "promote" ? 4 : null,
    createdAt: CREATED,
    updatedAt: UPDATED,
  }, {
    id: "canonical-status-1",
    benefitId: null,
    creditCardId: "owned-card-1",
    predefinedBenefitId: "global-benefit-1",
    userId: "owner-1",
    cycleStartDate: START,
    cycleEndDate: END,
    occurrenceIndex: 0,
    usedAmount: direction === "retain" ? 9 : null,
    isCompleted: false,
    completedAt: null,
    isNotUsable: false,
    orderIndex: direction === "retain" ? 2 : null,
    createdAt: CREATED,
    updatedAt: UPDATED,
  }];
  if (options.multiOccurrence && direction !== "suppression") {
    const secondStart = new Date("2026-02-01T00:00:00.000Z");
    const secondEnd = new Date("2026-02-28T23:59:59.999Z");
    statuses.push({
      ...cloneStatus(statuses[0]),
      id: "legacy-status-2",
      cycleStartDate: secondStart,
      cycleEndDate: secondEnd,
    }, {
      ...cloneStatus(statuses[1]),
      id: "canonical-status-2",
      cycleStartDate: secondStart,
      cycleEndDate: secondEnd,
    });
  }
  const audits: MutableAudit[] = direction === "promote" ? [{
    id: "audit-1",
    attemptUserId: "owner-1",
    destinationCardId: "owned-card-1",
    destinationBenefitId: "legacy-benefit-1",
    destinationPredefinedBenefitId: null,
    destinationStatusId: "legacy-status-1",
    destinationDefinitionFingerprint: null,
    reasonCode: "preserve-me",
  }] : [];
  const provenance: Array<{
    id: string;
    benefitStatusId: string;
    attemptUserId: string | null;
    stateJson: object;
  }> = [];
  let repair: StoredRepair | null = null;
  let inventoryFingerprint = INVENTORY;
  let occupiedRestore = false;
  let authorizedProposal: CategoryRepairProposal | null = null;
  let authorizedManifest: GlobalBenefitCategoryRepairManifest | null = null;
  let failWriteContaining = options.failWriteContaining;
  const operations: string[] = [];

  const sourceRows = () => sources.map((source) => ({ ...source }));
  const repairRows = () => repair ? [{
    id: repair.id,
    legacyBenefitId: repair.proposal.sourceBenefitId,
    catalogMigrationLedgerId: "ledger-1",
    userId: repair.proposal.ownerId,
    creditCardId: repair.proposal.creditCardId,
    predefinedCardId: repair.proposal.predefinedCardId,
    predefinedBenefitId: repair.proposal.predefinedBenefitId,
    targetPredefinedCardCatalogKey: repair.proposal.targetCardCatalogKey,
    targetPredefinedBenefitCatalogKey: repair.proposal.targetBenefitCatalogKey,
    definitionFingerprint: repair.proposal.definitionFingerprint,
    inventoryFingerprint: repair.manifest.inventoryFingerprint,
    graphFingerprint: repair.proposal.immutableGraphFingerprint,
    reviewedCurrentGraphFingerprint: repair.proposal.currentGraphFingerprint,
    destinationFingerprint: repair.proposal.destinationFingerprint,
    manifestFingerprint: repair.manifest.manifestFingerprint,
    manifestEntryFingerprint: repair.manifest.entries[0].entryFingerprint,
    planFingerprint: repair.proposal.planFingerprint,
    postimageFingerprint: repair.proposal.postimageFingerprint,
    evidenceVersion: 1,
    phase: repair.phase,
  }] : [];
  const occurrenceRows = () => {
    const rows = repair?.occurrences.map((action, index) => ({
      id: `occurrence-${index + 1}`,
      repairId: repair!.id,
      userId: action.userId,
      creditCardId: action.creditCardId,
      predefinedBenefitId: action.predefinedBenefitId,
      targetPredefinedBenefitCatalogKey: repair!.proposal.targetBenefitCatalogKey,
      action: action.kind,
      keeperSource: action.keeperSourceKind === "legacy" ? "LEGACY_CUSTOM" : "CANONICAL_STANDARD",
      keeperStatusId: action.keeperStatusId,
      cycleStartDate: new Date(action.cycleStartDate),
      cycleEndDate: new Date(action.cycleEndDate),
      occurrenceIndex: action.occurrenceIndex,
      keeperBaselineVersion: 1,
      keeperBaseline: {
        status: action.keeperBaseline,
        audits: action.keeperAuditBaseline,
        provenance: action.keeperProvenanceBaseline,
      },
      removedStatusId: action.removedStatusId,
      removedStatusSource: action.removedSourceKind === null
        ? null
        : action.removedSourceKind === "legacy" ? "LEGACY_CUSTOM" : "CANONICAL_STANDARD",
      removedStatusPreimageVersion: action.removedPreimageVersion,
      removedStatusPreimage: action.removedPreimage,
      repairAddedAuditMetadataVersion: 1,
      repairAddedAuditMetadata: action.repairAddedAuditMetadata,
      planFingerprint: action.actionFingerprint,
      postimageFingerprint: action.postimageFingerprint,
    })) ?? [];
    return options.reverseEvidenceRows ? rows.reverse() : rows;
  };

  const queryRaw = jest.fn(async (query: unknown) => {
    const text = sqlText(query);
    if (options.nativeFailureContaining && text.includes(options.nativeFailureContaining)) {
      throw new Error("private database host and row id leaked");
    }
    if (text.includes('AS "inventoryFingerprint"')) return [{ inventoryFingerprint }];
    if (text.includes('AS "count"') && text.includes('AS "digest"')) {
      return [{ count: BigInt(0), digest: "a".repeat(64) }];
    }
    if (text.includes("md5('global-benefit-category-repair/v1:'")) {
      return [{ privateKey: "repair:legacy-benefit-1" }];
    }
    if (text.includes("SELECT ('repair:' || l.\"legacyBenefitId\")")
      && text.includes('ORDER BY "privateKey"')) {
      return [{ privateKey: "repair:legacy-benefit-1" }];
    }
    if (text.includes('SELECT b."id", b."creditCardId"')) {
      return [{ id: "legacy-benefit-1", creditCardId: "owned-card-1" }];
    }
    if (text.includes('FROM "CreditCard" c')) {
      return [{ id: "owned-card-1", userId: "owner-1", predefinedCardId: "global-card-1" }];
    }
    if (text.includes('l."id" AS "ledgerId"')) return sourceRows();
    if (text.includes('FROM "PredefinedCard"')) return [{
      id: "global-card-1",
      catalogKey: "card-1",
      name: "Exact Card",
      issuer: "Exact Issuer",
      productKey: "product-1",
      retiredAt: null,
    }];
    if (text.includes('FROM "PredefinedBenefit"')) return [definition];
    if (text.includes('FROM "BenefitStatus" bs') && text.includes('to_jsonb(bs)')) {
      return statuses.map((status) => ({ ...status, stateJson: statusJson(status) }));
    }
    if (text.includes('FROM "AmexSyncRowAudit" r')) {
      return audits.map((audit) => ({ ...audit, stateJson: auditJson(audit) }));
    }
    if (text.includes('FROM "BenefitStatusSourceProvenance" p')) return provenance;
    if (text.includes('FROM "GlobalBenefitCategoryRepair" r')) return repairRows();
    if (text.includes('FROM "GlobalBenefitCategoryRepairOccurrence" o')) return occurrenceRows();
    if (text.includes('AS "idCount"')) return [{
      idCount: occupiedRestore ? BigInt(1) : BigInt(0),
      // A promoted legacy keeper occupies the canonical tuple until rollback
      // clears its repair-added links. The preflight must ignore only that exact
      // keeper while still treating any other tuple occupant as a conflict.
      tupleCount: !occupiedRestore && !text.includes('"id" <>') ? BigInt(1) : BigInt(0),
    }];
    if (text.includes('count(*)::bigint AS "count"')
      && text.includes('GlobalBenefitCategoryRepairOccurrence')) {
      return [{ count: BigInt(repair?.occurrences.length ?? 0) }];
    }
    throw new Error(`Unexpected mocked query: ${text}`);
  });

  const executeRaw = jest.fn(async (query: unknown) => {
    const text = sqlText(query);
    const operation = text.includes('INSERT INTO "GlobalBenefitCategoryRepair"')
      && !text.includes("Occurrence") ? "parent-insert"
      : text.includes('INSERT INTO "GlobalBenefitCategoryRepairOccurrence"') ? "occurrence-insert"
        : text.includes('DELETE FROM "BenefitStatus"') ? "loser-delete"
          : text.includes('INSERT INTO "BenefitStatus"') ? "status-restore"
            : text.includes('UPDATE "BenefitStatus"') && text.includes('SET "creditCardId" = NULL') ? "keeper-clear"
              : text.includes('UPDATE "BenefitStatus"') ? "keeper-promote"
                : text.includes('UPDATE "AmexSyncRowAudit"') && text.includes('SET "destinationPredefinedBenefitId" =')
                  ? "audit-update"
                  : text.includes('UPDATE "GlobalBenefitCategoryRepair"')
                    && text.includes('SET "phase" = \'ROLLED_BACK\'')
                    ? "parent-rollback"
                    : text.includes('UPDATE "GlobalBenefitCategoryRepair"') ? "parent-reapply"
                      : text.includes('DELETE FROM "GlobalBenefitCategoryRepairOccurrence"') ? "occurrence-prune"
                        : "unknown";
    operations.push(operation);
    if (failWriteContaining && text.includes(failWriteContaining)) return 0;
    if (!authorizedProposal || !authorizedManifest) {
      throw new Error(`Write occurred before test authority was installed: ${operation}`);
    }
    if (operation === "parent-insert") {
      repair = {
        id: String(sqlValues(query)[0]),
        phase: "APPLIED",
        proposal: authorizedProposal,
        manifest: authorizedManifest,
        occurrences: [],
      };
      return 1;
    }
    if (operation === "parent-reapply") {
      repair = {
        id: repair?.id ?? "repair-1",
        phase: "APPLIED",
        proposal: authorizedProposal,
        manifest: authorizedManifest,
        occurrences: repair?.occurrences ?? [],
      };
      return 1;
    }
    if (operation === "occurrence-insert") {
      if (!repair) return 0;
      const next = authorizedProposal.actions[repair.occurrences.length];
      if (next) repair.occurrences.push(next);
      else repair.occurrences = [...authorizedProposal.actions];
      return 1;
    }
    if (operation === "occurrence-prune") {
      if (repair) repair.occurrences = [...authorizedProposal.actions];
      return 0;
    }
    if (operation === "loser-delete") {
      const action = authorizedProposal.actions.find((candidate) => candidate.removedStatusId !== null
        && statuses.some((status) => status.id === candidate.removedStatusId));
      const index = statuses.findIndex((status) => status.id === action?.removedStatusId);
      if (index < 0) return 0;
      statuses.splice(index, 1);
      return 1;
    }
    if (operation === "keeper-promote") {
      const action = authorizedProposal.actions.find((candidate) => candidate.kind === "PROMOTE_LEGACY_STATUS"
        && statuses.some((status) => status.id === candidate.keeperStatusId
          && status.creditCardId === null && status.predefinedBenefitId === null));
      const keeper = statuses.find((status) => status.id === action?.keeperStatusId);
      if (!keeper || keeper.creditCardId !== null || keeper.predefinedBenefitId !== null) return 0;
      keeper.creditCardId = "owned-card-1";
      keeper.predefinedBenefitId = "global-benefit-1";
      if (options.mutateOnPromote) keeper.usedAmount = 999;
      return 1;
    }
    if (operation === "keeper-clear") {
      const action = repair?.occurrences.find((candidate) => candidate.kind === "PROMOTE_LEGACY_STATUS");
      const keeper = statuses.find((status) => status.id === action?.keeperStatusId);
      if (!keeper) return 0;
      keeper.creditCardId = null;
      keeper.predefinedBenefitId = null;
      return 1;
    }
    if (operation === "audit-update") {
      const applying = authorizedProposal.intent === "APPLY";
      const patch = (repair?.occurrences ?? authorizedProposal.actions)
        .flatMap((action) => action.repairAddedAuditMetadata)[0];
      const row = audits.find((audit) => audit.id === patch?.auditId);
      if (!row || !patch) return 0;
      const target = applying ? patch.after : patch.before;
      row.destinationPredefinedBenefitId = target.destinationPredefinedBenefitId;
      row.destinationDefinitionFingerprint = target.destinationDefinitionFingerprint;
      return 1;
    }
    if (operation === "status-restore") {
      const action = repair?.occurrences.find((candidate) => candidate.removedPreimage !== null);
      const preimage = action?.removedPreimage;
      if (!action || !preimage) return 0;
      statuses.push({
        id: preimage.id,
        benefitId: action.removedSourceKind === "legacy" ? "legacy-benefit-1" : null,
        creditCardId: action.removedSourceKind === "canonical" ? "owned-card-1" : null,
        predefinedBenefitId: action.removedSourceKind === "canonical" ? "global-benefit-1" : null,
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
      });
      if (options.mutateOnRestore) statuses.at(-1)!.usedAmount = 999;
      return 1;
    }
    if (operation === "parent-rollback") {
      if (!repair || repair.phase !== "APPLIED") return 0;
      repair.phase = "ROLLED_BACK";
      return 1;
    }
    throw new Error(`Unexpected mocked write: ${text}`);
  });

  const transaction = { $queryRaw: queryRaw, $executeRaw: executeRaw };
  const client = {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $transaction: jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => {
      const snapshot = {
        statuses: statuses.map(cloneStatus),
        audits: audits.map((audit) => ({ ...audit })),
        provenance: provenance.map((row) => ({ ...row, stateJson: { ...row.stateJson } })),
        repair: repair === null ? null : {
          ...repair,
          occurrences: [...repair.occurrences],
        },
      };
      try {
        return await callback(transaction);
      } catch (error) {
        statuses.splice(0, statuses.length, ...snapshot.statuses);
        audits.splice(0, audits.length, ...snapshot.audits);
        provenance.splice(0, provenance.length, ...snapshot.provenance);
        repair = snapshot.repair;
        throw error;
      }
    }),
  } as unknown as PrismaClient;
  const adapter = new PrismaGlobalBenefitCategoryRepairDatabase(client);

  return {
    adapter,
    audits,
    statuses,
    operations,
    executeRaw,
    queryRaw,
    get repair() { return repair; },
    set inventory(value: string) { inventoryFingerprint = value; },
    set occupied(value: boolean) { occupiedRestore = value; },
    set failure(value: string | undefined) { failWriteContaining = value; },
    set provenance(value: typeof provenance) {
      provenance.splice(0, provenance.length, ...value);
    },
    authorize(proposal: CategoryRepairProposal, manifest: GlobalBenefitCategoryRepairManifest) {
      authorizedProposal = proposal;
      authorizedManifest = manifest;
    },
  };
}

async function review(harness: ReturnType<typeof createHarness>) {
  const snapshot = await harness.adapter.readBatch({ mode: "discover", afterCursorDigest: null, limit: 1 });
  const discovery = discoverGlobalBenefitCategoryRepairs(
    snapshot.units,
    snapshot.inventoryFingerprint,
    "discover",
  );
  const manifest = buildGlobalBenefitCategoryRepairManifest(discovery);
  const proposal = discovery.proposals[0];
  harness.authorize(proposal, manifest);
  return { snapshot, proposal, manifest };
}

function authority(
  mode: "apply" | "rollback",
  manifest: GlobalBenefitCategoryRepairManifest,
  pageFingerprint = manifest.pageFingerprint,
) {
  return {
    mode,
    inventoryFingerprint: manifest.inventoryFingerprint,
    manifestFingerprint: manifest.manifestFingerprint,
    pageFingerprint,
    afterCursor: null,
    nextCursor: null,
    hasMore: false,
  } as const;
}

describe("Prisma category-repair graph loading", () => {
  it("rejects parity reads before the first database query when target verification is absent", async () => {
    const queryRaw = jest.fn(async () => {
      throw new Error("database read should not occur");
    });
    const adapter = new PrismaGlobalBenefitCategoryRepairDatabase({
      $queryRaw: queryRaw,
      $executeRaw: jest.fn(),
    } as unknown as PrismaClient);
    await expect(adapter.readParitySnapshot({
      targetVerified: false,
      manifests: [],
      scope: null,
    })).rejects.toThrow("target verification");
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("resolves opaque cursors, returns the DB complete inventory, and loads off-page card siblings", async () => {
    const harness = createHarness({ sibling: true });
    const cursor = encodeGlobalBenefitCategoryRepairCursor("repair:previous");
    const result = await harness.adapter.readBatch({
      mode: "discover",
      afterCursorDigest: cursor.slice("gbr1.".length),
      limit: 1,
    });

    expect(result).toMatchObject({ hasMore: false, inventoryFingerprint: INVENTORY });
    expect(result.units).toHaveLength(1);
    expect(result.units[0].cardStrictCustomSources.map((source) => source.id)).toEqual([
      "legacy-benefit-1",
      "legacy-benefit-off-page",
    ]);
    expect(harness.queryRaw.mock.calls.some(([query]) =>
      sqlText(query).includes("md5('global-benefit-category-repair/v1:'"))).toBe(true);
    const inventorySql = harness.queryRaw.mock.calls
      .map(([query]) => sqlText(query))
      .find((text) => text.includes('AS "inventoryFingerprint"'))!;
    expect(inventorySql).toContain("sha256(convert_to");
    expect(inventorySql).toContain("jsonb_agg");
    expect(inventorySql).toContain('l."predefinedCardId" AS "ledgerPredefinedCardId"');
    expect(inventorySql).toContain('l."predefinedBenefitId" AS "ledgerPredefinedBenefitId"');
  });

  it("uses one-row database-side aggregate digests rather than materializing full table rows", async () => {
    const harness = createHarness();
    const reviewed = await review(harness);
    harness.queryRaw.mockClear();
    const result = await harness.adapter.readParitySnapshot({
      targetVerified: true,
      manifests: [reviewed.manifest],
      scope: null,
    });
    expect(result.aggregate.unrelatedRowsDigest).toMatch(/^[a-f0-9]{64}$/);
    const aggregateQueries = harness.queryRaw.mock.calls
      .map(([query]) => sqlText(query))
      .filter((text) => text.includes('AS "count"') && text.includes('AS "digest"'));
    expect(aggregateQueries).toHaveLength(14);
    expect(aggregateQueries.every((text) => !text.includes('SELECT to_jsonb(t) AS value'))).toBe(true);
  });
});

describe("Prisma category-repair apply", () => {
  it("persists complete parent/child evidence before deleting and promotes only relations", async () => {
    const harness = createHarness({ direction: "promote" });
    const { proposal, manifest } = await review(harness);
    const protectedBefore = cloneStatus(harness.statuses.find((status) => status.id === "legacy-status-1")!);

    await expect(harness.adapter.applyRepair(
      proposal,
      manifest.entries[0],
      authority("apply", manifest),
    )).resolves.toEqual({ applied: 1, rolledBack: 0, idempotent: 0 });

    expect(harness.operations.indexOf("parent-insert")).toBeLessThan(harness.operations.indexOf("occurrence-insert"));
    expect(harness.operations.indexOf("occurrence-insert")).toBeLessThan(harness.operations.indexOf("loser-delete"));
    const keeper = harness.statuses.find((status) => status.id === "legacy-status-1")!;
    expect(keeper).toEqual({
      ...protectedBefore,
      creditCardId: "owned-card-1",
      predefinedBenefitId: "global-benefit-1",
    });
    expect(harness.statuses.find((status) => status.id === "canonical-status-1")).toBeUndefined();
    expect(harness.audits[0]).toMatchObject({
      reasonCode: "preserve-me",
      destinationPredefinedBenefitId: "global-benefit-1",
      destinationDefinitionFingerprint: proposal.definitionFingerprint,
    });
    expect(harness.repair).toMatchObject({ phase: "APPLIED", occurrences: [
      expect.objectContaining({ keeperStatusId: "legacy-status-1", removedStatusId: "canonical-status-1" }),
    ] });
  });

  it("retains a history-bearing canonical keeper and supports suppression-only evidence", async () => {
    const retained = createHarness({ direction: "retain" });
    const retainedReview = await review(retained);
    expect(retainedReview.proposal.actions[0]).toMatchObject({
      kind: "RETAIN_CANONICAL_STATUS",
      keeperStatusId: "canonical-status-1",
      removedStatusId: "legacy-status-1",
    });
    await retained.adapter.applyRepair(
      retainedReview.proposal,
      retainedReview.manifest.entries[0],
      authority("apply", retainedReview.manifest),
    );
    expect(retained.statuses).toEqual([
      expect.objectContaining({ id: "canonical-status-1", usedAmount: 9, updatedAt: UPDATED }),
    ]);
    expect(retained.operations).not.toContain("keeper-promote");

    const suppression = createHarness({ direction: "suppression" });
    const suppressionReview = await review(suppression);
    expect(suppressionReview.proposal.actions).toEqual([]);
    await suppression.adapter.applyRepair(
      suppressionReview.proposal,
      suppressionReview.manifest.entries[0],
      authority("apply", suppressionReview.manifest),
    );
    expect(suppression.repair).toMatchObject({ phase: "APPLIED", occurrences: [] });
    expect(suppression.operations).not.toContain("loser-delete");
  });

  it("reconstructs multi-occurrence evidence in semantic order instead of random row-ID order", async () => {
    const harness = createHarness({ multiOccurrence: true, reverseEvidenceRows: true });
    const reviewed = await review(harness);
    expect(reviewed.proposal.actions.map((action) => action.keeperStatusId)).toEqual([
      "legacy-status-1",
      "legacy-status-2",
    ]);

    await expect(harness.adapter.applyRepair(
      reviewed.proposal,
      reviewed.manifest.entries[0],
      authority("apply", reviewed.manifest),
    )).resolves.toEqual({ applied: 1, rolledBack: 0, idempotent: 0 });

    const current = await harness.adapter.readBatch({ mode: "apply", afterCursorDigest: null, limit: 1 });
    const replay = planGlobalBenefitCategoryRepairUnit(current.units[0], "apply");
    expect(replay).toMatchObject({ blocked: false, intent: "APPLY_REPLAY" });
    expect(current.units[0].repairEvidence?.occurrences.map((action) => action.keeperStatusId)).toEqual([
      "legacy-status-1",
      "legacy-status-2",
    ]);
  });

  it("replays exact APPLIED evidence without any write", async () => {
    const harness = createHarness();
    const reviewed = await review(harness);
    await harness.adapter.applyRepair(
      reviewed.proposal,
      reviewed.manifest.entries[0],
      authority("apply", reviewed.manifest),
    );
    harness.executeRaw.mockClear();
    const current = await harness.adapter.readBatch({ mode: "apply", afterCursorDigest: null, limit: 1 });
    const replay = planGlobalBenefitCategoryRepairUnit(current.units[0], "apply");

    await expect(harness.adapter.applyRepair(
      replay,
      reviewed.manifest.entries[0],
      authority("apply", reviewed.manifest),
    )).resolves.toEqual({ applied: 0, rolledBack: 0, idempotent: 1 });
    expect(harness.executeRaw).not.toHaveBeenCalled();
  });

  it.each([
    ['INSERT INTO "GlobalBenefitCategoryRepair" (', "parent evidence"],
    ['INSERT INTO "GlobalBenefitCategoryRepairOccurrence"', "occurrence evidence"],
    ['DELETE FROM "BenefitStatus"', "loser compare-and-set"],
    ['UPDATE "BenefitStatus"', "keeper compare-and-set"],
    ['UPDATE "AmexSyncRowAudit"', "audit compare-and-set"],
  ])("rolls back the complete apply when %s fails", async (failure, message) => {
    const harness = createHarness({ failWriteContaining: failure });
    const reviewed = await review(harness);
    await expect(harness.adapter.applyRepair(
      reviewed.proposal,
      reviewed.manifest.entries[0],
      authority("apply", reviewed.manifest),
    )).rejects.toThrow(message);
    expect(harness.repair).toBeNull();
    expect(harness.statuses).toHaveLength(2);
    expect(harness.statuses.find((status) => status.id === "legacy-status-1")).toMatchObject({
      creditCardId: null,
      predefinedBenefitId: null,
      usedAmount: 7,
      updatedAt: UPDATED,
    });
  });

  it("rolls back protected-state postimage drift and sanitizes native errors", async () => {
    const postimage = createHarness({ mutateOnPromote: true });
    const reviewed = await review(postimage);
    await expect(postimage.adapter.applyRepair(
      reviewed.proposal,
      reviewed.manifest.entries[0],
      authority("apply", reviewed.manifest),
    )).rejects.toThrow("protected-state verification");
    expect(postimage.repair).toBeNull();
    expect(postimage.statuses.find((status) => status.id === "legacy-status-1")?.usedAmount).toBe(7);

    const native = createHarness({ nativeFailureContaining: 'FROM "PredefinedCard"' });
    await expect(native.adapter.readBatch({ mode: "discover", afterCursorDigest: null, limit: 1 }))
      .rejects.toThrow("failed safely");
    await expect(native.adapter.readBatch({ mode: "discover", afterCursorDigest: null, limit: 1 }))
      .rejects.not.toThrow("private database host");
  });
});

describe("Prisma category-repair rollback and reapply", () => {
  async function appliedHarness(
    direction: "promote" | "retain" = "promote",
    options: { mutateOnRestore?: boolean } = {},
  ) {
    const harness = createHarness({ direction, ...options });
    const reviewed = await review(harness);
    await harness.adapter.applyRepair(
      reviewed.proposal,
      reviewed.manifest.entries[0],
      authority("apply", reviewed.manifest),
    );
    return { harness, ...reviewed };
  }

  it("preserves current keeper state, reverses exact audit metadata, restores by catalog binding, and replays", async () => {
    const { harness, manifest } = await appliedHarness("promote");
    const keeper = harness.statuses.find((status) => status.id === "legacy-status-1")!;
    keeper.usedAmount = 3;
    keeper.isCompleted = false;
    keeper.completedAt = null;
    keeper.isNotUsable = true;
    keeper.orderIndex = 8;
    keeper.updatedAt = new Date("2026-02-02T10:00:00.000Z");
    const mutableBefore = cloneStatus(keeper);
    const current = await harness.adapter.readBatch({ mode: "rollback", afterCursorDigest: null, limit: 1 });
    const rollback = planGlobalBenefitCategoryRepairUnit(current.units[0], "rollback");
    harness.authorize(rollback, manifest);

    await expect(harness.adapter.rollbackRepair(
      rollback,
      manifest.entries[0],
      authority("rollback", manifest),
    )).resolves.toEqual({ applied: 0, rolledBack: 1, idempotent: 0 });

    expect(harness.statuses.find((status) => status.id === "legacy-status-1")).toEqual({
      ...mutableBefore,
      creditCardId: null,
      predefinedBenefitId: null,
    });
    expect(harness.statuses.find((status) => status.id === "canonical-status-1")).toMatchObject({
      benefitId: null,
      creditCardId: "owned-card-1",
      predefinedBenefitId: "global-benefit-1",
      createdAt: CREATED,
      updatedAt: UPDATED,
    });
    expect(harness.audits[0]).toMatchObject({
      reasonCode: "preserve-me",
      destinationPredefinedBenefitId: null,
      destinationDefinitionFingerprint: null,
    });
    expect(harness.repair?.phase).toBe("ROLLED_BACK");
    const restoreSlotQuery = harness.queryRaw.mock.calls
      .map(([query]) => query)
      .find((query) => sqlText(query).includes('AS "idCount"'));
    expect(sqlText(restoreSlotQuery)).toContain('"id" <>');
    expect(sqlValues(restoreSlotQuery)).toContain("legacy-status-1");

    harness.executeRaw.mockClear();
    const replaySnapshot = await harness.adapter.readBatch({ mode: "rollback", afterCursorDigest: null, limit: 1 });
    const replay = planGlobalBenefitCategoryRepairUnit(replaySnapshot.units[0], "rollback");
    harness.authorize(replay, manifest);
    await expect(harness.adapter.rollbackRepair(
      replay,
      manifest.entries[0],
      authority("rollback", manifest),
    )).resolves.toEqual({ applied: 0, rolledBack: 0, idempotent: 1 });
    expect(harness.executeRaw).not.toHaveBeenCalled();
  });

  it("ignores unrelated inventory drift during rollback but stops occupied restore identity atomically", async () => {
    const unrelated = await appliedHarness();
    unrelated.harness.inventory = "f".repeat(64);
    unrelated.harness.queryRaw.mockClear();
    const snapshot = await unrelated.harness.adapter.readBatch({ mode: "rollback", afterCursorDigest: null, limit: 1 });
    const rollback = planGlobalBenefitCategoryRepairUnit(snapshot.units[0], "rollback");
    unrelated.harness.authorize(rollback, unrelated.manifest);
    unrelated.harness.queryRaw.mockClear();
    await unrelated.harness.adapter.rollbackRepair(
      rollback,
      unrelated.manifest.entries[0],
      authority("rollback", unrelated.manifest),
    );
    expect(unrelated.harness.queryRaw.mock.calls
      .map(([query]) => sqlText(query))
      .some((text) => text.includes('AS "inventoryFingerprint"'))).toBe(false);

    const occupied = await appliedHarness();
    occupied.harness.occupied = true;
    const occupiedSnapshot = await occupied.harness.adapter.readBatch({ mode: "rollback", afterCursorDigest: null, limit: 1 });
    const occupiedRollback = planGlobalBenefitCategoryRepairUnit(occupiedSnapshot.units[0], "rollback");
    occupied.harness.authorize(occupiedRollback, occupied.manifest);
    await expect(occupied.harness.adapter.rollbackRepair(
      occupiedRollback,
      occupied.manifest.entries[0],
      authority("rollback", occupied.manifest),
    )).rejects.toThrow("restore identity is occupied");
    expect(occupied.harness.repair?.phase).toBe("APPLIED");
    expect(occupied.harness.statuses.find((status) => status.id === "canonical-status-1")).toBeUndefined();
  });

  it.each([
    ['UPDATE "AmexSyncRowAudit"', "rollback audit compare-and-set"],
    ['UPDATE "BenefitStatus"', "rollback keeper compare-and-set"],
    ['INSERT INTO "BenefitStatus"', "rollback status restore"],
    ['SET "phase" = \'ROLLED_BACK\'', "Rollback parent compare-and-set"],
  ])("rolls back the complete rollback when %s fails", async (failure, message) => {
    const { harness, manifest } = await appliedHarness();
    const current = await harness.adapter.readBatch({ mode: "rollback", afterCursorDigest: null, limit: 1 });
    const rollback = planGlobalBenefitCategoryRepairUnit(current.units[0], "rollback");
    harness.authorize(rollback, manifest);
    harness.failure = failure;
    await expect(harness.adapter.rollbackRepair(
      rollback,
      manifest.entries[0],
      authority("rollback", manifest),
    )).rejects.toThrow(message);
    expect(harness.repair?.phase).toBe("APPLIED");
    expect(harness.statuses.find((status) => status.id === "canonical-status-1")).toBeUndefined();
    expect(harness.statuses.find((status) => status.id === "legacy-status-1")).toMatchObject({
      creditCardId: "owned-card-1",
      predefinedBenefitId: "global-benefit-1",
    });
  });

  it("rolls back a malformed restored-row postimage atomically", async () => {
    const { harness, manifest } = await appliedHarness("promote", { mutateOnRestore: true });
    const current = await harness.adapter.readBatch({ mode: "rollback", afterCursorDigest: null, limit: 1 });
    const rollback = planGlobalBenefitCategoryRepairUnit(current.units[0], "rollback");
    harness.authorize(rollback, manifest);
    await expect(harness.adapter.rollbackRepair(
      rollback,
      manifest.entries[0],
      authority("rollback", manifest),
    )).rejects.toThrow("relation postimage verification");
    expect(harness.repair?.phase).toBe("APPLIED");
    expect(harness.statuses.find((status) => status.id === "canonical-status-1")).toBeUndefined();
  });

  it.each([
    ["keeper cycle", (harness: ReturnType<typeof createHarness>) => {
      harness.statuses[0].cycleEndDate = new Date("2026-02-01T23:59:59.999Z");
    }],
    ["attachment/provenance", (harness: ReturnType<typeof createHarness>) => {
      harness.provenance = [{
        id: "new-provenance",
        benefitStatusId: "legacy-status-1",
        attemptUserId: "owner-1",
        stateJson: { id: "new-provenance", source: "AMEX" },
      }];
    }],
    ["AMEX audit activity", (harness: ReturnType<typeof createHarness>) => {
      harness.audits[0].reasonCode = "later-amex-write";
    }],
  ] as const)("stops %s drift before rollback writes", async (_label, mutate) => {
    const { harness, manifest } = await appliedHarness();
    mutate(harness);
    const current = await harness.adapter.readBatch({ mode: "rollback", afterCursorDigest: null, limit: 1 });
    const rollback = planGlobalBenefitCategoryRepairUnit(current.units[0], "rollback");
    expect(rollback.blocked).toBe(true);
    expect(harness.repair?.phase).toBe("APPLIED");
    expect(() => harness.authorize(rollback, manifest)).not.toThrow();
  });

  it("stops new source-only AMEX audit activity through the reviewed graph binding", async () => {
    const { harness, manifest } = await appliedHarness();
    harness.audits.push({
      id: "later-source-audit",
      attemptUserId: "owner-1",
      destinationCardId: "owned-card-1",
      destinationBenefitId: "legacy-benefit-1",
      destinationPredefinedBenefitId: null,
      destinationStatusId: null,
      destinationDefinitionFingerprint: null,
      reasonCode: "later-source-activity",
    });
    const current = await harness.adapter.readBatch({ mode: "rollback", afterCursorDigest: null, limit: 1 });
    const rollback = planGlobalBenefitCategoryRepairUnit(current.units[0], "rollback");
    expect(rollback.blocked).toBe(false);
    harness.authorize(rollback, manifest);
    await expect(harness.adapter.rollbackRepair(
      rollback,
      manifest.entries[0],
      authority("rollback", manifest),
    )).rejects.toThrow("source, attachment, or reviewed graph evidence changed");
    expect(harness.repair?.phase).toBe("APPLIED");
  });

  it("reapplies ROLLED_BACK evidence from a fresh reviewed current plan", async () => {
    const { harness, manifest } = await appliedHarness();
    const applied = await harness.adapter.readBatch({ mode: "rollback", afterCursorDigest: null, limit: 1 });
    const rollback = planGlobalBenefitCategoryRepairUnit(applied.units[0], "rollback");
    harness.authorize(rollback, manifest);
    await harness.adapter.rollbackRepair(
      rollback,
      manifest.entries[0],
      authority("rollback", manifest),
    );

    const rolledBack = await harness.adapter.readBatch({ mode: "discover", afterCursorDigest: null, limit: 1 });
    const freshDiscovery = discoverGlobalBenefitCategoryRepairs(
      rolledBack.units,
      rolledBack.inventoryFingerprint,
      "discover",
    );
    const freshManifest = buildGlobalBenefitCategoryRepairManifest(freshDiscovery);
    const reapply = planGlobalBenefitCategoryRepairUnit(rolledBack.units[0], "apply");
    expect(reapply).toMatchObject({ intent: "APPLY", blocked: false });
    harness.authorize(reapply, freshManifest);
    await expect(harness.adapter.applyRepair(
      reapply,
      freshManifest.entries[0],
      authority("apply", freshManifest),
    )).resolves.toEqual({ applied: 1, rolledBack: 0, idempotent: 0 });
    expect(harness.operations).toContain("parent-reapply");
    expect(harness.repair?.phase).toBe("APPLIED");
  });
});

describe("adapter authority validation", () => {
  it("rejects manifest, catalog, and page authority mismatches before transaction writes", async () => {
    const harness = createHarness();
    const reviewed = await review(harness);
    const badEntry = { ...reviewed.manifest.entries[0], targetBenefitCatalogKey: "wrong" };
    await expect(harness.adapter.applyRepair(
      reviewed.proposal,
      badEntry,
      authority("apply", reviewed.manifest),
    )).rejects.toThrow("reviewed repair authority");
    expect(harness.executeRaw).not.toHaveBeenCalled();

    const reviewedEntry = reviewed.manifest.entries[0];
    const { entryFingerprint: _entryFingerprint, ...entryBody } = reviewedEntry;
    void _entryFingerprint;
    const staleBody = {
      ...entryBody,
      currentGraphFingerprint: migrationFingerprint("stale-reviewed-graph"),
    };
    const staleEntry = {
      ...staleBody,
      entryFingerprint: migrationFingerprint(staleBody),
    };
    harness.queryRaw.mockClear();
    await expect(harness.adapter.applyRepair(
      reviewed.proposal,
      staleEntry,
      authority("apply", reviewed.manifest),
    )).rejects.toThrow("reviewed repair authority");
    expect(harness.queryRaw).not.toHaveBeenCalled();

    const tamperedProposal = {
      ...reviewed.proposal,
      currentGraphFingerprint: migrationFingerprint("changed"),
    };
    harness.authorize(tamperedProposal, reviewed.manifest);
    await expect(harness.adapter.applyRepair(
      tamperedProposal,
      reviewed.manifest.entries[0],
      authority("apply", reviewed.manifest, "d".repeat(64)),
    )).rejects.toThrow();
    expect(harness.repair).toBeNull();
  });
});
