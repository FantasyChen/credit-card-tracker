import { catalogResponseSchema, memberResponseSchema, trackerResponseSchema, type MemberResponse } from "../amex-api-contract";
import { AmexApiError } from "../amex-api-client";
import { AmexBenefitScanEngine, type AmexReadClient, type ResultStore, type ScanProgress, type VisibleContextGuard } from "../scan-engine";
import { createEmptyStore, mergeCardAttempt, mergeScanSummary, type CardAttemptResult } from "../storage-policy";
import type { ScanSummaryV1, StoreEnvelopeV1, StoredCardRecordV1 } from "../contract";

const times = [
  "2026-07-15T12:00:00.000Z", "2026-07-15T12:01:00.000Z", "2026-07-15T12:02:00.000Z",
  "2026-07-15T12:03:00.000Z", "2026-07-15T12:04:00.000Z", "2026-07-15T12:05:00.000Z",
];

const memberResponse = memberResponseSchema.parse({ accounts: [
  { account_token: "invented-token-a", relationship: "BASIC", product: { description: "American Express Business Platinum Card" }, display_account_number: "1234" },
  { account_token: "invented-token-b", relationship: "BASIC", product: { description: "American Express Business Platinum Card" }, display_account_number: "54321" },
] });
const trackers = trackerResponseSchema.parse([{ trackers: [{
  benefitName: "Synthetic Wireless Bill Credit",
  category: "usage",
  status: "ACTIVE",
  tracker: { spentAmount: "1", targetAmount: "5", targetUnit: "PASSES" },
}] }]);
const catalog = catalogResponseSchema.parse({ benefits: {} });

class MemoryStore implements ResultStore {
  value: StoreEnvelopeV1;
  attempts: CardAttemptResult[] = [];
  summaries: ScanSummaryV1[] = [];
  constructor(initial: StoreEnvelopeV1) { this.value = initial; }
  async load() { return this.value; }
  async commitCard(attempt: CardAttemptResult): Promise<StoredCardRecordV1> {
    this.attempts.push(attempt);
    const merged = mergeCardAttempt(this.value, attempt);
    this.value = merged.store;
    return merged.record;
  }
  async recordScanSummary(summary: ScanSummaryV1) {
    this.summaries.push(summary);
    this.value = mergeScanSummary(this.value, summary);
  }
  async clear() { this.value = createEmptyStore(times[0]); }
}

function existingRecord(localCardId: string, fingerprint: string, endingDigits: string): StoredCardRecordV1 {
  return {
    localCardId,
    identity: { sourceFingerprint: fingerprint, productName: "American Express Business Platinum Card", endingDigits },
    latest: null,
    freshness: "error_no_data",
    completeness: "failed",
    observedAt: null,
    lastAttemptAt: times[0],
    error: { code: "network_error", message: "Synthetic fixture failure." },
  };
}

function makeStore(): MemoryStore {
  const firstId = "11111111-1111-4111-8111-111111111111";
  const secondId = "22222222-2222-4222-8222-222222222222";
  const value = createEmptyStore(times[0]);
  value.cards[firstId] = existingRecord(firstId, "a".repeat(64), "1234");
  value.cards[secondId] = existingRecord(secondId, "b".repeat(64), "54321");
  return new MemoryStore(value);
}

const identity = {
  prepareCard: async (card: { rawAccountToken: string; productName: string; endingDigits: string }) => ({
    productName: card.productName,
    endingDigits: card.endingDigits,
    sourceFingerprint: card.rawAccountToken.endsWith("a") ? "a".repeat(64) : "b".repeat(64),
  }),
};

function setupClient(failToken: string | null = null): { client: AmexReadClient; calls: string[] } {
  const calls: string[] = [];
  const client: AmexReadClient = {
    discoverAccounts: async () => { calls.push("discover"); return memberResponse; },
    readBenefitTrackers: async (token) => {
      calls.push(`trackers:${token}`);
      if (token === failToken) throw new AmexApiError("network_error");
      return trackers;
    },
    readBenefitCatalog: async (token) => { calls.push(`catalog:${token}`); return catalog; },
  };
  return { client, calls };
}

function visible(unchanged = true): VisibleContextGuard {
  return {
    capture: () => ({ route: "/card-benefits/view-all", selectedCardDisplayFingerprint: "fixture-display" }),
    verifyUnchanged: () => unchanged,
  };
}

describe("API Amex scan engine", () => {
  it("processes every card sequentially, commits independently, and persists no raw tokens", async () => {
    const { client, calls } = setupClient();
    const store = makeStore();
    const events: ScanProgress[] = [];
    let index = 0;
    const summary = await new AmexBenefitScanEngine(
      client,
      visible(),
      store,
      identity,
      { report: (event) => events.push(event) },
      { now: () => new Date(times[Math.min(index++, times.length - 1)]) },
    ).scanAllCards();

    expect(calls).toEqual([
      "discover",
      "trackers:invented-token-a",
      "catalog:invented-token-a",
      "trackers:invented-token-b",
      "catalog:invented-token-b",
    ]);
    expect(summary).toMatchObject({
      status: "complete",
      discoveredCardCount: 2,
      attemptedCardCount: 2,
      unknownAccountVariantCount: 0,
      visibleContext: "unchanged",
    });
    expect(store.attempts.map((attempt) => attempt.disposition)).toEqual(["complete", "complete"]);
    expect(events.at(-1)?.type).toBe("finished");
    const serialized = JSON.stringify(store.value);
    expect(serialized).not.toContain("invented-token");
    expect(serialized).not.toMatch(/accountToken|rawResponse|requestBody|authorization|cookie/i);
  });

  it("reports fixed per-card conflict diagnostics ephemerally without serializing them", async () => {
    const collisionTrackers = trackerResponseSchema.parse([{ trackers: [
      { benefitName: "Synthetic Adobe Credit", category: "usage", status: "ACTIVE", tracker: { spentAmount: "1", targetUnit: "PASSES" } },
      { benefitName: "Synthetic Adobe Credit", category: "usage", status: "ACTIVE", tracker: { spentAmount: "2", targetUnit: "PASSES" } },
    ] }]);
    const client: AmexReadClient = {
      discoverAccounts: async () => memberResponse,
      readBenefitTrackers: async () => collisionTrackers,
      readBenefitCatalog: async () => catalog,
    };
    const store = makeStore();
    const events: ScanProgress[] = [];

    const summary = await new AmexBenefitScanEngine(
      client,
      visible(),
      store,
      identity,
      { report: (event) => events.push(event) },
      { now: () => new Date(times[2]) },
    ).scanAllCards();

    const committed = events.filter((event) => event.type === "card_committed");
    expect(committed).toHaveLength(2);
    expect(committed.map((event) => event.conflictDiagnostics)).toEqual([
      ["tracker_state_collision"],
      ["tracker_state_collision"],
    ]);
    expect(committed.map((event) => event.conflictDetails)).toEqual([
      expect.objectContaining({
        totalCount: 1,
        truncated: false,
        details: [expect.objectContaining({
          conflictKey: "tracker_state_collision:adobe:01",
          reviewedCreditFamilies: ["adobe"],
          candidateCount: 2,
        })],
      }),
      expect.objectContaining({ totalCount: 1 }),
    ]);
    expect(summary.status).toBe("partial");
    expect(store.attempts.every((attempt) =>
      attempt.disposition !== "failed"
      && attempt.observation.issueCodes.includes("benefit_identity_conflict"))).toBe(true);
    const serialized = JSON.stringify(store.value);
    expect(serialized).toContain("benefit_identity_conflict");
    expect(serialized).not.toContain("tracker_state_collision");
    expect(serialized).not.toContain("conflictDiagnostics");
    expect(serialized).not.toMatch(/conflictDetails|candidateIndex|sourceRole|sameJoinId/);
  });

  it("marks an unmatched prior card stale without counting it as a current attempt disposition", async () => {
    const { client } = setupClient();
    const store = makeStore();
    const unseenId = "33333333-3333-4333-8333-333333333333";
    store.value.cards[unseenId] = existingRecord(unseenId, "c".repeat(64), "9999");
    const summary = await new AmexBenefitScanEngine(
      client, visible(), store, identity, { report: () => undefined }, { now: () => new Date(times[2]) },
    ).scanAllCards();
    expect(summary).toMatchObject({ status: "partial", discoveredCardCount: 2, attemptedCardCount: 2 });
    expect(summary.cards).toHaveLength(2);
    expect(store.value.cards[unseenId]).toMatchObject({
      freshness: "error_no_data",
      completeness: "failed",
      error: { code: "identity_ambiguous" },
    });
  });

  it("isolates a failed card and continues with the remaining physical cards", async () => {
    const { client, calls } = setupClient("invented-token-a");
    const store = makeStore();
    const summary = await new AmexBenefitScanEngine(
      client, visible(), store, identity, { report: () => undefined }, { now: () => new Date(times[2]) },
    ).scanAllCards();
    expect(summary.status).toBe("partial");
    expect(store.attempts.map((attempt) => attempt.disposition)).toEqual(["failed", "complete"]);
    expect(store.attempts[0]).toMatchObject({ errorCode: "network_error" });
    expect(calls).toContain("trackers:invented-token-b");
    expect(calls).toContain("catalog:invented-token-b");
  });

  it("preserves an existing observation as stale when that card's tracker read fails", async () => {
    const { client } = setupClient("invented-token-a");
    const store = makeStore();
    const firstId = "11111111-1111-4111-8111-111111111111";
    store.value = mergeCardAttempt(store.value, {
      disposition: "complete",
      identity: {
        localCardId: firstId,
        sourceFingerprint: "a".repeat(64),
        productName: "American Express Business Platinum Card",
        endingDigits: "1234",
      },
      attemptedAt: times[0],
      observation: {
        contractVersion: "amex-benefits/1",
        issuer: "american_express_us",
        localCardId: firstId,
        productName: "American Express Business Platinum Card",
        endingDigits: "1234",
        observedAt: times[0],
        parserVersion: "fixture/1",
        completeness: "complete",
        issueCodes: [],
        benefits: [],
      },
    }).store;

    const summary = await new AmexBenefitScanEngine(
      client, visible(), store, identity, { report: () => undefined }, { now: () => new Date(times[2]) },
    ).scanAllCards();

    expect(summary).toMatchObject({ status: "partial", discoveredCardCount: 2, attemptedCardCount: 2 });
    expect(store.value.cards[firstId]).toMatchObject({
      freshness: "stale_error",
      completeness: "failed",
      observedAt: times[0],
      lastAttemptAt: times[2],
      error: { code: "network_error" },
      latest: { observedAt: times[0] },
    });
  });

  it("commits an empty-tracker card as partial after a retried catalog 502 and continues", async () => {
    const calls: string[] = [];
    const client: AmexReadClient = {
      discoverAccounts: async () => memberResponse,
      readBenefitTrackers: async (token) => {
        calls.push(`trackers:${token}`);
        return token === "invented-token-a" ? trackerResponseSchema.parse([{ trackers: [] }]) : trackers;
      },
      readBenefitCatalog: async (token) => {
        calls.push(`catalog:${token}`);
        if (token === "invented-token-a") throw new AmexApiError("http_error");
        return catalog;
      },
    };
    const store = makeStore();
    const summary = await new AmexBenefitScanEngine(
      client, visible(), store, identity, { report: () => undefined }, { now: () => new Date(times[2]) },
    ).scanAllCards();

    expect(summary.status).toBe("partial");
    expect(store.attempts).toEqual([
      expect.objectContaining({
        disposition: "partial",
        observation: expect.objectContaining({ issueCodes: ["http_error"], benefits: [] }),
      }),
      expect.objectContaining({ disposition: "complete" }),
    ]);
    expect(calls).toContain("trackers:invented-token-b");
    expect(calls).toContain("catalog:invented-token-b");
    expect(JSON.stringify(store.value)).not.toMatch(/invented-token|rawResponse|requestBody/i);
  });

  it("retains normalized trackers when the catalog transport fails", async () => {
    const client: AmexReadClient = {
      discoverAccounts: async () => memberResponse,
      readBenefitTrackers: async () => trackers,
      readBenefitCatalog: async (token) => {
        if (token === "invented-token-a") throw new AmexApiError("network_error");
        return catalog;
      },
    };
    const store = makeStore();
    await new AmexBenefitScanEngine(
      client, visible(), store, identity, { report: () => undefined }, { now: () => new Date(times[2]) },
    ).scanAllCards();

    expect(store.attempts[0]).toMatchObject({
      disposition: "partial",
      observation: {
        completeness: "partial",
        issueCodes: ["network_error"],
        benefits: [expect.objectContaining({ title: "Synthetic Wireless Bill Credit", activityKind: "spend_progress" })],
      },
    });
  });

  it("does not degrade catalog cancellation into a partial observation", async () => {
    const calls: string[] = [];
    const client: AmexReadClient = {
      discoverAccounts: async () => memberResponse,
      readBenefitTrackers: async (token) => { calls.push(`trackers:${token}`); return trackers; },
      readBenefitCatalog: async (token) => {
        calls.push(`catalog:${token}`);
        throw new AmexApiError("scan_cancelled");
      },
    };
    const store = makeStore();
    const summary = await new AmexBenefitScanEngine(
      client, visible(), store, identity, { report: () => undefined }, { now: () => new Date(times[2]) },
    ).scanAllCards();

    expect(summary.status).toBe("interrupted");
    expect(store.attempts).toEqual([]);
    expect(calls).not.toContain("trackers:invented-token-b");
    expect(JSON.stringify(store.value)).not.toContain("invented-token");
  });

  it("keeps a catalog authentication failure hard instead of degrading it to tracker-only partial data", async () => {
    const client: AmexReadClient = {
      discoverAccounts: async () => memberResponse,
      readBenefitTrackers: async () => trackers,
      readBenefitCatalog: async (token) => {
        if (token === "invented-token-a") throw new AmexApiError("signed_out");
        return catalog;
      },
    };
    const store = makeStore();
    const summary = await new AmexBenefitScanEngine(
      client, visible(), store, identity, { report: () => undefined }, { now: () => new Date(times[2]) },
    ).scanAllCards();

    expect(summary).toMatchObject({ status: "partial", discoveredCardCount: 2, attemptedCardCount: 2 });
    expect(store.attempts).toEqual([
      expect.objectContaining({ disposition: "failed", errorCode: "signed_out" }),
      expect.objectContaining({ disposition: "complete" }),
    ]);
    expect(store.attempts[0]).not.toHaveProperty("observation");
  });

  it("reports visible context changes without clicking or restoring the page", async () => {
    const { client } = setupClient();
    const summary = await new AmexBenefitScanEngine(
      client, visible(false), makeStore(), identity, { report: () => undefined }, { now: () => new Date(times[2]) },
    ).scanAllCards();
    expect(summary).toMatchObject({ status: "partial", visibleContext: "changed" });
  });

  it("supports cancellation while retaining already committed card observations", async () => {
    const { client, calls } = setupClient();
    const store = makeStore();
    const engine = new AmexBenefitScanEngine(client, visible(), store, identity, {
      report: (event) => { if (event.type === "card_committed") engine.cancel(); },
    }, { now: () => new Date(times[2]) });
    const summary = await engine.scanAllCards();
    expect(summary.status).toBe("interrupted");
    expect(store.attempts).toHaveLength(1);
    expect(calls).not.toContain("trackers:invented-token-b");
  });

  it("records discovery schema/auth failures as redacted failed summaries", async () => {
    const store = makeStore();
    const client: AmexReadClient = {
      discoverAccounts: async () => { throw new AmexApiError("signed_out"); },
      readBenefitTrackers: async () => trackers,
      readBenefitCatalog: async () => catalog,
    };
    const summary = await new AmexBenefitScanEngine(
      client, visible(), store, identity, { report: () => undefined }, { now: () => new Date(times[2]) },
    ).scanAllCards();
    expect(summary).toMatchObject({ status: "failed", discoveredCardCount: 0 });
    expect(summary.cards).toEqual([{ localCardId: null, result: "failed", issueCode: "signed_out" }]);
  });

  it("enforces one active user-started scan per engine", async () => {
    let resolveDiscovery!: (value: MemberResponse) => void;
    const client: AmexReadClient = {
      discoverAccounts: () => new Promise((resolve) => { resolveDiscovery = resolve; }),
      readBenefitTrackers: async () => trackers,
      readBenefitCatalog: async () => catalog,
    };
    const engine = new AmexBenefitScanEngine(client, visible(), makeStore(), identity, { report: () => undefined });
    const first = engine.scanAllCards();
    await Promise.resolve();
    await expect(engine.scanAllCards()).rejects.toThrow("already active");
    resolveDiscovery(memberResponseSchema.parse({ accounts: [] }));
    await first;
  });
});
