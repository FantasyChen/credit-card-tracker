# Architecture and Domain Invariants

## Application boundaries

- `src/app/` owns App Router pages, API routes, server actions, authentication routes, and cron endpoints.
- `src/components/` owns shared UI and dashboard components.
- `src/lib/` owns reusable business logic; `prisma/` owns schema and migration history; `scripts/` owns explicit operational tooling.
- PostgreSQL is accessed through Prisma. Authentication uses NextAuth with OAuth and email/password flows. Resend handles transactional email. Vercel hosts the application and cron jobs.

## Business-logic owners

- `src/lib/benefit-dashboard.ts` shapes benefit statuses into dashboard tabs, totals, usage-guide links, and per-card ROI. Do not duplicate that projection in pages/components.
- `src/lib/benefit-cycle-materialization.ts` creates normalized `BenefitStatus` rows from benefit/card/date context. Cron, card creation, migrations, and custom-benefit creation should share it.
- `src/lib/benefit-status-transitions.ts` owns completion, partial completion, reset, direct amount edits, and not-usable transitions. Server actions validate through it before persistence.
- `src/lib/notification-digest.ts` owns notification selection, user reminder windows, digest assembly, quota checks, batching, and delivery. Cron routes should stay limited to authorization/date parsing and response handling.
- Physical cards are keyed by `CreditCard.id`; display names may include nickname/last digits. Never group duplicate products solely by product name.

## Durable product invariants

- Perks Reminder is free: all accounts receive unlimited cards and reminders, custom reminder windows, loyalty tracking, and import/export. Legacy `subscriptionTier` and `isBetaUser` fields may remain for compatibility but must not restore paid gates or badges.
- Template benefit changes affect future card additions only unless existing user cards are migrated and benefit statuses are materialized.
- Important recurring credits should link to practical Benefit Usage Guides with caveats and provenance. Keep claimed ROI separate from subjective value assumptions.
- Public anonymous marketing/catalog routes must not query Prisma. `src/lib/static-catalog.ts` is the shared DB-free catalog source and `prisma/seed.ts` consumes the same data.
- Multi-year benefits use `YEARLY` plus `CARD_ANNIVERSARY` and `fixedCycleDurationMonths`; cycle calculation and materialization must preserve the full duration.

## Authentication and PWA safety

- Main and loyalty subdomains share authentication. Sign-out must clear both host-only and shared `.perks-reminder.com` NextAuth cookies.
- NextAuth owns `/api/auth/*`; custom force-sign-out endpoints belong outside that route.
- Do not cache navigated HTML or Next runtime chunks cache-first. Stale user/session markup can leak signed-in state or cause hydration mismatches. Prefer network-first/no-cache navigation, unregister the service worker in local development, and bump cache names when caching behavior changes.

## Scenario: authenticated user mutation

### 1. Scope / Trigger

Use this contract whenever a Server Action or Route Handler changes cards, benefits, statuses, loyalty records, notification settings, or other user-owned durable state. It prevents cross-user writes, trusting stale client state, partial domain updates, and a successful response with stale server-rendered UI.

### 2. Signatures

Representative source declarations (none currently has an explicit return annotation):

```ts
// src/app/cards/actions.ts
export async function deleteCardAction(formData: FormData) { /* ... */ }

// src/app/benefits/actions.ts
export async function toggleBenefitStatusAction(formData: FormData) { /* ... */ }
export async function addPartialCompletionAction(formData: FormData) { /* ... */ }
```

Their observable contracts differ:

- `deleteCardAction` returns `{ success: true }` or `{ success: false, error: string }`; because the implementation has no return annotation, TypeScript currently infers `success` as `boolean` rather than an explicitly declared discriminant.
- `toggleBenefitStatusAction` resolves without a value on success and throws on failure.
- `addPartialCompletionAction` returns `{ success: true, newUsedAmount, isComplete, maxAmount }` on success and throws on failure.

The action family also contains authentication redirects. Preserve the established caller contract unless every caller and test is migrated together; for new or substantially changed actions, add an explicit return type when callers branch on a result shape.

### 3. Contracts

1. Resolve `getServerSession(authOptions)` before any user-owned read or write.
2. Parse `FormData`, query parameters, or JSON as untrusted input. Use Zod or explicit finite checks before persistence.
3. Resolve current records from the database with `userId: session.user.id`; never accept a client-provided user ID or ownership assertion.
4. Call the owning transition/materialization helper when one exists, such as `benefit-status-transitions.ts` or `benefit-cycle-materialization.ts`.
5. Scope the write by both object identity and authenticated user where the Prisma operation permits it; verify `updateMany().count` when using a scoped bulk write. `toggleBenefitStatusAction` and `resetBenefitCompletionAction` demonstrate this pattern. Some older actions first perform an owned read and then call `update()` or `delete()` by ID alone; that mixed pattern exists, but it is not the template for new mutations.
6. Return only the fields required by the caller and do not expose internal Prisma errors.
7. Call `revalidatePath` for every affected server-rendered route after a successful write, never after a rejected or failed write.

The public catalog route has a separate read contract: `GET /api/predefined-cards-with-benefits` uses static data by default; `?source=db` dynamically loads Prisma/auth, requires a session, and returns `Cache-Control: private, no-store`.

No client-exposed environment key authorizes a mutation. Authentication and secrets remain server-side.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing session | Follow the action's established return/throw/redirect contract; perform no DB operation |
| Malformed or out-of-range input | Stable validation error; perform no ownership lookup/write when validation can run first |
| Record absent or owned by another user | Same not-found/permission response; perform no write |
| Invalid domain transition | Reject before persistence; preserve existing state |
| Scoped `updateMany` count is `0` | Treat as not-found/permission failure |
| Persistence throws | Log operational context without secrets/recipient data; return or throw a stable generic error; do not revalidate |
| Success | Persist the helper-derived state, return the documented shape, and revalidate affected routes |

### 5. Good / Base / Bad Cases

- **Good**: `toggleBenefitStatusAction` authenticates, reloads by status ID plus user ID, derives the transition through `transitionToggleCompletion`, persists with user-scoped `updateMany`, checks the count, and revalidates the affected dashboard routes.
- **Base / mixed legacy**: `deleteCardAction` is a useful authentication, Zod-validation, ownership, result-shape, and test reference, but its final `delete()` is keyed only by ID after the owned read. Preserve existing behavior when making a narrow change; use a user-scoped write for a new mutation.
- **Bad**: trusting `isCompleted`, `usedAmount`, `userId`, or a card name from the browser as authoritative and writing without reloading the owned record.

### 6. Tests Required

For each changed mutation, assert:

- unauthenticated input performs no read/write;
- invalid input performs no write;
- wrong-owner or missing records perform no write;
- the success path uses the authenticated user ID and exact derived write payload;
- transition/materialization edge behavior is covered by a direct unit test;
- persistence failure does not report success or call `revalidatePath`;
- every success response field and affected revalidation path matches the caller contract.

`src/app/cards/__tests__/actions.test.ts` and `src/lib/__tests__/benefit-status-transitions.test.ts` are the reference test shapes.

### 7. Wrong vs Correct

```ts
// Wrong: client state and object identity are treated as authorization.
await prisma.benefitStatus.update({
  where: { id: formData.get('benefitStatusId') as string },
  data: { isCompleted: formData.get('isCompleted') === 'true' },
});

// Correct: authenticate, reload the owned record, derive, and scope persistence.
const session = await getServerSession(authOptions);
if (!session?.user?.id) throw new Error('User not authenticated.');
const existing = await prisma.benefitStatus.findFirst({
  where: { id: benefitStatusId, userId: session.user.id },
  include: { benefit: true },
});
if (!existing) throw new Error('Benefit status not found or permission denied.');
const transition = transitionToggleCompletion(existing);
const result = await prisma.benefitStatus.updateMany({
  where: { id: benefitStatusId, userId: session.user.id },
  data: transition,
});
if (result.count === 0) throw new Error('Benefit status not found or permission denied.');
revalidatePath('/benefits');
```
