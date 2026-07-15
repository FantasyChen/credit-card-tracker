# State Management

Perks Reminder does not use Redux, Zustand, or another global application store. State is owned by the narrowest layer that can enforce its contract.

## Ownership Matrix

| State | Owner | Examples |
| --- | --- | --- |
| Authentication session | NextAuth `SessionProvider` plus server-side `getServerSession` checks | `src/components/Providers.tsx`, `src/app/benefits/page.tsx` |
| Theme | `ThemeProvider` from `next-themes` | `src/components/Providers.tsx` |
| Durable user/domain data | PostgreSQL through authenticated Server Actions or API routes | `src/app/cards/actions.ts`, `src/app/api/user-cards/route.ts` |
| Route data loaded on server | Server Component, then typed props | `src/app/loyalty/page.tsx`, `src/app/benefits/page.tsx` |
| Client-fetched route data | Local `useState`/`useEffect` with explicit state branches | `src/app/cards/page.tsx` |
| Transient UI state | Local component state | filters, tabs, dialogs, pending flags in `BenefitsDisplayClient` |
| Derived display state | `useMemo` or pure `src/lib` projection | card display names and benefit-dashboard filtering/ROI |

## Data-Loading Patterns

Both patterns are established; choose based on the route boundary rather than forcing one everywhere:

1. **Server load + client interaction**: authenticate and fetch in the page, project through `src/lib`, pass typed props to a Client Component.
2. **Client fetch**: initialize loading state, handle `401` separately when meaningful, handle other errors, parse the response, and render loading/error/empty/populated states.

Do not use client fetching to bypass a server authentication or authorization boundary.

## Mutations

- Durable changes go through a Server Action or Route Handler; local state is only an immediate UI mirror.
- Use `useTransition` for pending mutation UI where the interaction should remain responsive, as in card deletion.
- Apply local updates only after the server contract reports success unless a tested rollback path exists.
- Revalidate every server-rendered route affected by the write.
- Never trust a client-provided user ID, ownership flag, completion state, or current amount. Resolve ownership and current state on the server.

## Derived State

Prefer deriving values from canonical state over storing duplicate values. When the existing UI intentionally stores related totals for immediate mutation feedback, update the list membership and all totals atomically in the same handler and cover the behavior with tests.

```tsx
// Wrong: durable write exists only in component state.
setCards((cards) => cards.filter((card) => card.id !== cardId));

// Correct: write first, then mirror confirmed success locally.
const result = await deleteCardAction(formData);
if (result.success) {
  setCards((cards) => cards.filter((card) => card.id !== cardId));
}
```
