import { readFileSync } from "node:fs";
import type { PrismaClient } from "@/generated/prisma";
import {
  PrismaUserCloneSource,
  writeUserCloneGraph,
  type CloneWriteOperations,
} from "../prisma-single-user-clone";
import type { UserCloneSnapshot } from "../single-user-clone";

function snapshot(): UserCloneSnapshot {
  return {
    user: { id: "user-1", email: "owner@example.test", password: null } as UserCloneSnapshot["user"],
    creditCards: [{ id: "card-1", userId: "user-1", cardNumber: null }] as UserCloneSnapshot["creditCards"],
    benefits: [{ id: "benefit-1", creditCardId: "card-1", userId: null }] as UserCloneSnapshot["benefits"],
    benefitStatuses: [{ id: "status-1", benefitId: "benefit-1", userId: "user-1" }] as UserCloneSnapshot["benefitStatuses"],
    creditCardEvents: [{ id: "event-1", creditCardId: "card-1", userId: "user-1" }] as UserCloneSnapshot["creditCardEvents"],
    loyaltyAccounts: [{
      id: "loyalty-1",
      userId: "user-1",
      accountNumber: null,
      loyaltyProgramName: "Invented Rewards",
    }] as UserCloneSnapshot["loyaltyAccounts"],
    loyaltyCertificates: [{ id: "certificate-1", userId: "user-1", loyaltyAccountId: "loyalty-1" }] as UserCloneSnapshot["loyaltyCertificates"],
    externalCardMappings: [{ id: "mapping-1", userId: "user-1", creditCardId: "card-1" }] as UserCloneSnapshot["externalCardMappings"],
    amexSyncAttempts: [{ id: "attempt-1", userId: "user-1" }] as UserCloneSnapshot["amexSyncAttempts"],
    benefitStatusSourceProvenance: [{ id: "provenance-1", benefitStatusId: "status-1", attemptId: "attempt-1" }] as UserCloneSnapshot["benefitStatusSourceProvenance"],
    amexSyncRowAudits: [{ id: "audit-1", attemptId: "attempt-1" }] as UserCloneSnapshot["amexSyncRowAudits"],
  };
}

function operations(order: string[]): CloneWriteOperations & { loyaltyRows: unknown[] } {
  const result = {
    loyaltyRows: [] as unknown[],
    deleteCatalogMigrationLedger: jest.fn(async () => { order.push("delete:CatalogMigrationLedger"); }),
    deleteBenefitStatuses: jest.fn(async () => { order.push("delete:BenefitStatus"); }),
    deleteCreditCards: jest.fn(async () => { order.push("delete:CreditCard"); }),
    deleteUser: jest.fn(async () => { order.push("delete:User"); }),
    createUser: jest.fn(async () => { order.push("create:User"); }),
    createCreditCards: jest.fn(async () => { order.push("create:CreditCard"); }),
    createBenefits: jest.fn(async () => { order.push("create:Benefit"); }),
    createBenefitStatuses: jest.fn(async () => { order.push("create:BenefitStatus"); }),
    createCreditCardEvents: jest.fn(async () => { order.push("create:CreditCardEvent"); }),
    createLoyaltyAccounts: jest.fn(async (rows: unknown[]) => {
      result.loyaltyRows = rows;
      order.push("create:LoyaltyAccount");
    }),
    createLoyaltyCertificates: jest.fn(async () => { order.push("create:LoyaltyCertificate"); }),
    createExternalCardMappings: jest.fn(async () => { order.push("create:ExternalCardMapping"); }),
    createAmexSyncAttempts: jest.fn(async () => { order.push("create:AmexSyncAttempt"); }),
    createBenefitStatusSourceProvenance: jest.fn(async () => { order.push("create:BenefitStatusSourceProvenance"); }),
    createAmexSyncRowAudits: jest.fn(async () => { order.push("create:AmexSyncRowAudit"); }),
  };
  return result;
}

describe("Prisma single-user clone source snapshot", () => {
  it("rejects a configured target that is not a PostgreSQL URL before querying", async () => {
    const query = jest.fn();
    const source = new PrismaUserCloneSource({ $queryRawUnsafe: query } as unknown as PrismaClient, "https://example.test/db");
    await expect(source.identify()).rejects.toThrow("must use PostgreSQL");
    expect(query).not.toHaveBeenCalled();
  });

  it("uses one repeatable-read read-only transaction, an exact email read, and excludes the password projection", async () => {
    const execute = jest.fn().mockResolvedValue(0);
    const userFindMany = jest.fn().mockResolvedValue([]);
    const transaction = {
      $executeRawUnsafe: execute,
      user: { findMany: userFindMany },
    };
    const client = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>, options: unknown) => {
        expect(options).toEqual({ isolationLevel: "RepeatableRead" });
        return callback(transaction);
      }),
    } as unknown as PrismaClient;
    const source = new PrismaUserCloneSource(client, "synthetic-source-target");
    await expect(source.readAccountSnapshot("owner@example.test")).resolves.toEqual({
      matchCount: 0,
      snapshot: null,
    });
    expect(execute).toHaveBeenCalledWith("SET TRANSACTION READ ONLY");
    expect(userFindMany).toHaveBeenCalledWith({
      where: { email: "owner@example.test" },
      take: 2,
      select: expect.not.objectContaining({ password: expect.anything() }),
    });
  });

  it("loads inbound included-graph links and rejects a cross-user child instead of concealing it", async () => {
    const graph = snapshot();
    const eventFindMany = jest.fn().mockResolvedValue([
      { ...graph.creditCardEvents[0], userId: "other-user" },
    ]);
    const transaction = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { findMany: jest.fn().mockResolvedValue([{ id: "user-1", email: "owner@example.test" }]) },
      creditCard: { findMany: jest.fn().mockResolvedValue(graph.creditCards) },
      benefit: { findMany: jest.fn().mockResolvedValue(graph.benefits) },
      benefitStatus: { findMany: jest.fn().mockResolvedValue(graph.benefitStatuses) },
      creditCardEvent: { findMany: eventFindMany },
      loyaltyAccount: {
        findMany: jest.fn().mockResolvedValue(graph.loyaltyAccounts.map((account) => ({
          ...account,
          loyaltyProgram: { name: account.loyaltyProgramName },
        }))),
      },
      loyaltyCertificate: { findMany: jest.fn().mockResolvedValue(graph.loyaltyCertificates) },
      externalCardMapping: { findMany: jest.fn().mockResolvedValue(graph.externalCardMappings) },
      amexSyncAttempt: { findMany: jest.fn().mockResolvedValue(graph.amexSyncAttempts) },
      benefitStatusSourceProvenance: {
        findMany: jest.fn().mockResolvedValue(graph.benefitStatusSourceProvenance),
      },
      amexSyncRowAudit: { findMany: jest.fn().mockResolvedValue(graph.amexSyncRowAudits) },
    };
    const client = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    } as unknown as PrismaClient;
    const source = new PrismaUserCloneSource(client, "synthetic-source-target");

    await expect(source.readAccountSnapshot("owner@example.test")).rejects.toThrow("CreditCardEvent graph");
    expect(eventFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "user-1" },
          { creditCard: { userId: "user-1" } },
        ],
      },
    });
    const rawQueries = transaction.$queryRaw.mock.calls
      .map(([query]) => (query as { strings?: readonly string[] }).strings?.join("?") ?? "");
    const repairQuery = rawQueries.find((query) =>
      query.includes('FROM "GlobalBenefitCategoryRepair" r'));
    expect(repairQuery).toContain('pc."catalogKey" AS "resolvedPredefinedCardCatalogKey"');
    expect(repairQuery).toContain('pb."catalogKey" AS "resolvedPredefinedBenefitCatalogKey"');
    expect(repairQuery).toContain('pb."predefinedCardId" = r."predefinedCardId"');
    expect(rawQueries).toEqual(expect.arrayContaining([
      expect.stringContaining("to_jsonb(bs) - 'creditCardId' - 'predefinedBenefitId'"),
      expect.stringContaining("to_jsonb(r) - 'destinationPredefinedBenefitId'"),
      expect.stringContaining('to_jsonb(p) AS "stateJson"'),
    ]));
    const occurrenceQuery = rawQueries
      .find((query) => query.includes("GlobalBenefitCategoryRepairOccurrence"));
    expect(occurrenceQuery).toContain('"removedStatusPreimage" IS NULL');
    expect(occurrenceQuery).toContain('jsonb_typeof("removedStatusPreimage")');
    expect(occurrenceQuery).toContain(
      'ORDER BY "cycleStartDate", "cycleEndDate", "occurrenceIndex", "keeperStatusId", "id"',
    );
  });

  it("keeps the occurrence tuple delimiter escaped in TypeScript source", () => {
    const source = readFileSync(
      "src/lib/amex-sync/single-user-clone.ts",
      "utf8",
    );
    expect(source).not.toContain(String.fromCharCode(0));
    expect(source).toContain('].join("\\u0000")');
  });
});

describe("Prisma single-user clone write orchestration", () => {
  it("deletes cards before the replaceable user and inserts in dependency order", async () => {
    const order: string[] = [];
    const write = operations(order);
    await writeUserCloneGraph({
      snapshot: snapshot(),
      replaceableUserId: "existing-user",
      loyaltyProgramIds: new Map([["Invented Rewards", "destination-program"]]),
      operations: write,
    });
    expect(order).toEqual([
      "delete:CatalogMigrationLedger",
      "delete:BenefitStatus",
      "delete:CreditCard",
      "delete:User",
      "create:User",
      "create:CreditCard",
      "create:Benefit",
      "create:BenefitStatus",
      "create:CreditCardEvent",
      "create:LoyaltyAccount",
      "create:LoyaltyCertificate",
      "create:ExternalCardMapping",
      "create:AmexSyncAttempt",
      "create:BenefitStatusSourceProvenance",
      "create:AmexSyncRowAudit",
    ]);
  });

  it("maps loyalty accounts by the destination program name without copying account numbers", async () => {
    const write = operations([]);
    await writeUserCloneGraph({
      snapshot: snapshot(),
      replaceableUserId: null,
      loyaltyProgramIds: new Map([["Invented Rewards", "destination-program"]]),
      operations: write,
    });
    expect(write.loyaltyRows).toEqual([
      expect.objectContaining({
        id: "loyalty-1",
        userId: "user-1",
        accountNumber: null,
        loyaltyProgramId: "destination-program",
      }),
    ]);
    expect(write.loyaltyRows[0]).not.toHaveProperty("loyaltyProgramName");
  });

  it("fails before creating a loyalty row when the destination mapping is absent", async () => {
    const order: string[] = [];
    const write = operations(order);
    await expect(writeUserCloneGraph({
      snapshot: snapshot(),
      replaceableUserId: null,
      loyaltyProgramIds: new Map(),
      operations: write,
    })).rejects.toThrow("mapping disappeared");
    expect(write.createLoyaltyAccounts).not.toHaveBeenCalled();
  });

  it("stops insertion immediately when an operation fails so the enclosing Serializable transaction can roll back", async () => {
    const order: string[] = [];
    const write = operations(order);
    write.createBenefitStatuses = jest.fn(async () => {
      order.push("create:BenefitStatus");
      throw new Error("synthetic insert failure");
    });
    await expect(writeUserCloneGraph({
      snapshot: snapshot(),
      replaceableUserId: null,
      loyaltyProgramIds: new Map([["Invented Rewards", "destination-program"]]),
      operations: write,
    })).rejects.toThrow("synthetic insert failure");
    expect(order).toEqual([
      "create:User",
      "create:CreditCard",
      "create:Benefit",
      "create:BenefitStatus",
    ]);
  });
});
