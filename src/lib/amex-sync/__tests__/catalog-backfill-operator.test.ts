import { americanExpressCardCatalog } from "@/lib/american-express-card-catalog";
import {
  AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION,
  runAmexCatalogBackfillOperator,
  type CatalogBackfillPrismaClient,
} from "../catalog-backfill-operator";

function record(id: string, populated = false) {
  const card = americanExpressCardCatalog["American Express Gold Card"];
  const benefit = card.benefits[0];
  return {
    id,
    name: card.name,
    issuer: card.issuer,
    productKey: populated ? card.productKey : null,
    benefits: [{
      id: `${id}-benefit`,
      category: benefit.category,
      description: benefit.description,
      percentage: benefit.percentage,
      maxAmount: benefit.maxAmount,
      frequency: benefit.frequency,
      cycleAlignment: benefit.cycleAlignment ?? null,
      fixedCycleStartMonth: benefit.fixedCycleStartMonth ?? null,
      fixedCycleDurationMonths: benefit.fixedCycleDurationMonths ?? null,
      occurrencesInCycle: benefit.occurrencesInCycle ?? 1,
      productKey: populated ? benefit.productKey : null,
      creditFamilyKey: populated ? benefit.creditFamilyKey : null,
      periodKey: populated ? benefit.periodKey : null,
    }],
  };
}

function database(populated = false) {
  const predefined = record("predefined-1", populated);
  const user = record("card-1", populated);
  const delegates = {
    predefinedCard: { findMany: jest.fn().mockResolvedValue([predefined]), findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: populated ? 0 : 1 }), createMany: jest.fn() },
    predefinedBenefit: { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(populated ? predefined.benefits[0] : { productKey: null, creditFamilyKey: null, periodKey: null }), updateMany: jest.fn().mockResolvedValue({ count: populated ? 0 : 1 }), createMany: jest.fn() },
    creditCard: { findMany: jest.fn().mockResolvedValue([user]), findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: populated ? 0 : 1 }), createMany: jest.fn() },
    benefit: {
      findMany: jest.fn(),
      findUnique: jest.fn().mockImplementation(async (args: { select?: { creditCard?: unknown } }) => args.select?.creditCard
        ? {
          id: "card-1-benefit",
          frequency: "MONTHLY",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          description: user.benefits[0].description,
          cycleAlignment: "CALENDAR_FIXED",
          fixedCycleStartMonth: null,
          fixedCycleDurationMonths: 1,
          occurrencesInCycle: 1,
          creditCard: { userId: "user-1", openedDate: new Date("2025-01-01T00:00:00.000Z") },
        }
        : populated ? user.benefits[0] : { productKey: null, creditFamilyKey: null, periodKey: null }),
      updateMany: jest.fn().mockResolvedValue({ count: populated ? 0 : 1 }),
      createMany: jest.fn(),
    },
    benefitStatus: { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn(),
  };
  delegates.$transaction.mockImplementation(async (callback: (transaction: typeof delegates) => Promise<unknown>) => callback(delegates));
  return delegates as unknown as CatalogBackfillPrismaClient & {
    predefinedCard: { findMany: jest.Mock; updateMany: jest.Mock };
    predefinedBenefit: { updateMany: jest.Mock };
    creditCard: { findMany: jest.Mock; updateMany: jest.Mock };
    benefit: { findUnique: jest.Mock; updateMany: jest.Mock };
    benefitStatus: { createMany: jest.Mock };
    $transaction: jest.Mock;
  };
}

describe("Prisma-backed AMEX catalog backfill operator", () => {
  it("defaults to a bounded read-only dry run", async () => {
    const client = database();
    const report = await runAmexCatalogBackfillOperator({ database: client, limit: 1 });
    expect(report).toMatchObject({
      mode: "dry-run",
      limit: 1,
      predefined: { applied: { cards: 0, benefits: 0, statusesMaterialized: 0 } },
      user: { applied: { cards: 0, benefits: 0, statusesMaterialized: 0 } },
    });
    expect(client.predefinedCard.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    expect(client.creditCard.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    expect(client.predefinedCard.updateMany).not.toHaveBeenCalled();
    expect(client.creditCard.updateMany).not.toHaveBeenCalled();
    expect(client.benefitStatus.createMany).not.toHaveBeenCalled();
  });

  it("reports stable cursors for bounded resumable batches", async () => {
    const client = database();
    client.predefinedCard.findMany.mockResolvedValue([record("predefined-1"), record("predefined-2")]);
    client.creditCard.findMany.mockResolvedValue([record("card-1"), record("card-2")]);
    const report = await runAmexCatalogBackfillOperator({
      database: client,
      limit: 1,
      after: { predefined: "predefined-0", user: "card-0" },
    });
    expect(report.hasMore).toEqual({ predefined: true, user: true });
    expect(report.nextCursor).toEqual({ predefined: "predefined-1", user: "card-1" });
    expect(client.predefinedCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { gt: "predefined-0" } }),
    }));
    expect(client.creditCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { gt: "card-0" } }),
    }));
  });

  it("requires both exact apply confirmation and verified target attestation", async () => {
    const client = database();
    await expect(runAmexCatalogBackfillOperator({ mode: "apply", database: client }))
      .rejects.toThrow("confirmation phrase");
    await expect(runAmexCatalogBackfillOperator({
      mode: "apply",
      confirmApply: AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION,
      database: client,
    })).rejects.toThrow("database target");
    expect(client.predefinedCard.findMany).not.toHaveBeenCalled();
  });

  it("fills only null keys and materializes only missing writable user statuses", async () => {
    const client = database();
    const report = await runAmexCatalogBackfillOperator({
      mode: "apply",
      confirmApply: AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION,
      targetVerified: true,
      database: client,
      limit: 10,
      referenceDate: new Date("2026-07-15T00:00:00.000Z"),
    });
    expect(report.predefined.applied).toEqual({ cards: 1, benefits: 1, statusesMaterialized: 0 });
    expect(report.user.applied).toEqual({ cards: 1, benefits: 1, statusesMaterialized: 1 });
    expect(client.predefinedCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ productKey: null }) }));
    expect(client.creditCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ productKey: null }) }));
    expect(client.benefit.updateMany).toHaveBeenCalledTimes(3);
    for (const call of client.benefit.updateMany.mock.calls) {
      expect(Object.values(call[0].where)).toContain(null);
    }
    expect(client.benefitStatus.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({
        userId: "user-1",
        usedAmount: 0,
        isCompleted: false,
        isNotUsable: false,
      })],
    }));
    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("reports a compare-and-set conflict without materializing statuses", async () => {
    const client = database();
    client.benefit.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const report = await runAmexCatalogBackfillOperator({
      mode: "apply",
      confirmApply: AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION,
      targetVerified: true,
      database: client,
      limit: 10,
    });
    expect(report.user.applied).toEqual({ cards: 1, benefits: 0, statusesMaterialized: 0 });
    expect(report.runtimeConflicts.user).toEqual(["benefit:card-1-benefit"]);
    expect(client.benefitStatus.createMany).not.toHaveBeenCalled();
  });

  it("is idempotent when all deterministic keys are already populated", async () => {
    const client = database(true);
    const report = await runAmexCatalogBackfillOperator({
      mode: "apply",
      confirmApply: AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION,
      targetVerified: true,
      database: client,
      limit: 10,
    });
    expect(report.predefined.applied).toEqual({ cards: 0, benefits: 0, statusesMaterialized: 0 });
    expect(report.user.applied).toEqual({ cards: 0, benefits: 0, statusesMaterialized: 0 });
    expect(client.benefitStatus.createMany).not.toHaveBeenCalled();
  });
});
