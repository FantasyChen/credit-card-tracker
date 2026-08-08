# Delivery review evidence

Recorded 2026-08-07 for `codex/architecture-cleanup`; updated after PR preview failure and branch-owned remediation.

## Readiness review

- `origin/main` resolved to `8f5422234398afb6b8843b8a1fe74b6879a2be07` before publication; the branch had no commits behind.
- The dependency-remediation child is archived at `.trellis/tasks/archive/2026-08/08-07-resolve-dependency-release-warnings/`, with `task.json.status: completed` and evidence retained.
- PR #18 was opened from `codex/architecture-cleanup` against `main`.
- Complete pre-publication review covered 146 changed paths. No Prisma schema/migration, `vercel.json`, GitHub workflow, or provider configuration path changed.

## Preview failure and remediation

- Both Vercel previews failed on commit `feda132` with the same build trace: a Client Component imported `benefit-dashboard.ts`, which reached `effective-benefit.ts`, category-repair migration fingerprinting, and Node-only `node:crypto`.
- Added `src/lib/benefit-dashboard-client.ts` as the client-safe owner of dashboard render DTOs, constants, and pure helpers. Client Components import it directly; `benefit-dashboard.ts` retains server loading/orchestration and re-exports shared contracts for compatibility.
- Added a static boundary regression preventing interactive dashboard components from importing the server owner or adding a runtime effective-benefit dependency.
- The authorized build then exposed two App Router route modules exporting unsupported test helpers. Moved cron insertion logic to `src/lib/cron/check-benefits.ts` and monitoring parsing/sanitization to `src/lib/monitoring/error-report.ts`, preserving route behavior while limiting route exports to supported handlers/configuration.
- Updated indexed frontend/domain specs with the durable client/server and route-export contracts.

## Final verification

Passed on the final local commit candidate:

- `npm test -- --runInBand` — 82 suites passed; 760 tests passed, 1 skipped (761 total).
- `npx tsc --noEmit --pretty false --incremental false` — passed against current generated `.next/types`.
- Changed-source ESLint — passed.
- `npm run check:public-db` — passed.
- `npm run card-template:validate` — passed (1 template).
- `npm run check:amex-userscripts` — passed.
- `python3 ./.trellis/scripts/get_context.py --mode packages` — passed; `perks-reminder` and `frontend` layers discoverable.
- `git diff --check` — passed.
- Authorized `npm run build` — passed twice after remediation; Prisma client 6.19.3 generated with no tracked diff, Next 15.5.23 compiled, and 112 static pages generated. The command loaded existing local environment configuration automatically, disclosed no value, connected to no database, and ran no migration or data operation.
- `npm ls --package-lock-only --depth=0 --all` — passed; Next/SWC/config resolve to 15.5.23 and Prisma/client resolve to 6.19.3.
- Local Markdown link audit across changed Markdown files — passed.

Read-only Vercel preview-log inspection and local build/Prisma generation were explicitly authorized after CI failed. Skipped: Prisma status/migration/seed, database-backed audits or rehearsals, provider configuration/alias changes, cron/email/notification calls, live production probes, and manual deployment. These skips are not claims of production runtime health.

## Sensitive and stale-reference review

- No `.env`, credentials, database connection values, provider state, migration backup, generated Prisma output, or private manifest/evidence path was added.
- Sensitive-pattern matches are limited to intentional test fixtures (`CRON_SECRET`, localhost URLs, and `example.com`/`example.invalid` examples); no real token or secret is present.
- Old AMEX ownership paths have no live references. Removed legacy utility paths are referenced only by existence assertions. Existing historical Cursor prose is unchanged from `origin/main` and is not a live dependency.
- The dependency audit remains documented rather than force-remediated: 6 findings (1 critical, 4 high, 1 low) remain on deferred Next/Auth major-upgrade paths.
