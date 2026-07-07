---
id: ctx-context-core-business-logic
kind: context
importance: 0.65
confidence: confirmed
source: CONTEXT.md#core-business-logic
chunk: null
tokens_est: 312
tags: [context, core-business-logic, benefit-cycle-calculation-system, automated-benefit-status-management]
---

# CONTEXT.md: 🔄 Core Business Logic

## Summary
The heart of the application is the calculateBenefitCycle() function in src/lib/benefit-cycle.ts:

## Use when
- working on 🔄 core business logic

## Key facts
- The heart of the application is the calculateBenefitCycle() function in src/lib/benefit-cycle.ts:
- Purpose: Determines the current active cycle dates for any benefit based on:
- Frequency (monthly/quarterly/yearly)
- Card opening date (for anniversary-based cycles)
- Calendar alignment (fixed dates like Jan-Mar for Q1)

## Retrieval order
- Read `NOW.md` and concise `CONTEXT.md` as the always-read layer.
- Use this card before opening bulky `PLAN.md`, chunks, or raw source sections for this topic.
- Open raw detail only when this summary is insufficient for the task.

## Open next only if needed
- `CONTEXT.md#core-business-logic`
