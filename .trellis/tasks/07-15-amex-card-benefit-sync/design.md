# Technical Design — Amex Benefit Reader Phase 1

## 1. Scope and boundaries

Phase 1 is an isolated Tampermonkey runtime for the project owner's authenticated U.S. Amex session. After an explicit button press, it calls characterized first-party Amex account and benefit **read** endpoints, validates and normalizes trackable benefit observations, persists only approved normalized local records, and renders a side panel. Raw response objects and account tokens are scan-scoped in memory and discarded after the run.

It does **not** add a Next.js route, Prisma migration, website authentication bridge, telemetry, third-party transport, or issuer mutation client. Website behavior remains unchanged, and API transport remains isolated behind a portable client boundary rather than coupling normalized contracts to the browser session (`src/lib/auth.ts:102-127`).

### Runtime and network allowlist

- Mount origin: `https://global.americanexpress.com`
- Initial supported paths:
  - `/card-benefits/view-all`
  - `/card-benefits/activity`
- Network destinations: only the exact reviewed account-discovery, benefit-tracker, and benefit-catalog origins/paths identified from the pinned public reference and revalidated against the owner's current session.
- Methods/request bodies: exact per-endpoint allowlist; no generic URL caller and no write-capable endpoint definition.
- Authentication: fresh `fetch` requests may use `credentials: "include"`; the browser attaches its existing session. Code never reads or constructs cookie values or authorization headers.
- Metadata:
  - `@match https://global.americanexpress.com/card-benefits/*`
  - `@run-at document-idle`
  - `@noframes`
  - retain `GM.getValue`, `GM.setValue`, and `GM.deleteValue` for normalized local storage.
- Prefer ordinary first-party `fetch` without privileged network grants. Add `GM_xmlhttpRequest`, `@connect`, or a page-world bridge only if runtime validation proves it necessary and a follow-up design review narrows the exact permission.
- Explicitly omit mutation endpoints, `unsafeWindow`, remote update/download URLs, keep-alive behavior, and background polling.

## 2. Proposed repository layout

```text
src/lib/american-express-card-catalog.ts
src/lib/amex-benefit-reader/
  contract.ts
  identity.ts
  amex-api-contract.ts
  amex-api-client.ts
  amex-response-adapter.ts
  supported-card-credits.ts
  scan-engine.ts
  storage-policy.ts
  __fixtures__/
    accounts.json
    benefit-trackers.json
    benefit-catalog.json
    accounts-unknown.json
    trackers-unknown-status.json
    catalog-malformed.json
  __tests__/
    contract.test.ts
    identity.test.ts
    amex-api-client.test.ts
    amex-response-adapter.test.ts
    scan-engine.test.ts
    storage-policy.test.ts

src/userscripts/amex-benefit-reader/
  tampermonkey-storage.ts
  panel.ts
  __tests__/panel.test.ts
src/userscripts/amex-benefit-reader.user.ts
scripts/build-amex-benefit-reader.mjs
```

The reusable modules live under `src/lib`, consistent with the repository's reusable-domain guidance (`.trellis/spec/perks-reminder/architecture-and-domain.md:3-8`, `.trellis/spec/frontend/directory-structure.md:17-23`). The entry point only performs route guarding and dependency wiring.

The build script uses a direct `esbuild` development dependency and emits an ignored artifact under `build/amex-benefit-reader.user.js`. A dedicated `npm run build:amex-userscript` command avoids the repository's general build path, which can involve database deployment (`package.json:23-29`, `.trellis/spec/perks-reminder/verification.md:38-43`).

## 3. Module responsibilities

### `contract.ts`

- Defines strict Zod schemas and inferred TypeScript types.
- Contains no DOM, Tampermonkey, React, Next.js, Prisma, or auth dependency.
- Exports schema version `1` and observation contract version `amex-benefits/1`.
- Rejects unknown keys at the persistence boundary.
- Provides fixed enums for completeness, freshness, activity kinds, enrollment/tracker/completion states, confidence, issue codes, quantity units, and field availability.

### `identity.ts`

- Creates a 256-bit installation secret with Web Crypto.
- Computes full HMAC-SHA-256 fingerprints for raw API account tokens.
- Allocates random local card UUIDs.
- Reconciles new observations with existing local records conservatively.
- Creates stable semantic benefit keys from normalized issuer benefit ID/title/category/activity kind without list positions.
- Never serializes a raw account token or raw response field.

### `amex-api-contract.ts`

- Declares the exact first-party read endpoint origins, paths, HTTP methods, and request-body builders.
- Defines strict schemas for only the response fields required for account identity/display and trackable benefits.
- Contains no generic request escape hatch and no mutation endpoint constant.
- Versions endpoint/request definitions independently from normalized observation and storage schemas.

### `amex-api-client.ts`

- Owns credentialed first-party `fetch` calls and rejects every URL/method outside the endpoint allowlist.
- Does not inspect page traffic, cookies, storage, or authorization headers; the browser attaches the current Amex session.
- Classifies signed-out/HTTP/schema/timeout failures into fixed redacted issue codes.
- Returns validated response objects to the engine and retains raw JSON only in local variables scoped to the active request/scan.
- Supports `AbortSignal`, bounded timeout, and bounded concurrency.

### `american-express-card-catalog.ts` and `supported-card-credits.ts`

- `american-express-card-catalog.ts` is the small DB-free American Express catalog source consumed by both the general website `static-catalog.ts` and the browser-side support matcher. This keeps the userscript from importing unrelated usage-guide content while avoiding a disconnected duplicate catalog.
- `supported-card-credits.ts` owns the single reusable card/product and usable-credit matching vocabulary used before normalization and when projecting compatible stored observations.
- A credit rule activates only when the conservatively matched American Express card still contains a positive-amount catalog benefit with the reviewed anchor.
- The matcher normalizes punctuation, trademark marks, `&`, and `+`, but product matching remains exact against reviewed aliases and title matching remains reviewed phrase containment. It performs no fuzzy matching.
- It returns a card-scoped semantic credit key for deduplication. Unknown cards, unmatched titles, and ambiguous title matches return no match.
- Provider aliases remain separate from provider transport, Prisma, Next.js, website authentication, server-only code, and the unrelated benefit usage-guide payload.

### `amex-response-adapter.ts`

- Classifies supported-card, known-non-card, primary/supplementary, and unknown account relationships from validated JSON.
- Requires an explicit four- or five-digit display field and never derives ending digits from the opaque token.
- Filters tracker/catalog records through `supported-card-credits.ts` before interpreting status, quantity, or layout fields, then normalizes matched records into enrollment, spend-progress, earned-credit, and completed observations.
- Enriches matched tracker items with catalog title/category/enrollment data without adding informational-only benefits.
- Omits unmatched, wrong-card, informational, insurance/protection, access-only, free-night/status, and otherwise non-credit records without making the card partial solely for the omission.
- Preserves decimal strings and explicit unknown/not-exposed states for matched credits; never defaults missing values to zero or manufactures remainder/period values.
- Deduplicates equivalent wording variants by the card-scoped supported-credit key and returns explicit parser issues only for conflicts or unknown fields on a matched credit.

### `scan-engine.ts`

A state machine over injected ports:

```ts
interface AmexReadClient {
  discoverAccounts(signal: AbortSignal): Promise<AccountDiscovery>;
  readBenefitTrackers(rawAccountToken: string, signal: AbortSignal): Promise<TrackerReadResult>;
  readBenefitCatalog(rawAccountToken: string, signal: AbortSignal): Promise<CatalogReadResult>;
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

- Guarantees one active engine instance per tab and starts only from the panel button.
- Enumerates accounts once, then reads each supported card with bounded concurrency (initially sequential unless runtime evidence justifies a small cap).
- Continues after per-card failures and commits each card independently so earlier success survives interruption.
- Keeps raw response objects and account tokens only in the active scan closure; neither crosses the `ResultStore` boundary.
- Verifies the visible route/card context was not changed by the API-driven scan.
- Supports cancellation through `AbortController` and reports progress/events through a narrow reporter port.

### `storage-policy.ts`

- Purely validates, migrates, merges, and serializes storage envelopes.
- Implements per-card replacement and stale preservation.
- Refuses malformed or unknown-future schema versions.
- Keeps one current redacted error per card, not an error history.
- Does not call `GM.*`.

### Tampermonkey runtime

- `tampermonkey-storage.ts` adapts `GM.getValue`, `GM.setValue`, and `GM.deleteValue` to `ResultStore`. On load it applies the same support matcher to compatible schema-1 observations, removes legacy unsupported benefit rows, and rewrites only when that projection changed; this prevents pre-`1.1.0` rows from persisting or reaching the panel without changing the schema.
- `panel.ts` mounts one fixed host below `document.documentElement`, attaches a Shadow DOM, and renders semantic controls/status without depending on Amex CSS.
- `amex-benefit-reader.user.ts` validates the route, constructs ports, loads stored results, mounts the panel, and starts a scan only from the button callback.

### Card-first panel presentation revision

- `panel.ts` remains a dependency-free Shadow DOM renderer. The revision changes presentation and transient UI state only; normalized contracts, storage schema, transport, scan orchestration, and provider permissions remain unchanged.
- The panel keeps a transient `selectedCardId` and benefit filter. Neither is persisted. A native `<select>` lists every physical card as product name plus ending digits and shows one card workspace at a time.
- Account-level scan status is rendered separately from the selected card's observation quality. Scan labels describe the run (`Ready`, `Scanning`, `Scan finished with data notes`, `Interrupted`, `Failed`); selected-card quality labels describe stored evidence (`Up to date`, `Partial data`, `Stale data`, `Could not read`).
- The selected card exposes derived benefit counts and four filters: all, needs action, in progress, and completed. Filtering is a pure presentation projection over normalized observations.
- A presentation helper maps normalized fields to a human status label, tone, filter bucket, amount summary, and optional compatible-unit progress percentage. It must not add provider facts or persist derived values.
- Benefit rows follow the existing Perks Reminder card language: rounded neutral surface, subtle border/shadow, a colored left status rail, compact status pill, prominent title/amount, and a secondary details disclosure.
- Card-level issue codes and observation timestamps move into a `Data quality and timestamps` disclosure. Global privacy copy remains visible but compact; **Clear local data** moves into a secondary `Data and privacy` disclosure.
- Accessibility remains semantic: labeled card select, buttons for filters with `aria-pressed`, live scan status, visible focus rings, minimum 40px primary controls, meaningful empty-filter states, and native disclosures.
- Responsive width increases modestly while remaining bounded to the viewport. The panel continues to isolate styles from Amex through Shadow DOM.

## 4. Normalized contracts

### Field availability

An absent value cannot silently mean false or zero:

```ts
type ObservedField<T> =
  | { state: "observed"; value: T }
  | { state: "not_exposed" }
  | { state: "unrecognized"; issueCode: IssueCode };
```

### Quantity

```ts
interface QuantityV1 {
  value: string; // normalized decimal string, never float persistence
  unit: "USD" | "count" | "points" | "percent" | "unknown";
  currency: "USD" | null;
}
```

Only visible quantities are persisted. `remaining` is not manufactured from `target - used`; the panel may derive a temporary percentage when both observed values are compatible.

### Portable card observation

```ts
interface NormalizedCardObservationV1 {
  contractVersion: "amex-benefits/1";
  issuer: "american_express_us";
  localCardId: string;
  productName: string;
  endingDigits: string; // exactly 4 or 5 digits
  observedAt: string;
  parserVersion: string;
  completeness: "complete" | "partial";
  issueCodes: IssueCode[];
  benefits: NormalizedBenefitObservationV1[];
}
```

`endingDigits` follows current repository validation for both four and five digits (`src/lib/cardDisplayUtils.ts:33-51`). The portable observation excludes the identity secret and raw/fingerprinted issuer token so a later transport cannot leak it accidentally.

### Benefit observation

```ts
interface NormalizedBenefitObservationV1 {
  benefitKey: string;
  title: string;
  category: ObservedField<string>;
  activityKind:
    | "enrollment_candidate"
    | "spend_progress"
    | "credit_earned"
    | "completed";
  enrollmentState: ObservedField<
    "enrolled" | "required" | "linking_required" | "not_required"
  >;
  trackerState: ObservedField<
    "not_started" | "in_progress" | "earned" | "completed"
  >;
  completionState: ObservedField<"complete" | "incomplete">;
  earnedOrUsed: ObservedField<QuantityV1>;
  targetOrLimit: ObservedField<QuantityV1>;
  remaining: ObservedField<QuantityV1>;
  period: ObservedField<string>;
  confidence: "high" | "medium" | "low";
  issueCodes: IssueCode[];
}
```

Purely informational benefits do not enter this contract.

## 5. Local card identity

### Primary identity

1. Generate and store `identitySecret.v1` on first use.
2. Read the opaque account token from the validated account-discovery response only inside the active scan.
3. Compute `HMAC-SHA-256(secret, "amex-us-card-v1\0" + token)`.
4. Discard the raw token after the card's read requests and active scan complete; never pass it to persistence or UI.
5. Persist the full HMAC fingerprint only in local identity metadata, plus random `localCardId`, product name, and ending digits.

A keyed full digest prevents raw-token recovery and avoids treating product name/ending digits as universally unique. If Web Crypto or a stable token is unavailable, identity discovery fails safely; it does not persist the raw token or silently weaken identity.

### Reconciliation

- Exact fingerprint match: reuse local card ID.
- New fingerprint with exactly one unclaimed record matching normalized product name + ending digits: rebind, mark `display_reconciled`, and make the card partial.
- No match: allocate a local UUID.
- Multiple display matches, fingerprint conflicts, or duplicate current fingerprints: do not merge; retain prior records and report identity failure.

Phase 1 supports one Amex account per Tampermonkey installation. Switching Amex accounts requires **Clear local data**; account namespacing is deferred.

### Benefit identity

Use normalized title + category + activity kind, optionally strengthened by a local-only hashed DOM discriminator. Never use list position. Merge matching view-all/activity observations; collapse identical duplicates; treat conflicting indistinguishable observations as a card-level identity issue.

## 6. Read-only API scan flow

### Request allowlist

1. Validate the current page is an approved signed-in Amex route before enabling scan.
2. Capture a non-sensitive visible context guard (route plus the currently displayed card label/fingerprint where safely exposed) so the scan can prove it did not navigate the UI.
3. Build requests only through endpoint-specific functions. Each function fixes origin, path, method, credentials mode, headers, and body shape; callers provide only the minimum account token where required.
4. Reject redirects away from approved Amex origins, non-JSON responses, unexpected content types, auth failures, and unknown response envelopes with fixed redacted errors.
5. Never expose a generic `request(url, options)` function outside the private client module.

### Discovery

1. Call the characterized account-discovery read endpoint once after the user presses **Scan all cards**.
2. Strictly validate the minimal response envelope and flatten supported primary/supplementary relationships.
3. Classify each result as supported card, known non-card, or unknown.
4. Require a stable opaque account token plus explicit product name and four- or five-digit display ending; never derive user-visible digits from the token.
5. Deduplicate by the HMAC-derived fingerprint and mark unknown/duplicate variants as aggregate partial.
6. Release the raw discovery response after preparing transient card references.

### Per-card flow

1. Derive/reconcile the installation-local fingerprint from the raw account token.
2. Call only the allowlisted benefit-tracker and benefit-catalog read operations for that token.
3. Strictly validate the response envelopes, match only catalog-represented usable credits for the prepared card product, normalize those tracker/catalog records, and merge them by the card-scoped supported-credit identity.
4. Commit the normalized complete/partial observation through storage policy.
5. Release raw per-card responses and the token reference as soon as the card attempt finishes.

A signed-out response, HTTP failure, timeout, schema mismatch, unknown account relationship, or identity conflict fails that card without erasing prior data. One card's failure does not stop remaining cards. Initial execution is sequential; bounded concurrency may be raised only after owner validation demonstrates Amex tolerates it safely.

### Visible-page invariance

The client does not click the account selector, benefit tabs, or tiles and does not assign `location`. In `finally`, compare the visible context with the captured guard. A changed card/route is reported as a warning, but no automated mutation or restoration navigation is attempted. No enrollment, linking, activation, redemption, offer, payment, or other write control/endpoint is defined.

## 7. Completeness and persistence

### Card attempts

- `complete`: account identity and both required benefit responses validated, normalization completed, and no unknown structural/status issue occurred.
- `partial`: safe normalized data exists, but one or more optional records/fields/statuses are unrecognized.
- `failed`: authentication, endpoint, HTTP, identity, response-schema, deduplication, or safety verification failed.

Recognized optional empty arrays remain complete. A validated but unsupported upstream benefit is intentionally omitted and does not make the observation partial. Missing required envelopes or unknown fields/statuses on a matched supported credit still do.

### Persistence disposition

- Complete/partial: atomically replace that card's latest observation; set `freshness = current` and preserve completeness/issues.
- Failed with prior data: preserve prior observation and `observedAt`; set `freshness = stale_error`, `lastAttemptAt`, and fixed redacted error.
- Failed without prior data: save an error shell with `latest = null` and `freshness = error_no_data`.

### Aggregate status

`complete` requires complete account discovery, every supported card complete/current, and successful visible-page invariance verification. Otherwise the run is `partial`, `interrupted`, or `failed`. Different `observedAt` values, stale records, partial cards, unknown account variants, or visible-context warnings trigger a mixed-observation warning.

## 8. Storage envelope

Keys:

- `perksReminder.amexBenefitReader.identitySecret.v1`
- `perksReminder.amexBenefitReader.store.v1`

```ts
interface StoreEnvelopeV1 {
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  cards: Record<string, StoredCardRecordV1>;
  lastScan: ScanSummaryV1 | null;
}
```

Each record contains local identity metadata, latest portable observation or null, freshness, observed/attempt times, completeness, and one current fixed error. `lastScan` contains only local UUIDs, timestamps, status, counts, per-card dispositions, and the visible-context invariance result. The existing `restoration` field may be migrated or renamed during implementation; no raw page label or account token enters the summary.

Each card commit rereads and validates the envelope, applies one pure merge, increments revision, and writes the full envelope. Unknown future or malformed schemas are never overwritten; the panel offers clear-data recovery.

## 9. Side panel

Required states:

- idle with loaded local observations;
- scanning with current card/surface progress;
- cancelling;
- complete;
- mixed/partial;
- incompatible/malformed local storage.

Required controls and content:

- `Local only — not sent to Perks Reminder` disclosure;
- concise disclosure that a manual scan makes first-party Amex read requests with the signed-in session and does not save raw responses;
- **Scan all cards**;
- **Cancel** during a run;
- progress such as `Card 2 of 5 — reading activity`;
- per-card `Current`, `Incomplete`, `Stale`, or `Error` badges;
- observation and last-attempt timestamps;
- mixed-age/incomplete banner;
- benefit title, primary status, and amount/progress;
- compact details for category, enrollment, tracker, period, completion, confidence, and field availability;
- confirmed **Clear local data**.

Use semantic buttons/headings/status regions and `aria-live` progress, matching accessibility conventions (`.trellis/spec/frontend/component-guidelines.md:44-51`).

## 10. Testing strategy

### Synthetic fixtures

Fixtures use only invented JSON envelopes, endings, tokens, product names, relationship types, benefit IDs, and values. Never commit live responses, request bodies from the owner's session, screenshots, account identifiers, network captures, balances, loyalty data, headers, cookies, or exported storage.

Cover:

- four- and five-digit endings;
- duplicate product names on distinct cards;
- primary and supplementary relationships;
- known non-card and unknown account variants;
- enrollment, progress, earned, and completed records;
- money and count quantities;
- recognized empty arrays and optional missing fields;
- unknown status/relationship values and malformed envelopes;
- conflicting benefit identities.

### Unit and fixture tests

- Contract: strict validation and forbidden key rejection.
- Identity: deterministic HMAC, separate same-name cards, ambiguity rejection, and no raw token serialization.
- API contract/client: exact endpoint/origin/path/method allowlist, fresh credentialed requests, redirect/auth/HTTP/timeouts, cancellation, and rejection of arbitrary or mutation destinations.
- Supported-credit matcher/response adapter: catalog-backed product aliases, represented usable credits, intentional title variants, wrong-card/unmatched/informational/protection/access/non-credit exclusion, unknown-card fail-closed behavior, status/quantity normalization, enrichment, supported-credit deduplication, and omission without false partial status.
- Engine: all cards attempted, per-card continuation, cancellation, timeout, bounded concurrency, raw-response lifetime, and visible-page invariance.
- Storage: complete/partial replacement, stale preservation, no-data shell, schema refusal, revision increments, mixed observation times, and rejection of raw response/token fields.
- Panel: manual start, progress, stale/incomplete labels, accessible controls, details, cancellation, and confirmed deletion.

Mock `fetch` with synthetic Amex responses and assert every request matches the exact read allowlist. Patch `XMLHttpRequest`, `sendBeacon`, and `WebSocket` to throw. Instrument all known mutation endpoint fragments and UI controls to fail if activated. Serialize outputs and assert raw payloads, raw tokens, headers, and disallowed keys are absent.

### Generated-bundle Chromium harness

`playwright.amex.config.ts` owns a task-scoped Chromium runner under `tests/e2e/amex-benefit-reader/`. `npm run test:e2e:amex` first rebuilds `build/amex-benefit-reader.user.js`, then injects that exact generated IIFE into an invented document served at `https://global.americanexpress.com/card-benefits/view-all`. The test does not import or execute the userscript entry, engine, matcher, panel, or storage adapter from source.

The harness installs `context.route("**/*")` before navigation. It fulfills the synthetic document, the exact member `GET`, and the exact tracker/catalog `POST` operations from invented inline fixtures. It also answers only the browser-generated CORS `OPTIONS` preflights for those two reviewed POST paths. Every other request is aborted with no `continue`/`fallback`; route assertion failures are recorded and aborted. Request assertions cover exact URL, method, `Accept`, JSON content type, and fixed body structure. Chromium service workers are blocked. Because Tampermonkey exposes a receiver-neutral `fetch` facade while page-native Chromium `fetch` requires a `Window` receiver, the test init script wraps bound native `fetch` without changing destinations or request options; all resulting native requests still pass through the fail-closed route.

Before bundle injection, Playwright bindings install promise-based `GM.getValue`, `GM.setValue`, and `GM.deleteValue` over a Node-owned in-memory map. Tests may inspect that map, but production receives no storage export/debug interface. Reload recreates the synthetic document and reinjects the built artifact while retaining the harness map, modeling userscript-manager storage without page-origin storage.

The unattended suite covers manual-only initiation, visible progress/completion, primary and supplementary duplicate-product cards, supported-credit filtering, card switching, normalized persistence, reload restoration without autoscan, context invariance, clear confirmation/removal of both keys, and a deterministic catalog `500` retry that retains tracker observations as partial data. Expected UI assertions are explicit rather than computed from the production matcher. `npm run test:e2e:amex:visual` runs an opt-in headed synthetic preview and writes a screenshot below ignored `test-results/`; default runs retain traces/screenshots only on failure.

This harness proves generated-bundle integration and deny-by-default test networking. It cannot prove current private Amex response compatibility, real authenticated cookie/CORS policy, Tampermonkey grant/sandbox behavior beyond the modeled `GM`/fetch facades, or issuer-side no-mutation behavior. Milestone releases still require the bounded owner-only live validation below.

### Owner-only browser validation

After automated checks and bundle creation, manually install the generated artifact in Tampermonkey and validate one read-only scan on the authenticated account. Confirm manual initiation, account/card count, duplicate product separation, benefit states/amounts, no mutation activation, unchanged visible card/route, expected storage keys only, no raw response/token persistence, network requests limited to the exact approved first-party read endpoints, stale preservation on a safe simulated failure, and clear-data removal. Inspect only request destination/method/status and redacted schema-level facts; do not save live response bodies, headers, cookies, screenshots, or exports.

## 11. Migration path

A future Manifest V3 extension reuses `contract.ts`, `identity.ts`, `amex-api-contract.ts`, `amex-response-adapter.ts`, `scan-engine.ts`, and `storage-policy.ts`. It replaces the Tampermonkey request/storage adapters with content-script/service-worker transport and `chrome.storage.local` adapters while preserving the endpoint allowlist and raw-data lifetime.

A later website transport accepts only portable `NormalizedCardObservationV1`, never `StoredCardRecordV1`; the installation secret and local source fingerprint therefore cannot be transmitted accidentally. Server-side profile mapping, authentication, idempotency constraints, provenance, and privacy disclosures require a separate design/review.

## 12. Rollout and rollback

Phase 1 has no production website or database rollout.

Rollback:

1. Cancel the active scan.
2. Clear local data if desired.
3. Disable/uninstall the userscript.
4. Reinstall a previously generated parser bundle if needed.
5. Revert the isolated modules, build script, package dependency/lockfile changes, and tests in the repository.

Parser updates change `parserVersion`, not `schemaVersion`. Storage migrations require explicit pure migration functions and tests. A previous parser can continue reading schema version 1.
