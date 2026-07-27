import accountsFixture from "../__fixtures__/accounts.json";
import catalogFixture from "../__fixtures__/benefit-catalog.json";
import malformedCatalogFixture from "../__fixtures__/catalog-malformed.json";
import trackersFixture from "../__fixtures__/benefit-trackers.json";
import unknownStatusFixture from "../__fixtures__/trackers-unknown-status.json";
import { catalogResponseSchema, memberResponseSchema, trackerResponseSchema } from "../amex-api-contract";
import { normalizeBenefits as normalizeBenefitsForCard, parseAccountDiscovery } from "../amex-response-adapter";

function normalizeBenefits(
  trackerResponse: Parameters<typeof normalizeBenefitsForCard>[0]["trackerResponse"],
  catalogResponse: Parameters<typeof normalizeBenefitsForCard>[0]["catalogResponse"],
  productName = "American Express Business Platinum Card",
) {
  return normalizeBenefitsForCard({ productName, trackerResponse, catalogResponse });
}

describe("Amex private response adapter", () => {
  it("emits only characterized top-level BASIC cards and silently excludes nested SUPP cards", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse(accountsFixture));
    expect(discovery.cards).toEqual([
      {
        rawAccountToken: "invented-primary-token-a",
        productName: "Synthetic Rewards Card",
        endingDigits: "12345",
      },
      {
        rawAccountToken: "invented-primary-token-c",
        productName: "Synthetic Rewards Card",
        endingDigits: "9876",
      },
    ]);
    expect(discovery.knownNonCardCount).toBe(0);
    expect(discovery.unknownVariantCount).toBe(2);
    expect(discovery.issueCodes).toContain("unknown_account_variant");
    expect(JSON.stringify(discovery)).not.toContain("invented-supp-token-b");
  });

  it("uses exact relationship placement rather than Additional or Companion product names", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse({
      accounts: [
        {
          account_token: "additional-named-basic-token",
          relationship: "BASIC",
          product: { description: "Additional Gold Card" },
          display_account_number: "1234",
        },
        {
          account_token: "platinum-basic-token",
          relationship: "BASIC",
          product: { description: "American Express Platinum Card" },
          display_account_number: "5678",
          supplementary_accounts: [{
            account_token: "companion-named-supp-token",
            relationship: "SUPP",
            product: { description: "Companion Platinum Card" },
            display_account_number: "9999",
          }],
        },
      ],
    }));

    expect(discovery.cards).toEqual([
      expect.objectContaining({
        rawAccountToken: "additional-named-basic-token",
        productName: "Additional Gold Card",
      }),
      expect.objectContaining({ rawAccountToken: "platinum-basic-token" }),
    ]);
    expect(discovery.unknownVariantCount).toBe(0);
    expect(JSON.stringify(discovery)).not.toContain("companion-named-supp-token");
  });

  it("resolves top-level and nested account identity conservatively for explicit four- and five-digit endings", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse({
      accounts: [
        {
          account_token: "nested-four-token",
          product: { description: "Synthetic Nested Card" },
          account: { relationship: "BASIC", display_account_number: "ending 1234" },
        },
        {
          account_token: "matching-five-token",
          relationship: "BASIC",
          product: { description: "Synthetic Matching Card" },
          display_account_number: "54321",
          account: { relationship: "BASIC", display_account_number: "ending 54321" },
        },
        {
          account_token: "relationship-conflict-token",
          relationship: "BASIC",
          product: { description: "Synthetic Conflict Card" },
          display_account_number: "1111",
          account: { relationship: "SUPP", display_account_number: "1111" },
        },
        {
          account_token: "ending-conflict-token",
          product: { description: "Synthetic Conflict Card" },
          display_account_number: "2222",
          account: { relationship: "BASIC", display_account_number: "33333" },
        },
      ],
    }));

    expect(discovery.cards).toEqual([
      expect.objectContaining({ rawAccountToken: "nested-four-token", endingDigits: "1234" }),
      expect.objectContaining({ rawAccountToken: "matching-five-token", endingDigits: "54321" }),
    ]);
    expect(discovery.unknownVariantCount).toBe(2);
  });

  it("never truncates a full-card-looking field or derives digits from a token", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse({
      accounts: [
        {
          account_token: "token-ending-7777",
          relationship: "BASIC",
          product: { description: "Synthetic Unsafe Card" },
          account_number: "4111111111117777",
        },
        {
          account_token: "nested-full-number-token",
          relationship: "BASIC",
          product: { description: "Synthetic Layered Unsafe Card" },
          display_account_number: "8888",
          account: { account_number: "5555555555558888" },
        },
      ],
    }));
    expect(discovery.cards).toHaveLength(0);
    expect(discovery.unknownVariantCount).toBe(2);
    expect(JSON.stringify(discovery)).not.toMatch(/4111111111117777|5555555555558888/);
  });

  it("rejects conflicting primary identity while excluding SUPP identity fields before inspection", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse({
      accounts: [
        {
          account_token: "token-a",
          relationship: "BASIC",
          product: { description: "Synthetic Card", product_description: "Conflicting Card" },
          display_account_number: "1234",
        },
        {
          account_token: "token-parent",
          relationship: "BASIC",
          product: { description: "Synthetic Parent" },
          display_account_number: "5678",
          supplementary_accounts: [{
            account_token: "token-supp-a",
            relationship: "SUPP",
            display_number: "54321",
            account: { account_token: "token-supp-b", relationship: "SUPP" },
          }],
        },
        {
          account_token: "token-c",
          relationship: "BASIC",
          product: { description: "Synthetic Card" },
          display_account_number: "1111",
          display_number: "2222",
        },
      ],
    }));
    expect(discovery.cards).toEqual([expect.objectContaining({ rawAccountToken: "token-parent" })]);
    expect(discovery.unknownVariantCount).toBe(2);
    expect(JSON.stringify(discovery)).not.toMatch(/token-supp-a|token-supp-b/);
  });

  it("keeps unknown or contradictory nested relationships fail closed", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse({
      accounts: [{
        account_token: "primary-token",
        relationship: "BASIC",
        product: { description: "American Express Platinum Card" },
        display_account_number: "1234",
        supplementary_accounts: [
          { account_token: "missing-role-token", display_account_number: "1111" },
          {
            account_token: "conflicting-role-token",
            relationship: "SUPP",
            display_account_number: "2222",
            account: { relationship: "BASIC" },
          },
          {
            account_token: "ignored-malformed-supp-token",
            relationship: "SUPP",
            account_number: "4111111111113333",
          },
        ],
      }],
    }));

    expect(discovery.cards).toEqual([expect.objectContaining({ rawAccountToken: "primary-token" })]);
    expect(discovery.unknownVariantCount).toBe(2);
    expect(discovery.issueCodes).toEqual(["unknown_account_variant"]);
    expect(JSON.stringify(discovery)).not.toContain("ignored-malformed-supp-token");
  });

  it("keeps duplicate product names separate and rejects duplicate token identity", () => {
    const parsed = memberResponseSchema.parse({
      accounts: [
        { account_token: "token-a", relationship: "BASIC", product: { description: "Same Card" }, display_account_number: "1234" },
        { account_token: "token-b", relationship: "BASIC", product: { description: "Same Card" }, display_account_number: "1234" },
        { account_token: "token-a", relationship: "BASIC", product: { description: "Same Card" }, display_account_number: "1234" },
      ],
    });
    const discovery = parseAccountDiscovery(parsed);
    expect(discovery.cards.map((card) => card.rawAccountToken)).toEqual(["token-a", "token-b"]);
    expect(discovery.issueCodes).toContain("duplicate_card_entry");
  });

  it("normalizes enrollment, characterized progress, completed, money, and count observations", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse(trackersFixture),
      catalogResponseSchema.parse(catalogFixture),
    );
    expect(result.issueCodes).toEqual([]);
    expect(result.benefits.map((benefit) => benefit.activityKind)).toEqual([
      "spend_progress",
      "spend_progress",
      "completed",
      "spend_progress",
      "enrollment_candidate",
    ]);
    const spend = result.benefits[0];
    expect(spend.enrollmentState).toEqual({ state: "observed", value: "enrolled" });
    expect(spend.earnedOrUsed).toEqual({ state: "observed", value: { value: "12.50", unit: "USD", currency: "USD" } });
    expect(spend.remaining).toEqual({ state: "observed", value: { value: "87.50", unit: "USD", currency: "USD" } });
    const earned = result.benefits[1];
    expect(earned.period).toEqual({ state: "observed", value: "2026-07-01 to 2026-07-31" });
    expect(earned.remaining).toEqual({ state: "not_exposed" });
    const count = result.benefits[3];
    expect(count.targetOrLimit).toEqual({ state: "observed", value: { value: "10", unit: "count", currency: null } });
    const candidate = result.benefits[4];
    expect(candidate).toMatchObject({
      title: "Synthetic Adobe Credit",
      enrollmentState: { state: "observed", value: "required" },
      targetOrLimit: { state: "not_exposed" },
      period: { state: "not_exposed" },
    });
    expect(result.benefits.some((benefit) => benefit.title === "Synthetic Information Only")).toBe(false);
  });

  it("keeps only represented credits for the corresponding card without marking omissions partial", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [
        { benefitName: "Monthly Dining Credit", category: "usage", status: "ACTIVE" },
        { benefitName: "Saks Fifth Avenue Credit", category: "usage", status: "ACTIVE" },
        { benefitName: "Cell Phone Protection", category: "usage", status: "ACTIVE" },
        { benefitName: "Centurion Lounge Access", category: "access", status: "ACTIVE" },
        { benefitName: "Global Dining Access by Resy", category: "future-category", status: "FUTURE_STATUS" },
      ] }]),
      catalogResponseSchema.parse({ benefits: {
        resy: { benefitTitle: "Resy Dining Credit", layoutType: "NOTENROLLED", isEnrollable: true },
        clear: { benefitTitle: "CLEAR Plus Credit", layoutType: "NOTENROLLED", isEnrollable: true },
        information: { benefitTitle: "Premium Global Assist Hotline", layoutType: "FUTURE_LAYOUT" },
      } }),
      "American Express Gold Card",
    );

    expect(result.issueCodes).toEqual([]);
    expect(result.benefits.map((benefit) => benefit.title)).toEqual([
      "Monthly Dining Credit",
      "Resy Dining Credit",
    ]);
  });

  it("ignores every exact spend-category tracker before interpretation while retaining usage at any amount", () => {
    const trackers = [
      {
        sorBenefitId: "dell-spend",
        benefitName: "Dell Technologies Credit",
        category: "spend",
        status: "FUTURE_STATUS",
        tracker: { spentAmount: "not-a-decimal", targetAmount: "600", targetUnit: "FUTURE_UNIT" },
      },
      {
        sorBenefitId: "dell-usage",
        benefitName: "Dell Technologies Credit",
        category: "usage",
        status: "IN_PROGRESS",
        tracker: {
          spentAmount: "1.00",
          targetAmount: "150.00",
          targetCurrency: "USD",
          targetUnit: "MONETARY",
        },
      },
      {
        sorBenefitId: "adobe-spend",
        benefitName: "Adobe Credit",
        category: "spend",
        status: "ACHIEVED",
        tracker: {
          spentAmount: "600.00",
          targetAmount: "600.00",
          targetCurrency: "USD",
          targetUnit: "MONETARY",
        },
      },
    ];
    for (const trackersInOrder of [trackers, [...trackers].reverse()]) {
      const result = normalizeBenefits(
        trackerResponseSchema.parse([{ trackers: trackersInOrder }]),
        catalogResponseSchema.parse({ benefits: {
          ignoredJoinedCandidate: {
            sorBenefitId: "adobe-spend",
            benefitTitle: "Adobe Credit",
            layoutType: "NOTENROLLED",
            isEnrollable: true,
          },
        } }),
      );
      expect(result.benefits).toHaveLength(1);
      expect(result.benefits[0]).toMatchObject({
        title: "Dell Technologies Credit",
        category: { state: "observed", value: "usage" },
        earnedOrUsed: { state: "observed", value: { value: "1.00" } },
        targetOrLimit: { state: "observed", value: { value: "150.00" } },
      });
      expect(result.issueCodes).toEqual([]);
      expect(result.conflictDiagnostics).toEqual([]);
      expect(result.conflictDetails).toEqual({ details: [], totalCount: 0, truncated: false });
      expect(JSON.stringify(result)).not.toMatch(/600\.00|FUTURE_STATUS|adobe-spend|dell-spend/);
    }
  });

  it("ignores the airline bonus before catalog join grouping and keeps the airline fee credit", () => {
    const catalogs = [
      ["fee", {
        sorBenefitId: "shared-airline-join",
        benefitTitle: "$200 Airline Fee Credit",
        layoutType: "ENROLLED",
        isEnrollable: true,
      }],
      ["bonus", {
        sorBenefitId: "shared-airline-join",
        benefitShortTitle: "Airline benefit",
        benefitTitle: "35% Airline Bonus",
        layoutType: "NOTENROLLED",
        isEnrollable: true,
      }],
    ] as const;
    for (const catalogsInOrder of [catalogs, [...catalogs].reverse()]) {
      const result = normalizeBenefits(
        trackerResponseSchema.parse([{ trackers: [{
          sorBenefitId: "shared-airline-join",
          benefitName: "$200 Airline Fee Credit",
          category: "usage",
          status: "IN_PROGRESS",
        }] }]),
        catalogResponseSchema.parse({ benefits: Object.fromEntries(catalogsInOrder) }),
      );
      expect(result.benefits.map((benefit) => benefit.title)).toEqual(["$200 Airline Fee Credit"]);
      expect(result.issueCodes).toEqual([]);
      expect(result.conflictDiagnostics).toEqual([]);
      expect(JSON.stringify(result)).not.toContain("35% Airline Bonus");
    }
  });

  it("ignores Resy profile-link catalog rows before candidates and conflicts", () => {
    const catalogs = [
      ["credit", {
        sorBenefitId: "resy-credit-join",
        benefitTitle: "Resy Credit",
        layoutType: "ENROLLED",
        isEnrollable: true,
      }],
      ["profile", {
        sorBenefitId: "resy-profile-join",
        benefitShortTitle: "Resy",
        benefitTitle: "Link Your Resy Profile",
        layoutType: "NOTENROLLED",
        isEnrollable: true,
      }],
    ] as const;
    for (const catalogsInOrder of [catalogs, [...catalogs].reverse()]) {
      const result = normalizeBenefits(
        trackerResponseSchema.parse([{ trackers: [{
          sorBenefitId: "resy-credit-join",
          benefitName: "Resy Credit",
          category: "usage",
          status: "IN_PROGRESS",
        }] }]),
        catalogResponseSchema.parse({ benefits: Object.fromEntries(catalogsInOrder) }),
        "American Express Platinum Card",
      );
      expect(result.benefits.map((benefit) => benefit.title)).toEqual(["Resy Credit"]);
      expect(result.issueCodes).toEqual([]);
      expect(result.conflictDiagnostics).toEqual([]);
      expect(result.conflictDetails).toEqual({ details: [], totalCount: 0, truncated: false });
      expect(JSON.stringify(result)).not.toContain("Link Your Resy Profile");
    }
  });

  it("fails closed for unknown cards and deduplicates supported wording variants", () => {
    const trackerResponse = trackerResponseSchema.parse([{ trackers: [
      { benefitName: "Resy Credit", category: "usage", status: "ACTIVE" },
      { benefitName: "Resy Dining Credit", category: "usage", status: "ACTIVE" },
    ] }]);
    const catalogResponse = catalogResponseSchema.parse({ benefits: {} });

    const known = normalizeBenefits(trackerResponse, catalogResponse, "American Express Gold Card");
    expect(known.issueCodes).toEqual([]);
    expect(known.benefits).toHaveLength(1);
    expect(known.benefits[0].title).toBe("Resy Credit");

    expect(normalizeBenefits(trackerResponse, catalogResponse, "Unknown Gold-Like Card")).toEqual({
      benefits: [],
      issueCodes: [],
      conflictDiagnostics: [],
      conflictDetails: { details: [], totalCount: 0, truncated: false },
    });
  });

  it("maps characterized live tracker and catalog enums without inventing enrollment or units", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [
        {
          sorBenefitId: "access-id",
          benefitName: "Synthetic Centurion Lounge Access",
          category: "access",
          status: "IN_PROGRESS",
          tracker: { spentAmount: "2", targetAmount: "10", targetUnit: "PASSES" },
        },
        {
          sorBenefitId: "usage-id",
          benefitName: "Synthetic Hilton Credit",
          category: "usage",
          status: "ACTIVE",
          tracker: { spentAmount: "3", targetAmount: "8", targetUnit: "PASSES" },
        },
        {
          sorBenefitId: "loan-id",
          benefitName: "Synthetic Adobe Credit",
          category: "loan",
          status: "IN_PROGRESS",
          tracker: { spentAmount: "25.00", targetAmount: "100.00", targetUnit: "MONETARY", targetCurrency: "USD" },
        },
        {
          sorBenefitId: "spend-id",
          benefitName: "Synthetic Airline Fee Credit",
          category: "usage",
          status: "IN_PROGRESS",
        },
      ] }]),
      catalogResponseSchema.parse({ benefits: {
        access: { sorBenefitId: "access-id", layoutType: "LOGGEDIN" },
        usage: { sorBenefitId: "usage-id", layoutType: "SUPP" },
        loan: { sorBenefitId: "loan-id", benefitTitle: "Synthetic Adobe Credit", layoutType: "ENROLLED" },
        spend: { sorBenefitId: "spend-id", benefitTitle: "Synthetic Airline Fee Credit", layoutType: "NOTENROLLED", isEnrollable: true },
        loggedInOnly: { sorBenefitId: "catalog-only-logged-in", benefitTitle: "Synthetic Logged In Information", layoutType: "LOGGEDIN" },
        supplementaryOnly: { sorBenefitId: "catalog-only-supp", benefitTitle: "Synthetic Supplementary Information", layoutType: "SUPP" },
      } }),
    );

    expect(result.issueCodes).toEqual([]);
    expect(result.benefits).toHaveLength(3);
    expect(result.benefits.map((benefit) => [benefit.category, benefit.activityKind])).toEqual([
      [{ state: "observed", value: "usage" }, "spend_progress"],
      [{ state: "observed", value: "loan" }, "spend_progress"],
      [{ state: "observed", value: "usage" }, "spend_progress"],
    ]);
    expect(result.benefits[0]).toMatchObject({
      enrollmentState: { state: "not_exposed" },
      trackerState: { state: "observed", value: "in_progress" },
      completionState: { state: "observed", value: "incomplete" },
      earnedOrUsed: { state: "observed", value: { value: "3", unit: "count", currency: null } },
    });
    expect(result.benefits[1]).toMatchObject({
      enrollmentState: { state: "observed", value: "enrolled" },
      targetOrLimit: { state: "observed", value: { value: "100.00", unit: "USD", currency: "USD" } },
    });
    expect(result.benefits[2].enrollmentState).toEqual({ state: "observed", value: "required" });
    expect(result.benefits.some((benefit) => benefit.title.includes("Lounge Access"))).toBe(false);
  });

  it("maps IN_PROGRESS to in-progress and incomplete for a characterized category", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [{
        benefitName: "Synthetic Hilton Credit",
        category: "usage",
        status: "IN_PROGRESS",
      }] }]),
      catalogResponseSchema.parse({ benefits: {} }),
    );
    expect(result.benefits[0]).toMatchObject({
      activityKind: "spend_progress",
      trackerState: { state: "observed", value: "in_progress" },
      completionState: { state: "observed", value: "incomplete" },
    });
  });

  it("does not create enrollment state or candidates from NOTENROLLED without explicit enrollability", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [{
        sorBenefitId: "not-enrollable-id",
        benefitName: "Synthetic Adobe Credit",
        category: "usage",
        status: "ACTIVE",
      }] }]),
      catalogResponseSchema.parse({ benefits: {
        joined: {
          sorBenefitId: "not-enrollable-id",
          benefitTitle: "Synthetic Adobe Credit",
          layoutType: "NOTENROLLED",
          isEnrollable: false,
        },
        catalogOnly: {
          sorBenefitId: "catalog-only-noncandidate",
          benefitTitle: "Synthetic Hilton Credit",
          layoutType: "NOTENROLLED",
          isEnrollable: false,
        },
      } }),
    );
    expect(result.issueCodes).toEqual([]);
    expect(result.benefits).toHaveLength(1);
    expect(result.benefits[0]).toMatchObject({
      title: "Synthetic Adobe Credit",
      enrollmentState: { state: "not_exposed" },
    });
  });

  it("keeps uncharacterized categories and units partial without inferring semantics", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [
        {
          benefitName: "Synthetic Adobe Credit",
          category: "credits",
          status: "ACTIVE",
        },
        {
          benefitName: "Synthetic Airline Fee Credit",
          category: "usage",
          status: "ACTIVE",
          tracker: { spentAmount: "1.00", targetCurrency: "USD" },
        },
        {
          benefitName: "Synthetic Hilton Credit",
          category: "usage",
          status: "IN_PROGRESS",
          tracker: { spentAmount: "2.00", targetUnit: "MONETARY" },
        },
      ] }]),
      catalogResponseSchema.parse({ benefits: {} }),
    );
    expect(result.issueCodes).toEqual(expect.arrayContaining(["unknown_activity_kind", "unknown_quantity"]));
    expect(result.benefits).toHaveLength(2);
    expect(result.benefits.map((benefit) => benefit.earnedOrUsed)).toEqual([
      { state: "observed", value: { value: "1.00", unit: "unknown", currency: null } },
      { state: "observed", value: { value: "2.00", unit: "unknown", currency: null } },
    ]);
  });

  it("keeps unknown catalog layouts partial", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [] }]),
      catalogResponseSchema.parse({ benefits: {
        unknown: { sorBenefitId: "unknown-layout-id", benefitTitle: "Synthetic Adobe Credit", layoutType: "FUTURE_LAYOUT" },
      } }),
    );
    expect(result.benefits).toEqual([]);
    expect(result.issueCodes).toContain("unknown_status");
  });

  it("marks unknown statuses, units, and decimal strings partial without inventing values", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse(unknownStatusFixture),
      catalogResponseSchema.parse({ benefits: {} }),
    );
    expect(result.issueCodes).toEqual(expect.arrayContaining(["unknown_status", "unknown_quantity"]));
    expect(result.benefits[0]).toMatchObject({
      trackerState: { state: "unrecognized", issueCode: "unknown_status" },
      earnedOrUsed: { state: "unrecognized", issueCode: "unknown_quantity" },
      targetOrLimit: { state: "observed", value: { value: "10", unit: "unknown", currency: null } },
      remaining: { state: "not_exposed" },
    });
  });

  it("distinguishes an absent tracker status from a present unknown status", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [{
        benefitName: "Synthetic Wireless Bill Credit",
        category: "usage",
        tracker: { spentAmount: "1", targetUnit: "PASSES" },
      }] }]),
      catalogResponseSchema.parse({ benefits: {} }),
    );
    expect(result.issueCodes).toEqual([]);
    expect(result.benefits[0]).toMatchObject({
      trackerState: { state: "not_exposed" },
      completionState: { state: "not_exposed" },
    });
  });

  it("does not enrich from conflicting catalog records with the same issuer join ID", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [{
        sorBenefitId: "shared-id",
        benefitName: "Synthetic Airline Fee Credit",
        category: "usage",
        status: "ACTIVE",
      }] }]),
      catalogResponseSchema.parse({ benefits: {
        first: { sorBenefitId: "shared-id", benefitTitle: "First Catalog Title", layoutType: "ENROLLED", isEnrollable: true },
        second: { sorBenefitId: "shared-id", benefitTitle: "Second Catalog Title", layoutType: "NOTENROLLED", isEnrollable: true },
      } }),
    );
    expect(result.issueCodes).toContain("benefit_identity_conflict");
    expect(result.benefits).toHaveLength(1);
    expect(result.benefits[0]).toMatchObject({
      title: "Synthetic Airline Fee Credit",
      enrollmentState: { state: "not_exposed" },
    });
  });

  it("classifies same-supported-credit tracker collisions without adding row issues or ordinals", () => {
    const trackerPair = [
      { sorBenefitId: "id-a", benefitName: "Synthetic Adobe Credit", category: "usage", status: "ACTIVE", tracker: { spentAmount: "1", targetUnit: "PASSES" } },
      { sorBenefitId: "id-b", benefitName: "Synthetic Adobe Credit", category: "usage", status: "ACTIVE", tracker: { spentAmount: "2", targetUnit: "PASSES" } },
    ];
    for (const trackersInOrder of [trackerPair, [...trackerPair].reverse()]) {
      const result = normalizeBenefits(
        trackerResponseSchema.parse([{ trackers: trackersInOrder }]),
        catalogResponseSchema.parse({ benefits: {} }),
      );
      expect(result.benefits).toHaveLength(1);
      expect(result.issueCodes).toEqual(["benefit_identity_conflict"]);
      expect(result.conflictDiagnostics).toEqual(["tracker_state_collision"]);
      expect(result.benefits[0].issueCodes).toEqual([]);
      expect(result.benefits[0].benefitKey).not.toMatch(/-1$|-2$/);
    }
  });

  it("classifies joined tracker/catalog supported-key disagreement as card-only", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [{
        sorBenefitId: "joined-key-mismatch",
        benefitName: "Synthetic Monthly Dining Credit",
        category: "usage",
        status: "ACTIVE",
      }] }]),
      catalogResponseSchema.parse({ benefits: {
        joined: {
          sorBenefitId: "joined-key-mismatch",
          benefitTitle: "Synthetic Resy Dining Credit",
          layoutType: "ENROLLED",
          isEnrollable: true,
        },
      } }),
      "American Express Gold Card",
    );

    expect(result.benefits).toEqual([]);
    expect(result.issueCodes).toEqual(["benefit_identity_conflict"]);
    expect(result.conflictDiagnostics).toEqual(["tracker_catalog_key_mismatch"]);
  });

  it("classifies ambiguous duplicate catalog joins while preserving row-level conflict locality", () => {
    const catalogs = [
      ["first", { sorBenefitId: "ambiguous-join", benefitTitle: "Synthetic Adobe Credit", layoutType: "ENROLLED", isEnrollable: true }],
      ["second", { sorBenefitId: "ambiguous-join", benefitTitle: "Synthetic Adobe Statement Credit", layoutType: "NOTENROLLED", isEnrollable: true }],
    ] as const;
    for (const catalogsInOrder of [catalogs, [...catalogs].reverse()]) {
      const result = normalizeBenefits(
        trackerResponseSchema.parse([{ trackers: [{
          sorBenefitId: "ambiguous-join",
          benefitName: "Synthetic Adobe Credit",
          category: "usage",
          status: "ACTIVE",
        }] }]),
        catalogResponseSchema.parse({ benefits: Object.fromEntries(catalogsInOrder) }),
      );

      expect(result.benefits).toHaveLength(1);
      expect(result.issueCodes).toEqual(["benefit_identity_conflict"]);
      expect(result.conflictDiagnostics).toEqual(["ambiguous_catalog_join"]);
      expect(result.benefits[0].issueCodes).toEqual(["benefit_identity_conflict"]);
    }
  });

  it("classifies a tracker versus distinct catalog enrollment candidate collision as card-only", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [{
        sorBenefitId: "tracker-adobe",
        benefitName: "Synthetic Adobe Credit",
        category: "usage",
        status: "ACTIVE",
      }] }]),
      catalogResponseSchema.parse({ benefits: {
        candidate: {
          sorBenefitId: "catalog-adobe-candidate",
          benefitTitle: "Synthetic Adobe Statement Credit",
          layoutType: "NOTENROLLED",
          isEnrollable: true,
        },
      } }),
    );

    expect(result.benefits).toHaveLength(1);
    expect(result.issueCodes).toEqual(["benefit_identity_conflict"]);
    expect(result.conflictDiagnostics).toEqual(["tracker_catalog_candidate_collision"]);
    expect(result.benefits[0].issueCodes).toEqual([]);
  });

  it("classifies supported ambiguous catalog records even when no tracker row is retained", () => {
    const catalogs = [
      ["first", { sorBenefitId: "catalog-only-ambiguous", benefitTitle: "Synthetic Adobe Credit", layoutType: "ENROLLED", isEnrollable: true }],
      ["second", { sorBenefitId: "catalog-only-ambiguous", benefitTitle: "Synthetic Adobe Statement Credit", layoutType: "NOTENROLLED", isEnrollable: true }],
    ] as const;
    for (const catalogsInOrder of [catalogs, [...catalogs].reverse()]) {
      const result = normalizeBenefits(
        trackerResponseSchema.parse([{ trackers: [] }]),
        catalogResponseSchema.parse({ benefits: Object.fromEntries(catalogsInOrder) }),
      );
      expect(result.benefits).toEqual([]);
      expect(result.issueCodes).toEqual(["benefit_identity_conflict"]);
      expect(result.conflictDiagnostics).toEqual(["ambiguous_catalog_join"]);
    }
  });

  it("deduplicates and orders all conflict categories under relevant source reversal", () => {
    const trackers = [
      { sorBenefitId: "state-a", benefitName: "Synthetic Adobe Credit", category: "usage", status: "ACTIVE", tracker: { spentAmount: "1", targetUnit: "PASSES" } },
      { sorBenefitId: "state-b", benefitName: "Synthetic Adobe Credit", category: "usage", status: "ACTIVE", tracker: { spentAmount: "2", targetUnit: "PASSES" } },
      { sorBenefitId: "key-mismatch", benefitName: "Synthetic Adobe Credit", category: "usage", status: "ACTIVE" },
      { sorBenefitId: "ambiguous-wireless", benefitName: "Synthetic Wireless Bill Credit", category: "usage", status: "ACTIVE" },
      { sorBenefitId: "indeed-tracker", benefitName: "Synthetic Indeed Credit", category: "usage", status: "ACTIVE" },
    ];
    const catalogs = [
      ["mismatch", { sorBenefitId: "key-mismatch", benefitTitle: "Synthetic Hilton Credit", layoutType: "ENROLLED", isEnrollable: true }],
      ["ambiguous-one", { sorBenefitId: "ambiguous-wireless", benefitTitle: "Synthetic Wireless Bill Credit", layoutType: "ENROLLED", isEnrollable: true }],
      ["ambiguous-two", { sorBenefitId: "ambiguous-wireless", benefitTitle: "Synthetic Wireless Statement Credit", layoutType: "NOTENROLLED", isEnrollable: true }],
      ["candidate", { sorBenefitId: "indeed-candidate", benefitTitle: "Synthetic Indeed Statement Credit", layoutType: "NOTENROLLED", isEnrollable: true }],
    ] as const;

    for (const [trackersInOrder, catalogsInOrder] of [
      [trackers, catalogs],
      [[...trackers].reverse(), [...catalogs].reverse()],
    ] as const) {
      const result = normalizeBenefits(
        trackerResponseSchema.parse([{ trackers: trackersInOrder }]),
        catalogResponseSchema.parse({ benefits: Object.fromEntries(catalogsInOrder) }),
      );
      expect(result.issueCodes).toEqual(["benefit_identity_conflict"]);
      expect(result.conflictDiagnostics).toEqual([
        "tracker_state_collision",
        "tracker_catalog_key_mismatch",
        "ambiguous_catalog_join",
        "tracker_catalog_candidate_collision",
      ]);
      expect(result.conflictDetails.details.map((detail) => ({
        category: detail.category,
        key: detail.conflictKey,
        creditFamilies: detail.reviewedCreditFamilies,
        sourceRoles: detail.candidates.map((candidate) => candidate.sourceRole),
      }))).toEqual([
        {
          category: "tracker_state_collision",
          key: "tracker_state_collision:adobe:01",
          creditFamilies: ["adobe"],
          sourceRoles: ["tracker", "tracker"],
        },
        {
          category: "tracker_catalog_key_mismatch",
          key: "tracker_catalog_key_mismatch:adobe+hilton:01",
          creditFamilies: ["adobe", "hilton"],
          sourceRoles: ["tracker", "joined_catalog"],
        },
        {
          category: "ambiguous_catalog_join",
          key: "ambiguous_catalog_join:wireless:01",
          creditFamilies: ["wireless"],
          sourceRoles: ["tracker", "joined_catalog", "joined_catalog"],
        },
        {
          category: "tracker_catalog_candidate_collision",
          key: "tracker_catalog_candidate_collision:indeed:01",
          creditFamilies: ["indeed"],
          sourceRoles: ["tracker", "catalog_enrollment_candidate"],
        },
      ]);
      expect(result.conflictDetails).toMatchObject({ totalCount: 4, truncated: false });
      expect(result.benefits.filter((item) =>
        item.issueCodes.includes("benefit_identity_conflict"))).toHaveLength(1);
    }
  });

  it("returns bounded, deterministic structured conflict details without issuer join IDs", () => {
    const catalogs = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [
      `catalog-${index}`,
      {
        sorBenefitId: "private-join-value-must-not-survive",
        benefitTitle: index % 2 === 0 ? "Synthetic Adobe Credit" : "Synthetic Adobe Statement Credit",
        layoutType: index % 2 === 0 ? "ENROLLED" : "NOTENROLLED",
        isEnrollable: true,
      },
    ]));
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [{
        sorBenefitId: "private-join-value-must-not-survive",
        benefitName: "Synthetic Adobe Credit",
        category: "usage",
        status: "IN_PROGRESS",
        trackerDuration: "Synthetic monthly period",
        tracker: {
          spentAmount: "1.00",
          targetAmount: "10.00",
          remainingAmount: "9.00",
          targetCurrency: "USD",
          targetUnit: "MONETARY",
        },
      }] }]),
      catalogResponseSchema.parse({ benefits: catalogs }),
    );

    expect(result.conflictDetails).toEqual({
      details: [expect.objectContaining({
        conflictKey: "ambiguous_catalog_join:adobe:01",
        category: "ambiguous_catalog_join",
        reviewedCreditKeys: ["american-express-business-platinum-card:adobe"],
        reviewedCreditFamilies: ["adobe"],
        candidateCount: 3,
        candidatesTruncated: false,
        candidates: expect.arrayContaining([
          expect.objectContaining({
            candidateIndex: 1,
            sourceRole: "tracker",
            displayTitle: "Synthetic Adobe Credit",
            trackerState: { state: "observed", value: "in_progress" },
            earnedOrUsed: { state: "observed", value: { value: "1.00", unit: "USD", currency: "USD" } },
            period: { state: "observed", value: "Synthetic monthly period" },
          }),
          expect.objectContaining({ sourceRole: "joined_catalog", catalogLayout: { state: "observed", value: "ENROLLED" } }),
          expect.objectContaining({ sourceRole: "joined_catalog", catalogLayout: { state: "observed", value: "NOTENROLLED" } }),
        ]),
        relations: {
          sameJoinId: "same",
          period: "unavailable",
          amount: "unavailable",
          state: "different",
        },
      })],
      totalCount: 1,
      truncated: false,
    });
    expect(JSON.stringify(result.conflictDetails)).not.toMatch(
      /private-join-value-must-not-survive|sorBenefitId|benefitId|sourceId|"joinId"\s*:|raw/i,
    );

    const reversed = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [{
        sorBenefitId: "private-join-value-must-not-survive",
        benefitName: "Synthetic Adobe Credit",
        category: "usage",
        status: "IN_PROGRESS",
        trackerDuration: "Synthetic monthly period",
        tracker: {
          spentAmount: "1.00",
          targetAmount: "10.00",
          remainingAmount: "9.00",
          targetCurrency: "USD",
          targetUnit: "MONETARY",
        },
      }] }]),
      catalogResponseSchema.parse({ benefits: Object.fromEntries(Object.entries(catalogs).reverse()) }),
    );
    expect(reversed.conflictDetails).toEqual(result.conflictDetails);
  });

  it("keeps join relations deterministic when equivalent candidates expose different joins", () => {
    const trackers = [
      {
        sorBenefitId: "shared-private-join",
        benefitName: "Synthetic Adobe Credit",
        category: "usage",
        status: "IN_PROGRESS",
        tracker: { spentAmount: "2", targetUnit: "PASSES" },
      },
      {
        sorBenefitId: "shared-private-join",
        benefitName: "Synthetic Adobe Credit",
        category: "usage",
        status: "IN_PROGRESS",
        tracker: { spentAmount: "1", targetUnit: "PASSES" },
      },
      {
        sorBenefitId: "different-private-join",
        benefitName: "Synthetic Adobe Statement Credit",
        category: "usage",
        status: "IN_PROGRESS",
        tracker: { spentAmount: "2", targetUnit: "PASSES" },
      },
    ];
    const normalize = (items: typeof trackers) => normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: items }]),
      catalogResponseSchema.parse({ benefits: {} }),
    ).conflictDetails;

    const result = normalize(trackers);
    const reversed = normalize([...trackers].reverse());

    expect(result).toEqual(reversed);
    expect(result.details).toHaveLength(1);
    expect(result.details[0]).toMatchObject({
      category: "tracker_state_collision",
      candidateCount: 3,
      relations: { sameJoinId: "different" },
    });
    expect(JSON.stringify(result)).not.toMatch(/shared-private-join|different-private-join|joinId/);
  });

  it("marks partially exposed relation evidence unavailable instead of treating absence as a difference", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [
        {
          sorBenefitId: "shared-join",
          benefitName: "Synthetic Adobe Credit",
          category: "usage",
          status: "IN_PROGRESS",
          trackerDuration: "Synthetic monthly period",
          tracker: { spentAmount: "1", targetAmount: "10", targetUnit: "PASSES" },
        },
        {
          sorBenefitId: "shared-join",
          benefitName: "Synthetic Adobe Credit",
          category: "usage",
          status: "IN_PROGRESS",
          tracker: { spentAmount: "1", targetUnit: "PASSES" },
        },
      ] }]),
      catalogResponseSchema.parse({ benefits: {} }),
    );

    expect(result.conflictDetails.details).toHaveLength(1);
    expect(result.conflictDetails.details[0].relations).toEqual({
      sameJoinId: "same",
      period: "unavailable",
      amount: "unavailable",
      state: "same",
    });
  });

  it("caps conflict candidates while retaining a bounded total and truncation marker", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: Array.from({ length: 6 }, (_, index) => ({
        sorBenefitId: `source-value-${index}`,
        benefitName: "Synthetic Adobe Credit",
        category: "usage",
        status: "IN_PROGRESS",
        tracker: { spentAmount: String(index), targetUnit: "PASSES" },
      })) }]),
      catalogResponseSchema.parse({ benefits: {} }),
    );
    expect(result.conflictDetails.details).toHaveLength(1);
    expect(result.conflictDetails.details[0]).toMatchObject({
      category: "tracker_state_collision",
      candidateCount: 6,
      candidatesTruncated: true,
    });
    expect(result.conflictDetails.details[0].candidates).toHaveLength(4);
    expect(result.conflictDetails.details[0].candidates.map((candidate) => candidate.candidateIndex)).toEqual([1, 2, 3, 4]);
    expect(JSON.stringify(result.conflictDetails)).not.toMatch(/source-value|sorBenefitId|sourceId|"joinId"\s*:/i);
  });

  it("caps conflict detail groups and marks global truncation deterministically", () => {
    const entries = Array.from({ length: 30 }, (_, groupIndex) => [
      [`group-${groupIndex}-a`, {
        sorBenefitId: `private-group-${groupIndex}`,
        benefitTitle: `Synthetic Adobe Credit Group ${groupIndex} A`,
        layoutType: "ENROLLED",
        isEnrollable: true,
      }],
      [`group-${groupIndex}-b`, {
        sorBenefitId: `private-group-${groupIndex}`,
        benefitTitle: `Synthetic Adobe Credit Group ${groupIndex} B`,
        layoutType: "NOTENROLLED",
        isEnrollable: true,
      }],
    ]).flat() as Array<[string, object]>;
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [] }]),
      catalogResponseSchema.parse({ benefits: Object.fromEntries(entries) }),
    );

    expect(result.conflictDetails).toMatchObject({ totalCount: 30, truncated: true });
    expect(result.conflictDetails.details).toHaveLength(24);
    expect(new Set(result.conflictDetails.details.map((detail) => detail.conflictKey)).size).toBe(24);
    expect(JSON.stringify(result.conflictDetails)).not.toMatch(/private-group|sorBenefitId|sourceId|"joinId"\s*:/i);
  });

  it("keeps only reviewed account product fields at the transport boundary", () => {
    const parsed = memberResponseSchema.parse({ accounts: [{
      account_token: "invented-token",
      product: { description: "Synthetic Card", unrelatedPrivateField: "discard-me" },
      account: {
        account_token: "unsupported-nested-token",
        relationship: "BASIC",
        product: { description: "Unsupported Nested Product" },
        display_account_number: "1234",
        unrelatedNestedField: "discard-me-too",
      },
    }] });
    expect(parsed.accounts[0].product).toEqual({ description: "Synthetic Card" });
    expect(parsed.accounts[0].account).toEqual({ relationship: "BASIC", display_account_number: "1234" });
    expect(JSON.stringify(parsed)).not.toMatch(/unrelatedPrivateField|unrelatedNestedField|unsupported-nested-token|Unsupported Nested Product/);
  });

  it("rejects raw objects in reviewed scalar fields instead of retaining them in the minimal projection", () => {
    expect(() => memberResponseSchema.parse({ accounts: [{
      account_token: { opaque: "object-must-not-survive" },
      product: { description: "Synthetic Card" },
      relationship: "BASIC",
      display_account_number: "1234",
    }] })).toThrow();
    expect(() => trackerResponseSchema.parse([{ trackers: [{
      benefitName: { localized: "object-must-not-survive" },
      category: "usage",
    }] }])).toThrow();
    expect(() => catalogResponseSchema.parse({ benefits: {
      candidate: { layoutType: "NOTENROLLED", isEnrollable: { value: true } },
    } })).toThrow();
  });

  it("rejects malformed required envelopes instead of silently treating them as empty", () => {
    expect(() => catalogResponseSchema.parse(malformedCatalogFixture)).toThrow();
    expect(() => trackerResponseSchema.parse([{ tracker: [] }])).toThrow();
    expect(() => memberResponseSchema.parse({ accounts: {} })).toThrow();
  });
});
