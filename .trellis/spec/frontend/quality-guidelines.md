# Quality Guidelines

## Lint and Static Baseline

- `eslint.config.mjs` extends `next/core-web-vitals` and `next/typescript`; it ignores generated Prisma output, scripts, public assets, coverage, and build output.
- `npm run lint` is the repository command and currently delegates to the deprecated `next lint` wrapper. Report its exit status and diagnostics truthfully; do not call a pre-existing baseline failure a pass or edit unrelated product source to make a documentation task green.
- Type-check with `npx tsc --noEmit --pretty false --incremental false`. `tsconfig.json` is strict and no-emit.
- Always run `git diff --check` for changed code or documentation.

## Test Placement and Style

Jest tests are colocated under `__tests__/` near the owning source. Use the narrowest test that proves the contract:

- pure domain logic: direct unit tests, as in `src/lib/__tests__/benefit-status-transitions.test.ts`;
- Client Components: React Testing Library queries and user-visible behavior, as in `src/components/__tests__/BenefitsDisplayClient.test.tsx`;
- Server Actions: mocked session/Prisma/cache boundaries, as in `src/app/cards/__tests__/actions.test.ts`;
- Route Handlers: request, status, body, authorization, and side-effect assertions.

Prefer `getByRole`, `getByLabelText`, visible text, and behavior over implementation selectors. A `data-testid` is acceptable for a deliberately mocked child boundary or when no semantic query exists.

## Mutation Test Matrix

For a durable frontend mutation, cover every applicable row:

| Case | Required assertions |
| --- | --- |
| Unauthenticated | stable error/throw/redirect contract; no DB read/write |
| Invalid input | validation error; no ownership query or write |
| Missing/wrong owner | no write; no sensitive existence detail beyond the established contract |
| Valid success | exact user-scoped read/write arguments; response shape; affected `revalidatePath` calls |
| Domain edge | transition/materialization output, clamping, cycle boundary, or duplicate-card identity |
| Persistence failure | stable caller-facing error; no false success or revalidation |

Do not silently change a Server Action from throwing to returning an error object (or the reverse) without updating every caller and test; both styles currently exist.

## Global Test Setup

`jest.setup.ts` globally mocks Prisma, NextAuth session resolution, navigation, cache APIs, Vercel Analytics, `fetch`, and Request/Response. Tests must:

- call `jest.clearAllMocks()` in `beforeEach` when shared mocks are involved, then establish the implementations required by that test; `clearAllMocks` clears call state, not mock implementations;
- deliberately extend or override incomplete global Prisma delegates;
- avoid mistaking a global mock for proof that the real framework boundary works;
- use direct pure-function tests for domain calculations whenever possible.

## Accessibility and UI Assertions

For changed controls, assert accessible names, labels, expanded/pressed state, keyboard behavior, and meaningful empty/error content. For async client fetches, cover loading, `401`/signed-out, generic error, empty, and populated branches that the change affects.

## Safe Checks

Typical frontend/spec validation:

```bash
npx tsc --noEmit --pretty false --incremental false
npm test -- --runInBand path/to/target.test.tsx
git diff --check
python3 ./.trellis/scripts/get_context.py --mode packages
```

Use `npm run check:public-db` for anonymous public-surface changes and `npm run card-template:validate` for card-template changes. Follow `../perks-reminder/verification.md`: do not use `npm run build`, Prisma/database commands, cron calls, email sends, or provider operations as routine frontend validation.
