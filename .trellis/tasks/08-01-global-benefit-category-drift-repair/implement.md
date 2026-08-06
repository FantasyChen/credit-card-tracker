# Implementation Plan — Category-drift global-benefit repair

## 1. Contracts and additive schema

- [x] Update global-benefit, AMEX, database-safety, deployment, and verification executable specs.
- [x] Add parent repair and occurrence-evidence models/enums with restrictive global targets, lifecycle-safe owned-evidence cascades, and catalog-key snapshot identity.
- [x] Add reviewed additive migration SQL and migration invariant coverage; no existing data rewrite.

## 2. Pure planner and CLI

- [x] Implement deterministic strict-custom inventory and category-only proposal discovery.
- [x] Implement private page-manifest generation/validation, definition/graph/destination/postimage/manifest fingerprints, and repair-specific opaque cursors.
- [x] Implement exact status pairing, pristine/history classification, action matrix, overlap/destination validation, reversible audit metadata, evidence-aware replay/rollback planning, and closed stop reasons.
- [x] Add bounded discover/dry-run/apply/rollback-preview/rollback CLI with aggregate-only reports and exact write gates.

## 3. Prisma adapter

- [x] Load full card/source/target/status/audit/provenance/ledger/repair graphs.
- [x] Re-plan inside serializable per-definition transactions.
- [x] Persist evidence before CAS deletion/promotion; preserve keeper fields/timestamps and record exact audit metadata changes.
- [x] Verify postimages, idempotent replay, exact rollback restoration, allowed current-state preservation, and drift stop conditions.

## 4. Runtime and compatibility

- [x] Suppress active repairs from custom cron materialization.
- [x] Require active evidence for historical-custom global bridges in effective projection and AMEX authority.
- [x] Block custom definition/card deletion while active repair evidence exists.
- [x] Keep strict classifier category-inclusive while accounting for repair evidence; generic cleanup/rollback must not invalidate active repairs.
- [x] Fail closed in executable legacy migration/template/duplicate-status utilities before they mutate an active repair source, keeper, card, or exact occurrence tuple; deprecate the broad superseded utilities.
- [x] Clone/rebind repair and occurrence evidence by catalog key and include aggregate table counts.

## 5. Tests and checks

- [x] Add pure planner/manifest/action tests including genuine custom and overlap cases.
- [x] Add Prisma apply/rollback/CAS/preservation/idempotency tests.
- [x] Extend cron, effective projection, mutations, card lifecycle, strict migration, AMEX, and clone tests.
- [x] Run targeted Jest, full Jest, strict TypeScript, changed-source lint, Prisma/migration checks, public DB/card-template/userscript checks, sensitive-pattern/spec checks, and `git diff --check`.
- [x] Dispatch Trellis quality review and resolve all verified findings.

## 6. Development rehearsal harness — implementation only

- [x] Add the testable development-only orchestrator, exact confirmation/recovery/target/AMEX-off gates, lazy one-client construction, repeated identity checks, and closed aggregate report.
- [x] Add the thin process-env CLI and package script without dotenv, `with-dev-db`, manifest files, Prisma CLI, environment reassignment, or production client construction.
- [x] Add the optional server-internal AMEX destination-context client seam while retaining one-argument singleton behavior.
- [x] Add mocked orchestration, target rejection, exact authority forwarding, state preservation, drift closure/removal, safe cleanup, active-evidence refusal, injection-seam, and report-privacy tests.

## 7. Verified development execution — separately authorized and still open

- [ ] Verify development target and apply additive migration.
- [ ] Run the checked-in harness to rehearse deterministic discovery/manifest/dry-run twice.
- [ ] Exercise apply, suppression, effective/AMEX authority, rollback preserving later state, blocked provenance drift, and reapply against the verified development target.
- [ ] Record sanitized aggregate evidence. Do not access or mutate production.

## 8. Production compatibility decision and ordered runbook

**Decision (2026-08-06): use migration-first; do not add a default-off runtime
wrapper for the current implementation.** The authenticated effective-benefit,
benefit/card mutation, cron, strict-migration, and AMEX repository paths already
read the repair tables through raw SQL. Their ordinary path is therefore
schema-dependent, not a schema-independent off path. A default-off capability
would require a broad lazy-boundary refactor and a proof that every off path
avoids both repair delegates and repair SQL. The deployment specification allows
the simpler migration-first alternative, and the production alias is currently
kept on the last schema-compatible deployment for exactly this reason.

This is sequencing guidance, not authorization. No production schema, provider,
application, repair, cleanup, or AMEX operation may be performed from this task;
each step remains a separately approved and target-verified gate.

The duplicate rows remain visible until the additive schema exists and a reviewed
repair apply removes only the exact loser occurrences. The safe operational order
is:

1. Complete and record the separately authorized verified-development migration
   and rehearsal gates above. Keep the rehearsal target private and emit only
   aggregate evidence.
2. Keep production on the schema-compatible deployment. Before any production
   application release or repair write, separately transition the current AMEX
   capability to effective `off` and verify the immutable deployment/primary-alias
   identity and fail-closed runtime behavior.
3. With a fresh recovery point and immediate target verification, separately apply
   only the reviewed additive repair migration. Verify migration state independently;
   a generated client or green build is not evidence that the tables exist.
4. Release the schema-dependent application only after step 3 is independently
   recorded. Run read-only category-repair discovery twice, privately review the
   complete manifest/page fingerprints, and retain only aggregate sanitized output.
5. Obtain the separate bounded apply approval. Re-verify target, recovery point,
   effective AMEX `off`, manifest/inventory/page fingerprints, and exact phrase at
   the writer boundary. Apply/replay one reviewed page at a time and stop on any
   graph, state, CAS, provenance, catalog, or postimage drift.
6. Verify duplicate suppression, canonical effective/AMEX authority, keeper-state
   preservation, and aggregate parity. Keep AMEX `off`; do not run strict cleanup,
   delete repair evidence, or reactivate preview/write as part of this repair.
7. If any schema-dependent release reaches an alias before step 3, stop further
   releases and roll back to the last schema-compatible deployment before reading
   or mutating repair state. Verify authenticated reads/data visibility after the
   rollback and preserve all database state. Do not substitute a friendly
   missing-table catch, build success, or an environment-name observation for
   migration evidence.

## Stop conditions

Stop on ambiguous/zero target, non-category shape drift, explicit custom ownership, duplicate target, non-exact overlap, conflicting meaningful state, losing-side attachments, cross-owner relations, inventory/manifest/catalog/source drift, CAS mismatch, missing clone binding, target uncertainty, effective AMEX not off for writes, or failed postimage verification.
