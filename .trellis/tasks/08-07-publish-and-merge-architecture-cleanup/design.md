# Design: Publish and merge architecture cleanup

## Review Boundary

Review the entire branch against `main`, not only the dependency follow-up. The PR represents the complete architecture cleanup plus its release-readiness patch.

## Delivery Flow

1. Confirm the dependency child is archived and the worktree is clean.
2. Run current-commit local safe gates and inspect the complete diff/history.
3. Push the existing branch to `origin`.
4. Open a non-draft PR targeting `main`.
5. Monitor required checks using GitHub CLI until completion.
6. If checks fail, diagnose and fix only branch-owned issues, commit, push, and wait again.
7. Merge using an allowed repository merge method, then verify GitHub reports the PR merged and `origin/main` contains the resulting commit.

## Release Semantics

The merge triggers the repository's automatic Vercel release path. This task does not run Vercel CLI, modify aliases/environment values, or claim runtime health without an authorized runtime probe.

## Rollback and Stops

- Any failed required CI or mergeability conflict blocks merge.
- Unexpected schema dependency, migration requirement, secret exposure, or production-operation requirement stops the delivery task for review.
- GitHub merge failure is retried only after understanding the reported repository state; history is not rewritten destructively.
