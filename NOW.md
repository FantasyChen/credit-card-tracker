# Now

## Current Focus
Closed the loyalty sign-out/auth-state fix and deployed it to production.

## Active Blockers
- Local macOS Node 24 still has native module signature issues for `@next/swc-darwin-arm64` and `lightningcss-darwin-arm64`; focused Jest worked with `NEXT_TEST_WASM_DIR=/Users/lfan/Project/credit-card-tracker/node_modules/@next/swc-wasm-nodejs`.

## Immediate Next Step
If auth state looks stale again, first verify production `/sw.js` has `perks-reminder-static-v2` and that `/api/force-signout` performs the two-step cookie-clearing redirect.

## Session State
- Last modified: 2026-05-19T20:58:52Z
- Touched files: `src/components/Navbar.tsx`, `src/components/__tests__/Navbar.test.tsx`, `src/app/api/force-signout/route.ts`, `public/sw.js`.
- Verification: `npx tsc --noEmit --pretty false`, focused navbar Jest, production endpoint/header checks, production `sw.js`, and Playwright signed-out loyalty flow.
