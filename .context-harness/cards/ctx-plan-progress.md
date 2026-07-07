---
id: ctx-plan-progress
kind: plan
importance: 0.85
confidence: confirmed
source: PLAN.md#progress
chunk: null
tokens_est: 173
tags: [plan, progress]
---

# PLAN.md: Progress

## Summary
Updated subscription access helpers so stored FREE and PRO users resolve to full free access; beta mode is disabled and beta enrollment is a no-op.

## Use when
- continuing the active task
- checking done criteria or decisions
- update context with task-local progress

## Key facts
- Updated subscription access helpers so stored FREE and PRO users resolve to full free access; beta mode is disabled and beta enrollment is a no-op.
- Removed the card-add limit branch, notification reminder-window lock, email-alert limit UI, Pro/Beta navbar badge, and Pro/Beta pricing copy.
- Reworked /pricing into a free-product commitment page and updated homepage, FAQ, settings, and notification settings language.
- Added/updated focused tests for subscription access, pricing, navbar, notification settings, and notification digest behavior.
- Verified with focused Jest, npx tsc --noEmit --pretty false, node scripts/with-dev-db.js npx next build, and git diff --check.

## Retrieval order
- Read `NOW.md` and concise `CONTEXT.md` as the always-read layer.
- Use this card before opening bulky `PLAN.md`, chunks, or raw source sections for this topic.
- Open raw detail only when this summary is insufficient for the task.

## Open next only if needed
- `PLAN.md#progress`
