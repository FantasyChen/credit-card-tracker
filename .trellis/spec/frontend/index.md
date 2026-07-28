# Frontend Engineering Specifications

These specifications cover the Next.js App Router, React client components, shared UI, hooks, browser-side state, TypeScript boundaries, and frontend tests in Perks Reminder.

## Pre-Development Checklist

1. Read [Directory Structure](directory-structure.md) before choosing between `src/app/`, a route-local file, `src/components/`, or `src/lib/`.
2. Read [Component Guidelines](component-guidelines.md) before changing a page, client boundary, shared UI primitive, form, or interactive control.
3. Read [State Management](state-management.md) before adding client fetches, optimistic/local mirrors, provider state, or durable mutations.
4. Read [Type Safety](type-safety.md) before defining props, API payloads, form inputs, Prisma-derived records, or error handling.
5. Read [Hook Guidelines](hook-guidelines.md) before extracting a custom hook.
6. Select checks from [Quality Guidelines](quality-guidelines.md).
7. Also read [Perks Reminder Engineering Specifications](../perks-reminder/index.md) for authentication, domain, database, catalog, cron, deployment, or other external-effect work.

## Topics

- [Directory Structure](directory-structure.md) — route ownership, shared components, primitives, domain modules, and generated code.
- [Component Guidelines](component-guidelines.md) — Server/Client Component boundaries, props, UI composition, and accessibility.
- [Hook Guidelines](hook-guidelines.md) — the repository's deliberately small custom-hook surface.
- [State Management](state-management.md) — provider, local, server, and mutation ownership.
- [Type Safety](type-safety.md) — strict TypeScript, generated types, wire boundaries, validation, and exceptions.
- [Quality Guidelines](quality-guidelines.md) — Jest patterns, mutation matrices, accessibility assertions, and safe checks.

## Quality Check

Before completing frontend work:

- confirm every `'use client'` boundary is required by hooks, browser APIs, or interaction;
- confirm durable writes remain behind authenticated, validated, user-scoped server actions or route handlers;
- confirm loading, authentication, error, empty, and populated states relevant to the changed flow are represented;
- verify labels, semantic elements, keyboard behavior, focus state, and touch target sizing;
- run targeted tests plus `npx tsc --noEmit --pretty false --incremental false` and `git diff --check` when safe;
- follow [Verification](../perks-reminder/verification.md) before any build, Prisma, database, cron, email, provider, or live-browser command.
