import { predefinedCardsData, type StaticPredefinedCard } from "../../static-catalog";
import {
  applyCatalogSyncPlan,
  GLOBAL_CATALOG_SYNC_CONFIRMATION,
  runGlobalCatalogSyncOperator,
  type CatalogPrismaClient,
} from "../prisma-synchronizer";
import {
  planCatalogSynchronization,
  summarizeCatalogSyncPlan,
  type CatalogSnapshot,
} from "../synchronizer";

const UPDATED_AT = new Date("2026-07-29T00:00:00.000Z");

function copySource(): StaticPredefinedCard[] {
  return JSON.parse(JSON.stringify(predefinedCardsData)) as StaticPredefinedCard[];
}

function snapshot(source: readonly StaticPredefinedCard[] = predefinedCardsData): CatalogSnapshot {
  const cards = source.map((card, index) => ({
    id: `card-id-${index}`,
    catalogKey: card.catalogKey,
    name: card.name,
    issuer: card.issuer,
    annualFee: card.annualFee,
    imageUrl: card.imageUrl,
    productKey: card.productKey ?? null,
    retiredAt: null,
    updatedAt: UPDATED_AT,
  }));
  const cardIdByKey = new Map(cards.map((card) => [card.catalogKey, card.id]));
  return {
    cards,
    benefits: source.flatMap((card) => card.benefits.map((benefit, index) => ({
      id: `${cardIdByKey.get(card.catalogKey)}-benefit-${index}`,
      catalogKey: benefit.catalogKey,
      predefinedCardId: cardIdByKey.get(card.catalogKey)!,
      category: benefit.category,
      description: benefit.description,
      percentage: benefit.percentage,
      maxAmount: benefit.maxAmount ?? null,
      frequency: benefit.frequency,
      cycleAlignment: benefit.cycleAlignment ?? "CARD_ANNIVERSARY",
      fixedCycleStartMonth: benefit.fixedCycleStartMonth ?? null,
      fixedCycleDurationMonths: benefit.fixedCycleDurationMonths ?? null,
      occurrencesInCycle: benefit.occurrencesInCycle ?? 1,
      productKey: benefit.productKey ?? null,
      creditFamilyKey: benefit.creditFamilyKey ?? null,
      periodKey: benefit.periodKey ?? null,
      retiredAt: null,
      updatedAt: UPDATED_AT,
    }))),
  };
}

function database(initial: CatalogSnapshot = { cards: [], benefits: [] }) {
  const predefinedCard = {
    findMany: jest.fn().mockResolvedValue(initial.cards),
    create: jest.fn().mockImplementation(async ({ data }: { data: { catalogKey: string } }) => ({ id: `created-${data.catalogKey}` })),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const predefinedBenefit = {
    findMany: jest.fn().mockResolvedValue(initial.benefits),
    create: jest.fn().mockImplementation(async ({ data }: { data: { catalogKey: string } }) => ({ id: `created-${data.catalogKey}` })),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const client = {
    predefinedCard,
    predefinedBenefit,
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation(async (callback: (transaction: typeof client) => Promise<unknown>) => callback(client));
  return client as unknown as CatalogPrismaClient & {
    predefinedCard: typeof predefinedCard;
    predefinedBenefit: typeof predefinedBenefit;
    $transaction: jest.Mock;
  };
}

describe("global catalog synchronization", () => {
  it("is idempotent and preserves every existing global id", () => {
    const existing = snapshot();
    const plan = planCatalogSynchronization({ source: predefinedCardsData, snapshot: existing });
    expect(summarizeCatalogSyncPlan(plan)).toEqual({
      cards: { create: 0, adopt: 0, update: 0, retire: 0, unchanged: 34 },
      benefits: { create: 0, adopt: 0, update: 0, retire: 0, unchanged: 129 },
      conflictCount: 0,
    });
    expect(plan.cards.filter((action) => action.existing).map((action) => action.existing!.id))
      .toEqual(existing.cards.map((card) => card.id));
  });

  it("adopts exact legacy rows instead of recreating them", () => {
    const existing = snapshot();
    existing.cards.forEach((card) => { card.catalogKey = null; });
    existing.benefits.forEach((benefit) => { benefit.catalogKey = null; });
    const plan = planCatalogSynchronization({ source: predefinedCardsData, snapshot: existing });
    expect(summarizeCatalogSyncPlan(plan)).toEqual(expect.objectContaining({
      cards: expect.objectContaining({ adopt: 34, create: 0 }),
      benefits: expect.objectContaining({ adopt: 129, create: 0 }),
      conflictCount: 0,
    }));
  });

  it("adopts a unique canonical legacy card when provider identity was not previously stored", () => {
    const source = copySource();
    const sourceCard = source.find((card) => card.productKey)!;
    const existing = snapshot(source);
    const storedCard = existing.cards.find((card) => card.catalogKey === sourceCard.catalogKey)!;
    storedCard.catalogKey = null;
    storedCard.productKey = null;

    const plan = planCatalogSynchronization({ source, snapshot: existing });

    expect(plan.conflicts).toEqual([]);
    expect(plan.cards.find((action) => action.source?.catalogKey === sourceCard.catalogKey)).toEqual(
      expect.objectContaining({ kind: "adopt", existing: expect.objectContaining({ id: storedCard.id }) }),
    );
  });

  it.each([
    ["canonical shape", { annualFee: 1 }],
    ["provider identity", { productKey: "conflicting-product" }],
  ])("does not adopt a legacy card with conflicting %s", (_kind, override) => {
    const source = copySource();
    const sourceCard = source.find((card) => card.productKey)!;
    const existing = snapshot(source);
    const storedCard = existing.cards.find((card) => card.catalogKey === sourceCard.catalogKey)!;
    storedCard.catalogKey = null;
    Object.assign(storedCard, override);

    const plan = planCatalogSynchronization({ source, snapshot: existing });

    expect(plan.conflicts).toContain(`unmatched_unkeyed_card:${storedCard.id}`);
    expect(plan.cards.find((action) => action.source?.catalogKey === sourceCard.catalogKey)?.kind).toBe("create");
  });

  it("adopts a unique canonical legacy benefit when provider identity was not previously stored", () => {
    const source = copySource();
    const sourceBenefit = source.flatMap((card) => card.benefits)
      .find((benefit) => benefit.productKey && benefit.creditFamilyKey && benefit.periodKey)!;
    const existing = snapshot(source);
    const storedBenefit = existing.benefits.find((benefit) => benefit.catalogKey === sourceBenefit.catalogKey)!;
    storedBenefit.catalogKey = null;
    storedBenefit.productKey = null;
    storedBenefit.creditFamilyKey = null;
    storedBenefit.periodKey = null;

    const plan = planCatalogSynchronization({ source, snapshot: existing });

    expect(plan.conflicts).toEqual([]);
    expect(plan.benefits.find((action) => action.source?.catalogKey === sourceBenefit.catalogKey)).toEqual(
      expect.objectContaining({ kind: "adopt", existing: expect.objectContaining({ id: storedBenefit.id }) }),
    );
  });

  it("does not adopt a canonical legacy benefit with conflicting provider identity", () => {
    const source = copySource();
    const sourceBenefit = source.flatMap((card) => card.benefits)
      .find((benefit) => benefit.productKey && benefit.creditFamilyKey && benefit.periodKey)!;
    const existing = snapshot(source);
    const storedBenefit = existing.benefits.find((benefit) => benefit.catalogKey === sourceBenefit.catalogKey)!;
    storedBenefit.catalogKey = null;
    storedBenefit.productKey = "conflicting-product";

    const plan = planCatalogSynchronization({ source, snapshot: existing });

    expect(plan.conflicts).toContain(`unmatched_unkeyed_benefit:${storedBenefit.id}`);
    expect(plan.benefits.find((action) => action.source?.catalogKey === sourceBenefit.catalogKey)?.kind).toBe("create");
  });

  it("does not adopt a canonical legacy benefit with partially populated provider identity", () => {
    const source = copySource();
    const sourceBenefit = source.flatMap((card) => card.benefits)
      .find((benefit) => benefit.productKey && benefit.creditFamilyKey && benefit.periodKey)!;
    const existing = snapshot(source);
    const storedBenefit = existing.benefits.find((benefit) => benefit.catalogKey === sourceBenefit.catalogKey)!;
    storedBenefit.catalogKey = null;
    storedBenefit.productKey = null;

    const plan = planCatalogSynchronization({ source, snapshot: existing });

    expect(plan.conflicts).toContain(`unmatched_unkeyed_benefit:${storedBenefit.id}`);
    expect(plan.benefits.find((action) => action.source?.catalogKey === sourceBenefit.catalogKey)?.kind)
      .toBe("create");
  });

  it("does not adopt by destination order when two unkeyed rows match one source definition", () => {
    const source = copySource();
    const sourceBenefit = source.flatMap((card) => card.benefits)
      .find((benefit) => benefit.productKey && benefit.creditFamilyKey && benefit.periodKey)!;
    const existing = snapshot(source);
    const storedBenefit = existing.benefits.find((benefit) => benefit.catalogKey === sourceBenefit.catalogKey)!;
    storedBenefit.catalogKey = null;
    existing.benefits.push({ ...storedBenefit, id: `${storedBenefit.id}-duplicate` });

    const plan = planCatalogSynchronization({ source, snapshot: existing });

    expect(plan.conflicts).toContain(`ambiguous_unkeyed_benefit:${sourceBenefit.catalogKey}`);
    expect(plan.benefits.find((action) => action.source?.catalogKey === sourceBenefit.catalogKey)?.kind)
      .toBe("create");
  });

  it("updates approved terms, revives returning keys, and retires missing keyed rows", () => {
    const source = copySource();
    const existing = snapshot();
    source[0].annualFee = 123;
    existing.cards[0].retiredAt = new Date("2026-01-01T00:00:00.000Z");
    existing.cards.push({
      ...existing.cards[0],
      id: "retired-card-id",
      catalogKey: "card:retired-definition",
      name: "Retired definition",
      retiredAt: null,
    });
    const plan = planCatalogSynchronization({ source, snapshot: existing });
    expect(plan.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "update", source: expect.objectContaining({ catalogKey: "card:csp" }), existing: expect.objectContaining({ id: "card-id-0" }) }),
      expect.objectContaining({ kind: "retire", existing: expect.objectContaining({ id: "retired-card-id" }) }),
    ]));
  });

  it("fails closed on unmatched unkeyed definitions", () => {
    const existing = snapshot();
    existing.cards.push({ ...existing.cards[0], id: "unknown", catalogKey: null, name: "Unknown legacy card" });
    const plan = planCatalogSynchronization({ source: predefinedCardsData, snapshot: existing });
    expect(plan.conflicts).toContain("unmatched_unkeyed_card:unknown");
  });

  it("rejects a keyed benefit whose source parent would be newly created", () => {
    const existing = snapshot();
    existing.cards[0] = {
      ...existing.cards[0],
      catalogKey: null,
      name: "Unrelated legacy card",
    };
    const plan = planCatalogSynchronization({ source: predefinedCardsData, snapshot: existing });
    expect(plan.conflicts).toContain(`benefit_parent_conflict:${predefinedCardsData[0].benefits[0].catalogKey}`);
  });

  it("does not adopt one unkeyed row by source order when two definitions share its full shape", () => {
    const source = copySource();
    source[0].benefits = [
      ...source[0].benefits,
      {
        ...source[0].benefits[0],
        catalogKey: "benefit:csp:alternate-hotel-credit-definition",
      },
    ];
    const existing = snapshot();
    existing.cards[0].catalogKey = null;
    existing.benefits[0].catalogKey = null;

    const plan = planCatalogSynchronization({ source, snapshot: existing });
    expect(plan.conflicts).toContain(`ambiguous_unkeyed_benefit:${source[0].benefits[0].catalogKey}`);
    expect(plan.benefits.find((action) => action.source?.catalogKey === source[0].benefits[0].catalogKey)?.kind)
      .toBe("create");
  });

  it("defaults to dry-run and calls no writer", async () => {
    const client = database();
    const report = await runGlobalCatalogSyncOperator({ source: predefinedCardsData, database: client });
    expect(report).toEqual(expect.objectContaining({
      mode: "dry-run",
      source: { cards: 34, benefits: 129 },
      plan: expect.objectContaining({ conflictCount: 0 }),
    }));
    expect(client.predefinedCard.create).not.toHaveBeenCalled();
    expect(client.predefinedBenefit.create).not.toHaveBeenCalled();
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("rejects apply before database access without both gates", async () => {
    const client = database();
    await expect(runGlobalCatalogSyncOperator({ source: predefinedCardsData, database: client, mode: "apply" }))
      .rejects.toThrow("target was verified");
    await expect(runGlobalCatalogSyncOperator({
      source: predefinedCardsData,
      database: client,
      mode: "apply",
      targetVerified: true,
    })).rejects.toThrow("confirmation phrase");
    expect(client.predefinedCard.findMany).not.toHaveBeenCalled();
  });

  it("validates source identity before a dry-run reads the database", async () => {
    const source = copySource();
    source[1].catalogKey = source[0].catalogKey;
    const client = database();

    await expect(runGlobalCatalogSyncOperator({ source, database: client }))
      .rejects.toThrow("Duplicate catalog key");
    expect(client.predefinedCard.findMany).not.toHaveBeenCalled();
    expect(client.predefinedBenefit.findMany).not.toHaveBeenCalled();
  });

  it("creates missing definitions atomically only after exact authorization", async () => {
    const client = database();
    const report = await runGlobalCatalogSyncOperator({
      source: predefinedCardsData,
      database: client,
      mode: "apply",
      targetVerified: true,
      confirmApply: GLOBAL_CATALOG_SYNC_CONFIRMATION,
      now: UPDATED_AT,
    });
    expect(report.plan.cards.create).toBe(34);
    expect(report.plan.benefits.create).toBe(129);
    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(client.predefinedCard.create).toHaveBeenCalledTimes(34);
    expect(client.predefinedBenefit.create).toHaveBeenCalledTimes(129);
  });

  it("rechecks the complete snapshot inside the transaction before any writer call", async () => {
    const existing = snapshot();
    const drifted = snapshot();
    drifted.cards[0] = { ...drifted.cards[0], annualFee: drifted.cards[0].annualFee + 1 };
    const client = database(existing);
    client.predefinedCard.findMany
      .mockResolvedValueOnce(existing.cards)
      .mockResolvedValueOnce(drifted.cards);
    client.predefinedBenefit.findMany
      .mockResolvedValueOnce(existing.benefits)
      .mockResolvedValueOnce(drifted.benefits);

    await expect(runGlobalCatalogSyncOperator({
      source: predefinedCardsData,
      database: client,
      mode: "apply",
      targetVerified: true,
      confirmApply: GLOBAL_CATALOG_SYNC_CONFIRMATION,
    })).rejects.toThrow("catalog_sync_compare_and_set_conflict");
    expect(client.predefinedCard.create).not.toHaveBeenCalled();
    expect(client.predefinedCard.updateMany).not.toHaveBeenCalled();
    expect(client.predefinedBenefit.create).not.toHaveBeenCalled();
    expect(client.predefinedBenefit.updateMany).not.toHaveBeenCalled();
  });

  it("uses compare-and-set updates and never recreates an existing id", async () => {
    const source = copySource();
    source[0].annualFee = 123;
    const existing = snapshot();
    const plan = planCatalogSynchronization({ source, snapshot: existing });
    const client = database(existing);
    await applyCatalogSyncPlan({ database: client, plan, retirementTime: UPDATED_AT });
    expect(client.predefinedCard.create).not.toHaveBeenCalled();
    expect(client.predefinedCard.updateMany).toHaveBeenCalledWith({
      where: { id: "card-id-0", catalogKey: "card:csp", updatedAt: UPDATED_AT },
      data: expect.objectContaining({ catalogKey: "card:csp", annualFee: 123, retiredAt: null }),
    });
  });
});
