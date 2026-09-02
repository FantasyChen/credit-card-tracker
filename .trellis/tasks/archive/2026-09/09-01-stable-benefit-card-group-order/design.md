# Design: Stable benefit card-group order

## Code Boundary

`BenefitsDisplayClient` remains the owner of interactive grouping. `groupBenefitsByCard` will continue grouping by physical card ID and will change only its top-level comparator:

1. Custom Benefits sorts first.
2. Physical cards sort by `displayName` using `localeCompare`.
3. Equal display names sort by physical card ID.

Benefit sorting inside each group remains unchanged. Completion, restoration, totals, server actions, and persistence are untouched.

## Regression Coverage

Extend the existing `CategoryBenefitsGroup` test double so a test can invoke `onStatusChange`. Use two physical-card groups and leave a second Upcoming benefit on the completed benefit's card. Assert the group order before completion, after completion, and after restoration. Retain the existing duplicate-card identity test and cover Custom Benefits ordering through the comparator behavior.

## Browser Validation

Use the rendered `/benefits` UI in an authenticated browser session. Capture only visible group labels and pass/fail evidence—no credentials, session material, or private row data. Complete one suitable benefit, verify the remaining groups do not move, restore it, and verify both order and original completion state are restored. Do not access the database or `.env`.

## Release Path

Commit only this task's application, test, task, and journal/spec files. Because the current checkout contains unrelated commits and edits, create an isolated `codex/` feature branch from `origin/main` and apply only the task commit there. Push that branch.

Vercel Git integration must automatically create a Preview deployment for the pushed commit. Verify the commit/deployment association and Ready state, then smoke-check the deployed benefits surface. Do not run a manual Vercel deployment and do not merge or deploy `main`.

If no automatic deployment appears, verify the exact GitHub repository and intended Vercel project before changing provider state. Repair only the Git integration needed for branch Preview deployments, then verify that the same commit is deployed automatically. Stop if project identity is ambiguous, a production target would be affected, or the repair would require broader repository/provider changes.

## Rollback

The code rollback is a revert of the isolated task commit. A failed Preview deployment does not authorize production changes. Any unexpected UI mutation stops browser validation after restoring only the benefit changed by the test.
