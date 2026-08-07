# Implementation plan — Architecture cleanup and deepening

## Parent coordination

- [x] Review and approve this parent plan plus all child plans.
- [x] Start only the child that owns the next deliverable; use the parent only for integration review.
- [x] Keep child file ownership non-overlapping and record documentation/catalog handoff explicitly.

## Ordered children

- [x] 1. Complete `08-06-domain-docs-consolidation`.
- [x] 2. Complete `08-06-orphan-code-assets-cleanup`.
- [x] 3. Complete `08-06-subscription-surface-cleanup`.
- [x] 4. Complete `08-06-benefit-dashboard-deepening`.
- [x] 5. Complete `08-06-catalog-workflow-consolidation`.
- [x] 6. Complete `08-06-amex-catalog-ownership`.

## Integration gate

- [x] Re-run full Jest and strict TypeScript.
- [x] Run `npm run check:public-db`, `npm run card-template:validate`, and `npm run check:amex-userscripts`.
- [x] Run ESLint for every changed source file and `git diff --check`.
- [x] Search for deleted paths, stale imports, superseded commands, missing documentation links, and unused declared dependencies.
- [x] Inspect every changed/untracked path; confirm `.env`, secrets, generated output, `.vercel/`, backups, and private evidence are absent.
- [x] Update Trellis specs where module ownership or durable contracts changed.
- [x] Record that all affected Catalog, AMEX reader/sync, userscript, public DB, TypeScript, and full Jest checks must remain green before rollout operations resume.

## Stop conditions

- Any change alters effective source-union semantics outside the approved current-year home summary.
- Any AMEX count, identity tuple, envelope, privacy, replay, proposal, or confirmation contract changes.
- Any current exact global migration, cleanup/rollback gate, or catalog-key invariant loses coverage.
- Any check requires database, build, deployment, notification, email, provider, or production access; report it skipped instead.

## Recorded integration verification

- Full Jest: 81 suites passed; 758 tests passed; 1 skipped.
- Strict TypeScript passed.
- ESLint passed for every changed TypeScript source/test file.
- Public DB invariant, card-template validation, and AMEX userscript artifact checks passed.
- Markdown links, deleted-path/stale-import searches, package manifest consistency, package/spec discovery, and `git diff --check` passed.
- No database, build, deployment, cron, email, notification, provider, userscript installation, or production operation was run.
- `npm` reports 29 dependency vulnerabilities in the existing dependency graph; no unreviewed `npm audit fix` was run.
