import {
  buildGlobalBenefitCategoryRepairManifest,
  categoryRepairManifestFingerprint,
  categoryRepairManifestEntryFingerprint,
  categoryRepairInventoryFingerprint,
  discoverGlobalBenefitCategoryRepairs,
  encodeGlobalBenefitCategoryRepairCursor,
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
  validateGlobalBenefitCategoryRepairParityScope,
  validateGlobalBenefitCategoryRepairParityManifests,
  parityScopeFromUnits,
  GlobalBenefitCategoryRepairParityError,
  GlobalBenefitCategoryRepairParityVerificationError,
  type CategoryRepairParityAggregateState,
} from "../global-benefit-category-repair-parity";
import { legacyBenefitSourceFingerprint, migrationFingerprint, type GlobalBenefitDefinition } from "../global-benefit-migration";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  handleGlobalBenefitCategoryRepairParityFailure,
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

function appliedUnit(
  value: CategoryRepairUnitSnapshot,
  proposal: ReturnType<typeof planGlobalBenefitCategoryRepairUnit>,
  manifest: ReturnType<typeof buildGlobalBenefitCategoryRepairManifest>,
): CategoryRepairUnitSnapshot {
  const entry = manifest.entries.find((candidate) => candidate.privateKey === value.privateKey);
  if (!entry || proposal.actions.length !== 1) throw new Error("The parity fixture is not a single safe action.");
  const action = proposal.actions[0];
  const keeper = {
    ...value.source.statuses[0],
    creditCardId: value.card.id,
    predefinedBenefitId: entry.predefinedBenefitId,
  };
  return {
    ...value,
    source: { ...value.source, statuses: [keeper] },
    destinationStatuses: [keeper],
    repairEvidence: {
      repairId: `repair-evidence:${value.source.id}`,
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
      inventoryFingerprint: manifest.inventoryFingerprint,
      immutableGraphFingerprint: entry.immutableGraphFingerprint,
      reviewedCurrentGraphFingerprint: entry.currentGraphFingerprint,
      destinationFingerprint: entry.destinationFingerprint,
      manifestFingerprint: manifest.manifestFingerprint,
      manifestEntryFingerprint: entry.entryFingerprint,
      planFingerprint: entry.planFingerprint,
      postimageFingerprint: entry.postimageFingerprint,
      occurrences: [action],
    },
  };
}

function sameCardSiblingFixture() {
  const sibling = unit();
  const blockedSource = {
    ...sibling.source,
    id: "benefit-2",
    category: "Dining",
    statuses: [status({ id: "status-2", benefitId: "benefit-2" })],
    ledger: sibling.source.ledger && {
      ...sibling.source.ledger,
      legacyBenefitId: "benefit-2",
      sourceFingerprint: legacyBenefitSourceFingerprint({
        ...sibling.source,
        id: "benefit-2",
        category: "Dining",
        statuses: [status({ id: "status-2", benefitId: "benefit-2" })],
      }),
    },
  };
  const blocked = unit({ privateKey: "repair:benefit-2", source: blockedSource });
  const sources = [sibling.source, blocked.source];
  const beforeUnits = [sibling, blocked].map((candidate) => ({
    ...candidate,
    cardStrictCustomSources: sources,
  }));
  const inventoryFingerprint = categoryRepairInventoryFingerprint(beforeUnits);
  const discovery = discoverGlobalBenefitCategoryRepairs(beforeUnits, inventoryFingerprint, "discover");
  const siblingProposal = discovery.proposals.find((proposal) => proposal.sourceBenefitId === "benefit-1")!;
  const blockedProposal = discovery.proposals.find((proposal) => proposal.sourceBenefitId === "benefit-2")!;
  return { sibling, blocked, beforeUnits, inventoryFingerprint, discovery, siblingProposal, blockedProposal };
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

  it("normalizes an authorized same-page sibling before comparing a blocked unit", () => {
    const fixture = sameCardSiblingFixture();
    expect(fixture.siblingProposal.blocked).toBe(false);
    expect(fixture.blockedProposal.blocked).toBe(true);
    const manifest = buildGlobalBenefitCategoryRepairManifest(fixture.discovery, { hasMore: false });
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [manifest],
      snapshot: snapshot(fixture.beforeUnits[0], {
        units: fixture.beforeUnits,
        allUnits: fixture.beforeUnits,
        inventoryFingerprint: fixture.inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2, ledgers: 2 } }),
    });
    const appliedSibling = appliedUnit(fixture.sibling, fixture.siblingProposal, manifest);
    const currentUnits = [appliedSibling, fixture.blocked].map((candidate) => ({
      ...candidate,
      cardStrictCustomSources: [appliedSibling.source, fixture.blocked.source],
    }));
    const report = verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [manifest],
      snapshot: snapshot(currentUnits[0], {
        units: currentUnits,
        allUnits: currentUnits,
        inventoryFingerprint: fixture.inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2, ledgers: 2, repairs: 1, occurrences: 1 } }),
    });
    expect(report.gates).toMatchObject({ repairAuthority: true, protectedState: true, allowedDelta: true });
    expect(report.counts).toMatchObject({ appliedValid: 1, unchanged: 1 });
  });

  it("normalizes an authorized sibling from another reviewed page deterministically", () => {
    const fixture = sameCardSiblingFixture();
    const first = buildGlobalBenefitCategoryRepairManifest(
      { inventoryFingerprint: fixture.inventoryFingerprint, proposals: [fixture.siblingProposal] },
      { nextCursor: encodeGlobalBenefitCategoryRepairCursor(fixture.sibling.privateKey), hasMore: true },
    );
    const second = buildGlobalBenefitCategoryRepairManifest(
      { inventoryFingerprint: fixture.inventoryFingerprint, proposals: [fixture.blockedProposal] },
      { afterCursor: first.nextCursor, hasMore: false },
    );
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [first, second],
      snapshot: snapshot(fixture.beforeUnits[0], {
        units: fixture.beforeUnits,
        allUnits: fixture.beforeUnits,
        inventoryFingerprint: fixture.inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2, ledgers: 2 } }),
    });
    const appliedSibling = appliedUnit(fixture.sibling, fixture.siblingProposal, first);
    const currentUnits = [appliedSibling, fixture.blocked].map((candidate) => ({
      ...candidate,
      cardStrictCustomSources: [appliedSibling.source, fixture.blocked.source],
    }));
    const report = verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [first, second],
      snapshot: snapshot(currentUnits[0], {
        units: currentUnits,
        allUnits: currentUnits,
        inventoryFingerprint: fixture.inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2, ledgers: 2, repairs: 1, occurrences: 1 } }),
    });
    expect(report.gates.protectedState).toBe(true);
    expect(report.counts.unchanged).toBe(1);
  });

  it("verifies a selected page from the original global baseline after cumulative authorized effects", () => {
    const unitFirst = unit();
    const secondDefinition = definition({
      id: "global-benefit-2",
      catalogKey: "card:benefit-2",
      description: "Exact terms two",
    });
    const secondSource = {
      ...unitFirst.source,
      id: "benefit-2",
      description: "Exact terms two",
      statuses: [status({ id: "status-2", benefitId: "benefit-2" })],
      ledger: unitFirst.source.ledger && {
        ...unitFirst.source.ledger,
        legacyBenefitId: "benefit-2",
        sourceFingerprint: legacyBenefitSourceFingerprint({
          ...unitFirst.source,
          id: "benefit-2",
          description: "Exact terms two",
          statuses: [status({ id: "status-2", benefitId: "benefit-2" })],
        }),
      },
    };
    const unitSecond = unit({
      privateKey: "repair:benefit-2",
      source: secondSource,
      predefinedCard: { ...unitFirst.predefinedCard, benefits: [definition(), secondDefinition] },
    });
    const beforeUnits = [unitFirst, unitSecond].map((candidate) => ({
      ...candidate,
      cardStrictCustomSources: [unitFirst.source, secondSource],
    }));
    const inventoryFingerprint = categoryRepairInventoryFingerprint(beforeUnits);
    const discovery = discoverGlobalBenefitCategoryRepairs(beforeUnits, inventoryFingerprint, "discover");
    const firstProposal = discovery.proposals.find((proposal) => proposal.sourceBenefitId === "benefit-1")!;
    const secondProposal = discovery.proposals.find((proposal) => proposal.sourceBenefitId === "benefit-2")!;
    expect(firstProposal.blocked).toBe(false);
    expect(secondProposal.blocked).toBe(false);
    const first = buildGlobalBenefitCategoryRepairManifest(
      { inventoryFingerprint, proposals: [firstProposal] },
      { nextCursor: encodeGlobalBenefitCategoryRepairCursor("repair:benefit-1"), hasMore: true },
    );
    const second = buildGlobalBenefitCategoryRepairManifest(
      { inventoryFingerprint, proposals: [secondProposal] },
      { afterCursor: first.nextCursor, hasMore: false },
    );
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [first, second],
      snapshot: snapshot(beforeUnits[0], {
        units: beforeUnits,
        allUnits: beforeUnits,
        inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2 } }),
    });
    const appliedFirst = appliedUnit(unitFirst, firstProposal, first);
    const appliedSecond = appliedUnit(unitSecond, secondProposal, second);
    const currentUnits = [appliedFirst, appliedSecond].map((candidate) => ({
      ...candidate,
      cardStrictCustomSources: [appliedFirst.source, appliedSecond.source],
    }));
    const report = verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [first, second],
      scope: {
        pageIndex: 1,
        pageFingerprint: second.pageFingerprint,
        manifestFingerprint: second.manifestFingerprint,
      },
      snapshot: snapshot(currentUnits[1], {
        units: [currentUnits[1]],
        allUnits: currentUnits,
        inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2, repairs: 2, occurrences: 2 } }),
    });
    expect(report.gates).toMatchObject({
      repairAuthority: true,
      protectedState: true,
      allowedDelta: true,
      unrelatedRows: true,
    });
    expect(report.counts).toMatchObject({ definitionsExamined: 1, eligible: 1, blocked: 0, appliedValid: 1 });
    expect(report.actions).toMatchObject({
      expectedAddedRepairs: 1,
      observedAddedRepairs: 1,
      expectedAddedOccurrences: 1,
      observedAddedOccurrences: 1,
    });
  });

  it("fails closed when a blocked unit itself drifts after sibling repair", () => {
    const fixture = sameCardSiblingFixture();
    const manifest = buildGlobalBenefitCategoryRepairManifest(fixture.discovery, { hasMore: false });
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [manifest],
      snapshot: snapshot(fixture.beforeUnits[0], {
        units: fixture.beforeUnits,
        allUnits: fixture.beforeUnits,
        inventoryFingerprint: fixture.inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2, ledgers: 2 } }),
    });
    const appliedSibling = appliedUnit(fixture.sibling, fixture.siblingProposal, manifest);
    const driftedBlocked = {
      ...fixture.blocked,
      source: { ...fixture.blocked.source, description: "Changed blocked terms" },
    };
    const currentUnits = [appliedSibling, driftedBlocked].map((candidate) => ({
      ...candidate,
      cardStrictCustomSources: [appliedSibling.source, driftedBlocked.source],
    }));
    expect(() => verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [manifest],
      snapshot: snapshot(currentUnits[0], {
        units: currentUnits,
        allUnits: currentUnits,
        inventoryFingerprint: fixture.inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2, ledgers: 2, repairs: 1, occurrences: 1 } }),
    })).toThrow(GlobalBenefitCategoryRepairParityVerificationError);
  });

  it("fails closed when a sibling evidence entry is outside the reviewed manifest bundle", () => {
    const fixture = sameCardSiblingFixture();
    const manifest = buildGlobalBenefitCategoryRepairManifest(fixture.discovery, { hasMore: false });
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [manifest],
      snapshot: snapshot(fixture.beforeUnits[0], {
        units: fixture.beforeUnits,
        allUnits: fixture.beforeUnits,
        inventoryFingerprint: fixture.inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2, ledgers: 2 } }),
    });
    const appliedSibling = appliedUnit(fixture.sibling, fixture.siblingProposal, manifest);
    appliedSibling.repairEvidence = {
      ...appliedSibling.repairEvidence!,
      manifestEntryFingerprint: "c".repeat(64),
    };
    const currentUnits = [appliedSibling, fixture.blocked].map((candidate) => ({
      ...candidate,
      cardStrictCustomSources: [appliedSibling.source, fixture.blocked.source],
    }));
    expect(() => verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [manifest],
      snapshot: snapshot(currentUnits[0], {
        units: currentUnits,
        allUnits: currentUnits,
        inventoryFingerprint: fixture.inventoryFingerprint,
      }),
      aggregate: aggregate({ counts: { statuses: 2, ledgers: 2, repairs: 1, occurrences: 1 } }),
    })).toThrow(GlobalBenefitCategoryRepairParityVerificationError);
  });

  it("throws a typed closed aggregate report when a post-read gate fails", () => {
    const before = unit({
      source: {
        ...unit().source,
        category: "Dining",
      },
    });
    const inventoryFingerprint = categoryRepairInventoryFingerprint([before]);
    const manifest = manifestFor(before, inventoryFingerprint);
    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [manifest],
      snapshot: snapshot(before, { inventoryFingerprint }),
      aggregate: aggregate(),
    });
    const changedDigest = "b".repeat(64);

    try {
      verifyGlobalBenefitCategoryRepairParity({
        targetVerified: true,
        baseline,
        manifests: [manifest],
        snapshot: snapshot(before, { inventoryFingerprint }),
        aggregate: { ...aggregate(), unrelatedRowsDigest: changedDigest },
      });
      throw new Error("Expected parity verification to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(GlobalBenefitCategoryRepairParityVerificationError);
      const verificationError = error as GlobalBenefitCategoryRepairParityVerificationError;
      expect(verificationError.message).toBe("Category-repair parity verification failed safely.");
      expect(verificationError.report).toMatchObject({
        mode: "verify",
        gates: {
          targetVerified: true,
          baselineValid: true,
          manifestCoverage: true,
          repairAuthority: true,
          protectedState: true,
          allowedDelta: true,
          unrelatedRows: false,
        },
        stops: { unrelated_rows_changed: 1 },
      });
      const serialized = JSON.stringify(verificationError.report);
      expect(serialized).not.toContain("benefit-1");
      expect(serialized).not.toContain(DIGEST);
      expect(serialized).not.toContain(changedDigest);
    }
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

  it("rejects a manifest key that is not bound to its source benefit before reads", () => {
    const value = unit();
    const inventoryFingerprint = categoryRepairInventoryFingerprint([value]);
    const manifest = manifestFor(value, inventoryFingerprint);
    const entry = manifest.entries[0];
    const { entryFingerprint: _entryFingerprint, ...entryBody } = entry;
    void _entryFingerprint;
    const changedEntryBody = { ...entryBody, privateKey: "repair:other-source" };
    const changedEntry = {
      ...changedEntryBody,
      entryFingerprint: categoryRepairManifestEntryFingerprint(changedEntryBody),
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
    expect(() => validateGlobalBenefitCategoryRepairParityManifests([changedManifest]))
      .toThrow("manifest bundle is invalid");
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
      "--scope-manifest=page-b.json", "--baseline-output=baseline.json",
    ])).toMatchObject({
      mode: "capture",
      targetVerified: true,
      manifestPaths: ["page-a.json", "page-b.json"],
      scopeManifestPath: "page-b.json",
    });
    expect(() => parseGlobalBenefitCategoryRepairParityArguments([
      "--capture", "--manifest=page-a.json", "--manifest=page-b.json",
      "--scope-manifest=page-c.json", "--baseline-output=baseline.json",
    ])).toThrow("match one provided manifest path");
    expect(() => parseGlobalBenefitCategoryRepairParityArguments([
      "--capture", "--manifest=page-a.json", "--manifest=page-b.json",
      "--scope-manifest=page-a.json", "--scope-manifest=page-a.json",
      "--baseline-output=baseline.json",
    ])).toThrow("provided more than once");
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

  it("prints a typed failure report and exits nonzero without printing the native error", () => {
    const report = {
      mode: "verify" as const,
      gates: {
        targetVerified: true,
        baselineValid: true,
        manifestCoverage: true,
        repairAuthority: false,
        protectedState: true,
        allowedDelta: true,
        unrelatedRows: true,
      },
      counts: {
        definitionsExamined: 1,
        manifestEntries: 1,
        eligible: 1,
        blocked: 0,
        appliedValid: 0,
        unchanged: 0,
        idempotent: 0,
        expectedRemovedStatuses: 1,
        expectedAddedRepairs: 1,
        expectedAddedOccurrences: 1,
      },
      actions: {
        expectedRemovedStatuses: 1,
        observedRemovedStatuses: 0,
        expectedAddedRepairs: 1,
        observedAddedRepairs: 0,
        expectedAddedOccurrences: 1,
        observedAddedOccurrences: 0,
      },
      stops: { canonical_authority_invalid: 1 },
    };
    const verificationError = new GlobalBenefitCategoryRepairParityVerificationError(report);
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      handleGlobalBenefitCategoryRepairParityFailure(verificationError);
      expect(log).toHaveBeenCalledWith(JSON.stringify(report, null, 2));
      expect(error).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);

      log.mockClear();
      error.mockClear();
      process.exitCode = undefined;
      const validationError = new GlobalBenefitCategoryRepairParityError("The private parity authority is invalid.");
      handleGlobalBenefitCategoryRepairParityFailure(validationError);
      expect(log).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith("The private parity authority is invalid.");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
      log.mockRestore();
      error.mockRestore();
    }
  });

  it("binds a page baseline to one selector while requiring the complete bundle", () => {
    const value = unit();
    const blocked = unit({
      privateKey: "repair:benefit-2",
      source: { ...unit().source, id: "benefit-2", category: "Dining" },
    });
    const inventoryFingerprint = categoryRepairInventoryFingerprint([value]);
    const discovery = discoverGlobalBenefitCategoryRepairs([value], inventoryFingerprint, "discover");
    const cursor = "gbr1.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const first = buildGlobalBenefitCategoryRepairManifest(discovery, {
      nextCursor: cursor,
      hasMore: true,
    });
    const second = buildGlobalBenefitCategoryRepairManifest(
      { inventoryFingerprint, proposals: [] },
      { afterCursor: cursor, hasMore: false },
    );
    const bundle = validateGlobalBenefitCategoryRepairParityManifests([first, second]);
    const scope = {
      pageIndex: 0,
      pageFingerprint: first.pageFingerprint,
      manifestFingerprint: first.manifestFingerprint,
    } as const;
    expect(validateGlobalBenefitCategoryRepairParityScope(bundle, scope)).toEqual(scope);
    expect(() => validateGlobalBenefitCategoryRepairParityScope(bundle, {
      ...scope,
      pageIndex: 2,
    })).toThrow("outside the manifest bundle");

    const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [first, second],
      scope,
      snapshot: snapshot(value, { inventoryFingerprint }),
      aggregate: aggregate(),
    });
    expect(baseline.scope).toEqual(scope);
    expect(() => verifyGlobalBenefitCategoryRepairParity({
      targetVerified: true,
      baseline,
      manifests: [first, second],
      snapshot: snapshot(value, { inventoryFingerprint }),
      aggregate: aggregate(),
    })).toThrow("manifest authority");
    expect(() => captureGlobalBenefitCategoryRepairParityBaseline({
      targetVerified: true,
      manifests: [first, second],
      scope,
      snapshot: {
        ...snapshot(value, { inventoryFingerprint }),
        units: [value, blocked],
      },
      aggregate: aggregate(),
    })).toThrow("crosses the selected manifest page");
  });

  it("keeps global sibling exclusions while leaving off-page siblings unrelated for a scoped page", () => {
    const value = unit();
    const sibling = {
      ...value.source,
      id: "benefit-sibling",
      statuses: [status({ id: "status-sibling" })],
      ledger: value.source.ledger && {
        ...value.source.ledger,
        legacyBenefitId: "benefit-sibling",
        sourceFingerprint: legacyBenefitSourceFingerprint({
          ...value.source,
          id: "benefit-sibling",
          statuses: [status({ id: "status-sibling" })],
        }),
      },
    };
    const graph = { ...value, cardStrictCustomSources: [value.source, sibling] };
    expect(parityScopeFromUnits([graph]).sourceBenefitIds).toEqual([
      "benefit-1", "benefit-sibling",
    ]);
    expect(parityScopeFromUnits([graph], false).sourceBenefitIds).toEqual(["benefit-1"]);
    expect(parityScopeFromUnits([graph], false).statusIds).toEqual(["status-1"]);
  });

  it("rejects a manifest bundle that continues after a terminal page", () => {
    const value = unit();
    const inventoryFingerprint = categoryRepairInventoryFingerprint([value]);
    const discovery = discoverGlobalBenefitCategoryRepairs([value], inventoryFingerprint, "discover");
    const terminal = buildGlobalBenefitCategoryRepairManifest(discovery, { hasMore: false });
    const duplicateTerminal = buildGlobalBenefitCategoryRepairManifest(discovery, { hasMore: false });
    expect(() => validateGlobalBenefitCategoryRepairParityManifests([
      terminal,
      duplicateTerminal,
    ])).toThrow("page chain");
  });
});
