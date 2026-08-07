# Pull request draft

## Title

`refactor: consolidate architecture and harden release dependencies`

## Body

## Summary

- Consolidate dashboard/home benefit projection, subscription handling, and neutral AMEX catalog ownership behind canonical modules.
- Remove superseded migration/search/analytics/UI utilities and stale product/docs assets.
- Refresh the supported Next/SWC/ESLint/Prisma/Auth/Axios dependency set and lockfile within current major versions.

## Verification

- `npm test -- --runInBand` — 81 suites passed; 758 tests passed, 1 skipped.
- Strict TypeScript, public-DB invariant, card-template validation, AMEX userscript artifact checks, package-context discovery, lockfile graph, Markdown-link review, and `git diff --check` passed.
- Dependency audit reduced from 30 findings to 6; remaining findings are documented deferred Next/Auth major-upgrade paths in the archived dependency-remediation evidence.

## Risks and operational skips

- Merging to `main` triggers the automatic Vercel release path. No manual deployment, provider configuration, database/schema operation, cron, email, notification, browser, or production probe was run.
- No Prisma schema or migration changed in this branch.
- Production AMEX/global-benefit confirmation and cleanup remain separately gated.
