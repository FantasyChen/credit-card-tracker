# Perks Reminder Engineering Specifications

These specifications are the durable project context for Perks Reminder, a Next.js 15 / React 19 / TypeScript PWA backed by Prisma and PostgreSQL.

## Pre-Development Checklist

1. Read [Architecture and Domain Invariants](architecture-and-domain.md) before changing data flow, authentication, benefit cycles, notifications, public routes, or product access.
2. Read the [Frontend Engineering Specifications](../frontend/index.md) before changing App Router pages, Client Components, shared UI, hooks, browser state, frontend types, or UI tests.
3. Read [Database and Data Safety](database-and-data-safety.md) before running any command that can connect to a database or changing Prisma schema, migrations, seed data, or scripts.
4. Read [Global Benefit Definitions and Migration](global-benefit-definitions-and-migration.md) before changing catalog keys/synchronization, standard/custom status sources, effective benefit reads, propagation/retirement, legacy migration/cleanup/rollback, or global AMEX destination authority.
5. Read [Browser-Side Authenticated Read Integrations](browser-read-integrations.md) before adding a userscript, extension, or browser flow that reads a provider through the user's existing session.
6. Read [AMEX Sync Reconciliation](amex-sync-reconciliation.md) before changing AMEX catalog identity, product/benefit matching, sync envelopes, card resolution, status reconciliation, handoff UI, or destination authority.
7. For card, benefit, guide, or catalog changes, follow [Catalog and Benefit Updates](catalog-and-benefit-updates.md); checked-in source changes require key-preserving global synchronization and explicit status propagation.
8. Read [Deployment and External Effects](deployment-and-external-effects.md) before builds, deployments, cron calls, email/notification work, Vercel changes, or production-domain checks.
9. Choose checks from [Verification](verification.md). Never substitute a production-affecting command for a safe static check.
10. Do not access `.env` by default. An explicitly requested repair may inspect and update only named values in an existing Git-ignored local `.env` under the narrow contract in [Database and Data Safety](database-and-data-safety.md); never create, copy, display, or commit secret values. Provider runtime configuration stays in provider dashboards.

## Topics

- [Architecture and Domain Invariants](architecture-and-domain.md) — package layout, business-logic owners, public DB-free behavior, auth/PWA constraints, and free-product rules.
- [Browser-Side Authenticated Read Integrations](browser-read-integrations.md) — manual session-bound reads, conservative normalization, private first-party handoff, confirmed synchronization, replay safety, and synthetic browser validation.
- [AMEX Sync Reconciliation](amex-sync-reconciliation.md) — current envelope V3, bounded source resolution, global-definition destination authority, exact-last-five matching, explicit-field status overwrite, and atomic December Uber persistence.
- [Global Benefit Definitions and Migration](global-benefit-definitions-and-migration.md) — immutable catalog keys, non-destructive synchronization, standard/custom status union, effective projection, propagation/retirement, exact legacy transition gates, cleanup/rollback, and AMEX global authority.
- [Database and Data Safety](database-and-data-safety.md) — target verification, forbidden commands, migration/seed policy, schema-dependent deployment completeness, sanitized single-user production-to-development cloning, fallback caveats, and rollback.
- [Catalog and Benefit Updates](catalog-and-benefit-updates.md) — verified sources, global catalog synchronization, existing-card propagation, status materialization, and usage-guide coverage.
- [Deployment and External Effects](deployment-and-external-effects.md) — automatic production deployment, build side effects, cron limits, email safety, domains, and secrets.
- [Verification](verification.md) — safe check matrix and truthful reporting requirements.
- [Documentation and Release Notes](documentation-and-release-notes.md) — durable context ownership and release-note conventions.

## Quality Check

Before completing work:

- confirm all database and external-effect commands were either safely scoped or explicitly skipped;
- confirm `.env`, credentials, provider state, browser/session data, `.vercel/`, generated output, and migration backups were not added;
- for catalog changes, confirm source provenance, immutable key/parent validity, static source/synchronizer consistency, retirement/reactivation behavior, existing-card status propagation, and guide-link disposition;
- run the applicable safe checks in [Verification](verification.md), plus `git diff --check`;
- inspect every changed and untracked path and classify residual Context Harness or Cursor references;
- run `python3 ./.trellis/scripts/get_context.py --mode packages` and verify that the single-repo `perks-reminder` and `frontend` spec layers are discoverable.
