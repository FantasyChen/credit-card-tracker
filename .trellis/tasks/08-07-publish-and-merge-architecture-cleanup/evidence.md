# Delivery review evidence

Recorded 2026-08-07 for the current local commit `d24a8329f5b2590c6eeb62b92be2333f94f1fdf1` on `codex/architecture-cleanup`.

## Readiness review

- `origin/main` resolves to `8f5422234398afb6b8843b8a1fe74b6879a2be07`; the branch is 18 commits ahead and has no commits behind.
- The dependency-remediation child is archived at `.trellis/tasks/archive/2026-08/08-07-resolve-dependency-release-warnings/`, with `task.json.status: completed` and its evidence retained. The dependency update and archive are committed in `1f67a3b` and `d24a832`.
- The only local worktree changes are the parent agent's in-progress task metadata and these task-local review drafts (`task.json`, `evidence.md`, and `pr-draft.md`); no application, package, or generated path is locally modified.
- Complete branch review: 146 changed paths, 2,482 insertions, and 8,103 deletions. The branch contains architecture/documentation cleanup, neutral AMEX catalog ownership, dashboard/subscription consolidation, legacy utility removal, and the dependency remediation. No Prisma schema/migration, `vercel.json`, GitHub workflow, or provider configuration path changed.

## Safe checks

Passed on the exact current commit:

- `npm test -- --runInBand` — 81 suites passed; 758 tests passed, 1 skipped (759 total).
- `npx tsc --noEmit --pretty false --incremental false` — passed.
- `npm run check:public-db` — passed.
- `npm run card-template:validate` — passed (1 template).
- `npm run check:amex-userscripts` — passed.
- `python3 ./.trellis/scripts/get_context.py --mode packages` — passed; `perks-reminder` and `frontend` layers discoverable.
- `git diff --check origin/main...HEAD` — passed.
- `npm ls --package-lock-only --depth=0 --all` — passed; lockfile root graph is internally consistent. Targeted Next/SWC/ESLint/Prisma graph resolves to Next/SWC/config `15.5.23` and Prisma/client `6.19.3`.
- Local Markdown link audit across 46 changed Markdown files — passed; no broken local links.

Skipped by safety boundary: Next build, Prisma generation/status/migration/seed, database-backed audits or rehearsals, Vercel/provider commands, cron/email/notification calls, browser/live production probes, and manual deployment. These skips are not claims of runtime health. Changed-source ESLint is not applicable to the dependency-only follow-up; the full branch's prior source checks are retained in the archived architecture-cleanup evidence.

## Sensitive and stale-reference review

- No `.env`, credentials, database connection values, provider state, migration backup, generated Prisma output, or private manifest/evidence path was added.
- Sensitive-pattern matches are limited to intentional test fixtures (`CRON_SECRET`, localhost URLs, and `example.com`/`example.invalid` examples); no real token or secret is present.
- Old AMEX ownership paths have no live references. Removed legacy utility paths are referenced only by the branch's existence assertions. Existing `.github/pull_request_template.md` `CURSOR` wording and the Vercel runbook's historical “from Cursor” note are unchanged from `origin/main` and are classified as pre-existing prose, not live dependencies.
- The dependency audit remains intentionally documented rather than force-remediated: 6 findings (1 critical, 4 high, 1 low) remain on deferred Next/Auth major-upgrade paths, as recorded by the archived child evidence.

## PR draft

### Title

`refactor: consolidate architecture and harden release dependencies`

### Body

## Summary

- Consolidate dashboard/home benefit projection, subscription handling, and neutral AMEX catalog ownership behind their canonical modules.
- Remove superseded migration/search/analytics/UI utilities and stale product/docs assets.
- Refresh the supported Next/SWC/ESLint/Prisma/Auth/Axios dependency set and lockfile within current major versions.

## Verification

- `npm test -- --runInBand` — 81 suites, 758 passed, 1 skipped.
- Strict TypeScript, public-DB invariant, card-template validation, AMEX userscript artifact checks, package-context discovery, lockfile graph, Markdown links, and `git diff --check` passed.
- Dependency audit reduced from 30 findings to 6; remaining findings require deferred Next/Auth major-upgrade decisions and are documented in the archived child evidence.

## Risks and operational skips

- This merge is an automatic Vercel release; no manual deployment, provider configuration, database/schema operation, cron, email, notification, browser, or production probe was run.
- No Prisma schema or migration changed in this branch.
- Production AMEX/global-benefit confirmation and cleanup remain separately gated.
