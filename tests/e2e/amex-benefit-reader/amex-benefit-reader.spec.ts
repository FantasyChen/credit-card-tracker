import { expect, test } from "@playwright/test";
import {
  IDENTITY_SECRET_KEY,
  STORE_KEY,
  SYNTHETIC_AMEX_URL,
  SyntheticAmexHarness,
} from "./harness";

interface PersistedCardRecord {
  localCardId: string;
  identity: {
    productName: string;
    endingDigits: string;
    sourceFingerprint: string;
  };
  freshness: string;
  latest: null | {
    productName: string;
    endingDigits: string;
    completeness: string;
    benefits: Array<{ title: string }>;
  };
}

interface PersistedEnvelope {
  schemaVersion: number;
  cards: Record<string, PersistedCardRecord>;
  lastScan: null | {
    status: string;
    discoveredCardCount: number;
    attemptedCardCount: number;
    visibleContext: string;
  };
}

function persistedEnvelope(harness: SyntheticAmexHarness): PersistedEnvelope {
  const value = harness.storage.get(STORE_KEY);
  expect(value).toBeTruthy();
  return value as PersistedEnvelope;
}

test("runs the built userscript manually, restores normalized data, and clears both local keys", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  const scanButton = page.getByRole("button", { name: "Scan all cards" });
  const scanStatus = page.getByRole("status");
  const visibleCard = page.locator('[data-testid="simple_switcher_combobox"]');

  await expect(scanButton).toBeEnabled();
  await expect(scanStatus).toContainText("Nothing is scanned until you start");
  expect(harness.apiRequests()).toHaveLength(0);
  expect(harness.storage.size).toBe(0);
  await expect(visibleCard).toHaveText(/Synthetic visible card ending 0000/);
  expect(page.url()).toBe(SYNTHETIC_AMEX_URL);

  await scanButton.click();
  await expect(scanStatus).toContainText("Card 1 of 2");
  await expect(scanStatus).toHaveText("Scan complete. 2 cards updated.", { timeout: 10_000 });

  expect(harness.operationRequests("document")).toHaveLength(1);
  const preflightPaths = harness.operationRequests("preflight").map((request) => request.pathname);
  expect(new Set(preflightPaths).size).toBe(preflightPaths.length);
  expect(preflightPaths.every((pathname) => [
    "/ReadBestLoyaltyBenefitsTrackers.v1",
    "/ReadLoyaltyBenefits.v2",
  ].includes(pathname))).toBe(true);
  expect(harness.apiRequests("member")).toHaveLength(1);
  expect(harness.apiRequests("tracker")).toHaveLength(2);
  expect(harness.apiRequests("catalog")).toHaveLength(2);
  await expect(page.getByText("Local only — not sent to Perks Reminder")).toBeVisible();

  const cardPicker = page.getByLabel("Choose a card to review");
  await expect(cardPicker.locator("option")).toHaveText([
    "American Express Gold Card •••• 1234",
    "American Express Gold Card •••• 56789",
  ]);
  await expect(page.getByRole("heading", { name: "Synthetic Monthly Dining Credit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Synthetic Uber Cash" })).toBeVisible();
  await expect(page.getByText("$4.00 of $10.00")).toBeVisible();
  await expect(page.getByText("Synthetic Cell Phone Protection")).toHaveCount(0);
  await expect(page.getByText("Synthetic Global Dining Access by Resy")).toHaveCount(0);

  await cardPicker.selectOption({ label: "American Express Gold Card •••• 56789" });
  await expect(page.getByRole("heading", { name: "Synthetic Dining Credit", exact: true })).toBeVisible();
  await expect(page.locator(".status-pill", { hasText: "Completed" })).toBeVisible();
  await expect(page.getByText("Synthetic Centurion Lounge Access")).toHaveCount(0);
  await expect(page.getByText("Synthetic Saks Fifth Avenue Credit")).toHaveCount(0);

  expect(page.url()).toBe(SYNTHETIC_AMEX_URL);
  await expect(visibleCard).toHaveText(/Synthetic visible card ending 0000/);

  const stored = persistedEnvelope(harness);
  expect(stored.schemaVersion).toBe(1);
  expect(stored.lastScan).toMatchObject({
    status: "complete",
    discoveredCardCount: 2,
    attemptedCardCount: 2,
    visibleContext: "unchanged",
  });
  const records = Object.values(stored.cards);
  expect(records).toHaveLength(2);
  expect(records.map((record) => `${record.identity.productName}:${record.identity.endingDigits}`).sort()).toEqual([
    "American Express Gold Card:1234",
    "American Express Gold Card:56789",
  ]);
  expect(records.every((record) => /^[a-f0-9]{64}$/.test(record.identity.sourceFingerprint))).toBe(true);
  expect(records.flatMap((record) => record.latest?.benefits.map((benefit) => benefit.title) ?? []).sort()).toEqual([
    "Synthetic Dining Credit",
    "Synthetic Monthly Dining Credit",
    "Synthetic Uber Cash",
  ]);
  expect(Array.from(harness.storage.keys()).sort()).toEqual([IDENTITY_SECRET_KEY, STORE_KEY].sort());
  const serializedStore = JSON.stringify(harness.storageSnapshot());
  expect(serializedStore).not.toContain("invented-e2e-primary-token");
  expect(serializedStore).not.toContain("invented-e2e-supplementary-token");
  expect(serializedStore).not.toContain("accountToken");
  expect(serializedStore).not.toContain("sorBenefitId");
  expect(serializedStore).not.toContain("invented-dining-primary");
  expect(serializedStore).not.toContain("Synthetic Cell Phone Protection");
  expect(serializedStore).not.toContain("Synthetic Centurion Lounge Access");

  const apiRequestCountBeforeReload = harness.apiRequests().length;
  const preflightCountBeforeReload = harness.operationRequests("preflight").length;
  await harness.reloadAndInject();
  await expect(page.getByRole("status")).toHaveText("Scan complete. 2 cards updated.");
  await expect(page.getByRole("button", { name: "Scan all cards" })).toBeEnabled();
  await expect(page.getByLabel("Choose a card to review").locator("option")).toHaveCount(2);
  expect(harness.apiRequests()).toHaveLength(apiRequestCountBeforeReload);
  expect(harness.operationRequests("document")).toHaveLength(2);
  expect(harness.operationRequests("preflight")).toHaveLength(preflightCountBeforeReload);
  expect(page.url()).toBe(SYNTHETIC_AMEX_URL);
  await expect(page.locator('[data-testid="simple_switcher_combobox"]')).toHaveText(/Synthetic visible card ending 0000/);

  await page.getByText("Data and privacy", { exact: true }).click();
  harness.acceptNextConfirmation("Clear all local Amex benefit observations and the local identity secret?");
  await page.getByRole("button", { name: "Clear local data" }).click();
  await expect(page.getByRole("status")).toContainText("Local data cleared");
  await expect(page.getByText("No local card observations yet")).toBeVisible();
  expect(harness.storage.size).toBe(0);
  expect(harness.storage.has(STORE_KEY)).toBe(false);
  expect(harness.storage.has(IDENTITY_SECRET_KEY)).toBe(false);
  expect(harness.apiRequests()).toHaveLength(apiRequestCountBeforeReload);

  await harness.proveUnexpectedNetworkIsBlocked();
  harness.assertNetworkStayedSynthetic();
});

test("keeps tracker observations as partial data after a deterministic catalog failure", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "catalog_failure");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  await page.getByRole("button", { name: "Scan all cards" }).click();
  await expect(page.getByRole("status")).toHaveText("Scan finished with data notes. 1 card checked.", { timeout: 10_000 });
  await expect(page.getByText("Partial data", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Synthetic Monthly Dining Credit" })).toBeVisible();
  await expect(page.getByText("$4.00 of $10.00")).toBeVisible();

  expect(harness.operationRequests("document")).toHaveLength(1);
  const preflightPaths = harness.operationRequests("preflight").map((request) => request.pathname);
  expect(new Set(preflightPaths).size).toBe(preflightPaths.length);
  expect(preflightPaths.every((pathname) => [
    "/ReadBestLoyaltyBenefitsTrackers.v1",
    "/ReadLoyaltyBenefits.v2",
  ].includes(pathname))).toBe(true);
  expect(harness.apiRequests("member")).toHaveLength(1);
  expect(harness.apiRequests("tracker")).toHaveLength(1);
  expect(harness.apiRequests("catalog")).toHaveLength(2);
  const stored = persistedEnvelope(harness);
  expect(stored.lastScan).toMatchObject({ status: "partial", attemptedCardCount: 1, visibleContext: "unchanged" });
  const record = Object.values(stored.cards)[0];
  expect(record.freshness).toBe("current");
  expect(record.latest).toMatchObject({ completeness: "partial", benefits: [{ title: "Synthetic Monthly Dining Credit" }] });
  expect(JSON.stringify(harness.storageSnapshot())).not.toContain("invented-e2e-primary-token");
  harness.assertNetworkStayedSynthetic();
});

test("@visual writes a synthetic card-first preview from the built artifact", async ({ context, page }, testInfo) => {
  test.skip(process.env.AMEX_READER_E2E_VISUAL !== "1", "Run through npm run test:e2e:amex:visual.");
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await expect(page.getByRole("status")).toHaveText("Scan complete. 2 cards updated.", { timeout: 10_000 });
  await page.screenshot({ path: testInfo.outputPath("synthetic-amex-reader-preview.png"), fullPage: true });
  harness.assertNetworkStayedSynthetic();
});
