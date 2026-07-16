import accountsFixture from "../__fixtures__/accounts.json";
import catalogFixture from "../__fixtures__/benefit-catalog.json";
import malformedCatalogFixture from "../__fixtures__/catalog-malformed.json";
import trackersFixture from "../__fixtures__/benefit-trackers.json";
import unknownStatusFixture from "../__fixtures__/trackers-unknown-status.json";
import { catalogResponseSchema, memberResponseSchema, trackerResponseSchema } from "../amex-api-contract";
import { normalizeBenefits, parseAccountDiscovery } from "../amex-response-adapter";

describe("Amex private response adapter", () => {
  it("flattens only characterized BASIC and SUPP cards with explicit endings", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse(accountsFixture));
    expect(discovery.cards).toEqual([
      {
        rawAccountToken: "invented-primary-token-a",
        productName: "Synthetic Rewards Card",
        endingDigits: "12345",
        relationship: "BASIC",
      },
      {
        rawAccountToken: "invented-supp-token-b",
        productName: "Synthetic Rewards Card",
        endingDigits: "54321",
        relationship: "SUPP",
      },
      {
        rawAccountToken: "invented-primary-token-c",
        productName: "Synthetic Rewards Card",
        endingDigits: "9876",
        relationship: "BASIC",
      },
    ]);
    expect(discovery.knownNonCardCount).toBe(0);
    expect(discovery.unknownVariantCount).toBe(2);
    expect(discovery.issueCodes).toContain("unknown_account_variant");
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
      expect.objectContaining({ rawAccountToken: "nested-four-token", endingDigits: "1234", relationship: "BASIC" }),
      expect.objectContaining({ rawAccountToken: "matching-five-token", endingDigits: "54321", relationship: "BASIC" }),
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

  it("rejects conflicting alternate card identity fields instead of choosing one", () => {
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
    expect(discovery.unknownVariantCount).toBe(3);
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
      title: "Synthetic Enrollment Candidate",
      enrollmentState: { state: "observed", value: "required" },
      targetOrLimit: { state: "not_exposed" },
      period: { state: "not_exposed" },
    });
    expect(result.benefits.some((benefit) => benefit.title === "Synthetic Information Only")).toBe(false);
  });

  it("maps characterized live tracker and catalog enums without inventing enrollment or units", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [
        {
          sorBenefitId: "access-id",
          benefitName: "Synthetic Access Counter",
          category: "access",
          status: "IN_PROGRESS",
          tracker: { spentAmount: "2", targetAmount: "10", targetUnit: "PASSES" },
        },
        {
          sorBenefitId: "usage-id",
          benefitName: "Synthetic Usage Counter",
          category: "usage",
          status: "ACTIVE",
          tracker: { spentAmount: "3", targetAmount: "8", targetUnit: "PASSES" },
        },
        {
          sorBenefitId: "loan-id",
          benefitName: "Synthetic Loan Progress",
          category: "loan",
          status: "IN_PROGRESS",
          tracker: { spentAmount: "25.00", targetAmount: "100.00", targetUnit: "MONETARY", targetCurrency: "USD" },
        },
        {
          sorBenefitId: "spend-id",
          benefitName: "Synthetic Spend Progress",
          category: "spend",
          status: "IN_PROGRESS",
        },
      ] }]),
      catalogResponseSchema.parse({ benefits: {
        access: { sorBenefitId: "access-id", layoutType: "LOGGEDIN" },
        usage: { sorBenefitId: "usage-id", layoutType: "SUPP" },
        loan: { sorBenefitId: "loan-id", layoutType: "ENROLLED" },
        spend: { sorBenefitId: "spend-id", layoutType: "NOTENROLLED", isEnrollable: true },
        loggedInOnly: { sorBenefitId: "catalog-only-logged-in", benefitTitle: "Synthetic Logged In Information", layoutType: "LOGGEDIN" },
        supplementaryOnly: { sorBenefitId: "catalog-only-supp", benefitTitle: "Synthetic Supplementary Information", layoutType: "SUPP" },
      } }),
    );

    expect(result.issueCodes).toEqual([]);
    expect(result.benefits).toHaveLength(4);
    expect(result.benefits.map((benefit) => [benefit.category, benefit.activityKind])).toEqual([
      [{ state: "observed", value: "access" }, "spend_progress"],
      [{ state: "observed", value: "usage" }, "spend_progress"],
      [{ state: "observed", value: "loan" }, "spend_progress"],
      [{ state: "observed", value: "spend" }, "spend_progress"],
    ]);
    expect(result.benefits[0]).toMatchObject({
      enrollmentState: { state: "not_exposed" },
      trackerState: { state: "observed", value: "in_progress" },
      completionState: { state: "observed", value: "incomplete" },
      earnedOrUsed: { state: "observed", value: { value: "2", unit: "count", currency: null } },
    });
    expect(result.benefits[1].enrollmentState).toEqual({ state: "not_exposed" });
    expect(result.benefits[2]).toMatchObject({
      enrollmentState: { state: "observed", value: "enrolled" },
      targetOrLimit: { state: "observed", value: { value: "100.00", unit: "USD", currency: "USD" } },
    });
    expect(result.benefits[3].enrollmentState).toEqual({ state: "observed", value: "required" });
  });

  it("maps IN_PROGRESS to in-progress and incomplete for a characterized category", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [{
        benefitName: "Synthetic In-Progress Usage",
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
        benefitName: "Synthetic Noncandidate Tracker",
        category: "spend",
        status: "ACTIVE",
      }] }]),
      catalogResponseSchema.parse({ benefits: {
        joined: {
          sorBenefitId: "not-enrollable-id",
          benefitTitle: "Synthetic Noncandidate Tracker",
          layoutType: "NOTENROLLED",
          isEnrollable: false,
        },
        catalogOnly: {
          sorBenefitId: "catalog-only-noncandidate",
          benefitTitle: "Synthetic Catalog Noncandidate",
          layoutType: "NOTENROLLED",
          isEnrollable: false,
        },
      } }),
    );
    expect(result.issueCodes).toEqual([]);
    expect(result.benefits).toHaveLength(1);
    expect(result.benefits[0]).toMatchObject({
      title: "Synthetic Noncandidate Tracker",
      enrollmentState: { state: "not_exposed" },
    });
  });

  it("keeps uncharacterized categories and units partial without inferring semantics", () => {
    const result = normalizeBenefits(
      trackerResponseSchema.parse([{ trackers: [
        {
          benefitName: "Synthetic Uncharacterized Category",
          category: "credits",
          status: "ACTIVE",
        },
        {
          benefitName: "Synthetic Missing Unit",
          category: "spend",
          status: "ACTIVE",
          tracker: { spentAmount: "1.00", targetCurrency: "USD" },
        },
        {
          benefitName: "Synthetic Missing Currency",
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
        unknown: { sorBenefitId: "unknown-layout-id", benefitTitle: "Synthetic Unknown Layout", layoutType: "FUTURE_LAYOUT" },
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
        benefitName: "Synthetic Statusless Progress",
        category: "spend",
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
        benefitName: "Synthetic Tracker Title",
        category: "spend",
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
      title: "Synthetic Tracker Title",
      enrollmentState: { state: "not_exposed" },
    });
  });

  it("treats conflicting semantic benefit identities as incomplete without ordinals", () => {
    const result = normalizeBenefits(trackerResponseSchema.parse([{ trackers: [
      { sorBenefitId: "id-a", benefitName: "Same Benefit", category: "spend", status: "ACTIVE", tracker: { spentAmount: "1", targetUnit: "PASSES" } },
      { sorBenefitId: "id-b", benefitName: "Same Benefit", category: "spend", status: "ACTIVE", tracker: { spentAmount: "2", targetUnit: "PASSES" } },
    ] }]), catalogResponseSchema.parse({ benefits: {} }));
    expect(result.benefits).toHaveLength(1);
    expect(result.issueCodes).toContain("benefit_identity_conflict");
    expect(result.benefits[0].benefitKey).not.toMatch(/-1$|-2$/);
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
      category: "spend",
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
