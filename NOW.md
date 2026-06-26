# Now

## Current Focus
Implemented and locally verified the Neon quota recovery hardening plan: anonymous public catalog/guide/referral/sitemap surfaces now use a static shared catalog instead of Prisma, deploy builds no longer run `prisma db seed`, and public DB-free invariants/build checks are in place. Supabase fallback is documented but not cut over.

## Active Blockers
- Neon production and dev databases are currently unavailable due to provider compute quota exhaustion: `ERROR: Your account or project has exceeded the compute time quota. Upgrade your plan to increase limits.` Code can degrade more gracefully, but DB-backed app features will stay unavailable until the Neon quota is restored, upgraded, or reset.
- Local checks still show the non-blocking Next SWC version warning (`@next/swc` 15.5.7 detected while Next.js is 15.5.11).
- `npm run db:check` now executes again, but Neon prod/dev still report migration status errors while quota/provider access is unavailable.

## Immediate Next Step
Commit and push the Neon hardening, then verify the production direct page URL after Vercel deploys. After deployment, inspect Vercel logs for anonymous Prisma traffic and clean unused Neon branches/computes in the Neon console. If Neon remains unusable after quota reset/restoration, follow `docs/supabase-fallback.md`.

## Session State
- Last modified: 2026-06-26T18:06:25Z
- Touched files: `CONTEXT.md`, `NOW.md`, `package.json`, `next.config.ts`, `prisma/seed.ts`, `docs/supabase-fallback.md`, `scripts/check-database-connection.js`, `scripts/check-public-db-invariant.cjs`, `scripts/check-public-build-without-db.cjs`, `src/lib/static-catalog.ts`, `src/lib/cardSearchUtils.ts`, `src/lib/home-dashboard-data.ts`, `src/lib/__tests__/static-catalog.test.ts`, `src/app/page.tsx`, `src/app/cards/browse/page.tsx`, `src/app/cards/browse/[name]/page.tsx`, `src/app/cards/new/page.tsx`, `src/app/api/predefined-cards/route.ts`, `src/app/api/predefined-cards-with-benefits/route.ts`, `src/app/api/search/route.ts`, `src/app/benefits/how-to-use/page.tsx`, `src/app/benefits/how-to-use/[slug]/page.tsx`, `src/app/referrals/page.tsx`, `src/app/sitemap.ts`, `src/components/SupportedCreditCards.tsx`, `src/components/__tests__/SupportedCreditCards.test.tsx`, `src/middleware.ts`.
- Verification: `npm run check:public-db`, `npx tsc --noEmit --pretty false`, `npm test -- static-catalog SupportedCreditCards`, `npm run check:public-build:no-db`, `npm run build` (passes; migration deploy skipped due Neon schema engine error), local production server with intentionally unreachable DB URLs, direct `curl` 200 checks for `/`, `/cards/browse/American%20Express%20Gold%20Card`, `/benefits/how-to-use/airline-fee-credits`, `/referrals`, `/sitemap.xml`, `/api/predefined-cards`, `/api/predefined-cards-with-benefits`, and `/api/search?q=gold`, targeted HTML assertions for homepage/card content with no generic error text, and in-app browser render of the direct card page showing `American Express Gold Card` with no generic error boundary. `npm run db:check` runs but Neon still errors while quota/provider access is unavailable.
