# Design: Finish architecture cleanup delivery

## Boundaries

The parent task coordinates two sequential children. Dependency readiness must complete before the branch is published for final CI and merge. The original architecture task remains archived and unchanged.

## Release Flow

1. Apply scoped same-major dependency updates and verify locally with safe static/test gates.
2. Review the complete `main...codex/architecture-cleanup` diff and commit sequence.
3. Push the branch and open a ready pull request against `main`.
4. Observe required GitHub CI to completion and fix only branch-owned failures.
5. Merge through GitHub when review and CI gates pass.

## Safety and Rollback

- Dependency changes are isolated in their own commit and can be reverted independently.
- Do not use automatic audit remediation or major-version upgrades.
- Local package installation uses `--ignore-scripts` to avoid the repository postinstall Prisma generation step.
- A failed CI or review gate blocks merge; it does not authorize database, provider, or production intervention.
- Because `main` auto-deploys, merge is the sole authorized release operation in this task; no manual Vercel action follows.
