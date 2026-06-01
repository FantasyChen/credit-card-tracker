# Post-2.0 Product Priorities

## Active Slice: Technical Benefit Usage Guides and Compact Dashboard Guide UI

## Goal
Make Benefit Usage Guides feel more like Nitan-informed technical playbooks while keeping each dashboard benefit card compact.

## Progress
- [x] Confirmed Brilliant dining credit community pattern from Nitan posts: DoorDash gift-card marketplace can be used for Amazon-compatible gift cards, with Zift/inventory, DashPass, app/browser/language, and coding caveats.
- [x] Added a Brilliant-specific usage guide for DoorDash Amazon gift-card usage.
- [x] Continued deeper Nitan review across AMEX coupon-book summaries, Platinum playbooks, UA TravelBank master threads, Delta/UA rideshare DPs, Resy Toast/deposit DPs, Saks DP discussion, and Business Gold office-supply GC discussion.
- [x] Added a Business Gold office-supply gift-card guide for the monthly flexible business credit.
- [x] Deepened existing Airline Fee, Rideshare, Resy/Toast, Saks, Lululemon, and Travel Portal guides with DP-specific technical paths and caveats.
- [x] Made usage-guide matching card-aware so generic "$25 Monthly Dining Credit" can route to a product-specific guide.
- [x] Simplified the dashboard benefit-card guide affordance from a large amber block into a compact "How to use" link beside the correction link.
- [x] Verified with focused Jest, `npx tsc --noEmit --pretty false`, dev DB seed, browser e2e for guide pages/index/card link, and dev DB `next build`.
- [x] Pushed `main` to GitHub and confirmed production guide URLs returned 200 after Vercel deployment.

## Decisions
- Keep risky/community-DP patterns framed as repeatable playbooks with caveats, not guaranteed issuer-published redemption methods.
- Mark current/dead risk explicitly: UA TravelBank has old positive DP but current 2026 discussion marks Amex Platinum as likely dead; Uber Eats Family-profile rideshare workaround has recent Amex dead reports.
- Prefer card-specific guide mapping when benefit descriptions overlap across products, with a generic category/description fallback for existing rows.
- Keep dashboard cards focused on tracking state and actions; deeper guide content belongs on the guide detail page.

## Goal
Use the Nitan competitor research to choose the next product slices that strengthen Perks Reminder's clearest wedge: open-source, cross-platform benefit tracking that explains how to actually use expiring value.

## Progress
- [x] Identify closest Nitan-built alternatives: Reward Radar, CardFans, Perkmon/Perkly, PerkPerks, AMEX Benefit Dashboard, Card Verdict, Notion CC Tracker, and Loyalty Hub.
- [x] Compare their posts/comments against Perks Reminder's current positioning.
- [x] Rank next improvements by strategic impact, user pain, and fit with the 2.0 public narrative.
- [x] Before coding, review the current dirty worktree and decide what to preserve, stage, or park.
- [x] Implement the first selected slices through P5.
- [x] Run focused validation and capture browser screenshots.
- [ ] Resolve preexisting whole-project TypeScript test mock errors separately if a clean `tsc --noEmit` gate is needed.

## Near-Term Priority Roadmap

### P0: Worktree Hygiene Before Product Work
Finish or park the existing broad uncommitted work before starting another feature. The current tree has screenshot assets plus prior UI/catalog/config changes, so starting a new product slice without sorting it will make review and rollback painful.

Success signal: `git status --short` is understandable by bucket, and the next implementation touches only the selected product slice.

Status: complete. Preexisting changes were limited to context docs plus parked forum screenshot assets in `screenshots/perks-reminder-2.0-prod/`. Product edits started from a clean application-code baseline.

### P1: Audit Duplicate Card Identity and Per-Card Tracking
Double-check whether duplicate-card tracking is already fully handled. Verify card nickname, last four/five, owner/source labels, benefit cards, filters, bulk actions, ROI views, screenshots, and mobile layouts. If gaps remain, fix those before adding new product surface area.

Why now: The user suspects this may already be done, but competitor comments show duplicate-card ambiguity is one of the fastest ways to lose power users. Perkmon tried benefit merging and later moved back toward clearer per-card tracking.

Success signal: a user with four Aspire cards can immediately tell which quarterly flight credits are unused, on both desktop and mobile.

Status: implemented. Dashboard grouping, card filters, search, and ROI now use per-card IDs/display names instead of collapsing duplicate products by raw card name. Benefit cards show nickname/display name, underlying product, issuer, and last-four/five where available.

### P2: Make Benefit Usage Guides the Core Wedge
Deepen the guide system so every important benefit answers: what qualifies, how to trigger it, timing/posting expectations, common DP caveats, and what to avoid. Surface guide links more prominently inside dashboard and reminders.

Why now: Most competitors track checkboxes; few explain how to use benefits. CardFans' later Nitan tips feature validates that community playbooks are valuable.

Success signal: a user can go from "I have this credit" to "I know exactly how to use it" without leaving Perks Reminder.

Status: implemented. Dashboard cards now surface stronger guide links, the guide index advertises practical guide coverage, and guide detail pages show the checklist users should expect: what qualifies, trigger, timing, caveats, and what to avoid.

### P3: Community Data Quality Loop
Make data quality visible and easier to improve: suggest corrections on every card/benefit/guide, show last-updated dates, and keep admin review/migration flows reliable for existing users.

Why now: Every competitor thread contains card/benefit/rate corrections. Users trust tools that visibly handle errors and update existing accounts, not just new templates.

Success signal: corrections become an obvious workflow, and existing users receive updated benefits/statuses without manual support.

Status: implemented. Card, benefit, and guide surfaces now include correction links with contextual email templates. Catalog and guide pages show last-updated/provenance signals. The maintainer workflow is documented in `docs/community-data-quality-loop.md`.

### P4: Native iOS as a Focused Companion, Not a Full Rewrite
If building iOS, prioritize native-only value: widgets, push notifications, quick mark-complete, and glanceable expiring benefits. Keep the web/PWA as the canonical product and data model.

Why now: Reward Radar's strongest emotional hook is widgets; CardFans/Loyalty Hub show native push and local device affordances matter. A native shell that merely mirrors the web UI is less differentiated.

Success signal: the iOS app makes the existing web product more useful on the lock/home screen.

Status: planned. `docs/ios-support.md` now records the focused companion plan: widgets, push, quick mark-complete, smallest TestFlight milestone, and technical risks.

### P5: Bulk Card Onboarding for Power Users
Build a fast add-cards flow for Nitan-style users with many cards. Accept abbreviations and counts, for example `plat x2, gold, csr, aspire x3`, then let users set owner/nickname/last-four before confirming.

Why after P1-P4: Perkmon and PerkPerks both received strong feedback that adding many cards one-by-one is a conversion blocker, but the current strategy is to first lock down the existing core wedge and data trust story.

Success signal: a user with 20 cards can create a realistic wallet in under two minutes without visiting 20 separate add-card forms.

Status: first shippable version implemented. `/cards/new` accepts shorthand such as `plat x2, gold, csr, aspire x3`, expands counts, lets users review matches, and captures owner/nickname/last digits before one bulk submit.

## Punted Ideas

- **Free Night / Certificate Dashboard:** Still valuable, but punted for now despite strong competitor signal. Revisit after guides/data quality/iOS direction are clearer.
- **Monthly Digest and Calendar Reminder Mode:** Useful and validated by PerkPerks, but lower priority than guide quality, correction workflows, and native companion planning.
- **Best Card by Category:** Valuable but crowded; Reward Radar and PerkPerks compete directly here. Revisit only after the core benefit-tracking wedge is stronger.

## Findings
- Nitan users repeatedly reward tools that are fast, mobile-native feeling, and low-friction at setup.
- The crowded market does not eliminate opportunity; users explicitly say each tool solves a different slice.
- The most common complaint categories are missing cards, inaccurate benefit/rate data, duplicate-card ambiguity, poor bulk onboarding, and unclear reset/completion behavior.
- Users with many cards need owner/nickname/last-four and sometimes P1/P2-style grouping.
- Valuation is subjective and contentious. Keep claimed ROI separate from subjective "true value" unless the assumptions are editable.
- Email-only and calendar-based reminders appeal to users who do not want another app or constant push notifications.

## Decisions
- Treat "tracking plus how to use" as the primary differentiation, not bank-link automation or broad card recommendation.
- Front-load product work in this order: worktree hygiene, duplicate-card tracking audit/fix, Benefit Usage Guides, community data quality, native iOS companion planning, then bulk card onboarding.
- Punt free-night/certificate dashboard, monthly digest/calendar reminders, and best-card-by-category until the front-loaded priorities are handled.
- Keep native iOS framed as a companion for widgets/push/quick actions rather than a replacement for the cross-platform web app.

## Parked
- Domain migration announcement remains paused. If resumed, use `announcement-state/migration-announcement-remaining.txt`, dry run first, send capped batches, and stop on `daily_quota_exceeded`.
