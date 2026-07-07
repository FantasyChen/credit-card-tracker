---
id: ctx-context-database-schema-core-models
kind: context
importance: 0.65
confidence: confirmed
source: CONTEXT.md#database-schema-core-models
chunk: null
tokens_est: 270
tags: [context, database-schema-core-models, user-management, card-benefit-system, loyalty-program-system, key-enums]
---

# CONTEXT.md: 🗄️ Database Schema & Core Models

## Summary
User: Authentication (OAuth + email/password), notification preferences, and settings

## Use when
- working on 🗄️ database schema & core models

## Key facts
- User: Authentication (OAuth + email/password), notification preferences, and settings
- Account/Session: NextAuth.js models for OAuth
- EmailVerificationToken: Token-based email verification for password signups
- PasswordResetToken: Token-based password reset flow
- CreditCard: User's cards with opening dates and card details

## Retrieval order
- Read `NOW.md` and concise `CONTEXT.md` as the always-read layer.
- Use this card before opening bulky `PLAN.md`, chunks, or raw source sections for this topic.
- Open raw detail only when this summary is insufficient for the task.

## Open next only if needed
- `CONTEXT.md#database-schema-core-models`
