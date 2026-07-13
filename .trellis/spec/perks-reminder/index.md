# Perks Reminder Engineering Specifications

These specifications are the durable project context for Perks Reminder, a Next.js 15 / React 19 / TypeScript PWA backed by Prisma and PostgreSQL.

## Pre-Development Checklist

1. Read [Architecture and Domain Invariants](architecture-and-domain.md) before changing data flow, authentication, benefit cycles, notifications, public routes, or product access.
2. Read [Database and Data Safety](database-and-data-safety.md) before running any command that can connect to a database or changing Prisma schema, migrations, seed data, or scripts.
3. For card, benefit, guide, or catalog changes, follow [Catalog and Benefit Updates](catalog-and-benefit-updates.md); template changes alone do not update existing users.
4. Read [Deployment and External Effects](deployment-and-external-effects.md) before builds, deployments, cron calls, email/notification work, Vercel changes, or production-domain checks.
5. Choose checks from [Verification](verification.md). Never substitute a production-affecting command for a safe static check.
6. Do not read, create, copy, or modify `.env`; secrets and runtime configuration stay outside Git and in provider dashboards or existing local state.

## Topics

- [Architecture and Domain Invariants](architecture-and-domain.md) — package layout, business-logic owners, public DB-free behavior, auth/PWA constraints, and free-product rules.
- [Database and Data Safety](database-and-data-safety.md) — target verification, forbidden commands, migration/seed policy, fallback caveats, and rollback.
- [Catalog and Benefit Updates](catalog-and-benefit-updates.md) — verified sources, template validation, existing-user migration, status materialization, and usage-guide coverage.
- [Deployment and External Effects](deployment-and-external-effects.md) — automatic production deployment, build side effects, cron limits, email safety, domains, and secrets.
- [Verification](verification.md) — safe check matrix and truthful reporting requirements.
- [Documentation and Release Notes](documentation-and-release-notes.md) — durable context ownership and release-note conventions.

## Quality Check

Before completing work:

- confirm all database and external-effect commands were either safely scoped or explicitly skipped;
- confirm `.env`, credentials, provider state, browser/session data, `.vercel/`, generated output, and migration backups were not added;
- for catalog changes, confirm source provenance, static catalog/seed consistency, existing-user disposition, status materialization, and guide-link disposition;
- run the applicable safe checks in [Verification](verification.md), plus `git diff --check`;
- inspect every changed and untracked path and classify residual Context Harness or Cursor references;
- run `python3 ./.trellis/scripts/get_context.py --mode packages` and verify that `perks-reminder` is discoverable.
