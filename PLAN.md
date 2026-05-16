# Workspace Triage and Next Steps

## Goal
Make the current repository state easy to reason about so the next implementation slice can be chosen deliberately.

## Current State
- The tracker focus pack is documented as complete.
- The worktree is dirty with broad uncommitted changes that should be preserved, not reverted.
- The previous domain migration announcement plan is parked, not the active coding lane.

## Active Cleanup Tasks
- [x] Read `NOW.md`, `CONTEXT.md`, and active `PLAN.md`.
- [x] Inspect the dirty worktree at a high level.
- [x] Reconcile `NOW.md` and `PLAN.md` around a single active focus.
- [ ] Review the dirty worktree by bucket and decide what should be finished, tested, staged, parked, or split.
- [ ] Run focused validation for the bucket selected as the next active work.

## Worktree Buckets To Review
- **UI consistency pass:** multiple App Router pages plus shared components now use tighter page headers, card surfaces, and button sizing.
- **Card image ingestion/catalog:** image download script has validation/manifest support; card assets changed from PNG to JPG/AVIF for two Chase cards; new manifest and image utility files exist.
- **Seed/catalog expansion:** `prisma/seed.ts` has large catalog/guide changes and should be reviewed separately from UI work.
- **Config/migration hygiene:** `jest.config.mjs`, `next.config.ts`, `scripts/with-dev-db.js`, and two migration SQL files changed.
- **Tracker focus pack residue:** dashboard/test wording changed from "earned" to "claimed"; ensure this belongs with the completed tracker focus pack or fold it into UI polish.

## Recommended Next Actions
1. Review and validate the existing uncommitted changes before starting new product work.
2. Split the dirty work into coherent commits or at least coherent review buckets.
3. After the tree is understandable, choose one active next slice:
   - free-night/certificate dashboard slice, or
   - remaining domain-migration announcement batch.

## Parked: Domain Migration Announcement

### Goal
All existing users receive one clear announcement that CouponCycle is now Perks Reminder, with no duplicate sends and a recoverable batch process.

### Previous Progress
- [x] Create migration announcement email content.
- [x] Send one live smoke test to `fantasychen2016@gmail.com`.
- [x] Start production send through Resend from `notifications@perks-reminder.com`.
- [x] Stop sending after Resend returned `daily_quota_exceeded`.
- [x] Save sent and remaining recipient lists in `announcement-state/`.
- [ ] Send remaining users in daily capped batches after quota resets.
- [ ] Re-audit remaining list after each batch.

### Previous Findings
- Intended recipient count was 481 after excluding `@example.com` test accounts.
- First quota failure was `mlee092161@gmail.com`.
- Local state recorded 195 sent and 286 remaining.
- Resend free plan quota is recipient-based, so daily quota can be consumed quickly by production announcements.

### Resume Rules
- Use `announcement-state/migration-announcement-remaining.txt` as the next-batch source.
- Use `--limit` for future batches so normal transactional reminders still have quota headroom.
- Stop immediately on `daily_quota_exceeded`.
- Dry run and report recipient count before any live send.
