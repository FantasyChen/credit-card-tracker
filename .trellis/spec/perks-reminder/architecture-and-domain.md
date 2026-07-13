# Architecture and Domain Invariants

## Application boundaries

- `src/app/` owns App Router pages, API routes, server actions, authentication routes, and cron endpoints.
- `src/components/` owns shared UI and dashboard components.
- `src/lib/` owns reusable business logic; `prisma/` owns schema and migration history; `scripts/` owns explicit operational tooling.
- PostgreSQL is accessed through Prisma. Authentication uses NextAuth with OAuth and email/password flows. Resend handles transactional email. Vercel hosts the application and cron jobs.

## Business-logic owners

- `src/lib/benefit-dashboard.ts` shapes benefit statuses into dashboard tabs, totals, usage-guide links, and per-card ROI. Do not duplicate that projection in pages/components.
- `src/lib/benefit-cycle-materialization.ts` creates normalized `BenefitStatus` rows from benefit/card/date context. Cron, card creation, migrations, and custom-benefit creation should share it.
- `src/lib/benefit-status-transitions.ts` owns completion, partial completion, reset, direct amount edits, and not-usable transitions. Server actions validate through it before persistence.
- `src/lib/notification-digest.ts` owns notification selection, user reminder windows, digest assembly, quota checks, batching, and delivery. Cron routes should stay limited to authorization/date parsing and response handling.
- Physical cards are keyed by `CreditCard.id`; display names may include nickname/last digits. Never group duplicate products solely by product name.

## Durable product invariants

- Perks Reminder is free: all accounts receive unlimited cards and reminders, custom reminder windows, loyalty tracking, and import/export. Legacy `subscriptionTier` and `isBetaUser` fields may remain for compatibility but must not restore paid gates or badges.
- Template benefit changes affect future card additions only unless existing user cards are migrated and benefit statuses are materialized.
- Important recurring credits should link to practical Benefit Usage Guides with caveats and provenance. Keep claimed ROI separate from subjective value assumptions.
- Public anonymous marketing/catalog routes must not query Prisma. `src/lib/static-catalog.ts` is the shared DB-free catalog source and `prisma/seed.ts` consumes the same data.
- Multi-year benefits use `YEARLY` plus `CARD_ANNIVERSARY` and `fixedCycleDurationMonths`; cycle calculation and materialization must preserve the full duration.

## Authentication and PWA safety

- Main and loyalty subdomains share authentication. Sign-out must clear both host-only and shared `.perks-reminder.com` NextAuth cookies.
- NextAuth owns `/api/auth/*`; custom force-sign-out endpoints belong outside that route.
- Do not cache navigated HTML or Next runtime chunks cache-first. Stale user/session markup can leak signed-in state or cause hydration mismatches. Prefer network-first/no-cache navigation, unregister the service worker in local development, and bump cache names when caching behavior changes.
