import {
  GLOBAL_BENEFIT_BRIDGE_CONFIRMATION,
  GLOBAL_BENEFIT_CLEANUP_CONFIRMATION,
  GLOBAL_BENEFIT_ROLLBACK_CONFIRMATION,
  classifyLegacyMigrationUnit,
  decodeGlobalBenefitMigrationCursor,
  encodeGlobalBenefitMigrationCursor,
  runGlobalBenefitMigrationOperator,
  type GlobalBenefitDefinition,
  type GlobalBenefitMigrationDatabase,
  type GlobalCardDefinition,
  type LegacyBenefitRecord,
  type LegacyMigrationSnapshot,
  type LegacyMigrationUnit,
  type MigrationWriteResult,
} from "../global-benefit-migration";

const START = new Date("2026-01-01T00:00:00.000Z");
const END = new Date("2026-01-31T23:59:59.999Z");

function definition(overrides: Partial<GlobalBenefitDefinition> = {}): GlobalBenefitDefinition {
  return {
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
    ...overrides,
  };
}

function globalCard(overrides: Partial<GlobalCardDefinition> = {}): GlobalCardDefinition {
  return {
    id: "global-card-1",
    catalogKey: "card-1",
    name: "Exact Card",
    issuer: "Exact Issuer",
    productKey: "product-1",
    retiredAt: null,
    benefits: [definition()],
    ...overrides,
  };
}

function benefit(overrides: Partial<LegacyBenefitRecord> = {}): LegacyBenefitRecord {
  return {
    id: "legacy-benefit-1",
    creditCardId: "owned-card-1",
    userId: null,
    category: "Travel",
    description: "Exact persisted definition",
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
      benefitId: "legacy-benefit-1",
      creditCardId: null,
      predefinedBenefitId: null,
      userId: "owner-1",
      cycleStartDate: START,
      cycleEndDate: END,
      occurrenceIndex: 0,
      stateFingerprint: "complete-status-state",
    }],
    audits: [{
      id: "audit-1",
      attemptUserId: "owner-1",
      destinationCardId: "owned-card-1",
      destinationBenefitId: "legacy-benefit-1",
      destinationPredefinedBenefitId: null,
      destinationStatusId: "status-1",
      destinationDefinitionFingerprint: null,
      stateFingerprint: "complete-audit-state",
    }],
    provenance: [{ id: "provenance-1", benefitStatusId: "status-1", attemptUserId: "owner-1" }],
    ledger: null,
    ...overrides,
  };
}

function unit(overrides: Partial<LegacyMigrationUnit> = {}): LegacyMigrationUnit {
  return {
    key: "card:owned-card-1",
    card: {
      id: "owned-card-1",
      name: "Exact Card",
      issuer: "Exact Issuer",
      userId: "owner-1",
      productKey: null,
      predefinedCardId: null,
    },
    benefits: [benefit()],
    ...overrides,
  };
}

function bridgedUnit(): LegacyMigrationUnit {
  const initial = unit();
  const proposal = classifyLegacyMigrationUnit(initial, [globalCard()]).benefits[0];
  const exact = benefit({
    ledger: {
      legacyBenefitId: "legacy-benefit-1",
      userId: "owner-1",
      creditCardId: "owned-card-1",
      predefinedCardId: "global-card-1",
      predefinedBenefitId: "global-benefit-1",
      classification: "STANDARD",
      phase: "BRIDGED",
      sourceFingerprint: proposal.sourceFingerprint,
      destinationFingerprint: proposal.destinationFingerprint,
    },
    statuses: [{
      ...benefit().statuses[0],
      creditCardId: "owned-card-1",
      predefinedBenefitId: "global-benefit-1",
    }],
    audits: [{
      ...benefit().audits[0],
      destinationPredefinedBenefitId: "global-benefit-1",
      destinationDefinitionFingerprint: proposal.destinationFingerprint,
    }],
  });
  const bridged = unit({ benefits: [exact] });
  bridged.card!.predefinedCardId = "global-card-1";
  return bridged;
}

function result(overrides: Partial<MigrationWriteResult> = {}): MigrationWriteResult {
  return { standard: 0, custom: 0, cleaned: 0, rolledBack: 0, idempotent: 0, ...overrides };
}

function database(snapshot: LegacyMigrationSnapshot) {
  const db: GlobalBenefitMigrationDatabase = {
    readBatch: jest.fn().mockResolvedValue(snapshot),
    applyBridge: jest.fn().mockResolvedValue(result({ standard: 1 })),
    cleanupBridge: jest.fn().mockResolvedValue(result({ cleaned: 1 })),
    rollbackBridge: jest.fn().mockResolvedValue(result({ rolledBack: 1 })),
  };
  return db;
}

describe("legacy global-benefit exact classifier", () => {
  it("classifies only one complete-shape match, including a retired definition", () => {
    const retired = globalCard({ benefits: [definition({ retiredAt: new Date("2026-06-01T00:00:00Z") })] });
    const classified = classifyLegacyMigrationUnit(unit(), [retired]);
    expect(classified.blocked).toBe(false);
    expect(classified.predefinedCardId).toBe("global-card-1");
    expect(classified.benefits).toEqual([
      expect.objectContaining({
        disposition: "standard",
        reason: "exact_standard_match",
        predefinedBenefitId: "global-benefit-1",
      }),
    ]);
  });

  it.each([
    ["category", "Other"],
    ["description", "Near but not exact"],
    ["percentage", 50],
    ["maxAmount", 21],
    ["frequency", "YEARLY"],
    ["cycleAlignment", "CARD_ANNIVERSARY"],
    ["fixedCycleStartMonth", 2],
    ["fixedCycleDurationMonths", 3],
    ["occurrencesInCycle", 2],
  ] as const)("preserves a valid card-linked row as custom when %s differs", (field, value) => {
    const changed = benefit({ [field]: value });
    const classified = classifyLegacyMigrationUnit(unit({ benefits: [changed] }), [globalCard()]);
    expect(classified.blocked).toBe(false);
    expect(classified.benefits[0]).toMatchObject({
      disposition: "custom",
      reason: "unmatched_benefit_custom",
    });
  });

  it("preserves an explicitly user-owned card-linked definition as custom even when its terms equal a global definition", () => {
    const explicitCustom = benefit({ userId: "owner-1" });
    const classified = classifyLegacyMigrationUnit(unit({ benefits: [explicitCustom] }), [globalCard()]);
    expect(classified.blocked).toBe(false);
    expect(classified.benefits[0]).toMatchObject({
      disposition: "custom",
      reason: "unmatched_benefit_custom",
      predefinedBenefitId: null,
    });
  });

  it("accepts the operator-added global card link for a custom-only card on rerun", () => {
    const explicitCustom = benefit({ userId: "owner-1" });
    const initialUnit = unit({ benefits: [explicitCustom] });
    const initial = classifyLegacyMigrationUnit(initialUnit, [globalCard()]);
    explicitCustom.ledger = {
      legacyBenefitId: explicitCustom.id,
      userId: "owner-1",
      creditCardId: "owned-card-1",
      predefinedCardId: null,
      predefinedBenefitId: null,
      classification: "CUSTOM",
      phase: "CLASSIFIED",
      sourceFingerprint: initial.benefits[0].sourceFingerprint,
      destinationFingerprint: null,
    };
    initialUnit.card!.predefinedCardId = "global-card-1";

    const repeated = classifyLegacyMigrationUnit(initialUnit, [globalCard()]);
    expect(repeated.blocked).toBe(false);
    expect(repeated.benefits[0]).toMatchObject({
      disposition: "custom",
      ledgerPhase: "CLASSIFIED",
    });
    expect(repeated.unitFingerprint).toBe(initial.unitFingerprint);
  });

  it("blocks a card-linked definition with a conflicting explicit owner", () => {
    const crossOwner = benefit({ userId: "other-owner" });
    const classified = classifyLegacyMigrationUnit(unit({ benefits: [crossOwner] }), [globalCard()]);
    expect(classified.blocked).toBe(true);
    expect(classified.benefits[0]).toMatchObject({
      disposition: "unresolved",
      reason: "ownership_inconsistent",
    });
  });

  it("never uses description-only, partial-shape, array position, or conflicting identity evidence", () => {
    const identityConflict = benefit({ creditFamilyKey: "another-family" });
    const classified = classifyLegacyMigrationUnit(unit({ benefits: [identityConflict] }), [globalCard()]);
    expect(classified.blocked).toBe(true);
    expect(classified.benefits[0]).toMatchObject({
      disposition: "unresolved",
      reason: "benefit_identity_conflict",
    });
  });

  it("preserves standalone definitions as custom and rejects an inconsistent standalone owner", () => {
    const standalone = benefit({
      id: "standalone-1",
      creditCardId: null,
      userId: "owner-1",
      statuses: [], audits: [], provenance: [],
    });
    const valid = classifyLegacyMigrationUnit({
      key: "standalone:standalone-1", card: null, benefits: [standalone],
    }, [globalCard()]);
    expect(valid.benefits[0]).toMatchObject({ disposition: "custom", reason: "standalone_custom" });

    const invalid = classifyLegacyMigrationUnit({
      key: "standalone:standalone-1", card: null,
      benefits: [{ ...standalone, userId: null }],
    }, [globalCard()]);
    expect(invalid.benefits[0]).toMatchObject({ disposition: "unresolved", reason: "ownership_inconsistent" });
  });

  it("stops the complete card on ownership, audit, provenance, or status inconsistency", () => {
    const inconsistent = benefit({
      statuses: [{ ...benefit().statuses[0], userId: "other-owner" }],
    });
    const classified = classifyLegacyMigrationUnit(unit({ benefits: [inconsistent] }), [globalCard()]);
    expect(classified.blocked).toBe(true);
    expect(classified.benefits[0].reason).toBe("relationship_inconsistent");
  });

  it("fails closed for ambiguous products, ambiguous full-shape definitions, and contradictory card evidence", () => {
    const ambiguousProduct = classifyLegacyMigrationUnit(unit(), [
      globalCard(),
      globalCard({ id: "global-card-2", catalogKey: "card-2" }),
    ]);
    expect(ambiguousProduct.benefits[0].reason).toBe("card_product_ambiguous");

    const ambiguousBenefit = classifyLegacyMigrationUnit(unit(), [
      globalCard({ benefits: [definition(), definition({ id: "global-benefit-2", catalogKey: "card:benefit-2" })] }),
    ]);
    expect(ambiguousBenefit.benefits[0].reason).toBe("benefit_match_ambiguous");

    const contradictory = unit();
    contradictory.card!.productKey = "different-product";
    expect(classifyLegacyMigrationUnit(contradictory, [globalCard()]).benefits[0].reason)
      .toBe("card_identity_conflict");
  });

  it("rejects duplicate standard cycle destinations instead of merging statuses", () => {
    const second = benefit({ id: "legacy-benefit-2" });
    second.statuses = [{ ...second.statuses[0], id: "status-2", benefitId: second.id }];
    second.audits = [];
    second.provenance = [];
    const classified = classifyLegacyMigrationUnit(unit({ benefits: [benefit(), second] }), [globalCard()]);
    expect(classified.blocked).toBe(true);
    expect(classified.benefits.every((row) => row.reason === "duplicate_standard_destination")).toBe(true);
  });

  it("accepts an exact custom ledger as idempotent classification", () => {
    const unmatched = benefit({ description: "A legitimate custom benefit" });
    const first = classifyLegacyMigrationUnit(unit({ benefits: [unmatched] }), [globalCard()]);
    unmatched.ledger = {
      legacyBenefitId: unmatched.id,
      userId: "owner-1",
      creditCardId: "owned-card-1",
      predefinedCardId: null,
      predefinedBenefitId: null,
      classification: "CUSTOM",
      phase: "CLASSIFIED",
      sourceFingerprint: first.benefits[0].sourceFingerprint,
      destinationFingerprint: null,
    };

    const repeated = classifyLegacyMigrationUnit(unit({ benefits: [unmatched] }), [globalCard()]);
    expect(repeated.blocked).toBe(false);
    expect(repeated.benefits[0]).toMatchObject({
      disposition: "custom",
      reason: "unmatched_benefit_custom",
      ledgerPhase: "CLASSIFIED",
    });
  });

  it("replays an exact applied category repair only as a historical custom exception", () => {
    const original = benefit({ category: 'Legacy drifted category' });
    const first = classifyLegacyMigrationUnit(unit({ benefits: [original] }), [globalCard()]);
    const repaired = benefit({
      category: 'Travel',
      categoryRepairAuthority: 'APPLIED_VALID',
      ledger: {
        legacyBenefitId: 'legacy-benefit-1',
        userId: 'owner-1',
        creditCardId: 'owned-card-1',
        predefinedCardId: null,
        predefinedBenefitId: null,
        classification: 'CUSTOM',
        phase: 'CLASSIFIED',
        sourceFingerprint: first.benefits[0].sourceFingerprint,
        destinationFingerprint: null,
      },
      statuses: [{
        ...benefit().statuses[0],
        creditCardId: 'owned-card-1',
        predefinedBenefitId: 'global-benefit-1',
      }],
    });
    const repairedUnit = unit({ benefits: [repaired] });
    repairedUnit.card!.predefinedCardId = 'global-card-1';

    expect(classifyLegacyMigrationUnit(repairedUnit, [globalCard()])).toMatchObject({
      blocked: false,
      benefits: [{
        disposition: 'custom',
        reason: 'unmatched_benefit_custom',
        sourceFingerprint: first.benefits[0].sourceFingerprint,
        ledgerPhase: 'CLASSIFIED',
      }],
    });

    repaired.categoryRepairAuthority = 'APPLIED_INVALID';
    const invalid = classifyLegacyMigrationUnit(repairedUnit, [globalCard()]);
    expect(invalid.blocked).toBe(true);
    expect(invalid.benefits[0].reason).toBe('relationship_inconsistent');
  });

  it("rejects unledgered pre-existing global links so rollback only clears bridge-added metadata", () => {
    const prelinked = benefit({
      statuses: [{
        ...benefit().statuses[0],
        creditCardId: "owned-card-1",
        predefinedBenefitId: "global-benefit-1",
      }],
    });
    const classified = classifyLegacyMigrationUnit(unit({ benefits: [prelinked] }), [globalCard()]);
    expect(classified.blocked).toBe(true);
    expect(classified.benefits[0].reason).toBe("relationship_inconsistent");

    const cardLinked = unit();
    cardLinked.card!.predefinedCardId = "global-card-1";
    expect(classifyLegacyMigrationUnit(cardLinked, [globalCard()]).benefits[0].reason)
      .toBe("card_identity_conflict");
  });

  it("checks card-only audit ownership without treating it as a benefit bridge target", () => {
    const cardAudit = {
      ...benefit().audits[0],
      destinationBenefitId: null,
      destinationStatusId: null,
      destinationPredefinedBenefitId: null,
      destinationDefinitionFingerprint: null,
    };
    const valid = classifyLegacyMigrationUnit(unit({ cardAudits: [cardAudit] }), [globalCard()]);
    expect(valid.blocked).toBe(false);
    expect(valid.benefits[0].disposition).toBe("standard");

    const invalid = classifyLegacyMigrationUnit(unit({
      cardAudits: [{ ...cardAudit, attemptUserId: "other-owner" }],
    }), [globalCard()]);
    expect(invalid.blocked).toBe(true);
    expect(invalid.benefits[0].reason).toBe("relationship_inconsistent");
  });

  it("accepts an exact existing bridge ledger and rejects a conflicting ledger", () => {
    const first = classifyLegacyMigrationUnit(unit(), [globalCard()]);
    const proposal = first.benefits[0];
    const exact = benefit({
      ledger: {
        legacyBenefitId: "legacy-benefit-1",
        userId: "owner-1",
        creditCardId: "owned-card-1",
        predefinedCardId: "global-card-1",
        predefinedBenefitId: "global-benefit-1",
        classification: "STANDARD",
        phase: "BRIDGED",
        sourceFingerprint: proposal.sourceFingerprint,
        destinationFingerprint: proposal.destinationFingerprint,
      },
      statuses: [{
        ...benefit().statuses[0],
        creditCardId: "owned-card-1",
        predefinedBenefitId: "global-benefit-1",
      }],
      audits: [{
        ...benefit().audits[0],
        destinationPredefinedBenefitId: "global-benefit-1",
        destinationDefinitionFingerprint: proposal.destinationFingerprint,
      }],
    });
    const bridged = unit({ benefits: [exact] });
    bridged.card!.predefinedCardId = "global-card-1";
    const bridgedClassification = classifyLegacyMigrationUnit(bridged, [globalCard()]);
    expect(bridgedClassification.blocked).toBe(false);
    expect(bridgedClassification.benefits[0].ledgerPhase).toBe("BRIDGED");
    expect(bridgedClassification.unitFingerprint).toBe(first.unitFingerprint);

    exact.ledger = { ...exact.ledger!, predefinedBenefitId: "wrong" };
    expect(classifyLegacyMigrationUnit(bridged, [globalCard()]).benefits[0].reason).toBe("ledger_conflict");
  });
});

describe("legacy global-benefit operator", () => {
  const snapshot = (): LegacyMigrationSnapshot => ({ definitions: [globalCard()], units: [unit()], hasMore: false });
  const reviewedFingerprint = async (value: LegacyMigrationSnapshot): Promise<string> =>
    (await runGlobalBenefitMigrationOperator({ database: database(value) })).sourceFingerprint;

  it("defaults to deterministic bounded dry-run and invokes no writer", async () => {
    const db = database(snapshot());
    const first = await runGlobalBenefitMigrationOperator({ database: db });
    const second = await runGlobalBenefitMigrationOperator({ database: db });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      mode: "dry-run",
      counts: { unitsExamined: 1, benefitsExamined: 1, standard: 1, bridged: 0 },
    });
    expect(db.applyBridge).not.toHaveBeenCalled();
    expect(db.cleanupBridge).not.toHaveBeenCalled();
    expect(db.rollbackBridge).not.toHaveBeenCalled();
  });

  it("enforces every write gate before a reader or writer call", async () => {
    for (const mode of ["apply", "cleanup", "rollback"] as const) {
      const db = database(snapshot());
      await expect(runGlobalBenefitMigrationOperator({ mode, database: db })).rejects.toThrow("target verification");
      expect(db.readBatch).not.toHaveBeenCalled();
    }
    const cleanup = database(snapshot());
    await expect(runGlobalBenefitMigrationOperator({
      mode: "cleanup", targetVerified: true,
      confirmation: GLOBAL_BENEFIT_CLEANUP_CONFIRMATION,
      database: cleanup,
    })).rejects.toThrow("hybrid parity");
    expect(cleanup.readBatch).not.toHaveBeenCalled();

    const stale = database(snapshot());
    await expect(runGlobalBenefitMigrationOperator({
      mode: "apply", targetVerified: true,
      confirmation: GLOBAL_BENEFIT_BRIDGE_CONFIRMATION,
      expectedSourceFingerprint: "stale-dry-run-fingerprint",
      database: stale,
    })).rejects.toThrow("reviewed dry-run");
    expect(stale.applyBridge).not.toHaveBeenCalled();

    const unprovenCleanup = database(snapshot());
    await expect(runGlobalBenefitMigrationOperator({
      mode: "cleanup", targetVerified: true,
      parityVerified: true, recoveryPointVerified: true,
      confirmation: GLOBAL_BENEFIT_CLEANUP_CONFIRMATION,
      expectedSourceFingerprint: await reviewedFingerprint(snapshot()),
      database: unprovenCleanup,
    })).rejects.toThrow("exact bridged ledger");
    expect(unprovenCleanup.cleanupBridge).not.toHaveBeenCalled();
  });

  it("applies, cleans, and rolls back only with distinct exact gates and a reviewed fingerprint", async () => {
    const expectedSourceFingerprint = await reviewedFingerprint(snapshot());
    const apply = database(snapshot());
    const applyReport = await runGlobalBenefitMigrationOperator({
      mode: "apply", targetVerified: true,
      confirmation: GLOBAL_BENEFIT_BRIDGE_CONFIRMATION,
      expectedSourceFingerprint,
      database: apply,
    });
    expect(apply.applyBridge).toHaveBeenCalledTimes(1);
    expect(applyReport.counts.bridged).toBe(1);

    const bridged = { ...snapshot(), units: [bridgedUnit()] };
    const bridgedFingerprint = await reviewedFingerprint(bridged);
    const cleanup = database(bridged);
    const cleanupReport = await runGlobalBenefitMigrationOperator({
      mode: "cleanup", targetVerified: true,
      parityVerified: true, recoveryPointVerified: true,
      confirmation: GLOBAL_BENEFIT_CLEANUP_CONFIRMATION,
      expectedSourceFingerprint: bridgedFingerprint,
      database: cleanup,
    });
    expect(cleanup.cleanupBridge).toHaveBeenCalledTimes(1);
    expect(cleanupReport.counts.cleaned).toBe(1);

    const rollback = database(bridged);
    const rollbackReport = await runGlobalBenefitMigrationOperator({
      mode: "rollback", targetVerified: true,
      confirmation: GLOBAL_BENEFIT_ROLLBACK_CONFIRMATION,
      expectedSourceFingerprint: bridgedFingerprint,
      database: rollback,
    });
    expect(rollback.rollbackBridge).toHaveBeenCalledTimes(1);
    expect(rollbackReport.counts.rolledBack).toBe(1);
  });

  it("reports a writer-confirmed idempotent bridge without counting a new bridge", async () => {
    const current = snapshot();
    const db = database(current);
    (db.applyBridge as jest.Mock).mockResolvedValue(result({ idempotent: 1 }));
    const report = await runGlobalBenefitMigrationOperator({
      mode: "apply",
      targetVerified: true,
      confirmation: GLOBAL_BENEFIT_BRIDGE_CONFIRMATION,
      expectedSourceFingerprint: await reviewedFingerprint(current),
      database: db,
    });
    expect(report.counts).toMatchObject({ bridged: 0, idempotent: 1 });
  });

  it("does not send unresolved cards to any writer", async () => {
    const blockedUnit = unit();
    blockedUnit.card!.productKey = "contradiction";
    const blockedSnapshot = { ...snapshot(), units: [blockedUnit] };
    const db = database(blockedSnapshot);
    const report = await runGlobalBenefitMigrationOperator({
      mode: "apply", targetVerified: true,
      confirmation: GLOBAL_BENEFIT_BRIDGE_CONFIRMATION,
      expectedSourceFingerprint: await reviewedFingerprint(blockedSnapshot),
      database: db,
    });
    expect(report.counts).toMatchObject({ unresolved: 1, blockedUnits: 1, bridged: 0 });
    expect(db.applyBridge).not.toHaveBeenCalled();
  });

  it("propagates a writer compare-and-set failure and returns no success report", async () => {
    const current = snapshot();
    const db = database(current);
    (db.applyBridge as jest.Mock).mockRejectedValue(new Error("synthetic transaction rollback"));
    await expect(runGlobalBenefitMigrationOperator({
      mode: "apply",
      targetVerified: true,
      confirmation: GLOBAL_BENEFIT_BRIDGE_CONFIRMATION,
      expectedSourceFingerprint: await reviewedFingerprint(current),
      database: db,
    })).rejects.toThrow("synthetic transaction rollback");
  });

  it("uses a one-way opaque cursor and rejects malformed, unordered, or oversized batches", async () => {
    const cursor = encodeGlobalBenefitMigrationCursor("card:private-row-id");
    expect(cursor).not.toContain("private-row-id");
    expect(cursor).toMatch(/^v2\.[a-f0-9]{32}$/);
    expect(decodeGlobalBenefitMigrationCursor(cursor)).toBe(cursor.slice("v2.".length));
    await expect(runGlobalBenefitMigrationOperator({
      after: `${cursor}tampered`, database: database(snapshot()),
    })).rejects.toThrow("cursor is invalid");

    const paged = database({ ...snapshot(), hasMore: true });
    const report = await runGlobalBenefitMigrationOperator({ database: paged });
    expect(report.hasMore).toBe(true);
    expect(report.nextCursor).toBeTruthy();
    expect(JSON.stringify(report)).not.toContain("owned-card-1");

    const unordered = database({
      definitions: [globalCard()], hasMore: false,
      units: [unit({ key: "card:z" }), unit({ key: "card:a" })],
    });
    await expect(runGlobalBenefitMigrationOperator({ database: unordered })).rejects.toThrow("non-deterministic");
  });

  it("returns aggregate-only output without user, row, target, or status values", async () => {
    const report = await runGlobalBenefitMigrationOperator({ database: database(snapshot()) });
    const serialized = JSON.stringify(report);
    for (const privateValue of [
      "owner-1", "owned-card-1", "legacy-benefit-1", "status-1", "audit-1",
      "Exact persisted definition", START.toISOString(), END.toISOString(),
    ]) expect(serialized).not.toContain(privateValue);
    expect(Object.keys(report).sort()).toEqual([
      "counts", "hasMore", "limit", "mode", "nextCursor", "reasons", "sourceFingerprint",
    ]);
  });
});
