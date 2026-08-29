# Approval-gated automatic global catalog sync

## Goal

Run the global catalog synchronization workflow automatically after a catalog
change reaches `main`, while requiring a protected maintainer approval before
any database write.

## Requirements

- Trigger a catalog-sync workflow only from `main` pushes that change the
  checked-in catalog or catalog synchronizer inputs.
- Run a dry-run first and publish only aggregate plan counts/conflict status;
  never expose database URLs, IDs, row data, or secrets.
- Provide a separate apply job protected by a GitHub Environment approval.
- Require the existing exact `SYNC_GLOBAL_CATALOG` confirmation and
  `--target-verified` gate in the apply command.
- Keep catalog synchronization semantics owned by the existing operator; do
  not add seed-based or ad-hoc SQL writes.
- Keep status materialization/propagation a distinct, explicitly visible step
  after catalog apply rather than silently mutating statuses in the workflow.
- Document required repository/environment configuration and rollback/stop
  conditions.
- Add static tests/checks for trigger scope, approval protection, exact command
  gates, secret non-disclosure, and changed-path coverage.

## Acceptance Criteria

- [x] A catalog merge queues an aggregate-only dry-run automatically.
- [x] The apply job cannot start without the protected environment approval.
- [x] The apply command includes both `--target-verified` and the exact
      `SYNC_GLOBAL_CATALOG` confirmation.
- [x] No workflow step runs Prisma seed, reset, push, or an unbounded mutation.
- [x] Workflow static validation and repository-safe checks pass.
- [x] Documentation explains that approval authorizes a production DB write and
      that status propagation remains separately reviewed.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
