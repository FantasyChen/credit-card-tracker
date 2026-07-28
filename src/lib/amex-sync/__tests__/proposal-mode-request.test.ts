import type { AmexSyncPlan } from "../authority";
import { resolveAmexSyncConfiguration } from "../mode";
import { createAmexSyncProposal, verifyAmexSyncProposal } from "../proposal";
import { AmexSyncRequestError, assertSameOriginAmexSyncRequest, parsePreviewRequest } from "../request";

const now = new Date("2026-07-15T12:00:00.000Z");
const key = "synthetic-hmac-key-that-is-at-least-32-characters";
const plan: AmexSyncPlan = {
  rows: [{
    sourceRowIdentity: "a".repeat(64),
    sourceObservationIdentity: "b".repeat(64),
    sourceObservationDigest: "c".repeat(64),
    sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
    productKey: "american-express-platinum-card",
    creditFamilyKey: "american-express-platinum-card:resy",
    observedAt: "2026-07-15T11:59:00.000Z",
    parserVersion: "amex-api-us/3.0.0",
    periodKey: "calendar-quarter-q3",
    sourcePeriodStartDate: "2026-07-01",
    sourcePeriodEndDate: "2026-09-30",
    disposition: "proposed",
    reason: "proposed_update",
    destinationCardId: "card-1",
    destinationBenefitId: "benefit-1",
    destinationStatusId: "status-1",
    before: { usedAmount: 0, isCompleted: false, completedAt: null, isNotUsable: false },
    after: { usedAmount: 25, isCompleted: false, completedAt: null, isNotUsable: false },
    changes: { amountDecrease: false, amountIncrease: true, completionSet: false, completionCleared: false },
  }],
  envelopeDigest: "d".repeat(64),
  manualMappingsDigest: "e".repeat(64),
  beforeStateDigest: "f".repeat(64),
};

const envelope = {
  envelopeVersion: "amex-sync-envelope/2",
  observationContractVersion: "amex-benefits/3",
  scanId: "22222222-2222-4222-8222-222222222222",
  scanFinishedAt: now.toISOString(),
  cards: [{
    sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
    productKey: "american-express-platinum-card",
    endingDigits: "1234",
    observedAt: "2026-07-15T11:59:00.000Z",
    parserVersion: "amex-api-us/3.0.0",
    rows: [],
  }],
  exclusions: [],
};

describe("Amex sync mode", () => {
  it.each([
    [{}, "off"],
    [{ AMEX_SYNC_MODE: "write" }, "off"],
    [{ AMEX_SYNC_MODE: "invalid", AMEX_SYNC_HMAC_KEY: key }, "off"],
    [{ AMEX_SYNC_MODE: "preview", AMEX_SYNC_HMAC_KEY: "short" }, "off"],
    [{ AMEX_SYNC_MODE: "preview", AMEX_SYNC_HMAC_KEY: key }, "preview"],
    [{ AMEX_SYNC_MODE: "write", AMEX_SYNC_HMAC_KEY: key }, "write"],
  ])("fails closed for configuration %#", (environment, expected) => {
    expect(resolveAmexSyncConfiguration(environment).mode).toBe(expected);
  });
});

describe("HMAC-bound Amex sync proposal", () => {
  it("binds user, mode, plan digests, transition time, and expiry", () => {
    const proposal = createAmexSyncProposal({
      userId: "user-1",
      mode: "write",
      plan,
      key,
      now,
      scanFinishedAt: now.toISOString(),
    });
    expect(verifyAmexSyncProposal({ token: proposal.token, key, userId: "user-1", expectedMode: "write", now })).toEqual(proposal.body);
    expect(proposal.body).toMatchObject({
      userId: "user-1",
      mode: "write",
      envelopeDigest: plan.envelopeDigest,
      manualMappingsDigest: plan.manualMappingsDigest,
      beforeStateDigest: plan.beforeStateDigest,
      transitionTime: now.toISOString(),
    });
    expect(() => verifyAmexSyncProposal({ token: proposal.token, key, userId: "user-2", expectedMode: "write", now })).toThrow("proposal_invalid");
    expect(() => verifyAmexSyncProposal({ token: proposal.token, key: `${key}x`, userId: "user-1", expectedMode: "write", now })).toThrow("proposal_invalid");
    expect(() => verifyAmexSyncProposal({ token: `${proposal.token.slice(0, -1)}x`, key, userId: "user-1", expectedMode: "write", now })).toThrow("proposal_invalid");
    expect(() => verifyAmexSyncProposal({ token: proposal.token, key, userId: "user-1", expectedMode: "write", now: new Date(proposal.body.expiresAt) })).toThrow("proposal_invalid");
  });

  it("does not allow a preview-mode proposal to authorize a write", () => {
    const proposal = createAmexSyncProposal({ userId: "user-1", mode: "preview", plan, key, now, scanFinishedAt: now.toISOString() });
    expect(() => verifyAmexSyncProposal({ token: proposal.token, key, userId: "user-1", expectedMode: "write", now })).toThrow("proposal_invalid");
  });
});

describe("same-origin sync request boundary", () => {
  function request(body: unknown, headers: Record<string, string> = {}): Request {
    const values = new Map(Object.entries({
      origin: "https://www.perks-reminder.com",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])),
    }));
    return {
      url: "https://www.perks-reminder.com/api/integrations/amex-sync/preview",
      method: "POST",
      headers: { get: (name: string) => values.get(name.toLowerCase()) ?? null },
      text: async () => JSON.stringify(body),
    } as unknown as Request;
  }

  it("accepts a strict bounded same-origin preview", async () => {
    await expect(parsePreviewRequest(request({ envelope, manualMappings: [] }))).resolves.toMatchObject({ manualMappings: [] });
  });

  it.each([
    [{ Origin: "https://evil.example" }, "origin_rejected"],
    [{ "Sec-Fetch-Site": "cross-site" }, "origin_rejected"],
    [{ "Content-Type": "text/plain" }, "content_type_invalid"],
    [{ "Content-Length": "400000" }, "request_too_large"],
  ])("rejects request metadata case %#", (headers, code) => {
    try {
      assertSameOriginAmexSyncRequest(request({}, headers));
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AmexSyncRequestError);
      expect((error as AmexSyncRequestError).code).toBe(code);
    }
  });

  it("rejects unknown request and envelope fields", async () => {
    await expect(parsePreviewRequest(request({ envelope, manualMappings: [], extra: true }))).rejects.toMatchObject({ code: "request_invalid" });
    await expect(parsePreviewRequest(request({ envelope: { ...envelope, email: "synthetic@example.test" }, manualMappings: [] }))).rejects.toMatchObject({ code: "request_invalid" });
    const duplicateMapping = {
      sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
      destinationCardId: "card-1",
    };
    await expect(parsePreviewRequest(request({
      envelope,
      manualMappings: [duplicateMapping, { ...duplicateMapping, destinationCardId: "card-2" }],
    }))).rejects.toMatchObject({ code: "request_invalid" });
  });
});
