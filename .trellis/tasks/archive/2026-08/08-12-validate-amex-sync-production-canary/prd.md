# Validate AMEX sync production canary

## Goal

Prove that the current AMEX userscript can safely read the owner's real AMEX account and synchronize reviewed benefit usage to the owner's production Perks Reminder account without duplicate cards, duplicate destination rows, cross-card writes, stale-proposal writes, or repeated mutations.

## Background

- The production category-drift repair completed across the full reviewed inventory, preserved canonical keeper state, removed only reviewed duplicate occurrences, and left AMEX effectively `off`.
- The production application, additive schema, global catalog, legacy bridge, category-repair authority, preview/confirmation implementation, and synthetic tests are deployed, but AMEX preview/write was not reactivated after repair.
- The production userscript source was version `0.5.1` before the transfer-URL activation fix. Live validation of `0.5.2` then found that production also needed the same page-realm `unsafeWindow` bridge already used locally; the reviewed replacement is monotonic version `0.5.3`. Any installed version and metadata must be verified before use. Installation/update, provider scan, preview reactivation, and confirmation are separate consequential boundaries.
- The owner has authorized task creation and an attended live read-only scan using the owner's signed-in AMEX session. No raw provider response, cookie, token, account identifier, card ending, or private row value may enter task artifacts, logs, or chat.

## Requirements

1. Re-run the generated production/local userscript bundle checks and deterministic synthetic E2E suite before live provider access. The suite must cover multiple primary cards, nested supplementary exclusion, repeated product names, duplicate source-credit exclusion, partial/failure/stale preservation, cancellation, reload without autoscan, visible-context changes, filters, forbidden transports/origins, strict handoff integrity, and zero network fallback.
2. Re-run focused server tests for exact-five physical-card resolution, zero/duplicate destination-card skips, exact global destination authority, active category-repair authority, duplicate source credit/period exclusion, not-usable skips, stale proposal rejection, completed-attempt replay, partial retry, amount increase/decrease/zero, completion set/clear, omitted fields, December Uber atomicity, and audit/provenance atomicity.
3. Before any production configuration or account action, independently verify the exact Ready production deployment and primary alias, application/database target identity where required, current migration state, effective AMEX mode, recovery readiness, and the absence of a conflicting repair/cleanup operation. Never read or create `.env`.
4. Build and audit the exact production userscript. Inspect the currently installed script only through its bounded installer metadata. Update only if name, namespace, match scope, grants, and monotonic version transition match the reviewed artifact; do not broaden permissions or modify any other script.
5. On the signed-in AMEX page, prove exactly one idle reader mounts before scanning. A manual attended scan may read only the named first-party endpoints through the current browser session, must exclude supplementary cards, must preserve distinct physical cards, and must emit only normalized V3 observations.
6. Run two consecutive live scans before confirmation. Compare only sanitized aggregates and stable normalized identity: discovered/attempted/succeeded/partial/failed counts, per-product physical-card multiplicity, admitted benefit counts, issue-code counts, duplicate/conflict counts, and proposal/unchanged/skip counts. No unexplained drift or duplicate physical-card/credit-period group may proceed.
7. Reactivate production to `preview` only through a separately verified configuration/deployment/alias gate. Preview is authenticated, owner-scoped, and zero-write. Verify proposal destinations use exact last five, owned physical card, global product/benefit, exact cycle occurrence, and active repair or strict-standard authority.
8. A production write requires a separate action-time approval after the sanitized preview is presented. If approved, activate `write` through the reviewed gate and confirm at most one fresh bounded proposal. Never confirm a proposal created in preview mode or before a configuration/data/card edit.
9. After any confirmation, prove exact expected status/audit/provenance deltas, no unrelated owner-row changes, and no new duplicate destination occurrence. Re-submit/replay the completed attempt and run a fresh scan/preview; require idempotent durable results and zero repeated mutation.
10. Stop and return AMEX effectively `off` on any target, deployment, mode, installation, session, visible-context, parsing, identity, duplicate, period, state, audit, provenance, proposal, compare-and-set, or privacy mismatch. Do not compensate automatically.
11. Keep strict legacy cleanup, category-repair rollback/evidence deletion, provider mutations, enrollment/activation/linking, other accounts, and catalog/schema changes outside this task.

## Acceptance Criteria

- [x] The scoped synthetic browser suite and focused AMEX server tests pass with no live network or database access.
- [x] The installed production userscript is proven to match the audited monotonic artifact metadata and mounts exactly once while idle.
- [x] Two attended real-account scans complete without raw/private evidence leakage, unexplained drift, duplicate physical-card collapse, or duplicate source-credit/period candidates.
- [x] Production preview is reactivated only after exact deployment/alias/target/recovery verification and produces a sanitized, zero-write, owner-scoped result.
- [x] Every proposed row resolves to exactly one owned card by exact last five and one authorized global status occurrence; ambiguous, missing, not-usable, duplicate, partial, stale, or unsupported inputs remain skipped.
- [x] The user receives the sanitized preview and explicitly approves or declines the first production confirmation.
- [x] If approved, exactly one fresh bounded proposal is confirmed; expected status, audit, and provenance deltas occur atomically and no unrelated or duplicate row is created.
- [x] Replay plus a fresh scan/preview is idempotent: no repeated write, duplicate occurrence, or stale proposal use occurs.
- [x] AMEX ends effectively `off` unless the user separately chooses to retain an active mode after reviewing final evidence.
- [x] All operational outcomes are recorded as passed, failed, blocked, or skipped using sanitized aggregates only.

## Out of Scope

- Creating artificial corner cases in the owner's production account or AMEX account.
- Reading or storing credentials, cookies, authorization headers, opaque account tokens, raw provider responses, full account numbers, or provider request metadata.
- AMEX enrollment, linking, offer activation, redemption, payments, or any provider mutation.
- Database repair, rollback, cleanup, migration, schema/catalog changes, or testing another user's data.
