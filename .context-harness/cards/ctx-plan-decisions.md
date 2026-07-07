---
id: ctx-plan-decisions
kind: plan
importance: 0.85
confidence: confirmed
source: PLAN.md#decisions
chunk: null
tokens_est: 107
tags: [plan, decisions]
---

# PLAN.md: Decisions

## Summary
Make the pivot code-backed: every account gets unlimited cards, unlimited email reminders, custom reminder windows, loyalty tracking, and data import/export.

## Use when
- continuing the active task
- checking done criteria or decisions
- update context with task-local progress

## Key facts
- Make the pivot code-backed: every account gets unlimited cards, unlimited email reminders, custom reminder windows, loyalty tracking, and data import/export.
- Keep subscriptionTier and isBetaUser database/session fields as dormant legacy state for now to avoid an unnecessary schema migration.
- Keep /pricing as a stable route, but make it explain the free-product commitment instead of comparing Free and Pro plans.

## Retrieval order
- Read `NOW.md` and concise `CONTEXT.md` as the always-read layer.
- Use this card before opening bulky `PLAN.md`, chunks, or raw source sections for this topic.
- Open raw detail only when this summary is insufficient for the task.

## Open next only if needed
- `PLAN.md#decisions`
