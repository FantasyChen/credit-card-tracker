# Browser-Side Authenticated Read Integrations

## Scenario: manual read-only account import

### 1. Scope / Trigger

Use this contract when browser code reads data from a provider using the user's existing signed-in browser session and converts it into local Perks Reminder observations. The current reference implementation is `src/lib/amex-benefit-reader/` plus `src/userscripts/amex-benefit-reader.user.ts`.

This boundary is different from website authentication and server-side import. Browser session credentials may be attached by the browser, but the integration must never inspect, copy, log, export, or persist passwords, MFA values, cookies, authorization headers, opaque provider tokens, or raw provider responses. Provider-specific endpoint inventories and live validation evidence belong in the owning task research rather than this project-wide spec.

### 2. Signatures

Keep provider transport, normalization, visible-context checks, and persistence behind narrow ports. The current source contract is:

```ts
interface AmexReadClient {
  discoverAccounts(signal: AbortSignal): Promise<MemberResponse>;
  readBenefitTrackers(
    rawAccountToken: string,
    signal: AbortSignal,
  ): Promise<TrackerResponse>;
  readBenefitCatalog(
    rawAccountToken: string,
    signal: AbortSignal,
  ): Promise<CatalogResponse>;
}

interface VisibleContextGuard {
  capture(): VisiblePageContext;
  verifyUnchanged(context: VisiblePageContext): boolean;
}

interface ResultStore {
  load(): Promise<StoreEnvelopeV1>;
  commitCard(result: CardAttemptResult): Promise<StoredCardRecordV1>;
  recordScanSummary(summary: ScanSummaryV1): Promise<void>;
  clear(): Promise<void>;
}
```

The persisted observation boundary is versioned and normalized:

```ts
interface NormalizedCardObservationV1 {
  contractVersion: "amex-benefits/1";
  issuer: "american_express_us";
  localCardId: string;
  productName: string;
  endingDigits: string;
  observedAt: string;
  parserVersion: string;
  completeness: "complete" | "partial";
  issueCodes: IssueCode[];
  benefits: NormalizedBenefitObservationV1[];
}
```

Provider-benefit selection is a separate shared-catalog boundary, not a presentation filter:

```ts
interface SupportedAmexCardCreditMatch {
  catalogCardName: string;
  creditKey: string;
}

function matchSupportedAmexCardCredit(
  productName: string,
  benefitTitle: string,
): SupportedAmexCardCreditMatch | null;

function retainSupportedAmexCardCredits<T extends { title: string }>(
  productName: string,
  benefits: T[],
): T[];
```

Do not expose a generic `request(url, init)` port to scan orchestration. Add a named method and an exact operation contract for every newly approved read.

### 3. Contracts

1. **Mount, presentation, and manual start are separate**: an integration may mount throughout one reviewed exact HTTPS origin while using a smaller set of primary paths only to choose its initial presentation. Off-primary routes must begin as a compact accessible launcher when the full reader could obscure provider controls. Mounting, restoring state, expanding, collapsing, or changing routes must not discover accounts or perform provider reads; those begin only after an explicit scan action. Page load must not scan, poll, keep the session alive, or schedule background work.
2. **Exact operation allowlist**: each operation fixes origin, path, method, headers, body builder, credentials mode, redirect behavior, timeout, response schema, and retry policy. Deny every tuple not represented by a named operation.
3. **Browser-session attachment only**: `credentials: "include"` may let the browser attach its existing provider session. Code must not read cookie content, password-manager state, MFA values, or authorization material.
4. **Bounded raw lifetime**: raw responses and opaque account tokens may exist only in active-scan memory. Remove each token from scan-wide collections before its card attempt; clear per-card responses and tokens in `finally`; clear remaining transient values on completion, cancellation, timeout, error, or unload.
5. **Strict projection**: parse external JSON through bounded schemas that retain only approved scalar fields and nested projections. Do not use permissive raw-object fields. Accept JSON media type only when it is exactly `application/json`, optionally followed by parameters; `application/jsonp` is not JSON.
6. **Normalized persistence only**: persist versioned observations, redacted issue codes, a random local card ID, and an installation-secret HMAC fingerprint. Never persist raw responses, provider tokens, request headers, full account numbers, or diagnostics derived from them.
7. **Conservative identity**: duplicate product names are not identities. Reconcile cards with the HMAC fingerprint and explicit four- or five-digit display endings; reject conflicts and full-number fields rather than truncating them.
8. **No inferred provider facts**: preserve decimal quantities as strings. Do not default missing values to zero, infer currency or cadence, derive a remaining amount, parse amounts from titles, derive display digits from opaque tokens, or sum quantities across cards.
9. **Partial observations are explicit**: retain safe normalized tracker data when an optional enrichment read fails with an eligible redacted issue code. Mark the observation partial; do not fabricate enrichment fields. Cancellation and required-read failures are not partial success.
10. **Per-card commit and stale preservation**: commit each successful or partial card independently. A failed card preserves its prior observation as stale when one exists; it must not erase good data from an earlier scan.
11. **No mutation or transport expansion**: browser readers must not enroll, activate, link, redeem, add offers, pay, or change provider state. They must not send observations to Perks Reminder, analytics, or third parties unless a separate task defines and approves that contract.
12. **Visible-context invariant**: capture the reviewed exact origin and current pathname before scanning, plus a one-way selected-display fingerprint only when a recognized selected-card control is present. Final verification always requires the same origin/pathname. A captured fingerprint must remain present and equal; an absent selector is valid and makes route invariance sufficient, even if a selector appears later. Report changed or unavailable context without persisting the visible display string.
13. **Separate evidence quality from benefit state**: user-facing presentation must not reuse parser completeness/freshness as a benefit status. Labels such as `Partial data`, `Stale data`, and `Could not read` describe the observation; labels such as `Enrollment required`, `In progress`, and `Completed` describe the benefit. Keep issue codes, field availability, confidence, and timestamps secondary to that distinction.
14. **Scale by physical card identity and bounded presentation**: when an account can contain many observations or repeated product names, make the physical card the primary navigation level and include explicit ending digits in the card label. Render one selected card workspace at a time or use an equivalently bounded hierarchy; do not default to one continuous all-card technical list. A site-wide reader may keep collapse state only in panel memory, but scanning and cancelling must force the full progress/cancellation workspace to remain reachable.
15. **Shared-catalog, card-specific selection**: normalized/persisted benefits must be usable, trackable credits represented by a positive-amount benefit on the matched Perks Reminder card. Product and benefit aliases belong to one browser-safe matcher backed by the shared static catalog; do not maintain a disconnected userscript allowlist or admit a credit represented only on a different card.
16. **Fail-closed filtering before interpretation**: unknown product names, unreviewed benefit wording, ambiguous matches, and access/protection/insurance/free-night/status/informational/non-credit titles are omitted before provider status, quantity, category, or layout fields are interpreted. Intentional omission is not a parser issue and must not make an otherwise complete card partial.
17. **Compatible-store projection**: when a parser update narrows the supported-credit set without changing the observation/storage schema, project compatible stored observations through the same matcher before display and future persistence. Preserve observation quality, freshness, timestamps, scan summaries, and redacted errors; increment storage revision and rewrite only when rows are actually removed. Malformed or future-schema stores remain refused, not repaired.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Reader mounts, restores, expands, collapses, or observes an in-document route change before manual scan | Restore normalized local state only; make no reader discovery/tracker requests |
| Redirect or HTML/login response | Reject; do not follow as a successful read or parse it as JSON |
| `401`/`403` or equivalent signed-out classification | Hard card/discovery failure; no retry; never downgrade to partial enrichment |
| Network failure or `5xx` | At most one retry for that operation |
| Other `4xx`, timeout, cancellation, redirect, content-type error, or schema error | No retry |
| Content type is `application/json` or `application/json; ...` | Parse with the operation's bounded schema |
| Content type is `application/jsonp`, HTML, missing, or unrelated | Reject as `content_type_invalid` |
| Required discovery/tracker read fails | Fail that attempt; preserve prior observation as stale when available |
| Tracker read succeeds and optional catalog/enrichment fails with an approved partial issue code | Normalize tracker data with enrichment absent; commit a partial observation with the exact redacted issue code |
| Cancellation occurs at any phase | Abort and record interruption; do not convert cancellation into partial success |
| Relationship, product, token, or display-ending candidates conflict | Do not guess; classify the entry as unknown or identity-conflicted |
| Quantity value, unit, currency, status, or activity vocabulary is uncharacterized | Preserve only safe fields, add an issue code, and mark partial; do not infer |
| Local envelope fails schema/migration validation | Refuse to scan into malformed state and offer explicit local-data recovery |
| Exact origin/pathname changes, or a selected display captured at scan start changes/disappears | Finish safe commits, but mark the summary changed or unavailable |
| No recognized selected-card control exists at capture | Capture a null fingerprint and verify exact origin/pathname only; do not block manual scan or infer a display identity |
| Observation is partial/stale while a benefit is complete or in progress | Show both facts independently; never relabel the benefit as incomplete because the observation has data-quality notes |
| Duplicate products or a high-observation account are restored | Keep every physical card reachable by product plus ending digits without rendering every card's full technical detail at once |
| Product name has no exact normalized catalog alias | Omit all benefits for that card; do not guess a nearby product or borrow another card's credit rules |
| Benefit title has no unique reviewed alias for a positive-amount credit on the matched card | Omit the record before interpreting its provider fields; do not add a parser issue or partial marker solely for the omission |
| Title contains a credit brand plus an explicit non-credit phrase such as access, protection, insurance, free night, or status | Reject the record even when a broader merchant alias also appears |
| Compatible stored observation contains benefits no longer supported by the current matcher | Remove only those rows, preserve record/scan quality metadata, and rewrite with one revision increment only when the projection changes the store |
| Stored envelope is malformed or from a future schema | Refuse it unchanged; do not apply the supported-credit projection or overwrite storage |

### 5. Good / Base / Bad Cases

- **Good**: a manual scan uses named read methods, projects provider JSON into strict schemas, clears each transient token in `finally`, commits every card independently, keeps repeated products distinct through an HMAC fingerprint, and restores only normalized observations after reload.
- **Base**: an optional catalog read fails after valid tracker data. The reader records the redacted catalog issue, leaves enrollment fields unexposed, and commits the tracker observation as partial.
- **Bad**: a generic fetch helper accepts arbitrary paths, stores raw JSON for debugging, derives an ending from a full account number or token, defaults a missing amount to zero, or turns a catalog authentication failure into partial success.
- **Presentation good**: a partial card can still show an observed benefit as `Completed`, while a separate `Partial data` badge and secondary details explain the observation quality.
- **Presentation bad**: a card-level `Incomplete` badge is used as the primary benefit status, duplicate products are grouped only by name, or all cards and normalized fields are rendered at equal priority.
- **Selection good**: an exact reviewed product alias and benefit-title alias resolve to one positive-amount credit on that same shared-catalog card; the stable card-scoped credit key owns deduplication.
- **Selection base**: a provider returns an access-only Resy item, a free-night award, or an otherwise unrepresented tracker. The reader silently omits it before parsing its status fields, while supported credits on the card remain complete.
- **Selection bad**: a global merchant substring list admits a credit on every card, a broad `Resy`/`Saks` match admits access or protection, or panel-only filtering leaves unsupported rows in local storage.
- **Compatible-store good**: loading a schema-compatible pre-filter store removes unsupported rows once while preserving freshness, completeness, observation/attempt times, errors, and last-scan summary.

### 6. Tests Required

For each browser-side provider reader, assert:

- every named operation emits the exact origin/path/method/headers/body/credentials/redirect tuple;
- an unapproved destination, method, body, redirect, or mutation path is unreachable by construction;
- retry occurs once only for network failures and `5xx`, and never for the other matrix rows;
- `application/json` with optional parameters is accepted while `application/jsonp`, HTML, and missing content type are rejected;
- bounded schemas strip unrelated fields and reject object-valued scalar candidates;
- four- and five-digit explicit endings are accepted, while conflicts and full numbers are rejected without truncation;
- duplicate product names remain distinct and duplicate tokens do not create duplicate cards;
- missing or unknown quantities, statuses, categories, and layouts remain explicit and never become inferred values;
- optional enrichment failure after tracker success produces a partial observation, while authentication, cancellation, and tracker failure remain hard/interrupted paths;
- raw responses and tokens never enter panel state, normalized output, diagnostics, storage, or exported errors and are cleared on every terminal path;
- per-card success replaces the latest observation, failure preserves stale prior data, and summary counts match attempted dispositions;
- exact-origin page load restores local normalized state without scanning, primary paths start expanded, and non-primary paths expose an accessible collapsed launcher whose expansion/collapse does not scan or persist UI state; clear-data removes both normalized state and the installation identity secret;
- visible context is reported as unchanged, changed, or unavailable without persisting its source display value; selector-present capture requires stable display equality, while selector-free capture permits unchanged route-only verification;
- observation-quality labels remain distinct from benefit action/progress labels, filter state is accessible, and duplicate products remain selectable by ending digits;
- a synthetic high-scale fixture (currently 16 cards / 130 observations for Amex) keeps every observation reachable while rendering only the selected card's workspace;
- every positive-amount benefit intended for provider synchronization in the shared card catalog has an exact-card matching fixture, while zero-value/access/protection/insurance/free-night/status/informational records, wrong-card titles, unknown products, and ambiguous wording fail closed;
- unsupported provider records with malformed or unknown status/category fields are omitted before parsing and do not create partial observations or issue codes;
- equivalent reviewed wording deduplicates through the same card-scoped credit key, while materially different credit observations do not merge;
- compatible legacy-store projection preserves schema, quality/freshness metadata, timestamps, errors, and scan summary; rewrites/increments revision only when rows are removed; and refuses malformed/future stores without overwrite;
- shared-catalog extraction has a website parity assertion so browser-safe reuse cannot silently remove or alter static catalog cards/benefits;
- the built userscript contains only approved grants and destinations and contains no mutation fragments, privileged transport, background polling, remote update metadata, or website-sync destination.

Run targeted Jest for the reader and userscript surfaces, strict TypeScript, targeted ESLint, the isolated userscript build, artifact/source allowlist audits, a sensitive-data scan, structured-data parsing, and `git diff --check`. Authenticated browser validation requires explicit owner authorization and must capture only sanitized aggregates and URL/method/status metadata—never payloads.

### 7. Wrong vs Correct

#### Wrong

```ts
async function providerRequest(url: string, token: string) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ accountToken: token }),
  });
  const raw = await response.json();
  localStorage.setItem("provider-debug", JSON.stringify(raw));
  return raw;
}
```

This creates an unrestricted destination, retains a provider token in a generic request path, accepts unvalidated JSON, and persists a raw private response.

#### Correct

```ts
async function readBenefitCatalog(
  rawAccountToken: string,
  signal: AbortSignal,
): Promise<CatalogResponse> {
  const response = await fetch(CATALOG_READ_URL, {
    method: CATALOG_READ_ENDPOINT.method,
    credentials: "include",
    redirect: "manual",
    headers: CATALOG_READ_ENDPOINT.headers,
    body: JSON.stringify(buildCatalogRequest(rawAccountToken)),
    signal,
  });

  assertApprovedStatusRedirectAndJson(response);
  return catalogResponseSchema.parse(await response.json());
}

let catalog: CatalogResponse | null = null;
try {
  catalog = await client.readBenefitCatalog(rawAccountToken, signal);
  return normalizeBenefits(trackers, catalog);
} finally {
  catalog = null;
  rawAccountToken = "";
}
```

The named operation fixes the request tuple, validates the projected response, and makes transient cleanup part of the control flow. The scan engine—not the transport—owns whether an eligible optional-read failure becomes a redacted partial observation.

#### Presentation boundary

```ts
// Wrong: parser quality overwrites the user-facing benefit state.
const label = card.completeness === "partial" ? "Incomplete" : benefit.trackerState;

// Correct: derive and display two independent presentation facts.
const observationLabel = presentObservationQuality(card); // "Partial data"
const benefitLabel = presentBenefitState(benefit); // "Completed"
```

This separation prevents data-collection uncertainty from being mistaken for a benefit that still needs user action.

#### Supported-credit boundary

```ts
// Wrong: a global substring filter admits the merchant on unsupported cards
// and leaves rejected rows persisted for the panel to hide.
const visibleBenefits = observation.benefits.filter((benefit) =>
  ["resy", "saks", "uber"].some((merchant) =>
    benefit.title.toLowerCase().includes(merchant),
  ),
);

// Correct: normalize through the shared-catalog, card-specific matcher before
// provider fields enter the normalized observation or compatible local store.
const match = matchSupportedAmexCardCredit(productName, providerBenefit.title);
if (!match) return null;
return normalizeSupportedBenefit(providerBenefit, match.creditKey);
```

The matcher must verify both sides of the contract: the card is a reviewed product alias, and the title resolves uniquely to a positive-amount usable credit represented on that exact shared-catalog card. Broad merchant wording never overrides explicit non-credit phrases.

## Scenario: generated-bundle synthetic browser validation

### 1. Scope / Trigger

Use this contract when routine browser-reader iteration needs real-Chromium evidence without installing the userscript, opening an authenticated profile, or contacting the provider. This supplements unit tests and milestone owner-only validation; it does not claim live provider, cookie/CORS, or Tampermonkey-sandbox compatibility.

### 2. Signatures

The Amex reference commands and harness boundary are:

```bash
npx playwright install chromium      # one-time browser prerequisite
npm run test:e2e:amex                # unattended generated-bundle checks
npm run test:e2e:amex:visual         # optional headed synthetic preview
```

```ts
type HarnessScenario =
  | "complete"
  | "catalog_failure"
  | "cancellation"
  | "rescan_tracker_failure";

class SyntheticAmexHarness {
  readonly storage: Map<string, unknown>;
  installBeforeNavigation(): Promise<void>;
  openAndInject(): Promise<void>;
  reloadAndInject(): Promise<void>;
  proveUnexpectedNetworkIsBlocked(): Promise<void>;
  assertNetworkStayedSynthetic(): void;
}
```

The task-scoped Playwright config must point only at the provider-reader E2E directory, use one worker with retries disabled, block service workers, and retain traces/screenshots only for failed or explicit visual runs.

### 3. Contracts

1. **Build and inject the artifact**: the command rebuilds the userscript, verifies the artifact exists, and injects that opaque IIFE. E2E code must not import the production entry, engine, adapter, matcher, or panel to bypass bundle wiring.
2. **Intercept before navigation**: install a browser-context catch-all route before the first navigation. Fulfill only the invented provider document, exact named read tuples, and exact browser-generated preflights required by those tuples.
3. **No network fallback**: every unrecognized origin, path, method, header set, or body is aborted and recorded as a routing error. The route must never call `continue`, `fallback`, or another path that can reach live Amex or a third party. Include a denied-origin probe proving this behavior.
4. **Synthetic extension storage**: install asynchronous `GM.getValue`, `GM.setValue`, and `GM.deleteValue` mocks before bundle evaluation. Keep the map owned by the harness so tests can inspect normalized persistence, while production receives no debug/export interface.
5. **Exact request and mount evidence**: assert operation origin, path, method, accepted content type, fixed request body, retry count, and zero provider reads before manual start or after restore-only reload. For an exact-origin reader with primary-route presentation, include a harness-owned non-primary document with no selected-card selector and prove collapsed mount, expansion without reads, manual scan, and route-only invariance through the generated bundle.
6. **Alternate transport denial**: disable or fail on `XMLHttpRequest`, WebSocket, EventSource, `sendBeacon`, popups, unexpected main-frame navigation, service workers, uncaught page errors, unexpected console errors, failed requests, and unexpected dialogs.
7. **Synthetic-only output**: fixtures, screenshots, traces, and test reports contain invented identifiers/amounts plus public catalog vocabulary only. Generated outputs remain ignored by Git and must never contain live browser/session data.
8. **Milestone boundary**: live private response shape, authenticated cookie/CORS behavior, Tampermonkey grants/sandbox behavior, and issuer-side no-mutation evidence still require separately authorized owner-only validation.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Built artifact is absent or cannot execute | Fail before asserting UI behavior; do not fall back to source imports |
| Initial synthetic document request matches exactly | Fulfill invented HTML at the approved provider route |
| Named member/tracker/catalog request matches its complete tuple | Fulfill the scenario fixture and record only sanitized method/origin/path metadata |
| Browser emits a preflight for an approved POST | Fulfill only when origin, requested method, requested headers, and path match exactly |
| Origin/path/method/body/header is unknown or malformed | Abort, record a sanitized routing error, and fail the test; never contact the network |
| Deliberate denied-origin probe runs | Observe a locally aborted request and no external response |
| Before the manual scan button is pressed | Zero member, tracker, and catalog operations |
| Page reload restores local state | Reinject the built artifact, preserve GM state, and perform zero new provider reads |
| Page error, unexpected console error, dialog, popup, navigation, failed request, WebSocket, or service worker occurs | Record and fail unless the exact event is an explicitly asserted scenario outcome |
| Serialized synthetic storage contains fixture token/upstream ID or an unsupported benefit | Fail the test |
| Visual preview passes | Write only an ignored synthetic screenshot and exit normally |
| Live provider/Tampermonkey behavior is needed | Stop at the harness boundary and use a separately authorized milestone validation |

### 5. Good / Base / Bad Cases

- **Good**: routing is installed before navigation, the rebuilt IIFE runs with preinstalled async GM mocks, exact synthetic operations complete after a click, reload restores without scanning, and a denied-origin probe is locally aborted.
- **Base**: the synthetic catalog operation returns one retryable `500`; the exact retry occurs once, tracker data remains partial/current, and no unrelated console or network event is accepted.
- **Bad**: navigate first and add routes later, use `route.continue()` for unknown requests, import source modules instead of the artifact, accept every console/dialog failure, or use a real browser profile to make routine tests pass.

### 6. Tests Required

For each generated-bundle provider harness, assert:

- test discovery is scoped and the unit-test runner excludes browser E2E files;
- the default command rebuilds the artifact and completes unattended with deterministic one-worker/no-retry isolation;
- no named provider operation occurs before the explicit scan action, including after expansion from an off-primary-route launcher;
- exact complete-flow operation counts, duplicate physical-card reachability, supported/non-credit filtering, card switching, and visible route/display invariance;
- a selector-free non-primary exact-origin document mounts collapsed, expands without reads, completes a manual scan with route-only context verification, and remains on the same pathname;
- normalized GM storage excludes raw fixture tokens and upstream identifiers, survives reload without autoscan, and clear-data removes both store and identity keys;
- deterministic partial/failure paths exercise the built artifact and exact retry/error behavior;
- a route gate proves cancellation aborts a later physical-card read only after an earlier card is committed, starts no later work, and records the engine's interrupted attempt/disposition counts;
- a successful scan followed by a failed rescan proves a successful card advances with changed data while the failed card preserves its entire prior observation as stale after exactly one retry;
- expected cancellation failures are matched to the exact gated browser request rather than accepted by URL or scenario alone;
- an unapproved-origin probe is aborted by the catch-all, and every routing/runtime error collection is empty at scenario end;
- alternate transports, popups, navigations, service workers, page errors, console errors, failed requests, and dialogs cannot pass silently;
- the visual command is optional, bounded, synthetic-only, and writes to an ignored location;
- the production artifact remains free of harness bindings, privileged transport, expanded grants/destinations, mutation fragments, and debug storage APIs.

Run this browser suite alongside targeted Jest, strict TypeScript, targeted ESLint, the isolated userscript build and artifact audit, sensitive-data scanning, structured-config validation, and `git diff --check`. Run authenticated provider/Tampermonkey validation only with explicit action-time authorization.

### 7. Wrong vs Correct

```ts
// Wrong: an unmatched request can escape to the live network.
await page.goto(providerUrl);
await context.route("**/*", async (route) => {
  if (isKnown(route.request())) await route.fulfill(syntheticResponse);
  else await route.continue();
});

// Correct: interception exists before navigation and unknown traffic is denied.
await context.route("**/*", async (route) => {
  if (isExactSyntheticDocument(route)) return route.fulfill(syntheticDocument);
  if (isExactNamedRead(route)) return route.fulfill(syntheticResponse);
  recordSanitizedRoutingError(route);
  return route.abort("blockedbyclient");
});
await page.goto(syntheticProviderUrl);
await page.addScriptTag({ path: builtUserscriptPath });
```

The browser URL may resemble the approved provider route so the real entry guard executes, but every byte must come from the preinstalled synthetic router.

## Scenario: authorized Tampermonkey update automation

### 1. Scope / Trigger

Use this contract when an owner explicitly authorizes installing one exact locally built userscript version into their current Tampermonkey profile so a milestone can prove the complete build → install → live-mount iteration loop. This is not unattended update permission: authorization for one version or task does not authorize future updates, scans, account actions, extension permission expansion, or changes to other installed scripts.

A same-version **Reinstall** is not valid update evidence. Tampermonkey may leave the page open, provides no version transition, and warns that script settings will be reset. Use a canonical monotonic version bump so the pre-action and post-action states are distinguishable.

### 2. Signatures

The reference build and loopback-serving boundary is:

```bash
npm run build:amex-userscript
python3 -m http.server <loopback-port> \
  --bind 127.0.0.1 \
  --directory build
```

The live page check returns only a bounded projection:

```ts
interface InstalledReaderMountEvidence {
  exactOrigin: boolean;
  pathname: string;
  hostCount: number;
  hasOpenShadowRoot: boolean;
  launcherCount: number;
  launcherExpanded: "true" | "false" | null;
  statusCount: number;
  cancelButtonCount: number;
}
```

Browser responsibility is split by authority:

- **Playwriter** owns explicit task-created HTTP(S) pages for the loopback handoff and sanitized provider-page DOM evaluation.
- **Peekaboo** owns only the protected `chrome-extension://...` Tampermonkey confirmation UI that page automation cannot control.

### 3. Contracts

1. **Exact-version authorization**: immediately before the consequential action, identify the userscript name, namespace, incoming version, currently installed version, exact match scope, and grants. Proceed only when the owner authorized that exact update and the observed metadata matches the built artifact.
2. **Observable version transition**: bump the canonical build version, rebuild, and require the Tampermonkey **Userscript update** page to show `incomingVersion > installedVersion`. Do not use a same-version reinstall, timestamp, page refresh, or click-delivery result as proof.
3. **Least-authoritative routing**: use a task-owned Playwriter page to open the loopback `.user.js` URL. Switch to Peekaboo only after Tampermonkey opens its protected confirmation page; do not attach DevTools or inspect browser-profile state to bypass the extension boundary.
4. **Fresh protected-UI observation**: observe only a narrow installer region containing the script identity/version and confirmation controls. Do not take broad browser accessibility dumps or screenshots that include unrelated tabs, bookmarks, account pages, messages, email, password-manager UI, or browser history.
5. **Confirmed native action**: prefer a semantic native control when exposed. If Tampermonkey does not expose **Update** through Accessibility, use fresh narrow visual evidence plus keyboard focus navigation: prove the visible focus ring moved from the default **Cancel** control to **Update**, then send Return. Coordinate clicks are a last resort and are not successful merely because the input tool reports delivery.
6. **Post-install proof**: require the update confirmation tab to close or transition, then reopen the same loopback artifact. Tampermonkey must report the new version as **INSTALLED VERSION** on the resulting same-version re-installation page. Cancel that verification page; do not reinstall again.
7. **Sanitized live mount proof**: on a task-owned exact-origin provider page, query only the reader host/shadow-root and known reader controls. Confirm one host, expected collapsed/expanded presentation, and no active status/cancel state. Expansion and collapse are allowed; never press the scan button without separate action-time authorization.
8. **Tool-overlay isolation**: if Playwriter's own toolbar intercepts a fixed reader control, remove or close only the tool-owned `[data-playwriter-toolbar]` overlay before retrying a fresh strict locator. Never remove, hide, or mutate provider-page elements to make validation pass.
9. **Cleanup**: close task-owned provider pages, cancel the verification installer, delete the Playwriter session, and stop the loopback server. Temporary narrow installer captures remain outside the repository and must not be copied into task artifacts.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Incoming version equals installed version and Tampermonkey offers **Reinstall** | Stop; do not claim self-update evidence or reset script settings |
| Script name, namespace, match scope, grants, or incoming version differs from the approved artifact | Cancel; do not install |
| Owner has not authorized the exact consequential update | Stop at the protected confirmation page |
| Tampermonkey shows the expected old → new version and **Update** | Freshly observe the control, invoke one native action, then verify post-install state |
| Accessibility does not expose **Update** | Use a narrow visual region and verified keyboard focus; do not guess from a broad screenshot or stale coordinates |
| Input delivery reports success but the page neither closes/transitions nor later reports the new installed version | Treat the update as unverified, not successful |
| Verification reopen reports the new installed version | Cancel the re-installation page and proceed to bounded live validation |
| Updated exact-origin page mounts one idle reader | Expand/collapse only as needed; keep **Scan all cards** untouched |
| Reader is absent, duplicated, busy, or on an unexpected origin/path | Fail the live check without inspecting account content or starting a scan |
| A tool overlay intercepts the reader launcher | Remove only the identified tool-owned overlay and retry once with a fresh locator |
| Loopback server, task page, or browser session is no longer needed | Stop/close/delete the owned resource; never replace an unknown process or port owner |

### 5. Good / Base / Bad Cases

- **Good**: the canonical artifact advances from `0.2.5` to `0.2.6`; Tampermonkey shows **Userscript update** with installed `0.2.5`; verified keyboard focus activates **Update**; reopening reports installed `0.2.6`; an exact-origin page mounts one idle launcher; all task-owned resources are cleaned up.
- **Base**: the installer exposes **Update** through Accessibility. Peekaboo invokes that semantic action directly, then the same post-install version and sanitized mount checks prove completion.
- **Bad**: repeatedly click **Reinstall** for an already-installed version, infer success from a click tool's acknowledgment, inspect all Chrome tabs to find the prompt, retain installer screenshots in Git, or start a provider scan as part of installation verification.

### 6. Tests Required

For each owner-authorized automated userscript update, record or assert:

- the canonical source and built metadata contain the same approved new version;
- build and artifact metadata/grant/match audits pass before opening Tampermonkey;
- the pre-action installer narrowly shows the expected userscript identity, incoming new version, installed old version, and **Update**, not **Reinstall**;
- the native confirmation action is based on fresh semantic state or a visibly verified focus ring;
- the confirmation page closes/transitions and a verification reopen reports the new installed version;
- the verification prompt is cancelled without resetting script settings;
- the post-install exact-origin DOM projection contains exactly one open-shadow reader host, expected launcher state, and zero active cancellation/progress controls;
- expanding exposes one manual scan button without pressing it, and collapsing restores the launcher;
- no provider/account content, credentials, cookies, authorization material, storage exports, network payloads, or raw response data enter tool output or repository artifacts;
- task-owned pages/session/server are closed, deleted, or stopped; and
- the isolated build plus `git diff --check` pass after the version change.

### 7. Wrong vs Correct

#### Wrong

```ts
// Same-version reinstall has no observable success transition and may reset settings.
await openLocalArtifact("0.2.5");
await clickCoordinates(195, 495);
console.log("updated"); // input delivery is not installation evidence
```

#### Correct

```ts
await buildCanonicalArtifact({ from: "0.2.5", to: "0.2.6" });
await playwriterPage.goto(loopbackUserscriptUrl);

const before = await observeNarrowTampermonkeyUpdate();
assert.deepEqual(before, {
  incomingVersion: "0.2.6",
  installedVersion: "0.2.5",
  action: "Update",
});

await focusNativeUpdateControlAndPressReturn();
await expectTampermonkeyConfirmationToCloseOrTransition();

const after = await reopenAndObserveInstalledVersion(loopbackUserscriptUrl);
assert.equal(after.installedVersion, "0.2.6");
await cancelVerificationPrompt();

const mount = await evaluateSanitizedReaderMount(taskOwnedProviderPage);
assert.equal(mount.hostCount, 1);
assert.equal(mount.launcherExpanded, "false");
assert.equal(mount.cancelButtonCount, 0);
```

The version transition proves installation; the native focus proof establishes which protected action was invoked; and the bounded provider-page projection proves the newly installed script executes without broad browser/account inspection or an unapproved scan.
