# Context
<!-- context-harness:schema v3 -->

## Project
Perks Reminder is a free, open-source Next.js 15 / React 19 / TypeScript PWA for tracking recurring credit card benefits, free nights/certificates, loyalty program expirations, and reminder emails. It uses Prisma with Neon Postgres, NextAuth, Resend, Vercel cron jobs, Tailwind CSS, and Jest.

## Structure
```
src/app/          Next.js App Router pages, API routes, auth, cron jobs
src/components/   Shared UI and dashboard components
src/lib/          Auth, Prisma, email, benefit-cycle, and migration logic
prisma/           Schema, migrations, seed data
scripts/          Operational scripts for DB checks, email tests, migrations
docs/             Runbooks, migration notes, SEO and domain docs
public/           PWA assets and credit card images
announcement-state/ Local ignored state for one-time announcement batches
```

## Rules

### Never
1. Never run destructive production database commands such as `prisma migrate reset`, `db push --force-reset`, or manual data deletion unless the user explicitly asks and the target is verified.
2. Never create or modify `.env`; assume it already exists locally and production secrets live in Vercel/provider dashboards.
3. Never send production email batches without a dry run, recipient count, and a resumable state or limit.

### Always
1. Always verify database target before production data work; use `npm run db:check` or the narrow script's own dry run first.
2. Always keep changes surgical and aligned with existing Next.js, Prisma, and Tailwind patterns.
3. Always run focused tests or build checks for code changes; for frontend changes, verify the rendered behavior when practical.

### Legacy Objectives
<!-- Deprecated in schema v3. Preserve as project intent; use PLAN.md Done Criteria and Workflow Verification for active checks. -->
1. Users can sign in on `perks-reminder.com` and see unchanged cards, benefits, loyalty accounts, and settings after the domain migration.
2. Reminder emails send from `notifications@perks-reminder.com` and link to the new main and loyalty domains.
3. Existing users are informed before `coupon-cycle.site` expires on May 27, 2026, without duplicate announcement sends.

## Workflow
- Setup: `npm install`
- Run: `npm run dev`
- Run with dev DB: `npm run dev:devdb`
- Test: `npm test`
- Build: `npx next build`
- DB check: `npm run db:check`

## Public Narrative
- The published Nitan / US Card Forum 2.0 announcement positions Perks Reminder around a major UI refresh, especially mobile responsiveness and logged-in usability.
- Benefit Usage Guides are now part of the public 2.0 story: they summarize forum/community playbooks, common DP-style advice, and practical steps for using recurring credits before expiration.
- A native iOS app is publicly framed as a possible future roadmap item after validating interest in the 2.0 web/PWA experience.
- Real logged-in 2.0 screenshots for forum/social use live in `screenshots/perks-reminder-2.0-prod/` and use the dedicated production demo account `demo+screenshots@perks-reminder.com`.

## Product Strategy
- The front-loaded product priorities from Nitan competitor research are: worktree hygiene, duplicate-card tracking audit/fix, deeper Benefit Usage Guides, visible community data correction, native iOS companion planning, then bulk card onboarding.
- Punt free-night/certificate dashboard, monthly digest/calendar reminders, and best-card-by-category until the front-loaded priorities are handled.
- Keep Perks Reminder's wedge centered on open-source cross-platform tracking plus practical usage guidance; avoid trying to out-native Reward Radar/CardFans or out-email PerkPerks in one step.
- If iOS work starts, make widgets, push notifications, and quick completion the native value rather than rebuilding the whole web app first.

## Language
- "Nitan" / "泥潭" refers to US Card Forum community research and practical card-user data points.
- "Benefit Usage Guides" are practical, community-informed instructions for using recurring credit card benefits before expiration.
- "Benefit status" is the per-cycle materialized tracking row shown on the dashboard.
- "Predefined" card and benefit data means catalog/template data in Prisma seed records, distinct from user-owned cards and benefits.

## Relationships
- Template benefit changes affect only future card additions unless existing user cards are migrated and benefit statuses are materialized.
- Benefit dashboard rendering should consume projected dashboard data from `src/lib/benefit-dashboard.ts` where practical.
- Guide content should stay practical and action-oriented, with caveats and provenance visible where the UI supports it.

## Flagged Ambiguities
- None currently flagged.

## Learned Patterns
- Resend free transactional quota is recipient-based and 100/day; one email to 481 users consumes 481 quota units, and sent/received emails can both count.
- The local Resend API key is send-only; it cannot list sent emails, so batch scripts need local audit state or deterministic resume points.
- Announcement sends should use `Perks Reminder <notifications@perks-reminder.com>` explicitly because local `.env` may still contain the old `coupon-cycle.site` sender.
- Old `coupon-cycle.site` and `loyalty.coupon-cycle.site` aliases currently redirect to the new domains at Vercel level.
- **NextAuth Session State:** You can expose database fields (like `subscriptionTier` and `isBetaUser`) to the client without repeated DB hits by mapping them in the NextAuth `jwt` and `session` callbacks.
- Nitan competitor research shows the clearest product wedge is privacy-first manual tracking plus community-verified benefit/loyalty data, not bank-link automation against MaxRewards/CardPointers.
- **Benefit Dashboard Projection:** `src/lib/benefit-dashboard.ts` owns shaping BenefitStatus records into dashboard tabs, totals, usage-guide slugs, and card-level ROI. Keep dashboard math there instead of duplicating it in pages or components.
- **Benefit Cycle Materialization:** `src/lib/benefit-cycle-materialization.ts` owns turning a Benefit plus card/start-date context into normalized BenefitStatus rows. Use it from cron, card creation, migrations, and custom benefit creation when status rows are needed.
- **Benefit Status Transitions:** `src/lib/benefit-status-transitions.ts` owns completion, partial completion, reset, direct amount edit, and not-usable state transitions. Server actions should call it before persisting BenefitStatus changes.
- **Notification Digest Pipeline:** `src/lib/notification-digest.ts` owns notification candidate selection, per-user reminder windows, digest assembly, quota checks, batching, and delivery; the cron route should stay limited to auth/date parsing and response handling.
- **Duplicate Card Identity:** Dashboard filters, grouping, and ROI should use the physical `CreditCard.id` plus display names, not only the product name. Product-name grouping collapses multiple Aspire/Platinum copies and hides which credit belongs to which card.
- **Community Corrections:** Card, benefit, and guide surfaces should expose contextual correction links and provenance/last-updated signals. Maintainer workflow lives in `docs/community-data-quality-loop.md`; template changes still need seed plus existing-user migration/status creation.
- **Usage Guide Coverage Audit:** Run `node scripts/with-dev-db.js npm run usage-guides:audit` after catalog or guide-link changes. The audit queries material recurring predefined credits and should report zero missing `usageWayId` links before a catalog update is considered complete.
- **Card Lifecycle Tracking:** `CreditCard` now owns lifecycle status, annual-fee due date/amount, sign-up/spend deadlines, product-change fields, and lifecycle notes. `CreditCardEvent` owns timeline history. New cards should get annual-fee defaults and an `OPENED` event through `createCardForUser`.
- **Multi-Year Benefit Cycles:** Security-screening credits and similar four-year benefits are modeled as `YEARLY` with `CARD_ANNIVERSARY` plus `fixedCycleDurationMonths` (for example `48`). `calculateBenefitCycle` must honor the multi-year duration so these credits do not materialize as annual benefits.
- **Dev DB Wrapper:** `scripts/with-dev-db.js` intentionally spawns commands without an extra shell so quoted arguments such as `--card "Chase Sapphire Preferred"` reach child scripts intact.
- **Bulk Onboarding:** The first power-user bulk add flow lives on `/cards/new` and parses shorthand such as `plat x2, gold, csr, aspire x3`. Owner is currently folded into the saved nickname/display label rather than a separate household-owner schema field.
- **iOS Companion Direction:** `docs/ios-support.md` is the source for native iOS planning. Keep iOS focused on widgets, push notifications, quick mark-complete, and glanceable expiring benefits.
- **Auth-Sensitive Navigation:** Do not cache navigated HTML pages in the PWA service worker because routes like `/loyalty` and `/benefits` contain user-specific session state; use network-first/no-cache navigation and bump SW cache names when changing auth-sensitive caching.
- **Cross-Domain Sign-Out:** For `www` plus `loyalty` subdomain auth issues, sign-out must clear both host-only cookies and shared `.perks-reminder.com` NextAuth cookies. NextAuth `/api/auth/*` is reserved by the catch-all route, so custom force sign-out endpoints should live outside that path.
- **Catalog Migration Status Repair:** `scripts/update-card-benefits.js` must keep using the shared `src/lib/benefit-cycle-materialization.ts` path for status creation. If a prior migration leaves overlapping active status rows, use `scripts/fix-duplicate-active-benefit-statuses.ts` with `--dry-run` first; it preserves completed, not-usable, and partially used rows.
