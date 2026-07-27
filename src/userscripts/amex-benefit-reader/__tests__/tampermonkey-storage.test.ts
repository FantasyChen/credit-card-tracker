import { storeEnvelopeSchema, type NormalizedBenefitObservationV1 } from "@/lib/amex-benefit-reader/contract";
import { IDENTITY_SECRET_KEY, STORE_KEY } from "@/lib/amex-benefit-reader/storage-policy";
import { AMEX_SYNC_MAILBOX_KEY } from "@/lib/amex-benefit-reader/sync-mailbox";
import { TampermonkeyResultStore } from "../tampermonkey-storage";

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

  it("loads an empty validated envelope without writing or scanning", async () => {
    const store = new TampermonkeyResultStore();
    await expect(store.load()).resolves.toMatchObject({ schemaVersion: 1, revision: 0, cards: {} });
    expect(gm.getValue).toHaveBeenCalledWith(STORE_KEY, null);
    expect(gm.setValue).not.toHaveBeenCalled();
  });

  it("removes unsupported benefits from a legacy compatible store before persistence and display", async () => {
    gm.getValue.mockResolvedValue(legacyUnfilteredStore());

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
    gm.getValue.mockImplementation(async () => persisted);
    gm.setValue.mockImplementation(async (_key, value) => {
      persisted = value as typeof persisted;
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
    gm.getValue.mockResolvedValue(compatible);

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
  });

  it("clears the normalized store, local identity secret, and pending sync mailbox", async () => {
    await new TampermonkeyResultStore().clear();
    expect(gm.deleteValue.mock.calls.map(([key]) => key).sort()).toEqual([
      AMEX_SYNC_MAILBOX_KEY,
      IDENTITY_SECRET_KEY,
      STORE_KEY,
    ].sort());
  });
});
