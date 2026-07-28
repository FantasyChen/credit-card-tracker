# Research: Migration, rollback, and safe verification implications

- **Query**: Identify migration/rollback implications and safe tests for synchronizing reviewed normalized AMEX observations.
- **Scope**: internal
- **Date**: 2026-07-22

## Findings

### Files Found

| File Path | Description |
|---|---|
| `.trellis/spec/perks-reminder/database-and-data-safety.md` | Database command, migration, backup, and recovery restrictions. |
| `.trellis/spec/perks-reminder/verification.md` | Safe static checks and mocked mutation test requirements. |
| `.trellis/spec/perks-reminder/browser-read-integrations.md` | Userscript unit/build/E2E/live-validation boundaries. |
| `.trellis/spec/perks-reminder/catalog-and-benefit-updates.md` | Existing-user and status-materialization requirements. |
| `prisma/schema.prisma` | Current schema and unique keys. |
| `src/app/cards/__tests__/actions.test.ts` | Auth/validation/ownership/mutation/revalidation test shape. |
| `src/app/api/user-cards/__tests__/route.test.ts` | Route authentication and user-scope test shape. |
| `src/lib/__tests__/benefit-status-transitions.test.ts` | Absolute amount/decrease/completion transition tests. |
| `src/lib/__tests__/benefit-cycle-materialization.test.ts` | Exact cycle/occurrence materialization tests. |
| `tests/e2e/amex-benefit-reader/harness.ts` | Synthetic generated-bundle browser network/storage harness. |
| `playwright.amex.config.ts` | Isolated AMEX browser test configuration. |
| `package.json` | Test, userscript build, TypeScript, and migration-sensitive build commands. |

### Additive migration implications

The current schema has no mapping/provenance/attempt models, so synchronization requires an additive migration. Safe characteristics:

- Add new mapping/attempt/row/source-observation tables and relations without rewriting existing `CreditCard`, `Benefit`, or `BenefitStatus` values.
- If provenance is stored directly on `BenefitStatus`, introduce nullable/defaulted fields first. Existing rows are manual/unknown-source history and cannot be truthfully backfilled as AMEX.
- Add unique constraints needed for concurrency/idempotency only after confirming existing data cannot violate them. The existing destination unique key is already safe and should remain (`prisma/schema.prisma:212`).
- Use source enums/string values that permit a future provider without conflating AMEX with “automatic.”
- Mapping rows should cascade or restrict predictably when a user/card is deleted. An orphaned source mapping must never authorize a write.
- Attempt/audit rows should preserve before/after values and destination identifiers long enough to diagnose and recover source overwrites; deletion policy should be explicit because these rows contain normalized financial-usage observations.
- Do not attach source identity to `PredefinedBenefit.id`: seed refresh deletes/recreates those rows (`prisma/seed.ts:23-57`). Use stable semantic keys copied to durable user benefits or an explicit mapping relation.

The migration history has a known replay-order problem on empty databases (`.trellis/spec/perks-reminder/database-and-data-safety.md:21-23`). Migration validation must not assume a clean replay works, and no reset/force-reset is permitted.

### Rollout sequence

A safe phased rollout can keep every stage fail-closed:

1. **Schema only**: deploy additive nullable tables/fields and constraints; old application ignores them.
2. **Read-only preview**: deploy the first-party handoff and server mapping/preview with confirmation disabled. Validate only synthetic/test accounts and aggregate skipped/proposed results.
3. **Narrow writable scope**: enable confirmation only for explicitly characterized AMEX card+credit+period rules. All other rows return stable skip codes.
4. **Observe**: log only attempt ID, authenticated user-internal ID if necessary, aggregate result codes/counts, and server-owned destination IDs; never log payloads, titles with private context, ending digits, amounts, cookies, headers, tokens, or raw responses.
5. **Expand by reviewed rule**: each newly supported card/credit/period needs fixture and cycle mapping tests before enablement.

A kill switch can disable confirm while leaving preview/local review available. It should be server-side and default fail-closed if unset/misconfigured. Disabling the userscript Sync UI alone is not sufficient because an old installed artifact may remain active.

### Rollback and recovery

#### Application rollback

- Disable confirmation first; keep preview available only if it cannot mutate.
- Revert the application/userscript to the previous storage-only reader. Additive schema objects can remain unused; immediate destructive schema rollback is unnecessary.
- A userscript rollback must consider installed versions. Repository revert does not uninstall an already installed Tampermonkey artifact. Use an explicit version transition and owner-authorized update procedure from `.trellis/spec/perks-reminder/browser-read-integrations.md:363-450`.
- Expire/delete any unconsumed short-lived transfer mailbox; old local normalized observations remain governed by existing clear-data behavior.

#### Data rollback

- Do not blindly set AMEX-updated statuses to zero or infer old values from `updatedAt`.
- Per-row audit must record the destination status ID, source observation identity/time, sync attempt, and exact before/after `usedAmount`, `isCompleted`, `completedAt`, and `isNotUsable` values. That is the minimum evidence for a reviewed compensating operation.
- Before compensation, verify the destination has not received a newer manual or AMEX edit. If it has, flag for manual resolution rather than overwriting.
- Mapping rollback can deactivate/delete only the mapping row; it must not alter the destination card/status.
- For production database mistakes, stop and use verified backup/point-in-time recovery procedures rather than issuing ad hoc compensating writes (`.trellis/spec/perks-reminder/database-and-data-safety.md:25-29`).

### Safe automated test matrix

#### Pure contract and domain unit tests

- strict sync-envelope version, card/row count, string length, and byte-size bounds;
- rejection of extra fields and forbidden names (`cookie`, `authorization`, raw response/token/account fields);
- decimal parsing and compatible unit/currency checks; unsupported count/points/percent/unknown units skip in the initial USD scope;
- source-completion derivation: explicit recognized completion; compatible used >= target; amount below target clears completion; source decrease/refund is absolute, not additive;
- incomplete/enrollment/linking/unavailable/unknown/partial/stale rows never produce writes;
- stable credit-key mapping and explicit failure for free-form title-only mapping;
- exact period-to-cycle and occurrence resolution for monthly, quarterly, annual, split half-year, and card-anniversary cases;
- ambiguous/missing card, benefit, cycle, or occurrence returns a stable skip result.

Reference shapes: `src/lib/__tests__/benefit-status-transitions.test.ts:17-73` and `src/lib/__tests__/benefit-cycle-materialization.test.ts:33-64`.

#### Preview route tests with mocked Prisma/session

- unauthenticated request returns 401 and performs no parse-dependent DB read/write;
- wrong Origin/Fetch Metadata is rejected and performs no DB operation;
- malformed/oversized/future-version payload returns 400;
- server ignores/rejects any payload user ID and uses `session.user.id`;
- exact product+ending match succeeds only at count 1; duplicate product without unique endings is skipped;
- saved mapping is accepted only for the authenticated user and an owned destination card;
- every returned proposal row includes before/after values and every excluded input row includes a stable reason;
- preview invokes no create/update/upsert/transaction and no revalidation;
- signed proposal binds user, payload digest, before-state digest, expiry, and route purpose.

Reference shapes: `src/app/cards/__tests__/actions.test.ts:23-108` and `src/app/api/user-cards/__tests__/route.test.ts:36-117`.

#### Confirmation route/service tests

- missing/invalid/expired/wrong-user/wrong-payload proposal token performs no write;
- current state differing from preview returns `conflict_repreview_required`;
- wrong-owner destination at confirmation performs no write even if preview previously succeeded;
- identical attempt idempotency key returns the original per-row results without repeating status writes;
- an equal source observation is a no-op; an older observation is `stale_replay`; a newer observation may authoritatively increase or decrease;
- absolute update writes status and provenance/audit atomically;
- concurrent duplicate confirms are constrained by a unique attempt/source-observation key;
- one row persistence failure does not report that row as applied; other independent rows follow the documented partial-failure policy;
- manual mapping is saved only after explicit confirmation and is scoped to user/source card/destination ownership;
- successful applied rows trigger required revalidation; rejected/all-no-op attempts do not claim mutation success.

Use synthetic IDs, endings, times, and amounts only.

#### Migration tests

- inspect generated SQL for destructive statements, unexpected table rewrites, non-null additions without defaults, and cascade behavior;
- apply only to a verified development database when task scope and human authorization permit;
- verify existing manual `BenefitStatus` values remain unchanged;
- verify new uniqueness constraints under duplicate/concurrent synthetic attempts;
- verify old application code can run with the additive schema and new code handles null/absent provenance;
- verify rollback by application downgrade/feature disable without dropping new tables.

Do not use `npm run build` as a routine check: it runs Prisma generation and attempts `prisma migrate deploy` (`package.json:23-26`; `.trellis/spec/perks-reminder/database-and-data-safety.md:19`).

#### Generated userscript and browser tests

Extend the existing deny-by-default generated-bundle harness rather than using live sites for routine tests:

- exact AMEX origin still has zero provider reads before manual scan;
- Sync appears once globally only after an eligible reviewed scan, never per card/benefit;
- Sync creates exactly one bounded mailbox and opens only the exact synthetic first-party handoff URL;
- built metadata adds only the exact first-party path match and existing storage grants; no `@connect`, GM network/cookie grant, wildcard, remote update metadata, or mutation endpoint on the AMEX-page branch;
- synthetic first-party page can consume the mailbox, preview, show proposed/skipped rows, and requires a second confirmation action;
- no status mutation occurs before confirmation;
- cancellation/timeout/malformed/expired/replayed transfers fail closed and clear/expire the mailbox;
- sign-in redirect simulation returns to the handoff and consumes the same short-lived transfer without relying on opener continuity;
- unknown network remains aborted; no live AMEX, Perks Reminder, or third party is contacted;
- storage serialization and test artifacts contain no raw tokens, source fingerprints, installation secret, headers, cookies, or live data.

The existing generated-browser contract is documented at `.trellis/spec/perks-reminder/browser-read-integrations.md:250-338`.

### Minimum safe static checks for implementation

- targeted Jest for new contracts, mapping/cycle/status service, preview route, confirmation route, panel/bridge, and metadata audits;
- `npx tsc --noEmit --pretty false --incremental false`;
- targeted ESLint for changed source;
- `npm run build:amex-userscript` plus source/artifact match/grant/destination/forbidden-field scans;
- `npm run test:e2e:amex` with only synthetic network;
- parse migration SQL/schema and structured config;
- `git diff --check` and a sensitive-data scan.

Live authenticated AMEX or production Perks Reminder validation remains separately authorized, bounded, and sanitized. Database migration/deploy, seed, build, and production mutation are not generic validation commands.

### Related Specs

- `.trellis/spec/perks-reminder/database-and-data-safety.md:3-29` — prohibited commands, migration review, target verification, and recovery.
- `.trellis/spec/perks-reminder/verification.md:1-50` — safe checks, mocked mutation tests, and conditional commands.
- `.trellis/spec/perks-reminder/browser-read-integrations.md:138-164`, `:250-338`, `:363-450` — userscript unit/E2E/live update verification boundaries.
- `.trellis/spec/perks-reminder/catalog-and-benefit-updates.md:10-33` — existing-user and migration dry-run requirements.
- `.trellis/tasks/07-22-sync-reviewed-amex-benefits/prd.md:50-68` — required auth, mapping, idempotency, provenance, precedence, decrease, partial failure, and preview/write tests.

## Caveats / Not Found

- No migration was generated or executed during research.
- No production database, Vercel configuration, browser profile, or live account was accessed.
- The precise retention period for normalized sync audit rows is not specified in the PRD and needs a product/privacy decision before implementation.
- The first writable card/credit/period allowlist remains unconfirmed; tests should default all uncharacterized mappings to skipped.
