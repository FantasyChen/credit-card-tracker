# Implementation Plan — Production category-drift repair

## Preconditions

- [x] Category-repair implementation and additive migration are reviewed and checked in.
- [x] Full static/unit verification passed after the final implementation changes.
- [x] A second isolated-development migration and full apply/replay/rollback/reapply rehearsal passed.
- [x] Production serves the schema-compatible deployment and authenticated preview returns fail-closed `503`, proving effective AMEX `off`.
- [x] The final planning summary is approved and the task is started before implementation or production work.

## 1. Implement the missing parity evidence boundary

- [x] Add a pure parity model/comparator for private pre-apply baselines and post-apply graph snapshots.
- [x] Add a thin production operator with `capture` and `verify` modes, exact target gate, exclusive `0600` baseline creation, no overwrite, and aggregate-only serialization.
- [x] Bind all reviewed manifests/pages, keeper protected state, loser preimages, repair authority, relevant audit/provenance, table counts, and unrelated-row digests.
- [x] Reject malformed/private baseline drift, missing manifest coverage, invalid evidence, unexpected allowed-delta shape, and any output that could expose private authority or row data.
- [x] Add package script and focused mocked tests; do not connect to a database during implementation verification.

### Static verification for section 1

```text
npm test -- --runInBand <new parity verifier tests> <affected category-repair tests>
npx tsc --noEmit --pretty false --incremental false
npx eslint <changed TypeScript files>
npm run check:public-db
python3 ./.trellis/scripts/get_context.py --mode packages
git diff --check
```

Section 1 evidence: focused parity tests (11 passed) plus Prisma adapter parity
regressions (2 passed), affected category-repair tests (119 passed), strict
TypeScript (passed), changed-source ESLint (passed), public DB invariant (passed),
package context (passed), and `git diff --check` (passed).

The parity boundary now accepts an optional private `--scope-manifest` selector,
but always validates the complete ordered manifest bundle first. A selected page
is bound by its bundle index and page/manifest fingerprints; selectors outside the
bundle, duplicate selectors, incomplete bundles, cross-page snapshots, and a
page-scoped baseline verified with a different page are rejected before any
database adapter read. Page baselines persist their scope authority. Aggregate
counts retain complete-table semantics for immutable baseline compatibility, while
the unrelated digest excludes the baseline's reviewed mutable graph. After a
cumulative rollout, a selected page may be verified from the original complete
baseline: page actions/state remain page-specific while other exact bundle-covered
page deltas are allowed and unmanifested rows remain unrelated.

The parity adapter reads the complete graph and table aggregates inside one
repeatable-read transaction. It returns only counts and database-side digests;
it does not materialize table rows, credential/card-number columns, or private
authority values in the operator report. Target verification is checked before
the transaction is opened, and malformed manifests are rejected before the
database client is loaded.
Database, Prisma, build, deployment, browser, provider, and production operations
were not run.

Prisma generation/status/migration, build, deployment, database-backed verifier
modes, browser checks, and provider commands are skipped until their own gates.

## 2. Re-establish the production hold and recovery boundary

- [x] Reconfirm the primary alias still returns the exact authenticated fail-closed AMEX-off behavior with no write.
- [x] Verify the exact production provider project/branch and create a fresh no-compute recovery branch from that parent.
- [x] Privately record only recovery-parent equality and readiness booleans; expose no identifiers.
- [x] Immediately verify production pooled/application and direct/migration identities match the reviewed target.

Preflight evidence (2026-08-06): the production alias is Ready, targets the
reviewed production project, and resolves to the same immutable deployment ID.
Production database environment-variable names remain registered. Neon CLI
authentication is valid and the reviewed production endpoint resolves uniquely to
one Ready default/primary branch. The first no-compute recovery creation was
rejected before creation because the project branch limit was full. After separate
authorization, the unique existing recovery-labeled production child was rechecked
as non-default, non-primary, unprotected, childless, zero-compute, and seven to
fourteen days old; it was deleted, and a fresh replacement was created. Independent
provider reads prove the replacement is Ready, is parented to the exact production
branch, remains non-default/non-primary/unprotected, and has zero compute time.

Fresh authenticated AMEX-off proof passed when the owner issued the exact signed-in
preview POST and observed HTTP `503` with `sync_off`. Independently generated direct
and pooled provider connection authorities both connected read-only, returned the
same database/schema/branch identity, and matched the reviewed production branch.
No environment file was read or created, and no schema or user-data operation ran.

**Stop:** uncertain/stale AMEX mode, alias mismatch, target mismatch, missing recovery,
or any unexpected scoped write.

## 3. Apply the additive production migration

- [x] Prepare a private isolated workspace containing only copied `prisma/schema.prisma` and `prisma/migrations`, with no `.env` or `.env.*` file.
- [x] Invoke the already-installed Prisma binary with process-supplied production application/direct URLs; never run Prisma from the repository root.
- [x] Reverify target/recovery immediately, then run only `migrate deploy` for the reviewed additive history.
- [x] Independently run migration status and table-existence checks from the isolated workspace.
- [x] Confirm no migration other than the category-repair additive migration was newly applied.

Production migration evidence (2026-08-06): immediately before deployment, the
Ready recovery branch, production alias/immutable deployment equality, and matching
direct/pooled database identity were reverified. The isolated workspace contained
only copied schema/migration history and no dotenv file. Database migration history
showed exactly one pending source migration: the reviewed additive category-repair
migration, with zero failed migrations. `migrate deploy` applied it. A local result
serialization error occurred after the command, so deployment was not retried;
independent read-only verification instead proved the migration finished, migration
status is up to date, both repair tables exist and contain zero rows, and no failed
migration remains. Prisma reported no dotenv loading. No repair discovery or data
write ran.

**Stop:** target drift, unexpected pending/applied migration, destructive SQL, missing
table, schema divergence, or Prisma dotenv interaction.

## 4. Release the schema-dependent application

- [x] Release only the reviewed category-repair application revision after section 3 passes.
- [x] Require the immutable deployment to reach Ready.
- [x] Inspect the immutable deployment and primary alias; require exact deployment-ID equality.
- [x] Verify anonymous public availability and one narrow authenticated repair-table-backed read.
- [x] Reconfirm AMEX remains effectively `off` after the release.

Application release evidence (2026-08-06): the reviewed hardened repair and parity
revision passed both Vercel project checks in pull request #15 and merged to `main`.
The exact merge deployment reached Ready, and the primary alias independently
resolved to the same deployment ID. Three anonymous public routes returned HTTP
200. A fresh signed-in dashboard reload displayed account data with no missing-table
or loading failure. The authenticated handoff page's server-rendered runtime props
serialized exact initial mode `off`, with neither `preview` nor `write`, proving the
new primary-alias deployment retained the production hold without requiring cookie
or secret extraction.

**Stop:** deployment/alias mismatch, authenticated read failure, public regression,
unexpected mode, or request-path database error.

## 5. Capture parity baseline and discover all eligible accounts twice

- [x] Run discovery pass A across every bounded page until `hasMore = false`, using a unique private `0600` manifest per page.
- [x] Run discovery pass B independently with new private paths and the same page size.
- [x] Privately compare page boundaries, inventory/manifest/page authority, entries, and digests; retain only sanitized aggregate count equality.
- [x] Review every blocked reason and verify blocked/ineligible units will receive no write.
- [x] Confirm the complete safely eligible inventory across all accounts is covered; do not stop after the requesting account or first page.
- [x] Run the new parity verifier in `capture` mode against the reviewed complete inventory and pass-A manifests, writing a new private `0600` baseline file.

Discovery evidence (2026-08-06): two complete all-account passes were byte-identical
across two bounded pages. They examined 806 definitions, authorized 502 eligible
definitions, left 304 blocked definitions unchanged, planned 1,877 occurrence
actions, and expected 575 redundant status removals. The complete private manifest
bundle and global/page baselines remain in `0600` operator storage outside Git.

**Stop:** non-determinism, missing page, manifest overwrite/permission failure, private
data leakage, new ambiguity, or any authority mismatch.

## 6. Apply, replay, and verify one reviewed page at a time

For each page, in order:

- [x] Reverify target identity, recovery point, primary-alias deployment identity, and effective AMEX `off`.
- [x] Supply the exact private manifest plus reviewed inventory/manifest/page fingerprints and exact apply confirmation phrase.
- [x] Apply the page; allow only manifest-covered safe units and closed stops.
- [x] Replay the same page in apply mode and require every previously applied unit to report idempotent with no rewrite.
- [x] Run parity `verify` for the page and cumulative baseline; require exact allowed deltas and identical unrelated-row digests.
- [x] Record only aggregate examined/proposed/blocked/action/applied/idempotent counts and boolean gates.

Apply evidence (2026-08-06): page 1 applied 336 eligible definitions after a
fail-closed four-unit partial stop was resolved by reviewed forward fixes; resume
applied the remaining 332, replayed the first four idempotently, and a complete
page replay was idempotent. Page 2 applied 166 eligible definitions and its
complete replay was idempotent. No rollback or compensating write ran. All 304
blocked definitions remained outside write authority.

Final scoped parity reruns against the original complete pre-repair baseline also
passed after the cumulative rollout. Page 1 examined 500 definitions, proved 336
eligible/idempotent and 164 blocked unchanged, with exact 379 removals, 336 parent
repairs, and 1,186 occurrences. Page 2 examined 306 definitions, proved 166
eligible/idempotent and 140 blocked unchanged, with exact 196 removals, 166 parent
repairs, and 691 occurrences. Every page gate was true and both stop sets were empty.

Do not continue to the next page after any graph, state, CAS, provenance, catalog,
postimage, target, recovery, mode, deployment, manifest, or parity mismatch.

## 7. Final production verification

- [x] Run complete aggregate parity verification over all reviewed pages.
- [x] Prove each applied unit is `APPLIED_VALID`, duplicate suppression is exact, and one canonical effective status remains per repaired occurrence.
- [x] Prove keeper identity/state/timestamps/audit/provenance preservation and exact evidence-backed loser deletion.
- [x] Prove blocked/ineligible units and all unrelated rows are unchanged.
- [x] Repeat complete apply replay and require only idempotent outcomes.
- [x] Verify a representative authenticated repaired dashboard, including the reported account when eligible, shows one canonical entry with preserved usage/history.
- [x] Reconfirm public availability and effective AMEX `off`.

Final evidence (2026-08-06): the complete global verifier passed every gate with
806 definitions examined, 502 manifest entries eligible / `APPLIED_VALID` /
idempotent, 304 blocked definitions unchanged, 575 expected and observed status
removals, 502 expected and observed repair parents, 1,877 expected and observed
occurrences, and no stops. Protected keeper state and unrelated-row digests were
identical. Independent aggregate reads confirmed 502 `APPLIED`, zero
`ROLLED_BACK`, and 1,877 occurrence rows. The reported Capital One Venture X
dashboard now shows one canonical $300 annual travel-credit entry with the
existing $150 partial-use history. Three public routes returned HTTP 200 and the
authenticated handoff runtime serialized exact mode `off`, with neither
`preview` nor `write`.

## 8. Evidence handling and deferred work

- [x] Store only sanitized aggregate/boolean results in the task record.
- [x] Keep manifests, cursors, fingerprints, baselines, target identities, URLs, IDs, and row data in approved private temporary storage outside Git/chat/output.
- [x] Retain the recovery point and private rollback evidence through the reviewed observation window.
- [x] Do not run strict legacy cleanup, delete repair evidence/preimages, scan a provider, confirm an AMEX proposal, or reactivate preview/write.

Final quality gate: the complete Jest suite passed 80 suites with 763 passed and
1 intentionally skipped test (764 total). The final focused parity/repair/adapter
gate passed 104 tests. Strict TypeScript, changed-source ESLint, public-DB,
card-template, AMEX-userscript, task JSON/JSONL, package-context, sensitive/artifact,
Markdown-link, complete-diff, and `git diff --check` reviews passed. Build, Prisma
generation/status/migration, cleanup, provider scan, and AMEX confirmation remained
outside this final static gate.
- [ ] If rollback is proposed, stop and obtain a new explicit approval after reviewed rollback-preview evidence.

## Completion gate

The task is complete only when every safely eligible manifest-covered production
unit across all accounts has passed apply, idempotent replay, aggregate parity, and
runtime/dashboard verification; all blocked units are unchanged; AMEX remains
effectively `off`; and no private operational artifact entered Git or sanitized
evidence.
