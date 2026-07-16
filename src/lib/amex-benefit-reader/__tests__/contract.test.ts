import {
  OBSERVATION_CONTRACT_VERSION,
  normalizedCardObservationSchema,
  parseStoreEnvelope,
} from "../contract";

const card = {
  contractVersion: OBSERVATION_CONTRACT_VERSION,
  issuer: "american_express_us",
  localCardId: "11111111-1111-4111-8111-111111111111",
  productName: "Synthetic Card",
  endingDigits: "1234",
  observedAt: "2026-07-15T12:00:00.000Z",
  parserVersion: "fixture/1",
  completeness: "complete",
  issueCodes: [],
  benefits: [],
};

describe("portable Amex observation contract", () => {
  it.each(["1234", "54321"])("accepts %s ending digits", (endingDigits) => {
    expect(normalizedCardObservationSchema.parse({ ...card, endingDigits }).endingDigits).toBe(endingDigits);
  });

  it.each(["123", "123456", "12x4"])("rejects invalid ending digits %s", (endingDigits) => {
    expect(() => normalizedCardObservationSchema.parse({ ...card, endingDigits })).toThrow();
  });

  it("rejects unknown portable fields and possible full card numbers in approved text", () => {
    expect(() => normalizedCardObservationSchema.parse({ ...card, balance: "$500" })).toThrow();
    expect(() => normalizedCardObservationSchema.parse({ ...card, productName: "Synthetic 4111 1111 1111 1111" })).toThrow("disallowed long number");
  });

  it("rejects forbidden sensitive field names anywhere in storage", () => {
    expect(() => parseStoreEnvelope({
      schemaVersion: 1,
      revision: 0,
      updatedAt: card.observedAt,
      cards: {},
      lastScan: null,
      rawAuthorizationHeader: "synthetic-secret",
    })).toThrow("forbidden field");
    expect(() => parseStoreEnvelope({
      schemaVersion: 1,
      revision: 0,
      updatedAt: card.observedAt,
      cards: {},
      lastScan: null,
      accountToken: "invented-token",
    })).toThrow("forbidden field");
  });
});
