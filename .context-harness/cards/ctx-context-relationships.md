---
id: ctx-context-relationships
kind: invariant
importance: 0.82
confidence: confirmed
source: CONTEXT.md#relationships
chunk: null
tokens_est: 177
tags: [context, relationships, invariant]
---

# CONTEXT.md: Relationships

## Summary
AGENTS.md is the small activation layer; CONTEXT.md is the durable source of truth, indexed by scripts/context-index.js.

## Use when
- changing architecture or domain relationships
- update context invariants

## Key facts
- AGENTS.md is the small activation layer; CONTEXT.md is the durable source of truth, indexed by scripts/context-index.js.
- Template benefit changes affect only future card additions unless existing user cards are migrated and benefit statuses are materialized.
- Benefit dashboard rendering should consume projected dashboard data from src/lib/benefit-dashboard.ts where practical.
- Guide content should stay practical and action-oriented, with caveats and provenance visible where the UI supports it.
- Legacy subscriptionTier and isBetaUser database fields may remain for compatibility, but runtime capability checks must not use them to downgrade users or re...

## Open next
- `CONTEXT.md#relationships`
