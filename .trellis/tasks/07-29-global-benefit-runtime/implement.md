# Implementation Plan — Global benefit runtime

## Preconditions

- Child 1 catalog/schema code is implemented and statically reviewed.
- Implementation began with local/static tests; later runtime validation used only the separately verified development target.
- Production AMEX remained off.

## 1. Effective source projection

- [x] Define one typed standard/bridge/custom/legacy source union and compatible display DTO projection.
- [x] Refactor dashboard, home, APIs, notifications, calendar, and guide resolution to use it.
- [x] Use global fields whenever a global link exists; preserve legacy fallback for rollback.
- [x] Omit standard edit/delete authority and reject standard definition mutation attempts.

## 2. Cycle and status materialization

- [x] Extract definition-independent cycle-coordinate derivation from the existing materializer.
- [x] Add global and custom adapters without changing cycle semantics.
- [x] Materialize standard statuses for active card/global-definition pairs with bounded/idempotent inserts.
- [x] Exclude retired definitions from future creation and leave all existing rows untouched.
- [x] Add tests for new-definition propagation, retirement, duplicate cards, cycle edges, and concurrency/duplicates.

## 3. Transactional card creation

- [x] Authenticate and validate the selected global product.
- [x] Create physical card, card event, and global standard statuses in one transaction.
- [x] Prove no copied standard `Benefit` write occurs and failures roll back all pieces.

## 4. Custom behavior

- [x] Preserve standalone custom creation/materialization.
- [x] Verify ownership before linking a custom benefit to a card.
- [x] Make newly created `Benefit` rows custom by construction and keep status transitions user-scoped.

## 5. Consumer compatibility

- [x] Update typed Prisma includes and adapters for bridge/null relations.
- [x] Preserve serialized DTO/date shapes for existing clients and components.
- [x] Keep anonymous catalog paths DB-free and use direct global identity for standard guides.

## 6. Recorded implementation and review evidence

Code and safe static/unit verification are complete for this child. The final full-scope review included every changed runtime consumer rather than only focused projection tests.

- [x] Full Jest: 74 suites passed; 593 tests passed; 1 test skipped.
- [x] Strict TypeScript passed: `npx tsc --noEmit --pretty false --incremental false`.
- [x] ESLint passed for every changed source file.
- [x] `npm run check:public-db`, `npm run card-template:validate`, and `npm run check:amex-userscripts` passed.
- [x] Safe usage-guide source/link consistency checks passed; the database-backed usage-guide operator was not run.
- [x] JSON and JSONL parsing plus Markdown-link validation passed.
- [x] The sensitive-pattern scan and `git diff --check` passed.
- [x] Projection, materialization, mutation, API, dashboard, calendar, notification, and card-action coverage passed in the full Jest run.

### Verified development evidence

- [x] Synthetic card creation linked the physical card and every generated standard status directly to global definitions, created one opening event, and created zero copied standard `Benefit` rows.
- [x] Adding a synthetic active global definition after the physical card existed planned and inserted the missing standard status for that active card.
- [x] Retiring that definition removed it from active materialization while the already-created historical status remained visible and unchanged.
- [x] Bridge preservation verification kept pre-existing status, audit, and provenance values and counts exactly unchanged outside approved relation/audit/ledger metadata.
- [x] All synthetic runtime records were removed after validation.

### Full-scope fixes owned by this child

1. Notification digests now consume the effective global/custom projection and escape dynamic user/card/benefit text before inserting it into email HTML.
2. Effective projection uses migration classification to expose mutation authority only for proven custom definitions; global, bridge, proven-standard, and unresolved legacy definitions remain read-only.
3. Custom definition update/delete actions now require authenticated ownership and a custom-only capability check, reject standard/bridge rows, use scoped writes, and revalidate only after a successful mutation.

## 7. Operational gate record

- [x] Verified development runtime, global-only card creation, materialization, propagation, retirement, and preservation validation completed.
- [ ] Seed, reset, database-backed usage-guide audit, production build, or unrelated database operation — not run.
- [ ] Production deployment/configuration, browser/provider action, or live AMEX validation — not run.
- [ ] Git commit — not performed.

## Completion status

The global-benefit runtime is **code-complete, safe-check complete, and verified-development complete**. It is eligible for completion/archive after the task evidence transition. Production remains out of scope and untouched.
