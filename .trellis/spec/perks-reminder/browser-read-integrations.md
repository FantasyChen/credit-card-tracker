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

### 5. Good / Base / Bad Cases

- **Good**: a manual scan uses named read methods, projects provider JSON into strict schemas, clears each transient token in `finally`, commits every card independently, keeps repeated products distinct through an HMAC fingerprint, and restores only normalized observations after reload.
- **Base**: an optional catalog read fails after valid tracker data. The reader records the redacted catalog issue, leaves enrollment fields unexposed, and commits the tracker observation as partial.
- **Bad**: a generic fetch helper accepts arbitrary paths, stores raw JSON for debugging, derives an ending from a full account number or token, defaults a missing amount to zero, or turns a catalog authentication failure into partial success.

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
