# Publish and merge architecture cleanup

## Goal

Deliver the verified architecture cleanup and dependency remediation through GitHub review, required CI, and merge to `main`.

## Background

- The branch is `codex/architecture-cleanup` with remote `origin` at `lifan-builds/perks-reminder`.
- No pull request currently exists for the branch.
- The branch contains 15 completed architecture-cleanup commits before this follow-up task.
- `main` automatically deploys through Vercel; merging is therefore a production application release.

## Requirements

- Begin only after the dependency-remediation child is complete and committed.
- Review the complete diff, commit history, changed paths, and residual sensitive/stale references against `main`.
- Rerun the current-commit safe release gates before pushing.
- Push `codex/architecture-cleanup` and open a ready pull request against `main` with an accurate summary, verification record, risks, and skipped operations.
- Observe all required GitHub CI checks to completion; fix branch-owned failures and rerun the appropriate gates.
- Merge only when required checks pass and GitHub reports the pull request mergeable.
- Do not manually deploy, alter provider configuration, run production probes, or perform database/cron/email/notification operations.

## Acceptance Criteria

- [x] Final local verification passes on the exact commit pushed.
- [x] The branch is pushed and a ready pull request exists against `main`.
- [x] The PR description accurately covers architecture changes, dependency remediation, verification, and operational skips.
- [x] Required GitHub CI completes successfully.
- [x] The PR is merged into `main` using the repository-supported merge method.
- [x] The merged commit/PR state is recorded without claiming manual deployment or unobserved production health.

## Out of Scope

- Manual Vercel deployment, alias changes, environment changes, database operations, runtime production probes, and resumption of the AMEX/global-benefit rollout.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
