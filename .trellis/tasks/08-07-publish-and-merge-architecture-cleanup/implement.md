# Implementation Plan: Publish and merge architecture cleanup

1. Verify dependency child completion, clean worktree, branch identity, remote identity, and absence of an existing PR.
2. Inspect `main...HEAD` commits, stats, full diff, deleted paths, documentation links, stale references, and sensitive patterns.
3. Run the exact safe gates appropriate to the complete branch and record passed/failed/skipped outcomes.
4. Push `codex/architecture-cleanup` to `origin`.
5. Create a ready PR against `main` with the integrated change and verification summary.
6. Wait for required CI; diagnose/fix/reverify/push any branch-owned failure.
7. Confirm PR mergeability and required checks, then merge using the repository-supported method.
8. Verify GitHub PR state is merged and fetch/read remote state without running provider or production probes.
9. Commit/archive Trellis delivery records and update the developer journal as permitted by the workflow.

## Validation and Stop Conditions

- No merge while checks are pending/failing, conflicts exist, or release-blocking audit findings remain without explicit disposition.
- Do not run local build, Prisma generation/migration/status/seed, provider commands, cron, email, notification, or live production checks.
- Do not rewrite published history or force-push.
