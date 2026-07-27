import { storeEnvelopeSchema, type NormalizedBenefitObservationV1 } from "@/lib/amex-benefit-reader/contract";
import { IDENTITY_SECRET_KEY, STORE_KEY } from "@/lib/amex-benefit-reader/storage-policy";
import { AMEX_SYNC_MAILBOX_KEY } from "@/lib/amex-benefit-reader/sync-mailbox";
import {
  PRIMARY_ONLY_COMPATIBILITY_KEY,
  PRIMARY_ONLY_COMPATIBILITY_VALUE,
  TampermonkeyResultStore,
} from "../tampermonkey-storage";

interface FakeGm {
  getValue: jest.Mock<Promise<unknown>, [string, unknown?]>;
  setValue: jest.Mock<Promise<void>, [string, unknown]>;
  deleteValue: jest.Mock<Promise<void>, [string]>;
}

function storedBenefit(
  title: string,
  category: NormalizedBenefitObservationV1["category"] = { state: "not_exposed" },
): NormalizedBenefitObservationV1 {
  return {
    benefitKey: `legacy-benefit-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    category,
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

function legacyUnfilteredStore() {
  const localCardId = "11111111-1111-4111-8111-111111111111";
  const observedAt = "2026-07-15T12:00:00.000Z";
  return storeEnvelopeSchema.parse({
    schemaVersion: 1,
    revision: 4,
    updatedAt: observedAt,
    cards: {
      [localCardId]: {
        localCardId,
        identity: {
          sourceFingerprint: "a".repeat(64),
          productName: "American Express Gold Card",
          endingDigits: "1234",
        },
        latest: {
          contractVersion: "amex-benefits/1",
          issuer: "american_express_us",
          localCardId,
          productName: "American Express Gold Card",
          endingDigits: "1234",
          observedAt,
          parserVersion: "amex-api-us/1.0.0",
          completeness: "complete",
          issueCodes: [],
          benefits: [
            storedBenefit("Dining Credit", { state: "observed", value: "usage" }),
            storedBenefit("Monthly Dining Credit", { state: "observed", value: "spend" }),
            storedBenefit("Link Your Resy Profile", { state: "not_exposed" }),
            storedBenefit("Cell Phone Protection"),
          ],
        },
        freshness: "current",
        completeness: "complete",
        observedAt,
        lastAttemptAt: observedAt,
        error: null,
      },
    },
    lastScan: null,
  });
}

describe("Tampermonkey storage adapter", () => {
  let gm: FakeGm;

  function loadCompatibleStore(value: unknown): void {
    gm.getValue.mockImplementation(async (key) => {
      if (key === STORE_KEY) return value;
      if (key === PRIMARY_ONLY_COMPATIBILITY_KEY) return PRIMARY_ONLY_COMPATIBILITY_VALUE;
      return null;
    });
  }

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

  it("marks a new empty store primary-only without creating an observation envelope", async () => {
    const store = new TampermonkeyResultStore();
    await expect(store.load()).resolves.toMatchObject({ schemaVersion: 1, revision: 0, cards: {} });
    expect(gm.getValue).toHaveBeenCalledWith(STORE_KEY, null);
    expect(gm.deleteValue).toHaveBeenCalledWith(AMEX_SYNC_MAILBOX_KEY);
    expect(gm.setValue).toHaveBeenCalledTimes(1);
    expect(gm.setValue).toHaveBeenCalledWith(
      PRIMARY_ONLY_COMPATIBILITY_KEY,
      PRIMARY_ONLY_COMPATIBILITY_VALUE,
    );
    expect(gm.setValue).not.toHaveBeenCalledWith(STORE_KEY, expect.anything());
  });

  it("invalidates role-unverified cards and a pending mailbox once while preserving the identity secret", async () => {
    const values = new Map<string, unknown>([
      [STORE_KEY, legacyUnfilteredStore()],
      [IDENTITY_SECRET_KEY, "f".repeat(64)],
      [AMEX_SYNC_MAILBOX_KEY, { syntheticPendingMailbox: true }],
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
    expect(values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);
    expect(values.get(PRIMARY_ONLY_COMPATIBILITY_KEY)).toBe(PRIMARY_ONLY_COMPATIBILITY_VALUE);
    expect(gm.setValue.mock.calls.filter(([key]) => key === STORE_KEY)).toHaveLength(1);
    expect(gm.setValue.mock.calls.filter(([key]) => key === PRIMARY_ONLY_COMPATIBILITY_KEY)).toHaveLength(1);
    expect(gm.deleteValue.mock.calls.filter(([key]) => key === AMEX_SYNC_MAILBOX_KEY)).toHaveLength(1);
  });

  it("does not let a concurrent load restore a pre-migration store snapshot", async () => {
    const values = new Map<string, unknown>([[STORE_KEY, legacyUnfilteredStore()]]);
    let markerReadCount = 0;
    let releaseSecondMarker!: () => void;
    const firstMarkerWritten = new Promise<void>((resolve) => { releaseSecondMarker = resolve; });
    gm.getValue.mockImplementation(async (key, defaultValue) => {
      if (key === PRIMARY_ONLY_COMPATIBILITY_KEY) {
        markerReadCount += 1;
        if (markerReadCount === 2) await firstMarkerWritten;
      }
      return values.has(key) ? values.get(key) : defaultValue;
    });
    gm.setValue.mockImplementation(async (key, value) => {
      values.set(key, value);
      if (key === PRIMARY_ONLY_COMPATIBILITY_KEY) releaseSecondMarker();
    });
    gm.deleteValue.mockImplementation(async (key) => { values.delete(key); });

    const store = new TampermonkeyResultStore();
    const [first, second] = await Promise.all([store.load(), store.load()]);

    expect(first).toMatchObject({ revision: 5, cards: {}, lastScan: null });
    expect(second).toEqual(first);
    expect(values.get(STORE_KEY)).toEqual(first);
    expect(values.get(PRIMARY_ONLY_COMPATIBILITY_KEY)).toBe(PRIMARY_ONLY_COMPATIBILITY_VALUE);
  });

  it("leaves the migration unmarked and retryable when invalidated-store persistence fails", async () => {
    const original = legacyUnfilteredStore();
    const values = new Map<string, unknown>([
      [STORE_KEY, original],
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
    expect(values.has(PRIMARY_ONLY_COMPATIBILITY_KEY)).toBe(false);
    expect(gm.setValue).not.toHaveBeenCalledWith(
      PRIMARY_ONLY_COMPATIBILITY_KEY,
      PRIMARY_ONLY_COMPATIBILITY_VALUE,
    );

    gm.setValue.mockImplementation(async (key, value) => { values.set(key, value); });
    await expect(store.load()).resolves.toMatchObject({ revision: 5, cards: {}, lastScan: null });
    expect(values.get(PRIMARY_ONLY_COMPATIBILITY_KEY)).toBe(PRIMARY_ONLY_COMPATIBILITY_VALUE);
  });

  it("removes unsupported benefits from a legacy compatible store before persistence and display", async () => {
    loadCompatibleStore(legacyUnfilteredStore());

    const loaded = await new TampermonkeyResultStore().load();
    const record = Object.values(loaded.cards)[0];
    expect(record.latest?.benefits.map((benefit) => benefit.title)).toEqual(["Dining Credit"]);
    expect(record).toMatchObject({
      freshness: "current",
      completeness: "complete",
      observedAt: "2026-07-15T12:00:00.000Z",
      lastAttemptAt: "2026-07-15T12:00:00.000Z",
      error: null,
      latest: {
        parserVersion: "amex-api-us/1.0.0",
        completeness: "complete",
        issueCodes: [],
      },
    });
    expect(loaded).toMatchObject({ schemaVersion: 1, revision: 5, lastScan: null });
    expect(gm.setValue).toHaveBeenCalledTimes(1);
    expect(gm.setValue).toHaveBeenCalledWith(STORE_KEY, loaded);
  });

  it("projects ignored rows only once without promoting legacy partial conflict state", async () => {
    let persisted = legacyUnfilteredStore();
    const record = Object.values(persisted.cards)[0];
    if (!record.latest) throw new Error("Expected a synthetic latest observation.");
    record.latest.completeness = "partial";
    record.latest.issueCodes = ["benefit_identity_conflict"];
    record.completeness = "partial";
    gm.getValue.mockImplementation(async (key) => {
      if (key === STORE_KEY) return persisted;
      if (key === PRIMARY_ONLY_COMPATIBILITY_KEY) return PRIMARY_ONLY_COMPATIBILITY_VALUE;
      return null;
    });
    gm.setValue.mockImplementation(async (key, value) => {
      if (key === STORE_KEY) persisted = value as typeof persisted;
    });

    const store = new TampermonkeyResultStore();
    const first = await store.load();
    const second = await store.load();
    const projected = Object.values(second.cards)[0];

    expect(first.revision).toBe(5);
    expect(second.revision).toBe(5);
    expect(projected).toMatchObject({
      freshness: "current",
      completeness: "partial",
      latest: {
        completeness: "partial",
        issueCodes: ["benefit_identity_conflict"],
        benefits: [{ title: "Dining Credit" }],
      },
    });
    expect(gm.setValue).toHaveBeenCalledTimes(1);
  });

  it("does not rewrite a compatible store when every persisted benefit is still supported", async () => {
    const compatible = legacyUnfilteredStore();
    const record = Object.values(compatible.cards)[0];
    if (!record.latest) throw new Error("Expected a synthetic latest observation.");
    record.latest.benefits = [storedBenefit("Dining Credit")];
    loadCompatibleStore(compatible);

    const loaded = await new TampermonkeyResultStore().load();
    expect(loaded.revision).toBe(4);
    expect(gm.setValue).not.toHaveBeenCalled();
  });

  it("refuses malformed local data without overwriting it during projection", async () => {
    gm.getValue.mockResolvedValue({
      schemaVersion: 1,
      revision: 4,
      updatedAt: "2026-07-15T12:00:00.000Z",
      cards: "not-a-card-map",
      lastScan: null,
    });

    await expect(new TampermonkeyResultStore().load()).rejects.toThrow();
    expect(gm.setValue).not.toHaveBeenCalled();
    expect(gm.deleteValue).not.toHaveBeenCalled();
  });

  it("refuses a future-schema store without deleting its pending mailbox or writing the marker", async () => {
    const futureStore = {
      schemaVersion: 2,
      revision: 1,
      updatedAt: "2026-07-15T12:00:00.000Z",
      cards: {},
      lastScan: null,
    };
    gm.getValue.mockImplementation(async (key, defaultValue) =>
      key === STORE_KEY ? futureStore : defaultValue);

    await expect(new TampermonkeyResultStore().load()).rejects.toThrow("newer unsupported schema");
    expect(gm.setValue).not.toHaveBeenCalled();
    expect(gm.deleteValue).not.toHaveBeenCalled();
  });

  it("clears the normalized store, local identity secret, pending sync mailbox, and compatibility marker", async () => {
    await new TampermonkeyResultStore().clear();
    expect(gm.deleteValue.mock.calls.map(([key]) => key).sort()).toEqual([
      AMEX_SYNC_MAILBOX_KEY,
      IDENTITY_SECRET_KEY,
      PRIMARY_ONLY_COMPATIBILITY_KEY,
      STORE_KEY,
    ].sort());
  });
});
