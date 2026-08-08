# Finish architecture cleanup delivery

## Goal

Ship the completed architecture cleanup safely by resolving its known dependency release warnings, reviewing the integrated branch, and delivering it through pull request, CI, and merge.

## Background

- `codex/architecture-cleanup` contains the completed and verified architecture refactor; the original Trellis task is archived.
- The branch is not pushed and no pull request exists.
- The current install reports 30 audit findings: 6 low, 3 moderate, 17 high, and 4 critical.
- Next.js is installed at 15.5.11 while `@next/swc-wasm-nodejs` is installed at 15.5.7.
- GitHub `main` deploys automatically through Vercel, so merging is the authorized application release action.

## Requirements

- Preserve the original architecture-cleanup history and use follow-up child tasks for new work.
- Complete dependency remediation before publishing the final pull request state.
- Review the complete branch diff and commit history against `main`.
- Push `codex/architecture-cleanup`, open a ready pull request, and run all repository CI checks.
- Merge only when the branch is reviewable, required CI is green, and no release-blocking finding remains.
- Do not run database, migration, seed, reset, cron, email, notification, provider-configuration, manual deployment, or production-probe operations.
- Do not read, create, or modify `.env`.

## Child Tasks

1. `08-07-resolve-dependency-release-warnings` — remediate the audit findings and align the Next toolchain.
2. `08-07-publish-and-merge-architecture-cleanup` — perform final integration review, push, PR, CI, and merge after child 1 passes.

## Acceptance Criteria

- [x] Both child tasks pass their acceptance criteria and are archived.
- [x] The complete branch diff receives a final integration review.
- [x] The pull request is merged into `main` only after required CI passes.
- [x] No manual deployment or unauthorized external/database operation is run.
- [x] The final record identifies any residual dependency findings or skipped operational gates truthfully.

## Out of Scope

- Major-version framework, ORM, authentication, or UI-library migrations.
- Production database migrations, data repair, AMEX rollout, provider configuration, or manual Vercel deployment.
- Unrelated package modernization without a current advisory or toolchain-alignment reason.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
