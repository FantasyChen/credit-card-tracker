import { OBSERVATION_CONTRACT_VERSION, type NormalizedCardObservationV1 } from "../contract";
import {
  createEmptyStore,
  hasMixedObservations,
  loadStoreValue,
  mergeCardAttempt,
  mergeScanSummary,
} from "../storage-policy";

const firstTime = "2026-07-15T12:00:00.000Z";
const secondTime = "2026-07-15T13:00:00.000Z";
const localCardId = "11111111-1111-4111-8111-111111111111";
const identity = {
  localCardId,
  sourceFingerprint: "a".repeat(64),
  productName: "Synthetic Card",
  endingDigits: "1234",
};

function observation(time = firstTime, completeness: "complete" | "partial" = "complete"): NormalizedCardObservationV1 {
  return {
    contractVersion: OBSERVATION_CONTRACT_VERSION,
    issuer: "american_express_us",
    localCardId,
    productName: identity.productName,
    endingDigits: identity.endingDigits,
    observedAt: time,
    parserVersion: "fixture/1",
    completeness,
    issueCodes: completeness === "partial" ? ["unknown_status"] : [],
    benefits: [],
  };
}

describe("Amex local storage policy", () => {
  it("replaces a successful card independently and increments revision", () => {
    const merged = mergeCardAttempt(createEmptyStore(firstTime), {
      disposition: "complete",
      identity,
      attemptedAt: firstTime,
      observation: observation(),
    });
    expect(merged.store.revision).toBe(1);
    expect(merged.record).toMatchObject({ freshness: "current", completeness: "complete", error: null });
  });

  it("preserves prior observation time and data when a later attempt fails", () => {
    const success = mergeCardAttempt(createEmptyStore(firstTime), {
      disposition: "complete", identity, attemptedAt: firstTime, observation: observation(),
    }).store;
    const failure = mergeCardAttempt(success, {
      disposition: "failed",
      identity: { ...identity, sourceFingerprint: "b".repeat(64), productName: "Synthetic Card Renamed" },
      attemptedAt: secondTime,
      errorCode: "request_timeout",
    }).record;
    expect(failure.freshness).toBe("stale_error");
    expect(failure.observedAt).toBe(firstTime);
    expect(failure.latest?.observedAt).toBe(firstTime);
    expect(failure.lastAttemptAt).toBe(secondTime);
    expect(failure.identity).toEqual({
      sourceFingerprint: identity.sourceFingerprint,
      productName: identity.productName,
      endingDigits: identity.endingDigits,
    });
    expect(failure.error?.message).not.toContain("token");
  });

  it("creates a no-data error shell for a first-seen failed card", () => {
    const failure = mergeCardAttempt(createEmptyStore(firstTime), {
      disposition: "failed", identity, attemptedAt: firstTime, errorCode: "response_schema_invalid",
    }).record;
    expect(failure).toMatchObject({ latest: null, freshness: "error_no_data", observedAt: null });
  });

  it("refuses malformed and unknown-future envelopes", () => {
    expect(() => loadStoreValue({ schemaVersion: 2 }, firstTime)).toThrow("newer unsupported schema");
    expect(() => loadStoreValue({ schemaVersion: 1, revision: -1 }, firstTime)).toThrow();
  });

  it("migrates the prior restoration-only scan summary conservatively", () => {
    const current = mergeScanSummary(createEmptyStore(firstTime), {
      startedAt: firstTime,
      finishedAt: secondTime,
      status: "complete",
      discoveredCardCount: 1,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 0,
      cards: [{ localCardId, result: "complete", issueCode: null }],
      visibleContext: "unchanged",
    });
    const legacy = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
    const legacySummary = legacy.lastScan as Record<string, unknown>;
    delete legacySummary.visibleContext;
    legacySummary.restoration = "restored";

    const migrated = loadStoreValue(legacy, secondTime);
    expect(migrated.lastScan?.visibleContext).toBe("unavailable");
    expect(hasMixedObservations(migrated)).toBe(true);
    expect(JSON.stringify(migrated)).not.toContain("restoration");
  });

  it("records a scan summary and identifies partial or mixed observations", () => {
    const partialStore = mergeCardAttempt(createEmptyStore(firstTime), {
      disposition: "partial", identity, attemptedAt: firstTime, observation: observation(firstTime, "partial"),
    }).store;
    const withSummary = mergeScanSummary(partialStore, {
      startedAt: firstTime,
      finishedAt: secondTime,
      status: "partial",
      discoveredCardCount: 1,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 1,
      cards: [{ localCardId, result: "partial", issueCode: "unknown_status" }],
      visibleContext: "unchanged",
    });
    expect(withSummary.revision).toBe(2);
    expect(hasMixedObservations(withSummary)).toBe(true);
  });
});
