# Research: Existing authenticated API and mutation patterns

- **Query**: Find existing API route/server-action authentication, validation, idempotency, mutation, error, revalidation, and CORS patterns relevant to AMEX synchronization.
- **Scope**: internal
- **Date**: 2026-07-22

## Findings

### Files Found

| File Path | Description |
|---|---|
| `src/app/benefits/actions.ts` | Current benefit-status mutations and transition-helper usage. |
| `src/lib/benefit-status-transitions.ts` | Absolute/additive completion state derivation. |
| `src/app/cards/actions.ts` | Compact authenticated Zod/ownership/revalidation mutation reference. |
| `src/app/cards/new/actions.ts` | Card creation validation and server-session ownership. |
| `src/app/api/user-cards/route.ts` | Session-authenticated user-card route. |
| `src/app/api/user-cards/[id]/route.ts` | User-scoped object lookup route. |
| `src/app/api/user-cards/import/route.ts` | Partial-success import route and per-item result aggregation. |
| `src/app/api/search/analytics/route.ts` | JSON validation with authenticated user-derived identity. |
| `src/app/api/benefits/route.ts` | Older authenticated benefit API with weak ownership/validation behavior. |
| `src/lib/actions/benefitActions.ts` | Existing cycle-status upsert idempotency pattern. |
| `src/app/api/cron/check-benefits/route.ts` | Unique-key bulk upsert and secret-authenticated route pattern. |
| `src/app/cards/__tests__/actions.test.ts` | Auth, validation, ownership, success/failure, and revalidation test reference. |
| `src/app/api/user-cards/__tests__/route.test.ts` | Route auth/scope/error test reference. |

### Authentication and authorization patterns

- The preferred mutation pattern resolves `getServerSession(authOptions)` before any user-owned read/write and derives `userId` from `session.user.id` (`src/app/cards/actions.ts:14-18`; `src/app/benefits/actions.ts:29-34`; `src/app/api/user-cards/route.ts:9-18`).
- Object access is commonly scoped with `findFirst({ where: { id, userId } })`, as in user-card lookup (`src/app/api/user-cards/[id]/route.ts:16-24`) and benefit-status actions (`src/app/benefits/actions.ts:47-55`, `src/app/benefits/actions.ts:288-296`).
- The stronger write pattern uses `updateMany({ where: { id, userId } })` and rejects `count === 0` (`src/app/benefits/actions.ts:63-78`, `src/app/benefits/actions.ts:237-251`, `src/app/benefits/actions.ts:361-375`). Some older actions perform an owned read and then `update({ where: { id } })`; the project spec explicitly classifies that as a mixed legacy pattern rather than the template for new mutations (`.trellis/spec/perks-reminder/architecture-and-domain.md:61-68`, `:85-89`).
- Cron routes use a distinct `Authorization: Bearer <CRON_SECRET>` contract (`src/app/api/cron/check-benefits/route.ts:223-255`). This is server-to-server authority and is not suitable for browser synchronization, where the PRD requires deriving the user from the NextAuth session.

### Validation patterns

- Zod is used where a strict schema exists: card deletion validates a CUID before ownership lookup (`src/app/cards/actions.ts:9-29`); bulk card creation parses JSON as `unknown`, validates an array with bounds, and only then queries (`src/app/cards/new/actions.ts:15-22`, `:101-138`).
- Some API routes use explicit finite checks, e.g. trimming/bounding a search query and requiring non-negative integers (`src/app/api/search/analytics/route.ts:15-35`).
- The import route validates file media type and a small version/array shape, then handles each card independently and returns imported/skipped/error counts plus row messages (`src/app/api/user-cards/import/route.ts:71-109`, `:111-230`, `:242-252`). It is the closest existing per-row partial-result shape, though it is not a transaction/idempotency reference.
- The existing AMEX Zod schemas are strict, bounded, and reject forbidden sensitive field names (`src/lib/amex-benefit-reader/contract.ts:31-39`, `:72-123`, `:204-226`). A sync transport can reuse a narrower projection of these schemas rather than accepting arbitrary JSON.

### Benefit mutation semantics

- `transitionSetUsedAmount` is the existing absolute-value helper. It rejects negative/NaN values, clamps to `maxAmount` when positive, derives completion from `usedAmount >= maxAmount`, preserves an existing completion time when still completed, and clears `completedAt` on decrease below target (`src/lib/benefit-status-transitions.ts:70-88`). This aligns with absolute AMEX values and decrease/refund behavior better than `transitionAddPartialCompletion`, which adds to current state (`src/lib/benefit-status-transitions.ts:28-49`).
- Current actions authenticate and reload the owned status with its benefit before deriving a transition (`src/app/benefits/actions.ts:268-310`). Synchronization additionally needs source-completion handling because the PRD permits an explicit recognized AMEX completion state even when amount evidence is absent; the current helper derives completion only from amount/max.
- Successful actions revalidate affected routes only after persistence (`src/app/benefits/actions.ts:82-89`, `:315-325`; `src/app/cards/actions.ts:44-57`). The sync path affects at least `/benefits` and `/`; card mapping alone may also affect `/cards` if surfaced there.

### Existing idempotency patterns

- `BenefitStatus` has a database unique key on `(benefitId, userId, cycleStartDate, occurrenceIndex)` (`prisma/schema.prisma:195-216`). Cycle materialization upserts on that compound key, updating only the cycle end (`src/lib/actions/benefitActions.ts:75-100`). The cron bulk path uses the same conflict target (`src/app/api/cron/check-benefits/route.ts:191-215`).
- This unique key prevents duplicate status rows for the same resolved cycle/occurrence. It does **not** identify a sync request, preserve row provenance, reject an older AMEX observation, or return a previous attempt's row results.
- There is no request idempotency-key parser, sync-attempt table, source-observation unique key, or stale-replay comparison in the current API/action code.
- Absolute `usedAmount` assignment avoids double-addition if the exact row is resolved repeatedly, but without observed-source metadata a replay can still overwrite a newer manual or AMEX value.

### Error and partial-failure patterns

- Route handlers return stable 401/400/404/500 JSON statuses in the better-scoped APIs (`src/app/api/user-cards/route.ts:9-16`, `:62-68`; `src/app/api/user-cards/[id]/route.ts:52-63`; `src/app/api/search/analytics/route.ts:19-56`).
- Server actions vary between stable result objects, throws, and redirects. The architecture spec requires preserving an established action's caller contract and adding an explicit return type for new branchable result shapes (`.trellis/spec/perks-reminder/architecture-and-domain.md:51-58`). A new synchronization boundary should define one discriminated route response rather than inherit these mixed action conventions.
- The import route continues after per-card failures (`src/app/api/user-cards/import/route.ts:111-230`) but card creation and lifecycle/event updates are not wrapped in one transaction. For synchronization, per-row outcomes can be independent while each applied row and its provenance/audit record should be atomic.
- Operational logs often include IDs and transition amounts (`src/app/benefits/actions.ts:80`, `:144`, `:313`). The sync PRD forbids raw AMEX/session material in logs; new logs should therefore stay at attempt ID, result code, aggregate counts, and server-owned destination IDs only.

### CORS and CSRF patterns

- No source route or global config emits `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, or allowed-method/header CORS responses, and no route exports an `OPTIONS` handler.
- Custom session-authenticated routes rely on same-origin browser use and the Lax session cookie; they do not explicitly validate `Origin`, `Sec-Fetch-Site`, or a custom CSRF token.
- The monitoring error route accepts unauthenticated arbitrary JSON and logs it (`src/app/api/monitoring/errors/route.ts:22-50`); it is not a safe mutation template.
- The older `POST /api/benefits` authenticates by email but accepts an unvalidated `creditCardId` and connects it directly (`src/app/api/benefits/route.ts:33-70`). It should be documented as existing behavior, not used as the synchronization authorization pattern.

### Technical design implications

A new synchronization boundary best fits an App Router route pair (or one route with explicit `mode`) because it needs stable HTTP statuses, strict JSON validation, preview/write separation, per-row results, and same-origin handoff-page calls:

1. `POST preview`: authenticate first; reject non-first-party `Origin`/Fetch Metadata; parse a bounded strict normalized transport; derive the user from session; read only user-owned cards/benefits/statuses; return proposed/skipped rows and a short-lived signed proposal token; do not mutate benefit/card/status state.
2. `POST confirm`: authenticate and validate again; verify proposal signature, expiry, user binding, payload digest, and idempotency key; re-resolve current owned rows; reject changed/ambiguous rows; atomically write each accepted status plus provenance/audit; return one result per input row.
3. Keep CORS absent. The handoff page calls these routes from the Perks Reminder origin.

The signed preview token permits a read-only preview without creating a proposal row. Confirmation must still re-read current state and fail/re-preview if the proposed before-state changed.

### Related Specs

- `.trellis/spec/perks-reminder/architecture-and-domain.md:32-103` — complete authenticated mutation contract and required tests.
- `.trellis/spec/perks-reminder/verification.md:11-14`, `:26-36` — minimum safe checks and targeted mocked tests.
- `.trellis/tasks/07-22-sync-reviewed-amex-benefits/prd.md:36-52` — idempotency, provenance, source precedence, partial failures, and test requirements.

## Caveats / Not Found

- No existing route combines preview and confirmed mutation semantics.
- No existing custom mutation implements an application-level CSRF token or explicit Origin/Fetch-Metadata policy.
- Existing mutation code is heterogeneous; the architecture spec, not every legacy route, is the authoritative pattern for a new endpoint.
