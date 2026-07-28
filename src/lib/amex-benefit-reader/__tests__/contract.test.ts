import {
  OBSERVATION_CONTRACT_VERSION,
  OBSERVATION_CONTRACT_VERSION_V2,
  OBSERVATION_CONTRACT_VERSION_V3,
  PARSER_VERSION,
  normalizedCardObservationSchema,
  normalizedCardObservationV2Schema,
  normalizedCardObservationV3Schema,
  parseStoreEnvelope,
  sourcePeriodV2Schema,
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

  it("accepts only exact real ordered UTC date ranges", () => {
    expect(sourcePeriodV2Schema.parse({
      kind: "calendar_date_range",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      timeZone: "UTC",
    })).toMatchObject({ startDate: "2026-07-01", endDate: "2026-09-30" });
    expect(() => sourcePeriodV2Schema.parse({
      kind: "calendar_date_range",
      startDate: "2026-02-30",
      endDate: "2026-03-31",
      timeZone: "UTC",
    })).toThrow();
    expect(() => sourcePeriodV2Schema.parse({
      kind: "calendar_date_range",
      startDate: "2026-10-01",
      endDate: "2026-09-30",
      timeZone: "UTC",
    })).toThrow();
    expect(() => sourcePeriodV2Schema.parse({
      kind: "calendar_date_range",
      startDate: "Q3 2026",
      endDate: "2026-09-30",
      timeZone: "UTC",
    })).toThrow();
  });

  it("requires V2 scan/product/family/period identity and rejects unknown fields", () => {
    const v2 = {
      ...card,
      contractVersion: OBSERVATION_CONTRACT_VERSION_V2,
      scanId: "22222222-2222-4222-8222-222222222222",
      productKey: "american-express-platinum-card",
      benefits: [{
        benefitKey: "benefit-1234567890abcdef",
        title: "Synthetic Resy credit",
        category: { state: "observed", value: "spend" },
        activityKind: "spend_progress",
        enrollmentState: { state: "observed", value: "enrolled" },
        trackerState: { state: "observed", value: "in_progress" },
        completionState: { state: "observed", value: "incomplete" },
        earnedOrUsed: { state: "observed", value: { value: "25.00", unit: "USD", currency: "USD" } },
        targetOrLimit: { state: "observed", value: { value: "100.00", unit: "USD", currency: "USD" } },
        remaining: { state: "observed", value: { value: "75.00", unit: "USD", currency: "USD" } },
        period: { state: "observed", value: "Synthetic quarter" },
        confidence: "high",
        issueCodes: [],
        creditFamilyKey: "american-express-platinum-card:resy",
        sourcePeriod: { state: "observed", value: {
          kind: "calendar_date_range",
          startDate: "2026-07-01",
          endDate: "2026-09-30",
          timeZone: "UTC",
        } },
      }],
    };
    expect(normalizedCardObservationV2Schema.parse(v2).contractVersion).toBe("amex-benefits/2");
    expect(() => normalizedCardObservationV2Schema.parse({ ...v2, rawResponse: {} })).toThrow();
    expect(() => normalizedCardObservationV2Schema.parse({ ...v2, productKey: "invented-card" })).toThrow();
    expect(() => normalizedCardObservationV2Schema.parse({ ...v2, scanId: undefined })).toThrow();
  });

  it("requires product-independent V3 scan identity and rejects destination or provider fields", () => {
    const benefit = {
      benefitKey: "benefit-1234567890abcdef",
      title: "Synthetic Usage Credit",
      category: { state: "observed", value: "usage" },
      activityKind: "credit_usage",
      enrollmentState: { state: "not_exposed" },
      trackerState: { state: "observed", value: "in_progress" },
      completionState: { state: "observed", value: "incomplete" },
      earnedOrUsed: { state: "not_exposed" },
      targetOrLimit: { state: "not_exposed" },
      remaining: { state: "not_exposed" },
      period: { state: "not_exposed" },
      sourcePeriod: { state: "not_exposed" },
      confidence: "high",
      issueCodes: [],
    };
    const v3 = {
      ...card,
      contractVersion: OBSERVATION_CONTRACT_VERSION_V3,
      parserVersion: PARSER_VERSION,
      scanId: "22222222-2222-4222-8222-222222222222",
      benefits: [benefit],
    };

    expect(normalizedCardObservationV3Schema.parse(v3)).toEqual(v3);
    expect(() => normalizedCardObservationV3Schema.parse({
      ...v3,
      productKey: "american-express-platinum-card",
    })).toThrow();
    expect(() => normalizedCardObservationV3Schema.parse({
      ...v3,
      benefits: [{ ...benefit, creditFamilyKey: "american-express-platinum-card:resy" }],
    })).toThrow();
    for (const forbidden of ["sorBenefitId", "providerId", "rawResponse", "requestBody", "accountToken"]) {
      expect(() => normalizedCardObservationV3Schema.parse({
        ...v3,
        benefits: [{ ...benefit, [forbidden]: "synthetic-private-value" }],
      })).toThrow();
    }
    expect(() => normalizedCardObservationV3Schema.parse({ ...v3, scanId: undefined })).toThrow();
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
