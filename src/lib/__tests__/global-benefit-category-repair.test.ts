import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION,
  GLOBAL_BENEFIT_CATEGORY_REPAIR_ROLLBACK_CONFIRMATION,
  buildGlobalBenefitCategoryRepairManifest,
  categoryRepairInventoryFingerprint,
  categoryRepairManifestEntryFingerprint,
  categoryRepairManifestFingerprint,
  categoryRepairPageFingerprint,
  classifyCategoryRepairStatusState,
  decodeGlobalBenefitCategoryRepairCursor,
  discoverGlobalBenefitCategoryRepairs,
  encodeGlobalBenefitCategoryRepairCursor,
  planCategoryRepairStatusActions,
  planGlobalBenefitCategoryRepairUnit,
  runGlobalBenefitCategoryRepairOperator as runRawGlobalBenefitCategoryRepairOperator,
  validateGlobalBenefitCategoryRepairManifest,
  type CategoryRepairAuditSnapshot,
  type CategoryRepairBatchSnapshot,
  type CategoryRepairEvidenceSnapshot,
  type CategoryRepairLegacyBenefitSnapshot,
  type CategoryRepairProposal,
  type CategoryRepairStatusSnapshot,
  type CategoryRepairUnitSnapshot,
  type CategoryRepairWriteResult,
  type GlobalBenefitCategoryRepairDatabase,
  type GlobalBenefitCategoryRepairManifest,
} from "../global-benefit-category-repair";
import {
  aggregateGlobalBenefitCategoryRepairReport,
  parseGlobalBenefitCategoryRepairArguments,
  writeGlobalBenefitCategoryRepairManifest,
} from "../../../scripts/repair-global-benefit-categories";
import {
  classifyLegacyMigrationUnit,
  legacyBenefitSourceFingerprint,
  migrationFingerprint,
  type GlobalBenefitDefinition,
  type GlobalCardDefinition,
  type LegacyAuditRelation,
} from "../global-benefit-migration";

const START = new Date("2026-01-01T00:00:00.000Z");
const END = new Date("2026-01-31T23:59:59.999Z");
const CREATED = new Date("2025-12-01T00:00:00.000Z");
const UPDATED = new Date("2025-12-02T00:00:00.000Z");

function runGlobalBenefitCategoryRepairOperator(
  input: Parameters<typeof runRawGlobalBenefitCategoryRepairOperator>[0],
): ReturnType<typeof runRawGlobalBenefitCategoryRepairOperator> {
  return runRawGlobalBenefitCategoryRepairOperator({ targetVerified: true, ...input });
}

function definition(overrides: Partial<GlobalBenefitDefinition> = {}): GlobalBenefitDefinition {
  return {
    id: "global-benefit-1",
    catalogKey: "card:benefit-1",
    predefinedCardId: "global-card-1",
    category: "Dining",
    description: "Exact terms except historical category",
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
    ...overrides,
  };
}

function predefinedCard(
  benefits: GlobalBenefitDefinition[] = [definition()],
  overrides: Partial<GlobalCardDefinition> = {},
): GlobalCardDefinition {
  return {
    id: "global-card-1",
    catalogKey: "card-1",
    name: "Exact Card",
    issuer: "Exact Issuer",
    productKey: "product-1",
    retiredAt: null,
    benefits,
    ...overrides,
  };
}

function attachment(id: string, ownerId = "owner-1") {
  return { id, ownerId, stateFingerprint: migrationFingerprint({ id }) };
}

function audit(
  id: string,
  overrides: Partial<CategoryRepairAuditSnapshot> = {},
): CategoryRepairAuditSnapshot {
  return {
    ...attachment(id),
    destinationCardId: "owned-card-1",
    destinationBenefitId: "legacy-benefit-1",
    destinationStatusId: "legacy-status-1",
    destinationPredefinedBenefitId: null,
    destinationDefinitionFingerprint: null,
    ...overrides,
  };
}

function status(
  source: "legacy" | "canonical",
  overrides: Partial<CategoryRepairStatusSnapshot> = {},
): CategoryRepairStatusSnapshot {
  return {
    id: source === "legacy" ? "legacy-status-1" : "canonical-status-1",
    benefitId: source === "legacy" ? "legacy-benefit-1" : null,
    creditCardId: source === "canonical" ? "owned-card-1" : null,
    predefinedBenefitId: source === "canonical" ? "global-benefit-1" : null,
    userId: "owner-1",
    cycleStartDate: START,
    cycleEndDate: END,
    occurrenceIndex: 0,
    usedAmount: null,
    isCompleted: false,
    completedAt: null,
    isNotUsable: false,
    orderIndex: null,
    createdAt: CREATED,
    updatedAt: UPDATED,
    stateFingerprint: "preserved-status-state",
    audits: [],
    provenance: [],
    ...overrides,
  };
}

function sourceBenefit(
  overrides: Partial<CategoryRepairLegacyBenefitSnapshot> = {},
): CategoryRepairLegacyBenefitSnapshot {
  const source: CategoryRepairLegacyBenefitSnapshot = {
    id: "legacy-benefit-1",
    creditCardId: "owned-card-1",
    userId: null,
    category: "Travel",
    description: "Exact terms except historical category",
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
    statuses: [status("legacy")],
    audits: [],
    provenance: [],
    ledger: null,
    ...overrides,
  };
  if (overrides.ledger === undefined) {
    source.ledger = {
      legacyBenefitId: source.id,
      userId: "owner-1",
      creditCardId: "owned-card-1",
      predefinedCardId: null,
      predefinedBenefitId: null,
      classification: "CUSTOM",
      phase: "CLASSIFIED",
      sourceFingerprint: legacyBenefitSourceFingerprint(source),
      destinationFingerprint: null,
    };
  }
  return source;
}

function unit(overrides: Partial<CategoryRepairUnitSnapshot> = {}): CategoryRepairUnitSnapshot {
  const source = overrides.source ?? sourceBenefit();
  const cardStrictCustomSources = overrides.cardStrictCustomSources;
  const remainingOverrides = { ...overrides };
  delete remainingOverrides.source;
  delete remainingOverrides.cardStrictCustomSources;
  return {
    privateKey: "repair:legacy-benefit-1",
    card: {
      id: "owned-card-1",
      userId: "owner-1",
      predefinedCardId: "global-card-1",
    },
    predefinedCard: predefinedCard(),
    destinationStatuses: [status("canonical")],
    repairEvidence: null,
    ...remainingOverrides,
    source,
    cardStrictCustomSources: cardStrictCustomSources ?? [source],
  };
}

function writeResult(overrides: Partial<CategoryRepairWriteResult> = {}): CategoryRepairWriteResult {
  return { applied: 0, rolledBack: 0, idempotent: 0, ...overrides };
}

function database(snapshot: CategoryRepairBatchSnapshot): GlobalBenefitCategoryRepairDatabase {
  return {
    readBatch: jest.fn().mockResolvedValue(snapshot),
    applyRepair: jest.fn().mockResolvedValue(writeResult({ applied: 1 })),
    rollbackRepair: jest.fn().mockResolvedValue(writeResult({ rolledBack: 1 })),
  };
}

function snapshot(
  units = [unit()],
  overrides: Partial<CategoryRepairBatchSnapshot> = {},
): CategoryRepairBatchSnapshot {
  return {
    units,
    hasMore: false,
    inventoryFingerprint: categoryRepairInventoryFingerprint(units),
    ...overrides,
  };
}

function discoveryManifest(current: CategoryRepairBatchSnapshot): GlobalBenefitCategoryRepairManifest {
  const discovery = discoverGlobalBenefitCategoryRepairs(
    current.units,
    current.inventoryFingerprint,
    "discover",
  );
  const last = current.units.at(-1);
  return buildGlobalBenefitCategoryRepairManifest(discovery, {
    hasMore: current.hasMore,
    nextCursor: current.hasMore && last
      ? encodeGlobalBenefitCategoryRepairCursor(last.privateKey)
      : null,
  });
}

function evidenceFrom(
  proposal: CategoryRepairProposal,
  manifest: GlobalBenefitCategoryRepairManifest,
  phase: "APPLIED" | "ROLLED_BACK" = "APPLIED",
): CategoryRepairEvidenceSnapshot {
  const entry = manifest.entries[0];
  return {
    repairId: "repair-evidence-1",
    phase,
    evidenceVersion: 1,
    sourceBenefitId: proposal.sourceBenefitId,
    ownerId: proposal.ownerId,
    creditCardId: proposal.creditCardId,
    predefinedCardId: proposal.predefinedCardId,
    predefinedBenefitId: proposal.predefinedBenefitId!,
    targetCardCatalogKey: proposal.targetCardCatalogKey!,
    targetBenefitCatalogKey: proposal.targetBenefitCatalogKey!,
    definitionFingerprint: proposal.definitionFingerprint!,
    inventoryFingerprint: manifest.inventoryFingerprint,
    immutableGraphFingerprint: proposal.immutableGraphFingerprint,
    reviewedCurrentGraphFingerprint: proposal.currentGraphFingerprint,
    destinationFingerprint: proposal.destinationFingerprint!,
    manifestFingerprint: manifest.manifestFingerprint,
    manifestEntryFingerprint: entry.entryFingerprint,
    planFingerprint: proposal.planFingerprint,
    postimageFingerprint: proposal.postimageFingerprint,
    occurrences: proposal.actions,
  };
}

function patchedAudits(
  baseline: CategoryRepairAuditSnapshot[],
  proposal: CategoryRepairProposal,
): CategoryRepairAuditSnapshot[] {
  const patches = proposal.actions.flatMap((action) => action.repairAddedAuditMetadata);
  return baseline.map((value) => {
    const patch = patches.find((candidate) => candidate.auditId === value.id);
    return patch ? {
      ...value,
      destinationPredefinedBenefitId: patch.after.destinationPredefinedBenefitId,
      destinationDefinitionFingerprint: patch.after.destinationDefinitionFingerprint,
      stateFingerprint: patch.after.stateFingerprint,
    } : value;
  });
}

function relationFromAudit(value: CategoryRepairAuditSnapshot): LegacyAuditRelation {
  return {
    id: value.id,
    attemptUserId: value.ownerId!,
    destinationCardId: value.destinationCardId,
    destinationBenefitId: value.destinationBenefitId,
    destinationStatusId: value.destinationStatusId,
    destinationPredefinedBenefitId: value.destinationPredefinedBenefitId,
    destinationDefinitionFingerprint: value.destinationDefinitionFingerprint,
    stateFingerprint: value.stateFingerprint,
  };
}

function appliedUnit(
  before: CategoryRepairUnitSnapshot,
  proposal: CategoryRepairProposal,
  manifest: GlobalBenefitCategoryRepairManifest,
): CategoryRepairUnitSnapshot {
  const action = proposal.actions[0];
  const keeperBefore = action.keeperSourceKind === "legacy"
    ? before.source.statuses.find((value) => value.id === action.keeperStatusId)!
    : before.destinationStatuses.find((value) => value.id === action.keeperStatusId)!;
  const keeper: CategoryRepairStatusSnapshot = {
    ...keeperBefore,
    creditCardId: action.creditCardId,
    predefinedBenefitId: action.predefinedBenefitId,
    audits: patchedAudits(keeperBefore.audits, proposal),
  };
  const sourceStatuses = action.keeperSourceKind === "legacy" ? [keeper] : [];
  const destinationStatuses = [keeper];
  const source = sourceBenefit({
    ...before.source,
    statuses: sourceStatuses,
    audits: sourceStatuses.flatMap((value) => value.audits.map(relationFromAudit)),
  });
  source.ledger = before.source.ledger;
  return unit({
    ...before,
    source,
    destinationStatuses,
    cardStrictCustomSources: [source],
    repairEvidence: evidenceFrom(proposal, manifest),
  });
}

describe("category-only global-benefit discovery", () => {
  it("proposes one ownerless strict-custom category-only match without relaxing strict migration", () => {
    const candidate = unit();
    const proposal = planGlobalBenefitCategoryRepairUnit(candidate);
    expect(proposal).toMatchObject({
      intent: "APPLY",
      sourceBenefitId: "legacy-benefit-1",
      predefinedBenefitId: "global-benefit-1",
      targetCardCatalogKey: "card-1",
      targetBenefitCatalogKey: "card:benefit-1",
      blocked: false,
      stopReasons: [],
    });
    expect(proposal.actions[0].kind).toBe("PROMOTE_LEGACY_STATUS");

    const strict = classifyLegacyMigrationUnit({
      key: "card:owned-card-1",
      card: {
        id: "owned-card-1", name: "Exact Card", issuer: "Exact Issuer",
        userId: "owner-1", productKey: null, predefinedCardId: "global-card-1",
      },
      benefits: [candidate.source],
    }, [candidate.predefinedCard]);
    expect(strict.benefits[0]).toMatchObject({
      disposition: "custom",
      reason: "unmatched_benefit_custom",
      ledgerPhase: "CLASSIFIED",
    });
  });

  it.each([
    ["explicit owner", { source: sourceBenefit({ userId: "owner-1" }) }, "explicit_custom_owner"],
    ["standalone source", { source: sourceBenefit({ creditCardId: null }) }, "source_not_card_linked"],
    ["missing global card link", { card: { id: "owned-card-1", userId: "owner-1", predefinedCardId: null } }, "card_global_link_missing"],
    ["unledgered source", { source: sourceBenefit({ ledger: null }) }, "ledger_not_custom_classified"],
  ] as const)("blocks %s before relaxed matching", (_label, overrides, reason) => {
    expect(planGlobalBenefitCategoryRepairUnit(unit(overrides)).stopReasons).toContain(reason);
  });

  it.each([
    ["description", { description: "Not exact" }, "destination_not_found"],
    ["percentage", { percentage: 50 }, "destination_not_found"],
    ["maxAmount", { maxAmount: 21 }, "destination_not_found"],
    ["frequency", { frequency: "YEARLY" }, "destination_not_found"],
    ["cycleAlignment", { cycleAlignment: "CARD_ANNIVERSARY" }, "destination_not_found"],
    ["fixedCycleStartMonth", { fixedCycleStartMonth: 2 }, "destination_not_found"],
    ["fixedCycleDurationMonths", { fixedCycleDurationMonths: 3 }, "destination_not_found"],
    ["occurrencesInCycle", { occurrencesInCycle: 2 }, "destination_not_found"],
    ["provider identity", { creditFamilyKey: "conflict" }, "source_identity_conflict"],
  ] as const)("does not relax %s", (_field, sourceOverrides, reason) => {
    expect(planGlobalBenefitCategoryRepairUnit(unit({
      source: sourceBenefit(sourceOverrides),
    })).stopReasons).toEqual([reason]);
  });

  it("keeps complete inventory membership immutable while per-entry state remains drift-sensitive", async () => {
    const original = unit();
    const originalInventory = categoryRepairInventoryFingerprint([original]);
    const mutableSource = sourceBenefit();
    mutableSource.statuses[0] = status("legacy", {
      usedAmount: 8,
      stateFingerprint: migrationFingerprint({ usedAmount: 8 }),
    });
    // Historical ledger identity is intentionally retained while mutable state changes.
    mutableSource.ledger = original.source.ledger;
    const mutable = unit({
      source: mutableSource,
      destinationStatuses: [status("canonical", { usedAmount: 3 })],
    });
    expect(categoryRepairInventoryFingerprint([mutable])).toBe(originalInventory);
    expect(planGlobalBenefitCategoryRepairUnit(mutable).currentGraphFingerprint)
      .not.toBe(planGlobalBenefitCategoryRepairUnit(original).currentGraphFingerprint);

    const changedCategory = sourceBenefit({ category: "Different historical category" });
    changedCategory.ledger = original.source.ledger;
    expect(categoryRepairInventoryFingerprint([unit({ source: changedCategory })]))
      .not.toBe(originalInventory);
    const changedLedger = sourceBenefit();
    changedLedger.ledger = { ...changedLedger.ledger!, sourceFingerprint: "a".repeat(64) };
    expect(categoryRepairInventoryFingerprint([unit({ source: changedLedger })]))
      .not.toBe(originalInventory);
    expect(categoryRepairInventoryFingerprint([
      original,
      unit({ privateKey: "repair:another-member", source: sourceBenefit({ id: "another-member" }) }),
    ])).not.toBe(originalInventory);

    const originalSnapshot = snapshot([original], { inventoryFingerprint: originalInventory });
    const manifest = discoveryManifest(originalSnapshot);
    const db = database(snapshot([mutable], { inventoryFingerprint: originalInventory }));
    await expect(runGlobalBenefitCategoryRepairOperator({
      mode: "dry-run",
      manifest,
      database: db,
    })).rejects.toThrow("page boundary changed");
    expect(db.applyRepair).not.toHaveBeenCalled();
  });

  it("blocks a page source when an off-page same-card sibling proposes the same target", () => {
    const first = sourceBenefit();
    const second = sourceBenefit({
      id: "legacy-benefit-2",
      statuses: [status("legacy", { id: "legacy-status-2", benefitId: "legacy-benefit-2" })],
    });
    second.ledger = {
      ...second.ledger!,
      legacyBenefitId: second.id,
      sourceFingerprint: legacyBenefitSourceFingerprint(second),
    };
    const pageUnit = unit({ source: first, cardStrictCustomSources: [first, second] });
    const result = discoverGlobalBenefitCategoryRepairs([pageUnit]);
    expect(result.proposals[0]).toMatchObject({ blocked: true, stopReasons: ["duplicate_target"] });
    expect(result.inventoryFingerprint).not.toBe(categoryRepairInventoryFingerprint([
      unit({ source: first, cardStrictCustomSources: [first] }),
    ]));
  });

  it("ignores same-owner custom siblings while preserving the ownerless repair candidate", () => {
    const candidate = sourceBenefit();
    const ownerCustom = sourceBenefit({
      id: "owner-custom-benefit",
      userId: "owner-1",
      category: "User-defined category",
    });
    ownerCustom.ledger = {
      ...ownerCustom.ledger!,
      legacyBenefitId: ownerCustom.id,
      sourceFingerprint: legacyBenefitSourceFingerprint(ownerCustom),
    };
    const proposal = planGlobalBenefitCategoryRepairUnit(unit({
      source: candidate,
      cardStrictCustomSources: [candidate, ownerCustom],
    }));
    expect(proposal).toMatchObject({ blocked: false, stopReasons: [] });
    expect(proposal.predefinedBenefitId).toBe("global-benefit-1");
  });
});

describe("status actions and reversible audit metadata", () => {
  const definitionFingerprint = migrationFingerprint({ definition: "global-benefit-1" });
  const plan = (legacyStatuses: CategoryRepairStatusSnapshot[], canonicalStatuses: CategoryRepairStatusSnapshot[]) =>
    planCategoryRepairStatusActions({
      ownerId: "owner-1",
      cardId: "owned-card-1",
      sourceBenefitId: "legacy-benefit-1",
      predefinedBenefitId: "global-benefit-1",
      definitionFingerprint,
      legacyStatuses,
      canonicalStatuses,
    });

  it("classifies and preserves the meaningful keeper with complete loser preimage", () => {
    expect(classifyCategoryRepairStatusState(status("legacy"))).toBe("pristine");
    expect(classifyCategoryRepairStatusState(status("legacy", { usedAmount: 1 })))
      .toBe("history-bearing");
    const result = plan([
      status("legacy", { usedAmount: 7, isCompleted: true, completedAt: UPDATED }),
    ], [status("canonical")]);
    expect(result.actions[0]).toMatchObject({
      kind: "PROMOTE_LEGACY_STATUS",
      keeperStatusId: "legacy-status-1",
      removedStatusId: "canonical-status-1",
      removedPreimage: { createdAt: CREATED.toISOString(), updatedAt: UPDATED.toISOString() },
    });
  });

  it("preserves canonical history and prefers legacy for pristine/equal rows", () => {
    expect(plan([status("legacy")], [status("canonical", { usedAmount: 9 })]).actions[0])
      .toMatchObject({ kind: "RETAIN_CANONICAL_STATUS", keeperStatusId: "canonical-status-1" });
    expect(plan([status("legacy")], [status("canonical")]).actions[0].keeperStatusId)
      .toBe("legacy-status-1");
    expect(plan([status("legacy", { usedAmount: 4 })], [
      status("canonical", { usedAmount: 4 }),
    ]).actions[0].keeperStatusId).toBe("legacy-status-1");
  });

  it("blocks conflicting state, dual attachments, and losing attachments", () => {
    expect(plan([
      status("legacy", { usedAmount: 4 }),
    ], [status("canonical", { usedAmount: 5 })]).stopReasons)
      .toEqual(["conflicting_meaningful_state"]);
    expect(plan([
      status("legacy", { audits: [audit("audit-1")] }),
    ], [status("canonical", { provenance: [attachment("provenance-1")] })]).stopReasons)
      .toEqual(["dual_attachments"]);
  });

  it("blocks canonical status audits with inconsistent destination relations", () => {
    const inconsistent = audit("canonical-audit", {
      destinationStatusId: "canonical-status-1",
      destinationBenefitId: null,
      destinationCardId: "different-card",
      destinationPredefinedBenefitId: "global-benefit-1",
      destinationDefinitionFingerprint: definitionFingerprint,
    });
    expect(plan([status("legacy")], [
      status("canonical", { usedAmount: 2, audits: [inconsistent] }),
    ]).stopReasons).toEqual(["relationship_inconsistent"]);
  });

  it("blocks non-exact overlap across and within both source sets", () => {
    const shifted = new Date("2026-01-02T00:00:00.000Z");
    expect(plan([status("legacy")], [
      status("canonical", { cycleStartDate: shifted }),
    ]).stopReasons).toEqual(["non_exact_overlap"]);
    expect(plan([
      status("legacy"),
      status("legacy", { id: "legacy-status-2", cycleStartDate: shifted }),
    ], []).stopReasons).toEqual(["non_exact_overlap"]);
    expect(plan([], [
      status("canonical"),
      status("canonical", { id: "canonical-status-2", cycleStartDate: shifted }),
    ]).stopReasons).toEqual(["non_exact_overlap"]);
  });

  it("binds null-to-canonical audit patches while preserving destination relations", () => {
    const keeperAudit = audit("audit-1");
    const result = plan([
      status("legacy", { usedAmount: 4, audits: [keeperAudit] }),
    ], [status("canonical")]);
    const patch = result.actions[0].repairAddedAuditMetadata[0];
    expect(patch).toMatchObject({
      auditId: "audit-1",
      destinationCardId: "owned-card-1",
      destinationBenefitId: "legacy-benefit-1",
      destinationStatusId: "legacy-status-1",
      before: {
        destinationPredefinedBenefitId: null,
        destinationDefinitionFingerprint: null,
      },
      after: {
        destinationPredefinedBenefitId: "global-benefit-1",
        destinationDefinitionFingerprint: definitionFingerprint,
      },
    });
    expect(patch.after.stateFingerprint).toBe(patch.before.stateFingerprint);
    expect(result.actions[0].actionFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("records already-equal audit metadata idempotently and stops on conflict", () => {
    const equal = audit("audit-1", {
      destinationPredefinedBenefitId: "global-benefit-1",
      destinationDefinitionFingerprint: definitionFingerprint,
    });
    const equalPlan = plan([
      status("legacy", { usedAmount: 4, audits: [equal] }),
    ], [status("canonical")]);
    expect(equalPlan.actions[0].repairAddedAuditMetadata[0]).toMatchObject({
      before: { destinationPredefinedBenefitId: "global-benefit-1" },
      after: { destinationPredefinedBenefitId: "global-benefit-1" },
    });
    const conflict = audit("audit-1", {
      destinationPredefinedBenefitId: "different-benefit",
      destinationDefinitionFingerprint: "f".repeat(64),
    });
    expect(plan([
      status("legacy", { usedAmount: 4, audits: [conflict] }),
    ], [status("canonical")]).stopReasons).toEqual(["audit_metadata_conflict"]);
  });
});

describe("private page manifest and CLI", () => {
  it("keeps manifest authority stable when clone rebinding changes only global database IDs", () => {
    const manifest = discoveryManifest(snapshot());
    const [{ entryFingerprint, ...entry }] = manifest.entries;
    const reboundEntry = {
      ...entry,
      predefinedCardId: "destination-global-card",
      predefinedBenefitId: "destination-global-benefit",
    };
    expect(categoryRepairManifestEntryFingerprint(reboundEntry)).toBe(entryFingerprint);
    expect(categoryRepairManifestFingerprint({
      version: manifest.version,
      inventoryFingerprint: manifest.inventoryFingerprint,
      pageFingerprint: manifest.pageFingerprint,
      afterCursor: manifest.afterCursor,
      nextCursor: manifest.nextCursor,
      hasMore: manifest.hasMore,
      entries: [{ ...reboundEntry, entryFingerprint }],
    })).toBe(manifest.manifestFingerprint);
  });

  it("keeps applied evidence valid after catalog-key clone rebinding", () => {
    const before = unit();
    const discovery = discoverGlobalBenefitCategoryRepairs(
      [before],
      categoryRepairInventoryFingerprint([before]),
    );
    const manifest = buildGlobalBenefitCategoryRepairManifest(discovery);
    const applied = appliedUnit(before, discovery.proposals[0], manifest);
    const destinationCardId = "destination-global-card";
    const destinationBenefitId = "destination-global-benefit";
    const reboundActions = applied.repairEvidence!.occurrences.map((action) => ({
      ...action,
      predefinedBenefitId: destinationBenefitId,
      keeperBaseline: {
        ...action.keeperBaseline,
        predefinedBenefitId: action.keeperBaseline.predefinedBenefitId === null
          ? null
          : destinationBenefitId,
      },
      removedPreimage: action.removedPreimage === null ? null : {
        ...action.removedPreimage,
        predefinedBenefitId: action.removedPreimage.predefinedBenefitId === null
          ? null
          : destinationBenefitId,
      },
    }));
    const reboundKeeper = {
      ...applied.source.statuses[0],
      predefinedBenefitId: destinationBenefitId,
    };
    const reboundSource = sourceBenefit({
      ...applied.source,
      statuses: [reboundKeeper],
    });
    reboundSource.ledger = applied.source.ledger;
    const rebound: CategoryRepairUnitSnapshot = {
      ...applied,
      card: { ...applied.card, predefinedCardId: destinationCardId },
      predefinedCard: {
        ...applied.predefinedCard,
        id: destinationCardId,
        benefits: applied.predefinedCard.benefits.map((benefit) => ({
          ...benefit,
          id: destinationBenefitId,
          predefinedCardId: destinationCardId,
        })),
      },
      source: reboundSource,
      destinationStatuses: [reboundKeeper],
      cardStrictCustomSources: [reboundSource],
      repairEvidence: {
        ...applied.repairEvidence!,
        predefinedCardId: destinationCardId,
        predefinedBenefitId: destinationBenefitId,
        occurrences: reboundActions,
      },
    };
    expect(planGlobalBenefitCategoryRepairUnit(rebound, "apply"))
      .toMatchObject({ intent: "APPLY_REPLAY", blocked: false });
  });

  it("binds complete inventory separately from the page and rejects tampering", () => {
    const completeInventory = "c".repeat(64);
    const discovery = discoverGlobalBenefitCategoryRepairs([unit()], completeInventory);
    const manifest = buildGlobalBenefitCategoryRepairManifest(discovery, {
      hasMore: true,
      nextCursor: encodeGlobalBenefitCategoryRepairCursor("repair:legacy-benefit-1"),
    });
    expect(manifest).toMatchObject({
      inventoryFingerprint: completeInventory,
      pageFingerprint: categoryRepairPageFingerprint(discovery.proposals),
      afterCursor: null,
      hasMore: true,
    });
    expect(manifest.inventoryFingerprint).not.toBe(categoryRepairInventoryFingerprint([unit()]));
    expect(validateGlobalBenefitCategoryRepairManifest(
      JSON.parse(JSON.stringify(manifest)),
      completeInventory,
    )).toEqual(manifest);
    const tampered = JSON.parse(JSON.stringify(manifest));
    tampered.entries[0].targetBenefitCatalogKey = "changed";
    expect(() => validateGlobalBenefitCategoryRepairManifest(tampered))
      .toThrow("manifest entry was modified");
  });

  it("uses a one-way cursor namespace", () => {
    const cursor = encodeGlobalBenefitCategoryRepairCursor("repair:private-benefit-id");
    expect(cursor).toMatch(/^gbr1\.[a-f0-9]{32}$/);
    expect(cursor).not.toContain("private-benefit-id");
    expect(decodeGlobalBenefitCategoryRepairCursor(cursor)).toBe(cursor.slice("gbr1.".length));
  });

  it("parses discover-only private output and rejects unsafe combinations", () => {
    expect(parseGlobalBenefitCategoryRepairArguments([])).toMatchObject({ mode: "dry-run" });
    expect(parseGlobalBenefitCategoryRepairArguments([
      "--rollback-preview", "--manifest=/private/page.json",
    ])).toMatchObject({ mode: "rollback-preview", manifestPath: "/private/page.json" });
    expect(parseGlobalBenefitCategoryRepairArguments([
      "--discover", "--limit=25", "--manifest-output=/private/page.json",
    ])).toMatchObject({ mode: "discover", limit: 25, manifestOutputPath: "/private/page.json" });
    expect(() => parseGlobalBenefitCategoryRepairArguments([
      "--apply", "--manifest-output=/private/page.json",
    ])).toThrow("only in discovery");
    expect(() => parseGlobalBenefitCategoryRepairArguments([
      "--discover", "--manifest=/private/page.json",
    ])).toThrow("does not accept");
    expect(() => parseGlobalBenefitCategoryRepairArguments(["--apply", "--rollback"]))
      .toThrow("exactly one");
    expect(() => parseGlobalBenefitCategoryRepairArguments(["--limit=501"]))
      .toThrow("limit is invalid");
    expect(() => parseGlobalBenefitCategoryRepairArguments(["--production"]))
      .toThrow("unsupported");
  });

  it("creates a new 0600 manifest, refuses overwrite, and sanitizes errors", async () => {
    const directory = await mkdtemp(join(tmpdir(), "category-repair-test-"));
    const path = join(directory, "private-page.json");
    const manifest = discoveryManifest(snapshot());
    try {
      await writeGlobalBenefitCategoryRepairManifest(path, manifest);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual(manifest);
      await writeFile(path, "do-not-overwrite", "utf8");
      await expect(writeGlobalBenefitCategoryRepairManifest(path, manifest))
        .rejects.toThrow("could not be created safely");
      await expect(writeGlobalBenefitCategoryRepairManifest(path, manifest))
        .rejects.not.toThrow(path);
      expect(await readFile(path, "utf8")).toBe("do-not-overwrite");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("bounded operator replay and rollback", () => {
  it.each(["discover", "dry-run", "rollback-preview", "apply", "rollback"] as const)(
    "requires verified target authority before %s reads",
    async (mode) => {
      const db = database(snapshot());
      await expect(runRawGlobalBenefitCategoryRepairOperator({ mode, database: db }))
        .rejects.toThrow("database access requires target verification");
      expect(db.readBatch).not.toHaveBeenCalled();
    },
  );

  it("requires a manifest for default dry-run before reading", async () => {
    const db = database(snapshot());
    await expect(runGlobalBenefitCategoryRepairOperator({ database: db }))
      .rejects.toThrow("private discovery manifest");
    expect(db.readBatch).not.toHaveBeenCalled();
  });

  it("writes a page-scoped discovery manifest with aggregate-only report", async () => {
    const completeInventory = "d".repeat(64);
    const current = snapshot([unit()], { hasMore: true, inventoryFingerprint: completeInventory });
    let output: GlobalBenefitCategoryRepairManifest | null = null;
    const report = await runGlobalBenefitCategoryRepairOperator({
      mode: "discover",
      onDiscoveryManifest: async (manifest) => { output = manifest; },
      database: database(current),
    });
    expect(output).toMatchObject({
      inventoryFingerprint: completeInventory,
      pageFingerprint: report.pageFingerprint,
      hasMore: true,
      nextCursor: report.nextCursor,
    });
    const serialized = JSON.stringify(aggregateGlobalBenefitCategoryRepairReport(report));
    for (const privateValue of [
      "owner-1",
      "owned-card-1",
      "legacy-benefit-1",
      "global-benefit-1",
      report.nextCursor,
      report.inventoryFingerprint,
      report.pageFingerprint,
      report.manifestFingerprint,
    ]) {
      if (privateValue !== null) expect(serialized).not.toContain(privateValue);
    }
  });

  it("binds a later page manifest to its opaque cursor boundary", async () => {
    const completeInventory = "a".repeat(64);
    const after = encodeGlobalBenefitCategoryRepairCursor("repair:previous-page-last");
    const current = snapshot([unit({ privateKey: "repair:page-two" })], {
      inventoryFingerprint: completeInventory,
    });
    let manifest: GlobalBenefitCategoryRepairManifest | null = null;
    await runGlobalBenefitCategoryRepairOperator({
      mode: "discover",
      after,
      onDiscoveryManifest: async (value) => { manifest = value; },
      database: database(current),
    });
    expect(manifest).toMatchObject({
      inventoryFingerprint: completeInventory,
      afterCursor: after,
      nextCursor: null,
      hasMore: false,
    });
    await expect(runGlobalBenefitCategoryRepairOperator({
      mode: "dry-run",
      after: encodeGlobalBenefitCategoryRepairCursor("repair:different-boundary"),
      manifest: manifest!,
      database: database(current),
    })).rejects.toThrow("page boundary changed");
  });

  it("reconstructs a mixed apply page with APPLIED replay, fresh siblings, and an unmanifested blocked source", async () => {
    const secondSource = sourceBenefit({
      id: "legacy-benefit-2",
      category: "Entertainment",
      description: "Second exact terms",
      statuses: [status("legacy", { id: "legacy-status-2", benefitId: "legacy-benefit-2" })],
    });
    const blockedSource = sourceBenefit({
      id: "legacy-blocked",
      userId: "owner-1",
      category: "Blocked",
      description: "Blocked terms",
      statuses: [],
    });
    const catalog = predefinedCard([
      definition(),
      definition({ id: "global-benefit-2", catalogKey: "card:benefit-2", category: "Shopping", description: "Second exact terms" }),
    ]);
    const first = unit({ predefinedCard: catalog });
    const second = unit({
      privateKey: "repair:legacy-benefit-2",
      predefinedCard: catalog,
      source: secondSource,
      destinationStatuses: [status("canonical", { id: "canonical-status-2", predefinedBenefitId: "global-benefit-2" })],
    });
    const blocked = unit({
      privateKey: "repair:legacy-blocked",
      predefinedCard: catalog,
      source: blockedSource,
      destinationStatuses: [],
    });
    const sources = [first.source, second.source, blocked.source];
    const beforeUnits = [first, second, blocked].map((candidate) => ({
      ...candidate,
      cardStrictCustomSources: sources,
    }));
    const beforeSnapshot = snapshot(beforeUnits);
    const reviewed = discoverGlobalBenefitCategoryRepairs(
      beforeUnits,
      beforeSnapshot.inventoryFingerprint,
      "discover",
    );
    const manifest = buildGlobalBenefitCategoryRepairManifest(reviewed);
    const firstProposal = reviewed.proposals.find((proposal) => proposal.sourceBenefitId === "legacy-benefit-1")!;
    const appliedFirst = appliedUnit(first, firstProposal, manifest);
    const currentSources = [appliedFirst.source, second.source, blocked.source];
    const currentUnits = [appliedFirst, second, blocked].map((candidate) => ({
      ...candidate,
      cardStrictCustomSources: currentSources,
    }));
    const current = snapshot(currentUnits, {
      inventoryFingerprint: beforeSnapshot.inventoryFingerprint,
      allUnits: currentUnits,
    });
    const db = database(current);
    (db.applyRepair as jest.Mock).mockImplementation(async (proposal: CategoryRepairProposal) =>
      writeResult(proposal.intent === "APPLY_REPLAY" ? { idempotent: 1 } : { applied: 1 }));

    const report = await runGlobalBenefitCategoryRepairOperator({
      mode: "apply",
      targetVerified: true,
      recoveryPointVerified: true,
      amexOffVerified: true,
      confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION,
      expectedInventoryFingerprint: manifest.inventoryFingerprint,
      expectedManifestFingerprint: manifest.manifestFingerprint,
      expectedPageFingerprint: manifest.pageFingerprint,
      manifest,
      database: db,
    });

    expect(report.pageFingerprint).toBe(manifest.pageFingerprint);
    expect(report.counts).toMatchObject({ proposed: 2, blocked: 1, applied: 1, idempotent: 1 });
    expect((db.applyRepair as jest.Mock).mock.calls.map(([proposal]) => proposal.intent))
      .toEqual(["APPLY_REPLAY", "APPLY"]);
    expect((db.applyRepair as jest.Mock).mock.calls.map(([proposal]) => proposal.sourceBenefitId))
      .toEqual(["legacy-benefit-1", "legacy-benefit-2"]);

    blockedSource.category = "Changed after review";
    (db.applyRepair as jest.Mock).mockClear();
    await expect(runGlobalBenefitCategoryRepairOperator({
      mode: "apply",
      targetVerified: true,
      recoveryPointVerified: true,
      amexOffVerified: true,
      confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION,
      expectedInventoryFingerprint: manifest.inventoryFingerprint,
      expectedManifestFingerprint: manifest.manifestFingerprint,
      expectedPageFingerprint: manifest.pageFingerprint,
      manifest,
      database: db,
    })).rejects.toThrow("repair page changed");
    expect(db.applyRepair).not.toHaveBeenCalled();
  });

  it("passes immutable complete-inventory/page authority to the writer", async () => {
    const completeInventory = "e".repeat(64);
    const current = snapshot([unit()], { inventoryFingerprint: completeInventory });
    const manifest = discoveryManifest(current);
    const db = database(current);
    await runGlobalBenefitCategoryRepairOperator({
      mode: "apply",
      targetVerified: true,
      recoveryPointVerified: true,
      amexOffVerified: true,
      confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION,
      expectedInventoryFingerprint: completeInventory,
      expectedManifestFingerprint: manifest.manifestFingerprint,
      expectedPageFingerprint: manifest.pageFingerprint,
      manifest,
      database: db,
    });
    expect(db.applyRepair).toHaveBeenCalledWith(
      expect.anything(),
      manifest.entries[0],
      {
        mode: "apply",
        inventoryFingerprint: completeInventory,
        manifestFingerprint: manifest.manifestFingerprint,
        pageFingerprint: manifest.pageFingerprint,
        afterCursor: null,
        nextCursor: null,
        hasMore: false,
      },
    );
    expect(completeInventory).not.toBe(categoryRepairInventoryFingerprint(current.units));
  });

  it("routes a concrete post-apply graph to idempotent apply replay", async () => {
    const before = unit();
    const current = snapshot([before]);
    const discovery = discoverGlobalBenefitCategoryRepairs(current.units, current.inventoryFingerprint);
    const manifest = buildGlobalBenefitCategoryRepairManifest(discovery);
    const proposal = discovery.proposals[0];
    const after = appliedUnit(before, proposal, manifest);
    // Unrelated later inventory membership/immutable changes do not invalidate
    // this exact APPLIED evidence replay.
    const replaySnapshot = snapshot([after], { inventoryFingerprint: "f".repeat(64) });
    const db = database(replaySnapshot);
    (db.applyRepair as jest.Mock).mockResolvedValue(writeResult({ idempotent: 1 }));
    const report = await runGlobalBenefitCategoryRepairOperator({
      mode: "apply",
      targetVerified: true,
      recoveryPointVerified: true,
      amexOffVerified: true,
      confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION,
      expectedInventoryFingerprint: current.inventoryFingerprint,
      expectedManifestFingerprint: manifest.manifestFingerprint,
      expectedPageFingerprint: manifest.pageFingerprint,
      manifest,
      database: db,
    });
    expect(report.counts.idempotent).toBe(1);
    expect((db.applyRepair as jest.Mock).mock.calls[0][0]).toMatchObject({
      intent: "APPLY_REPLAY",
      planFingerprint: proposal.planFingerprint,
    });
  });

  it("plans rollback from APPLIED evidence and replays ROLLED_BACK evidence idempotently", async () => {
    const before = unit();
    const inventoryFingerprint = categoryRepairInventoryFingerprint([before]);
    const discovery = discoverGlobalBenefitCategoryRepairs([before], inventoryFingerprint);
    const manifest = buildGlobalBenefitCategoryRepairManifest(discovery);
    const proposal = discovery.proposals[0];
    const after = appliedUnit(before, proposal, manifest);
    const appliedSnapshot = snapshot([after], {
      // The current global inventory may have unrelated additions or immutable
      // changes after this exact repair was applied.
      inventoryFingerprint: "9".repeat(64),
    });
    const previewDb = database(appliedSnapshot);
    const preview = await runGlobalBenefitCategoryRepairOperator({
      mode: "rollback-preview",
      manifest,
      database: previewDb,
    });
    expect(preview).toMatchObject({
      mode: "rollback-preview",
      inventoryFingerprint,
      manifestFingerprint: manifest.manifestFingerprint,
      counts: { proposed: 1, applied: 0, rolledBack: 0, idempotent: 0 },
    });
    expect(previewDb.applyRepair).not.toHaveBeenCalled();
    expect(previewDb.rollbackRepair).not.toHaveBeenCalled();

    const rollbackDb = database(appliedSnapshot);
    const rollback = await runGlobalBenefitCategoryRepairOperator({
      mode: "rollback",
      targetVerified: true,
      recoveryPointVerified: true,
      amexOffVerified: true,
      confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_ROLLBACK_CONFIRMATION,
      expectedInventoryFingerprint: preview.inventoryFingerprint,
      expectedManifestFingerprint: preview.manifestFingerprint!,
      expectedPageFingerprint: preview.pageFingerprint,
      manifest,
      database: rollbackDb,
    });
    expect(rollback.counts.rolledBack).toBe(1);

    const rolledBackEvidence = evidenceFrom(proposal, manifest, "ROLLED_BACK");
    const rolledBackUnit = unit({ ...before, repairEvidence: rolledBackEvidence });
    const replaySnapshot = snapshot([rolledBackUnit], { inventoryFingerprint: "8".repeat(64) });
    const replayPlan = discoverGlobalBenefitCategoryRepairs(
      replaySnapshot.units,
      replaySnapshot.inventoryFingerprint,
      "rollback-preview",
    );
    expect(replayPlan.proposals[0]).toMatchObject({ intent: "ROLLBACK_REPLAY", blocked: false });
    expect(categoryRepairPageFingerprint(replayPlan.proposals)).toBe(preview.pageFingerprint);
    const replayDb = database(replaySnapshot);
    (replayDb.rollbackRepair as jest.Mock).mockResolvedValue(writeResult({ idempotent: 1 }));
    const replay = await runGlobalBenefitCategoryRepairOperator({
      mode: "rollback",
      targetVerified: true,
      recoveryPointVerified: true,
      amexOffVerified: true,
      confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_ROLLBACK_CONFIRMATION,
      expectedInventoryFingerprint: inventoryFingerprint,
      expectedManifestFingerprint: manifest.manifestFingerprint,
      expectedPageFingerprint: preview.pageFingerprint,
      manifest,
      database: replayDb,
    });
    expect(replay.counts.idempotent).toBe(1);
  });

  it("keeps rollback preview authorized after an allowed mutable keeper-state change", async () => {
    const before = unit();
    const current = snapshot([before]);
    const manifest = discoveryManifest(current);
    const proposal = planGlobalBenefitCategoryRepairUnit(before);
    const applied = appliedUnit(before, proposal, manifest);
    const changedKeeper: CategoryRepairStatusSnapshot = {
      ...applied.source.statuses[0],
      usedAmount: 11,
      isCompleted: true,
      completedAt: new Date("2026-01-15T12:00:00.000Z"),
      orderIndex: 23,
      updatedAt: new Date("2026-02-02T10:00:00.000Z"),
      stateFingerprint: "allowed-mutable-state-change",
    };
    const changedSource = sourceBenefit({ ...applied.source, statuses: [changedKeeper] });
    changedSource.ledger = applied.source.ledger;
    const changed = unit({
      ...applied,
      source: changedSource,
      destinationStatuses: [changedKeeper],
      cardStrictCustomSources: [changedSource],
    });

    const preview = await runGlobalBenefitCategoryRepairOperator({
      mode: "rollback-preview",
      manifest,
      database: database(snapshot([changed])),
    });

    expect(preview.counts).toMatchObject({ proposed: 1, blocked: 0, statusActions: 1 });
    expect(preview.stops).toEqual({});
  });

  it("reports manifest-covered provenance drift instead of rejecting rollback preview", async () => {
    const before = unit();
    const current = snapshot([before]);
    const manifest = discoveryManifest(current);
    const proposal = planGlobalBenefitCategoryRepairUnit(before);
    const applied = appliedUnit(before, proposal, manifest);
    const keeper = applied.source.statuses[0];
    const driftedProvenance = {
      id: "later-provenance",
      benefitStatusId: keeper.id,
      attemptUserId: "owner-1",
    };
    const driftedKeeper: CategoryRepairStatusSnapshot = {
      ...keeper,
      provenance: [attachment(driftedProvenance.id)],
    };
    const driftedSource = sourceBenefit({
      ...applied.source,
      statuses: [driftedKeeper],
      provenance: [driftedProvenance],
    });
    driftedSource.ledger = applied.source.ledger;

    const preview = await runGlobalBenefitCategoryRepairOperator({
      mode: "rollback-preview",
      manifest,
      database: database(snapshot([unit({
        ...applied,
        source: driftedSource,
        destinationStatuses: [driftedKeeper],
        cardStrictCustomSources: [driftedSource],
      })])),
    });

    expect(preview.counts).toMatchObject({ proposed: 0, blocked: 1 });
    expect(preview.stops).toEqual({ repair_evidence_invalid: 1 });
  });

  it("rolls back manifest entries without requiring blocked page rows to have repair evidence", async () => {
    const before = unit();
    const blockedSource = sourceBenefit({
      id: "legacy-benefit-blocked",
      userId: "owner-1",
      statuses: [],
    });
    const blocked = unit({
      privateKey: "repair:legacy-benefit-blocked",
      source: blockedSource,
      destinationStatuses: [],
      cardStrictCustomSources: [blockedSource],
    });
    const reviewed = snapshot([before, blocked]);
    const discovery = discoverGlobalBenefitCategoryRepairs(
      reviewed.units,
      reviewed.inventoryFingerprint,
    );
    expect(discovery.proposals.map((proposal) => proposal.blocked)).toEqual([false, true]);
    const manifest = buildGlobalBenefitCategoryRepairManifest(discovery);
    expect(manifest.entries).toHaveLength(1);
    const applied = appliedUnit(before, discovery.proposals[0], manifest);
    const current = snapshot([applied, blocked], { inventoryFingerprint: "5".repeat(64) });

    const preview = await runGlobalBenefitCategoryRepairOperator({
      mode: "rollback-preview",
      manifest,
      database: database(current),
    });
    expect(preview.counts).toMatchObject({ proposed: 1, blocked: 1 });

    const db = database(current);
    await runGlobalBenefitCategoryRepairOperator({
      mode: "rollback",
      targetVerified: true,
      recoveryPointVerified: true,
      amexOffVerified: true,
      confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_ROLLBACK_CONFIRMATION,
      expectedInventoryFingerprint: manifest.inventoryFingerprint,
      expectedManifestFingerprint: manifest.manifestFingerprint,
      expectedPageFingerprint: preview.pageFingerprint,
      manifest,
      database: db,
    });
    expect(db.rollbackRepair).toHaveBeenCalledTimes(1);
    expect((db.rollbackRepair as jest.Mock).mock.calls[0][0].privateKey)
      .toBe("repair:legacy-benefit-1");
  });

  it("reports repaired source and keeper drift even when unrelated inventory changed", async () => {
    const before = unit();
    const inventoryFingerprint = categoryRepairInventoryFingerprint([before]);
    const discovery = discoverGlobalBenefitCategoryRepairs([before], inventoryFingerprint);
    const manifest = buildGlobalBenefitCategoryRepairManifest(discovery);
    const applied = appliedUnit(before, discovery.proposals[0], manifest);
    const driftedSource = sourceBenefit({
      ...applied.source,
      category: "drifted-after-apply",
    });
    driftedSource.ledger = applied.source.ledger;
    const drifted = unit({
      ...applied,
      source: driftedSource,
      cardStrictCustomSources: [driftedSource],
    });
    const db = database(snapshot([drifted], { inventoryFingerprint: "7".repeat(64) }));
    const sourcePreview = await runGlobalBenefitCategoryRepairOperator({
      mode: "rollback-preview",
      manifest,
      database: db,
    });
    expect(sourcePreview.counts).toMatchObject({ proposed: 0, blocked: 1 });
    expect(sourcePreview.stops).toEqual({ repair_evidence_invalid: 1 });
    expect(db.applyRepair).not.toHaveBeenCalled();
    expect(db.rollbackRepair).not.toHaveBeenCalled();

    const keeper = {
      ...applied.source.statuses[0],
      cycleEndDate: new Date("2026-02-01T23:59:59.999Z"),
    };
    const keeperSource = sourceBenefit({ ...applied.source, statuses: [keeper] });
    keeperSource.ledger = applied.source.ledger;
    const keeperDrift = unit({
      ...applied,
      source: keeperSource,
      destinationStatuses: [keeper],
      cardStrictCustomSources: [keeperSource],
    });
    const keeperDb = database(snapshot([keeperDrift], { inventoryFingerprint: "6".repeat(64) }));
    const preview = await runGlobalBenefitCategoryRepairOperator({
      mode: "rollback-preview",
      manifest,
      database: keeperDb,
    });
    expect(preview.counts).toMatchObject({ proposed: 0, blocked: 1 });
    expect(preview.stops).toEqual({ repair_evidence_invalid: 1 });
    expect(keeperDb.rollbackRepair).not.toHaveBeenCalled();
  });

  it("stops malformed evidence and manifest omission before writer invocation", async () => {
    const before = unit();
    const current = snapshot([before]);
    const manifest = discoveryManifest(current);
    const proposal = planGlobalBenefitCategoryRepairUnit(before);
    const malformed = appliedUnit(before, proposal, manifest);
    malformed.repairEvidence = {
      ...malformed.repairEvidence!,
      targetBenefitCatalogKey: "wrong-key",
    };
    expect(planGlobalBenefitCategoryRepairUnit(malformed, "rollback").stopReasons)
      .toEqual(["repair_evidence_invalid"]);

    const incompatibleAuthority = appliedUnit(before, proposal, manifest);
    incompatibleAuthority.repairEvidence = {
      ...incompatibleAuthority.repairEvidence!,
      inventoryFingerprint: "b".repeat(64),
    };
    const incompatibleDb = database(snapshot([incompatibleAuthority], {
      inventoryFingerprint: "c".repeat(64),
    }));
    await expect(runGlobalBenefitCategoryRepairOperator({
      mode: "rollback-preview",
      manifest,
      database: incompatibleDb,
    })).rejects.toThrow("incompatible historical evidence authority");
    expect(incompatibleDb.rollbackRepair).not.toHaveBeenCalled();

    const omitted = {
      ...manifest,
      entries: [],
      manifestFingerprint: "",
    };
    omitted.manifestFingerprint = categoryRepairManifestFingerprint({
      version: omitted.version,
      inventoryFingerprint: omitted.inventoryFingerprint,
      pageFingerprint: omitted.pageFingerprint,
      afterCursor: omitted.afterCursor,
      nextCursor: omitted.nextCursor,
      hasMore: omitted.hasMore,
      entries: omitted.entries,
    });
    const db = database(current);
    await expect(runGlobalBenefitCategoryRepairOperator({
      mode: "dry-run",
      manifest: omitted,
      database: db,
    })).rejects.toThrow("exact reviewed page");
    expect(db.applyRepair).not.toHaveBeenCalled();
  });

  it("never writes a currently safe proposal that is absent from the reviewed manifest", async () => {
    const before = unit();
    const current = snapshot([before]);
    const reviewed = discoveryManifest(current);
    const omitted = {
      ...reviewed,
      entries: [],
      manifestFingerprint: "",
    };
    omitted.manifestFingerprint = categoryRepairManifestFingerprint({
      version: omitted.version,
      inventoryFingerprint: omitted.inventoryFingerprint,
      pageFingerprint: omitted.pageFingerprint,
      afterCursor: omitted.afterCursor,
      nextCursor: omitted.nextCursor,
      hasMore: omitted.hasMore,
      entries: omitted.entries,
    });
    const db = database(current);
    await expect(runGlobalBenefitCategoryRepairOperator({
      mode: "apply",
      recoveryPointVerified: true,
      amexOffVerified: true,
      confirmation: GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION,
      expectedInventoryFingerprint: reviewed.inventoryFingerprint,
      expectedManifestFingerprint: omitted.manifestFingerprint,
      expectedPageFingerprint: reviewed.pageFingerprint,
      manifest: omitted,
      database: db,
    })).rejects.toThrow("exact reviewed page");
    expect(db.applyRepair).not.toHaveBeenCalled();
  });

  it("rejects unordered and unbounded database pages", async () => {
    const first = unit({ privateKey: "repair:z" });
    const second = unit({ privateKey: "repair:a" });
    await expect(runGlobalBenefitCategoryRepairOperator({
      mode: "discover",
      database: database(snapshot([first, second])),
    })).rejects.toThrow("non-deterministic");
    await expect(runGlobalBenefitCategoryRepairOperator({
      mode: "discover",
      limit: 1,
      database: database(snapshot([unit(), unit({ privateKey: "repair:2" })])),
    })).rejects.toThrow("unbounded");
  });
});
