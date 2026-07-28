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

## Props and Feature DTOs

- Define props next to the component when they are component-specific, as in `BenefitsDisplayProps` and `SearchInputProps`.
- Import shared domain shapes from their owning module, such as `DisplayBenefitStatus` and `CardLevelRoi` from `src/lib/benefit-dashboard.ts`.
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
