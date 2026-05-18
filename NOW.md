# Now

## Current Focus
Post-2.0 roadmap implementation is complete through P5, with focused tests and browser screenshots captured.

## Active Blockers
- Full `tsc --noEmit` still fails on preexisting Jest mock typing issues in older `api/user-cards` and `benefit-migration` tests.
- Native Node 24 cannot load local signed native modules (`@next/swc-darwin-arm64`, `lightningcss-darwin-arm64`); use the bundled runtime Node plus `NEXT_TEST_WASM_DIR=node_modules/@next/swc-wasm-nodejs` for local browser/test verification.
- Existing untracked `screenshots/` assets remain parked from the forum screenshot task.

## Immediate Next Step
Review the implementation diff, then decide whether to commit as one roadmap slice or split into duplicate-card, guides/data-quality, docs, and bulk-onboarding commits.

## Session State
- Last modified: 2026-05-17
- Product changes in progress: duplicate-card ROI/filtering, guide discoverability, correction links/provenance, iOS companion plan, and bulk card onboarding.
