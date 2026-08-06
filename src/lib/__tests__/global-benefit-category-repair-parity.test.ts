import {
  buildGlobalBenefitCategoryRepairManifest,
  categoryRepairManifestFingerprint,
  categoryRepairManifestEntryFingerprint,
  categoryRepairInventoryFingerprint,
  discoverGlobalBenefitCategoryRepairs,
  planGlobalBenefitCategoryRepairUnit,
  type CategoryRepairBatchSnapshot,
  type CategoryRepairLegacyBenefitSnapshot,
  type CategoryRepairStatusSnapshot,
  type CategoryRepairUnitSnapshot,
} from "../global-benefit-category-repair";
import {
  captureGlobalBenefitCategoryRepairParityBaseline,
  parseGlobalBenefitCategoryRepairParityBaseline,
  verifyGlobalBenefitCategoryRepairParity,
  type CategoryRepairParityAggregateState,
} from "../global-benefit-category-repair-parity";
import { legacyBenefitSourceFingerprint, migrationFingerprint, type GlobalBenefitDefinition } from "../global-benefit-migration";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseGlobalBenefitCategoryRepairParityArguments,
  writeGlobalBenefitCategoryRepairParityBaseline,
} from "../../../scripts/verify-global-benefit-category-repair-parity";

const START = new Date("2026-01-01T00:00:00.000Z");
const END = new Date("2026-01-31T23:59:59.999Z");
const CREATED = new Date("2025-12-01T00:00:00.000Z");
const UPDATED = new Date("2025-12-02T00:00:00.000Z");
const DIGEST = "a".repeat(64);

function status(overrides: Partial<CategoryRepairStatusSnapshot> = {}): CategoryRepairStatusSnapshot {
  return {
    id: "status-1",
    benefitId: "benefit-1",
    creditCardId: null,
    predefinedBenefitId: null,
    userId: "user-1",
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
    stateFingerprint: migrationFingerprint({ state: "preserved" }),
    audits: [],
    provenance: [],
    ...overrides,
  };
}

function definition(overrides: Partial<GlobalBenefitDefinition> = {}): GlobalBenefitDefinition {
  return {
    id: "global-benefit-1",
    catalogKey: "card:benefit-1",
    predefinedCardId: "global-card-1",
    category: "Dining",
    description: "Exact terms",
    percentage: 100,
    maxAmount: 20,
    frequency: "MONTHLY",
    cycleAlignment: "CALENDAR_FIXED",
    fixedCycleStartMonth: 1,
    fixedCycleDurationMonths: 1,
    occurrencesInCycle: 1,
    productKey: "product-1",
    creditFamilyKey: "family-1",
    periodKey: "month",
    retiredAt: null,
    ...overrides,
  };
}

function unit(overrides: Partial<CategoryRepairUnitSnapshot> = {}): CategoryRepairUnitSnapshot {
  const source: CategoryRepairLegacyBenefitSnapshot = {
    id: "benefit-1",
    creditCardId: "card-1",
    userId: null,
    category: "Travel",
    description: "Exact terms",
    percentage: 100,
    maxAmount: 20,
    frequency: "MONTHLY" as const,
    cycleAlignment: "CALENDAR_FIXED" as const,
    fixedCycleStartMonth: 1,
    fixedCycleDurationMonths: 1,
    occurrencesInCycle: 1,
    productKey: null,
    creditFamilyKey: null,
    periodKey: null,
    statuses: [status()],
    audits: [],
    provenance: [],
    ledger: null,
  };
  source.ledger = {
    legacyBenefitId: source.id,
    userId: "user-1",
    creditCardId: "card-1",
    predefinedCardId: null,
    predefinedBenefitId: null,
    classification: "CUSTOM" as const,
    phase: "CLASSIFIED" as const,
    sourceFingerprint: legacyBenefitSourceFingerprint(source),
    destinationFingerprint: null,
  };
  const result: CategoryRepairUnitSnapshot = {
    privateKey: "repair:benefit-1",
    card: { id: "card-1", userId: "user-1", predefinedCardId: "global-card-1" },
    source,
    predefinedCard: {
      id: "global-card-1",
      catalogKey: "card-1",
      name: "Card",
      issuer: "Issuer",
      productKey: "product-1",
      retiredAt: null,
      benefits: [definition()],
    },
    destinationStatuses: [],
    cardStrictCustomSources: [source],
    repairEvidence: null,
    ...overrides,
  };
  return result;
}

function aggregate(overrides: { counts?: Partial<CategoryRepairParityAggregateState["counts"]> } = {}): CategoryRepairParityAggregateState {
  return {
    counts: {
      users: 1,
      cards: 1,
      benefits: 1,
      predefinedCards: 1,
      predefinedBenefits: 1,
      statuses: 1,
      audits: 0,
      provenance: 0,
      ledgers: 1,
      repairs: 0,
      occurrences: 0,
      ...overrides.counts,
    },
    unrelatedRowsDigest: DIGEST,
  };
}

function snapshot(value: CategoryRepairUnitSnapshot, overrides: Partial<CategoryRepairBatchSnapshot> = {}): CategoryRepairBatchSnapshot {
  return {
    units: [value],
    hasMore: false,
    inventoryFingerprint: categoryRepairInventoryFingerprint([value]),
    ...overrides,
  };
}

function manifestFor(value: CategoryRepairUnitSnapshot, inventoryFingerprint: string) {
  const discovery = discoverGlobalBenefitCategoryRepairs([value], inventoryFingerprint, "discover");
  return buildGlobalBenefitCategoryRepairManifest(discovery, { hasMore: false });
}

describe("category-repair parity verifier", () => {
  it("rejects before inspecting private authority when target verification is absent", () => {
    expect(() => captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: false,
      manifests: [],
      snapshot: {} as CategoryRepairBatchSnapshot,
      aggregate: aggregate(),
    })).toThrow("target verification");
  });

  it("captures and verifies an unchanged blocked unit with aggregate-only evidence", () => {
    const blocked = unit({
      source: {
        ...unit().source,
        category: "Dining",
      },
    });
    const inventoryFingerprint = categoryRepairInventoryFingerprint([blocked]);
    const manifest = manifestFor(blocked, inventoryFingerprint);
    const before = snapshot(blocked, { inventoryFingerprint });
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [manifest],
      snapshot: before,
      aggregate: aggregate(),
    });
    const report = verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [manifest],
      snapshot: before,
      aggregate: aggregate(),
    });
    expect(report.gates).toEqual({
      targetVerified: true,
      baselineValid: true,
      manifestCoverage: true,
      repairAuthority: true,
      protectedState: true,
      allowedDelta: true,
      unrelatedRows: true,
    });
    expect(report.counts).toMatchObject({ definitionsExamined: 1, blocked: 1, unchanged: 1 });
    expect(JSON.stringify(report)).not.toContain("benefit-1");
    expect(JSON.stringify(report)).not.toContain(DIGEST);
  });

  it("proves a manifest-covered keeper promotion, loser delta, and evidence additions", () => {
    const before = unit();
    const inventoryFingerprint = categoryRepairInventoryFingerprint([before]);
    const manifest = manifestFor(before, inventoryFingerprint);
    const proposal = planGlobalBenefitCategoryRepairUnit(before, "discover");
    expect(proposal.blocked).toBe(false);
    const entry = manifest.entries[0];
    const action = proposal.actions[0];
    const keeper = {
      ...before.source.statuses[0],
      creditCardId: "card-1",
      predefinedBenefitId: "global-benefit-1",
    };
    const after = unit({
      source: { ...before.source, statuses: [keeper] },
      destinationStatuses: [keeper],
      repairEvidence: {
        repairId: "repair-1",
        phase: "APPLIED",
        evidenceVersion: 1,
        sourceBenefitId: proposal.sourceBenefitId,
        ownerId: proposal.ownerId,
        creditCardId: proposal.creditCardId,
        predefinedCardId: proposal.predefinedCardId,
        predefinedBenefitId: proposal.predefinedBenefitId!,
        targetCardCatalogKey: entry.targetCardCatalogKey,
        targetBenefitCatalogKey: entry.targetBenefitCatalogKey,
        definitionFingerprint: entry.definitionFingerprint,
        inventoryFingerprint,
        immutableGraphFingerprint: entry.immutableGraphFingerprint,
        reviewedCurrentGraphFingerprint: entry.currentGraphFingerprint,
        destinationFingerprint: entry.destinationFingerprint,
        manifestFingerprint: manifest.manifestFingerprint,
        manifestEntryFingerprint: entry.entryFingerprint,
        planFingerprint: entry.planFingerprint,
        postimageFingerprint: entry.postimageFingerprint,
        occurrences: [action],
      },
    });
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [manifest],
      snapshot: snapshot(before, { inventoryFingerprint }),
      aggregate: aggregate(),
    });
    const report = verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [manifest],
      snapshot: snapshot(after, { inventoryFingerprint }),
      aggregate: aggregate({ counts: { statuses: 1, repairs: 1, occurrences: 1 } }),
    });
    expect(report.gates).toMatchObject({ repairAuthority: true, protectedState: true, allowedDelta: true });
    expect(report.counts.appliedValid).toBe(1);
    expect(report.actions.observedAddedRepairs).toBe(1);
  });

  it("rejects a tampered private baseline", () => {
    const value = unit();
    const inventoryFingerprint = categoryRepairInventoryFingerprint([value]);
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [manifestFor(value, inventoryFingerprint)],
      snapshot: snapshot(value, { inventoryFingerprint }),
      aggregate: aggregate(),
    });
    const parsed = JSON.parse(JSON.stringify(baseline)) as Record<string, unknown>;
    parsed.baselineFingerprint = DIGEST;
    expect(() => parseGlobalBenefitCategoryRepairParityBaseline(parsed)).toThrow("invalid");
  });

  it("rejects a manifest whose signed entry no longer matches the planned unit", () => {
    const value = unit();
    const inventoryFingerprint = categoryRepairInventoryFingerprint([value]);
    const manifest = manifestFor(value, inventoryFingerprint);
    const entry = manifest.entries[0];
    const changedBody = { ...entry, targetBenefitCatalogKey: "card:other-benefit" };
    const { entryFingerprint: _entryFingerprint, ...entryWithoutFingerprint } = changedBody;
    void _entryFingerprint;
    const changedEntry = {
      ...entryWithoutFingerprint,
      entryFingerprint: categoryRepairManifestEntryFingerprint(entryWithoutFingerprint),
    };
    const { manifestFingerprint: _manifestFingerprint, ...manifestBody } = manifest;
    void _manifestFingerprint;
    const changedManifest = {
      ...manifestBody,
      entries: [changedEntry],
      manifestFingerprint: categoryRepairManifestFingerprint({
        ...manifestBody,
        entries: [changedEntry],
      }),
    };
    expect(() => captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [changedManifest],
      snapshot: snapshot(value, { inventoryFingerprint }),
      aggregate: aggregate(),
    })).toThrow("repair plan");
  });

  it("rejects an incomplete or duplicate current snapshot before authority comparison", () => {
    const value = unit();
    const inventoryFingerprint = categoryRepairInventoryFingerprint([value]);
    const manifest = manifestFor(value, inventoryFingerprint);
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [manifest],
      snapshot: snapshot(value, { inventoryFingerprint }),
      aggregate: aggregate(),
    });
    expect(() => verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [manifest],
      snapshot: { ...snapshot(value, { inventoryFingerprint }), units: [value, value] },
      aggregate: aggregate(),
    })).toThrow("current parity snapshot is invalid");
    expect(() => verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [manifest],
      snapshot: { ...snapshot(value, { inventoryFingerprint }), hasMore: true },
      aggregate: aggregate(),
    })).toThrow("current parity snapshot is invalid");
  });

  it("keeps CLI output authority private and creates baselines exclusively with 0600 mode", async () => {
    expect(parseGlobalBenefitCategoryRepairParityArguments([
      "--capture", "--target-verified", "--manifest=page-a.json", "--manifest=page-b.json",
      "--baseline-output=baseline.json",
    ])).toMatchObject({ mode: "capture", targetVerified: true, manifestPaths: ["page-a.json", "page-b.json"] });
    expect(() => parseGlobalBenefitCategoryRepairParityArguments([
      "--capture", "--manifest=page.json", "--baseline=baseline.json", "--baseline-output=other.json",
    ])).toThrow("Capture requires");
    expect(() => parseGlobalBenefitCategoryRepairParityArguments([
      "--capture", "--target-verified", "--manifest=page.json", "--manifest=page.json",
      "--baseline-output=baseline.json",
    ])).toThrow("provided more than once");
    const directory = await mkdtemp(join(tmpdir(), "category-repair-parity-"));
    const path = join(directory, "baseline.json");
    await writeGlobalBenefitCategoryRepairParityBaseline(path, { private: "authority" });
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ private: "authority" });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    await expect(writeGlobalBenefitCategoryRepairParityBaseline(path, { private: "replacement" }))
      .rejects.toThrow("could not be created safely");
  });
});
