import type { NormalizedBenefitObservationV3, StoreEnvelopeV1 } from "../contract";
import {
  AMEX_SYNC_MAX_BYTES,
  canonicalJson,
  digestAmexSyncEnvelope,
  isSyncEnvelopeFresh,
  parseAmexSyncEnvelope,
  projectLatestV3SyncEnvelope,
  type AmexSyncEnvelope,
} from "../sync-contract";

const scanId = "22222222-2222-4222-8222-222222222222";
const cardId = "11111111-1111-4111-8111-111111111111";
const finishedAt = "2026-07-15T12:00:00.000Z";

function envelope(): AmexSyncEnvelope {
  return parseAmexSyncEnvelope({
    envelopeVersion: "amex-sync-envelope/2",
    observationContractVersion: "amex-benefits/3",
    scanId,
    scanFinishedAt: finishedAt,
    cards: [{
      sourceLocalCardId: cardId,
      productKey: "american-express-platinum-card",
      endingDigits: "1234",
      observedAt: "2026-07-15T11:59:00.000Z",
      parserVersion: "amex-api-us/3.0.0",
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

function benefit(
  title = "$400 Resy Credit",
  benefitKey = "benefit-1234567890abcdef",
): NormalizedBenefitObservationV3 {
  return {
    benefitKey,
    title,
    category: { state: "observed", value: "usage" },
    activityKind: "credit_usage",
    enrollmentState: { state: "observed", value: "enrolled" },
    trackerState: { state: "observed", value: "in_progress" },
    completionState: { state: "observed", value: "incomplete" },
    earnedOrUsed: { state: "observed", value: { value: "25.00", unit: "USD", currency: "USD" } },
    targetOrLimit: { state: "observed", value: { value: "100.00", unit: "USD", currency: "USD" } },
    remaining: { state: "observed", value: { value: "75.00", unit: "USD", currency: "USD" } },
    period: { state: "observed", value: "Synthetic quarter" },
    sourcePeriod: { state: "observed", value: {
      kind: "calendar_date_range",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      timeZone: "UTC",
    } },
    confidence: "high",
    issueCodes: [],
  };
}

function v3Store(productName = "American Express Platinum Card"): StoreEnvelopeV1 {
  const observedAt = "2026-07-15T11:59:00.000Z";
  return {
    schemaVersion: 1,
    revision: 1,
    updatedAt: finishedAt,
    cards: {
      [cardId]: {
        localCardId: cardId,
        identity: { sourceFingerprint: "a".repeat(64), productName, endingDigits: "1234" },
        latest: {
          contractVersion: "amex-benefits/3",
          issuer: "american_express_us",
          localCardId: cardId,
          productName,
          endingDigits: "1234",
          observedAt,
          parserVersion: "amex-api-us/3.0.0",
          scanId,
          completeness: "complete",
          issueCodes: [],
          benefits: [benefit()],
        },
        freshness: "current",
        completeness: "complete",
        observedAt,
        lastAttemptAt: observedAt,
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

function addValidCard(store: StoreEnvelopeV1): void {
  const secondId = "33333333-3333-4333-8333-333333333333";
  const source = store.cards[cardId];
  if (!source.latest || source.latest.contractVersion !== "amex-benefits/3") throw new Error("Expected V3 fixture.");
  store.cards[secondId] = {
    ...source,
    localCardId: secondId,
    identity: { ...source.identity, sourceFingerprint: "b".repeat(64), endingDigits: "5678" },
    latest: {
      ...source.latest,
      localCardId: secondId,
      endingDigits: "5678",
      benefits: [benefit("$300 lululemon Credit", "benefit-fedcba0987654321")],
    },
  };
  store.lastScan!.discoveredCardCount = 2;
  store.lastScan!.attemptedCardCount = 2;
  store.lastScan!.cards.push({ localCardId: secondId, result: "complete", issueCode: null });
}

describe("Amex sync transport contract", () => {
  it("canonicalizes keys and produces a stable envelope digest", async () => {
    const value = envelope();
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
    await expect(digestAmexSyncEnvelope(value)).resolves.toMatch(/^[a-f0-9]{64}$/);
    await expect(digestAmexSyncEnvelope({ ...value })).resolves.toBe(await digestAmexSyncEnvelope(value));
  });

  it("requires V2 transport over V3 observations and rejects forbidden or invalid transport", () => {
    const value = envelope();
    expect(value).toMatchObject({
      envelopeVersion: "amex-sync-envelope/2",
      observationContractVersion: "amex-benefits/3",
    });
    expect(() => parseAmexSyncEnvelope({ ...value, sourceFingerprint: "a".repeat(64) })).toThrow("forbidden field");
    expect(() => parseAmexSyncEnvelope({ ...value, extra: true })).toThrow();
    expect(() => parseAmexSyncEnvelope({ ...value, envelopeVersion: "amex-sync-envelope/1" })).toThrow();
    expect(() => parseAmexSyncEnvelope({ ...value, observationContractVersion: "amex-benefits/2" })).toThrow();
    expect(() => parseAmexSyncEnvelope({ ...value, cards: [value.cards[0], value.cards[0]] })).toThrow("unique");
    expect(() => parseAmexSyncEnvelope({
      ...value,
      cards: [{ ...value.cards[0], observedAt: "2026-07-15T12:00:00.001Z" }],
    })).toThrow("newer than its completed scan");
    expect(() => parseAmexSyncEnvelope({
      ...value,
      cards: [{ ...value.cards[0], parserVersion: "amex-api-us/2.0.2" }],
    })).toThrow();
    const huge = { ...value, cards: [{ ...value.cards[0], parserVersion: "x".repeat(AMEX_SYNC_MAX_BYTES) }] };
    expect(() => parseAmexSyncEnvelope(huge)).toThrow();
  });

  it("projects destination authority only from exact approved product-title pairs", () => {
    const projected = projectLatestV3SyncEnvelope(v3Store());
    expect(projected.reason).toBe("ready");
    expect(projected.envelope?.cards[0]).toMatchObject({
      sourceLocalCardId: cardId,
      productKey: "american-express-platinum-card",
      parserVersion: "amex-api-us/3.0.0",
      rows: [{ creditFamilyKey: "american-express-platinum-card:resy" }],
    });

    for (const [productName, title] of [
      ["Morgan Stanley Platinum", "$400 Resy Credit"],
      ["Hilton Honors Card", "$400 Resy Credit"],
      ["Delta SkyMiles Gold Business Card", "$150 Delta Stays Credit"],
      ["American Express Platinum Card Extra", "$400 Resy Credit"],
      ["American Express Platinum Card", "$401 Resy Credit"],
      ["American Express Platinum Card", "$219 CLEAR+ Credit"],
      ["American Express Platinum Card", "$300 Equinox Credit"],
      ["American Express Platinum Card", "$200 Airline Fee Credit"],
    ]) {
      const store = v3Store(productName);
      const latest = store.cards[cardId].latest;
      if (!latest || latest.contractVersion !== "amex-benefits/3") throw new Error("Expected V3 fixture.");
      latest.benefits = [benefit(title)];
      expect(projectLatestV3SyncEnvelope(store)).toEqual({ envelope: null, reason: "no_complete_cards" });
    }
  });

  it("excludes the whole source card when exact titles collide on one destination family", () => {
    const store = v3Store();
    addValidCard(store);
    const latest = store.cards[cardId].latest;
    if (!latest || latest.contractVersion !== "amex-benefits/3") throw new Error("Expected V3 fixture.");
    latest.benefits = [
      benefit("Resy Credit", "benefit-aaaaaaaaaaaaaaaa"),
      benefit("$400 Resy Credit", "benefit-bbbbbbbbbbbbbbbb"),
    ];

    const projected = projectLatestV3SyncEnvelope(store);
    expect(projected.reason).toBe("ready");
    expect(projected.envelope?.cards.map((card) => card.sourceLocalCardId)).toEqual([
      "33333333-3333-4333-8333-333333333333",
    ]);
    expect(projected.envelope?.exclusions).toContainEqual({ reason: "source_mapping_ambiguous", count: 2 });
  });

  it("requires the latest complete current-parser successful V3 scan", () => {
    const partial = v3Store();
    partial.cards[cardId].completeness = "partial";
    partial.cards[cardId].latest!.completeness = "partial";
    expect(projectLatestV3SyncEnvelope(partial)).toEqual({ envelope: null, reason: "no_complete_cards" });

    const older = v3Store();
    if (older.cards[cardId].latest?.contractVersion !== "amex-benefits/3") throw new Error("Expected V3 fixture.");
    older.cards[cardId].latest.scanId = "44444444-4444-4444-8444-444444444444";
    expect(projectLatestV3SyncEnvelope(older)).toEqual({ envelope: null, reason: "no_complete_cards" });

    const v1 = v3Store();
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
    expect(projectLatestV3SyncEnvelope(v1)).toEqual({ envelope: null, reason: "no_complete_cards" });

    const noSummary = v3Store();
    noSummary.lastScan = null;
    expect(projectLatestV3SyncEnvelope(noSummary)).toEqual({ envelope: null, reason: "fresh_v3_scan_required" });
  });

  it("uses the injected time for the exact 30-minute freshness boundary", () => {
    const value = envelope();
    expect(isSyncEnvelopeFresh(value, new Date("2026-07-15T12:30:00.000Z"))).toBe(true);
    expect(isSyncEnvelopeFresh(value, new Date("2026-07-15T12:30:00.001Z"))).toBe(false);
    expect(isSyncEnvelopeFresh(value, new Date("2026-07-15T11:58:59.999Z"))).toBe(false);
  });
});
