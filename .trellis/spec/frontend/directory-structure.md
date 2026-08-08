# Directory Structure

## Ownership Map

| Location | Owns | Project examples |
| --- | --- | --- |
| `src/app/**/page.tsx` | App Router entry points, metadata, authentication redirects, and route-level data loading | `src/app/benefits/page.tsx`, `src/app/loyalty/page.tsx` |
| `src/app/**/actions.ts` | Route-associated Server Actions and their boundary validation | `src/app/cards/actions.ts`, `src/app/benefits/actions.ts` |
| `src/app/api/**/route.ts` | HTTP request/response boundaries | `src/app/api/user-cards/route.ts`, `src/app/api/predefined-cards-with-benefits/route.ts` |
| Route-local `.tsx` files | Components whose meaning belongs to one route | `src/app/loyalty/LoyaltyAccountsClient.tsx` |
| `src/components/` | Components reused by multiple routes or feature surfaces | `src/components/BenefitsDisplayClient.tsx`, `src/components/SearchInput.tsx` |
| `src/components/ui/` | Low-level visual primitives and shared page furniture | `src/components/ui/button.tsx`, `src/components/ui/PageHeader.tsx` |
| `src/lib/` | Reusable domain projections, client-safe contracts, transitions, materialization, adapters, and utilities | `src/lib/benefit-dashboard.ts`, `src/lib/benefit-dashboard-client.ts`, `src/lib/benefit-status-transitions.ts` |
| `src/lib/hooks/` | Generic hooks with more than one plausible UI consumer | `src/lib/hooks/useDebounce.ts` |
| `src/generated/` | Prisma-generated output | Imported from application code; excluded from lint |

## Placement Rules

- Keep route entry points thin when reusable projection or transition logic exists. `src/app/benefits/page.tsx` fetches records and delegates shaping to `buildBenefitDashboardProjection`.
- Colocate a component with its route when it is route-specific; promote it to `src/components/` only when it has a genuine cross-route role.
- Put domain calculations in `src/lib/`, not inside JSX or route handlers. The benefit dashboard, cycle materialization, status transitions, notification digest, and card lifecycle modules are the established owners.
- Keep API routes and Server Actions as boundaries: authenticate, parse, validate, invoke domain logic, persist, and shape a response.
- Keep App Router convention-file exports framework-valid. Helpers tested independently of `GET`, `POST`, or other supported route exports belong in an adjacent library module, such as `src/lib/cron/check-benefits.ts` or `src/lib/monitoring/error-report.ts`.
- Never hand-edit `src/generated/`; regenerate Prisma output only under the database safety rules in `../perks-reminder/database-and-data-safety.md`.

## Naming Reality

- React component and route-local UI files normally use PascalCase, such as `BenefitsDisplayClient.tsx`, `SearchInput.tsx`, and `LoyaltyAccountsClient.tsx`.
- App Router convention files remain lowercase (`page.tsx`, `layout.tsx`, `route.ts`, `actions.ts`).
- The shared UI directory is mixed by origin: shadcn-style primitives use lowercase names such as `button.tsx` and `input.tsx`, while project page furniture uses PascalCase names such as `PageHeader.tsx` and `EmptyState.tsx`.
- Reusable domain modules are usually kebab-case (`benefit-dashboard.ts`, `card-lifecycle.ts`), but legacy camelCase utilities such as `cardDisplayUtils.ts` remain. Match the owner being changed; do not rename files solely to normalize style.
- Components, types/interfaces, and generated enums use PascalCase; functions, props, and local values use camelCase; custom hooks use the `use*` prefix.

This is more precise than the blanket “all files are kebab-case” rule in `CONTRIBUTING.md`, which does not match the current React tree.

## Tests

Tests are normally colocated in `__tests__/` below the owned source area:

- `src/components/__tests__/BenefitsDisplayClient.test.tsx`
- `src/app/cards/__tests__/actions.test.ts`
- `src/lib/__tests__/benefit-status-transitions.test.ts`

## Wrong vs Correct

```tsx
// Wrong: route component duplicates reusable domain projection.
const upcoming = statuses.filter((status) => !status.isCompleted);

// Correct: use the owning domain module.
const projection = buildBenefitDashboardProjection({
  statuses,
  userCards,
  usageWays,
  predefinedCardFees,
  now,
});
```

Do not force the repository into a single component layout: it intentionally uses both route-local feature components and shared components.
