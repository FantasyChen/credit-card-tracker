# Implementation Plan — Global catalog foundation

## Preconditions

- Child implementation was performed with production AMEX remaining off.
- Code implementation began with static-only checks; later validation used only the separately verified development target. No seed, reset, production build, or production database operation was run.

## 1. Inventory and key design

- [x] Inventory every static card/benefit, seed consumer, AMEX registry identity, and positional association.
- [x] Assign explicit immutable card and benefit catalog keys in source.
- [x] Add validation for key, parent, tuple, AMEX completeness, count, and writable-set parity.
- [x] Add tests proving key stability across name changes and order changes.

**Gate result:** Static source and registry validation passed before the schema/synchronization implementation was treated as code-complete.

## 2. Additive schema and SQL

- [x] Add global retirement/key fields, physical-card/global-status relations, bridge-compatible nullability, audit metadata, and migration ledger.
- [x] Define `RESTRICT` relations and partial standard/custom unique indexes.
- [x] Add and statically review the checked-in additive migration SQL.
- [x] Verify statically that the SQL contains no destructive reset/drop, global cascade, status-state rewrite, or unsafe existing-row requirement.

**Verified development result:** Prisma schema validation and client generation passed, migration status identified only the additive global-catalog migration as pending, and that migration was applied successfully to the separately verified development target. Production was not accessed or modified.

**Rollback:** Runtime remains legacy-compatible while additive columns are unused.

## 3. Catalog synchronization

- [x] Extract testable key-based planning/synchronization under `src/lib/catalog/`.
- [x] Upsert parents/children by key, preserve IDs, update approved fields, and retire absent rows.
- [x] Make dry-run the default; bound output and omit sensitive target/row details.
- [x] Require explicit apply mode, target verification, exact confirmation, and transaction/CAS checks.
- [x] Update seed usage to call the shared synchronizer without delete/recreate behavior.

## 4. Cross-surface integration

- [x] Keep `static-catalog` DB-free for anonymous routes.
- [x] Make AMEX registry/catalog keys explicit and validate key/tuple parity without granting user rows authority.
- [x] Confirm no code path generates catalog keys from mutable fields or positions.

## 5. Recorded implementation and review evidence

Code and safe static/unit verification are complete for this child. The final full-scope review included the catalog changes together with the other three implementation children.

- [x] Full Jest: 74 suites passed; 593 tests passed; 1 test skipped.
- [x] Strict TypeScript passed: `npx tsc --noEmit --pretty false --incremental false`.
- [x] ESLint passed for every changed source file.
- [x] `npm run card-template:validate` passed.
- [x] `npm run check:public-db` passed.
- [x] `npm run check:amex-userscripts` passed without changing the public userscript contract.
- [x] Safe usage-guide source/link consistency checks passed; the database-backed usage-guide operator was not run.
- [x] JSON and JSONL parsing plus Markdown-link validation passed.
- [x] The sensitive-pattern scan found no checked-in secret, connection value, provider/session material, or user data.
- [x] `python3 ./.trellis/scripts/get_context.py --mode packages` and `git diff --check` passed.
- [x] Migration SQL tests and catalog/static-registry parity tests passed.

### Verified development evidence

- [x] The additive migration applied successfully after target identity verification.
- [x] A sanitized mismatch diagnostic proved that all 56 initially blocked legacy global benefits matched one source uniquely on complete canonical shape and differed only because all three newly introduced provider-identity fields were absent.
- [x] Catalog bootstrap now requires exact canonical card/benefit shape, wholly absent or wholly exact provider identity, and bidirectional uniqueness; partial/conflicting identity fails closed.
- [x] Two consecutive pre-apply dry-runs were identical: 34 card adoptions, 129 benefit adoptions, zero creates, and zero conflicts.
- [x] Confirmed catalog apply adopted those existing IDs, and the post-apply dry-run reported 34 cards and 129 benefits unchanged with zero conflicts.

### Key implementation outcomes

- Catalog identity is explicit and key-preserving across static source, schema, seed, synchronizer, and AMEX registry validation.
- The old per-user AMEX key apply exits with a stable superseded result before any writer can run.

## 6. Operational gate record

- [x] Prisma validation/generation, migration status/deploy, catalog dry-run/apply/rerun, and verified development validation completed.
- [ ] Seed, reset, production build, database-backed usage-guide synchronization, or destructive catalog operation — not run.
- [ ] Production database/configuration/deployment, browser/provider action, or live AMEX validation — not run.
- [ ] Git commit — not performed.

## Completion status

The catalog foundation is **code-complete, safe-check complete, and verified-development complete**. It is eligible for completion/archive after the task evidence transition. Production remains out of scope and untouched.
