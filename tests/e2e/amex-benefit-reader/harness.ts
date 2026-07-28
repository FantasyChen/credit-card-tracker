import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { BrowserContext, Page, Request, Route } from "@playwright/test";

export const SYNTHETIC_AMEX_URL = "https://global.americanexpress.com/card-benefits/view-all";
export const SYNTHETIC_AMEX_NON_BENEFITS_URL = "https://global.americanexpress.com/account-overview";
export const SYNTHETIC_HANDOFF_TRANSFER_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const SYNTHETIC_HANDOFF_URL = `https://www.perks-reminder.com/integrations/amex-sync?transfer=${SYNTHETIC_HANDOFF_TRANSFER_ID}` as const;
export type SyntheticAmexDocumentUrl = typeof SYNTHETIC_AMEX_URL | typeof SYNTHETIC_AMEX_NON_BENEFITS_URL;
export type SyntheticDocumentUrl = SyntheticAmexDocumentUrl | typeof SYNTHETIC_HANDOFF_URL;
export const STORE_KEY = "perksReminder.amexBenefitReader.store.v1";
export const IDENTITY_SECRET_KEY = "perksReminder.amexBenefitReader.identitySecret.v1";
export const LEGACY_SYNC_MAILBOX_KEY = "perksReminder.amexBenefitReader.syncMailbox.v1";
export const SYNC_MAILBOX_KEY = "perksReminder.amexBenefitReader.syncMailbox.v2";
export const PRIMARY_ONLY_COMPATIBILITY_KEY = "perksReminder.amexBenefitReader.compat.primaryOnly.v1";
export const PRIMARY_ONLY_COMPATIBILITY_VALUE = "primary-only/1";
export const V3_SELECTION_COMPATIBILITY_KEY = "perksReminder.amexBenefitReader.compat.v3Selection.v1";
export const V3_SELECTION_COMPATIBILITY_VALUE = "v3-selection/1";

const MEMBER_URL = "https://global.americanexpress.com/api/servicing/v1/member";
const TRACKER_URL = "https://functions.americanexpress.com/ReadBestLoyaltyBenefitsTrackers.v1";
const CATALOG_URL = "https://functions.americanexpress.com/ReadLoyaltyBenefits.v2";
const DENIED_PROBE_URL = "https://unapproved.invalid/blocked-by-synthetic-harness";
const BUNDLE_PATH = resolve(process.cwd(), "build/amex-benefit-reader.user.js");

const PRIMARY_TOKEN = "invented-e2e-primary-token";
const SECONDARY_TOKEN = "invented-e2e-secondary-primary-token";
const EXCLUDED_SUPPLEMENTARY_TOKEN = "invented-e2e-excluded-supplementary-token";
const EMPTY_BENEFITS_TOKEN = "invented-e2e-empty-benefits-token";
const SYNTHETIC_ORIGIN = "https://global.americanexpress.com";

export type HarnessScenario = "complete" | "benefit_empty" | "all_benefit_empty" | "reviewed_exclusions" | "approved_v3_products" | "conflict_diagnostics" | "catalog_failure" | "cancellation" | "rescan_tracker_failure" | "high_scale";
export type ApiOperation = "member" | "tracker" | "catalog";
export type SyntheticCard = "primary" | "secondary" | "empty" | `scale-${number}`;

export interface SafeRequestRecord {
  method: string;
  origin: string;
  pathname: string;
  operation: ApiOperation | "preflight" | "document" | "blocked";
  syntheticCard?: SyntheticCard;
  scanNumber?: number;
}

interface ScenarioFixture {
  member: unknown;
  trackersByToken: Readonly<Record<string, unknown>>;
  catalogsByToken: Readonly<Record<string, unknown>>;
  catalogFailureTokens: ReadonlySet<string>;
}

class DeferredSignal {
  private resolvePromise!: () => void;
  readonly promise = new Promise<void>((resolve) => { this.resolvePromise = resolve; });

  trigger(): void {
    this.resolvePromise();
  }
}

class ExplicitGate {
  private readonly enteredSignal = new DeferredSignal();
  private readonly releaseSignal = new DeferredSignal();
  private readonly finishedSignal = new DeferredSignal();
  readonly entered = this.enteredSignal.promise;
  readonly released = this.releaseSignal.promise;
  readonly finished = this.finishedSignal.promise;

  enter(): void {
    this.enteredSignal.trigger();
  }

  release(): void {
    this.releaseSignal.trigger();
  }

  finish(): void {
    this.finishedSignal.trigger();
  }
}

const syntheticBenefitsDocument = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Synthetic Amex benefits harness</title></head>
  <body>
    <main>
      <h1>Synthetic American Express benefits page</h1>
      <button data-testid="simple_switcher_combobox" role="combobox" aria-expanded="false">
        Synthetic visible card ending 0000
      </button>
      <p>This document contains invented test data only.</p>
    </main>
  </body>
</html>`;

const syntheticNonBenefitsDocument = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Synthetic Amex account harness</title></head>
  <body>
    <main>
      <h1>Synthetic American Express account page</h1>
      <p>This selector-free document contains invented test data only.</p>
    </main>
  </body>
</html>`;

const syntheticHandoffDocument = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Synthetic private handoff</title></head>
  <body data-handoff-state="waiting">
    <main><h1>Synthetic Perks Reminder handoff</h1></main>
    <script>
      const transferId = ${JSON.stringify(SYNTHETIC_HANDOFF_TRANSFER_ID)};
      const announce = setInterval(() => {
        window.postMessage({ type: "perks-reminder:amex-sync-ready", transferId }, window.location.origin);
      }, 50);
      window.addEventListener("message", (event) => {
        if (event.source !== window || event.origin !== window.location.origin) return;
        const payload = event.data;
        if (!payload || payload.type !== "perks-reminder:amex-sync-payload" || payload.transferId !== transferId) return;
        window.__syntheticHandoffPayload = payload;
        history.replaceState(null, "", "/integrations/amex-sync");
        window.postMessage({
          type: "perks-reminder:amex-sync-accepted",
          transferId,
          nonce: payload.nonce,
        }, window.location.origin);
        document.body.dataset.handoffState = "accepted";
        clearInterval(announce);
      });
    </script>
  </body>
</html>`;

const syntheticDocuments = new Map<SyntheticDocumentUrl, string>([
  [SYNTHETIC_AMEX_URL, syntheticBenefitsDocument],
  [SYNTHETIC_AMEX_NON_BENEFITS_URL, syntheticNonBenefitsDocument],
  [SYNTHETIC_HANDOFF_URL, syntheticHandoffDocument],
]);

const primaryTrackers = [{
  trackers: [
    {
      sorBenefitId: "invented-dining-primary",
      benefitName: "Synthetic &#36;12 Monthly Dining Credit &#x3C;sup&#x3E;&#174;&#x3C;/sup&#x3E; Statement Credit",
      category: "usage",
      status: "IN_PROGRESS",
      trackerDuration: "CalenderYear",
      periodStartDate: "2026-07-01",
      periodEndDate: "2026-07-31",
      tracker: {
        spentAmount: "4.00",
        targetAmount: "10.00",
        remainingAmount: "6.00",
        targetCurrency: "USD",
        targetUnit: "MONETARY",
      },
    },
    {
      sorBenefitId: "invented-protection-primary",
      benefitName: "Synthetic Cell Phone Protection",
      category: "usage",
      status: "ACTIVE",
    },
  ],
}];

const rescannedPrimaryTrackers = structuredClone(primaryTrackers);
rescannedPrimaryTrackers[0].trackers[0].tracker!.spentAmount = "7.00";
rescannedPrimaryTrackers[0].trackers[0].tracker!.remainingAmount = "3.00";

const primaryCatalog = {
  benefits: {
    dining: {
      sorBenefitId: "invented-dining-primary",
      benefitTitle: "Synthetic &#36;12 Monthly Dining Credit &#x3C;sup&#x3E;&#174;&#x3C;/sup&#x3E; Statement Credit",
      layoutType: "ENROLLED",
      isEnrollable: true,
    },
    uber: {
      sorBenefitId: "invented-uber-primary",
      benefitShortTitle: "Synthetic Uber Cash<sup>‡</sup>",
      layoutType: "NOTENROLLED",
      isEnrollable: true,
    },
    information: {
      sorBenefitId: "invented-information-primary",
      benefitTitle: "Synthetic Global Dining Access by Resy",
      layoutType: "LOGGEDIN",
      isEnrollable: false,
    },
  },
};

const zeroUsagePrimaryTrackers = structuredClone(primaryTrackers);
zeroUsagePrimaryTrackers[0].trackers.push({
  sorBenefitId: "invented-uber-primary",
  benefitName: "Synthetic Uber Cash",
  category: "usage",
  status: "IN_PROGRESS",
  trackerDuration: "Synthetic monthly period",
  periodStartDate: "2026-07-01",
  periodEndDate: "2026-07-31",
  tracker: {
    spentAmount: "0.00",
    targetAmount: "15.00",
    remainingAmount: "15.00",
    targetCurrency: "USD",
    targetUnit: "MONETARY",
  },
});
const zeroUsagePrimaryCatalog = structuredClone(primaryCatalog);
zeroUsagePrimaryCatalog.benefits.uber.layoutType = "ENROLLED";

const secondaryTrackers = [{
  trackers: [
    {
      sorBenefitId: "invented-dining-secondary-primary",
      benefitName: "Synthetic Dining Credit ‡",
      category: "usage",
      status: "ACHIEVED",
      trackerDuration: "QuarterYear",
      periodStartDate: "2026-07-01",
      periodEndDate: "2026-09-30",
      tracker: {
        spentAmount: "10.00",
        targetAmount: "10.00",
        remainingAmount: "0.00",
        targetCurrency: "USD",
        targetUnit: "MONETARY",
      },
    },
    {
      sorBenefitId: "invented-lounge-secondary-primary",
      benefitName: "Synthetic Centurion Lounge Access",
      category: "access",
      status: "ACTIVE",
    },
  ],
}];

const secondaryCatalog = {
  benefits: {
    dining: {
      sorBenefitId: "invented-dining-secondary-primary",
      benefitTitle: "Synthetic Dining Credit ‡",
      layoutType: "ENROLLED",
      isEnrollable: true,
    },
    wrongCard: {
      sorBenefitId: "invented-saks-secondary-primary",
      benefitTitle: "Synthetic Saks Fifth Avenue Credit",
      layoutType: "NOTENROLLED",
      isEnrollable: true,
    },
  },
};

const emptyBenefitTrackers = [{
  trackers: [{
    sorBenefitId: "invented-protection-empty",
    benefitName: "Synthetic Cell Phone Protection",
    category: "usage",
    status: "ACTIVE",
  }],
}];

const conflictDiagnosticTrackers = [{
  trackers: [
    {
      sorBenefitId: "invented-adobe-state-a",
      benefitName: "Synthetic Adobe Credit",
      category: "usage",
      status: "ACTIVE",
      tracker: { spentAmount: "1", targetUnit: "PASSES" },
    },
    {
      sorBenefitId: "invented-adobe-state-b",
      benefitName: "Synthetic Adobe Credit",
      category: "usage",
      status: "ACTIVE",
      tracker: { spentAmount: "2", targetUnit: "PASSES" },
    },
    {
      sorBenefitId: "invented-key-mismatch",
      benefitName: "Synthetic Adobe Credit",
      category: "usage",
      status: "ACTIVE",
    },
    {
      sorBenefitId: "invented-ambiguous-wireless",
      benefitName: "Synthetic Wireless Bill Credit",
      category: "usage",
      status: "ACTIVE",
    },
    {
      sorBenefitId: "invented-indeed-tracker",
      benefitName: "Synthetic Indeed Credit",
      category: "usage",
      status: "ACTIVE",
    },
  ],
}];

const conflictDiagnosticCatalog = {
  benefits: {
    mismatch: {
      sorBenefitId: "invented-key-mismatch",
      benefitTitle: "Synthetic Hilton Credit",
      layoutType: "ENROLLED",
      isEnrollable: true,
    },
    ambiguousOne: {
      sorBenefitId: "invented-ambiguous-wireless",
      benefitTitle: "Synthetic Wireless Bill Credit",
      layoutType: "ENROLLED",
      isEnrollable: true,
    },
    ambiguousTwo: {
      sorBenefitId: "invented-ambiguous-wireless",
      benefitTitle: "Synthetic Wireless Statement Credit",
      layoutType: "NOTENROLLED",
      isEnrollable: true,
    },
    candidate: {
      sorBenefitId: "invented-indeed-candidate",
      benefitTitle: "Synthetic Indeed Statement Credit",
      layoutType: "NOTENROLLED",
      isEnrollable: true,
    },
  },
};

const reviewedExclusionTrackers = [{
  trackers: [
    {
      sorBenefitId: "invented-dell-spend-requirement",
      benefitName: "Dell Technologies Credit",
      category: "spend",
      status: "ACHIEVED",
      tracker: {
        spentAmount: "600.00",
        targetAmount: "600.00",
        targetCurrency: "USD",
        targetUnit: "MONETARY",
      },
    },
    {
      sorBenefitId: "invented-dell-usage-credit",
      benefitName: "Dell Technologies Credit",
      category: "usage",
      status: "IN_PROGRESS",
      trackerDuration: "HalfYear",
      periodStartDate: "2026-07-01",
      periodEndDate: "2026-12-31",
      tracker: {
        spentAmount: "1.00",
        targetAmount: "150.00",
        targetCurrency: "USD",
        targetUnit: "MONETARY",
      },
    },
    {
      sorBenefitId: "invented-airline-reviewed-join",
      benefitName: "$200 Airline Fee Credit",
      category: "usage",
      status: "IN_PROGRESS",
    },
  ],
}];

const reviewedExclusionCatalog = {
  benefits: {
    airlineFee: {
      sorBenefitId: "invented-airline-reviewed-join",
      benefitTitle: "$200 Airline Fee Credit",
      layoutType: "ENROLLED",
      isEnrollable: true,
    },
    airlineBonus: {
      sorBenefitId: "invented-airline-reviewed-join",
      benefitShortTitle: "Airline benefit",
      benefitTitle: "35% Airline Bonus",
      layoutType: "NOTENROLLED",
      isEnrollable: true,
    },
  },
};

const reviewedResyTrackers = [{
  trackers: [{
    sorBenefitId: "invented-resy-reviewed-join",
    benefitName: "Resy Credit",
    category: "usage",
    status: "IN_PROGRESS",
  }],
}];

const reviewedResyCatalog = {
  benefits: {
    resyCredit: {
      sorBenefitId: "invented-resy-reviewed-join",
      benefitTitle: "Resy Credit",
      layoutType: "ENROLLED",
      isEnrollable: true,
    },
    resyProfile: {
      sorBenefitId: "invented-resy-profile-candidate",
      benefitShortTitle: "Resy",
      benefitTitle: "Link Your Resy Profile",
      layoutType: "NOTENROLLED",
      isEnrollable: true,
    },
  },
};

const scaleBenefitTitles = [
  "Synthetic Airline Fee Credit",
  "Synthetic Uber Cash",
  "Synthetic Saks Credit",
  "Synthetic Resy Credit",
  "Synthetic Lululemon Credit",
  "Synthetic Hotel Credit",
  "Synthetic Digital Entertainment Credit",
  "Synthetic Uber One Credit",
  "Synthetic Oura Ring Credit",
] as const;

function highScaleFixture(): ScenarioFixture {
  const accounts: unknown[] = [];
  const trackersByToken: Record<string, unknown> = {};
  const catalogsByToken: Record<string, unknown> = {};
  for (let cardIndex = 1; cardIndex <= 16; cardIndex += 1) {
    const token = `invented-e2e-scale-token-${cardIndex}`;
    const benefitCount = cardIndex <= 2 ? 9 : 8;
    accounts.push({
      account_token: token,
      product: { description: "American Express Platinum Card" },
      account: { relationship: "BASIC", display_account_number: String(3000 + cardIndex) },
    });
    trackersByToken[token] = [{
      trackers: scaleBenefitTitles.slice(0, benefitCount).map((benefitName, benefitIndex) => ({
        sorBenefitId: `invented-scale-${cardIndex}-${benefitIndex}`,
        benefitName,
        category: "usage",
        status: "IN_PROGRESS",
        trackerDuration: "Synthetic annual period",
        tracker: {
          spentAmount: "1.00",
          targetAmount: "10.00",
          remainingAmount: "9.00",
          targetCurrency: "USD",
          targetUnit: "MONETARY",
        },
      })),
    }];
    catalogsByToken[token] = { benefits: {} };
  }
  return {
    member: { accounts },
    trackersByToken,
    catalogsByToken,
    catalogFailureTokens: new Set(),
  };
}

function scenarioFixture(scenario: HarnessScenario): ScenarioFixture {
  if (scenario === "high_scale") return highScaleFixture();
  if (scenario === "all_benefit_empty") {
    return {
      member: {
        accounts: [{
          account_token: PRIMARY_TOKEN,
          product: { description: "American Express Gold Card" },
          account: { relationship: "BASIC", display_account_number: "1234" },
        }],
      },
      trackersByToken: { [PRIMARY_TOKEN]: emptyBenefitTrackers },
      catalogsByToken: { [PRIMARY_TOKEN]: { benefits: {} } },
      catalogFailureTokens: new Set(),
    };
  }
  if (scenario === "reviewed_exclusions") {
    return {
      member: {
        accounts: [
          {
            account_token: PRIMARY_TOKEN,
            product: { description: "American Express Business Platinum Card" },
            account: { relationship: "BASIC", display_account_number: "1234" },
            supplementary_accounts: [{
              account_token: EXCLUDED_SUPPLEMENTARY_TOKEN,
              account: { relationship: "SUPP", display_account_number: "7777" },
            }],
          },
          {
            account_token: SECONDARY_TOKEN,
            product: { description: "American Express Platinum Card" },
            account: { relationship: "BASIC", display_account_number: "56789" },
          },
        ],
      },
      trackersByToken: {
        [PRIMARY_TOKEN]: reviewedExclusionTrackers,
        [SECONDARY_TOKEN]: reviewedResyTrackers,
      },
      catalogsByToken: {
        [PRIMARY_TOKEN]: reviewedExclusionCatalog,
        [SECONDARY_TOKEN]: reviewedResyCatalog,
      },
      catalogFailureTokens: new Set(),
    };
  }
  if (scenario === "approved_v3_products") {
    const morganTitles = [
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
    return {
      member: {
        accounts: [
          {
            account_token: PRIMARY_TOKEN,
            relationship: "BASIC",
            product: { description: "Morgan Stanley Platinum" },
            display_account_number: "1234",
          },
          {
            account_token: SECONDARY_TOKEN,
            relationship: "BASIC",
            product: { description: "Hilton Honors Card" },
            display_account_number: "56789",
          },
          {
            account_token: EMPTY_BENEFITS_TOKEN,
            relationship: "BASIC",
            product: { description: "Delta SkyMiles Gold Business Card" },
            display_account_number: "9999",
          },
        ],
      },
      trackersByToken: {
        [PRIMARY_TOKEN]: [{ trackers: morganTitles.map((benefitName, index) => ({
          sorBenefitId: `invented-morgan-${index}`,
          benefitName,
          category: "usage",
          status: "IN_PROGRESS",
        })) }],
        [SECONDARY_TOKEN]: [{ trackers: [{
          sorBenefitId: "invented-hilton-spend",
          benefitName: "Hilton Spend Requirement",
          category: "spend",
          status: "IN_PROGRESS",
        }] }],
        [EMPTY_BENEFITS_TOKEN]: [{ trackers: [
          {
            sorBenefitId: "invented-delta-stays",
            benefitName: "$150 Delta Stays Credit",
            category: "usage",
            status: "IN_PROGRESS",
          },
          {
            sorBenefitId: "invented-delta-flight-spend",
            benefitName: "$200 Delta Flight Credit",
            category: "spend",
            status: "IN_PROGRESS",
          },
        ] }],
      },
      catalogsByToken: {
        [PRIMARY_TOKEN]: { benefits: {} },
        [SECONDARY_TOKEN]: { benefits: {} },
        [EMPTY_BENEFITS_TOKEN]: { benefits: {
          catalogOnly: {
            sorBenefitId: "invented-delta-rideshare-catalog-only",
            benefitTitle: "$120 Rideshare Credit",
            layoutType: "NOTENROLLED",
            isEnrollable: true,
          },
        } },
      },
      catalogFailureTokens: new Set(),
    };
  }
  if (scenario === "conflict_diagnostics") {
    return {
      member: {
        accounts: [{
          account_token: PRIMARY_TOKEN,
          product: { description: "American Express Business Platinum Card" },
          account: { relationship: "BASIC", display_account_number: "1234" },
        }],
      },
      trackersByToken: { [PRIMARY_TOKEN]: conflictDiagnosticTrackers },
      catalogsByToken: { [PRIMARY_TOKEN]: conflictDiagnosticCatalog },
      catalogFailureTokens: new Set(),
    };
  }
  const hasSecondPrimaryCard = scenario !== "catalog_failure";
  const accounts: unknown[] = [{
    account_token: PRIMARY_TOKEN,
    product: { description: "American Express Gold Card" },
    account: { relationship: "BASIC", display_account_number: "1234" },
    supplementary_accounts: [{
      account_token: EXCLUDED_SUPPLEMENTARY_TOKEN,
      // Omit product text deliberately: a SUPP record may inherit its primary
      // parent's supported product name and still must never become scan work.
      account: { relationship: "SUPP", display_account_number: "7777" },
    }],
  }];
  if (hasSecondPrimaryCard) {
    accounts.push({
      account_token: SECONDARY_TOKEN,
      product: { description: "American Express Gold Card" },
      account: { relationship: "BASIC", display_account_number: "56789" },
    });
  }
  if (scenario === "benefit_empty") {
    accounts.push({
      account_token: EMPTY_BENEFITS_TOKEN,
      product: { description: "American Express Gold Card" },
      account: { relationship: "BASIC", display_account_number: "9999" },
    });
  }

  return {
    member: { accounts },
    trackersByToken: {
      [PRIMARY_TOKEN]: scenario === "benefit_empty" ? zeroUsagePrimaryTrackers : primaryTrackers,
      ...(hasSecondPrimaryCard ? { [SECONDARY_TOKEN]: secondaryTrackers } : {}),
      ...(scenario === "benefit_empty" ? { [EMPTY_BENEFITS_TOKEN]: emptyBenefitTrackers } : {}),
    },
    catalogsByToken: {
      [PRIMARY_TOKEN]: scenario === "benefit_empty" ? zeroUsagePrimaryCatalog : primaryCatalog,
      ...(hasSecondPrimaryCard ? { [SECONDARY_TOKEN]: secondaryCatalog } : {}),
    },
    catalogFailureTokens: scenario === "catalog_failure"
      ? new Set([PRIMARY_TOKEN])
      : scenario === "benefit_empty"
        ? new Set([EMPTY_BENEFITS_TOKEN])
        : new Set(),
  };
}

function syntheticCardForToken(token: string): SyntheticCard {
  if (token === PRIMARY_TOKEN) return "primary";
  if (token === SECONDARY_TOKEN) return "secondary";
  if (token === EMPTY_BENEFITS_TOKEN) return "empty";
  const scaleMatch = /^invented-e2e-scale-token-(\d+)$/.exec(token);
  if (scaleMatch) return `scale-${Number(scaleMatch[1])}`;
  throw new Error("The request used an unknown synthetic account token.");
}

function clone<T>(value: T): T {
  return value == null ? value : structuredClone(value);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function safeRequestLabel(route: Route): string {
  const request = route.request();
  const url = new URL(request.url());
  return `${request.method()} ${url.origin}${url.pathname}`;
}

function jsonHeaders(): Record<string, string> {
  return {
    "access-control-allow-credentials": "true",
    "access-control-allow-origin": SYNTHETIC_ORIGIN,
    "content-type": "application/json; charset=utf-8",
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, headers: jsonHeaders(), body: JSON.stringify(body) });
}

async function assertExactJsonRequest(route: Route, expectedBody: unknown, expectedAccept: string): Promise<void> {
  const request = route.request();
  assert.equal(request.method(), "POST");
  assert.equal(await request.headerValue("accept"), expectedAccept);
  assert.equal(await request.headerValue("content-type"), "application/json");
  assert.deepEqual(JSON.parse(request.postData() ?? "null"), expectedBody);
}

async function shortDelay(): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 160));
}

export class SyntheticAmexHarness {
  readonly storage = new Map<string, unknown>();
  readonly requests: SafeRequestRecord[] = [];
  readonly routingErrors: string[] = [];
  readonly runtimeErrors: string[] = [];
  private readonly fixture: ScenarioFixture;
  private readonly cancellationGate = new ExplicitGate();
  private readonly cancellationRequestFailed = new DeferredSignal();
  private expectedCatalogHttpErrorLogs: number;
  private expectedTrackerHttpErrorLogs: number;
  private expectedCancellationRequest: Request | null = null;
  private expectedCancellationConsoleErrors = 0;
  private expectedDeniedProbeConsoleError = false;
  private expectedDeniedProbeFailure = false;
  private verifiedDeniedProbeCount = 0;
  private expectedMainFrameNavigationUrl: SyntheticDocumentUrl | null = null;
  private expectedHandoffHistoryCleanup = false;
  private currentDocumentUrl: SyntheticDocumentUrl = SYNTHETIC_AMEX_URL;
  private expectedConfirmation: string | null = null;
  private activeScanNumber = 0;

  constructor(
    private readonly context: BrowserContext,
    readonly page: Page,
    private readonly scenario: HarnessScenario = "complete",
  ) {
    this.fixture = scenarioFixture(scenario);
    this.expectedCatalogHttpErrorLogs = scenario === "catalog_failure" || scenario === "benefit_empty" ? 2 : 0;
    this.expectedTrackerHttpErrorLogs = scenario === "rescan_tracker_failure" ? 2 : 0;
  }

  async installBeforeNavigation(): Promise<void> {
    this.page.on("pageerror", () => {
      this.runtimeErrors.push("The generated bundle emitted an uncaught page error.");
    });
    this.page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (
        this.expectedDeniedProbeConsoleError
        && message.location().url === DENIED_PROBE_URL
        && /^Failed to load resource:/.test(message.text())
      ) {
        this.expectedDeniedProbeConsoleError = false;
        return;
      }
      if (
        this.expectedCatalogHttpErrorLogs > 0
        && message.location().url === CATALOG_URL
        && /^Failed to load resource: the server responded with a status of 500/.test(message.text())
      ) {
        this.expectedCatalogHttpErrorLogs -= 1;
        return;
      }
      if (
        this.expectedTrackerHttpErrorLogs > 0
        && message.location().url === TRACKER_URL
        && /^Failed to load resource: the server responded with a status of 500/.test(message.text())
      ) {
        this.expectedTrackerHttpErrorLogs -= 1;
        return;
      }
      if (
        this.expectedCancellationRequest !== null
        && this.expectedCancellationConsoleErrors > 0
        && message.location().url === TRACKER_URL
        && /^Failed to load resource:.*ERR_ABORTED/.test(message.text())
      ) {
        this.expectedCancellationConsoleErrors -= 1;
        return;
      }
      this.runtimeErrors.push("The generated bundle emitted an unexpected console error.");
    });
    this.page.on("requestfailed", (request) => {
      if (
        this.expectedDeniedProbeFailure
        && request.method() === "GET"
        && request.url() === DENIED_PROBE_URL
      ) {
        this.expectedDeniedProbeFailure = false;
        return;
      }
      if (request === this.expectedCancellationRequest) {
        this.expectedCancellationRequest = null;
        this.expectedCancellationConsoleErrors = 0;
        this.cancellationRequestFailed.trigger();
        return;
      }
      const url = new URL(request.url());
      this.runtimeErrors.push(`A browser request failed: ${request.method()} ${url.origin}${url.pathname}`);
    });
    this.page.on("popup", async (popup) => {
      this.runtimeErrors.push("The generated bundle opened an unexpected popup.");
      await popup.close().catch(() => undefined);
    });
    this.page.on("websocket", () => {
      this.runtimeErrors.push("The generated bundle opened an unexpected WebSocket.");
    });
    this.context.on("serviceworker", () => {
      this.runtimeErrors.push("The generated bundle registered an unexpected service worker.");
    });
    this.page.on("framenavigated", (frame) => {
      if (frame !== this.page.mainFrame()) return;
      const url = new URL(frame.url());
      if (this.expectedMainFrameNavigationUrl === frame.url()) {
        this.expectedMainFrameNavigationUrl = null;
        return;
      }
      if (this.expectedHandoffHistoryCleanup
        && url.origin === "https://www.perks-reminder.com"
        && url.pathname === "/integrations/amex-sync"
        && url.search === "") {
        this.expectedHandoffHistoryCleanup = false;
        return;
      }
      this.runtimeErrors.push(`The main frame navigated unexpectedly to ${url.origin}${url.pathname}.`);
    });
    this.page.on("dialog", async (dialog) => {
      try {
        if (
          this.expectedConfirmation !== null
          && dialog.type() === "confirm"
          && dialog.message() === this.expectedConfirmation
        ) {
          this.expectedConfirmation = null;
          await dialog.accept();
          return;
        }
        this.runtimeErrors.push("The generated bundle opened an unexpected dialog.");
        await dialog.dismiss();
      } catch {
        this.runtimeErrors.push("The synthetic harness could not close a browser dialog.");
      }
    });

    await this.context.exposeBinding("__amexE2eGmGetValue", (_source, key: unknown, defaultValue: unknown) => {
      if (typeof key !== "string") throw new Error("The synthetic GM key must be a string.");
      return this.storage.has(key) ? clone(this.storage.get(key)) : clone(defaultValue);
    });
    await this.context.exposeBinding("__amexE2eGmSetValue", (_source, key: unknown, value: unknown) => {
      if (typeof key !== "string") throw new Error("The synthetic GM key must be a string.");
      this.storage.set(key, clone(value));
    });
    await this.context.exposeBinding("__amexE2eGmDeleteValue", (_source, key: unknown) => {
      if (typeof key !== "string") throw new Error("The synthetic GM key must be a string.");
      this.storage.delete(key);
    });
    await this.context.addInitScript(`
      const blockedApi = (name) => function blockedBrowserApi() {
        throw new Error(name + " is disabled by the synthetic Amex harness.");
      };
      for (const name of ["XMLHttpRequest", "WebSocket", "EventSource"]) {
        Object.defineProperty(globalThis, name, {
          configurable: false,
          writable: false,
          value: blockedApi(name),
        });
      }
      Object.defineProperty(globalThis, "open", {
        configurable: false,
        writable: false,
        value: blockedApi("window.open"),
      });
      Object.defineProperty(globalThis.navigator, "sendBeacon", {
        configurable: false,
        writable: false,
        value: blockedApi("navigator.sendBeacon"),
      });

      // Tampermonkey exposes a callable fetch facade in its userscript sandbox.
      // Keep the harness on native Chromium fetch while matching that receiver-neutral call behavior.
      const nativeFetch = globalThis.fetch.bind(globalThis);
      Object.defineProperty(globalThis, "fetch", {
        configurable: false,
        writable: false,
        value: (input, init) => nativeFetch(input, init),
      });
      Object.defineProperty(globalThis, "GM", {
        configurable: false,
        value: Object.freeze({
          getValue: (key, defaultValue) => globalThis.__amexE2eGmGetValue(key, defaultValue),
          setValue: (key, value) => globalThis.__amexE2eGmSetValue(key, value),
          deleteValue: (key) => globalThis.__amexE2eGmDeleteValue(key),
        }),
      });
    `);

    await this.context.route("**/*", async (route) => {
      try {
        await this.routeSyntheticRequest(route);
      } catch (error) {
        this.routingErrors.push(`Rejected malformed routed request ${safeRequestLabel(route)} (${errorName(error)}).`);
        await route.abort("blockedbyclient").catch(() => undefined);
      }
    });
  }

  async openAndInject(documentUrl: SyntheticAmexDocumentUrl = SYNTHETIC_AMEX_URL): Promise<void> {
    await this.openDocument(documentUrl);
    await this.injectBundle();
  }

  async openAndInjectConcurrentCopies(documentUrl: SyntheticAmexDocumentUrl): Promise<void> {
    await this.openDocument(documentUrl);
    await Promise.all([this.injectBundle(), this.injectBundle()]);
  }

  async openHandoffAndInject(mailbox: unknown): Promise<void> {
    await access(BUNDLE_PATH);
    this.storage.set(SYNC_MAILBOX_KEY, clone(mailbox));
    this.currentDocumentUrl = SYNTHETIC_HANDOFF_URL;
    await this.runExpectedNavigation(
      SYNTHETIC_HANDOFF_URL,
      () => this.page.goto(SYNTHETIC_HANDOFF_URL, { waitUntil: "domcontentloaded" }),
    );
    this.expectedHandoffHistoryCleanup = true;
    await this.page.addScriptTag({ path: BUNDLE_PATH });
  }

  async reloadAndInject(): Promise<void> {
    await this.runExpectedNavigation(this.currentDocumentUrl, () => this.page.reload({ waitUntil: "domcontentloaded" }));
    await this.injectBundle();
  }

  acceptNextConfirmation(message: string): void {
    assert.equal(this.expectedConfirmation, null);
    this.expectedConfirmation = message;
  }

  async proveUnexpectedNetworkIsBlocked(): Promise<void> {
    assert.equal(this.expectedDeniedProbeFailure, false);
    const blockedBefore = this.operationRequests("blocked").length;
    this.expectedDeniedProbeConsoleError = true;
    this.expectedDeniedProbeFailure = true;
    const result = await this.page.evaluate(async (url) => {
      try {
        await fetch(url);
        return "resolved";
      } catch {
        return "rejected";
      }
    }, DENIED_PROBE_URL);
    assert.equal(result, "rejected");
    assert.equal(this.expectedDeniedProbeFailure, false);
    assert.equal(this.operationRequests("blocked").length, blockedBefore + 1);
    this.verifiedDeniedProbeCount += 1;
  }

  apiRequests(operation?: ApiOperation): SafeRequestRecord[] {
    return this.requests.filter((request) =>
      (request.operation === "member" || request.operation === "tracker" || request.operation === "catalog")
      && (!operation || request.operation === operation));
  }

  apiRequestSequence(): string[] {
    return this.apiRequests().map((request) =>
      request.syntheticCard
        ? `${request.operation}:${request.syntheticCard}:scan-${request.scanNumber}`
        : `${request.operation}:scan-${request.scanNumber}`);
  }

  async waitForCancellationRequest(): Promise<void> {
    assert.equal(this.scenario, "cancellation");
    await this.cancellationGate.entered;
  }

  async releaseCancellationRequest(): Promise<void> {
    assert.equal(this.scenario, "cancellation");
    this.cancellationGate.release();
    await this.cancellationGate.finished;
    await this.cancellationRequestFailed.promise;
  }

  operationRequests(operation: SafeRequestRecord["operation"]): SafeRequestRecord[] {
    return this.requests.filter((request) => request.operation === operation);
  }

  storageSnapshot(): Record<string, unknown> {
    return clone(Object.fromEntries(this.storage));
  }

  assertNetworkStayedSynthetic(): void {
    assert.deepEqual(this.routingErrors, []);
    assert.deepEqual(this.runtimeErrors, []);
    assert.equal(this.expectedCatalogHttpErrorLogs, 0);
    assert.equal(this.expectedTrackerHttpErrorLogs, 0);
    assert.equal(this.expectedCancellationRequest, null);
    assert.equal(this.expectedCancellationConsoleErrors, 0);
    assert.equal(this.expectedDeniedProbeConsoleError, false);
    assert.equal(this.expectedDeniedProbeFailure, false);
    assert.equal(this.expectedMainFrameNavigationUrl, null);
    if (this.expectedHandoffHistoryCleanup && this.page.url() === "https://www.perks-reminder.com/integrations/amex-sync") {
      this.expectedHandoffHistoryCleanup = false;
    }
    assert.equal(this.expectedHandoffHistoryCleanup, false);
    assert.equal(this.expectedConfirmation, null);
    assert.equal(this.operationRequests("blocked").length, this.verifiedDeniedProbeCount);
    const allowedByOperation = new Map<SafeRequestRecord["operation"], ReadonlySet<string>>([
      ["document", new Set(Array.from(syntheticDocuments.keys(), (documentUrl) => {
        const url = new URL(documentUrl);
        return `GET ${url.origin}${url.pathname}`;
      }))],
      ["preflight", new Set([
        `OPTIONS ${new URL(TRACKER_URL).origin}${new URL(TRACKER_URL).pathname}`,
        `OPTIONS ${new URL(CATALOG_URL).origin}${new URL(CATALOG_URL).pathname}`,
      ])],
      ["member", new Set([`GET ${new URL(MEMBER_URL).origin}${new URL(MEMBER_URL).pathname}`])],
      ["tracker", new Set([`POST ${new URL(TRACKER_URL).origin}${new URL(TRACKER_URL).pathname}`])],
      ["catalog", new Set([`POST ${new URL(CATALOG_URL).origin}${new URL(CATALOG_URL).pathname}`])],
      ["blocked", new Set([`GET ${new URL(DENIED_PROBE_URL).origin}${new URL(DENIED_PROBE_URL).pathname}`])],
    ]);
    for (const request of this.requests) {
      const tuple = `${request.method} ${request.origin}${request.pathname}`;
      assert.equal(allowedByOperation.get(request.operation)?.has(tuple), true);
    }
  }

  private async openDocument(documentUrl: SyntheticAmexDocumentUrl): Promise<void> {
    await access(BUNDLE_PATH);
    assert.equal(syntheticDocuments.has(documentUrl), true);
    this.currentDocumentUrl = documentUrl;
    await this.runExpectedNavigation(documentUrl, () => this.page.goto(documentUrl, { waitUntil: "domcontentloaded" }));
  }

  private async runExpectedNavigation(
    documentUrl: SyntheticDocumentUrl,
    navigate: () => Promise<unknown>,
  ): Promise<void> {
    assert.equal(this.expectedMainFrameNavigationUrl, null);
    this.expectedMainFrameNavigationUrl = documentUrl;
    try {
      await navigate();
    } finally {
      if (this.expectedMainFrameNavigationUrl !== null) {
        this.runtimeErrors.push("An expected synthetic main-frame navigation did not complete.");
        this.expectedMainFrameNavigationUrl = null;
      }
    }
  }

  private async injectBundle(): Promise<void> {
    await this.page.addScriptTag({ path: BUNDLE_PATH });
    await this.page.locator("#perks-reminder-amex-reader").waitFor({ state: "attached" });
  }

  private record(
    route: Route,
    operation: SafeRequestRecord["operation"],
    syntheticCard?: SyntheticCard,
  ): void {
    const url = new URL(route.request().url());
    this.requests.push({
      method: route.request().method(),
      origin: url.origin,
      pathname: url.pathname,
      operation,
      ...(syntheticCard ? { syntheticCard } : {}),
      ...(operation === "member" || operation === "tracker" || operation === "catalog"
        ? { scanNumber: this.activeScanNumber }
        : {}),
    });
  }

  private async routeSyntheticRequest(route: Route): Promise<void> {
    const request = route.request();
    const url = request.url();

    const syntheticDocument = syntheticDocuments.get(url as SyntheticAmexDocumentUrl);
    if (syntheticDocument && request.method() === "GET" && request.resourceType() === "document") {
      this.record(route, "document");
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: syntheticDocument });
      return;
    }

    if (request.method() === "OPTIONS" && (url === TRACKER_URL || url === CATALOG_URL)) {
      this.record(route, "preflight");
      assert.equal(await request.headerValue("origin"), SYNTHETIC_ORIGIN);
      assert.equal(await request.headerValue("access-control-request-method"), "POST");
      assert.equal(await request.headerValue("access-control-request-headers"), "content-type");
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "POST",
          "access-control-allow-origin": SYNTHETIC_ORIGIN,
        },
      });
      return;
    }

    if (url === MEMBER_URL && request.method() === "GET") {
      this.activeScanNumber += 1;
      this.record(route, "member");
      assert.equal(request.postData(), null);
      assert.equal(await request.headerValue("accept"), "application/json");
      await shortDelay();
      await fulfillJson(route, this.fixture.member);
      return;
    }

    if (url === TRACKER_URL) {
      const body = JSON.parse(request.postData() ?? "null") as unknown;
      assert.equal(Array.isArray(body), true);
      const accountToken = (body as Array<{ accountToken?: unknown }>)[0]?.accountToken;
      assert.equal(typeof accountToken, "string");
      const syntheticCard = syntheticCardForToken(accountToken as string);
      this.record(route, "tracker", syntheticCard);
      await assertExactJsonRequest(route, [{ accountToken, locale: "en-US", limit: "ALL" }], "*/*");

      if (this.scenario === "cancellation" && syntheticCard === "secondary" && this.activeScanNumber === 1) {
        assert.equal(this.expectedCancellationRequest, null);
        assert.equal(this.expectedCancellationConsoleErrors, 0);
        this.expectedCancellationRequest = request;
        this.expectedCancellationConsoleErrors = 1;
        this.cancellationGate.enter();
        await this.cancellationGate.released;
        await route.abort("aborted").catch(() => undefined);
        this.cancellationGate.finish();
        return;
      }

      await shortDelay();
      if (this.scenario === "rescan_tracker_failure" && syntheticCard === "secondary" && this.activeScanNumber === 2) {
        await fulfillJson(route, { syntheticError: true }, 500);
        return;
      }
      const response = this.scenario === "rescan_tracker_failure" && syntheticCard === "primary" && this.activeScanNumber === 2
        ? rescannedPrimaryTrackers
        : this.fixture.trackersByToken[accountToken as string];
      assert.notEqual(response, undefined);
      await fulfillJson(route, response);
      return;
    }

    if (url === CATALOG_URL) {
      const body = JSON.parse(request.postData() ?? "null") as { accountToken?: unknown };
      assert.equal(typeof body.accountToken, "string");
      const syntheticCard = syntheticCardForToken(body.accountToken as string);
      this.record(route, "catalog", syntheticCard);
      await assertExactJsonRequest(route, { accountToken: body.accountToken, locale: "en-US" }, "application/json");
      await shortDelay();
      if (this.fixture.catalogFailureTokens.has(body.accountToken as string)) {
        await fulfillJson(route, { syntheticError: true }, 500);
        return;
      }
      const response = this.fixture.catalogsByToken[body.accountToken as string];
      assert.notEqual(response, undefined);
      await fulfillJson(route, response);
      return;
    }

    this.record(route, "blocked");
    await route.abort("blockedbyclient");
  }
}
