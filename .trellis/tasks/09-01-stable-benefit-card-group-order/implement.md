# Implementation Plan

1. Activate the task and load the implementation context.
2. Change the card-group comparator in `BenefitsDisplayClient` to Custom-first, then alphabetical display name, then card ID.
3. Add focused component coverage for stable order across completion and restoration, preserving duplicate-card identity coverage.
4. Run the targeted component test, strict TypeScript, and `git diff --check`.
5. Start the safe local application path and validate the rendered benefit UI through the browser. Complete and restore one benefit, proving group order stays stable and the original state is restored.
6. Run the Trellis quality check and inspect the complete task-owned diff without touching unrelated changes.
7. Commit only task-owned files.
8. Create an isolated `codex/` branch from `origin/main`, apply only the task commit, and push it.
9. Verify Vercel automatically creates a Preview deployment for the exact pushed commit and reaches Ready. If it does not, verify and narrowly repair the exact repo/project Git integration; do not manually deploy.
10. Smoke-check the deployed benefits surface. Record the result, archive the completed task, and report the pushed branch and Preview outcome.

## Validation Commands

```bash
npm test -- --runInBand src/components/__tests__/BenefitsDisplayClient.test.tsx
npx tsc --noEmit --pretty false --incremental false
git diff --check
```

No build, Prisma, database, cron, email, notification, or production command is part of this plan.
