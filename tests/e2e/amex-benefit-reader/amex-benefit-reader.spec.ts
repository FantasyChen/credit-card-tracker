import { expect, test } from "@playwright/test";
import { digestAmexSyncEnvelope, parseAmexSyncEnvelope } from "../../../src/lib/amex-benefit-reader/sync-contract";
import {
  IDENTITY_SECRET_KEY,
  PRIMARY_ONLY_COMPATIBILITY_KEY,
  PRIMARY_ONLY_COMPATIBILITY_VALUE,
  STORE_KEY,
  SYNC_MAILBOX_KEY,
  SYNTHETIC_AMEX_NON_BENEFITS_URL,
  SYNTHETIC_HANDOFF_TRANSFER_ID,
  SyntheticAmexHarness,
} from "./harness";

interface PersistedCardRecord {
  localCardId: string;
  identity: { productName: string; endingDigits: string; sourceFingerprint: string };
  freshness: string;
  completeness: string;
  observedAt: string | null;
  lastAttemptAt: string;
  error: null | { code: string; message: string };
  latest: null | {
    productName: string;
    endingDigits: string;
    completeness: string;
    benefits: Array<{ title: string; earnedOrUsed: { state: string; value?: { value: string } } }>;
  };
}

interface PersistedEnvelope {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  cards: Record<string, PersistedCardRecord>;
  lastScan: null | {
    scanId?: string;
    startedAt: string;
    finishedAt: string;
    status: string;
    discoveredCardCount: number;
    attemptedCardCount: number;
    unknownAccountVariantCount: number;
    visibleContext: string;
    cards: Array<{ localCardId: string | null; result: string; issueCode: string | null }>;
  };
}

function persistedEnvelope(harness: SyntheticAmexHarness): PersistedEnvelope {
  const value = harness.storage.get(STORE_KEY);
  expect(value).toBeTruthy();
  return value as PersistedEnvelope;
}

function legacyRoleUnverifiedStore(): PersistedEnvelope {
  const localCardId = "11111111-1111-4111-8111-111111111111";
  return {
    schemaVersion: 1,
    revision: 4,
    updatedAt: "2026-07-15T12:00:00.000Z",
    cards: {
      [localCardId]: {
        localCardId,
        identity: {
          productName: "American Express Gold Card",
          endingDigits: "1234",
          sourceFingerprint: "a".repeat(64),
        },
        freshness: "error_no_data",
        completeness: "failed",
        observedAt: null,
        lastAttemptAt: "2026-07-15T12:00:00.000Z",
        error: {
          code: "network_error",
          message: "The first-party Amex read request did not complete.",
        },
        latest: null,
      },
    },
    lastScan: {
      scanId: "22222222-2222-4222-8222-222222222222",
      startedAt: "2026-07-15T11:59:00.000Z",
      finishedAt: "2026-07-15T12:00:00.000Z",
      status: "failed",
      discoveredCardCount: 1,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 0,
      visibleContext: "unchanged",
      cards: [{ localCardId, result: "failed", issueCode: "network_error" }],
    },
  };
}

function expectNoRawSyntheticIdentity(harness: SyntheticAmexHarness): void {
  const serialized = JSON.stringify(harness.storageSnapshot());
  expect(serialized).not.toContain("invented-e2e-primary-token");
  expect(serialized).not.toContain("invented-e2e-secondary-primary-token");
  expect(serialized).not.toContain("invented-e2e-excluded-supplementary-token");
  expect(serialized).not.toContain("invented-e2e-empty-benefits-token");
  expect(serialized).not.toContain("invented-e2e-scale-token");
  expect(serialized).not.toContain("invented-scale-");
  expect(serialized).not.toContain("accountToken");
  expect(serialized).not.toContain("sorBenefitId");
}

async function waitForFinalReader(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Scan all cards" })).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByRole("status")).toHaveCount(0);
}

test("invalidates one role-unverified snapshot and mailbox without reading Amex", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  const identitySecret = "f".repeat(64);
  harness.storage.set(STORE_KEY, legacyRoleUnverifiedStore());
  harness.storage.set(IDENTITY_SECRET_KEY, identitySecret);
  harness.storage.set(SYNC_MAILBOX_KEY, { syntheticPendingMailbox: true });

  await harness.installBeforeNavigation();
  await harness.openAndInject();

  expect(persistedEnvelope(harness)).toMatchObject({ revision: 5, cards: {}, lastScan: null });
  expect(harness.storage.get(IDENTITY_SECRET_KEY)).toBe(identitySecret);
  expect(harness.storage.has(SYNC_MAILBOX_KEY)).toBe(false);
  expect(harness.storage.get(PRIMARY_ONLY_COMPATIBILITY_KEY)).toBe(PRIMARY_ONLY_COMPATIBILITY_VALUE);
  expect(harness.apiRequests()).toHaveLength(0);
  await expect(page.getByText("No local card observations yet")).toBeVisible();
  harness.assertNetworkStayedSynthetic();
});

test("shows only real scan progress until the built reader reaches a terminal result", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  const readerHost = page.locator("#perks-reminder-amex-reader");
  await expect(readerHost).toHaveAttribute("data-reader-version", "0.3.3");
  const scanButton = page.getByRole("button", { name: "Scan all cards" });
  expect(harness.apiRequests()).toHaveLength(0);
  await scanButton.click();

  const progress = page.getByRole("progressbar", { name: "Scan progress" });
  await expect(progress).toHaveAttribute("max", "2");
  await expect(progress).toHaveAttribute("value", "1");
  await expect(page.getByRole("status")).toContainText("Reading card 1 of 2");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.locator(".card-group")).toHaveCount(0);
  await expect(page.locator(".filters")).toHaveCount(0);
  await expect(page.getByText("Data and privacy", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sync reviewed" })).toHaveCount(0);

  await waitForFinalReader(page);
  await expect(page.getByRole("heading", { name: "American Express Gold Card •••• 1234" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Synthetic $12 Monthly Dining Credit Statement Credit" })).toBeVisible();
  await expect(page.getByText("Jul 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("CalenderYear", { exact: true })).toHaveCount(0);
  await expect(page.locator(".quality-pill")).toHaveCount(0);
  await expect(page.locator(".data-quality")).toHaveCount(0);
  await expect(page.getByText("Scan notes", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Observed", { exact: true })).toHaveCount(0);

  expect(harness.apiRequests("member")).toHaveLength(1);
  expect(harness.apiRequests("tracker")).toHaveLength(2);
  expect(harness.apiRequests("catalog")).toHaveLength(2);
  const stored = persistedEnvelope(harness);
  expect(stored.lastScan).toMatchObject({ status: "complete", discoveredCardCount: 2, attemptedCardCount: 2, visibleContext: "unchanged" });
  expect(Object.values(stored.cards)).toHaveLength(2);
  expectNoRawSyntheticIdentity(harness);

  const requestCount = harness.apiRequests().length;
  await harness.reloadAndInject();
  await expect(page.getByRole("button", { name: "Scan all cards" })).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator(".card-group")).toHaveCount(1);
  expect(harness.apiRequests()).toHaveLength(requestCount);
  await harness.proveUnexpectedNetworkIsBlocked();
  harness.assertNetworkStayedSynthetic();
});

test("keeps primary-only discovery and reviewed exclusions in the generated bundle", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "reviewed_exclusions");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await waitForFinalReader(page);

  await expect(page.locator(".card-group")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Dell Technologies Credit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "$200 Airline Fee Credit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resy Credit", exact: true })).toBeVisible();
  await expect(page.getByText("35% Airline Bonus", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Link Your Resy Profile", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-amex-conflict]")).toHaveCount(0);
  expect(harness.apiRequests("tracker")).toHaveLength(2);
  expect(harness.apiRequests("catalog")).toHaveLength(2);
  expectNoRawSyntheticIdentity(harness);
  harness.assertNetworkStayedSynthetic();
});

test("keeps partial observations internal while rendering their safely retained benefits", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "catalog_failure");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await waitForFinalReader(page);

  await expect(page.getByRole("heading", { name: "Synthetic $12 Monthly Dining Credit Statement Credit" })).toBeVisible();
  await expect(page.getByText("$4.00 of $10.00")).toBeVisible();
  await expect(page.getByText("Partial data", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Data quality and timestamps", { exact: true })).toHaveCount(0);
  await expect(page.getByText("The benefit catalog was unavailable", { exact: false })).toHaveCount(0);
  const record = Object.values(persistedEnvelope(harness).cards)[0];
  expect(record).toMatchObject({ freshness: "current", completeness: "partial", latest: { completeness: "partial" } });
  expect(harness.apiRequests("catalog")).toHaveLength(2);
  harness.assertNetworkStayedSynthetic();
});

test("cancels a later physical-card read while keeping only the in-progress workspace visible", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "cancellation");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await harness.waitForCancellationRequest();

  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toHaveAttribute("value", "2");
  await expect(page.getByRole("status")).toContainText("Reading card 2 of 2");
  await expect(page.locator(".card-group")).toHaveCount(0);
  await expect(page.getByText("Data and privacy", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await harness.releaseCancellationRequest();
  await waitForFinalReader(page);

  expect(harness.apiRequestSequence()).toEqual([
    "member:scan-1",
    "tracker:primary:scan-1",
    "catalog:primary:scan-1",
    "tracker:secondary:scan-1",
  ]);
  expect(persistedEnvelope(harness).lastScan).toMatchObject({ status: "interrupted", attemptedCardCount: 2 });
  await expect(page.getByRole("heading", { name: "American Express Gold Card •••• 1234" })).toBeVisible();
  harness.assertNetworkStayedSynthetic();
});

test("keeps a high-scale account filter-aware without summary or data-quality UI", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "high_scale");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await waitForFinalReader(page);

  await expect(page.getByRole("button", { name: "Remaining 130" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".card-group")).toHaveCount(16);
  await expect(page.locator(".benefit-card")).toHaveCount(130);
  await expect(page.locator(".account-summary")).toHaveCount(0);
  await expect(page.getByText("Data notes", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Used 0" }).click();
  await expect(page.locator(".card-group")).toHaveCount(0);
  await expect(page.locator(".account-empty-state")).toContainText("130 remaining benefits");
  expect(harness.apiRequests("tracker")).toHaveLength(16);
  expect(harness.apiRequests("catalog")).toHaveLength(16);
  expectNoRawSyntheticIdentity(harness);
  harness.assertNetworkStayedSynthetic();
});

test("mounts once and scans manually from a selector-free non-benefits route", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInjectConcurrentCopies(SYNTHETIC_AMEX_NON_BENEFITS_URL);

  await expect(page.getByRole("button", { name: "Open Perks Reminder Amex benefit reader" })).toBeVisible();
  expect(harness.apiRequests()).toHaveLength(0);
  await page.getByRole("button", { name: "Open Perks Reminder Amex benefit reader" }).click();
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await waitForFinalReader(page);
  expect(page.url()).toBe(SYNTHETIC_AMEX_NON_BENEFITS_URL);
  expect(persistedEnvelope(harness).lastScan).toMatchObject({ visibleContext: "unchanged", attemptedCardCount: 2 });
  harness.assertNetworkStayedSynthetic();
});

test("bridges one strict storage-only mailbox on the exact first-party handoff branch", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  const now = new Date();
  const envelope = parseAmexSyncEnvelope({
    envelopeVersion: "amex-sync-envelope/1",
    observationContractVersion: "amex-benefits/2",
    scanId: "22222222-2222-4222-8222-222222222222",
    scanFinishedAt: now.toISOString(),
    cards: [{
      sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
      productKey: "american-express-platinum-card",
      endingDigits: "1234",
      observedAt: now.toISOString(),
      parserVersion: "amex-api-us/2.0.2",
      rows: [{
        creditFamilyKey: "american-express-platinum-card:resy",
        sourcePeriod: { kind: "calendar_date_range", startDate: "2026-07-01", endDate: "2026-09-30", timeZone: "UTC" },
        enrollmentState: "enrolled",
        completionState: "incomplete",
        earnedOrUsed: { value: "25.00", unit: "USD", currency: "USD" },
        targetOrLimit: { value: "100.00", unit: "USD", currency: "USD" },
      }],
    }],
    exclusions: [],
  });
  const mailbox = {
    mailboxVersion: "amex-sync-mailbox/1" as const,
    transferId: SYNTHETIC_HANDOFF_TRANSFER_ID,
    nonce: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    digest: await digestAmexSyncEnvelope(envelope),
    envelope,
  };

  await harness.openHandoffAndInject(mailbox);
  await expect(page.locator("body")).toHaveAttribute("data-handoff-state", "accepted");
  expect(harness.storage.has(SYNC_MAILBOX_KEY)).toBe(false);
  await expect(page.locator("#perks-reminder-amex-reader")).toHaveCount(0);
  expect(harness.apiRequests()).toHaveLength(0);
  harness.assertNetworkStayedSynthetic();
});
