---
id: ctx-context-operating-constraints
kind: constraints
importance: 0.9
confidence: confirmed
source: CONTEXT.md#operating-constraints
chunk: null
tokens_est: 282
tags: [context, operating-constraints, constraints]
---

# CONTEXT.md: Operating Constraints

## Summary
Do not run destructive production database commands such as prisma migrate reset, db push --force-reset, or manual data deletion unless the user explicitly asks and the target is verified.

## Use when
- before planning or editing
- checking project constraints
- update context safely

## Key facts
- Do not run destructive production database commands such as prisma migrate reset, db push --force-reset, or manual data deletion unless the user explicitly a...
- Do not create or modify .env; assume it already exists locally and production secrets live in Vercel/provider dashboards.
- Do not send production email batches without a dry run, recipient count, and a resumable state or limit.
- Verify database target before production data work; use npm run db:check or the narrow script's own dry run first.
- Keep changes surgical and aligned with existing Next.js, Prisma, and Tailwind patterns.

## Open next
- `CONTEXT.md#operating-constraints`
