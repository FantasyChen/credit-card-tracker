# Now

## Current Focus
Completed the "completely free" product pivot: paid Pro/Beta is deprecated in runtime behavior and user-facing copy, while legacy subscription database/session fields remain dormant for compatibility.

## Active Blockers
- No active implementation blockers.
- Local checks still show the non-blocking Next SWC version warning (`@next/swc` 15.5.7 detected while Next.js is 15.5.11).
- A sandboxed `node scripts/with-dev-db.js npx next build` compiled but could not reach the Neon dev database during static page data collection; rerunning the same build with network approval passed.

## Immediate Next Step
Review the free-product pivot diff and deploy when ready. No database migration is required for this slice.

## Session State
- Last modified: 2026-06-22T22:28:51Z
- Touched files: `CONTEXT.md`, `NOW.md`, `PLAN.md`, `src/lib/subscription.ts`, `src/lib/subscription-limits.ts`, `src/lib/auth.ts`, `src/lib/actions/cardUtils.ts`, `src/lib/notification-digest.ts`, `src/lib/__tests__/subscription.test.ts`, `src/app/api/auth/signup/route.ts`, `src/app/api/cron/send-notifications/__tests__/route.test.ts`, `src/app/page.tsx`, `src/app/pricing/page.tsx`, `src/app/settings/page.tsx`, `src/app/settings/notifications/page.tsx`, `src/app/settings/notifications/actions.ts`, `src/app/settings/notifications/NotificationSettingsForm.tsx`, `src/app/settings/notifications/__tests__/actions.test.ts`, `src/components/PricingSection.tsx`, `src/components/FAQ.tsx`, `src/components/HowItWorks.tsx`, `src/components/Navbar.tsx`, `src/components/__tests__/PricingSection.test.tsx`, `src/components/__tests__/Navbar.test.tsx`.
- Verification: `node scripts/context-index.js update`, focused `env NEXT_TEST_WASM_DIR=/Users/lfan/Project/credit-card-tracker/node_modules/@next/swc-wasm-nodejs npm test -- subscription PricingSection Navbar settings/notifications send-notifications` (`5` suites, `27` passing, `1` skipped), `npx tsc --noEmit --pretty false`, `node scripts/with-dev-db.js npx next build` with network approval, and `git diff --check`.
