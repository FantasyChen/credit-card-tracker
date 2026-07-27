import { expect, test } from "@playwright/test";
import {
  IDENTITY_SECRET_KEY,
  STORE_KEY,
  SYNTHETIC_AMEX_NON_BENEFITS_URL,
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
  completeness: string;
  observedAt: string | null;
  lastAttemptAt: string;
  error: null | { code: string; message: string };
  latest: null | {
    productName: string;
    endingDigits: string;
    observedAt: string;
    completeness: string;
    benefits: Array<{
      title: string;
      earnedOrUsed: { state: string; value?: { value: string } };
    }>;
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
    cards: Array<{ localCardId: string | null; result: string; issueCode: string | null }>;
  };
}

function persistedEnvelope(harness: SyntheticAmexHarness): PersistedEnvelope {
  const value = harness.storage.get(STORE_KEY);
  expect(value).toBeTruthy();
  return value as PersistedEnvelope;
}

function cardEnding(envelope: PersistedEnvelope, endingDigits: string): PersistedCardRecord {
  const record = Object.values(envelope.cards).find((candidate) => candidate.identity.endingDigits === endingDigits);
  expect(record).toBeTruthy();
  return record!;
}

function expectNoRawSyntheticIdentity(harness: SyntheticAmexHarness): void {
  const serializedStore = JSON.stringify(harness.storageSnapshot());
  expect(serializedStore).not.toContain("invented-e2e-primary-token");
  expect(serializedStore).not.toContain("invented-e2e-supplementary-token");
  expect(serializedStore).not.toContain("invented-e2e-empty-benefits-token");
  expect(serializedStore).not.toContain("invented-e2e-scale-token");
  expect(serializedStore).not.toContain("invented-scale-");
  expect(serializedStore).not.toContain("accountToken");
  expect(serializedStore).not.toContain("sorBenefitId");
}

test("runs the built userscript manually, restores normalized data, and clears both local keys", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  const readerHost = page.locator("#perks-reminder-amex-reader");
  await expect(readerHost).toHaveCount(1);
  await expect(readerHost).toHaveAttribute("data-reader-version", "0.2.13");
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

  await expect(page.getByLabel("Choose a card to review")).toHaveCount(0);
  await expect(page.locator(".card-group")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "American Express Gold Card •••• 1234" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "American Express Gold Card •••• 56789" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remaining 2" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Synthetic $12 Monthly Dining Credit Statement Credit" })).toBeVisible();
  await expect(page.locator(".benefit-card h4", { hasText: "&#36;" })).toHaveCount(0);
  await expect(page.locator(".benefit-card h4", { hasText: "<sup>" })).toHaveCount(0);
  await expect(page.locator(".benefit-card h4", { hasText: "®" })).toHaveCount(0);
  await expect(page.locator(".benefit-card sup")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Synthetic Uber Cash" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Synthetic Dining Credit", exact: true })).toHaveCount(0);
  await expect(page.getByText("$4.00 of $10.00")).toBeVisible();
  await expect(page.getByText("Partially used", { exact: true })).toBeVisible();
  await expect(page.getByText("Enrollment required", { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic Cell Phone Protection")).toHaveCount(0);
  await expect(page.getByText("Synthetic Global Dining Access by Resy")).toHaveCount(0);

  await page.getByRole("button", { name: "Used 1" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic Dining Credit", exact: true })).toBeVisible();
  await expect(page.locator(".status-pill", { hasText: "Used" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Synthetic $12 Monthly Dining Credit Statement Credit" })).toHaveCount(0);
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
    "Synthetic &#36;12 Monthly Dining Credit &#x3C;sup&#x3E;&#174;&#x3C;/sup&#x3E; Statement Credit",
    "Synthetic Dining Credit ‡",
    "Synthetic Uber Cash<sup>‡</sup>",
  ]);
  expect(Array.from(harness.storage.keys()).sort()).toEqual([IDENTITY_SECRET_KEY, STORE_KEY].sort());
  const serializedStore = JSON.stringify(harness.storageSnapshot());
  expect(serializedStore).not.toContain("invented-e2e-primary-token");
  expect(serializedStore).not.toContain("invented-e2e-supplementary-token");
  expect(serializedStore).not.toContain("invented-e2e-empty-benefits-token");
  expect(serializedStore).not.toContain("invented-e2e-scale-token");
  expect(serializedStore).not.toContain("invented-scale-");
  expect(serializedStore).not.toContain("accountToken");
  expect(serializedStore).not.toContain("sorBenefitId");
  expect(serializedStore).not.toContain("invented-dining-primary");
  expect(serializedStore).not.toContain("Synthetic Cell Phone Protection");
  expect(serializedStore).not.toContain("Synthetic Centurion Lounge Access");

  const apiRequestCountBeforeReload = harness.apiRequests().length;
  const preflightCountBeforeReload = harness.operationRequests("preflight").length;
  await harness.reloadAndInject();
  await expect(readerHost).toHaveCount(1);
  await expect(readerHost).toHaveAttribute("data-reader-version", "0.2.13");
  await expect(page.getByRole("status")).toHaveText("Scan complete. 2 cards updated.");
  await expect(page.getByRole("button", { name: "Scan all cards" })).toBeEnabled();
  await expect(page.locator(".card-group")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Remaining 2" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Synthetic $12 Monthly Dining Credit Statement Credit" })).toBeVisible();
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

test("hides globally benefit-empty cards while preserving storage and visible-surface metrics", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "benefit_empty");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  expect(harness.apiRequests()).toHaveLength(0);
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Scan finished with data notes. 3 cards checked.",
    { timeout: 10_000 },
  );

  await expect(page.locator(".card-group")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: /9999/ })).toHaveCount(0);
  await expect(page.getByText("1 reviewed card had no trackable benefits and is hidden.")).toBeVisible();
  await expect(page.getByText("No trackable benefit activity was exposed for this card.")).toHaveCount(0);
  await expect(page.locator(".metric", { hasText: "Cards with benefits" }).locator("strong")).toHaveText("2");
  await expect(page.locator(".metric", { hasText: "Eligible benefits" }).locator("strong")).toHaveText("3");
  await expect(page.locator(".metric", { hasText: "Data notes" }).locator("strong")).toHaveText("0");
  await expect(page.getByRole("button", { name: "Remaining 2" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Used 1" })).toHaveAttribute("aria-pressed", "false");
  const zeroUsageBenefit = page.locator(".benefit-card", {
    has: page.getByRole("heading", { name: "Synthetic Uber Cash" }),
  });
  await expect(zeroUsageBenefit.locator(".status-pill")).toHaveText("Not used");
  await expect(zeroUsageBenefit.locator(".amount")).toHaveText("$0.00 of $15.00");

  expect(harness.apiRequests("member")).toHaveLength(1);
  expect(harness.apiRequests("tracker")).toHaveLength(3);
  expect(harness.apiRequests("catalog")).toHaveLength(4);
  const stored = persistedEnvelope(harness);
  expect(Object.values(stored.cards)).toHaveLength(3);
  expect(cardEnding(stored, "9999")).toMatchObject({
    freshness: "current",
    completeness: "partial",
    latest: { benefits: [] },
  });

  const apiRequestCountBeforeReload = harness.apiRequests().length;
  await harness.reloadAndInject();
  await expect(page.getByRole("status")).toHaveText("Scan finished with data notes. 3 cards checked.");
  await expect(page.locator(".card-group")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: /9999/ })).toHaveCount(0);
  await expect(page.getByText("1 reviewed card had no trackable benefits and is hidden.")).toBeVisible();
  await expect(page.locator(".metric", { hasText: "Cards with benefits" }).locator("strong")).toHaveText("2");
  expect(harness.apiRequests()).toHaveLength(apiRequestCountBeforeReload);

  expectNoRawSyntheticIdentity(harness);
  harness.assertNetworkStayedSynthetic();
});

test("shows one non-identifying account state when every reviewed card is benefit-empty", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "all_benefit_empty");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  expect(harness.apiRequests()).toHaveLength(0);
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await expect(page.getByRole("status")).toHaveText("Scan complete. 1 card updated.", { timeout: 10_000 });

  await expect(page.locator(".card-group")).toHaveCount(0);
  await expect(page.locator(".filters")).toHaveCount(0);
  await expect(page.getByText("No trackable benefits are available in the reviewed card observations.")).toBeVisible();
  await expect(page.getByText("1 reviewed card had no trackable benefits and is hidden.")).toBeVisible();
  await expect(page.getByText(/American Express Gold Card/)).toHaveCount(0);
  await expect(page.getByText(/1234/)).toHaveCount(0);
  await expect(page.locator(".metric", { hasText: "Cards with benefits" }).locator("strong")).toHaveText("0");
  await expect(page.locator(".metric", { hasText: "Eligible benefits" }).locator("strong")).toHaveText("0");
  await expect(page.locator(".metric", { hasText: "Data notes" }).locator("strong")).toHaveText("0");

  expect(harness.apiRequests("member")).toHaveLength(1);
  expect(harness.apiRequests("tracker")).toHaveLength(1);
  expect(harness.apiRequests("catalog")).toHaveLength(1);
  const stored = persistedEnvelope(harness);
  expect(Object.values(stored.cards)).toHaveLength(1);
  expect(cardEnding(stored, "1234")).toMatchObject({
    freshness: "current",
    completeness: "complete",
    latest: { benefits: [] },
  });
  expectNoRawSyntheticIdentity(harness);
  harness.assertNetworkStayedSynthetic();
});

test("exposes structured conflict details only in the active reader shadow tree", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "conflict_diagnostics");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  expect(harness.apiRequests()).toHaveLength(0);
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Scan finished with data notes. 1 card checked.",
    { timeout: 10_000 },
  );

  const dataQuality = page.locator(".data-quality");
  await dataQuality.getByText("Data quality and timestamps", { exact: true }).click();
  await expect(dataQuality.getByText("Benefit matching notes from this scan", { exact: true })).toBeVisible();
  await expect(dataQuality.locator(".conflict-diagnostics li")).toHaveText([
    "Conflicting tracker states",
    "Tracker and benefit details matched different credits",
    "Benefit details could not be joined safely",
    "Tracker and enrollment details conflicted",
  ]);
  await expect(dataQuality.getByText("Two benefits could not be distinguished safely.", { exact: true })).toBeVisible();

  const structuredConflicts = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>("#perks-reminder-amex-reader");
    const card = host?.shadowRoot?.querySelector<HTMLElement>('[data-amex-reader-card-group="true"]');
    return {
      productName: card?.dataset.cardProduct,
      endingDigits: card?.dataset.cardEnding,
      conflicts: Array.from(card?.querySelectorAll<HTMLElement>('[data-amex-conflict="true"]') ?? [], (conflict) => ({
        key: conflict.dataset.conflictKey,
        category: conflict.dataset.conflictCategory,
        candidateCount: conflict.dataset.candidateCount,
        candidatesTruncated: conflict.dataset.candidatesTruncated,
        creditKeys: Array.from(conflict.querySelectorAll<HTMLElement>("[data-amex-reviewed-credit-key]"), (item) => ({
          key: item.dataset.amexReviewedCreditKey,
          family: item.dataset.creditFamily,
        })),
        candidates: Array.from(conflict.querySelectorAll<HTMLElement>('[data-amex-conflict-candidate="true"]'), (candidate) => ({
          index: candidate.dataset.candidateIndex,
          sourceRole: candidate.dataset.sourceRole,
          title: candidate.querySelector<HTMLElement>('[data-amex-conflict-field="display-title"]')?.textContent,
          creditKey: candidate.querySelector<HTMLElement>('[data-amex-conflict-field="supported-credit-key"]')?.dataset.fieldValue,
          creditFamily: candidate.querySelector<HTMLElement>('[data-amex-conflict-field="supported-credit-family"]')?.dataset.fieldValue,
          trackerState: candidate.querySelector<HTMLElement>('[data-amex-conflict-field="tracker-state"]')?.dataset.fieldValue,
          amount: candidate.querySelector<HTMLElement>('[data-amex-conflict-field="earned-or-used"]')?.dataset.quantityValue,
          period: candidate.querySelector<HTMLElement>('[data-amex-conflict-field="period"]')?.dataset.fieldValue,
          catalogLayout: candidate.querySelector<HTMLElement>('[data-amex-conflict-field="catalog-layout"]')?.dataset.fieldValue,
        })),
        relations: Object.fromEntries(Array.from(
          conflict.querySelectorAll<HTMLElement>("[data-amex-conflict-relation]"),
          (relation) => [relation.dataset.amexConflictRelation, relation.dataset.relationValue],
        )),
      })),
    };
  });
  expect(structuredConflicts).toMatchObject({
    productName: "American Express Business Platinum Card",
    endingDigits: "1234",
    conflicts: [
      {
        key: "tracker_state_collision:adobe:01",
        category: "tracker_state_collision",
        candidateCount: "2",
        candidatesTruncated: "false",
        creditKeys: [{ key: "american-express-business-platinum-card:adobe", family: "adobe" }],
        candidates: [
          expect.objectContaining({
            index: "1",
            sourceRole: "tracker",
            title: "Synthetic Adobe Credit",
            creditKey: "american-express-business-platinum-card:adobe",
            creditFamily: "adobe",
            amount: "1",
          }),
          expect.objectContaining({
            index: "2",
            sourceRole: "tracker",
            title: "Synthetic Adobe Credit",
            creditKey: "american-express-business-platinum-card:adobe",
            creditFamily: "adobe",
            amount: "2",
          }),
        ],
        relations: expect.objectContaining({ amount: "different", state: "same" }),
      },
      expect.objectContaining({
        key: "tracker_catalog_key_mismatch:adobe+hilton:01",
        category: "tracker_catalog_key_mismatch",
        creditKeys: [
          { key: "american-express-business-platinum-card:adobe", family: "adobe" },
          { key: "american-express-business-platinum-card:hilton", family: "hilton" },
        ],
        candidates: [
          expect.objectContaining({ sourceRole: "tracker", title: "Synthetic Adobe Credit" }),
          expect.objectContaining({ sourceRole: "joined_catalog", title: "Synthetic Hilton Credit", catalogLayout: "ENROLLED" }),
        ],
      }),
      expect.objectContaining({
        key: "ambiguous_catalog_join:wireless:01",
        category: "ambiguous_catalog_join",
        candidates: expect.arrayContaining([
          expect.objectContaining({ sourceRole: "tracker", title: "Synthetic Wireless Bill Credit" }),
          expect.objectContaining({ sourceRole: "joined_catalog", title: "Synthetic Wireless Statement Credit", catalogLayout: "NOTENROLLED" }),
        ]),
      }),
      expect.objectContaining({
        key: "tracker_catalog_candidate_collision:indeed:01",
        category: "tracker_catalog_candidate_collision",
        candidates: [
          expect.objectContaining({ sourceRole: "tracker", title: "Synthetic Indeed Credit" }),
          expect.objectContaining({ sourceRole: "catalog_enrollment_candidate", title: "Synthetic Indeed Statement Credit", catalogLayout: "NOTENROLLED" }),
        ],
      }),
    ],
  });

  const serializedStore = JSON.stringify(harness.storageSnapshot());
  expect(serializedStore).toContain("benefit_identity_conflict");
  expect(serializedStore).not.toMatch(
    /tracker_state_collision|tracker_catalog_key_mismatch|ambiguous_catalog_join|tracker_catalog_candidate_collision|conflictDiagnostics|conflictDetails|candidateIndex|sourceRole|sameJoinId/,
  );
  expectNoRawSyntheticIdentity(harness);

  const requestCountBeforeReload = harness.apiRequests().length;
  await harness.reloadAndInject();
  await expect(page.getByRole("status")).toHaveText("Scan finished with data notes. 1 card checked.");
  const restoredDataQuality = page.locator(".data-quality");
  await restoredDataQuality.getByText("Data quality and timestamps", { exact: true }).click();
  await expect(restoredDataQuality.getByText("Two benefits could not be distinguished safely.", { exact: true })).toBeVisible();
  await expect(page.getByText("Benefit matching notes from this scan", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Conflicting tracker states", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-amex-conflict="true"]')).toHaveCount(0);
  expect(harness.apiRequests()).toHaveLength(requestCountBeforeReload);
  harness.assertNetworkStayedSynthetic();
});

test("renders a bounded 16-card, 130-benefit grouped master list from the built userscript", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "high_scale");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  expect(harness.apiRequests()).toHaveLength(0);
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await expect(page.getByRole("status")).toHaveText("Scan complete. 16 cards updated.", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Remaining 130" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Used 0" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".card-group")).toHaveCount(16);
  await expect(page.locator(".benefit-card")).toHaveCount(130);
  await expect(page.getByRole("heading", { name: "Synthetic Lululemon Credit" })).toHaveCount(16);
  await expect(page.getByRole("heading", { name: "Synthetic Resy Credit" })).toHaveCount(16);
  await expect(page.getByRole("heading", { name: "American Express Platinum Card •••• 3001" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "American Express Platinum Card •••• 3016" })).toBeAttached();
  await expect(page.locator(".panel")).toHaveCSS("overflow-y", "auto");
  expect(harness.apiRequests("member")).toHaveLength(1);
  expect(harness.apiRequests("tracker")).toHaveLength(16);
  expect(harness.apiRequests("catalog")).toHaveLength(16);

  const requestCount = harness.apiRequests().length;
  await page.getByRole("button", { name: "Used 0" }).click();
  await expect(page.locator(".card-group")).toHaveCount(16);
  await expect(page.locator(".card-group-compact")).toHaveCount(16);
  await expect(page.locator(".card-group-compact .card-summary", { hasText: "0 used benefits" })).toHaveCount(16);
  await expect(page.locator(".benefit-card")).toHaveCount(0);
  await expect(page.locator(".empty-state")).toHaveCount(0);
  await expect(page.getByText("No used benefits for this card.")).toHaveCount(0);
  expect(harness.apiRequests()).toHaveLength(requestCount);
  expectNoRawSyntheticIdentity(harness);
  harness.assertNetworkStayedSynthetic();
});

test("mounts once and scans manually from a selector-free non-benefits route", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "complete");
  await harness.installBeforeNavigation();
  await harness.openAndInjectConcurrentCopies(SYNTHETIC_AMEX_NON_BENEFITS_URL);

  const readerHost = page.locator("#perks-reminder-amex-reader");
  await expect(readerHost).toHaveCount(1);
  await expect(readerHost).toHaveAttribute("data-reader-version", "0.2.13");
  await expect(page.locator('[data-testid="simple_switcher_combobox"]')).toHaveCount(0);
  const launcher = page.getByRole("button", { name: "Open Perks Reminder Amex benefit reader" });
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Scan all cards" })).toHaveCount(0);
  expect(harness.apiRequests()).toHaveLength(0);
  expect(harness.storage.size).toBe(0);
  expect(page.url()).toBe(SYNTHETIC_AMEX_NON_BENEFITS_URL);

  await launcher.click();
  await expect(page.getByRole("button", { name: "Collapse Perks Reminder Amex benefit reader" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const scanButton = page.getByRole("button", { name: "Scan all cards" });
  await expect(scanButton).toBeEnabled();
  await expect(page.getByRole("status")).toContainText("Nothing is scanned until you start");
  expect(harness.apiRequests()).toHaveLength(0);
  expect(harness.storage.size).toBe(0);

  await scanButton.click();
  await expect(page.getByRole("button", { name: "Collapse Perks Reminder Amex benefit reader" })).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Scan complete. 2 cards updated.", { timeout: 10_000 });
  expect(page.url()).toBe(SYNTHETIC_AMEX_NON_BENEFITS_URL);
  expect(harness.apiRequests("member")).toHaveLength(1);
  expect(harness.apiRequests("tracker")).toHaveLength(2);
  expect(harness.apiRequests("catalog")).toHaveLength(2);

  const stored = persistedEnvelope(harness);
  expect(stored.lastScan).toMatchObject({
    status: "complete",
    discoveredCardCount: 2,
    attemptedCardCount: 2,
    visibleContext: "unchanged",
  });
  expect(Object.values(stored.cards)).toHaveLength(2);
  expectNoRawSyntheticIdentity(harness);

  await harness.proveUnexpectedNetworkIsBlocked();
  harness.assertNetworkStayedSynthetic();
});

test("keeps tracker observations as partial data after a deterministic catalog failure", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "catalog_failure");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  await page.getByRole("button", { name: "Scan all cards" }).click();
  await expect(page.getByRole("status")).toHaveText("Scan finished with data notes. 1 card checked.", { timeout: 10_000 });
  const partialQuality = page.locator('.quality-pill[aria-label="Data quality: Partial data"]');
  await expect(partialQuality).toHaveCount(1);
  await expect(partialQuality).toBeVisible();
  await expect(page.locator(".row-quality")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Synthetic $12 Monthly Dining Credit Statement Credit" })).toBeVisible();
  await expect(page.locator(".benefit-card")).not.toContainText("Partial data");
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
  expect(record.latest).toMatchObject({
    completeness: "partial",
    benefits: [{ title: "Synthetic &#36;12 Monthly Dining Credit &#x3C;sup&#x3E;&#174;&#x3C;/sup&#x3E; Statement Credit" }],
  });
  expect(JSON.stringify(harness.storageSnapshot())).not.toContain("invented-e2e-primary-token");
  harness.assertNetworkStayedSynthetic();
});

test("cancels the built userscript with a later physical-card read in flight", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "cancellation");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  const scanButton = page.getByRole("button", { name: "Scan all cards" });
  const scanStatus = page.getByRole("status");
  const visibleCard = page.locator('[data-testid="simple_switcher_combobox"]');
  expect(harness.apiRequests()).toHaveLength(0);
  expect(harness.storage.size).toBe(0);

  await scanButton.click();
  await harness.waitForCancellationRequest();
  await expect(scanStatus).toContainText("Card 2 of 2: reading benefit progress");

  const checkpoint = persistedEnvelope(harness);
  expect(Object.values(checkpoint.cards)).toHaveLength(1);
  expect(cardEnding(checkpoint, "1234")).toMatchObject({
    freshness: "current",
    completeness: "complete",
    latest: { productName: "American Express Gold Card", endingDigits: "1234" },
  });
  expect(cardEnding(checkpoint, "1234").latest?.benefits[0]?.earnedOrUsed.value?.value).toBe("4.00");
  expect(checkpoint.lastScan).toMatchObject({
    status: "interrupted",
    discoveredCardCount: 2,
    attemptedCardCount: 1,
    visibleContext: "unavailable",
    cards: [{ result: "complete", issueCode: null }],
  });

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await harness.releaseCancellationRequest();
  await expect(scanStatus).toHaveText(
    "Scan interrupted after 2 cards were checked. Nothing resumes automatically.",
    { timeout: 10_000 },
  );
  await expect(scanButton).toBeEnabled();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);

  expect(harness.apiRequestSequence()).toEqual([
    "member:scan-1",
    "tracker:primary:scan-1",
    "catalog:primary:scan-1",
    "tracker:supplementary:scan-1",
  ]);
  expect(harness.apiRequests("member")).toHaveLength(1);
  expect(harness.apiRequests("tracker")).toHaveLength(2);
  expect(harness.apiRequests("catalog")).toHaveLength(1);

  const stored = persistedEnvelope(harness);
  expect(stored.lastScan).toMatchObject({
    status: "interrupted",
    discoveredCardCount: 2,
    attemptedCardCount: 2,
    visibleContext: "unchanged",
  });
  expect(stored.lastScan?.cards).toHaveLength(1);
  expect(stored.lastScan?.cards[0]).toMatchObject({ result: "complete", issueCode: null });
  expect(Object.values(stored.cards)).toHaveLength(1);
  expect(cardEnding(stored, "1234").freshness).toBe("current");
  expect(Object.values(stored.cards).some((record) => record.identity.endingDigits === "56789")).toBe(false);
  expectNoRawSyntheticIdentity(harness);
  expect(page.url()).toBe(SYNTHETIC_AMEX_URL);
  await expect(visibleCard).toHaveText(/Synthetic visible card ending 0000/);
  harness.assertNetworkStayedSynthetic();
});

test("preserves stale data when one physical card fails on a later manual rescan", async ({ context, page }) => {
  const harness = new SyntheticAmexHarness(context, page, "rescan_tracker_failure");
  await harness.installBeforeNavigation();
  await harness.openAndInject();

  const scanButton = page.getByRole("button", { name: "Scan all cards" });
  const scanStatus = page.getByRole("status");
  const visibleCard = page.locator('[data-testid="simple_switcher_combobox"]');
  expect(harness.apiRequests()).toHaveLength(0);

  await scanButton.click();
  await expect(scanStatus).toHaveText("Scan complete. 2 cards updated.", { timeout: 10_000 });
  const firstScan = persistedEnvelope(harness);
  const firstPrimary = structuredClone(cardEnding(firstScan, "1234"));
  const firstSupplementary = structuredClone(cardEnding(firstScan, "56789"));
  expect(firstPrimary.latest?.benefits[0]?.earnedOrUsed.value?.value).toBe("4.00");
  expect(firstSupplementary.freshness).toBe("current");
  const firstScanRequestCount = harness.apiRequests().length;
  expect(firstScanRequestCount).toBe(5);
  await expect(scanButton).toBeEnabled();
  expect(harness.apiRequests()).toHaveLength(firstScanRequestCount);

  await scanButton.click();
  await expect(scanStatus).toHaveText("Scan finished with data notes. 2 cards checked.", { timeout: 10_000 });
  expect(harness.apiRequestSequence()).toEqual([
    "member:scan-1",
    "tracker:primary:scan-1",
    "catalog:primary:scan-1",
    "tracker:supplementary:scan-1",
    "catalog:supplementary:scan-1",
    "member:scan-2",
    "tracker:primary:scan-2",
    "catalog:primary:scan-2",
    "tracker:supplementary:scan-2",
    "tracker:supplementary:scan-2",
  ]);
  expect(harness.apiRequests("member")).toHaveLength(2);
  expect(harness.apiRequests("tracker")).toHaveLength(5);
  expect(harness.apiRequests("catalog")).toHaveLength(3);

  const rescanned = persistedEnvelope(harness);
  const currentPrimary = cardEnding(rescanned, "1234");
  const staleSupplementary = cardEnding(rescanned, "56789");
  expect(rescanned.lastScan).toMatchObject({
    status: "partial",
    discoveredCardCount: 2,
    attemptedCardCount: 2,
    visibleContext: "unchanged",
  });
  expect(rescanned.lastScan?.cards.map(({ result, issueCode }) => ({ result, issueCode }))).toEqual([
    { result: "complete", issueCode: null },
    { result: "failed", issueCode: "http_error" },
  ]);
  expect(currentPrimary).toMatchObject({ freshness: "current", completeness: "complete", error: null });
  expect(currentPrimary.observedAt).not.toBe(firstPrimary.observedAt);
  expect(currentPrimary.lastAttemptAt).not.toBe(firstPrimary.lastAttemptAt);
  expect(Date.parse(currentPrimary.observedAt!)).toBeGreaterThan(Date.parse(firstPrimary.observedAt!));
  expect(currentPrimary.latest?.observedAt).toBe(currentPrimary.observedAt);
  expect(currentPrimary.latest?.benefits[0]?.earnedOrUsed.value?.value).toBe("7.00");
  await expect(page.getByText("$7.00 of $10.00")).toBeVisible();
  await page.getByText("Scan notes (1)", { exact: true }).click();
  await expect(page.getByText(
    "Some cards have partial, stale, failed, or differently timed observations. Review each card's data-quality label.",
  )).toBeVisible();

  expect(staleSupplementary).toMatchObject({
    freshness: "stale_error",
    completeness: "failed",
    observedAt: firstSupplementary.observedAt,
    error: { code: "http_error", message: "A first-party Amex read request returned an unexpected response." },
  });
  expect(staleSupplementary.localCardId).toBe(firstSupplementary.localCardId);
  expect(staleSupplementary.identity).toEqual(firstSupplementary.identity);
  expect(staleSupplementary.latest).toEqual(firstSupplementary.latest);
  expect(staleSupplementary.lastAttemptAt).not.toBe(firstSupplementary.lastAttemptAt);
  expect(Date.parse(staleSupplementary.lastAttemptAt)).toBeGreaterThan(Date.parse(firstSupplementary.lastAttemptAt));

  const staleQuality = page.locator('.quality-pill[aria-label="Data quality: Stale data"]');
  await expect(staleQuality).toHaveCount(1);
  await expect(staleQuality).toBeVisible();
  await expect(page.getByRole("heading", { name: "Synthetic Dining Credit", exact: true })).toHaveCount(0);
  const compactStaleGroup = page.locator(".card-group-compact", { hasText: "Stale data" });
  await expect(compactStaleGroup).toHaveCount(1);
  await expect(compactStaleGroup.locator(".card-summary")).toHaveText("0 remaining benefits");
  await compactStaleGroup.getByText("Data quality and timestamps", { exact: true }).click();
  await expect(compactStaleGroup.getByText(
    "A first-party Amex read request returned an unexpected response.",
    { exact: true },
  )).toBeVisible();
  await page.getByRole("button", { name: "Used 1" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic Dining Credit", exact: true })).toBeVisible();
  await expect(page.locator(".row-quality")).toHaveCount(0);
  await expect(page.locator(".benefit-card")).not.toContainText("Stale data");
  expectNoRawSyntheticIdentity(harness);
  expect(page.url()).toBe(SYNTHETIC_AMEX_URL);
  await expect(visibleCard).toHaveText(/Synthetic visible card ending 0000/);
  harness.assertNetworkStayedSynthetic();
});

test("@visual writes a synthetic grouped-list preview from the built artifact", async ({ context, page }, testInfo) => {
  test.skip(process.env.AMEX_READER_E2E_VISUAL !== "1", "Run through npm run test:e2e:amex:visual.");
  const harness = new SyntheticAmexHarness(context, page, "benefit_empty");
  await harness.installBeforeNavigation();
  await harness.openAndInject();
  await page.getByRole("button", { name: "Scan all cards" }).click();
  await expect(page.getByRole("status")).toHaveText("Scan finished with data notes. 3 cards checked.", { timeout: 10_000 });
  await expect(page.getByText("1 reviewed card had no trackable benefits and is hidden.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("synthetic-amex-reader-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remaining 2" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("synthetic-amex-reader-narrow.png"), fullPage: true });
  harness.assertNetworkStayedSynthetic();
});
