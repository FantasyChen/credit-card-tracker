# Keep benefit card groups stable after completion

## Goal

Keep the benefit dashboard spatially predictable: completing or restoring an entry must not cause the surrounding physical-card groups to jump to new positions.

## Background

- The card view groups statuses by physical `CreditCard.id`, preserving separate groups for duplicate card products.
- `src/components/BenefitsDisplayClient.tsx:422-430` currently sorts each tab's card groups by the sum of the benefits visible in that group.
- Completing an upcoming benefit moves it into the claimed collection. That lowers the upcoming card group's visible total and immediately re-sorts every card group.
- The mutation and optimistic totals are otherwise behaving as intended; this task changes only group ordering and its regression coverage.

## Requirements

- Preserve physical-card identity as the group key; cards with the same product/display name must remain separate.
- Order physical-card groups alphabetically by card display name, with card ID as the deterministic tie-breaker for duplicate display names. The order must not depend on completion state, used amount, or which statuses remain in the active tab.
- Keep custom benefits in their established first position.
- Continue applying the selected benefit sort within each card group.
- Cover completion-driven movement with a focused client-component regression test.
- Validate the behavior through the rendered benefit UI: record the visible card-group order, complete a benefit while its card still has another Upcoming entry, confirm the remaining groups keep the same order, restore the entry, and confirm the order remains stable. Restore the tested benefit to its original state before finishing.
- After local checks and UI validation, commit only task-owned files and push an isolated feature branch. Vercel's Git integration must automatically create the Preview deployment from that push; do not substitute a manual deployment.
- If the pushed commit does not produce a Vercel Preview deployment, verify the exact Git repository and Vercel project connection and repair the automatic Git deployment path, then verify the same pushed commit deploys successfully.

## Acceptance Criteria

- [x] Given at least two physical-card groups, completing a benefit does not change the relative order of the card groups that remain visible in Upcoming.
- [x] Restoring a claimed benefit does not reorder existing card groups in Upcoming.
- [x] Same-name physical cards continue to render as separate groups with deterministic tie-breaking by card ID.
- [x] Custom Benefits remains before physical-card groups when present.
- [x] The focused `BenefitsDisplayClient` test passes, strict TypeScript passes, and `git diff --check` passes.
- [x] Browser validation demonstrates unchanged card-group order across complete and restore interactions, and the tested benefit ends in its original state.
- [ ] Only task-owned files are committed; existing unrelated working-tree changes remain untouched.
- [ ] The isolated feature branch is pushed and Vercel automatically deploys that exact commit to Preview; the deployment reaches Ready and the deployed benefits surface receives a narrow smoke check.
- [ ] If automatic deployment is initially absent or failed because of Git integration configuration, the exact repo/project connection is repaired and auto-deployment is re-verified without manually deploying the application.

## Out of Scope

- Server action, database, Prisma, benefit-transition, totals, and tab-membership changes.
- Persisted user-defined card ordering or drag-and-drop reordering.
- Changes to category-group ordering or card-level ROI ranking.
- Database migrations, direct database access, cron, email, notification, or provider-configuration changes beyond a narrowly verified Vercel Git-integration repair if automatic Preview deployment is absent.
- Production deployment or merge to `main`.

## Notes

- The code change is client-only; browser verification and the conditional Git-integration repair are covered by `design.md` and `implement.md` as an operational release plan.
- The current checkout is six commits ahead of `origin/main`, three commits ahead of its remote feature branch, and contains unrelated uncommitted work. Release isolation is required; those changes must not be folded into this task's commit or push.
