# Review live AMEX reader data

## Goal

Inspect the installed AMEX benefit reader against the user's already-open authenticated AMEX account, compare its live read-only observations with the visible provider data, collaboratively identify likely correctness, presentation, or data-quality issues, and—after planning review—resolve the approved false benefit-identity conflicts before any synchronization is attempted.

## Background

- Tampermonkey has the enabled `Perks Reminder — Amex Benefit Reader` userscript at version `0.3.1`.
- The account is already open in Chrome and the user has explicitly authorized viewing the live account data for this review.
- The live-account inspection remains read-only. The user has requested code corrections for the reviewed false benefit-identity conflicts and two defects confirmed by the v0.3.1 manual scan, but this does not authorize synchronization or other operational actions.
- The latest normalized scan attempted 15 cards: seven were supplementary relationships (three Additional Platinum and four Companion Platinum), four cards contained benefits, four current partial cards had zero benefits after catalog HTTP errors, and one older zero-benefit card remained retained.

## Requirements

- Keep the session strictly read-only with respect to AMEX and Perks Reminder.
- Do not trigger Sync, create or acknowledge a mailbox handoff, submit a confirmation, change account settings, or perform any database write.
- Do not persist credentials, cookies, tokens, raw network responses, or unnecessary account data in task artifacts.
- Export only the reader's already-stored normalized observations to a temporary local file, then use file-based analysis instead of repeated Computer Use inspection.
- Do not export raw provider responses, browser credentials, cookies, tokens, unrelated Tampermonkey storage, or data from other userscripts.
- Keep any sensitive raw normalized export outside the repository, derive a minimal redacted findings report, and remove the temporary export after analysis unless the user asks to retain it.
- Use Computer Use only for the minimum interaction needed to perform or verify the local export; do not trigger a new scan unless separately agreed.
- Compare the exported normalized observations with the provider-visible evidence already observed in the authenticated account.
- Distinguish confirmed defects from uncertain observations, expected limitations, and product-preference questions.
- Review each material finding with the user before deciding whether it should become implementation work.
- Diagnose and resolve the observed benefit-identity conflicts before considering any relaxation of the whole-card synchronization block.
- Keep synchronization blocked while conflict evidence is incomplete; do not treat structurally valid Resy or lululemon rows as safe merely because their own normalized fields look consistent.
- For airline benefits, retain only the `$200 Airline Fee Credit` family and ignore the `35% Airline Bonus` record entirely.
- For Resy, retain only the Resy credit tracker and ignore `Link Your Resy Profile` catalog entries entirely; these ignored entries must not create enrollment candidates, conflicts, stored benefits, panel rows, or synchronization rows.
- Ignored provider records must be removed by narrow reviewed semantic rules and must not weaken fail-closed behavior for genuinely contradictory candidates that remain after filtering.
- Include the confirmed panel corrections in the same implementation: separate conclusively empty cards from failed/partial empty cards, explain retained stale cards, and render human-readable periods from structured source ranges.
- Summary and hidden-card counts must be computed from card quality and latest-scan membership, not from `benefits.length === 0` alone.
- The reader must scan only characterized top-level accounts whose resolved relationship is exactly `BASIC`. Nested `supplementary_accounts[]` entries whose resolved relationship is exactly `SUPP` are understood policy exclusions and must not enter identity preparation, tracker/catalog requests, scan attempt counts, normalized storage, panel projection, or synchronization consideration. Unknown or contradictory relationship shapes remain fail-closed unknown variants.
- Product names such as `Additional Platinum Card®` and `Companion Platinum Card®` must not be the primary ownership rule because a supplementary record may inherit its parent product name.
- Existing role-unverified normalized snapshots and pending mailboxes created by pre-primary-only parser versions must be invalidated once without deleting the installation identity secret. The migration must be idempotent and must not rewrite malformed or future-schema stores.
- Under the default `Remaining` filter, render a card group only when it contains at least one remaining row. Zero-benefit unresolved/stale/older-retained groups and all-used groups must be omitted from the card list while their scan-quality counts remain available in account-level summary copy. The explicit `Used` filter remains available and renders only cards containing used rows.
- Treat every tracker whose normalized AMEX provider category is exactly `spend` as a qualifying-spend requirement and ignore it before conflict creation. Such trackers must not produce issue codes, conflict diagnostics, stored benefits, panel rows, or synchronization rows. Other characterized categories, including Dell's `usage` tracker, retain the existing credit-usage behavior regardless of amount. Do not use title, amount, status, or period heuristics for this decision.
- Period presentation must prefer `sourcePeriod` and use deterministic compact calendar labels: `2026` for a full year, `Jul 2026` for a month, `Jul–Sep 2026` for a multi-month range, and `Jul–Dec 2026` for a half-year. Raw provider tokens such as `CalenderYear`, `QuarterYear`, and `HalfYear` must not be shown when a valid structured range is available; irregular ranges may use explicit compact start/end dates.

## Inspection Findings

The evidence below uses redacted aliases from the temporary derived report. It does not record local card IDs, source fingerprints, credentials, cookies, tokens, raw requests, or raw responses.

| Finding | Classification | Severity | Confidence | Evidence | Expected behavior |
| --- | --- | --- | --- | --- | --- |
| Empty unresolved cards are counted as having no trackable benefits | Confirmed presentation defect | Medium | High | The panel reports 12 zero-benefit cards, but only seven are complete/current empty observations. C01-C03 and C16 are partial after `http_error`; C11 is a stale failed record omitted from the latest scan. The broad grouping is implemented in `src/userscripts/amex-benefit-reader/panel.ts:870-899`. | Separate confirmed-empty cards from cards whose catalog read failed and from retained stale cards. Never claim that an unresolved card has no trackable benefits. |
| Qualifying-spend trackers are described as benefit usage | Confirmed scope and presentation defect | Medium | High | C04 and C05 One AP rows use provider category `spend` but render as partially used; Adobe rows with a $600 qualifying threshold render as used. Presentation ignores category semantics in `src/userscripts/amex-benefit-reader/panel.ts:153-204`. | Ignore qualifying-spend requirement items entirely; reserve tracked rows and “used” vocabulary for credit utilization. |
| Raw provider period tokens are user-facing | Confirmed presentation defect | Low | High | All 28 rows expose values such as `CalenderYear`, `QuarterYear`, and `HalfYear`; `CalenderYear` retains the provider misspelling. Raw rendering occurs in `src/userscripts/amex-benefit-reader/panel.ts:186-204,454-466`. | Render compact periods from the structured date range, for example “Jul–Sep 2026” or “2026”; keep provider tokens diagnostic-only. |
| Stored-card and latest-scan totals are not explained | Stale-data/aggregation issue | Low | High | The store has 16 cards while the latest scan discovered and attempted 15. C11 is a retained stale Hilton record not rediscovered in the latest scan. Retention is intentional in `src/lib/amex-benefit-reader/scan-engine.ts:343-359`. | State “15 cards checked; one older stored card remains stale” so aggregate arithmetic is understandable. |
| Any benefit identity conflict excludes the entire card | Expected fail-closed policy retained | High | High | C04, C05, C14, and C15 contain all 28 observed benefits and are partial due to `benefit_identity_conflict`. Complete-only projection in `src/lib/amex-benefit-reader/sync-contract.ts:152-206` therefore yields no synchronizable cards. | Approved ignored records must no longer create false conflicts; every genuinely contradictory candidate that remains continues to block the entire card. |
| Four zero-benefit cards degraded after catalog HTTP errors | Expected fail-closed limitation | Medium | High | C01-C03 and C16 are partial/current with `http_error`, zero retained benefits, and no record-level hard error, matching catalog-only degradation in `src/lib/amex-benefit-reader/scan-engine.ts:232-281`. | Retain safe tracker observations while clearly saying the benefit catalog was unavailable; do not represent the empty result as confirmed absence. |
| Exact airline, Dell, and Resy conflict causes cannot be reconstructed after reload | Diagnostic limitation | Medium | High | Only generic `benefit_identity_conflict` persists. Structured candidates are intentionally ephemeral under `src/lib/amex-benefit-reader/amex-response-adapter.ts:926-1057` and `src/userscripts/amex-benefit-reader/panel.ts:632-655`. | Resolve the three reviewed false-conflict sources before candidate creation. Persisting additional diagnostics remains a separate future improvement. |
| The Adobe `$250` title and `$600` amount describe reward value versus qualifying spend | Scope defect, not a parser-amount defect | Medium | High | C04 and C05 show `$250 Adobe Credit` with a completed `$600 of $600` provider-category `spend` tracker. The catalog identifies this as a $250 credit after $600 spend in `src/lib/american-express-card-catalog.ts:344-353`. | Ignore the provider-category `spend` tracker entirely rather than presenting it as credit consumption. |
| Supplementary physical cards are scanned as ordinary cards | Confirmed ownership-scope defect | High | High | The v0.3.1 scan attempted three Additional Platinum and four Companion Platinum records. `parseAccountDiscovery` flattens top-level `BASIC` and nested `SUPP` entries in `src/lib/amex-benefit-reader/amex-response-adapter.ts:203-268`, then `scan-engine.ts:167-275` drops the role and reads every card. | Admit only top-level exact `BASIC`; treat nested exact `SUPP` as an understood exclusion before identity or network work. |
| Empty or exhausted card groups remain in the active panel filter | Confirmed filter-projection defect | Medium | High | Current coverage excludes only `confirmed_empty`, so the latest shape renders nine card groups although only four contain benefits; five visible groups have no rows. An all-used card also remains as a compact `0 remaining benefits` group under `Remaining` because coverage uses unfiltered benefit count in `panel.ts:289-317,661-668,989-1069`. | Render a group only when it has rows in the active filter; keep omitted-card quality counts in account-level summary copy. |

### Synchronization impact

- No card is currently eligible for synchronization from this scan.
- The only source-side rows in allowlisted writable families are current-quarter Resy and lululemon observations on C14 and C15. Their normalized amounts, enrollment states, completion states, and structured periods are internally consistent, but both cards are excluded because they are partial.
- The persisted report alone does not prove that the conflicts affect or do not affect the Resy/lululemon families. Synchronization must remain blocked until conflict locality is known or the card becomes complete.

## Acceptance Criteria

- [x] The reader's existing normalized state is exported locally without initiating synchronization, triggering a new scan, or changing account data.
- [x] The export contains only the reader's normalized observations and excludes raw responses, credentials, cookies, tokens, and unrelated extension data.
- [x] Exported observations are analyzed primarily through local file tools and compared against the provider-visible evidence already observed.
- [x] Findings are recorded with severity, evidence, expected behavior, and confidence while avoiding unnecessary sensitive data.
- [x] Every tracker categorized exactly as `spend` is absent from normalized observations, compatibility-projected storage, the panel, and synchronization projection, while non-`spend` credit usage—including Dell `usage` at any amount—remains eligible.
- [x] The approved airline filter retains `$200 Airline Fee Credit` while ignoring `35% Airline Bonus`.
- [x] The approved Resy filter retains the credit tracker while ignoring `Link Your Resy Profile`.
- [x] Narrow conflict-resolution tests prove ignored records create no conflict, stored row, panel row, or synchronization row, while unrelated genuine collisions remain fail-closed.
- [x] Only characterized top-level `BASIC` cards are discovered and attempted; nested exact `SUPP` cards cause no identity, tracker, catalog, storage, panel, or sync work and do not degrade the scan as unknown.
- [x] A one-time compatibility migration invalidates role-unverified observations and pending mailboxes, preserves the identity secret, refuses malformed/future stores unchanged, and is idempotent.
- [x] The panel retains reconciled quality counts but renders only card groups with rows in the active filter; `Remaining` has no zero-benefit or all-used compact groups, and `Used` shows only groups with used rows.
- [x] V2 periods render from structured date ranges without exposing raw provider duration tokens when the structured range is valid.
- [x] No Sync action, mailbox handoff, confirmation, AMEX mutation, Perks Reminder mutation, or database write occurs.

## Out of Scope

- Synchronizing any benefit data or relaxing the existing complete-card synchronization gate for genuine conflicts.
- Applying migrations, backfills, seeds, configuration changes, or server/database synchronization changes.
- Persisting new conflict-detail fields or adding ownership-role fields to the normalized storage schema.
- Removing the explicit `Used` filter; the fix changes filter-aware card-group visibility rather than discarding completed observations.
- Installing the updated userscript, triggering another live scan, or performing browser-based account validation without separate explicit authorization after implementation review.
- Recording credentials, session tokens, cookies, full raw provider responses, or unrelated browser-extension data.
