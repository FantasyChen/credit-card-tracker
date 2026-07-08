---
id: ctx-context-learned-patterns
kind: lesson
importance: 0.78
confidence: confirmed
source: CONTEXT.md#learned-patterns
chunk: .context-harness/chunks/ctx-context-learned-patterns.md
tokens_est: 2079
tags: [context, learned-patterns, lesson]
---

# CONTEXT.md: Learned Patterns

## Summary
Resend free transactional quota is recipient-based and 100/day; one email to 481 users consumes 481 quota units, and sent/received emails can both count.

## Use when
- avoiding repeated mistakes or applying prior corrections
- update context with durable lessons

## Key facts
- Resend free transactional quota is recipient-based and 100/day; one email to 481 users consumes 481 quota units, and sent/received emails can both count.
- The local Resend API key is send-only; it cannot list sent emails, so batch scripts need local audit state or deterministic resume points.
- Announcement sends should use Perks Reminder <notifications@perks-reminder.com> explicitly because local .env may still contain the old coupon-cycle.site sen...
- Old coupon-cycle.site and loyalty.coupon-cycle.site aliases currently redirect to the new domains at Vercel level.
- Legacy Subscription State: subscriptionTier and isBetaUser are legacy database/session fields after the free-product pivot. Keep them dormant unless a future...

## Retrieval order
- Read `NOW.md` and concise `CONTEXT.md` as the always-read layer.
- Use this card before opening bulky `PLAN.md`, chunks, or raw source sections for this topic.
- Open raw detail only when this summary is insufficient for the task.

## Open next only if needed
- `CONTEXT.md#learned-patterns`
- `.context-harness/chunks/ctx-context-learned-patterns.md`
