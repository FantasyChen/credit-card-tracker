# Sync reviewed AMEX benefits

## Goal

After local AMEX review, let the authenticated owner preview and explicitly confirm a narrowly allowlisted, exact-cycle synchronization into Perks Reminder without guessing mappings, double-counting usage, weakening browser authentication, or hiding overwrites and partial failures.

## Activation Preconditions

- `.trellis/tasks/07-22-amex-pre-sync-benefit-list` is accepted but currently `in_progress` and uncommitted. Stabilizing it, completing its checks, and committing it is a hard precondition to activating this child task.
- Activate this child only from that reviewed parent commit and only after separate user approval. Do not work around the parent gate by copying, stashing, resetting, or building on an uncommitted parent worktree.
- This task remains planning-only until those conditions are met.

## Requirements

### R1. Explicit reviewed flow and fail-closed modes

- Add one global **Sync** action after an explicit scan and local review; add no persistent per-card or per-benefit sync controls and never sync as part of scanning.
- Sync opens one exact top-level first-party handoff tab. The handoff first shows proposed, unchanged, and skipped rows plus every amount decrease/refund and completion change; only a separate confirmation may write.
- Support server modes `off`, `preview`, and `write`. Missing, invalid, or incomplete configuration means `off`.
- `preview` performs zero durable writes: no status, mapping, provenance, attempt, row-audit, or other Prisma create/update/upsert/delete/transaction operation. `write` is the only mode that enables confirmation.
- Confirmation is partial-success: each still-valid row is independent and returns `updated`, `unchanged`, `skipped`, or `failed` with a stable reason.

### R2. Narrow first writable allowlist

- The first writable allowlist contains only the American Express Platinum Card Lululemon and Resy concrete credit families for the exact current active cycle.
- Every other AMEX product, credit family, period, historical cycle, and future cycle remains review-only and is skipped with a stable reason.
- Determine “current” at server preview and again at confirmation. The strict source period must exactly equal one active destination cycle and occurrence; do not use title text, cadence inference, nearby dates, or fallback cycle creation.
- Only observations from the latest scan that are current and card-complete may enter the writable candidate set. The scan must still be within 30 minutes at confirmation.
- Stale-preserved, partial, failed, ambiguous, unsupported, enrollment-only, linking-only, unavailable, older-scan, V1-only, and expired observations stay reviewable but cannot write.

### R3. Normalized V2 source contract

- Introduce a strict, bounded `amex-benefits/2` normalized contract with stable catalog product and credit-family keys and a structured source period.
- A writable period is an explicitly observed, validated UTC date-only range. Free-form display period/title text cannot authorize a server mapping.
- V1 records may remain locally reviewable, but they must never be upgraded by title/period guessing or synchronized; a fresh V2 scan is required.
- The transport is a smaller strict projection of V2. It contains only fields required for freshness, exact mapping, compatible amount/completion derivation, proposal binding, and row results.
- Never transfer or persist raw AMEX responses, account tokens, source fingerprints, installation secrets, cookies, headers, credentials, session material, full account/card numbers, or arbitrary diagnostics.

### R4. Least-authority first-party handoff

- Use the same userscript identity on exactly the reviewed AMEX origin and exact Perks Reminder handoff path so both branches can access one Tampermonkey-private mailbox.
- The AMEX branch writes one cryptographically random, short-lived, single-use mailbox entry and opens the exact first-party handoff URL with only an opaque transfer locator.
- The handoff branch validates origin, exact pathname, transfer ID, nonce, version, schema, digest, size, and expiry before a typed exact-origin handshake; it never constructs the AMEX API client or scan UI.
- Delete the mailbox after acknowledged preview acceptance and on expiry, cancellation, malformed content, replay, timeout, or local clear-data.
- Preserve storage-only GM grants. Add no `@connect`, `GM.xmlHttpRequest`/`GM_xmlhttpRequest`, cookie grants, credentialed CORS, `SameSite` weakening, bearer handoff token, iframe, wildcard origin, or payload-in-URL fallback.
- If sign-in is required, return to the same exact handoff using only the opaque locator. Strip the transfer query immediately after safe mailbox acquisition and do not rely on opener continuity.

### R5. Authenticated exact mapping and authorization

- The first-party preview and confirmation routes authenticate with the existing server session before user-owned database access and derive `userId` only from that session.
- Require exact first-party `Origin` and same-origin Fetch Metadata, strict JSON/content-type/size/version bounds, and no CORS response.
- Automatic card mapping requires exactly one active user-owned destination with the same non-null stable product key and ending digits.
- Ambiguous or absent automatic matches remain skipped until the user explicitly selects a compatible owned card in the handoff. Save that manual exception only as part of confirmed write mode and remember it for later scans.
- A saved manual mapping must remain scoped to the authenticated user and source card and must still point to an active owned card with a compatible non-null product key. It cannot bypass the product/family/period allowlist.
- Destination benefit mapping requires non-null stable family and period keys and exactly one existing active `BenefitStatus` cycle/occurrence. Null, duplicate, conflicting, missing, or unbackfilled keys fail closed.

### R6. AMEX authority, completion, and replay safety

- For a fresh confirmed allowlisted row, AMEX is absolute authority over the destination `usedAmount` and completion state, including newer decreases/refunds and completion clearing. It does not silently alter `isNotUsable`.
- Write an absolute amount only from a valid compatible source amount. Never add to the current amount, infer zero, convert incompatible units, parse an amount from text, or use the destination maximum as source evidence.
- Completion is true only from an explicit recognized source completion or compatible source used/target evidence with used greater than or equal to target. Explicit incompletion or compatible used below target clears completion. Contradictory evidence fails closed.
- Preview shows exact before/after values. If destination state, ownership, mapping, allowlist, mode, scan age, or source provenance changes before confirmation, the affected row requires re-preview and is not written.
- Bind every proposal with HMAC to route purpose, authenticated user, normalized payload digest, selected manual mappings, before-state digest, mode, issued time, and expiry. Confirmation re-authenticates, revalidates, verifies the HMAC, and re-resolves current state.
- Use server-computed idempotency and source-observation identities. Equal observations are no-ops, older observations are stale replays, same-time conflicting observations fail closed, and newer observations may authoritatively increase or decrease.
- Apply each row in its own transaction so status, latest provenance, and audit outcome are atomic; concurrent duplicate confirmations cannot repeat a status write.

### R7. Additive persistence, retention, and rollback evidence

- Add nullable stable catalog keys to destination catalog/user-card and benefit records. Backfill only deterministic reviewed matches; unresolved or conflicting rows remain null and unwritable.
- Add Prisma models for saved card mappings, latest destination source provenance, sync attempts, and per-row audits. Do not repurpose `updatedAt`, mutable titles, or seed-recreated IDs as source identity.
- Per-row audit records preserve source version/time identity, destination IDs, disposition, and exact before/after `usedAmount`, `isCompleted`, `completedAt`, and `isNotUsable` for recovery review.
- Retain detailed row audits for 90 days and delete expired rows through the existing authorized `check-benefits` cron path. Keep only the latest destination provenance needed for attribution/replay defense and confirmed manual mappings.
- Schema rollout is additive and compatible with the old application. Rollback disables server write mode first, then rolls back application/userscript behavior while leaving additive schema unused; data compensation requires reviewed audits and must not overwrite a newer edit.

### R8. Privacy-safe telemetry and validation

- Suppress Google/Vercel/search analytics and automatic handoff error reporting on the exact handoff route before any transfer query can be observed.
- Strip query and fragment data from URLs in client/server monitoring and request logs; validate and sanitize monitoring input server-side. Never log mailbox/payload/proposal contents, ending digits, titles, amounts, mappings, cookies, headers, or raw provider data.
- Operational telemetry is limited to a server-generated attempt ID, server-owned destination IDs only when necessary, mode, aggregate counts, stable result codes, and duration.
- Routine tests use invented data and deny unknown network. Cover V2 parsing, source selection, handoff, auth, authorization, mapping, cycle resolution, proposal binding, preview/write separation, authority/decreases, completion clearing, stale replay, idempotency, concurrency, partial failure, audit retention, telemetry suppression, and rollback mode.

## Acceptance Criteria

- [ ] The parent pre-sync task is stabilized, checked, and committed before this child is activated; the child starts from that commit with explicit activation approval.
- [ ] One global Sync opens exactly one top-level first-party handoff, and no scan, card row, or benefit row writes implicitly.
- [ ] The same userscript identity bridges the two exact origins through one bounded single-use private mailbox with storage-only grants; no observation appears in a URL and sign-in can resume safely.
- [ ] The exact handoff route suppresses analytics/error reporting, strips the transfer query after acquisition, and monitoring/logging never retains query/fragment or transfer/source values.
- [ ] `off` is the default and denies preview/confirm; `preview` returns a complete summary with zero Prisma writes; only `write` plus explicit confirmation can mutate.
- [ ] Only V2 latest-scan, current, complete observations no older than 30 minutes are writable candidates; V1, stale, partial, failed, expired, prerequisite-only, unavailable, unsupported, and ambiguous rows fail closed.
- [ ] Only Platinum Lululemon and Resy rows whose structured source range exactly matches the single current active destination cycle/occurrence can be proposed; every other product/family/period is review-only.
- [ ] Card auto-mapping succeeds only for one owned active non-null product-key-plus-ending match; confirmed compatible manual exceptions are remembered without bypassing ownership or allowlists.
- [ ] Destination mapping uses non-null stable product/family/period keys and never server-side title or free-form period guessing; null/ambiguous backfills stay unwritable.
- [ ] HMAC proposals bind user, purpose, payload, selected mappings, before state, mode, and expiry; invalid, stale, replayed, cross-user, or changed-state confirms perform no affected-row write.
- [ ] Confirmed rows use absolute AMEX values and explicit completion rules, visibly support newer decreases/refunds and completion clearing, and never double-add.
- [ ] Each row is atomic and independent, concurrent retries are idempotent, and the result reports updated/unchanged/skipped/failed rows without rolling back unrelated successes.
- [ ] Additive mapping/provenance/attempt/audit persistence supports attribution and recovery; detailed row audits expire after 90 days through the existing cron while latest provenance and confirmed mappings persist.
- [ ] Automated synthetic tests cover all security, mapping, authority, replay, migration-compatibility, telemetry, retention, and partial-success requirements.

## Sanitized Pre-Sync Evidence

The only retained live evidence is aggregate: 16 stored groups, 15 currently checked, 28 eligible benefits, 16 Remaining, 12 Used, eight partial groups, one stale preserved group, seven current-complete groups, with Lululemon and Resy present. No identifiers, amounts, inferred live titles, payloads, session material, or broad account captures belong in this task.

## Separately Authorized Operational Actions

The following are not routine checks and require separate explicit authorization with target/action verification at execution time: Prisma migration generation, Prisma client generation, migration deployment, seed or backfill execution, production build, userscript installation/update, any live AMEX scan, any test-account preview, any cron invocation, and any production write. Authorization for one does not authorize another.

## Out of Scope

- Expanding writable scope beyond the two approved Platinum credit families and exact current cycle.
- Historical/future-cycle synchronization, fuzzy/title matching, period guessing, or auto-creation of destination cards/benefits/statuses.
- Automatic/background synchronization, AMEX enrollment/linking/redemption/payment mutation, or credential automation.
- Packaged-extension migration, direct cross-origin API transport, privileged userscript requests, cookie access, or browser-policy weakening.
- Destructive schema rollback or automated production compensation.
