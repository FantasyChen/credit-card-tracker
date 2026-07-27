# Implementation plan: resolve AMEX reader conflicts and panel quality

## 1. Add reviewed source-selection rules

- Update `src/lib/amex-benefit-reader/supported-card-credits.ts`.
- Add bounded title normalization rules that reject `35% Airline Bonus` and `Link Your Resy Profile` while retaining airline-fee and Resy credit titles.
- Extend the normalized-observation retention predicate to remove every row whose observed category is exactly `spend`.
- Preserve no-op array identity.
- Add matcher/retention tests in `src/lib/amex-benefit-reader/__tests__/supported-card-credits.test.ts`, including amount-independent spend filtering and usage controls.

## 2. Exclude ignored raw records before conflicts

- Update `normalizeBenefits` in `src/lib/amex-benefit-reader/amex-response-adapter.ts`.
- Filter reviewed ignored catalog titles before `catalogsByIssuerId`, `catalogByIssuerId`, and `ambiguousCatalogIds` are built; reuse the same selected list in the catalog enrollment-candidate pass.
- Skip exact normalized tracker category `spend` before supported-title conflict handling, activity/status/quantity parsing, candidate evidence, `add`, or conflict collection.
- Keep the raw tracker response only where required to prevent a joined ignored tracker from manufacturing a catalog-only enrollment candidate.
- Do not change generic conflict categories, detail bounds, or fail-closed collision behavior.
- Add order-independent adapter tests for Dell, airline, Resy, all-spend exclusion, and an unrelated genuine-conflict control.

## 3. Apply compatibility and sync defense-in-depth

- Update or reuse `retainSupportedAmexCardCredits` from:
  - `src/userscripts/amex-benefit-reader/tampermonkey-storage.ts`
  - `src/lib/amex-benefit-reader/sync-contract.ts`
- Ensure compatible historical ignored rows are removed on storage load without clearing issue codes or promoting partial cards.
- Reapply the same shared predicate before sync row projection while preserving every existing card-level eligibility gate.
- Add storage tests proving one-time revision increment, second-load idempotency, unchanged quality metadata, and retained legacy conflict state.
- Add sync-contract tests proving ignored rows never project and partial/conflicted cards remain excluded.

## 4. Correct panel card coverage and summaries

- Update `src/userscripts/amex-benefit-reader/panel.ts`.
- Introduce a pure coverage projection that classifies benefit-bearing, confirmed-empty, latest-scan-unresolved, and older-retained records using latest-scan membership/disposition plus record/observation quality.
- Hide and count only confirmed-empty cards.
- Render zero-benefit unresolved and older-retained cards with truthful quality/error explanations.
- Reconcile latest attempted count, stored count, and retained-record count in account copy.
- Prevent account-wide “no trackable benefits” copy while unresolved or retained records exist.
- Ensure data-note counts include quality problems on empty cards rather than inspecting benefit-bearing cards only.
- Add panel tests reproducing the redacted 16-stored/15-attempted live shape.

## 5. Render compact structured periods

- Add a deterministic UTC formatter in `panel.ts` for observed V2 `sourcePeriod`.
- Render `2026`, `Jul 2026`, `Jul–Sep 2026`, and `Jul–Dec 2026` for aligned ranges; use compact explicit dates for irregular/cross-year ranges.
- Fall back to bounded raw `period` only for V1 or unavailable structured V2 periods.
- Add panel tests for aligned, irregular, cross-year, fallback, and raw-token suppression cases.

## 6. Update versions and synthetic browser fixtures

- Bump `PARSER_VERSION` in `src/lib/amex-benefit-reader/contract.ts` to `amex-api-us/2.0.1`.
- Bump `userscriptVersion` in `scripts/build-amex-benefit-reader.mjs` to `0.3.1`.
- Update `tests/e2e/amex-benefit-reader/harness.ts` with synthetic exclusion/coverage cases.
- Update `tests/e2e/amex-benefit-reader/amex-benefit-reader.spec.ts` for version assertions, reviewed exclusions, genuine-conflict control, unresolved empty cards, compact periods, and sanitized storage.
- Do not install the resulting script or contact live AMEX/Perks Reminder pages.

## 7. Validate

Run focused unit tests:

```bash
npm test -- --runInBand \
  src/lib/amex-benefit-reader/__tests__/supported-card-credits.test.ts \
  src/lib/amex-benefit-reader/__tests__/amex-response-adapter.test.ts \
  src/lib/amex-benefit-reader/__tests__/sync-contract.test.ts \
  src/userscripts/amex-benefit-reader/__tests__/tampermonkey-storage.test.ts \
  src/userscripts/amex-benefit-reader/__tests__/panel.test.ts
```

Run type and focused lint checks:

```bash
npx tsc --noEmit --pretty false --incremental false
```

```bash
npx eslint \
  src/lib/amex-benefit-reader/supported-card-credits.ts \
  src/lib/amex-benefit-reader/amex-response-adapter.ts \
  src/lib/amex-benefit-reader/contract.ts \
  src/lib/amex-benefit-reader/sync-contract.ts \
  src/userscripts/amex-benefit-reader/tampermonkey-storage.ts \
  src/userscripts/amex-benefit-reader/panel.ts \
  src/lib/amex-benefit-reader/__tests__/supported-card-credits.test.ts \
  src/lib/amex-benefit-reader/__tests__/amex-response-adapter.test.ts \
  src/lib/amex-benefit-reader/__tests__/sync-contract.test.ts \
  src/userscripts/amex-benefit-reader/__tests__/tampermonkey-storage.test.ts \
  src/userscripts/amex-benefit-reader/__tests__/panel.test.ts
```

Build the userscript locally and run the synthetic AMEX E2E suite only against its deny-by-default local harness:

```bash
npm run build:amex-userscript
npm run test:e2e:amex
```

Finish with repository checks:

```bash
git diff --check
git status --short
git diff -- \
  src/lib/amex-benefit-reader \
  src/userscripts/amex-benefit-reader \
  scripts/build-amex-benefit-reader.mjs \
  tests/e2e/amex-benefit-reader
```

If repository-wide lint is run, classify only the previously known unrelated unused-variable failures separately; do not alter unrelated files.

## Review and rollout gates

Before implementation:

- Complete the PRD convergence pass.
- Curate `implement.jsonl` and `check.jsonl` with the relevant code-spec and research evidence.
- Obtain explicit approval to activate the Trellis task.

After implementation and checks:

- Do not perform a live scan, click Sync, create a mailbox, install/update Tampermonkey, apply a migration, deploy, or write to a database.
- Present source/test results for review.
- If the user wants manual verification, separately confirm installation of version `0.3.1`, then separately confirm a new manual scan because it issues authenticated first-party AMEX reads.
- Keep synchronization blocked until a new scan produces complete eligible observations and the user separately authorizes any handoff.

## Rollback points

- If reviewed raw filtering changes unrelated ambiguity behavior, revert step 2 and retain existing fail-closed grouping.
- If normalized compatibility filtering is broader than approved, revert the shared predicate before installation; do not invent or restore missing observations.
- If panel coverage cannot classify a record conclusively, classify it unresolved rather than confirmed empty.
- No database or schema rollback is required.
