# Implementation plan — Architecture cleanup and deepening

## Parent coordination

- [ ] Review and approve this parent plan plus all child plans.
- [ ] Start only the child that owns the next deliverable; do not start the parent for application edits.
- [ ] Keep child file ownership non-overlapping and record any unavoidable handoff explicitly.

## Ordered children

- [ ] 1. Complete `08-06-domain-docs-consolidation`.
- [ ] 2. Complete `08-06-orphan-code-assets-cleanup`.
- [ ] 3. Complete `08-06-subscription-surface-cleanup`.
- [ ] 4. Complete `08-06-benefit-dashboard-deepening`.
- [ ] 5. Complete `08-06-catalog-workflow-consolidation`.
- [ ] 6. Complete `08-06-amex-catalog-ownership`.

## Integration gate

- [ ] Re-run full Jest and strict TypeScript.
- [ ] Run `npm run check:public-db`, `npm run card-template:validate`, and `npm run check:amex-userscripts`.
- [ ] Run ESLint for every changed source file and `git diff --check`.
- [ ] Search for deleted paths, stale imports, superseded commands, missing documentation links, and unused declared dependencies.
- [ ] Inspect every changed/untracked path; confirm `.env`, secrets, generated output, `.vercel/`, backups, and private evidence are absent.
- [ ] Update Trellis specs where module ownership or durable contracts changed.
- [ ] Record which active rollout checks must be rerun before rollout work resumes.

## Stop conditions

- Any change alters effective source-union semantics outside the approved current-year home summary.
- Any AMEX count, identity tuple, envelope, privacy, replay, proposal, or confirmation contract changes.
- Any current exact global migration, cleanup/rollback gate, or catalog-key invariant loses coverage.
- Any check requires database, build, deployment, notification, email, provider, or production access; report it skipped instead.
