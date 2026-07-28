# Implementation Plan: Sync reviewed AMEX benefits

## Preconditions and Stop Conditions

- [x] Do not activate or implement this child while `.trellis/tasks/07-22-amex-pre-sync-benefit-list` remains uncommitted or `in_progress`.
- [x] Stabilize and check the accepted parent, commit it, and verify this child starts from that exact reviewed commit.
- [x] Obtain explicit approval to activate this child, then run `trellis-before-dev` and load every curated `implement.jsonl` entry.
- [x] Re-read `prd.md`, `design.md`, all child research, and current repository specs/source because the prepared references describe the 2026-07-22 planning baseline.
- [x] Confirm the working tree has no unrelated or parent changes. Do not stash/reset/copy around the parent gate.
- [x] Confirm default server mode is `off` before exposing any new route or userscript behavior.

Stop and return to planning if implementation would require a broader writable product/family/period, title or period guessing, privileged userscript transport, cookie/CORS weakening, provider mutation, iframe, payload in URL, raw provider persistence, or an unreviewed production/data operation.

## Separately Authorized Operations

Do not treat any item below as a routine check. Record separate explicit authorization and verify the exact target/action immediately before each execution:

- Prisma migration generation;
- Prisma client generation;
- migration deployment;
- seed or catalog-key backfill execution;
- production build;
- userscript installation/update;
- live AMEX scan;
- test-account preview;
- real cron invocation;
- any production write or compensating write.

Authorization for one item does not authorize another. In particular, do not run `npm run build`: it invokes Prisma generation and can attempt migration deployment.

## Ordered Checklist

### 1. Baseline and contract tests

- [x] Inspect the committed parent V1 contract/storage/panel/scan behavior and record the exact targeted test baseline.
- [x] Add failing pure tests for `amex-benefits/2`, stable product/family keys, strict UTC date-only source ranges, scan identity, and forbidden/unknown fields.
- [x] Add tests proving impossible/reversed/free-form periods fail and V1 remains review-only rather than guessed into V2.
- [x] Add tests for latest-scan, current, card-complete selection and the 30-minute confirmation deadline using an injected clock.
- [x] Add transport-envelope tests for canonical digest, card/row/string/byte limits, exact fields, and forbidden sensitive names.

**Gate:** failing tests express V2 without altering V1 data or enabling synchronization.

### 2. Emit and store normalized V2

- [x] Promote reviewed matcher product/family keys into the normalized adapter output; keep one shared finite catalog vocabulary.
- [x] Add strict structured source-period extraction only for characterized provider fields. Do not parse titles or infer the current quarter/cadence.
- [x] Tie card observations to a random local scan ID and latest completed scan summary.
- [x] Version the local schema/migration so compatible V1 observations remain reviewable but unwritable until a fresh V2 scan.
- [x] Build a smaller strict sync projection from latest current-complete V2 card observations; preserve bounded local skip counts for the handoff summary.
- [x] Keep installation fingerprint/secret, raw error text, responses, tokens, headers, and session material outside V2 transport.

**Validation:** targeted adapter/contract/storage/scan tests pass; existing manual-start and stale-preservation tests remain green.

### 3. Stable destination catalog keys and additive schema

- [x] Add stable nullable product keys to persistent card templates and user cards.
- [x] Add stable nullable product/family/period keys to persistent benefit templates and user benefits.
- [x] Update the shared static AMEX catalog and card-copy path so new user records retain the same stable keys.
- [x] Add Prisma models/relations/indexes for confirmed external card mappings, latest status source provenance, sync attempts, and per-row audits.
- [x] Define source/mapping/result enums without conflating AMEX with all automation.
- [x] Ensure deletion/cascade behavior cannot leave an orphan mapping that authorizes a write.
- [x] Implement a fail-closed backfill classifier with dry-run aggregate output; unresolved, duplicate, edited, or conflicting records remain null.
- [x] Keep existing `BenefitStatus` values and existing manual rows untouched.

**Authorization gate:** editing/reviewing schema and migration design does not authorize Prisma migration generation, Prisma client generation, deployment, seed, or backfill execution. Obtain separate authorization before each needed command.

**Migration review gate:** inspect generated SQL, when separately authorized, for destructive statements, table rewrites, non-null additions, existing-data conflicts, indexes, and cascades. Never use reset/force-reset to bypass the known replay-order problem.

### 4. Pure mapping and authority service

- [x] Implement one finite server allowlist containing only the stable Platinum product key and Lululemon/Resy family keys.
- [x] Implement automatic card resolution as exactly one active owned non-null product-key-plus-ending match.
- [x] Validate saved/manual mapping ownership, active destination, product compatibility, and source-card scope; never let a mapping bypass the allowlist.
- [x] Resolve benefit/period/cycle/occurrence only through non-null stable keys plus exact structured range and one existing current `BenefitStatus`.
- [x] Skip null/duplicate/missing/historical/future/unmaterialized destinations; do not create a status in sync.
- [x] Implement decimal-compatible absolute amount and completion derivation without additive transitions or inferred zero.
- [x] Cover explicit complete/incomplete, compatible used-at-target, below-target clearing, newer decreases/refunds, contradictory evidence, and destination not-usable skip.
- [x] Implement source freshness ordering: older stale, equal digest unchanged, same-time/different-digest conflict, newer eligible.
- [x] Generate deterministic source-row, source-observation, payload, before-state, and idempotency identities from canonical validated data.

**Gate:** pure tests prove all unallowlisted or ambiguous inputs fail closed and the approved rows can resolve only to one exact active cycle.

### 5. Server mode and HMAC proposal boundary

- [x] Add a server-only `off | preview | write` resolver; absent/invalid/incomplete settings return `off`.
- [x] Add exact same-origin request guards for session-first auth, method, JSON media type, Origin, Fetch Metadata, byte limits, strict schema, and forbidden fields.
- [x] Implement preview as reads plus pure projection only. Assert it cannot call any write delegate, raw write, transaction, revalidation, attempt/audit/provenance creation, or mapping save.
- [x] Return one proposed/unchanged/skipped result per input row, exact before/after values, overwrite/decrease/completion flags, and stable reason codes.
- [x] Re-preview whenever a proposed manual mapping changes; never save it during preview.
- [x] Sign a short-lived HMAC proposal bound to purpose, authenticated user, effective mode, envelope digest, selected mapping digest, ordered plan/before-state digest, source identities, issue time, and expiry.
- [x] Verify HMAC with constant-time comparison. Keep the key server-only and require normal session/ownership checks in addition to the token.

**Validation:** route tests prove `off` rejects, `preview` has zero Prisma writes, and cross-user/purpose/payload/mapping/state/expiry changes invalidate the proposal.

### 6. Confirmation, idempotency, and partial success

- [x] Require effective `write` mode and a separate explicit confirmation request.
- [x] Re-authenticate, revalidate, recheck source age, verify HMAC/digests, and re-resolve ownership/mappings/allowlist/cycle/current state/provenance.
- [x] Return `conflict_repreview_required` for affected changed rows without writing them.
- [x] Create or resume a server-computed idempotent attempt under a unique user/idempotency key.
- [x] Process each accepted row independently in its own transaction.
- [x] Atomically update the owned status, latest source provenance, and row audit for an applied row.
- [x] Save a confirmed manual mapping only in write mode after server ownership/compatibility revalidation.
- [x] Store bounded skipped/failed row outcomes without raw exceptions or payloads.
- [x] Resume/replay concurrent duplicate confirmation without applying a status twice.
- [x] Revalidate `/`, `/benefits`, and any other demonstrated affected server route only when at least one status is applied.

**Gate:** mocked tests cover applied, unchanged, skipped, failed, partial success, persistence failure, concurrent duplicate, stale/equal/new source, decrease, completion clear, and no false success/revalidation.

### 7. Exact first-party handoff UI

- [x] Add the exact authenticated `/integrations/amex-sync` handoff with signed-out return, waiting, invalid/expired/consumed, mapping-required, preview, confirmation, and result states.
- [x] Load mapping choices from user-scoped server data; never trust client card labels or ownership.
- [x] Show proposed, unchanged, and skipped rows and make every overwrite/decrease/refund/completion set/clear visible.
- [x] Disable confirmation outside `write` mode and expose the effective preview-only/off state clearly.
- [x] Use semantic headings, lists, controls, accessible names, focus handling, pending states, and errors.
- [x] Keep normalized envelope/proposal in memory only; do not place it in URL, DOM attributes, analytics, localStorage, or monitoring.
- [x] Mark the route private/no-store/noindex/non-frameable with no service-worker caching.

**Validation:** component/route tests cover auth return, all UI states, mapping re-preview, separate confirmation, accessibility, and no write before confirmation.

### 8. Same-identity private mailbox bridge

- [x] Add only the exact first-party handoff match to the existing userscript identity; retain `@noframes` and storage-only GM grants.
- [x] Branch by exact origin/path before constructing AMEX reader or handoff dependencies.
- [x] Add one fixed GM mailbox slot with random transfer ID/nonce, strict envelope/digest/version, short TTL, and one-entry bounds.
- [x] Open exactly one top-level handoff tab from the direct Sync gesture with only the opaque locator.
- [x] Implement exact-origin/type/source/nonce/transfer validation and acknowledgement.
- [x] Strip the transfer query with `history.replaceState` immediately after safe acquisition.
- [x] Delete the mailbox on accepted preview, expiry, malformed data, cancellation, timeout, replay, and clear-data.
- [x] Support sign-in-return without opener continuity and fail closed after consumption.
- [x] Add no `@connect`, privileged request/cookie grant, credentialed CORS, SameSite change, iframe, wildcard messaging, clipboard, page storage, or payload URL fallback.

**Validation:** source/artifact metadata audits and generated-bundle browser tests prove the exact two branches, one mailbox, one expected tab, no provider code on handoff, and no alternate transport.

### 9. Analytics, monitoring, and log sanitation

- [x] Refactor telemetry loading so Google Analytics, Vercel Analytics, search analytics, and automatic global error reporting do not load on the exact handoff route before query cleanup.
- [x] Make client monitoring serialize origin+pathname only.
- [x] Make the monitoring endpoint re-parse and sanitize client URL and referer; replace malformed values with a constant redaction.
- [x] Remove query logging for the handoff and use a shared query/fragment-free URL projection where request logging applies.
- [x] Keep sync operational logs to mode, server-generated attempt ID, aggregate counts, stable codes, duration, and only necessary server-owned destination IDs.
- [x] Prohibit payload/proposal/mailbox content, titles, ending digits, amounts, mappings, cookies, headers, and raw errors in logs.

**Validation:** unit/component/browser tests prove the opaque locator and source values never reach analytics requests, monitoring bodies, console records, request logs, screenshots, traces, or test artifacts.

### 10. Audit retention and rollback controls

- [x] Extend the existing `check-benefits` cron service with bounded deletion of row audits older than 90 days and consistent attempt-detail cleanup.
- [x] Keep latest destination provenance and confirmed mappings.
- [x] Inject time and test the exact cutoff using mocked Prisma; do not invoke a real cron as routine validation.
- [x] Prove mode `off` immediately blocks confirmation even for an old userscript/page/proposal.
- [x] Add mapping deactivation and reviewed compensation support that refuses to overwrite a newer manual/AMEX edit.
- [x] Document operational rollback in release notes/output, not a new repository documentation file unless explicitly requested.

**Gate:** retention tests pass and application rollback works while additive schema remains present.

### 11. Synthetic integration and static verification

- [x] Extend invented userscript fixtures for V2 and the two approved family keys without using live values.
- [x] Keep catch-all network denial installed before navigation; permit only invented AMEX reads, the exact synthetic handoff document, and exact same-origin preview/confirm routes.
- [x] Test scan-review-Sync-mailbox-handoff-preview-confirm end to end in `off`, `preview`, and `write` harness modes.
- [x] Test expiry, malformed mailbox, replay, sign-in return, mapping re-preview, changed-state conflict, partial row failure, and retry.
- [x] Audit built metadata for exact scopes, storage-only grants, no remote update metadata, and no privileged/cross-origin transport.
- [x] Scan changed source/build/test output for forbidden fields and sensitive values.
- [x] Parse JSON/JSONL/config/schema/migration SQL as applicable and run `git diff --check`.

## Routine Validation Commands

Choose the exact changed test files; expected safe commands include:

```bash
npx jest --runInBand <targeted V2 contract/storage/adapter tests>
npx jest --runInBand <targeted mapping/authority/proposal tests>
npx jest --runInBand <targeted preview/confirm route tests>
npx jest --runInBand <targeted handoff/panel/telemetry/retention tests>
npx tsc --noEmit --pretty false --incremental false
npx eslint <changed source and test files>
npm run build:amex-userscript
npm run test:e2e:amex
python3 ./.trellis/scripts/task.py validate .trellis/tasks/07-22-sync-reviewed-amex-benefits
git diff --check
```

The isolated userscript build is not userscript installation and grants no permission for a live scan. Do not run the general production build or any Prisma/database/cron/live command as routine validation.

## Optional Operational Gates After Automated Checks

Each unchecked item remains skipped until separately authorized:

- [x] Generate the migration against the verified `DATABASE_URL_DEV` target and review SQL before any apply. *(Created additively via `prisma migrate diff` after the known shadow-replay defect blocked `migrate dev --create-only`; no migration was applied.)*
- [x] Generate Prisma client under separate authorization. *(Generated locally; no migration deployment or data write.)*
- [ ] Apply migration to a verified development target and prove existing manual statuses unchanged. *(Skipped: separate target-specific authorization required.)*
- [ ] Run backfill dry-run, then separately authorize any backfill write. *(Skipped: separate data-operation authorization required.)*
- [ ] Install an exact monotonic userscript update through the approved Tampermonkey workflow. *(Skipped: separate browser action authorization required.)*
- [ ] Perform a bounded owner-authorized live AMEX scan after manual login. *(Skipped: separate live-read authorization required.)*
- [ ] Perform a separately authorized test-account preview and prove zero durable writes. *(Skipped: separate authenticated preview authorization required.)*
- [ ] Run a separately authorized production build/deploy sequence. *(Skipped: separate production authorization required.)*
- [ ] Enable production `write` mode and perform any production confirmation only with explicit action-time authorization. *(Skipped: separate production-write authorization required.)*

## Final Review

- [x] Re-read the PRD/design and trace every acceptance criterion to tests or a truthfully skipped operational gate.
- [x] Confirm the writable allowlist contains only the two approved Platinum families and exact current cycle.
- [x] Confirm no server title/period guessing, V1 upgrade guessing, privileged transport, browser-policy weakening, iframe, analytics leak, or implicit write exists.
- [x] Confirm preview has zero Prisma writes and missing/invalid configuration defaults to `off`.
- [x] Confirm every status write is owned, exact-cycle, HMAC-bound, idempotent, provenance-protected, independently transactional, and audited.
- [x] Confirm migration/backfill/rollback preserve existing data and null catalog keys fail closed.
- [x] Inspect the complete diff and all untracked paths, run `trellis-check`, and report every operational action as passed, failed, or skipped rather than implying authorization.
- [x] Do not commit or deploy unless separately asked. *(Local batched commits explicitly confirmed; deployment remains unauthorized.)*
