---
id: ctx-context-recent-updates
kind: context
importance: 0.74
confidence: confirmed
source: CONTEXT.md#recent-updates
chunk: .context-harness/chunks/ctx-context-recent-updates.md
tokens_est: 2222
tags: [context, recent-updates, march-2026-cron-performance-optimization-for-hobby-tier, february-2026-vercel-deployment-fix-direct-url, february-2026-loyalty-subdomain-email-password-auth, january-2025-multiple-oauth-provider-support, september-2025-amex-platinum-2025-benefits-update, february-2025-ux-and-accessibility-improvements, february-2025-migration-backup-test-coverage]
---

# CONTEXT.md: 📝 Recent Updates

## Summary
Date: March 2026

## Use when
- working on 📝 recent updates

## Key facts
- Date: March 2026
- Implementation Status: ✅ Complete
- Changes Implemented:
- check-benefits rewrite: Replaced ~11,224 individual prisma.benefitStatus.upsert() calls with bulk SQL INSERT ... ON CONFLICT (2-3 queries). Execution time: 6...
- send-notifications rewrite: Replaced ~1,400 per-user DB queries with 3 bulk queries + in-memory grouping. Parallelized email sends in batches of 10. Executio...

## Retrieval order
- Read `NOW.md` and concise `CONTEXT.md` as the always-read layer.
- Use this card before opening bulky `PLAN.md`, chunks, or raw source sections for this topic.
- Open raw detail only when this summary is insufficient for the task.

## Open next only if needed
- `CONTEXT.md#recent-updates`
- `.context-harness/chunks/ctx-context-recent-updates.md`
