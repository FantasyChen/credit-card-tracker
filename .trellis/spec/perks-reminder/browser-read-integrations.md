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

1. **Manual start**: account discovery and provider reads begin only after an explicit user action. Page load may restore normalized local state, but must not scan, poll, keep the session alive, or schedule background work.
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
12. **Visible-context invariant**: capture a non-sensitive route/display fingerprint before scanning and verify it afterward. Report changed or unavailable context without persisting the visible display string.
13. **Separate evidence quality from benefit state**: user-facing presentation must not reuse parser completeness/freshness as a benefit status. Labels such as `Partial data`, `Stale data`, and `Could not read` describe the observation; labels such as `Enrollment required`, `In progress`, and `Completed` describe the benefit. Keep issue codes, field availability, confidence, and timestamps secondary to that distinction.
14. **Scale by physical card identity**: when an account can contain many observations or repeated product names, make the physical card the primary navigation level and include explicit ending digits in the card label. Render one selected card workspace at a time or use an equivalently bounded hierarchy; do not default to one continuous all-card technical list.
15. **Shared-catalog, card-specific selection**: normalized/persisted benefits must be usable, trackable credits represented by a positive-amount benefit on the matched Perks Reminder card. Product and benefit aliases belong to one browser-safe matcher backed by the shared static catalog; do not maintain a disconnected userscript allowlist or admit a credit represented only on a different card.
16. **Fail-closed filtering before interpretation**: unknown product names, unreviewed benefit wording, ambiguous matches, and access/protection/insurance/free-night/status/informational/non-credit titles are omitted before provider status, quantity, category, or layout fields are interpreted. Intentional omission is not a parser issue and must not make an otherwise complete card partial.
17. **Compatible-store projection**: when a parser update narrows the supported-credit set without changing the observation/storage schema, project compatible stored observations through the same matcher before display and future persistence. Preserve observation quality, freshness, timestamps, scan summaries, and redacted errors; increment storage revision and rewrite only when rows are actually removed. Malformed or future-schema stores remain refused, not repaired.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| User has not pressed the manual scan control | Restore normalized local state only; make no reader discovery/tracker requests |
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
| Visible route/display fingerprint changes or cannot be captured | Finish safe commits, but mark the summary changed or unavailable |
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
- page load restores local normalized state without scanning, and clear-data removes both normalized state and the installation identity secret;
- visible context is reported as unchanged, changed, or unavailable without persisting its source display value;
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
type HarnessScenario = "complete" | "catalog_failure";

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
5. **Exact request evidence**: assert operation origin, path, method, accepted content type, fixed request body, retry count, and zero provider reads before manual start or after restore-only reload.
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
- no named provider operation occurs before the explicit scan action;
- exact complete-flow operation counts, duplicate physical-card reachability, supported/non-credit filtering, card switching, and visible route/display invariance;
- normalized GM storage excludes raw fixture tokens and upstream identifiers, survives reload without autoscan, and clear-data removes both store and identity keys;
- at least one deterministic partial/failure path exercises the built artifact and exact retry/error behavior;
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
