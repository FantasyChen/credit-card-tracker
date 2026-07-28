import { storeEnvelopeSchema, type NormalizedBenefitObservationV1 } from "@/lib/amex-benefit-reader/contract";
import { IDENTITY_SECRET_KEY, STORE_KEY } from "@/lib/amex-benefit-reader/storage-policy";
import {
  AMEX_SYNC_MAILBOX_KEY,
  LEGACY_AMEX_SYNC_MAILBOX_KEY,
} from "@/lib/amex-benefit-reader/sync-mailbox";
import {
  PRIMARY_ONLY_COMPATIBILITY_KEY,
  PRIMARY_ONLY_COMPATIBILITY_VALUE,
  V3_SELECTION_COMPATIBILITY_KEY,
  V3_SELECTION_COMPATIBILITY_VALUE,
  TampermonkeyResultStore,
} from "../tampermonkey-storage";

interface FakeGm {
  getValue: jest.Mock<Promise<unknown>, [string, unknown?]>;
  setValue: jest.Mock<Promise<void>, [string, unknown]>;
  deleteValue: jest.Mock<Promise<void>, [string]>;
}

const localCardId = "11111111-1111-4111-8111-111111111111";
const scanId = "22222222-2222-4222-8222-222222222222";
const observedAt = "2026-07-15T12:00:00.000Z";

function storedBenefit(title: string): NormalizedBenefitObservationV1 {
  return {
    benefitKey: `legacy-benefit-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    category: { state: "observed", value: "usage" },
    activityKind: "spend_progress",
    enrollmentState: { state: "not_exposed" },
    trackerState: { state: "not_exposed" },
    completionState: { state: "not_exposed" },
    earnedOrUsed: { state: "not_exposed" },
    targetOrLimit: { state: "not_exposed" },
    remaining: { state: "not_exposed" },
    period: { state: "not_exposed" },
    confidence: "high",
    issueCodes: [],
  };
}

function legacyStore(version: 1 | 2) {
  const benefit = storedBenefit("Dining Credit");
  const latest = version === 1
    ? {
      contractVersion: "amex-benefits/1",
      issuer: "american_express_us",
      localCardId,
      productName: "American Express Gold Card",
      endingDigits: "1234",
      observedAt,
      parserVersion: "amex-api-us/1.0.0",
      completeness: "complete",
      issueCodes: [],
      benefits: [benefit],
    }
    : {
      contractVersion: "amex-benefits/2",
      issuer: "american_express_us",
      localCardId,
      productName: "American Express Platinum Card",
      productKey: "american-express-platinum-card",
      endingDigits: "1234",
      observedAt,
      parserVersion: "amex-api-us/2.0.2",
      scanId,
      completeness: "complete",
      issueCodes: [],
      benefits: [{
        ...benefit,
        creditFamilyKey: "american-express-platinum-card:resy",
        sourcePeriod: { state: "not_exposed" },
      }],
    };
  return storeEnvelopeSchema.parse({
    schemaVersion: 1,
    revision: 4,
    updatedAt: observedAt,
    cards: {
      [localCardId]: {
        localCardId,
        identity: {
          sourceFingerprint: "a".repeat(64),
          productName: latest.productName,
          endingDigits: "1234",
        },
        latest,
        freshness: "current",
        completeness: "complete",
        observedAt,
        lastAttemptAt: observedAt,
        error: null,
      },
    },
    lastScan: {
      scanId,
      startedAt: "2026-07-15T11:59:00.000Z",
      finishedAt: observedAt,
      status: "complete",
      discoveredCardCount: 1,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 0,
      cards: [{ localCardId, result: "complete", issueCode: null }],
      visibleContext: "unchanged",
    },
  });
}

function currentEmptyHiltonV3Store() {
  return storeEnvelopeSchema.parse({
    schemaVersion: 1,
    revision: 7,
    updatedAt: observedAt,
    cards: {
      [localCardId]: {
        localCardId,
        identity: {
          sourceFingerprint: "c".repeat(64),
          productName: "Hilton Honors Card",
          endingDigits: "1234",
        },
        latest: {
          contractVersion: "amex-benefits/3",
          issuer: "american_express_us",
          localCardId,
          productName: "Hilton Honors Card",
          endingDigits: "1234",
          observedAt,
          parserVersion: "amex-api-us/3.0.0",
          scanId,
          completeness: "complete",
          issueCodes: [],
          benefits: [],
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
      startedAt: "2026-07-15T11:59:00.000Z",
      finishedAt: observedAt,
      status: "complete",
      discoveredCardCount: 1,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 0,
      cards: [{ localCardId, result: "complete", issueCode: null }],
      visibleContext: "unchanged",
    },
  });
}

describe("Tampermonkey storage adapter", () => {
  let gm: FakeGm;

  beforeEach(() => {
    gm = {
      getValue: jest.fn<Promise<unknown>, [string, unknown?]>(async () => null),
      setValue: jest.fn<Promise<void>, [string, unknown]>(async () => undefined),
      deleteValue: jest.fn<Promise<void>, [string]>(async () => undefined),
    };
    (globalThis as unknown as { GM: FakeGm }).GM = gm;
  });

  afterEach(() => {
    delete (globalThis as unknown as { GM?: FakeGm }).GM;
  });

  it("marks a new empty installation only after deleting both mailbox generations", async () => {
    await expect(new TampermonkeyResultStore().load()).resolves.toMatchObject({
      schemaVersion: 1,
      revision: 0,
      cards: {},
      lastScan: null,
    });
    expect(gm.setValue).toHaveBeenCalledWith(
      PRIMARY_ONLY_COMPATIBILITY_KEY,
      PRIMARY_ONLY_COMPATIBILITY_VALUE,
    );
    expect(gm.setValue).toHaveBeenCalledWith(
      V3_SELECTION_COMPATIBILITY_KEY,
      V3_SELECTION_COMPATIBILITY_VALUE,
    );
    expect(gm.setValue).not.toHaveBeenCalledWith(STORE_KEY, expect.anything());
    expect(gm.deleteValue).toHaveBeenCalledWith(LEGACY_AMEX_SYNC_MAILBOX_KEY);
    expect(gm.deleteValue).toHaveBeenCalledWith(AMEX_SYNC_MAILBOX_KEY);
  });

  it.each([1, 2] as const)(
    "invalidates V%s observations and lastScan once while preserving identity",
    async (version) => {
      const values = new Map<string, unknown>([
        [STORE_KEY, legacyStore(version)],
        [IDENTITY_SECRET_KEY, "f".repeat(64)],
        [PRIMARY_ONLY_COMPATIBILITY_KEY, PRIMARY_ONLY_COMPATIBILITY_VALUE],
        [LEGACY_AMEX_SYNC_MAILBOX_KEY, { syntheticLegacyMailbox: true }],
        [AMEX_SYNC_MAILBOX_KEY, { syntheticCurrentMailbox: true }],
      ]);
      gm.getValue.mockImplementation(async (key, defaultValue) =>
        values.has(key) ? values.get(key) : defaultValue);
      gm.setValue.mockImplementation(async (key, value) => { values.set(key, value); });
      gm.deleteValue.mockImplementation(async (key) => { values.delete(key); });

      const store = new TampermonkeyResultStore();
      const first = await store.load();
      const second = await store.load();

      expect(first).toMatchObject({ revision: 5, cards: {}, lastScan: null });
      expect(second).toEqual(first);
      expect(values.get(IDENTITY_SECRET_KEY)).toBe("f".repeat(64));
      expect(values.has(LEGACY_AMEX_SYNC_MAILBOX_KEY)).toBe(false);
      expect(values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);
      expect(values.get(V3_SELECTION_COMPATIBILITY_KEY)).toBe(V3_SELECTION_COMPATIBILITY_VALUE);
      expect(gm.setValue.mock.calls.filter(([key]) => key === STORE_KEY)).toHaveLength(1);
      expect(gm.setValue.mock.calls.filter(([key]) => key === V3_SELECTION_COMPATIBILITY_KEY)).toHaveLength(1);
    },
  );

  it("does not let concurrent compatibility loads restore a pre-migration snapshot", async () => {
    const values = new Map<string, unknown>([[STORE_KEY, legacyStore(2)]]);
    gm.getValue.mockImplementation(async (key, defaultValue) =>
      values.has(key) ? values.get(key) : defaultValue);
    gm.setValue.mockImplementation(async (key, value) => { values.set(key, value); });
    gm.deleteValue.mockImplementation(async (key) => { values.delete(key); });

    const store = new TampermonkeyResultStore();
    const [first, second] = await Promise.all([store.load(), store.load()]);

    expect(first).toMatchObject({ revision: 5, cards: {}, lastScan: null });
    expect(second).toEqual(first);
    expect(values.get(STORE_KEY)).toEqual(first);
    expect(values.get(PRIMARY_ONLY_COMPATIBILITY_KEY)).toBe(PRIMARY_ONLY_COMPATIBILITY_VALUE);
    expect(values.get(V3_SELECTION_COMPATIBILITY_KEY)).toBe(V3_SELECTION_COMPATIBILITY_VALUE);
  });

  it("preserves a complete empty V3 Hilton observation while invalidating legacy lastScan authority", async () => {
    const values = new Map<string, unknown>([
      [STORE_KEY, currentEmptyHiltonV3Store()],
      [PRIMARY_ONLY_COMPATIBILITY_KEY, PRIMARY_ONLY_COMPATIBILITY_VALUE],
    ]);
    gm.getValue.mockImplementation(async (key, defaultValue) =>
      values.has(key) ? values.get(key) : defaultValue);
    gm.setValue.mockImplementation(async (key, value) => { values.set(key, value); });
    gm.deleteValue.mockImplementation(async (key) => { values.delete(key); });

    const loaded = await new TampermonkeyResultStore().load();
    expect(loaded).toMatchObject({
      revision: 8,
      lastScan: null,
      cards: {
        [localCardId]: {
          latest: {
            contractVersion: "amex-benefits/3",
            productName: "Hilton Honors Card",
            completeness: "complete",
            benefits: [],
          },
        },
      },
    });
    expect(values.get(V3_SELECTION_COMPATIBILITY_KEY)).toBe(V3_SELECTION_COMPATIBILITY_VALUE);
  });

  it("leaves V3 migration unmarked and retryable when invalidated-store persistence fails", async () => {
    const original = legacyStore(2);
    const values = new Map<string, unknown>([
      [STORE_KEY, original],
      [PRIMARY_ONLY_COMPATIBILITY_KEY, PRIMARY_ONLY_COMPATIBILITY_VALUE],
      [AMEX_SYNC_MAILBOX_KEY, { syntheticPendingMailbox: true }],
    ]);
    gm.getValue.mockImplementation(async (key, defaultValue) =>
      values.has(key) ? values.get(key) : defaultValue);
    gm.deleteValue.mockImplementation(async (key) => { values.delete(key); });
    gm.setValue.mockImplementation(async (key, value) => {
      if (key === STORE_KEY) throw new Error("synthetic store persistence failure");
      values.set(key, value);
    });

    const store = new TampermonkeyResultStore();
    await expect(store.load()).rejects.toThrow("synthetic store persistence failure");
    expect(values.get(STORE_KEY)).toBe(original);
    expect(values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);
    expect(values.has(V3_SELECTION_COMPATIBILITY_KEY)).toBe(false);

    gm.setValue.mockImplementation(async (key, value) => { values.set(key, value); });
    await expect(store.load()).resolves.toMatchObject({ revision: 5, cards: {}, lastScan: null });
    expect(values.get(V3_SELECTION_COMPATIBILITY_KEY)).toBe(V3_SELECTION_COMPATIBILITY_VALUE);
  });

  it("retries marker-last after marker persistence fails without another revision", async () => {
    const values = new Map<string, unknown>([
      [STORE_KEY, legacyStore(1)],
      [PRIMARY_ONLY_COMPATIBILITY_KEY, PRIMARY_ONLY_COMPATIBILITY_VALUE],
    ]);
    gm.getValue.mockImplementation(async (key, defaultValue) =>
      values.has(key) ? values.get(key) : defaultValue);
    gm.deleteValue.mockImplementation(async (key) => { values.delete(key); });
    let failMarker = true;
    gm.setValue.mockImplementation(async (key, value) => {
      if (key === V3_SELECTION_COMPATIBILITY_KEY && failMarker) {
        failMarker = false;
        throw new Error("synthetic marker failure");
      }
      values.set(key, value);
    });

    const store = new TampermonkeyResultStore();
    await expect(store.load()).rejects.toThrow("synthetic marker failure");
    expect(values.get(STORE_KEY)).toMatchObject({ revision: 5, cards: {}, lastScan: null });
    expect(values.has(V3_SELECTION_COMPATIBILITY_KEY)).toBe(false);

    await expect(store.load()).resolves.toMatchObject({ revision: 5, cards: {}, lastScan: null });
    expect(values.get(V3_SELECTION_COMPATIBILITY_KEY)).toBe(V3_SELECTION_COMPATIBILITY_VALUE);
    expect(gm.setValue.mock.calls.filter(([key]) => key === STORE_KEY)).toHaveLength(1);
  });

  it("refuses malformed local data unchanged and unmarked", async () => {
    const malformed = {
      schemaVersion: 1,
      revision: 4,
      updatedAt: observedAt,
      cards: "not-a-card-map",
      lastScan: null,
    };
    gm.getValue.mockImplementation(async (key, defaultValue) =>
      key === STORE_KEY ? malformed : defaultValue);

    await expect(new TampermonkeyResultStore().load()).rejects.toThrow();
    expect(gm.setValue).not.toHaveBeenCalled();
    expect(gm.deleteValue).not.toHaveBeenCalled();
  });

  it("refuses a future-schema store unchanged and unmarked", async () => {
    const futureStore = {
      schemaVersion: 2,
      revision: 1,
      updatedAt: observedAt,
      cards: {},
      lastScan: null,
    };
    gm.getValue.mockImplementation(async (key, defaultValue) =>
      key === STORE_KEY ? futureStore : defaultValue);

    await expect(new TampermonkeyResultStore().load()).rejects.toThrow("newer unsupported schema");
    expect(gm.setValue).not.toHaveBeenCalled();
    expect(gm.deleteValue).not.toHaveBeenCalled();
  });

  it("clears store, identity, both mailboxes, and both compatibility markers", async () => {
    await new TampermonkeyResultStore().clear();
    expect(gm.deleteValue.mock.calls.map(([key]) => key).sort()).toEqual([
      AMEX_SYNC_MAILBOX_KEY,
      IDENTITY_SECRET_KEY,
      LEGACY_AMEX_SYNC_MAILBOX_KEY,
      PRIMARY_ONLY_COMPATIBILITY_KEY,
      STORE_KEY,
      V3_SELECTION_COMPATIBILITY_KEY,
    ].sort());
  });
});
