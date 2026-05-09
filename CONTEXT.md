# Context

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

### Objectives
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

## Learned Patterns
- Resend free transactional quota is recipient-based and 100/day; one email to 481 users consumes 481 quota units, and sent/received emails can both count.
- The local Resend API key is send-only; it cannot list sent emails, so batch scripts need local audit state or deterministic resume points.
- Announcement sends should use `Perks Reminder <notifications@perks-reminder.com>` explicitly because local `.env` may still contain the old `coupon-cycle.site` sender.
- Old `coupon-cycle.site` and `loyalty.coupon-cycle.site` aliases currently redirect to the new domains at Vercel level.
- **NextAuth Session State:** You can expose database fields (like `subscriptionTier` and `isBetaUser`) to the client without repeated DB hits by mapping them in the NextAuth `jwt` and `session` callbacks.
- Nitan competitor research shows the clearest product wedge is privacy-first manual tracking plus community-verified benefit/loyalty data, not bank-link automation against MaxRewards/CardPointers.
