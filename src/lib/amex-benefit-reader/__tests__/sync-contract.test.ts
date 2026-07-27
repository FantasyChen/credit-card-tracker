import type { StoreEnvelopeV1 } from "../contract";
import {
  AMEX_SYNC_MAX_BYTES,
  canonicalJson,
  digestAmexSyncEnvelope,
  isSyncEnvelopeFresh,
  parseAmexSyncEnvelope,
  projectLatestV2SyncEnvelope,
  type AmexSyncEnvelope,
} from "../sync-contract";

const scanId = "22222222-2222-4222-8222-222222222222";
const cardId = "11111111-1111-4111-8111-111111111111";
const finishedAt = "2026-07-15T12:00:00.000Z";

function envelope(): AmexSyncEnvelope {
  return parseAmexSyncEnvelope({
    envelopeVersion: "amex-sync-envelope/1",
    observationContractVersion: "amex-benefits/2",
    scanId,
    scanFinishedAt: finishedAt,
    cards: [{
      sourceLocalCardId: cardId,
      productKey: "american-express-platinum-card",
      endingDigits: "1234",
      observedAt: "2026-07-15T11:59:00.000Z",
      parserVersion: "amex-api-us/2.0.2",
      rows: [{
        creditFamilyKey: "american-express-platinum-card:resy",
        sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-09-30", timeZone: "UTC" },
        enrollmentState: "enrolled",
        completionState: "incomplete",
        earnedOrUsed: { value: "25.00", unit: "USD", currency: "USD" },
        targetOrLimit: { value: "100.00", unit: "USD", currency: "USD" },
      }],
    }],
    exclusions: [],
  });
}

function v2Store(): StoreEnvelopeV1 {
  const observation = {
    contractVersion: "amex-benefits/2" as const,
    issuer: "american_express_us" as const,
    localCardId: cardId,
    productName: "American Express Platinum Card",
    productKey: "american-express-platinum-card" as const,
    endingDigits: "1234",
    observedAt: "2026-07-15T11:59:00.000Z",
    parserVersion: "amex-api-us/2.0.2",
    scanId,
    completeness: "complete" as const,
    issueCodes: [],
    benefits: [{
      benefitKey: "benefit-1234567890abcdef",
      title: "Synthetic Resy credit",
      category: { state: "observed" as const, value: "usage" },
      activityKind: "spend_progress" as const,
      enrollmentState: { state: "observed" as const, value: "enrolled" as const },
      trackerState: { state: "observed" as const, value: "in_progress" as const },
      completionState: { state: "observed" as const, value: "incomplete" as const },
      earnedOrUsed: { state: "observed" as const, value: { value: "25.00", unit: "USD" as const, currency: "USD" as const } },
      targetOrLimit: { state: "observed" as const, value: { value: "100.00", unit: "USD" as const, currency: "USD" as const } },
      remaining: { state: "observed" as const, value: { value: "75.00", unit: "USD" as const, currency: "USD" as const } },
      period: { state: "observed" as const, value: "Synthetic quarter" },
      creditFamilyKey: "american-express-platinum-card:resy",
      sourcePeriod: { state: "observed" as const, value: { kind: "calendar_date_range" as const, startDate: "2026-07-01", endDate: "2026-09-30", timeZone: "UTC" as const } },
      confidence: "high" as const,
      issueCodes: [],
    }],
  };
  return {
    schemaVersion: 1,
    revision: 1,
    updatedAt: finishedAt,
    cards: {
      [cardId]: {
        localCardId: cardId,
        identity: { sourceFingerprint: "a".repeat(64), productName: observation.productName, endingDigits: "1234" },
        latest: observation,
        freshness: "current",
        completeness: "complete",
        observedAt: observation.observedAt,
        lastAttemptAt: observation.observedAt,
        error: null,
      },
    },
    lastScan: {
      scanId,
      startedAt: "2026-07-15T11:58:00.000Z",
      finishedAt,
      status: "complete",
      discoveredCardCount: 1,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 0,
      cards: [{ localCardId: cardId, result: "complete", issueCode: null }],
      visibleContext: "unchanged",
    },
  };
}

describe("Amex sync transport contract", () => {
  it("canonicalizes keys and produces a stable envelope digest", async () => {
    const value = envelope();
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
    await expect(digestAmexSyncEnvelope(value)).resolves.toMatch(/^[a-f0-9]{64}$/);
    await expect(digestAmexSyncEnvelope({ ...value })).resolves.toBe(await digestAmexSyncEnvelope(value));
  });

  it("rejects unknown, forbidden, duplicate-card, and oversized transport", () => {
    const value = envelope();
    expect(() => parseAmexSyncEnvelope({ ...value, sourceFingerprint: "a".repeat(64) })).toThrow("forbidden field");
    expect(() => parseAmexSyncEnvelope({ ...value, extra: true })).toThrow();
    expect(() => parseAmexSyncEnvelope({ ...value, cards: [value.cards[0], value.cards[0]] })).toThrow("unique");
    expect(() => parseAmexSyncEnvelope({
      ...value,
      cards: [{ ...value.cards[0], observedAt: "2026-07-15T12:00:00.001Z" }],
    })).toThrow("newer than its completed scan");
    const huge = { ...value, cards: [{ ...value.cards[0], parserVersion: "x".repeat(AMEX_SYNC_MAX_BYTES) }] };
    expect(() => parseAmexSyncEnvelope(huge)).toThrow();
  });

  it("projects only the latest complete current-parser V2 scan and never upgrades older data", () => {
    const projected = projectLatestV2SyncEnvelope(v2Store());
    expect(projected.reason).toBe("ready");
    expect(projected.envelope?.cards[0]).toMatchObject({
      sourceLocalCardId: cardId,
      productKey: "american-express-platinum-card",
      rows: [{ creditFamilyKey: "american-express-platinum-card:resy" }],
    });

    const v1 = v2Store();
    const latest = v1.cards[cardId].latest!;
    v1.cards[cardId].latest = {
      contractVersion: "amex-benefits/1",
      issuer: latest.issuer,
      localCardId: latest.localCardId,
      productName: latest.productName,
      endingDigits: latest.endingDigits,
      observedAt: latest.observedAt,
      parserVersion: "fixture/1",
      completeness: latest.completeness,
      issueCodes: latest.issueCodes,
      benefits: [],
    };
    expect(projectLatestV2SyncEnvelope(v1)).toEqual({ envelope: null, reason: "no_complete_cards" });

    const outdated = v2Store();
    outdated.cards[cardId].latest!.parserVersion = "amex-api-us/2.0.1";
    expect(projectLatestV2SyncEnvelope(outdated)).toEqual({ envelope: null, reason: "no_complete_cards" });
    expect(() => parseAmexSyncEnvelope({
      ...envelope(),
      cards: [{ ...envelope().cards[0], parserVersion: "amex-api-us/2.0.1" }],
    })).toThrow();
  });

  it("reapplies supported-credit retention before sync projection without relaxing complete-card gates", () => {
    const store = v2Store();
    const latest = store.cards[cardId].latest;
    if (!latest || latest.contractVersion !== "amex-benefits/2") throw new Error("Expected a V2 fixture.");
    const retained = latest.benefits[0];
    latest.benefits = [
      retained,
      {
        ...retained,
        benefitKey: "benefit-spend-1234567890abcdef",
        title: "Resy Dining Credit",
        category: { state: "observed", value: "spend" },
      },
      {
        ...retained,
        benefitKey: "benefit-profile-1234567890abcdef",
        title: "Link Your Resy Profile",
      },
    ];

    const projected = projectLatestV2SyncEnvelope(store);
    expect(projected.reason).toBe("ready");
    expect(projected.envelope?.cards[0].rows).toEqual([
      expect.objectContaining({ creditFamilyKey: "american-express-platinum-card:resy" }),
    ]);

    latest.completeness = "partial";
    latest.issueCodes = ["benefit_identity_conflict"];
    store.cards[cardId].completeness = "partial";
    store.lastScan!.cards[0] = { localCardId: cardId, result: "partial", issueCode: "benefit_identity_conflict" };
    expect(projectLatestV2SyncEnvelope(store)).toEqual({ envelope: null, reason: "no_complete_cards" });
  });

  it("uses the injected time for the exact 30-minute freshness boundary", () => {
    const value = envelope();
    expect(isSyncEnvelopeFresh(value, new Date("2026-07-15T12:30:00.000Z"))).toBe(true);
    expect(isSyncEnvelopeFresh(value, new Date("2026-07-15T12:30:00.001Z"))).toBe(false);
    expect(isSyncEnvelopeFresh(value, new Date("2026-07-15T11:58:59.999Z"))).toBe(false);
  });
});
