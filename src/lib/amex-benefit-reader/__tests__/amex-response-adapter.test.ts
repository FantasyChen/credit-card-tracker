import {
  catalogResponseSchema,
  memberResponseSchema,
  trackerResponseSchema,
} from "../amex-api-contract";
import { normalizeBenefits, parseAccountDiscovery } from "../amex-response-adapter";

function normalize(input: {
  productName?: string;
  trackers?: unknown[];
  catalog?: Record<string, unknown>;
}) {
  return normalizeBenefits({
    productName: input.productName ?? "Synthetic Unreviewed Card",
    trackerResponse: trackerResponseSchema.parse([{ trackers: input.trackers ?? [] }]),
    catalogResponse: catalogResponseSchema.parse({ benefits: input.catalog ?? {} }),
  });
}

function usageTracker(title: string, overrides: Record<string, unknown> = {}) {
  return {
    benefitName: title,
    category: "usage",
    status: "IN_PROGRESS",
    tracker: {
      spentAmount: "1.00",
      targetAmount: "10.00",
      remainingAmount: "9.00",
      targetCurrency: "USD",
      targetUnit: "MONETARY",
    },
    ...overrides,
  };
}

describe("Amex private response adapter", () => {
  it("emits only characterized top-level BASIC cards and excludes nested SUPP before identity inspection", () => {
    const excludedToken = "invented-supplementary-token";
    const discovery = parseAccountDiscovery(memberResponseSchema.parse({
      accounts: [
        {
          account_token: "invented-primary-token",
          relationship: "BASIC",
          product: { description: "Synthetic Primary Card" },
          display_account_number: "1234",
          supplementary_accounts: [{
            account_token: excludedToken,
            relationship: "SUPP",
            product: { description: "Synthetic Primary Card" },
            account_number: "4111111111119999",
          }],
        },
        {
          account_token: "unknown-role-token",
          relationship: "FUTURE",
          product: { description: "Synthetic Unknown Card" },
          display_account_number: "5678",
        },
      ],
    }));

    expect(discovery.cards).toEqual([{
      rawAccountToken: "invented-primary-token",
      productName: "Synthetic Primary Card",
      endingDigits: "1234",
    }]);
    expect(discovery.unknownVariantCount).toBe(1);
    expect(discovery.issueCodes).toEqual(["unknown_account_variant"]);
    expect(JSON.stringify(discovery)).not.toContain(excludedToken);
  });

  it("uses relationship placement rather than Additional or Companion product wording", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse({
      accounts: [
        {
          account_token: "additional-basic-token",
          relationship: "BASIC",
          product: { description: "Additional Platinum Card" },
          display_account_number: "1234",
        },
        {
          account_token: "primary-token",
          relationship: "BASIC",
          product: { description: "American Express Platinum Card" },
          display_account_number: "5678",
          supplementary_accounts: [{
            account_token: "companion-supp-token",
            account: { relationship: "SUPP", display_account_number: "9999" },
          }],
        },
      ],
    }));

    expect(discovery.cards.map((card) => card.productName)).toEqual([
      "Additional Platinum Card",
      "American Express Platinum Card",
    ]);
    expect(discovery.unknownVariantCount).toBe(0);
    expect(JSON.stringify(discovery)).not.toContain("companion-supp-token");
  });

  it("accepts explicit four/five digit endings and rejects conflicts, full numbers, and token-derived endings", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse({
      accounts: [
        {
          account_token: "four-token",
          product: { description: "Synthetic Four" },
          account: { relationship: "BASIC", display_account_number: "ending 1234" },
        },
        {
          account_token: "five-token",
          relationship: "BASIC",
          product: { description: "Synthetic Five" },
          display_account_number: "54321",
        },
        {
          account_token: "token-ending-7777",
          relationship: "BASIC",
          product: { description: "Synthetic Unsafe" },
          account_number: "4111111111117777",
        },
        {
          account_token: "conflict-token",
          relationship: "BASIC",
          product: { description: "Synthetic Conflict" },
          display_account_number: "1111",
          account: { relationship: "BASIC", display_account_number: "2222" },
        },
      ],
    }));

    expect(discovery.cards.map((card) => card.endingDigits)).toEqual(["1234", "54321"]);
    expect(discovery.unknownVariantCount).toBe(2);
    expect(JSON.stringify(discovery)).not.toContain("4111111111117777");
  });

  it("deduplicates exact source tokens without merging distinct physical cards by product name", () => {
    const discovery = parseAccountDiscovery(memberResponseSchema.parse({
      accounts: [
        { account_token: "token-a", relationship: "BASIC", product: { description: "Same Card" }, display_account_number: "1234" },
        { account_token: "token-b", relationship: "BASIC", product: { description: "Same Card" }, display_account_number: "1234" },
        { account_token: "token-a", relationship: "BASIC", product: { description: "Same Card" }, display_account_number: "1234" },
      ],
    }));
    expect(discovery.cards.map((card) => card.rawAccountToken)).toEqual(["token-a", "token-b"]);
    expect(discovery.issueCodes).toContain("duplicate_card_entry");
  });

  it("normalizes exact usage trackers identically for unrelated bounded product names", () => {
    const trackers = [
      usageTracker("$219 CLEAR+ Credit"),
      usageTracker("$300 Equinox Credit"),
      usageTracker("Digital Entertainment Credit"),
    ];
    const morgan = normalize({ productName: "Morgan Stanley Platinum", trackers });
    const unrelated = normalize({ productName: "Unrelated Bounded Product", trackers });

    expect(morgan).toEqual(unrelated);
    expect(morgan.benefits.map((benefit) => benefit.title)).toEqual([
      "$219 CLEAR+ Credit",
      "$300 Equinox Credit",
      "Digital Entertainment Credit",
    ]);
    expect(morgan.benefits.every((benefit) =>
      benefit.activityKind === "credit_usage"
      && benefit.category.state === "observed"
      && benefit.category.value === "usage")).toBe(true);
    expect(JSON.stringify(morgan)).not.toMatch(/productKey|creditFamilyKey|sorBenefitId/);
  });

  it("retains ten Morgan-like usage rows including CLEAR+ and Equinox", () => {
    const titles = [
      "$200 Airline Fee Credit",
      "$219 CLEAR+ Credit",
      "$300 Equinox Credit",
      "$300 lululemon Credit",
      "$400 Resy Credit",
      "Digital Entertainment Credit",
      "Hotel Credit",
      "Saks Fifth Avenue Credit",
      "Uber Cash",
      "Walmart+ Credit",
    ];
    const result = normalize({
      productName: "Morgan Stanley Platinum",
      trackers: titles.map((title, index) => usageTracker(title, { sorBenefitId: `invented-${index}` })),
    });

    expect(result.issueCodes).toEqual([]);
    expect(result.benefits).toHaveLength(10);
    expect(result.benefits.map((benefit) => benefit.title)).toEqual([...titles].sort());
  });

  it("admits only exact normalized usage and never manufactures catalog-only rows", () => {
    const result = normalize({
      productName: "Delta SkyMiles Gold Business Card",
      trackers: [
        usageTracker("$150 Delta Stays Credit", { sorBenefitId: "delta-stays" }),
        usageTracker("$200 Delta Flight Credit", { category: "spend", status: "FUTURE", tracker: { spentAmount: "bad" } }),
        usageTracker("Access Benefit", { category: "access" }),
        usageTracker("Loan Benefit", { category: "loan" }),
        usageTracker("Missing Category", { category: undefined }),
      ],
      catalog: {
        rideshare: {
          sorBenefitId: "catalog-only-rideshare",
          benefitTitle: "$120 Rideshare Credit",
          layoutType: "NOTENROLLED",
          isEnrollable: true,
        },
      },
    });

    expect(result.benefits.map((benefit) => benefit.title)).toEqual(["$150 Delta Stays Credit"]);
    expect(result.issueCodes).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/Delta Flight|Rideshare|Access Benefit|Loan Benefit|FUTURE/);
  });

  it("produces a truthful complete-empty normalization for cards without usage trackers", () => {
    const result = normalize({
      productName: "Hilton Honors Card",
      trackers: [
        usageTracker("Status Upgrade", { category: "spend" }),
        usageTracker("Rewards Information", { category: "access" }),
      ],
      catalog: {
        reward: { benefitTitle: "Annual Reward", layoutType: "NOTENROLLED", isEnrollable: true },
      },
    });
    expect(result).toEqual({
      benefits: [],
      issueCodes: [],
      conflictDiagnostics: [],
      conflictDetails: { details: [], totalCount: 0, truncated: false },
    });
  });

  it("uses catalog only for unambiguous enrollment enrichment without replacing tracker title", () => {
    const result = normalize({
      trackers: [usageTracker("Tracker Display Title", { sorBenefitId: "joined" })],
      catalog: {
        joined: {
          sorBenefitId: "joined",
          benefitTitle: "Different Catalog Display Title",
          layoutType: "NOTENROLLED",
          isEnrollable: true,
        },
      },
    });
    expect(result.benefits).toHaveLength(1);
    expect(result.benefits[0]).toMatchObject({
      title: "Tracker Display Title",
      enrollmentState: { state: "observed", value: "required" },
    });
  });

  it("keeps tracker data but fails the card closed for ambiguous catalog enrichment", () => {
    const result = normalize({
      trackers: [usageTracker("Tracker Credit", { sorBenefitId: "ambiguous" })],
      catalog: {
        first: { sorBenefitId: "ambiguous", benefitTitle: "First", layoutType: "ENROLLED" },
        second: { sorBenefitId: "ambiguous", benefitTitle: "Second", layoutType: "NOTENROLLED", isEnrollable: true },
      },
    });
    expect(result.benefits).toHaveLength(1);
    expect(result.benefits[0]).toMatchObject({
      title: "Tracker Credit",
      enrollmentState: { state: "not_exposed" },
      issueCodes: ["benefit_identity_conflict"],
    });
    expect(result.issueCodes).toEqual(["benefit_identity_conflict"]);
    expect(result.conflictDiagnostics).toEqual(["ambiguous_catalog_join"]);
    expect(JSON.stringify(result.conflictDetails)).not.toContain("sorBenefitId");
  });

  it("deduplicates equivalent trackers and reports materially different same-title state deterministically", () => {
    const first = usageTracker("Repeated Credit", {
      sorBenefitId: "private-a",
      tracker: { spentAmount: "1", targetUnit: "PASSES" },
    });
    const equivalentTitleVariant = {
      ...first,
      sorBenefitId: "private-c",
      benefitName: "  repeated   credit  ",
    };
    const equivalentForward = normalize({ trackers: [first, equivalentTitleVariant] });
    const equivalentReversed = normalize({ trackers: [equivalentTitleVariant, first] });
    expect(equivalentForward.benefits).toHaveLength(1);
    expect(equivalentReversed.benefits).toEqual(equivalentForward.benefits);
    expect(equivalentForward.issueCodes).toEqual([]);

    const second = usageTracker("Repeated Credit", {
      sorBenefitId: "private-b",
      tracker: { spentAmount: "2", targetUnit: "PASSES" },
    });
    const forward = normalize({ trackers: [first, second] });
    const reversed = normalize({ trackers: [second, first] });
    expect(reversed.benefits).toEqual(forward.benefits);
    expect(forward.issueCodes).toEqual(["benefit_identity_conflict"]);
    expect(forward.conflictDiagnostics).toEqual(["tracker_state_collision"]);
    expect(forward.conflictDetails).toMatchObject({ totalCount: 1, truncated: false });
    expect(JSON.stringify(forward)).not.toMatch(/private-a|private-b|sorBenefitId/);
  });

  it("ignores reviewed titles and explicit non-credit tracker titles before interpretation", () => {
    const result = normalize({
      trackers: [
        usageTracker("35% Airline Bonus", { status: "FUTURE", tracker: { spentAmount: "bad" } }),
        usageTracker("Link Your Resy Profile", { status: "FUTURE" }),
        usageTracker("Global Dining Access by Resy"),
        usageTracker("Resy Credit"),
      ],
    });
    expect(result.benefits.map((benefit) => benefit.title)).toEqual(["Resy Credit"]);
    expect(result.issueCodes).toEqual([]);
  });

  it("marks unknown status and quantity evidence partial without inventing values", () => {
    const result = normalize({
      trackers: [usageTracker("Unknown Evidence Credit", {
        status: "FUTURE",
        tracker: { spentAmount: "bad", targetAmount: "10", targetCurrency: "USD" },
      })],
    });
    expect(result.issueCodes).toEqual(["unknown_quantity", "unknown_status"]);
    expect(result.benefits[0]).toMatchObject({
      trackerState: { state: "unrecognized", issueCode: "unknown_status" },
      earnedOrUsed: { state: "unrecognized", issueCode: "unknown_quantity" },
      targetOrLimit: { state: "observed", value: { value: "10", unit: "unknown", currency: null } },
    });
  });

  it("keeps only bounded scalar projections at the transport boundary", () => {
    const parsed = memberResponseSchema.parse({ accounts: [{
      account_token: "invented-token",
      relationship: "BASIC",
      product: { description: "Synthetic Card", unrelatedPrivateField: "discard" },
      display_account_number: "1234",
    }] });
    expect(parsed.accounts[0].product).toEqual({ description: "Synthetic Card" });
    expect(() => trackerResponseSchema.parse([{ trackers: [{
      benefitName: { localized: "object-must-not-survive" },
      category: "usage",
    }] }])).toThrow();
    expect(() => catalogResponseSchema.parse({ benefits: {
      candidate: { layoutType: "NOTENROLLED", isEnrollable: { value: true } },
    } })).toThrow();
  });
});
