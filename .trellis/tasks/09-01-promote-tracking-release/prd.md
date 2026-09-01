# Promote tracking release and migrate legacy ignored benefits

## Goal

Serve the tracking-mode UI in production and safely migrate legacy Not Usable rows to IGNORE.

## Background

- Commit `0401edc` is present on `origin/main` and GitHub reports a successful Vercel deployment (`dpl_D5jxU1qwrT1CQo9DSSurwjzrvaJN`).
- At task start, the primary production alias resolved to a different Ready deployment (`dpl_FtTVLar87QSVQdDVf14yjKTSxrWN`), created from the AMEX-off rollback line, so the tracking UI release was not the release served by `www.perks-reminder.com`.
- The checked-in migration `prisma/migrations/20260831000000_migrate_not_usable_to_ignore/migration.sql` converts valid legacy `BenefitStatus.isNotUsable` rows into cycle-independent `IGNORE` preferences and clears the deprecated flag. Generic Vercel builds do not run migrations.

## Requirements

1. Verify the exact `coupon-cycle` production project, current primary alias, target deployment, application/database identity, migration status, and recovery/rollback path before any external write.
2. Verify that the release to serve contains commit `0401edc` (including the Ignored tab and tracking-mode UI), then promote or redeploy that release to the primary production alias. Do not promote an unverified deployment.
3. Apply the legacy not-usable migration only after target and recovery verification. Preserve valid ownership checks and fail closed on malformed legacy rows; do not manufacture or delete benefit history.
4. Recheck migration status and the primary alias after each operation. Stop on any deployment, alias, schema, target, or unexpected-data mismatch.
5. Update the tracking-mode documentation so the checked-in contract matches the Ignored-tab behavior.
6. Add a durable release/alias-drift guard: every migration-bearing production release records the source commit, migration status, immutable deployment ID, and primary-alias deployment ID, and an intentional rollback records its older source/capability boundary.

## Acceptance Criteria

- [x] The primary production alias serves a Ready deployment built from `0401edc`, with deployment identity recorded.
- [x] The production migration status includes `20260831000000_migrate_not_usable_to_ignore` and no unexpected migration failure or partial application is reported.
- [x] Existing valid legacy not-usable rows are represented by `IGNORE` preferences, their legacy flags are cleared, and unrelated/completed/partial history is unchanged.
- [x] Authenticated users can see the `Ignored` tab and tracking-mode control; the deprecated `Not Usable` tab/action is absent.
- [x] `TRACK` restoration returns an ignored benefit to the tracked dashboard without losing its status history, as covered by focused tests.
- [x] Static tests, type-check, documentation checks, and `git diff --check` pass; no secrets or environment files are added.
- [x] Every production gate used in this rollout was proven; no failed gate was bypassed.
- [x] The prevention guard is captured in the deployment/database specs and release runbook, with an executable read-only identity check, so a later manual rollback or redeploy cannot be mistaken for the current `main` release.

## Out of Scope

- AMEX provider activation, confirmation, cleanup, cron/email activity, or other unrelated production writes.
- Broad data repair, deletion, account inspection, or changes to benefit definitions.
- Manual deployment of a different application version merely to change AMEX configuration.

## Open Questions

None. Deployment and migration commands remain gated by the execution-time target, recovery, and alias checks described in the design and implementation plan.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
