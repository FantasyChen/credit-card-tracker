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

Section 1 evidence: focused parity tests (7 passed) plus Prisma adapter parity
regressions (2 passed), affected category-repair tests (119 passed), strict
TypeScript (passed), changed-source ESLint (passed), public DB invariant (passed),
package context (passed), and `git diff --check` (passed).

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

- [ ] Release only the reviewed category-repair application revision after section 3 passes.
- [ ] Require the immutable deployment to reach Ready.
- [ ] Inspect the immutable deployment and primary alias; require exact deployment-ID equality.
- [ ] Verify anonymous public availability and one narrow authenticated repair-table-backed read.
- [ ] Reconfirm AMEX remains effectively `off` after the release.

**Stop:** deployment/alias mismatch, authenticated read failure, public regression,
unexpected mode, or request-path database error.

## 5. Capture parity baseline and discover all eligible accounts twice

- [ ] Run discovery pass A across every bounded page until `hasMore = false`, using a unique private `0600` manifest per page.
- [ ] Run discovery pass B independently with new private paths and the same page size.
- [ ] Privately compare page boundaries, inventory/manifest/page authority, entries, and digests; retain only sanitized aggregate count equality.
- [ ] Review every blocked reason and verify blocked/ineligible units will receive no write.
- [ ] Confirm the complete safely eligible inventory across all accounts is covered; do not stop after the requesting account or first page.
- [ ] Run the new parity verifier in `capture` mode against the reviewed complete inventory and pass-A manifests, writing a new private `0600` baseline file.

**Stop:** non-determinism, missing page, manifest overwrite/permission failure, private
data leakage, new ambiguity, or any authority mismatch.

## 6. Apply, replay, and verify one reviewed page at a time

For each page, in order:

- [ ] Reverify target identity, recovery point, primary-alias deployment identity, and effective AMEX `off`.
- [ ] Supply the exact private manifest plus reviewed inventory/manifest/page fingerprints and exact apply confirmation phrase.
- [ ] Apply the page; allow only manifest-covered safe units and closed stops.
- [ ] Replay the same page in apply mode and require every previously applied unit to report idempotent with no rewrite.
- [ ] Run parity `verify` for the page and cumulative baseline; require exact allowed deltas and identical unrelated-row digests.
- [ ] Record only aggregate examined/proposed/blocked/action/applied/idempotent counts and boolean gates.

Do not continue to the next page after any graph, state, CAS, provenance, catalog,
postimage, target, recovery, mode, deployment, manifest, or parity mismatch.

## 7. Final production verification

- [ ] Run complete aggregate parity verification over all reviewed pages.
- [ ] Prove each applied unit is `APPLIED_VALID`, duplicate suppression is exact, and one canonical effective status remains per repaired occurrence.
- [ ] Prove keeper identity/state/timestamps/audit/provenance preservation and exact evidence-backed loser deletion.
- [ ] Prove blocked/ineligible units and all unrelated rows are unchanged.
- [ ] Repeat complete apply replay and require only idempotent outcomes.
- [ ] Verify a representative authenticated repaired dashboard, including the reported account when eligible, shows one canonical entry with preserved usage/history.
- [ ] Reconfirm public availability and effective AMEX `off`.

## 8. Evidence handling and deferred work

- [ ] Store only sanitized aggregate/boolean results in the task record.
- [ ] Keep manifests, cursors, fingerprints, baselines, target identities, URLs, IDs, and row data in approved private temporary storage outside Git/chat/output.
- [ ] Retain the recovery point and private rollback evidence through the reviewed observation window.
- [ ] Do not run strict legacy cleanup, delete repair evidence/preimages, scan a provider, confirm an AMEX proposal, or reactivate preview/write.
- [ ] If rollback is proposed, stop and obtain a new explicit approval after reviewed rollback-preview evidence.

## Completion gate

The task is complete only when every safely eligible manifest-covered production
unit across all accounts has passed apply, idempotent replay, aggregate parity, and
runtime/dashboard verification; all blocked units are unchanged; AMEX remains
effectively `off`; and no private operational artifact entered Git or sanitized
evidence.
