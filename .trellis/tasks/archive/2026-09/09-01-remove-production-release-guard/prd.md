# Remove production release guard

## Goal

Remove the release-identity guard now that the production alias points to the
correct tracking release. Keep the user-visible tracking behavior intact and
avoid replacing the guard with another release process.

## Background

- The tracking feature itself is already deployed and working in production.
- The incident was an operational alias mismatch: the primary production
  domain served an older rollback deployment until the correct deployment was
  promoted.
- The guard was added afterward as repository machinery; it is not required by
  the running application or the tracking feature.

## Requirements

- Remove `scripts/verify-production-release.mjs` and its dedicated test.
- Remove the `check:production-release` package script.
- Remove release-identity-guard instructions added to the deployment and
  database specifications and the Vercel runbook.
- Preserve the tracking-mode implementation, the Ignored tab, the legacy
  Not Usable-to-Ignore migration, and the accurate tracking-mode documentation.
- Preserve unrelated local worktree changes without stashing, resetting, or
  rewriting them.
- Do not add a replacement guard, workflow, approval gate, deployment helper,
  or generalized release framework.

## Acceptance Criteria

- [ ] No source file, package command, test, or active specification requires
  the production release-identity guard.
- [ ] The existing tracking code and migration files are unchanged.
- [ ] The remaining package configuration parses and the repository contains
  no live references to `check:production-release` or
  `verify-production-release`.
- [ ] Targeted checks for the edited configuration/documentation pass.

## Out of Scope

- Changing the tracking feature or production data.
- Redeploying, promoting, or moving production aliases.
- Running migrations, cron jobs, email, or notification operations.
- Cleaning up unrelated task history or pre-existing worktree changes.

## Notes

- This is a lightweight removal task; no design or implementation-plan artifact
  is needed.
