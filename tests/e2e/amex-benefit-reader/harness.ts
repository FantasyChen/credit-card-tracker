import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { BrowserContext, Page, Request, Route } from "@playwright/test";

export const SYNTHETIC_AMEX_URL = "https://global.americanexpress.com/card-benefits/view-all";
export const STORE_KEY = "perksReminder.amexBenefitReader.store.v1";
export const IDENTITY_SECRET_KEY = "perksReminder.amexBenefitReader.identitySecret.v1";

const MEMBER_URL = "https://global.americanexpress.com/api/servicing/v1/member";
const TRACKER_URL = "https://functions.americanexpress.com/ReadBestLoyaltyBenefitsTrackers.v1";
const CATALOG_URL = "https://functions.americanexpress.com/ReadLoyaltyBenefits.v2";
const DENIED_PROBE_URL = "https://unapproved.invalid/blocked-by-synthetic-harness";
const BUNDLE_PATH = resolve(process.cwd(), "build/amex-benefit-reader.user.js");

const PRIMARY_TOKEN = "invented-e2e-primary-token";
const SUPPLEMENTARY_TOKEN = "invented-e2e-supplementary-token";
const SYNTHETIC_ORIGIN = "https://global.americanexpress.com";

export type HarnessScenario = "complete" | "catalog_failure" | "cancellation" | "rescan_tracker_failure";
export type ApiOperation = "member" | "tracker" | "catalog";
export type SyntheticCard = "primary" | "supplementary";

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

const syntheticDocument = `<!doctype html>
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

const primaryTrackers = [{
  trackers: [
    {
      sorBenefitId: "invented-dining-primary",
      benefitName: "Synthetic Monthly Dining Credit",
      category: "spend",
      status: "IN_PROGRESS",
      trackerDuration: "Synthetic monthly period",
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
      benefitTitle: "Synthetic Monthly Dining Credit",
      layoutType: "ENROLLED",
      isEnrollable: true,
    },
    uber: {
      sorBenefitId: "invented-uber-primary",
      benefitShortTitle: "Synthetic Uber Cash",
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

const supplementaryTrackers = [{
  trackers: [
    {
      sorBenefitId: "invented-dining-supplementary",
      benefitName: "Synthetic Dining Credit",
      category: "spend",
      status: "ACHIEVED",
      trackerDuration: "Synthetic monthly period",
      tracker: {
        spentAmount: "10.00",
        targetAmount: "10.00",
        remainingAmount: "0.00",
        targetCurrency: "USD",
        targetUnit: "MONETARY",
      },
    },
    {
      sorBenefitId: "invented-lounge-supplementary",
      benefitName: "Synthetic Centurion Lounge Access",
      category: "access",
      status: "ACTIVE",
    },
  ],
}];

const supplementaryCatalog = {
  benefits: {
    dining: {
      sorBenefitId: "invented-dining-supplementary",
      benefitTitle: "Synthetic Dining Credit",
      layoutType: "ENROLLED",
      isEnrollable: true,
    },
    wrongCard: {
      sorBenefitId: "invented-saks-supplementary",
      benefitTitle: "Synthetic Saks Fifth Avenue Credit",
      layoutType: "NOTENROLLED",
      isEnrollable: true,
    },
  },
};

function scenarioFixture(scenario: HarnessScenario): ScenarioFixture {
  const hasSupplementaryCard = scenario !== "catalog_failure";
  const member = {
    accounts: [{
      account_token: PRIMARY_TOKEN,
      product: { description: "American Express Gold Card" },
      account: { relationship: "BASIC", display_account_number: "1234" },
      ...(hasSupplementaryCard ? {
        supplementary_accounts: [{
          account_token: SUPPLEMENTARY_TOKEN,
          product: { description: "American Express Gold Card" },
          account: { relationship: "SUPP", display_account_number: "56789" },
        }],
      } : {}),
    }],
  };

  return {
    member,
    trackersByToken: hasSupplementaryCard
      ? { [PRIMARY_TOKEN]: primaryTrackers, [SUPPLEMENTARY_TOKEN]: supplementaryTrackers }
      : { [PRIMARY_TOKEN]: primaryTrackers },
    catalogsByToken: hasSupplementaryCard
      ? { [PRIMARY_TOKEN]: primaryCatalog, [SUPPLEMENTARY_TOKEN]: supplementaryCatalog }
      : { [PRIMARY_TOKEN]: primaryCatalog },
    catalogFailureTokens: scenario === "catalog_failure" ? new Set([PRIMARY_TOKEN]) : new Set(),
  };
}

function syntheticCardForToken(token: string): SyntheticCard {
  if (token === PRIMARY_TOKEN) return "primary";
  if (token === SUPPLEMENTARY_TOKEN) return "supplementary";
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
  private expectedMainFrameNavigation = false;
  private expectedConfirmation: string | null = null;
  private activeScanNumber = 0;

  constructor(
    private readonly context: BrowserContext,
    readonly page: Page,
    private readonly scenario: HarnessScenario = "complete",
  ) {
    this.fixture = scenarioFixture(scenario);
    this.expectedCatalogHttpErrorLogs = scenario === "catalog_failure" ? 2 : 0;
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
      if (this.expectedMainFrameNavigation && frame.url() === SYNTHETIC_AMEX_URL) {
        this.expectedMainFrameNavigation = false;
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

  async openAndInject(): Promise<void> {
    await access(BUNDLE_PATH);
    await this.runExpectedNavigation(() => this.page.goto(SYNTHETIC_AMEX_URL, { waitUntil: "domcontentloaded" }));
    await this.injectBundle();
  }

  async reloadAndInject(): Promise<void> {
    await this.runExpectedNavigation(() => this.page.reload({ waitUntil: "domcontentloaded" }));
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
    assert.equal(this.expectedMainFrameNavigation, false);
    assert.equal(this.expectedConfirmation, null);
    assert.equal(this.operationRequests("blocked").length, this.verifiedDeniedProbeCount);
    const allowedByOperation = new Map<SafeRequestRecord["operation"], ReadonlySet<string>>([
      ["document", new Set([`GET ${new URL(SYNTHETIC_AMEX_URL).origin}${new URL(SYNTHETIC_AMEX_URL).pathname}`])],
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

  private async runExpectedNavigation(navigate: () => Promise<unknown>): Promise<void> {
    assert.equal(this.expectedMainFrameNavigation, false);
    this.expectedMainFrameNavigation = true;
    try {
      await navigate();
    } finally {
      if (this.expectedMainFrameNavigation) {
        this.runtimeErrors.push("An expected synthetic main-frame navigation did not complete.");
        this.expectedMainFrameNavigation = false;
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

    if (url === SYNTHETIC_AMEX_URL && request.method() === "GET" && request.resourceType() === "document") {
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

      if (this.scenario === "cancellation" && syntheticCard === "supplementary" && this.activeScanNumber === 1) {
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
      if (this.scenario === "rescan_tracker_failure" && syntheticCard === "supplementary" && this.activeScanNumber === 2) {
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
