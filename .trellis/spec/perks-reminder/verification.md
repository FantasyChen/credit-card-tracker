# Verification

Choose checks by changed surface. Report commands as passed, failed, or skipped; an environmental or safety skip is not a pass.

## Safe static checks

| Change | Minimum safe checks |
| --- | --- |
| Trellis/spec migration | `python3 ./.trellis/scripts/get_context.py --mode packages`, context/phase parsing, adapter target checks, structured-config parsing, `git diff --check` |
| Public routes/catalog | `npm run check:public-db`, plus targeted route/component tests for changed behavior |
| Card-template intake | `npm run card-template:validate` |
| TypeScript/frontend changes | `npx tsc --noEmit --pretty false --incremental false`, plus targeted Jest files |
| Server Action mutation | targeted mocked action test covering auth, validation, ownership, success, failure, and revalidation |
| Documentation/config | parse changed JSON/YAML/TOML as applicable, link/path review, `git diff --check` |

## Public DB invariant scope

`npm run check:public-db` is a narrow static guard, not a transitive or runtime proof. `scripts/check-public-db-invariant.cjs`:

- checks a fixed list of anonymous page/component files for direct Prisma/auth imports and selected API fetches;
- checks a fixed list of public API files for module-scope Prisma/auth imports;
- confirms the build script does not run `prisma db seed`.

It does not follow imports, execute routes, prove that every anonymous surface is listed, or prove that a dynamically imported authenticated branch is unreachable anonymously. Review changed dependency paths and run targeted tests in addition to the script.

## Targeted Jest checks

Jest with the repository's global mocks is safe for narrow code paths that do not deliberately connect to external services. Examples:

```bash
npm test -- --runInBand src/components/__tests__/BenefitsDisplayClient.test.tsx
npm test -- --runInBand src/app/cards/__tests__/actions.test.ts
npm test -- --runInBand src/lib/__tests__/benefit-status-transitions.test.ts
```

Choose changed test files rather than the entire suite when a narrow result is sufficient. Report the exact files run.

## Conditional checks

- Next build, Prisma generate/migrate/seed/status/reset/push, database-backed audits, Vercel commands, cron calls, email/notification commands, and browser/live production checks are not generic validation. Run only when the task explicitly permits them and all target/side-effect prerequisites are satisfied.
- `npm run build` must remain migration-free, but it still performs Prisma client generation and a production Next build; do not use it as a routine pre-commit check.
- `npm run usage-guides:audit` directly creates a Prisma client using the current process environment; it does not use `scripts/with-dev-db.js`. Verify the non-production database target first.
- Frontend behavior should be rendered when practical, but never by weakening auth, caching, database, or external-effect safeguards.

## Review requirements

- Inspect the complete diff and all untracked paths, not only summary output.
- Scan for credentials, tokens, authorization headers, OAuth/session material, email addresses from runtime data, database URLs/hostnames, provider project state, browser data, migration backups, and `.env` content.
- Confirm public/static paths do not introduce Prisma imports or DB calls.
- For database changes, inspect migration SQL and current-user compatibility; for catalog changes, review immutable static keys/parents, key-preserving synchronization, retirement/reactivation, existing-card propagation, status materialization, and guide linkage together.
- Residual `.cursor`, Context Harness, or retired-script references must be either removed or explicitly classified as historical prose; no live command may depend on a removed path.

## Scenario: category-drift repair verification

### 1. Scope / Trigger

Use this contract for any schema, planner, operator, runtime, AMEX, clone, rollout, or evidence change related to category-drift repair. Select checks by the actual changed surface. Static implementation evidence never authorizes database access, schema deployment, private manifest generation, provider configuration, repair apply/rollback, cleanup, live AMEX confirmation, or production action. There is no production authorization in this contract. Any later repair write must independently prove effective AMEX mode `off`.

### 2. Signatures

```text
schema/migration-only change:
  Prisma schema validation without generation or database access
  + targeted migration SQL Jest
  + executable-spec structure/link review
  + sensitive-pattern review
  + git diff --check

later implementation change:
  owning targeted Jest suites
  + strict TypeScript
  + changed-source lint
  + public DB/card-template/userscript invariants as affected

verified-development rehearsal:
  separately authorized target/migration/operator evidence
  + exact apply/runtime/rollback/reapply preservation checks
```

Every check is reported `passed`, `failed`, or `skipped`. A safety/authorization skip is never a pass.

Implementation completion evidence for this repair:

| Check | Result |
| --- | --- |
| Focused runtime integration | Passed: 16 suites, 270 tests |
| Full Jest | Passed: 78 suites, 716 passed, 1 skipped (717 total) |
| Strict TypeScript | Passed |
| ESLint on changed TypeScript/JavaScript source | Passed |
| Additive schema/static migration invariants | Passed; schema validation loaded dotenv automatically, disclosed no value, and performed no migration/write |
| Public DB, card-template, and AMEX-userscript invariants | Passed |
| Trellis JSON/JSONL parsing, executable-spec/sensitive-pattern/artifact review, and `git diff --check` | Passed |
| Repository-wide lint | Not a clean task gate: seven pre-existing diagnostics remain in unchanged `src/app/api/predefined-cards/route.ts` and `src/lib/subscription.ts`; forced lint of the ignored deprecated CommonJS duplicate utility also reports ten legacy diagnostics |
| Development database migration/rehearsal | Skipped: separately authorized boundary |
| Production/provider/browser/userscript/live AMEX/build/deploy/confirmation operations | Skipped: not authorized and not routine verification |

The Next/SWC package-version mismatch warning (`15.5.7` versus Next.js `15.5.11`) remains an environment/dependency warning; it did not fail the passing Jest/lint checks and is not repaired by weakening this feature's gates.

### 3. Contracts

1. Schema validation may parse `prisma/schema.prisma` but must not generate a client, inspect migration status, connect to a database, apply SQL, seed, or build.
2. Migration tests read checked-in SQL as text and assert additive structures, no existing-table DML/destructive DDL, restrictive canonical-target references, cascading user-owned repair/evidence lifecycle references, exact enums/indexes/checks, scalar deleted IDs, catalog-key fields, fingerprints, and versioned JSON evidence.
3. Executable-spec checks require each changed scenario to retain sections `1` through `7`, closed signatures/reasons, operational gates, no-production-authorization language, and cross-links consistent with global, AMEX, database, deployment, and verification ownership.
4. Planner/operator tests are required only when those files change; schema/spec work does not create placeholder runtime implementation or generated Prisma output.
5. Runtime tests must prove the centralized `NONE | ROLLED_BACK | APPLIED_VALID | APPLIED_INVALID` classifier; authority only for `APPLIED_VALID`; deletion protection for both valid and invalid `APPLIED` evidence; bounded SQL cron candidates/evidence loading without suppression starvation; genuine custom behavior; strict classifier stability; exact AMEX authority; and clone rebinding. Dashboard content heuristics and production ID fixtures are forbidden.
6. Persistence tests must prove serializable re-plan/CAS, evidence-before-delete, keeper parity, distinct immutable `graphFingerprint` and mutable `reviewedCurrentGraphFingerprint` roles, semantic occurrence ordering, catalog-bound clone-portable fingerprints, historical authority scoped only to manifest-covered units, full rollback preimages, idempotency, postimage checks, and stops for state/attachment/audit/provenance/catalog drift.
7. Operational tests are separate. Every repair operator mode must reject before `readBatch` without `targetVerified === true`. Verified-development migration/rehearsal additionally requires explicit authorization; production writes need effective-AMEX-off, recovery, manifest, page, and confirmation gates.
8. Sensitive review includes manifests, cursor payloads, fingerprints, database/provider identifiers, user/card/benefit/status IDs, row snapshots, provider observations, credentials, tokens, environment contents, and production lists. None belong in tracked fixtures or reports.
9. The complete diff and every untracked file must be classified. Generated Prisma files, build artifacts, database files, temporary manifests, backups, and private evidence must not be added.
10. Parent rollout docs must keep first confirmation and cleanup blocked until the repair's separately reviewed gates pass; tests cannot mark those operational gates complete.
11. Compatibility review must include authenticated custom/card lifecycle guards, generic strict cleanup/rollback intersections, and every executable legacy template or duplicate-status utility. Each must fail closed before its first mutation when an `APPLIED` repair source, keeper, physical card, target global product, or exact occurrence tuple intersects.
12. Clone verification must distinguish SQL `NULL` from JSONB `null` for absent rollback preimages and reject malformed parent/occurrence relations or destination collisions before insertion.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Only schema, migration SQL, invariant test, and specs changed | Run schema/spec static checks; skip runtime/full operational suites unless needed |
| Prisma command would generate, migrate, inspect status, seed, build, or connect | Do not run as routine verification |
| Migration test detects existing-table rewrite, cascading canonical target, or restrictive user-owned evidence that would outlive rollback | Fail implementation gate |
| Schema and SQL enum/field/index/relation names differ | Fail cross-layer review |
| Executable scenario omits one of sections 1..7 or an off/no-authorization gate | Fail spec review |
| Test fixture contains production IDs, private manifest/fingerprint, target identity, or row snapshot | Remove/redact fixture and fail sensitive review |
| Database rehearsal lacks explicit development authorization/target proof | Skip and report blocked |
| Production repair is suggested because static tests passed | Reject; keep confirmation/cleanup hold |
| Check cannot run safely because of environment/tooling | Report skipped or failed with reason; never call it passed |

### 5. Good / Base / Bad Cases

- **Good:** A schema-only task runs the targeted migration SQL test, validates schema syntax without generation/database access, checks all five executable specs, scans the diff, and explicitly skips development/production operations.
- **Good:** A later runtime task adds focused tests for active/rolled-back evidence and AMEX authority, then runs strict TypeScript and affected invariants without a live database.
- **Base:** Verified-development rehearsal is planned but not authorized in this implementation task. It remains an unchecked separate gate.
- **Bad:** Run `npm run build`, Prisma generate/migrate/status, a database dry-run, or live AMEX preview merely to prove schema/spec edits compile.

### 6. Tests Required

For schema/spec work, assert the additive migration invariant suite passes; schema parses with no generated-file diff; canonical global target relations are restrictive while user-owned source/ledger/owner/card/parent/keeper evidence relations cascade; all five category-repair scenarios expose ordered seven-section headings; Markdown links/paths and structured task/config files parse; no sensitive/private evidence appears; parent confirmation/cleanup hold is present; package context remains discoverable; and `git diff --check` passes. For implementation completion, additionally run the full Jest suite, strict TypeScript, changed-source lint, affected public-DB/card-template/userscript invariants, task JSON/JSONL parsing, static sensitive/artifact review, and complete-diff review. Focused tests must cover all planner/persistence/runtime/AMEX/clone contracts, bounded cron loading, semantic evidence order, portable fingerprints, SQL-null clone preimages, lifecycle/legacy utility guards, and malformed-evidence fail-closed behavior. Database and production checks remain separately authorized and truthfully skipped here.

### 7. Wrong vs Correct

```bash
# Wrong: broad side-effecting commands substitute for focused static evidence.
npm run build
npx prisma migrate status
npm run repair:global-benefit-categories -- --dry-run
```

```bash
# Correct for a schema/spec-only implementation boundary.
npm test -- --runInBand src/lib/catalog/__tests__/migration-sql.test.ts
# Run the repository-approved schema parser/validator without generation or DB access.
python3 ./.trellis/scripts/get_context.py --mode packages
git diff --check
```
