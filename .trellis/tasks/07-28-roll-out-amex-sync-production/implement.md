# Implementation Plan — Global-benefit normalization and production gate

## Operating Rules

- This parent coordinates children and production gates; it does not own application code.
- Keep production AMEX effectively `off` through children 1–4 and every unapproved child-5 boundary.
- Do not run the old `backfill:amex-catalog --apply`. Its per-user key writes are superseded even for the formerly accepted strict partial subset.
- Database, deployment, configuration, userscript, provider, live-browser, and git-history actions require their own authorization and target verification.

## 1. Planning restructure

- [x] Replace the former AMEX production rollout requirements with the global-benefit normalization authority.
- [x] Define the five child deliverables and explicit dependency order.
- [x] Plan each complex child with PRD, design, execution plan, and curated context manifests.
- [x] Preserve historical sanitized evidence while labeling it non-authorizing and inapplicable as the new apply plan.
- [x] Leave children in planning until implementation was separately started; only children 1–4 later entered `in_progress`.

## 2. Child execution status

### Child 1 — Global catalog foundation

- [x] Add explicit catalog identities, additive relations/indexes/ledger, retirement, validation, and key-based synchronization.
- [x] Add and statically review the checked-in additive migration SQL without a database operation.
- [x] Generate/apply/validate the migration and catalog synchronization on a verified development target.

### Child 2 — Global benefit runtime

- [x] Add standard-status materialization, transactional card creation, hybrid projection, custom ownership, and read-only standard behavior.
- [x] Prove with static/unit tests that catalog additions can reach existing active cards without status/cycle rewrites.
- [x] Validate runtime materialization, propagation, and parity on the migrated development database.

### Child 3 — Legacy global-benefit migration

- [x] Build the exact/full-shape classifier and bounded dry-run-first bridge operator.
- [x] Preserve custom/unresolved rows and all existing status/audit/provenance fields in implementation and injected-repository tests.
- [x] Disable the old per-user key apply with a stable superseded message.
- [x] Keep cleanup as a distinct ledger-proven mode and gate.
- [x] Execute deterministic dry-run, bridge apply, exact preservation verification, and idempotent rerun on the verified development database.
- [x] Rehearse pre-cleanup rollback and exact re-bridge with preservation checks on the verified development database.
- [ ] Run separately gated cleanup only after its deletion/recovery boundary is independently approved — not run.

### Child 4 — AMEX global-definition authority

- [x] Resolve products and destinations only through owned physical-card/global-definition/standard-status relations.
- [x] Preserve proposal, transaction revalidation, audit/provenance, response, and userscript contracts in static/unit verification.
- [x] Keep production mode off and use invented/injected test data only.
- [x] Perform synthetic verified-development preview/confirmation, replay, and exact-last-five operational validation.

### Child 5 — Production global-benefit rollout

- [x] Reverify all development evidence and define production recovery/stop conditions.
- [x] Obtain and record separate approvals for the completed production schema, catalog, and legacy-bridge boundaries.
- [ ] Keep cleanup, application deployment, preview, userscript, live-provider, and write boundaries independently unapproved until each receives its own later decision.
- [x] Generate fresh sanitized evidence from the new operators; do not reuse historical counts as acceptance evidence.

## 3. Cross-child integration review

- [x] Catalog keys and global relation semantics agree across source, schema, seed, runtime, migration, clone, and AMEX registry.
- [x] Effective projection gives compatible DTOs for global standard, bridge, standalone custom, and card-linked custom records.
- [x] New-definition propagation, retirement, and latest-term display behavior satisfy the implementation contracts in static/unit coverage.
- [x] Existing status identity, cycles, usage, completion, usability, timestamps, audit, and provenance remain unchanged by definition synchronization and bridge metadata in injected-repository tests.
- [x] Global standard definitions have no user mutation/override path.
- [x] Public anonymous catalog surfaces remain database-free.
- [x] Strict TypeScript, full Jest, changed-source lint, public DB, card-template, userscript, safe usage-guide source/link, JSON/JSONL/Markdown-link, sensitive-pattern, package-context, and diff checks passed without using the production-affecting build command.

### Recorded full-scope verification

- Full Jest passed: **74 suites**, **594 tests passed**, **1 test skipped**.
- `npx tsc --noEmit --pretty false --incremental false` passed.
- ESLint passed for every changed source file.
- `npm run check:public-db`, `npm run card-template:validate`, and `npm run check:amex-userscripts` passed.
- Safe usage-guide source/link consistency, JSON and JSONL parsing, Markdown-link validation, sensitive-pattern review, package-context discovery, and `git diff --check` passed.
- No sensitive value, provider/session payload, database identity, user identity, or record value was added to this evidence.

### Recorded verified-development evidence

- The additive migration applied to the verified development target; Prisma schema validation, generation, and migration status passed.
- Catalog bootstrap diagnosis proved all 56 former conflicts were unique canonical matches missing only newly introduced provider identity. The guarded dry-run then produced 34 card and 129 benefit adoptions, zero creates, and zero conflicts; apply preserved IDs, and rerun reported all 34/129 definitions unchanged.
- The bounded legacy dry-run examined 15 units and 110 benefits: 104 standard, 6 custom, zero unresolved, and zero blocked. Bridge apply preserved every pre-existing status/audit/provenance value and count outside approved metadata; all 110 classifications replayed idempotently.
- Synthetic card creation linked standard status directly to global definitions, created no copied standard `Benefit`, and created the opening event. A later global definition propagated to an existing active card; retirement stopped active materialization while preserving its status history.
- Synthetic AMEX preview proposed one exact global destination; confirmation updated one standard status and durable replay was idempotent. A card without exactly five stored digits produced no proposal and one prerequisite skip.
- Every synthetic validation record was removed. Pre-cleanup rollback and exact re-bridge preserved all unrelated state. Production was not accessed or modified and remained effectively off. Cleanup was not run.

### Six final full-scope fixes

1. Notification digests were moved to the effective global/custom projection and dynamic user/card/benefit text is escaped before email HTML rendering.
2. Effective projection now uses migration classification so only proven custom definitions are mutable; global, bridge, proven-standard, and unresolved legacy definitions stay read-only.
3. Custom-definition update/delete actions now require authenticated ownership plus custom-only capability, reject standard/bridge rows, use scoped writes, and revalidate only after success.
4. Legacy classification now handles custom-only card-linked definitions and card-only AMEX audits without converting those audits into benefit destinations; only exact operator-recorded reruns are accepted.
5. The Prisma migration adapter now enforces relation compare-and-set and post-write preservation checks across bridge, cleanup, and rollback, records custom classifications without status/audit rewrites, and keeps exact rollback idempotent.
6. AMEX confirmation now revalidates the complete physical/global/status graph with transaction-loaded exact cycle instants; already-current provenance and durable completed/completion-race replay are handled atomically without weakening December grouping.

## 4. Historical evidence ledger — not the new apply plan

The following sanitized evidence is retained from the superseded rollout and remains documented in `research/production-backfill-review.md`:

- On 2026-07-29, read-only checks identified the intended Vercel project/deployment and reported all then-checked migrations applied; production AMEX mode/key names were absent, so capability was effectively `off`.
- The former per-user AMEX key operator completed five dry-run pages: 1,126 card-key proposals, 7,076 benefit-key proposals, and 2,739 retained conflicts, with zero writes.
- A read-only projection for that former writer found 6,759 desired and existing status tuples and zero missing rows, plus a bounded 22-row anniversary diagnostic.
- Production/local userscript builds, metadata authority checks, and 13 synthetic generated-bundle tests passed; no userscript was installed or published and no live scan occurred.
- Temporary production environment/report material was removed and no production mutation, configuration, deployment, browser action, or provider call occurred.

**Superseded conclusion:** The prior strict-partial policy was not apply authorization, and its apply path is canceled. These counts concern duplicated per-user definitions and cannot authorize or validate global catalog synchronization, legacy bridge migration, cleanup, preview, or write mode. Every operational count and target check must be regenerated under child 5.

## 5. Operational gate record

- [x] Prisma validation/generation, additive migration status/deploy, and database-backed validation completed on the verified development target.
- [x] Verified development catalog synchronization, runtime propagation, legacy bridge/preservation/replay, and synthetic AMEX preview/confirmation completed.
- [x] Pre-cleanup rollback and exact re-bridge rehearsal completed with preservation checks.
- [x] Separately authorized production target/recovery, additive schema, global-catalog, legacy-bridge, preservation, hybrid-parity, and idempotent-replay gates completed with sanitized evidence.
- [ ] Separately gated production cleanup — not run.
- [ ] Main release, rollout-authorized application deployment, and production configuration change — not performed; provider Preview state from the review branch is not claimed as rollout evidence.
- [ ] Browser/live provider scan or userscript installation/publication — not run.
- [ ] Production preview or write activation — not performed; AMEX remains effectively `off`.

## 6. Parent completion gate

- [x] Children 1, 2, and 4 have verified development evidence and are eligible for completion/archive.
- [ ] Child 3 remains pending only the separately gated cleanup deletion/recovery boundary.
- [x] Child 5 records fresh development and completed production schema/catalog/bridge evidence without reusing historical per-user-key counts.
- [ ] Child 5 remains `in_progress` pending release deployment, optional cleanup, preview, userscript/live-provider, write, and rollback-window boundaries.
- [x] Production AMEX remained effectively `off` throughout the completed production database gates.
- [ ] Legacy columns/ledger retention and any future removal are handed to a separate rollback-window task after rollout evidence exists.

## Current status

Development validation and the separately authorized production target/recovery, additive schema, global catalog, exact legacy bridge, preservation, hybrid-parity, and idempotent-replay gates have passed. The parent remains `in_progress`; production AMEX remains effectively `off`. The next boundary is merging the reviewed release through the approved path and verifying its automatic deployment while retaining `off`, followed by read-only smoke tests. Cleanup, preview, userscript/provider activity, write activation, and rollback-window removal remain independent later gates.
