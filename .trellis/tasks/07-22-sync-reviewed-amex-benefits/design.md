# Design: Sync reviewed AMEX benefits

## 1. Overview

This milestone adds a visible, first-party preview-and-confirm flow after the local AMEX review list. It deliberately separates four authorities:

1. the AMEX branch reads and normalizes only after a manual scan;
2. the shared Tampermonkey identity moves one bounded V2 envelope through script-private storage;
3. the Perks Reminder handoff page uses the existing first-party session to preview;
4. the server writes only in `write` mode after a fresh HMAC-bound confirmation.

The initial write policy is intentionally narrow: only the stable Platinum product key plus the Lululemon or Resy family key, and only when an explicitly structured source period equals one exact current active destination cycle. Everything else is review-only.

## 2. Non-Negotiable Entry Gate

The accepted pre-sync implementation is currently uncommitted and its task is still `in_progress`. Before this child can be activated:

- finish the parent stabilization and checks;
- commit the parent implementation;
- verify this child starts from that reviewed commit;
- obtain explicit approval to activate the child.

Do not stash, reset, copy, or otherwise route around this gate. This document prepares a future task; it does not authorize implementation now.

## 3. Existing Facts and Consequences

- The reader currently emits `amex-benefits/1`; it has no stable product key in the observation, discards the matcher's stable family key, and stores period as visible text. V1 cannot authorize a sync.
- The matcher already has card-scoped semantic family keys and reviewed exact-card aliases. V2 should emit those keys rather than recreate matching on the server.
- `CreditCard` and `Benefit` do not retain stable catalog keys. Existing generated IDs and seed-recreated `PredefinedBenefit.id` values are not suitable identities.
- `BenefitStatus` uniquely identifies a destination cycle/occurrence but has no source provenance or stale-replay protection.
- NextAuth uses a first-party JWT session cookie with `SameSite=Lax`. Cross-site AMEX `fetch` cannot reliably authenticate, and the repository has no credentialed CORS policy.
- The userscript currently has one AMEX match and only `GM.getValue`, `GM.setValue`, and `GM.deleteValue`. Those grants are sufficient for the selected mailbox design.
- `X-Frame-Options: DENY` excludes an iframe design. A top-level first-party tab is compatible with Lax navigation and existing sign-in.
- The root layout currently loads Google Analytics, Vercel Analytics, and a global error boundary that reports `window.location.href`; request logging can retain `url.search`. The handoff must be excluded and URL handling sanitized before transfer use.
- The daily `check-benefits` cron is the existing scheduled maintenance path and can own bounded audit retention after explicit rollout authorization.

## 4. System Boundaries

```text
Manual AMEX scan
  -> strict normalized V2 local store
  -> local grouped review
  -> one global Sync click
  -> one short-lived GM-private mailbox entry
  -> exact top-level Perks Reminder handoff
  -> exact-origin typed bridge
  -> same-origin preview route (read only)
  -> visible proposed/unchanged/skipped summary
  -> separate confirmation
  -> same-origin confirm route
  -> independent per-row transactions
       status + latest provenance + row audit
  -> explicit per-row results
```

Provider reads and destination writes remain different clients and contracts. No server route can call AMEX, and no AMEX-page branch can call a Perks Reminder mutation endpoint.

## 5. Normalized V2 and Local Selection

### 5.1 Stable identities

V2 introduces required stable identifiers for reviewed supported observations:

- `productKey`: a finite shared-catalog key, for the initial write policy `american-express-platinum-card`;
- `creditFamilyKey`: a card-scoped finite key, initially writable only for `american-express-platinum-card:lululemon` and `american-express-platinum-card:resy`;
- `sourcePeriod`: a strict observed field whose writable value is a UTC calendar date range.

The display product name, benefit title, and visible period remain useful for local review but are never mapping authority. The server validates finite keys; it does not normalize names or parse title/period text.

### 5.2 Structured period

The writable period representation is a strict object such as:

```ts
type SourcePeriodV2 = {
  kind: "calendar_date_range";
  startDate: string; // real YYYY-MM-DD
  endDate: string;   // real inclusive YYYY-MM-DD
  timeZone: "UTC";
};
```

The schema rejects extra keys, impossible dates, reversed ranges, timestamps in date-only fields, and unreviewed kinds. The AMEX adapter may emit an observed range only from characterized first-party fields and explicit parser rules. It must not derive a range from the display title, current browser date, inferred cadence, destination catalog, or nearby quarter.

Rows without an observed valid structured range remain locally reviewable and server-skipped. A canonical period key may be derived from the structured object by the V2 normalization layer, but the server still compares the source range to destination metadata and the existing status row.

### 5.3 Scan identity and freshness

V2 ties each observation to the latest scan with a random local `scanId`. The scan summary includes `startedAt`, `finishedAt`, and card dispositions; each accepted card observation records the same `scanId`.

The Sync projection includes only records that:

- were produced by the latest completed scan attempt;
- have local freshness `current`;
- have card completeness `complete`;
- have a matching successful card disposition;
- pass strict V2 parsing.

The envelope includes `scanFinishedAt`; the server rejects future-skewed data and requires confirmation no later than 30 minutes after that time. Local stale/partial/failed rows remain visible in the review list, and the handoff can show bounded exclusion counts/reasons, but those records are not writable observations.

### 5.4 V1 compatibility

Compatible V1 local data remains reviewable. It is never transformed into writable V2 by parsing its product/title/period text. Sync remains unavailable or reports `fresh_v2_scan_required` until an explicit new scan produces V2 data. This is a fail-closed local contract migration, not a lossy rewrite of historical observations.

### 5.5 Transport envelope

Define a separate strict `amex-sync-envelope/1` projection rather than accepting the entire local store. It includes only:

- envelope and observation versions;
- scan ID and finish time;
- source local card ID, stable product key, and ending digits;
- source observation time and parser version;
- stable family key and strict source period;
- explicit completion evidence and compatible decimal quantity fields;
- bounded local exclusion counts/reason codes.

Set explicit byte, card, row, string, and array limits and reject unknown fields. Run the forbidden-field-name guard before schema parsing. Do not include installation/source fingerprints, store errors, issue detail text, raw responses, tokens, headers, cookies, credentials, or user identity.

Canonicalize the validated envelope before hashing. Canonicalization is versioned and deterministic; object insertion order is not security state.

## 6. One-Time Tampermonkey-Private Mailbox

### 6.1 Metadata and branch isolation

Keep one userscript name and namespace. Add only a path-narrow match for the exact first-party handoff and retain the three storage grants. At runtime branch before constructing dependencies:

- AMEX branch: exact reviewed AMEX origin; reader only;
- handoff branch: exact `https://www.perks-reminder.com/integrations/amex-sync` origin/path; mailbox bridge only;
- every other origin/path: return without side effects.

The handoff branch must not import or instantiate the AMEX transport, scan engine, provider endpoints, or panel. Keep `@noframes`; also require `window.top === window.self` at runtime.

### 6.2 Mailbox lifecycle

Use one fixed GM mailbox key containing at most one entry. On a direct Sync gesture:

1. validate and project the latest V2 scan;
2. generate a cryptographically random transfer ID and bridge nonce;
3. set a short expiry bounded by the scan's 30-minute deadline;
4. store the strict envelope, digest, transfer ID, nonce, created/expiry times, and versions;
5. open exactly one top-level handoff URL whose only query value is the opaque transfer ID.

A second Sync replaces only an expired/consumed mailbox or requires explicit cancellation of the existing transfer; it never creates an unbounded queue.

The first-party branch requires exact transfer-ID equality, validates schema/digest/TTL/size, and performs a typed `postMessage` handshake with exact target origin. The page checks `event.origin`, `event.source`, message type, nonce, and transfer ID. Never use `*`, DOM attributes, URL fragments, clipboard, page `localStorage`, or opener fallback for the envelope.

Delete the mailbox after the page acknowledges that preview accepted the envelope. Also delete it on expiry, cancellation, malformed content, replay, timeout, and existing clear-data. A consumed transfer cannot be reopened. If authentication is needed, the opaque locator may survive in the same callback URL while the mailbox TTL remains active; no opener continuity is required.

## 7. First-Party Handoff and Telemetry Isolation

### 7.1 Route behavior

The exact handoff page is authenticated, `no-store`, and not frameable. It supports:

- signed-out state with a return to the same exact path and opaque locator;
- waiting/invalid/expired/consumed transfer states;
- mapping-required state loaded only with owned server card options;
- preview summary grouped into proposed, unchanged, and skipped;
- explicit warnings for overwrite, decrease/refund, completion set, and completion clear;
- a separate confirm button enabled only in server `write` mode;
- final per-row outcomes.

After the mailbox is safely acquired into page memory, immediately call `history.replaceState` with the query-free handoff path. Do not place the envelope or proposal in browser history. Page reload after consumption fails closed and asks the user to return to AMEX.

### 7.2 Analytics and monitoring

The current global telemetry is unsafe for a transfer locator because it can observe full `window.location.href` before client cleanup. Refactor telemetry so the handoff exclusion applies before analytics/error-reporting code loads:

- no Google Analytics script/config on the exact handoff route;
- no Vercel Analytics component on that route;
- no search analytics or automatic global error POST from that route;
- no service worker caching of the handoff document or request;
- route-level `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, and no indexing.

Sanitize monitoring globally at both ends:

- client reports serialize only origin plus pathname, never query or fragment;
- the monitoring route re-parses and strips query/fragment from client URL and referer before logging;
- request logging omits `url.search` for the handoff and should use a shared URL sanitizer;
- malformed URLs are replaced with a constant redacted value.

Handoff errors render a local generic code and retry guidance. They do not send the source envelope, proposal, mappings, titles, ending digits, amounts, or transfer locator to monitoring.

## 8. Server API and Modes

### 8.1 Mode resolution

Use one server-only mode resolver with finite values:

- `off`: preview and confirm fail closed; this is the default for absent, invalid, or incomplete configuration;
- `preview`: preview is available, confirm is disabled and rejected;
- `write`: preview and explicit confirmation are available.

Do not expose a client environment variable as authority. The server returns only the effective capability needed by the UI. An old userscript or cached page cannot bypass mode checks.

### 8.2 Common request guard

Both routes:

1. authenticate with `getServerSession(authOptions)` before user-owned reads;
2. require POST, exact JSON media type, exact first-party `Origin`, and same-origin Fetch Metadata;
3. enforce content-length/decoded byte limits before full parse where possible;
4. parse JSON as `unknown`, run forbidden-field checks, and apply strict Zod schemas;
5. ignore/reject payload user identity and use only `session.user.id`;
6. return stable non-sensitive errors and no CORS headers.

The routes are same-origin only; there is no `OPTIONS` credentialed CORS path.

### 8.3 Preview

Preview performs reads and pure calculations only. It must not call any Prisma create/update/upsert/delete/raw-write/transaction delegate, save manual mappings, create an attempt, revalidate a path, or mutate telemetry state.

For every input row, preview returns either:

- a proposed exact destination with before/after values and change flags;
- `unchanged` with a stable reason; or
- `skipped` with a stable reason and no sensitive internal detail.

Manual selections are treated as untrusted proposal input. Changing a selection triggers a new preview. The server checks ownership and compatibility but does not save the selection.

Preview returns a short-lived HMAC proposal token. Its expiry is bounded by both a short proposal TTL and the source scan's 30-minute deadline.

### 8.4 HMAC proposal

The proposal body is versioned and contains or commits to:

- route purpose (`amex-sync-confirm`);
- authenticated user ID;
- effective server mode;
- canonical envelope digest;
- canonical selected-manual-mapping digest;
- ordered row plan and current before-state digest;
- source scan and observation identities;
- issued-at and expiry.

Sign with a server-only HMAC key and verify with constant-time comparison. The token is not a bearer authorization substitute: confirmation still requires the same authenticated user, exact-origin request, valid input, `write` mode, and current ownership/state.

### 8.5 Confirmation

Confirmation repeats every guard and mapping decision. It verifies proposal purpose/signature/user/digests/expiry/mode and re-resolves each row. A changed destination or proposal input returns `conflict_repreview_required` for that row.

Create or resume a server-computed idempotent attempt, then process accepted rows independently. One row failure does not roll back prior/other successful rows. Revalidate affected server-rendered routes only when at least one status row is applied.

## 9. Exact Mapping

### 9.1 Destination catalog keys

Add stable nullable keys to both persistent catalog templates and copied user-owned destinations:

- card product key on `PredefinedCard` and `CreditCard`;
- product/family/period key fields on `PredefinedBenefit` and `Benefit` as needed to identify one destination row.

New card creation copies these keys. Static catalog definitions own the stable strings. Do not use public array-index IDs, mutable descriptions, or Prisma CUIDs as semantic identity.

Backfill existing records only when the shared catalog and copied destination metadata resolve deterministically. A mismatch, duplicate, custom edit, unknown source, or split-window ambiguity leaves the field null. The backfill supports dry-run counts and conflict reasons; null never falls back to text matching at runtime.

### 9.2 Card mapping

Resolution order:

1. a confirmed saved mapping for `(user, source, sourceLocalCardId)` if it still points to an active owned card with the same non-null product key;
2. otherwise exactly one active owned card matching stable product key plus ending digits;
3. otherwise `manual_mapping_required` or `ambiguous_card`.

A user may choose only from server-loaded compatible owned cards. The server revalidates selection at preview and confirmation. Save the exception only inside confirmed `write` mode, in the same authorization boundary as the attempt. A mapping cannot authorize a different user, null product key, inactive/deleted card, different product family, or a disallowed benefit.

### 9.3 Benefit, period, cycle, and occurrence

A row is writable only when all are true:

- product/family tuple is in the initial server allowlist;
- destination card and benefit stable keys are non-null and equal the source keys;
- source period is a valid structured UTC range;
- server time is within that range;
- the destination benefit's configured period key/range is exactly the same;
- exactly one existing user-owned `BenefitStatus` has the same start/end range and occurrence;
- the row is current rather than historical/future.

The first milestone does not materialize missing statuses in preview or confirmation. Missing, multiple, or nonzero/multiple unresolved occurrences are skipped. No title, visible period, current quarter, nearest date, amount, or max value may select a destination.

## 10. Authority and Transition Semantics

### 10.1 Amounts

Accept only finite, nonnegative USD decimal quantities with compatible currency/unit and bounded precision/range. Compare using decimal minor units, then convert once for the existing destination storage type. Reject incompatible, negative, over-precision, contradictory, or unrecognized quantities.

AMEX amounts are absolute. A newer amount replaces the destination amount and may increase or decrease it. Never call the additive transition. Do not infer zero from absence or compute source usage as target minus remaining.

### 10.2 Completion

Completion is derived independently and conservatively:

- explicit recognized `complete` sets completion;
- explicit recognized `incomplete` clears completion;
- otherwise compatible observed used and target quantities set completion exactly when used is at least target and clear it when below target;
- missing/unknown tracker wording, title text, activity labels alone, or incompatible amounts cannot establish completion;
- contradictory explicit and amount evidence skips the row.

When only explicit completion evidence is available, completion may change while amount remains unchanged; the preview must say so. When an authoritative compatible amount is present, both absolute amount and completion are derived from the source evidence. Completion clearing clears `completedAt`; a new completion sets a server time; continued completion preserves the existing completion time.

The synchronization does not change `isNotUsable`. An existing not-usable destination is skipped until separately resolved rather than creating contradictory state.

### 10.3 Freshness and conflict order

For each source and destination status:

- older `observedAt` than latest provenance: `stale_replay`;
- equal observation identity/digest: `unchanged_replay`;
- equal time with different identity/digest: `source_conflict`;
- newer valid observation: eligible to overwrite after preview/confirm;
- destination before state different from the proposal: `conflict_repreview_required`.

A manual edit after preview causes re-preview. On the new preview, a newer AMEX observation may still be proposed as authoritative, but the user sees the new overwrite before confirmation.

## 11. Additive Persistence Design

Names may be refined during implementation, but the concerns must remain separate.

### 11.1 Saved mapping

`ExternalCardMapping` stores:

- authenticated user ID;
- source enum (`AMEX`);
- source local card ID;
- destination `CreditCard.id`;
- stable source product key and a non-authoritative ending snapshot for review;
- mapping kind (`MANUAL_CONFIRMED`), created/updated times, optional inactive time.

Unique source mapping per user/source/source-card. User and destination relations prevent orphan authorization; deletion deactivates/cascades predictably without changing benefit status.

### 11.2 Latest provenance

`BenefitStatusSourceProvenance` stores one latest row per destination status and source:

- destination status ID and source enum;
- source observation identity/digest and `observedAt`;
- contract/parser versions;
- stable product/family/period identity;
- applied-at time and owning attempt ID.

This is the durable stale-replay and attribution source. It is not inferred from `BenefitStatus.updatedAt` and persists beyond detailed audit retention.

### 11.3 Attempt

`AmexSyncAttempt` stores:

- authenticated user ID;
- server-computed idempotency key and envelope digest;
- mode and lifecycle state;
- proposal/confirmation times and aggregate outcome counts;
- created/completed/expiry times.

A unique user/idempotency key prevents concurrent duplicate execution. Do not store the full envelope, proposal token, titles, ending digits, or raw normalized payload.

### 11.4 Row audit

`AmexSyncRowAudit` stores one bounded result per attempt row:

- stable source row identity and result/reason code;
- optional server-owned destination card/benefit/status IDs;
- source observation time/version identity;
- exact before/after snapshots for `usedAmount`, `isCompleted`, `completedAt`, and `isNotUsable`;
- timestamps and failure class without raw error text.

Use a unique `(attemptId, sourceRowIdentity)` key. Each applied row transaction updates the owned status, upserts latest provenance, and records the audit atomically. Failed/skipped rows are recorded without claiming status application.

### 11.5 Retention

Extend the existing authorized `check-benefits` cron logic with a bounded cleanup step for row audits older than 90 days. Delete/compact attempt detail consistently so no orphan records remain. Keep confirmed mappings and latest destination provenance. Test the cutoff boundary with an injected clock and mocked Prisma; invoking the real cron remains separately authorized.

## 12. Migration, Rollout, and Rollback

### 12.1 Additive migration

- Add nullable key columns and new tables/relations/indexes only.
- Do not rewrite existing status values or label existing rows as AMEX.
- Review generated SQL for destructive statements, table rewrites, unexpected non-null columns, unique-constraint compatibility, and cascade behavior.
- Account for the repository's known empty-database migration replay issue; never use reset or force-reset as a workaround.
- Backfill is a separate dry-run/write operation. Dry-run reports aggregate matched/null/conflict counts only. Write execution needs separate target verification and authorization.

### 12.2 Phased rollout

1. Deploy additive schema while mode remains `off`.
2. Deploy V2 reader/handoff/server preview with mode `off`.
3. Enable `preview` only for synthetic or separately authorized test-account validation; verify zero Prisma writes.
4. Enable `write` only after reviewed fixtures prove the two-family current-cycle policy and explicit production authorization is given.
5. Observe sanitized aggregate result codes and retain the server kill switch.

Missing mode/HMAC/allowlist configuration fails to `off`. UI hiding is not a kill switch because old userscript versions may remain installed.

### 12.3 Rollback

- Set mode to `off` first.
- Roll back application behavior; leave additive schema unused.
- Roll back an installed userscript only through a separately authorized monotonic update; repository revert does not uninstall it.
- Expire/delete the one mailbox entry.
- Deactivate a bad mapping without changing statuses.
- Use row audits for a reviewed compensating plan only after checking for newer manual/AMEX changes.
- On unexpected production database impact, stop and use verified backup/point-in-time recovery; do not issue ad hoc writes.

## 13. Test Strategy

### 13.1 Pure contract/domain tests

- strict V2 and transport versions, limits, date-only ranges, extra-field rejection, forbidden names, canonical digest;
- V1 remains review-only and cannot be guessed into V2;
- latest-scan/current/complete/30-minute selection;
- finite stable key vocabulary and two-family allowlist;
- exact active range/cycle/occurrence mapping and all fail-closed alternatives;
- decimal compatibility, absolute increases/decreases, explicit completion, at-target completion, below-target clearing, contradictory evidence, and not-usable skip;
- stale/equal/conflicting/new source ordering and deterministic idempotency.

### 13.2 Preview tests

- authenticate before DB access; reject origin/fetch/content/size/version violations;
- derive user only from session;
- automatic and saved/manual mapping ownership/compatibility;
- exact non-null destination key and cycle resolution;
- every input row receives proposed/unchanged/skipped output;
- visible decrease and completion-change flags;
- HMAC purpose/user/payload/mapping/before-state/mode/expiry binding;
- assert no write delegate, transaction, revalidation, attempt, audit, provenance, or mapping save in `off`/`preview`.

### 13.3 Confirmation tests

- reject missing/invalid/expired/cross-user/cross-purpose/wrong-mode/wrong-payload/wrong-mapping proposal;
- recheck owner, allowlist, source age, destination state, cycle, and provenance;
- independent per-row transactions and partial failure;
- duplicate/concurrent confirm resumes or replays prior results without duplicate status writes;
- applied status/provenance/audit atomicity;
- newer decrease/refund and completion clear;
- mapping saved only after confirmation;
- revalidation only after applied status rows.

### 13.4 Generated userscript/browser tests

Extend the deny-by-default synthetic harness:

- no provider read before manual scan and no website write from AMEX;
- one global Sync only after eligible latest V2 review;
- one mailbox, exact handoff tab, opaque locator only;
- metadata has two exact scopes and storage-only grants;
- handoff branch cannot construct provider code;
- sign-in-return simulation, query stripping, typed exact-origin handshake, single-use/expiry/replay/cancel cleanup;
- analytics, monitoring, alternate transports, popups beyond the one expected tab, iframes, unknown network, and service workers are denied/asserted;
- preview renders before confirm; no mutation before confirm;
- invented fixtures only and no sensitive storage/artifacts.

### 13.5 Migration/retention/static tests

- inspect schema/migration shape and null compatibility without a routine database command;
- verify old code tolerates additive nullable fields and new code fails closed on null;
- test dry-run backfill classification with invented records;
- test 90-day cleanup through pure/service mocks, not a real cron invocation;
- targeted Jest, strict TypeScript, targeted ESLint, userscript build/audits, synthetic E2E, structured parsing, sensitive scan, and `git diff --check`.

## 14. Operational Authorization Boundary

The implementation plan may list, but must not silently execute, these operations. Each needs separate explicit authorization and immediate target/action verification:

- Prisma migration generation;
- Prisma client generation;
- migration deployment;
- seed or catalog-key backfill execution;
- production build (`npm run build` can generate Prisma and attempt migration deployment);
- userscript installation/update;
- live authenticated AMEX scan;
- test-account preview;
- real cron invocation;
- any production confirmation/write or compensating write.

Synthetic tests, static parsing, targeted mocked tests, isolated userscript build, and `git diff --check` do not confer authorization for any listed operation.
