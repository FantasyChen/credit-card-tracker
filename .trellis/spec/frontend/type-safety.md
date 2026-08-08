# Type Safety

## Compiler and Imports

`tsconfig.json` enables `strict`, `noEmit`, `isolatedModules`, bundler module resolution, and the `@/* -> ./src/*` alias. New application code must remain valid under:

```bash
npx tsc --noEmit --pretty false --incremental false
```

Prefer `import type` when an import is type-only; newer domain modules such as `src/lib/benefit-dashboard.ts` and `src/lib/home-dashboard-data.ts` use that form, while some older pages/providers still use value-style type imports. Import generated Prisma enums and record types from `@/generated/prisma`; never redefine generated database enums by hand.

## Type Ownership

- Prisma owns persisted record and enum shapes.
- The relevant `src/lib` domain module owns reusable projections and transition inputs/outputs. Client-render DTOs such as `DisplayBenefitStatus` and `CardLevelRoi` live in `src/lib/benefit-dashboard-client.ts`; server loading/projection orchestration lives in `src/lib/benefit-dashboard.ts`.
- Components own component-specific props, such as `SearchInputProps`.
- Route handlers own their wire request/response DTOs and must validate untrusted values before persistence.

Do not cast a raw form, query, JSON, or session value directly into a Prisma enum or trusted domain shape without validation.

## Boundary Rules

- Treat caught values as `unknown` and narrow with `instanceof Error` or a schema/type guard, as `src/app/cards/page.tsx` does.
- Validate form and request payloads with Zod or explicit checks before a write. `deleteCardSchema` in `src/app/cards/actions.ts` is the compact reference.
- Scope DB reads/writes with the authenticated user ID even when the client payload contains an object ID.
- Define wire DTOs for new JSON endpoints instead of pretending serialized dates are still `Date` objects.

The current cards client types fetched JSON as Prisma `CreditCard` records and defensively handles string dates in `formatOpenedDate`. Preserve that conversion when touching the flow, but do not repeat the mismatch in new endpoints.

## `any` and Test Doubles

`eslint.config.mjs` intentionally disables `@typescript-eslint/no-explicit-any`, and `jest.setup.ts` uses `any` for broad framework mocks. Therefore, “never use `any`” is not an accurate repository rule.

Use `any` only at a demonstrated compatibility boundary where a narrower mock/type would add disproportionate noise. Application request parsing, domain transitions, and exported payloads should use concrete types or `unknown` plus narrowing.

## Wrong vs Correct

```ts
// Wrong: client text is trusted as a generated enum.
const frequency = formData.get('frequency') as BenefitFrequency;

// Correct: validate the finite external vocabulary first.
const parsed = z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME'])
  .safeParse(formData.get('frequency'));
if (!parsed.success) throw new Error('Invalid frequency.');
const frequency: BenefitFrequency = parsed.data;
```
