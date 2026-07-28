# Implementation plan: enforce primary-only AMEX reader scope and useful panel rows

> Steps 0–7 are the completed v0.3.3 baseline. Steps 8–10 supersede their product-gated normalization, compatibility-retention, synchronization-projection, and release-version details for the final v0.4.0 implementation.

## 0. Enforce primary-only discovery and invalidate role-unverified state

- Update `parseAccountDiscovery` in `src/lib/amex-benefit-reader/amex-response-adapter.ts` to emit only top-level exact `BASIC` cards.
- Treat nested exact `SUPP` entries as understood policy exclusions before identity preparation or tracker/catalog reads; do not count them unknown or let them degrade scan completeness.
- Keep unknown, missing, or contradictory relationship shapes fail closed.
- Remove downstream reliance on transient relationship values once every emitted card is primary.
- Add adapter/scan tests for explicit Additional/Companion names and a SUPP entry that inherits a supported parent product; assert no SUPP token reaches identity preparation or any card-specific request and counts include primary cards only.
- Add a fixed non-sensitive compatibility marker in Tampermonkey storage. On first load under the primary-only policy, validate and then invalidate all role-unverified cards and `lastScan`, delete any pending mailbox, preserve the installation identity secret, and write the marker only after success.
- Prove malformed/future stores are unchanged and unmarked, migration revision changes at most once, subsequent loads are idempotent, and clear removes the marker.

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

## 4. Make panel card groups filter-aware

- Update `src/userscripts/amex-benefit-reader/panel.ts` while retaining the pure coverage projection for account-quality metrics.
- Compute row membership with the existing conservative `Remaining`/`Used` presentation classifier, then render a card group only when it has at least one row in the active filter.
- Remove the compact zero-row card-group path.
- Under `Remaining`, omit zero-benefit unresolved/stale/older-retained groups and all-used groups. Under `Used`, render only groups with used rows.
- Do not expose quality badges, explanations, coverage reconciliation, or data-note counts; preserve their underlying classifications only for filter-aware rendering and internal contracts.
- Add filter-specific empty states and preserve account-wide filter counts without showing scan/quality summaries.
- Replace panel tests that require every benefit-bearing card under both filters; reproduce the latest mixed-quality shape and assert only row-bearing groups render.

## 5. Isolate active-scan presentation and remove user-facing diagnostics

- Update `src/userscripts/amex-benefit-reader/panel.ts` so `scanning` and `cancelling` render only a non-collapsible, accessible in-progress workspace with minimal status text, a determinate native progress element once discovery identifies the card count, and the Cancel control.
- Derive completed/current values from existing `ScanProgress` `discovered` and `card` events; retain committed records in panel memory but render no results until `finished`.
- Remove all user-facing scan notes, coverage/data-quality metrics, quality pills, per-card issue/coverage explanations, parser/confidence/timestamp details, and authorized conflict diagnostic/detail rendering. Do not remove the underlying normalized diagnostic fields, scan engine events, or fail-closed/sync behavior.
- After `finished`, restore the ordinary manual-scan control and filter-aware card/benefit presentation, excluding the removed internal-debug UI. Preserve existing no-autoscan, no-auto-sync, primary-only, and privacy behavior.
- Update focused panel tests for the scanning-only workspace, deterministic progress attributes, hidden stale/incrementally committed data, terminal result restoration, and absence of diagnostic/timestamp/scan-note text.
- Update generated-bundle synthetic checks to verify the running panel contains no persisted result card/sync/data-quality content, emits real card progress, and restores only the reduced final presentation after completion.

## 6. Render compact structured periods

- Add a deterministic UTC formatter in `panel.ts` for observed V2 `sourcePeriod`.
- Render `2026`, `Jul 2026`, `Jul–Sep 2026`, and `Jul–Dec 2026` for aligned ranges; use compact explicit dates for irregular/cross-year ranges.
- Fall back to bounded raw `period` only for V1 or unavailable structured V2 periods.
- Add panel tests for aligned, irregular, cross-year, fallback, and raw-token suppression cases.

## 7. Gate sync on the primary-only parser and update versions

- Bump `PARSER_VERSION` in `src/lib/amex-benefit-reader/contract.ts` to `amex-api-us/2.0.2`.
- Require current-parser observations in sync-envelope projection/validation so v2.0.1 role-unverified stores and mailboxes fail closed pending a fresh scan; preserve all existing complete/current/latest-scan gates.
- Bump `userscriptVersion` in `scripts/build-amex-benefit-reader.mjs` to `0.3.3`.
- Update `tests/e2e/amex-benefit-reader/harness.ts` so ordinary multi-card cases use top-level BASIC cards; add nested SUPP only to prove zero identity/request work.
- Add synthetic one-time legacy-store/mailbox invalidation and filter-aware card-group coverage.
- Update `tests/e2e/amex-benefit-reader/amex-benefit-reader.spec.ts` for version assertions, primary-only discovery, reviewed exclusions, genuine-conflict control, hidden zero-row groups, Used-filter behavior, compact periods, and sanitized storage.
- Do not install the resulting script or contact live AMEX/Perks Reminder pages.

## 8. Replace product-gated local normalization with V3 observations

- Add `amex-benefits/3` and parser `amex-api-us/3.0.0` in `contract.ts`. Define V3 card/benefit schemas with scan identity and structured period but without persisted `productKey` or `creditFamilyKey`; add truthful `credit_usage` activity and forbidden-field tests.
- Keep storage envelope schema 1 and legacy V1/V2 validation for migration only. Extend the observation union to V3 and ensure all store invariants remain strict.
- Refactor `supported-card-credits.ts` so local eligibility is product-independent: exact normalized category `usage`, bounded tracker title, reviewed exact exclusions, and existing explicit non-credit exclusions as defense-in-depth. Remove the finite card registry from local admission.
- Add a separate exact browser synchronization mapping from reviewed base-Platinum product aliases plus reviewed Resy/lululemon tracker titles to destination keys. Do not use substring/fuzzy matching and do not share this map with server authority.
- Rewrite `normalizeBenefits` to remove the unsupported-product early return, use tracker title as local identity/display authority, skip every non-`usage` tracker before interpretation, retain only tracker-backed rows, and use catalog data only for unambiguous enrollment enrichment. Remove catalog-only enrollment-row creation and ensure ambiguous enrichment cannot erase the tracker row.
- Keep deterministic duplicate handling and genuine tracker-state conflict behavior; do not persist provider/join IDs or raw source records.
- Update `scan-engine.ts` so every successfully read BASIC card commits V3, including unknown products and truthful empty tracker sets; remove the recognized-V2 versus empty-V1 branch.

## 9. Separate strict synchronization and compatibility boundaries

- Project only complete/current/latest-scan V3 observations through the exact reviewed browser sync mapping. Unknown, Morgan Stanley, Hilton, Delta Business, CLEAR+, Equinox, Delta Stays, airline-fee, near-product, and near-title values produce no mapped sync card.
- Exclude a whole source card when multiple materially distinct rows map to one destination family. Preserve all freshness, parser, scan, completeness, structured-period, and successful-disposition gates.
- Advance the bounded transport to `amex-sync-envelope/2` and `amex-sync-mailbox/2`, require observation `amex-benefits/3`, and update handoff/API/service/repository fixtures without expanding `src/lib/amex-sync/authority.ts`.
- Add a V3-selection compatibility marker in Tampermonkey storage. After the existing primary-only migration, validate and invalidate every selection-incomplete V1/V2 card and `lastScan`, delete legacy pending mailbox state, preserve the installation identity secret, persist only when needed, and write the marker last.
- Prove marker-last retry behavior, malformed/future refusal, first-load revision behavior, idempotent second load, and `clear()` removal of all markers/mailbox versions.

## 10. Cover approved live outcomes synthetically

- Add adapter/engine/storage/panel/E2E fixtures with invented identity data for:
  - Morgan Stanley-like product with ten `usage` trackers including CLEAR+ and Equinox;
  - Hilton Honors Card with no usage trackers and catalog-only status/reward entries;
  - Delta Gold Business with `$150 Delta Stays Credit` usage, `$200 Delta Flight Credit` spend, and catalog-only `$120 Rideshare Credit`.
- Assert normalization is product-name-independent, Morgan produces ten stored/displayed rows, Hilton commits a complete empty V3 observation without a card shell, and Delta produces exactly one stored/displayed row.
- Assert all three remain sync-ineligible, local storage contains no destination mapping claims or provider/raw identity, and the generated bundle remains deny-by-default with no automatic scan or handoff.
- Update panel structured-period and coverage projections to recognize V3 scan identity and benefits.
- Bump the generated userscript version to `0.4.0` without changing match scopes, grants, or request transport.

## 11. Validate

Run focused unit tests:

```bash
npm test -- --runInBand \
  src/lib/amex-benefit-reader/__tests__/supported-card-credits.test.ts \
  src/lib/amex-benefit-reader/__tests__/amex-response-adapter.test.ts \
  src/lib/amex-benefit-reader/__tests__/scan-engine.test.ts \
  src/lib/amex-benefit-reader/__tests__/storage-policy.test.ts \
  src/lib/amex-benefit-reader/__tests__/sync-contract.test.ts \
  src/lib/amex-benefit-reader/__tests__/sync-mailbox.test.ts \
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
  src/lib/amex-benefit-reader/__tests__/scan-engine.test.ts \
  src/lib/amex-benefit-reader/__tests__/storage-policy.test.ts \
  src/lib/amex-benefit-reader/__tests__/sync-contract.test.ts \
  src/lib/amex-benefit-reader/__tests__/sync-mailbox.test.ts \
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
- If the user wants manual verification, separately confirm installation of version `0.4.0`, then separately confirm a new manual scan because it issues authenticated first-party AMEX reads.
- Keep synchronization blocked until a new scan produces complete eligible observations and the user separately authorizes any handoff.

## Rollback points

- If reviewed raw filtering changes unrelated ambiguity behavior, revert step 2 and retain existing fail-closed grouping.
- If normalized compatibility filtering is broader than approved, revert the shared predicate before installation; do not invent or restore missing observations.
- If ownership compatibility invalidation is unsafe, stop before installation; do not fall back to product-name ownership heuristics.
- If panel coverage cannot classify a record conclusively, retain its quality count but do not manufacture an empty card group in the active filter.
- No database or normalized-contract schema rollback is required.
