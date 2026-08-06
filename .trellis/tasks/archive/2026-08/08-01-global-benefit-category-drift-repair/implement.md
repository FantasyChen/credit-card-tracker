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

## 7. Verified development execution — separately authorized and complete

- [x] Verify development target and apply additive migration.
- [x] Run the checked-in harness to rehearse deterministic discovery/manifest/dry-run twice.
- [x] Exercise apply, suppression, effective/AMEX authority, rollback preserving later state, blocked provenance drift, and reapply against the verified development target.
- [x] Record sanitized aggregate evidence. Do not access or mutate production.

The first isolated run failed closed at the manifest-covered provenance-drift
preview described in section 9 and retained its branch/evidence without force
cleanup. After the operator-level fix and independent full-scope review, a second
fresh branch from the verified development parent received only the reviewed
additive migration and completed the harness with every report gate true:
target/prerequisites/deterministic review, apply/replay, runtime authority,
keeper mutation, rollback with state preservation, reapply, provenance-drift
block, provenance removal, final rollback/state equality, and exact cleanup.
Aggregate counts were one definition/action, two applies, one idempotent replay,
two rollbacks, one effective status, and two restored statuses. This development
evidence authorizes no production database or repair action.

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
   recorded. Verify its Ready immutable deployment and primary-alias deployment
   IDs match before any repair-table read. Then run read-only category-repair
   discovery twice, privately review the complete manifest/page fingerprints, and
   retain only aggregate sanitized output.
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

### Operator-only command cards (not executed in this implementation session)

These commands are exact shapes for a separately authorized operator. Values in
angle brackets are private process inputs and must never be committed, pasted into
chat, or printed in evidence. Do not use `scripts/with-dev-db.js` or any command
that reads `.env` for the rehearsal. The harness reads process-supplied values
directly.

Development recovery and target gate:

```bash
neonctl branches create --project-id "<verified-development-project>" \
  --parent "<verified-development-parent>" \
  --name "<private-category-repair-recovery>" --no-compute --output json
neonctl branches get "<private-category-repair-recovery>" \
  --project-id "<verified-development-project>" --output json
```

The branch parent, no-compute state, database/schema identity, and Neon branch
fingerprint must be privately recorded before any write. `neonctl me` and
`vercel whoami` are read-only authentication checks; they do not verify a target.

Development migration and independent status check (after target/recovery
authorization) require a privately supplied direct development URL and an
isolated temporary workspace containing only copies of `prisma/schema.prisma` and
`prisma/migrations`. Prisma auto-loads dotenv files from the project/workspace;
the workspace must contain no `.env` or `.env.*`, and the already-installed
binary is invoked directly through `PRISMA_BIN` (no install or network step):

```bash
PRISMA_BIN="<verified-repository>/node_modules/.bin/prisma"
MIGRATION_WORKSPACE="<private-empty-migrations-workspace>"
(
  cd "$MIGRATION_WORKSPACE"
  DATABASE_URL="$DATABASE_URL_DEV" DIRECT_URL="$DIRECT_URL_DEV" \
    "$PRISMA_BIN" migrate deploy --schema "$MIGRATION_WORKSPACE/prisma/schema.prisma"
  DATABASE_URL="$DATABASE_URL_DEV" DIRECT_URL="$DIRECT_URL_DEV" \
    "$PRISMA_BIN" migrate status --schema "$MIGRATION_WORKSPACE/prisma/schema.prisma"
)
```

`DIRECT_URL_DEV` is an operator-held direct endpoint, not a checked-in variable or
an inferred production value. Stop if it is absent or target identity is uncertain;
do not run these Prisma commands from the repository root.
The rehearsal itself then runs only after the migration/status/recovery gates pass:

```bash
AMEX_SYNC_MODE=off \
npm run rehearse:global-benefit-category-repair:dev -- \
  --recovery-point-verified \
  --confirm=REHEARSE_CATEGORY_DRIFT_REPAIR_ON_VERIFIED_DEVELOPMENT
```

Production AMEX-off and schema gates are separate provider/database operations. A
provider operator may register the exact newline-free `off` value and deploy via
the approved path, then inspect both identities without retaining them:

```bash
printf '%s\n' off | vercel env add AMEX_SYNC_MODE production --force
vercel inspect "<ready-immutable-deployment>" --json
vercel inspect "<primary-alias>" --json
```

The configuration/deployment commands above are not authorized by this task. The
effective-off gate additionally requires a fresh authenticated/read-only probe
that proves confirmation cannot write; registration or `Ready` alone is not proof.
After that gate and a fresh recovery point, the separately authorized additive
production migration uses the same isolated workspace (with the reviewed
schema/migrations copies) and is:

```bash
PRISMA_BIN="<verified-repository>/node_modules/.bin/prisma"
MIGRATION_WORKSPACE="<private-empty-migrations-workspace>"
(
  cd "$MIGRATION_WORKSPACE"
  DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" \
    "$PRISMA_BIN" migrate deploy --schema "$MIGRATION_WORKSPACE/prisma/schema.prisma"
  DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" \
    "$PRISMA_BIN" migrate status --schema "$MIGRATION_WORKSPACE/prisma/schema.prisma"
)
```

Category-repair discovery and dry-run are bounded, read-only operator pages. Each
page receives a unique private `0600` manifest path; the next opaque cursor and all
fingerprints come from that private manifest, never from console output:

```bash
npm run repair:global-benefit-categories -- \
  --discover --limit=500 --target-verified \
  --manifest-output=/private/category-repair/page-001.json
npm run repair:global-benefit-categories -- \
  --dry-run --limit=500 --target-verified \
  --after="<private-opaque-cursor>" \
  --manifest=/private/category-repair/page-001.json
```

Only after private manifest/inventory/page review, recovery verification, and
effective-AMEX-off verification may a bounded page be applied or replayed:

```bash
npm run repair:global-benefit-categories -- \
  --apply --limit=500 --target-verified \
  --recovery-point-verified --amex-off-verified \
  --manifest=/private/category-repair/page-001.json \
  --after="<private-opaque-cursor>" \
  --expect-inventory="<private-sha256>" \
  --expect-manifest="<private-sha256>" \
  --expect-page="<private-sha256>" \
  --confirm=APPLY_REVIEWED_CATEGORY_DRIFT_REPAIR
```

Rollback is a separate decision and uses the same page authority plus the exact
rollback phrase; rollback-preview is no-write and precedes it:

```bash
npm run repair:global-benefit-categories -- \
  --rollback-preview --limit=500 --target-verified \
  --after="<private-opaque-cursor>" \
  --manifest=/private/category-repair/page-001.json
npm run repair:global-benefit-categories -- \
  --rollback --limit=500 --target-verified \
  --recovery-point-verified --amex-off-verified \
  --manifest=/private/category-repair/page-001.json \
  --after="<private-opaque-cursor>" \
  --expect-inventory="<private-sha256>" \
  --expect-manifest="<private-sha256>" \
  --expect-page="<private-sha256>" \
  --confirm=ROLLBACK_REVIEWED_CATEGORY_DRIFT_REPAIR
```

There is no checked-in production parity command. Post-apply parity must be a
separately reviewed, aggregate-only read of effective projection, repair authority,
keeper state, status tuples, audits/provenance, and AMEX destination authority.
Do not substitute `fix-duplicate-benefit-statuses*` or dashboard-content matching;
those utilities are guarded/superseded and are not the category-repair writer.

## 9. Isolated rehearsal failure and static fix — 2026-08-06

The authorized isolated-development run failed closed after the fresh reapply.
Sanitized aggregate evidence was:

```text
targetValidated/prerequisites/deterministicReview/apply/replay/runtimeAuthority/
keeperMutation/rollback/rollbackStatePreserved/reapply = true
graphDriftBlocked/provenanceRemoved/finalRollbackPassed/finalStateMatched/
cleanupComplete = false
definitionsExamined=1, statusActions=1, applied=2, idempotent=1,
rolledBack=1, effectiveStatuses=1, restoredStatuses=2
```

Root cause: after the rehearsal inserted later provenance, the sole
`rollback-preview` proposal correctly became blocked as `repair_evidence_invalid`.
The operator then compared only non-blocked proposal keys with the original
manifest and raised `private repair manifest does not cover the exact reviewed
page` before returning the required closed stop. Recovery therefore preserved the
active evidence and could not remove the provenance or clean the fixture.

Fix: manifest coverage now requires every manifest key to remain present on the
current page and every currently safe proposal to remain manifest-authorized;
manifest-covered blocked proposals are returned as aggregate stops. This keeps
rollback-preview no-write and fail-closed while allowing the rehearsal to remove
the injected provenance, preview again, roll back, and clean only after evidence is
`ROLLED_BACK`.

Regression coverage now exercises the real operator with manifest-covered
provenance, source, and keeper drift and asserts `proposed=0`, `blocked=1`, and
`repair_evidence_invalid=1`. Focused operator/adapter/rehearsal tests (81 passed),
strict TypeScript, changed-source ESLint, and diff checks pass. The authorized
second isolated-development rerun passed every closed report gate and exact
cleanup check described in section 7. The failed first branch remains retained as
diagnostic evidence; no production repair action is implied.

## Stop conditions

Stop on ambiguous/zero target, non-category shape drift, explicit custom ownership, duplicate target, non-exact overlap, conflicting meaningful state, losing-side attachments, cross-owner relations, inventory/manifest/catalog/source drift, CAS mismatch, missing clone binding, target uncertainty, effective AMEX not off for writes, or failed postimage verification.
