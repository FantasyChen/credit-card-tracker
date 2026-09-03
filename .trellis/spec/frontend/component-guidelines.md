# Component Guidelines

## Server and Client Boundaries

Prefer a Server Component page when the route can authenticate, query, and project data before rendering. `src/app/benefits/page.tsx` and `src/app/loyalty/page.tsx` follow this shape:

1. resolve `getServerSession(authOptions)`;
2. redirect when authentication is required;
3. scope every query with `session.user.id`;
4. call the owning `src/lib` projection when one exists;
5. pass typed feature data into an interactive client component.

Add `'use client'` only when the file needs React state/effects/transitions, browser APIs, event handlers, or client-side providers. `src/components/BenefitsDisplayClient.tsx`, `src/app/cards/page.tsx`, and `src/components/Providers.tsx` are real client boundaries.

```tsx
// Correct: the server page owns auth and data loading.
const session = await getServerSession(authOptions);
if (!session?.user?.id) redirect('/api/auth/signin?callbackUrl=/benefits');
const projection = buildBenefitDashboardProjection(/* fetched records */);
return <BenefitsDisplayClient {...projection} />;
```

Do not move Prisma, secrets, or authorization decisions into a Client Component.

## Scenario: client-safe domain contracts

### 1. Scope / Trigger

Use this contract when an interactive Client Component needs types, constants, or pure helpers from a domain module that also owns server loading, Prisma access, Node built-ins, authentication, or other server-only dependencies.

### 2. Signatures

```ts
// src/lib/benefit-dashboard-client.ts
export type DisplayBenefitStatus = /* render DTO */;
export function resolveBenefitClaimedValue(status: BenefitDashboardStatus): number;

// src/lib/benefit-dashboard.ts
export { resolveBenefitClaimedValue } from '@/lib/benefit-dashboard-client';
export async function loadBenefitDashboard(/* server database boundary */): Promise<LoadedBenefitDashboard>;
```

### 3. Contracts

1. Client Components import runtime helpers and render DTOs from the dedicated client-safe module, not from the server orchestration module.
2. A client-safe module may use `import type` for server-owned structural types because those imports are erased; it must not value-import Prisma clients, auth, Node built-ins, server actions, or server orchestration modules.
3. The server owner may import and re-export client-safe contracts to preserve server/test API compatibility.
4. App Router `page.tsx`, `layout.tsx`, and `route.ts` modules export only framework-supported entry points and configuration fields. Move testable helpers/constants into an adjacent `src/lib` or route-local non-convention module.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Client module value-imports a server owner or Node built-in | Reject in review; production build must not contain the server dependency trace |
| Client module uses an erased `import type` for a render DTO | Allowed when strict TypeScript and the boundary regression pass |
| Route convention file exports a helper such as a sanitizer or persistence function | Move it out; generated `.next/types` must accept the route exports |
| Production build reports `UnhandledSchemeError` for `node:*` | Trace the Client Component import graph and split the first mixed client/server owner |

### 5. Good / Base / Bad Cases

- **Good:** `BenefitsDisplayClient` imports dashboard DTOs/helpers from `benefit-dashboard-client.ts`; the server page loads through `benefit-dashboard.ts`.
- **Base:** Server-only tests and pages continue importing re-exported contracts from `benefit-dashboard.ts` for compatibility.
- **Bad:** A `'use client'` component imports `benefit-dashboard.ts`, which reaches `effective-benefit.ts` and Node-only migration fingerprinting.

### 6. Tests Required

- A static boundary test asserts every owning Client Component imports the client-safe module and not the server owner.
- The client-safe module test rejects runtime imports of the server owner/effective loader.
- Run focused component/domain tests, strict TypeScript after generating current `.next/types`, changed-source ESLint, and the authorized production build when release verification permits it.
- Confirm Prisma generation/build creates no tracked generated diff.

### 7. Wrong vs Correct

```ts
// Wrong: pulls a server graph into a Client Component.
import { resolveBenefitClaimedValue } from '@/lib/benefit-dashboard';

// Correct: imports only the browser-safe contract.
import { resolveBenefitClaimedValue } from '@/lib/benefit-dashboard-client';
```

## Props and Feature DTOs

- Define props next to the component when they are component-specific, as in `BenefitsDisplayProps` and `SearchInputProps`.
- Import shared render shapes from their client-safe owner, such as `DisplayBenefitStatus` and `CardLevelRoi` from `src/lib/benefit-dashboard-client.ts`; server loaders and projections remain in `src/lib/benefit-dashboard.ts`.
- Give optional props defaults at destructuring time when omission is supported.
- Preserve stable physical-card identity: use `CreditCard.id` for keys/grouping; labels may use `displayName`, nickname, or last digits.

## Shared UI Primitives

`src/components/ui/button.tsx` demonstrates the primitive pattern:

- extend native element props with `React.ComponentProps<'button'>`;
- use CVA for explicit variants/sizes;
- merge classes through `cn`;
- preserve consumer props and semantic behavior;
- use `Slot` only for the intentional `asChild` composition case.

Before adding another primitive, search `src/components/ui/` and existing feature components for an equivalent.

## Accessibility and Interaction

- Use semantic buttons, links, headings, lists, labels, and regions rather than clickable containers.
- Pair inputs/selects with visible labels or an accessible-name fallback. `BenefitsDisplayClient` uses `sr-only` `<label>` elements plus `aria-label` for its sort and frequency controls, and visible labels for the expanded category/card filters.
- Expose control state with attributes such as `aria-expanded`, `aria-controls`, and `aria-pressed`.
- Mark decorative icons with `aria-hidden="true"`; give icon-only controls an accessible label.
- Preserve visible focus styles. The default shared button/input sizes and primary dashboard controls are commonly 40px (`h-10`/`min-h-10`), with a 44px large button (`h-11`). Compact `h-8`/`h-9` icon and secondary controls also exist; use them intentionally and always provide an accessible name for icon-only controls.
- Represent relevant loading, authentication, error, empty, and populated states. `src/app/cards/page.tsx` is the reference for an explicit client-fetch state machine.

## Optimistic Local Mirrors

Some interactive dashboards mirror server-derived props locally so mutations update immediately, as in `BenefitsDisplayClient`. When changing this pattern:

- update the item collection and all derived totals together;
- keep the server action as the durable source of truth;
- ensure revalidation covers the affected server routes;
- add tests for list movement, totals, filtering, and duplicate-card identity.

### Stable card-group ordering

In the benefit card view, top-level groups are presentation hierarchy. Order them only by stable card presentation identity: Custom Benefits first, then `displayName`, then physical `CreditCard.id` for duplicate-name ties. Do not rank groups by the benefits currently visible in a tab, claimed totals, or remaining value; optimistic completion/restoration changes those inputs and makes the surrounding cards jump.

```ts
// Correct: completion can change group membership without changing group rank.
groups.sort(([keyA, a], [keyB, b]) => {
  if (keyA === CUSTOM_BENEFITS_CARD_NAME) return -1;
  if (keyB === CUSTOM_BENEFITS_CARD_NAME) return 1;
  return a.label.localeCompare(b.label) || keyA.localeCompare(keyB);
});
```

Continue applying the selected benefit sort within each group. Regression coverage must leave another Upcoming benefit on the card being completed, assert the remaining group order before/after completion, restore the benefit, and assert the original order and state return. Keep the same-name physical-card case so the ID tie-breaker cannot collapse or reorder duplicate products nondeterministically.
