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
- Paid Pro is deprecated. Perks Reminder should present and enforce the current product as completely free, with unlimited cards, reminders, custom reminder windows, loyalty tracking, and data export included for every account.

## Language
- "Nitan" / "泥潭" refers to US Card Forum community research and practical card-user data points.
- "Benefit Usage Guides" are practical, community-informed instructions for using recurring credit card benefits before expiration.
- "Benefit status" is the per-cycle materialized tracking row shown on the dashboard.
- "Predefined" card and benefit data means catalog/template data in Prisma seed records, distinct from user-owned cards and benefits.

## Relationships
- `AGENTS.md` is the small activation layer; `CONTEXT.md` is the durable source of truth, indexed by `scripts/context-index.js`.
- Template benefit changes affect only future card additions unless existing user cards are migrated and benefit statuses are materialized.
- Benefit dashboard rendering should consume projected dashboard data from `src/lib/benefit-dashboard.ts` where practical.
- Guide content should stay practical and action-oriented, with caveats and provenance visible where the UI supports it.
- Legacy `subscriptionTier` and `isBetaUser` database fields may remain for compatibility, but runtime capability checks must not use them to downgrade users or reintroduce paid feature gates.

## Flagged Ambiguities
- None currently flagged.

## Learned Patterns
- Resend free transactional quota is recipient-based and 100/day; one email to 481 users consumes 481 quota units, and sent/received emails can both count.
- The local Resend API key is send-only; it cannot list sent emails, so batch scripts need local audit state or deterministic resume points.
- Announcement sends should use `Perks Reminder <notifications@perks-reminder.com>` explicitly because local `.env` may still contain the old `coupon-cycle.site` sender.
- Old `coupon-cycle.site` and `loyalty.coupon-cycle.site` aliases currently redirect to the new domains at Vercel level.
- **Legacy Subscription State:** `subscriptionTier` and `isBetaUser` are legacy database/session fields after the free-product pivot. Keep them dormant unless a future migration removes them; do not use them for user-facing badges or feature gates.
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
- **Neon Quota Failure Mode:** When Neon compute time quota is exhausted, Prisma may throw `PrismaClientInitializationError` with `ERROR: Your account or project has exceeded the compute time quota`. Public/static generation paths and the homepage dashboard should catch DB unavailability where possible so production can still build and avoid the generic client error boundary.
- **Public DB-Free Catalog:** Anonymous marketing/catalog routes must not query Prisma. `src/lib/static-catalog.ts` is the shared source for public predefined cards and Benefit Usage Guides; `prisma/seed.ts` imports the same data for DB seeding. Run `npm run check:public-db` after public route/catalog changes.
- **Explicit Catalog Seeding:** Production builds must not run `prisma db seed`; use `npm run db:seed` intentionally after verifying the target database when catalog/template data needs updating.
- **Supabase Fallback Gate:** Supabase is the preferred Postgres-compatible fallback if Neon remains unusable, but production cutover waits for a Neon export unless the user explicitly approves an empty fallback DB. Runbook lives in `docs/supabase-fallback.md`.
- **Production Vercel Alias:** `perks-reminder.com`, `www.perks-reminder.com`, and loyalty/coupon-cycle aliases are served by the Vercel `coupon-cycle` project, while this local checkout is also linked to `credit-card-tracker`. For public-domain verification, inspect `vercel ls coupon-cycle` and the custom aliases, not only the local `.vercel/project.json` project.

## Imported Agent Notes
<!-- Migrated from the pre-v3 AGENTS.md during the one-time context-harness upgrade. Keep durable facts here; keep AGENTS.md small. -->

# Imported Agent Instructions
## Context Contract
- At session start/resume, read `NOW.md` first, then use the Context Index
  below to choose relevant `CONTEXT.md` sections.
- Before planning or editing, respect `CONTEXT.md` `## Rules`.
- If the user teaches a durable term, invariant, workflow, constraint, or
  correction, update `CONTEXT.md` before it scrolls away.
- Route task-local findings and decisions to `PLAN.md`; durable lessons to
  `CONTEXT.md`.
- After updating `CONTEXT.md`, run `node scripts/context-index.js update`.
- Before ending, update `NOW.md` with current focus, blockers, next step, and
  touched files.

## Context Index

# Perks Reminder - Complete Project Documentation for AI Agents

> **🤖 PRIMARY AI REFERENCE**: This document is the main source of truth for AI agents working on this project. It contains complete system architecture, business logic, development guidelines, and operational procedures. Always reference this document when making changes or additions to the codebase.

## 🎯 Project Overview

**Perks Reminder** is a free, open-source Progressive Web App that helps users maximize their credit card benefits by tracking recurring perks, managing loyalty programs, and ensuring no valuable benefits expire unused. 

**Problem it Solves:** Credit card users lose hundreds of dollars annually by forgetting to use benefits like annual credits, free nights, and other perks that reset on monthly, quarterly, or yearly cycles.

**Core Mission:** Help users track every credit card benefit cycle, receive timely notifications, and maximize their annual fee ROI.

---

## 🏗️ Current System Architecture

### Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes + Server Actions  
- **Database:** PostgreSQL via Neon (main/prod branch + dev branch)
- **ORM:** Prisma with generated client
- **Authentication:** NextAuth.js with OAuth (Google, GitHub, Facebook) + custom email/password with verification
- **Email:** Resend API for notifications
- **Deployment:** Vercel with automated cron jobs
- **Testing:** Jest with Testing Library
- **UI Components:** Custom components + Headless UI, Heroicons
- **Drag & Drop:** @dnd-kit libraries
- **PWA:** Manifest + service worker support

### Project Structure

```
perks-reminder/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth + email/password auth endpoints
│   │   │   ├── benefits/      # Benefit CRUD operations
│   │   │   ├── user-cards/    # Card management + import/export
│   │   │   ├── predefined-cards/ # Card templates
│   │   │   └── cron/          # Automated jobs
│   │   │       ├── check-benefits/    # Daily benefit status updates
│   │   │       └── send-notifications/ # Email notifications
│   │   ├── benefits/          # Benefits dashboard page
│   │   ├── cards/            # Card management pages
│   │   ├── auth/             # Auth pages (signin, signup, verify, reset)
│   │   ├── loyalty/          # Loyalty program tracking
│   │   ├── loyalty-landing/  # Dedicated landing page for loyalty subdomain
│   │   ├── settings/         # User preferences
│   │   └── contact/          # Contact page
│   ├── middleware.ts          # Subdomain detection & URL rewriting
│   ├── components/           # Reusable React components
│   │   ├── ui/              # Base UI components
│   │   ├── BenefitsDisplayClient.tsx  # Main benefits interface
│   │   ├── DraggableBenefitCard.tsx  # Drag-and-drop functionality
│   │   ├── Navbar.tsx       # Navigation component
│   │   └── Footer.tsx       # Site footer
│   ├── lib/                 # Core business logic
│   │   ├── actions/         # Server actions
│   │   ├── benefit-cycle.ts # Benefit cycle calculations
│   │   ├── auth.ts          # Authentication config
│   │   ├── prisma.ts        # Database client
│   │   └── email.ts         # Email service
│   └── types/               # TypeScript definitions
├── prisma/                  # Database schema & migrations
│   ├── schema.prisma        # Data models
│   ├── migrations/          # Database migrations
│   └── seed.ts             # Predefined card data
├── public/                  # Static assets
│   ├── images/cards/        # Credit card images
│   └── manifest.json        # PWA manifest
├── docs/                    # Project documentation
├── scripts/                 # Utility scripts (see Scripts Reference below)
└── .cursor/
    ├── rules/               # Cursor rules for safety checks
    └── skills/              # AI agent skills for common workflows
```

### Cursor Skills (AI Agent Workflows)

The project includes Cursor skills that guide AI agents through common workflows:

| Skill | Location | Purpose |
|-------|----------|---------|
| `add-new-credit-card` | `.cursor/skills/add-new-credit-card/` | Add new cards with images and benefits |
| `update-card-benefits` | `.cursor/skills/update-card-benefits/` | Update benefits for existing cards |
| `session-recap` | `.cursor/skills/session-recap/` | Post-session self-reflection and documentation updates |

**How to use skills**: AI agents automatically detect when these skills are relevant based on user requests. The skills provide step-by-step guidance for complex multi-step workflows.

### Scripts Reference

| Script | Purpose | Type |
|--------|---------|------|
| `update-card-benefits.js` | Update existing card benefits (3-step process) | Workflow |
| `migrate-benefits.js` | Advanced benefit migration framework | Workflow |
| `validate-migration.js` | Validate migration plans before execution | Workflow |
| `download-card-image.js` | Download card images from Google/UseYourCredits | Workflow |
| `check-database-connection.js` | Verify database connection and environment | Utility |
| `list-available-cards.cjs` | List all predefined cards | Utility |
| `fix-duplicate-benefit-statuses.cjs` | Fix duplicate benefit status records | Maintenance |
| `test-email.cjs` | Test email sending functionality | Testing |
| `test-drag-drop.cjs` | Test drag-and-drop reordering | Testing |
| `test-annual-fee-roi.cjs` | Test ROI calculations | Testing |

---

## 🗄️ Database Schema & Core Models

### User Management
- **User**: Authentication (OAuth + email/password), notification preferences, and settings
- **Account/Session**: NextAuth.js models for OAuth
- **EmailVerificationToken**: Token-based email verification for password signups
- **PasswordResetToken**: Token-based password reset flow

### Card & Benefit System
- **CreditCard**: User's cards with opening dates and card details
- **Benefit**: Individual benefits tied to cards (recurring cycles)
- **BenefitStatus**: Tracks completion status for each benefit cycle
- **PredefinedCard**: Template cards with issuer info and annual fees
- **PredefinedBenefit**: Template benefits linked to predefined cards

### Loyalty Program System
- **LoyaltyProgram**: Airline/hotel programs with expiration rules
- **LoyaltyAccount**: User's individual loyalty accounts with activity tracking

### Key Enums
- **BenefitFrequency**: `MONTHLY`, `QUARTERLY`, `YEARLY`, `ONE_TIME`
- **BenefitCycleAlignment**: `CARD_ANNIVERSARY`, `CALENDAR_FIXED`
- **LoyaltyProgramType**: `AIRLINE`, `HOTEL`, `RENTAL_CAR`, `CREDIT_CARD`

---

## 🔄 Core Business Logic

### Benefit Cycle Calculation System

The heart of the application is the `calculateBenefitCycle()` function in `src/lib/benefit-cycle.ts`:

**Purpose:** Determines the current active cycle dates for any benefit based on:
- Frequency (monthly/quarterly/yearly)
- Card opening date (for anniversary-based cycles)
- Calendar alignment (fixed dates like Jan-Mar for Q1)
- Reference date (typically "now")

**Two Alignment Types:**
1. **CARD_ANNIVERSARY**: Cycles based on when the card was opened
2. **CALENDAR_FIXED**: Cycles based on fixed calendar dates

**Examples:**
- Monthly Uber credit: Resets 1st of each month
- Quarterly travel credit: Resets every 3 months from card anniversary
- Semi-annual hotel credit: Resets every 6 months on calendar dates (Jan-Jun, Jul-Dec)

### Automated Benefit Status Management

**Daily Cron Job** (`/api/cron/check-benefits`):
- Runs daily via Vercel cron
- Updates `BenefitStatus` records for all users
- Creates new cycles, maintains current cycles
- Secured with `CRON_SECRET` header

**Process:**
1. Fetch all user cards with benefits
2. Calculate current cycle dates for each benefit
3. Upsert `BenefitStatus` records (create if new, update if changed)
4. Maintain completion status across cycles

---

## 🎨 Key Features & Implementation

### 1. Benefits Dashboard (`/benefits`)
- **Tabbed Interface**: "Upcoming" and "Claimed" benefits
- **ROI Tracking**: Annual fee vs. claimed benefits analysis
- **Drag & Drop Reordering**: Custom benefit order with persistence
- **Visual Indicators**: Progress bars, completion status, cycle dates
- **Real-time Updates**: Server actions for marking benefits complete

### 2. Card Management (`/cards`)
- **Add New Cards**: From predefined templates with custom opening dates
- **Card Images**: Automated download system using SerpApi
- **Edit/Delete**: Full CRUD operations
- **Benefit Auto-Creation**: Benefits automatically created from templates

### 3. Loyalty Program Tracking (`/loyalty` + `loyalty.perks-reminder.com`)
- **Dedicated Subdomain**: `loyalty.perks-reminder.com` with a standalone landing page
- **Expiration Monitoring**: Track when points/miles expire
- **Activity Tracking**: Record last activity dates
- **Automated Notifications**: Email alerts for expiring points
- **Multiple Programs**: Airlines, hotels, rental cars
- **Shared Auth**: Same account works across main site and loyalty subdomain

### 4. Authentication System
- **OAuth Providers**: Google, GitHub, Facebook (free providers)
- **Email/Password**: Custom signup with bcrypt password hashing
- **Email Verification**: Token-based verification via Resend
- **Password Reset**: Secure token-based reset flow
- **Shared Sessions**: JWT-based sessions work across main site and loyalty subdomain

### 5. Subdomain Routing (Middleware)
- **Detection**: `src/middleware.ts` inspects `Host` header for subdomain
- **Loyalty Subdomain**: `loyalty.*` rewrites `/` → `/loyalty-landing`
- **Header Injection**: Sets `x-subdomain` header for downstream logic

### 6. Progressive Web App (PWA)
- **Installable**: Add to home screen on mobile devices
- **Offline Capable**: Service worker for basic offline functionality
- **Native Feel**: Standalone mode, optimized viewport

### 7. Email Notification System
- **Daily Digest**: New benefit cycles, expiring benefits
- **Loyalty Alerts**: Points expiration warnings
- **User Preferences**: Configurable notification settings
- **Resend Integration**: Professional email delivery

### 8. Data Import/Export (`/settings/data`)
- **JSON Export**: Complete user data backup
- **Import System**: Restore from previous exports
- **Data Recovery**: Essential for database migrations

---

## 🔧 Development Guidelines

### Environment Setup

**Local Development:**
- ✅ **FULLY CONFIGURED**: The project includes a complete `.env` file with all required environment variables
- ✅ **READY TO USE**: No additional configuration needed for local development
- ✅ **AGENT NOTE**: AI agents cannot see the `.env` file directly due to security isolation, but the file exists and is fully configured
- All local commands and the application will automatically read from the existing `.env` file

**Required Environment Variables for Production:**
```bash
# Database
DATABASE_URL="postgresql://..." # Production (pooler endpoint)
DIRECT_URL="postgresql://..."   # Production (direct endpoint, for migrations)
DATABASE_URL_DEV="postgresql://..." # Development branch

# Authentication  
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_URL="http://localhost:3000" # or production URL
NEXTAUTH_SECRET="your-nextauth-secret"

# Services
RESEND_API_KEY="your-resend-api-key"
CRON_SECRET="your-cron-secret"
SERPAPI_API_KEY="your-serpapi-key" # For card image downloads
```

> **DATABASE_URL vs DIRECT_URL**: Neon provides two endpoints: a **pooler** (`-pooler` in hostname) for application queries and a **direct** (no `-pooler`) for migrations. Prisma `migrate deploy` needs advisory locks which only work over the direct connection. The Prisma schema uses `url` for the pooler and `directUrl` for direct.

> **CRITICAL NOTE FOR AI AGENTS:** The `.env` file already exists in this repository and is fully configured with all required environment variables. AI agents cannot access it directly due to security isolation, but local commands and the app will automatically read from `.env`. Do not attempt to create or modify the `.env` file - it already exists and is properly configured.

### Database Safety Rules ⚠️

**Two-Database Setup + Direct URL:**
- `DATABASE_URL` in `.env` → Production pooler (Neon main: `ep-falling-butterfly-...-pooler`)
- `DIRECT_URL` in `.env` → Production direct (same DB, no pooler — used by `prisma migrate deploy`)
- `DATABASE_URL_DEV` in `.env` → Development (Neon dev: `ep-frosty-snowflake`)

**CRITICAL - NEVER RUN on production:**
- `npx prisma migrate reset` (wipes ALL data)
- `npx prisma db push --force-reset`
- Any command with `--force-reset`

**npm Scripts for Database Operations:**
```bash
npm run db:check          # Check both databases and migration status
npm run db:dev:migrate    # Apply pending migrations to dev DB
npm run db:dev:status     # Show dev DB migration status
npm run db:dev:seed       # Seed dev DB with predefined data
npm run db:dev:reset      # Reset dev DB (safe, dev data only)
npm run db:prod:status    # Show production DB migration status
npm run dev:devdb         # Start dev server against dev DB
```

**Safe Development Workflow (always test on dev first):**
1. `npm run db:check` — verify both databases
2. Make schema changes in `prisma/schema.prisma`
3. Create migration: `node scripts/with-dev-db.js npx prisma migrate dev --name your_migration`
4. Test on dev: `npm run dev:devdb`
5. Commit and push — Vercel applies migration to production automatically via `prisma migrate deploy`

**Explicit user-approved production changes:**
- If and only if the human user explicitly requests it, non-destructive operations are acceptable after running `npm run db:check` to confirm the target.
- Allowed non-destructive ops:
  - Seeding/upserting predefined catalog data: `npx prisma db seed`
  - Applying already-generated migrations: `npx prisma migrate deploy`
- Still forbidden on production: destructive resets, manual `DROP` statements, anything that erases user data outside of migrations.

**Database Environment Priority**: Shell variables override `.env` file. Use `unset DATABASE_URL` to clear overrides. Always verify target with `npm run db:check`.

### Adding New Credit Cards

> **Cursor Skill Available**: See `.cursor/skills/add-new-credit-card/SKILL.md` for detailed guidance.

**Quick Steps:**
1. **Research Card**: Verify benefits at [US Credit Card Guide](https://www.uscreditcardguide.com/)
2. **Download Image**: `node scripts/download-card-image.js --name "Card Name"`
3. **Update Seed**: Add card and benefits to `prisma/seed.ts`
4. **Re-seed**: `npx prisma db seed`
5. **Verify**: `node scripts/list-available-cards.cjs`

### Updating Existing Card Benefits

> **Cursor Skill Available**: See `.cursor/skills/update-card-benefits/SKILL.md` for detailed guidance.

⚠️ **CRITICAL**: Updating card benefits requires a **three-step process** to ensure all users see the changes:

1. **Update Templates** - Affects new users who add the card in the future
2. **Migrate Existing Users** - Updates cards for current users
3. **Create Benefit Statuses** - Makes benefits visible in the dashboard

**The problem we solve**: Simply updating the seed file only helps new users. Existing users won't see changes until their cards are migrated AND benefit statuses are created.

---

#### **Unified Update Script (Recommended)**

**Use this single command for the complete update process:**

```bash
# Step 1: Update prisma/seed.ts with new benefits
# (Edit the file manually to add/remove/change benefits)

# Step 2: Update the predefined template (run seed)
npx prisma db seed

# Step 3: Run unified script to complete the update
# Preview changes (dry run)
node scripts/update-card-benefits.js --card "Card Name" --dry-run

# Execute update
node scripts/update-card-benefits.js --card "Card Name" --force
```

**What the unified script does:**
1. ✅ Updates predefined card templates (for new users)
2. ✅ Migrates all existing user cards (for current users)
3. ✅ Creates benefit statuses (makes benefits visible in dashboard)
4. ✅ Transaction-safe (rollback on failure)
5. ✅ Dry run mode for safety

**Example: Adding a quarterly $50 Hilton credit to Amex Business Platinum**

```bash
# 1. Edit prisma/seed.ts - add the new benefit:
{
  description: '$50 Quarterly Hilton Credit (Hilton properties)',
  category: 'Travel',
  maxAmount: 50,
  frequency: BenefitFrequency.QUARTERLY,
  percentage: 0,
  cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
  occurrencesInCycle: 1,
}

# 2. Update template
npx prisma db seed

# 3. Preview migration
node scripts/update-card-benefits.js \
  --card "American Express Business Platinum Card" \
  --dry-run

# 4. Execute migration
node scripts/update-card-benefits.js \
  --card "American Express Business Platinum Card" \
  --force
```

---

#### **Alternative: Advanced Migration Framework**

For complex migrations involving multiple cards or custom logic, use the advanced framework:

```bash
# 1. Create migration in scripts/migrate-benefits.js
# 2. Validate migration
node scripts/validate-migration.js --migration-id=your-migration

# 3. Preview changes (dry run) 
node scripts/migrate-benefits.js --migration-id=your-migration --dry-run

# 4. Execute migration (optionally with backup)
node scripts/migrate-benefits.js --migration-id=your-migration --force
# With backup: saves affected user/card/benefit data to JSON before applying
node scripts/migrate-benefits.js --migration-id=your-migration --force --backup
node scripts/migrate-benefits.js --migration-id=your-migration --force --backup --backup-dir=./backups

# 5. Create benefit statuses (CRITICAL STEP - often forgotten!)
# Run the cron job or use the unified script
```

**Migration backup (optional):** Use `--backup` with `--force` to write a timestamped JSON file of all affected user cards, benefits, and benefit statuses before applying changes. Files are written to `./migration-backups` by default, or to `--backup-dir=DIR`. Useful for auditing or recovery.

**⚠️ Common Mistake**: The advanced framework doesn't automatically create benefit statuses. Users won't see benefits in their dashboard until statuses are created.

---

#### **Benefit Inclusion Criteria**

**Include:**
- Must have cyclical value (credits, points, free nights)
- Must reset on trackable cycles (monthly/quarterly/yearly)
- Verify with reliable sources ([US Credit Card Guide](https://www.uscreditcardguide.com/))

**Exclude:**
- Priority Pass memberships (always-on access, no cyclical reset)
- Lounge memberships (Admirals Club, Centurion Lounge access)
- Insurance benefits (travel insurance, purchase protection)
- Earning rate multipliers (3x points on dining, etc.)
- Elite status benefits (hotel/airline status)
- One-time signup bonuses

### Adding "How to Use" Guides

The system includes step-by-step guides for maximizing credit card benefits, stored in the `BenefitUsageWay` table.

#### Adding New Usage Guides

1. **Define Guide in Seed**: Add to `prisma/seed.ts` around line 1317:

```typescript
const usageWays = [
  // ... existing guides ...
  {
    title: 'How to Use [Benefit Type]',
    slug: 'benefit-type-slug',  // Must be unique, URL-friendly
    description: 'Short description for preview and SEO',
    category: 'Category Name',  // Travel, Dining, Transportation, Entertainment, General
    content: `## Section Title

Your guide content here. Supports markdown-like formatting:

1. **Numbered lists** - Step-by-step instructions
2. **Make qualifying purchase** with the enrolled card
3. **Credit posts** within 1-2 billing cycles

## What Qualifies

- ✈️ Item 1
- 💺 Item 2
- 🍽️ Item 3`,
    tips: [
      'Quick tip 1 - short and actionable',
      'Quick tip 2 - avoid using apostrophes without escaping',
      'Quick tip 3 - these appear in a sidebar',
      'Quick tip 4 - limit to 4-6 tips for readability'
    ]
  }
];
```

2. **Run Seed Command**: `npx prisma db seed`

3. **Automatic Matching**: The system automatically matches benefits to guides based on `category` and `description`

#### Content Formatting

Supported markdown-like syntax:
- `## Heading` - Large section heading
- `**Bold text**` - **Bold text**
- `- List item` - Bullet point
- `1. Numbered item` - Numbered list
- Blank line - Paragraph break
- `💡 🚗 ✈️` - Emojis for visual interest

#### Categories

Use these standard categories for consistency:
- `Travel` - Airlines, hotels, TSA PreCheck, Global Entry
- `Transportation` - Uber, Lyft, parking, tolls
- `Dining` - Restaurants, food delivery (DoorDash, Uber Eats, Grubhub)
- `Entertainment` - Streaming services, events, concerts
- `General` - Statement credits, miscellaneous benefits

### Testing

**Jest test suite** (unit, integration, API, components):
```bash
npm test                                    # Run all tests
```

**Test coverage includes:**
- **Lib:** `benefit-cycle`, `benefit-validation`, `partial-completion`, `benefit-migration` (migration engine and backup)
- **API routes:** `/api/cron/check-benefits`, `/api/cron/send-notifications`, `/api/user-cards`
- **Server actions:** benefits (order, batch, partial), cards (`deleteCardAction`)
- **Components:** `BenefitCardClient`, `BenefitsDisplayClient` (with mocks for child components and actions)

**Database testing (use dev database):**
```bash
npm run db:check                            # Verify both databases
npm run db:dev:migrate                      # Apply migrations to dev DB
npm run dev:devdb                           # Start dev server against dev DB
```

**Other scripts:**
```bash
node scripts/test-drag-drop.cjs            # Test reordering functionality
node scripts/test-annual-fee-roi.cjs       # Test ROI calculations
```

---

## 🚀 Deployment & Operations

### Vercel Configuration

**Automatic GitHub Deployment:**
- ✅ **AUTOMATIC**: Push to main branch → Automatic production deployment
- ✅ **NO MANUAL STEPS**: Vercel handles everything automatically
- ✅ **AGENT NOTE**: AI agents should NOT attempt manual deployment - simply push to GitHub
- Environment variables configured in Vercel dashboard
- Build command: `prisma generate && (prisma migrate deploy || echo 'skipped') && next build`
- Database migrations run automatically via `DIRECT_URL` (non-pooler endpoint); falls back gracefully on timeout
- `DIRECT_URL` env var must be set in Vercel (direct Neon endpoint, no `-pooler`)

**Cron Jobs** (configured in `vercel.json`):
- `/api/cron/check-benefits` — Daily at `0 5 * * *` (5:00 AM UTC). Uses bulk SQL `INSERT ... ON CONFLICT` to upsert all benefit statuses in 2-3 queries (~1.2s for 11K rows). Must complete within 10s (Hobby tier limit).
- `/api/cron/send-notifications` — Daily at `30 5 * * *` (5:30 AM UTC, 30 min after check-benefits). Uses 3 bulk queries + parallel email sends (~2s). Runs after check-benefits so statuses exist before notifications reference them.
- Both require the header `Authorization: Bearer <CRON_SECRET>`
- Both export `maxDuration = 10` (Vercel Hobby tier ceiling)
- **Hobby tier constraint**: 2 cron slots max, daily schedule only — both slots are used

Manual trigger examples:

```bash
# Replace <url> with http://localhost:3000 or the deployed URL
curl -i -X GET -H "Authorization: Bearer $CRON_SECRET" <url>/api/cron/check-benefits

# Notifications cron supports an optional mockDate (non-production only)
# ⚠️ NEVER trigger send-notifications against production locally — it sends real emails
curl -i -X GET -H "Authorization: Bearer $CRON_SECRET" "<url>/api/cron/send-notifications?mockDate=2025-08-15"
```

**Live Domains:**
- `perks-reminder.com` / `www.perks-reminder.com` — Main app (credit card benefits)
- `loyalty.perks-reminder.com` — Loyalty program landing page (subdomain detected by middleware, rewrites `/` → `/loyalty-landing`)

**Domains & deployment:** For domain setup details or deployment troubleshooting, see **docs/vercel-domains-and-deploy.md**.

### Database Management

**Production Database**: Neon PostgreSQL with branching
- Main branch: Production data
- Development branch: Safe testing environment
- Point-in-time recovery available for data incidents

**Verify status anytime:**
```bash
npm run db:check     # Shows both prod + dev status in one command
```

**Migration Process (dev-first):**
1. Make schema changes in `prisma/schema.prisma`
2. Create migration on dev: `node scripts/with-dev-db.js npx prisma migrate dev --name your_migration`
3. Test on dev: `npm run dev:devdb`
4. Commit migration files and push to main
5. ✅ Vercel automatically runs `prisma migrate deploy` on production during build

**Operational note for legacy migration drift:**
- If a historical migration fails because objects already exist / do not exist, make the SQL idempotent (`IF EXISTS` / `IF NOT EXISTS`) and use:
  - `npx prisma migrate resolve --rolled-back <migration_name>`
  - then rerun `npx prisma migrate deploy`
- Do **not** use `migrate reset` on shared/prod databases.

**Production changes on request (non-destructive):**
- When the user asks to update production data (e.g., add or refresh predefined cards/benefits):
  1. Verify target: `node scripts/check-database-connection.js` (ensure it reports production/Neon main)
  2. Run non-destructive seed: `DATABASE_URL="<prod>" npx prisma db seed`
  3. For schema already migrated in code, apply to prod: `DATABASE_URL="<prod>" npx prisma migrate deploy`
  4. Never use reset/force-reset commands on production

### Monitoring & Analytics

- **Vercel Analytics**: Built-in performance monitoring
- **Error Tracking**: Console logging with structured error handling
- **User Activity**: Email notification delivery tracking
- **Cron Observability**: Cron routes log attempt time, authorization presence (never log the secret), counts of processed records, and success/failure totals

### Runbooks

- Cron failures: Re-run manually using the commands above; inspect logs for upserts attempted/succeeded/failed; verify `CRON_SECRET` configured in env and Vercel
- Database incident recovery: Follow the Neon CLI workflow in README (“Database Recovery with Neon CLI”) to branch by timestamp, verify, and switch
- Notification testing: Use `send-notifications?mockDate=YYYY-MM-DD` locally with `Authorization: Bearer $CRON_SECRET` (mockDate ignored in production)

---

## 📱 User Experience & Marketing

### Target Audience
- **Primary**: Tech-savvy credit card enthusiasts, travel hackers, churners
- **Secondary**: Anyone with multiple credit cards wanting better organization
- **Demographics**: High-income professionals, frequent travelers, financial optimizers

### Value Propositions
1. **Never Miss Benefits**: Automated tracking prevents expired perks
2. **ROI Transparency**: Clear annual fee vs. benefits analysis
3. **Centralized Management**: All cards and benefits in one place
4. **Free & Private**: No ads, no data selling, open source
5. **Mobile-First**: PWA for native app experience

### Marketing Channels
- **Reddit Communities**: r/churning, r/personalfinance, r/CreditCards
- **Content Marketing**: Blog posts about maximizing specific card benefits
- **SEO**: Target keywords like "credit card benefit tracker"
- **Word of Mouth**: High-quality tool encourages organic sharing

---

## 🔮 Future Roadmap

### Short Term (Next 3 months)
- [x] **COMPLETED**: Automated benefit migration framework (Sep 2025)
- [ ] Custom card/benefit creation for non-predefined cards  
- [ ] Enhanced mobile app experience
- [ ] Better data visualization and reporting
- [ ] User feedback and rating system

### Medium Term (3-6 months)  
- [ ] Bank account integration for automatic spend tracking
- [ ] Multi-user household management
- [ ] Advanced analytics dashboard
- [ ] API for third-party integrations

### Long Term (6+ months)
- [ ] Machine learning for benefit usage predictions
- [ ] Integration with popular budgeting apps
- [ ] Enterprise features for financial advisors
- [ ] Mobile native apps (iOS/Android)

---

## 🐛 Common Issues & Solutions

### Development Issues

**Database Connection Problems:**
```bash
# Check which database you're connected to
echo $DATABASE_URL
node scripts/check-database-connection.js
```

**Migration Drift:**
```bash
# Switch to dev branch first
export DATABASE_URL=$DATABASE_URL_DEV
npx prisma migrate dev --name fix_drift
```

**Credit Card Benefit Updates (NEW Framework):**
```bash
# Validate migration plan
node scripts/validate-migration.js --migration-id=card-update-2025

# Preview changes (dry run)
node scripts/migrate-benefits.js --migration-id=card-update-2025 --dry-run

# Execute migration safely
node scripts/migrate-benefits.js --migration-id=card-update-2025 --force
```

**Build Failures:**
```bash
# Regenerate Prisma client
npx prisma generate
npm run build
```

### Production Issues

**User Data Loss Prevention:**
- Regular export reminders to users
- Automated backup system considerations
- Point-in-time recovery via Neon CLI
- Automated migration framework preserves completed benefits by default
- **Migration backup:** Use `--backup` with `node scripts/migrate-benefits.js --force` to write a JSON snapshot of affected user data before applying migrations (see Advanced Migration Framework above)

**Migration Framework:**
- Use the automated framework in `scripts/migrate-benefits.js`
- See `docs/benefit-update-quick-guide.md` for quick reference

**Performance Optimization:**
- Database query optimization
- Image loading optimization
- PWA caching strategies

---

## 🤝 Contributing Guidelines

### Types of Contributions Welcome
- 🐛 Bug fixes and issue reports
- 📊 Credit card data updates (most valuable)
- ✨ New feature implementations
- 📚 Documentation improvements
- 🧪 Test coverage expansion

### Code Standards
- **TypeScript**: Strict typing required
- **ESLint**: Follow configured rules
- **Testing**: Add tests for new features
- **Accessibility**: Follow WCAG guidelines
- **Performance**: Optimize for mobile-first

### Pull Request Process
1. Fork repository and create feature branch
2. Follow coding standards and add tests
3. Update documentation if needed
4. Submit PR with clear description
5. Respond to review feedback promptly

---

## 📞 Support & Community

### Getting Help
- **Issues**: GitHub Issues for bugs and feature requests
- **Discussions**: GitHub Discussions for general questions
- **Email**: Contact form on website for sensitive issues

### Community Resources
- **Live App**: [www.perks-reminder.com](https://www.perks-reminder.com/)
- **Repository**: [GitHub](https://github.com/lifan-builds/perks-reminder)
- **Documentation**: This file and `/docs` folder
- **Support Creator**: [Buy me a coffee](https://coff.ee/fantasy_c)

### Community Posts (Announcements)
- **美卡论坛 (US Card Forum)** — [做了个极简工具追踪里程/积分活动日期 + expire前邮件提醒](https://www.uscardforum.com/t/topic/487571) (Mar 2026) — Loyalty subdomain launch post in 航空常旅客 (aviation/travel) section; promotes [loyalty.perks-reminder.com](https://loyalty.perks-reminder.com/) for tracking miles/points activity dates and email reminders; cross-references main site for credit card benefit tracking

---

## 📄 License & Legal

- **License**: MIT License - free for personal and commercial use
- **Data Privacy**: No user data collection beyond necessary functionality
- **Open Source**: Fully transparent codebase
- **No Warranty**: Provided as-is for community benefit

---

## 📝 Recent Updates

### March 2026: Cron Performance Optimization for Hobby Tier
**Date**: March 2026
**Implementation Status**: ✅ Complete

**Changes Implemented**:
- **check-benefits rewrite**: Replaced ~11,224 individual `prisma.benefitStatus.upsert()` calls with bulk SQL `INSERT ... ON CONFLICT` (2-3 queries). Execution time: 63s → 1.2s (52x faster)
- **send-notifications rewrite**: Replaced ~1,400 per-user DB queries with 3 bulk queries + in-memory grouping. Parallelized email sends in batches of 10. Execution time: 25.7s → 2.1s (12x faster)
- **Separated cron schedules**: `check-benefits` at `0 5 * * *`, `send-notifications` at `30 5 * * *` (staggered by 30 min)
- **maxDuration = 10**: Both crons explicitly set to Hobby tier ceiling

**Root Cause**: Vercel Hobby tier enforces 10s serverless function timeout. Both crons were exceeding this limit due to thousands of individual DB round trips, causing silent daily failures and missing benefit statuses.

**Technical Notes**:
- `check-benefits` uses `prisma.$executeRawUnsafe()` with `INSERT ... ON CONFLICT` for bulk upsert — bypasses Prisma ORM type safety, so any `BenefitStatus` schema changes require updating the raw SQL manually
- `send-notifications` fetches all potentially relevant data in 3 queries (new statuses, expiring statuses, expiring loyalty accounts) then filters per-user in memory based on each user's notification settings
- Both Vercel Hobby cron slots are now used (2/2 max)

---

### February 2026: Vercel Deployment Fix (DIRECT_URL)
**Date**: February 2026
**Implementation Status**: ✅ Complete

**Changes Implemented**:
- **Root cause fixed**: `prisma migrate deploy` was timing out because Neon's connection pooler doesn't support PostgreSQL advisory locks
- **DIRECT_URL**: Added `directUrl` to Prisma schema pointing to Neon's non-pooler endpoint; added `DIRECT_URL` env var to Vercel (all environments) and local `.env`
- **Resilient build**: Build command now falls back gracefully if migration deploy fails
- **outputFileTracingRoot**: Added to `next.config.ts` to fix Vercel workspace detection

---

### February 2026: Loyalty Subdomain & Email/Password Auth
**Date**: February 2026
**Implementation Status**: ✅ Complete

**Changes Implemented**:
- **Email/Password Auth**: Custom signup system with bcrypt hashing, email verification tokens, and password reset flow — alongside existing Google/GitHub/Facebook OAuth
- **Loyalty Subdomain**: `loyalty.perks-reminder.com` serves a dedicated landing page via Next.js middleware subdomain detection
- **Shared Authentication**: Same user accounts work across `perks-reminder.com` and `loyalty.perks-reminder.com`
- **New Routes**: `/auth/signup`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/loyalty-landing`
- **New API Endpoints**: `/api/auth/signup`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`
- **Schema Changes**: `User.password`, `EmailVerificationToken`, `PasswordResetToken` models
- **Vercel Domain**: `loyalty.perks-reminder.com` added to Vercel project with CNAME DNS record

---

### January 2025: Multiple OAuth Provider Support
**Date**: January 17, 2025  
**Implementation Status**: ✅ Complete

**Changes Implemented**:
- **Simplified Authentication**: Configured free OAuth providers (Google, GitHub and Facebook) only, removing paid options
- **Clean Sign-in UI**: Streamlined sign-in page with only free OAuth options
- **Provider Icons**: Added official brand icons for Google, GitHub and Facebook

**Technical Implementation**:
1. ✅ **NextAuth Configuration**: Updated `src/lib/auth.ts` with free OAuth providers only
2. ✅ **UI Enhancement**: Redesigned `src/app/auth/signin/page.tsx` with three provider options
3. ✅ **Environment Variables**: Simplified to only include free OAuth provider credentials

**User Impact**: Users can now sign in using free OAuth providers (Google, GitHub or Facebook), providing a cost-effective authentication solution without requiring paid developer programs.

---

### September 2025: AMEX Platinum 2025 Benefits Update
**Date**: September 18, 2025  
**Implementation Status**: ✅ Complete

**Changes Implemented**:
- **Annual Fee Update**: Both cards increased from $695 → $895
- **American Express Platinum Card**: Updated with 12 new benefits including quarterly Resy dining credit ($100), quarterly Lululemon credit ($75), enhanced hotel credits ($600 total), and more
- **American Express Business Platinum Card**: Updated with 7 new benefits including enhanced hotel credits ($600), Dell Technologies credit ($1,150), Adobe credit ($250), and high-spender benefits

**Technical Implementation**:
1. ✅ **Seed Data Updated**: Modified `prisma/seed.ts` with new benefit structures and annual fees
2. ✅ **Production Templates Updated**: Non-destructive seed operation applied to production database  
3. ✅ **Migration Script Created**: `scripts/migrate-amex-2025-benefits.js` for existing user cards (280+ cards found)
4. ✅ **Testing Completed**: Dry-run testing successful on all user cards

**Migration Instructions**:
```bash
# Dry run to see what would change
node scripts/migrate-amex-2025-benefits.js --dry-run

# Apply changes to existing user cards
node scripts/migrate-amex-2025-benefits.js --force
```

**User Impact**: Existing AMEX Platinum cardholders will receive updated benefits in their next benefit cycle after running the migration script.

---

### February 2025: UX and Accessibility Improvements
**Date**: February 2, 2025  
**Implementation Status**: ✅ Complete

**Changes Implemented**:
- **Dark mode toggle**: ThemeProvider (next-themes) and ThemeToggle in Navbar; users can cycle light/dark/system
- **Loading skeletons**: Skeleton.tsx with CardSkeleton, BenefitCardSkeleton, SummaryWidgetSkeleton, DashboardSkeleton, CardsPageSkeleton, BenefitsPageSkeleton; Cards page uses CardsPageSkeleton while loading
- **Reusable EmptyState**: EmptyState component with icons and optional primary/secondary actions; used on Cards page and BenefitsDisplayClient
- **Footer enhancement**: Product, Settings, Legal, and Community link groups; Privacy, Terms, GitHub, Contact, etc.
- **Settings hub**: Unified `/settings` page with account info, Notifications and Import/Export cards, quick actions, and privacy notice link
- **Accessibility**: SkipLink to main content, main landmark with id and tabIndex for focus; Navbar wrapped in header with role="banner" and nav with aria-label
- **Privacy and Terms pages**: `/privacy` and `/terms` added so footer and settings links no longer 404

---

### February 2025: Migration Backup & Test Coverage
**Date**: February 2025  
**Implementation Status**: ✅ Complete

**Migration CLI backup:**
- **`--backup`**: When used with `--force`, the migration framework writes a timestamped JSON file of all affected user cards, benefits, and benefit statuses *before* applying changes. Default directory: `./migration-backups`; override with `--backup-dir=DIR`.
- **Engine**: `MigrationOptions.backupWriter` callback; engine calls it per user card when `backupUserData` is true. CLI collects contexts and writes one file per run (e.g. `migration-backup-{plan.id}-{timestamp}.json`).

**Test coverage added:**
- **Components:** `src/components/__tests__/BenefitCardClient.test.tsx`, `src/components/__tests__/BenefitsDisplayClient.test.tsx` (tabs, summary widgets, empty state, view toggle).
- **API:** `src/app/api/user-cards/__tests__/route.test.ts` (GET: 401 unauthenticated, 200 with data, 500 on error).
- **Server actions:** `src/app/cards/__tests__/actions.test.ts` (`deleteCardAction`: auth, validation, not-found, delete, error handling).
- **Migration:** `BenefitMigrationEngine` backup test (backupWriter called per user card with correct context). Jest setup: `prisma.creditCard.findUnique` added for ownership checks.

**Next Set of Tasks** (for future sessions):
1. **Medium**: Break up BenefitsDisplayClient into smaller components (e.g. BenefitSummaryWidgets, BenefitTabs, BenefitListView)
2. **Medium**: Standardize API error response format across routes; add user-friendly error messages on Cards and other pages
3. **Medium**: Add mockDate test for send-notifications cron (TODO in route.test.ts)
4. **Low**: Roadmap features: custom card/benefit creation, better data visualization, user feedback system
5. **Low**: SEO: JSON-LD on more pages, dynamic OG images; PWA: offline fallback, push notifications

---

*Last Updated: March 2026*
*Version: 1.19*
*Created by: fantasy_c*

---

> **Note for AI Agents**: This document provides complete context for the Perks Reminder project. Use this information to understand the system architecture, business logic, and development practices when assisting with code changes, feature additions, or debugging. Always follow the database safety rules and maintain the high code quality standards established in this project.
