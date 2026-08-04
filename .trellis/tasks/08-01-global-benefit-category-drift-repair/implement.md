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

## Stop conditions

Stop on ambiguous/zero target, non-category shape drift, explicit custom ownership, duplicate target, non-exact overlap, conflicting meaningful state, losing-side attachments, cross-owner relations, inventory/manifest/catalog/source drift, CAS mismatch, missing clone binding, target uncertainty, effective AMEX not off for writes, or failed postimage verification.
