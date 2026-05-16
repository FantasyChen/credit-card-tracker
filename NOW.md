# Now

## Current Focus
Triage the active worktree and choose the next focused slice before making more code changes.

## Active Blockers
- The worktree has broad uncommitted changes across UI polish, card image ingestion, seed/catalog data, config, and migrations.
- `PLAN.md` previously tracked an older domain-migration announcement batch while `NOW.md` pointed at the next competitor-roadmap slice; that split made the active lane unclear.

## Immediate Next Step
Review the current worktree buckets, decide whether to validate/finish the existing changes first or park them, then choose one next slice.

Recommended order:
1. Validate and finish the existing uncommitted work.
2. Then choose between the free-night/certificate dashboard slice and the remaining domain-migration announcement batch.

## Session State
- Last modified: 2026-05-16
- Context cleanup only; no application code was changed in this pass.
- Existing dirty worktree was preserved as-is.

## Worktree Buckets
- Dashboard/tracker focus: `src/components/BenefitsDisplayClient.tsx`, dashboard tests, and related helper files from the completed tracker focus pack.
- UI consistency pass: auth, cards, loyalty, settings, home page, navbar, empty states, and new shared UI components.
- Card image ingestion/catalog: `scripts/download-card-image.js`, new image utility/tests, card image manifest, image format swaps, and seed changes.
- Config/migration hygiene: Jest/Next config, dev DB script, and two migration SQL edits.

## Parking Lot
- Domain migration announcement: previous plan says 195 sent and 286 remaining. Resume only with a dry run, capped sends, and `announcement-state/` as the source of truth.
- Competitor roadmap: next proposed product slice is a free-night/certificate dashboard, pending approval/design.
