import type { UserCloneSnapshot } from "../single-user-clone";
import {
  countUserCloneSnapshot,
  planCloneGlobalCatalogRebindings,
  runSingleUserCloneOperator,
  userCloneApplyConfirmation,
  userCloneReplacementConfirmation,
  validateUserCloneSnapshot,
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
