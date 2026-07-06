# 📝 Recent Updates


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
