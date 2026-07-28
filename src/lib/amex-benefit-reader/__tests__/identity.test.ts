import { webcrypto } from "node:crypto";
import {
  createBenefitKey,
  fingerprintCardToken,
  reconcileCardIdentity,
} from "../identity";
import type { StoredCardRecordV1 } from "../contract";

const cryptoApi = webcrypto as unknown as Crypto;
const secret = "01".repeat(32);

function record(id: string, fingerprint: string, endingDigits = "1234"): StoredCardRecordV1 {
  return {
    localCardId: id,
    identity: { sourceFingerprint: fingerprint, productName: "Synthetic Card", endingDigits },
    latest: null,
    freshness: "error_no_data",
    completeness: "failed",
    observedAt: null,
    lastAttemptAt: "2026-07-15T12:00:00.000Z",
    error: { code: "network_error", message: "Safe fixture error." },
  };
}

describe("local Amex identity", () => {
  it("creates deterministic keyed fingerprints without serializing raw tokens", async () => {
    const first = await fingerprintCardToken(secret, "synthetic-token-a", cryptoApi);
    const second = await fingerprintCardToken(secret, "synthetic-token-a", cryptoApi);
    const other = await fingerprintCardToken(secret, "synthetic-token-b", cryptoApi);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(JSON.stringify({ first, other })).not.toContain("synthetic-token");
  });

  it("keeps same-name physical cards separate by exact fingerprint", () => {
    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";
    const records = {
      [firstId]: record(firstId, "a".repeat(64)),
      [secondId]: record(secondId, "b".repeat(64), "54321"),
    };
    expect(reconcileCardIdentity({ sourceFingerprint: "a".repeat(64), productName: "Synthetic Card", endingDigits: "1234", records })).toMatchObject({ kind: "exact", localCardId: firstId });
    expect(reconcileCardIdentity({ sourceFingerprint: "b".repeat(64), productName: "Synthetic Card", endingDigits: "54321", records })).toMatchObject({ kind: "exact", localCardId: secondId });
  });

  it("rejects an exact source fingerprint with a conflicting displayed ending", () => {
    const localCardId = "11111111-1111-4111-8111-111111111111";
    const records = { [localCardId]: record(localCardId, "a".repeat(64)) };
    expect(reconcileCardIdentity({
      sourceFingerprint: "a".repeat(64),
      productName: "Synthetic Card",
      endingDigits: "9999",
      records,
    })).toMatchObject({ kind: "conflict" });
  });

  it("rejects ambiguous display reconciliation", () => {
    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";
    const records = {
      [firstId]: record(firstId, "a".repeat(64)),
      [secondId]: record(secondId, "b".repeat(64)),
    };
    expect(reconcileCardIdentity({ sourceFingerprint: "c".repeat(64), productName: "Synthetic Card", endingDigits: "1234", records })).toMatchObject({ kind: "ambiguous" });
  });

  it("does not use list position in semantic benefit keys", () => {
    expect(createBenefitKey({ title: "Synthetic Credit", category: "Travel", activityKind: "spend_progress" }))
      .toBe(createBenefitKey({ title: "Synthetic Credit", category: "Travel", activityKind: "spend_progress" }));
  });
});
