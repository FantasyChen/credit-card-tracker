# Implementation Plan: Refine AMEX pre-sync benefit list

## Preconditions

- Use the existing Tampermonkey reader; do not migrate to a Chrome extension.
- Load the curated task context, PRD, and design before editing.
- Run `trellis-before-dev` and follow the browser-reader, frontend, and verification specifications.
- Keep the existing exact AMEX operation, normalized storage, and supported-credit boundaries unchanged.
- The user granted durable authorization on 2026-07-22 for unchanged-scope monotonic local reader updates and read-only scans on their manually authenticated AMEX page. This does not authorize login/MFA automation, provider mutation, broader match/grant authority, credential access, or raw-response persistence.

## Ordered checklist

### 1. Baseline and presentation contract

- [x] Inspect the current panel state derivation, filters, selected-card rendering, styles, and focused tests.
- [x] Run the targeted panel test baseline before changing code.
- [x] Add or revise failing tests for the agreed truthful states and their precedence:
  - Enrollment required;
  - Link required;
  - Used;
  - Partially used;
  - Not used;
  - Status unavailable;
  - observation quality remains independent.
- [x] Confirm incompatible/missing quantities never become zero, partial, or complete by inference.

**Gate:** the failing tests describe the approved presentation contract without requiring provider/schema changes.

### 2. Implement truthful state derivation

- [x] Refine the existing presentation helper or extract a small pure adjacent module if that materially improves reuse/testability.
- [x] Preserve normalized observations unchanged.
- [x] Map exact source evidence to the six approved labels using the design precedence.
- [x] Keep amount and period formatting conservative and compatible with existing unit rules.
- [x] Keep stale/partial/error quality separate from the row state.

**Validation:** targeted state/panel tests pass.

### 3. Replace selected-card workspace with grouped master list

- [x] Remove the selected-card-only navigation from the main review workspace.
- [x] Build one deterministic physical-card grouping from all stored records.
- [x] Label each group with product and ending digits.
- [x] Keep duplicate products distinct.
- [x] Keep every benefit-bearing scanned card represented under the active filter, including compact zero-count no-Remaining/no-Used groups; hide globally benefit-empty cards behind one aggregate note.
- [x] Render practical row essentials only: name, exact status, used/target when available, and period.
- [x] Keep card-level quality in the accessible group heading and technical diagnostics in secondary disclosures.

**Gate:** tests prove all cards and benefits are reachable without a second UI or changed scan/storage behavior.

### 4. Replace four filters with Remaining / Used

- [x] Make Remaining the default.
- [x] Put every non-Used exact state in Remaining without relabeling it.
- [x] Put only Used rows in Used.
- [x] Show global filter counts and accessible selected state.
- [x] Remove obsolete selected-card/four-filter state and styles.
- [x] Preserve keyboard behavior, focus visibility, semantic headings, and text labels independent of color.

**Validation:** panel tests cover both filters, counts, empty groups, and accessibility attributes.

### 5. Update generated-bundle browser coverage

- [x] Update invented fixtures/assertions for the grouped master list and two filters.
- [x] Prove one manual scan renders every synthetic physical card and eligible observation.
- [x] Preserve the 16-card / 130-observation high-scale reachability check with bounded panel scrolling.
- [x] Prove restore and filter interaction issue no provider reads.
- [x] Prove unsupported rows remain absent and duplicate products remain distinct.
- [x] Keep the harness synthetic and deny every unknown network request.

**Validation:** `npm run test:e2e:amex` passes against the rebuilt artifact.

### 6. Visual and static quality pass

- [x] Inspect desktop and narrow-width synthetic views.
- [x] Confirm the grouped hierarchy, row density, badges, empty states, scroll behavior, and focus states match Perks Reminder's practical list language.
- [x] Run targeted Jest for all reader/panel changes.
- [x] Run strict TypeScript.
- [x] Run targeted ESLint for changed source/tests.
- [x] Rebuild and audit the userscript metadata/artifact.
- [x] Run sensitive-field/destination/grant checks and `git diff --check`.

### 7. Authorized live iteration

- [x] Bump the canonical userscript version monotonically and rebuild.
- [x] Install the exact reviewed update using the approved Tampermonkey handoff under the user's authorization.
- [x] Verify the exact-origin reader mounts idle without scanning.
- [x] Wait for the user to open AMEX and complete authentication manually.
- [x] Run bounded read-only account-wide scans under the user's authorization.
- [x] Review the normalized eligible benefit groups while retaining only sanitized aggregate evidence.
- [x] When live evidence exposes a defect, return to the earliest affected checklist step and repeat automated checks before the next update/scan.

**Sanitized live findings (2026-07-22):**

- The first read-only account-wide scan exposed one presentation defect: a numeric HTML character reference in an eligible benefit title appeared literally. No account identifiers, request/response data, session material, or live benefit values were retained.
- The defect was reproduced with invented fixtures, fixed at the text-only presentation boundary, and verified through unit, generated-artifact, synthetic browser, visual, static, and security checks. Tampermonkey installation of exact version 0.2.8 was independently verified with the AMEX-only match scope and storage-only grants unchanged.
- A follow-up read-only scan completed with 15 currently discovered cards checked. The local grouped review retained 16 physical-card observations because one prior observation was preserved as stale, and showed 28 eligible benefits: 16 Remaining and 12 Used. The truthful state aggregate was 16 Partially used, 12 Used, and zero in the other four states.
- Nine card groups had data notes: eight Partial data, one Stale data, and zero Could not read; seven groups were current and complete. Expected Lululemon and Resy families were present. The encoded marker was absent and the decoded title was present after the follow-up scan.
- No raw provider payload, request body, token, cookie, header, credential, full account identifier, live amount, or broad account screenshot was retained.

**Completion gate:** all acceptance criteria are demonstrated by automated evidence plus the authorized sanitized live review, or any skipped live criterion is reported explicitly.

### 8. User-directed empty-card and state-quality refinement

- [x] Hide cards whose latest normalized observation has zero eligible benefits without changing normalized storage, scan coverage, or stale preservation.
- [x] Add one non-identifying aggregate hidden-card note and one account-level empty state when all reviewed cards are globally empty.
- [x] Scope card and data-note summary metrics to benefit-bearing cards.
- [x] Keep benefit-bearing cards with zero active-filter rows as compact accessible header/count groups without repeated empty-message boxes.
- [x] Give compatible zero usage precedence over generic in-progress evidence while preserving prerequisite and Used precedence.
- [x] Add invented unit and generated-bundle fixtures for hidden empty cards, scoped metrics, compact groups, all-empty accounts, high scale, and zero-plus-in-progress state derivation.
- [x] Bump the canonical generated userscript version from `0.2.8` to `0.2.9` and update exact artifact assertions.
- [x] Run the complete task-allowed automated and static validation matrix for `0.2.9`.

This refinement is synthetic-only. It does not authorize or perform Tampermonkey installation, authenticated browser access, or another live scan, and it retains no live identifiers or amounts. Project-wide spec promotion remains a separate phase.

### 9. Card-level quality and terminal title-footnote refinement

- [x] Remove duplicated partial/stale quality text from benefit rows while retaining one accessible card-heading badge.
- [x] Retain card-level data-quality/timestamp details and fixed redacted issue reasons without reclassification.
- [x] Add a presentation-only AMEX title formatter that decodes numeric references once and strips only a terminal `<sup>‡</sup>` or standalone `‡` adornment.
- [x] Preserve nonterminal daggers and unrelated markup-like text as inert text, with empty-result fallback and unchanged normalized storage.
- [x] Add focused unit, panel, and generated-bundle fixtures for the title and card-quality boundaries.
- [x] Bump the canonical generated userscript version from `0.2.9` to `0.2.10` without changing match scope, grants, destinations, or provider operations.
- [x] Run the complete task-allowed automated and static validation matrix for `0.2.10`.

This refinement remains synthetic-only. Do not install the userscript, access authenticated AMEX, perform a scan, or run a production/database command.

### 10. Exact Statement Credit footnote and ephemeral conflict-path diagnostics

- [x] Add failing invented formatter and panel fixtures for literal and one-pass-decoded `<sup>‡</sup> Statement Credit`, plus arbitrary prose, other tags/symbols, multiple markers, named references, double encoding, terminal behavior, and empty fallback.
- [x] Remove only the exact reviewed marker before the exact ` Statement Credit` suffix while preserving one-pass decoding, inert `textContent`, matching behavior, and normalized source titles.
- [x] Add a stable internal fixed enum for `tracker_state_collision`, `tracker_catalog_key_mismatch`, `ambiguous_catalog_join`, and `tracker_catalog_candidate_collision`.
- [x] Cover every current generic conflict production site with invented adapter fixtures, separate card/row issue locality assertions, deterministic unique category order, and relevant tracker/catalog order reversal.
- [x] Carry categories only on the ephemeral per-card `card_committed` progress event and panel memory; retain only `benefit_identity_conflict` plus partial disposition in normalized storage.
- [x] Render fixed redacted labels in card-level secondary details, clear them on a new scan/clear, and prove reconstruction/reload from GM storage cannot restore them.
- [x] Add generated-bundle coverage for the exact title shape and all four diagnostic categories without source imports, raw fields, console/network output, or additional destinations.
- [x] Bump the canonical generated userscript version from `0.2.10` to `0.2.11` without changing exact match scope, grants, destinations, or the three approved read operations.
- [x] Run and record the complete task-allowed automated/static validation matrix for `0.2.11`.

This refinement is synthetic-only. It does not install the userscript, access an authenticated browser, or perform a live scan. The ephemeral categories are designed to be available for a future separately authorized bounded scan and to disappear on reload.

### 11. Exact registered-sign footnote follow-up

- [x] Add failing invented formatter fixtures for literal and numeric-reference-derived `<sup>®</sup>` terminal and exact `<sup>®</sup> Statement Credit` forms.
- [x] Preserve one separator before `Statement Credit` for nonempty prefixes and add negative coverage for unrelated superscript symbols/tags, arbitrary mid-title prose, whitespace variants, and broader suffixes.
- [x] Extend the existing presentation-only formatter with the exact registered-sign marker without generic tag stripping, DOM parsing, HTML sinks, repeated decoding, matcher changes, or normalized-storage changes.
- [x] Add panel and generated-bundle assertions proving cleaned inert display text while normalized storage retains the invented source title.
- [x] Bump the canonical generated userscript version from `0.2.11` to `0.2.12` without changing match scope, grants, destinations, conflict diagnostics, or the three approved read operations.
- [x] Run and record the complete task-allowed automated/static validation matrix for `0.2.12`.

This follow-up is based only on the sanitized marker grammar from the bounded `0.2.11` scan. It must not access a browser, install or scan, inspect provider payloads, or retain any account identity, amount, title, or source value.

**Recorded automated result (2026-07-22):** the red-first formatter run failed at the two new registered-sign expectations before implementation. After implementation, focused formatter and panel suites passed (6 and 20 tests); full AMEX Jest passed 11 suites / 102 tests; generated-bundle Playwright passed 9 tests with the opt-in visual test skipped; strict TypeScript, targeted ESLint, isolated build, exact metadata/operation, sensitive-API, mutation/polling/sync, conflict-diagnostic, JSON/JSONL, Trellis task, package-context, and diff/whitespace audits passed. The known Next/SWC `15.5.11` / `15.5.7` warning remained unchanged. No browser installation, authenticated access, provider scan, or payload inspection occurred during implementation or independent checking.

### 12. Authorized 0.2.12 installation and bounded live verification

- [x] Install exact reviewed userscript version `0.2.12` through Tampermonkey under the existing unchanged-scope authorization.
- [x] Reopen the local artifact only to verify installed version `0.2.12`, AMEX-only match scope, and the three storage-only GM grants; cancel reinstallation to preserve settings.
- [x] Reload the task-owned manually authenticated AMEX `/overview` page and verify the mounted reader reports version `0.2.12` before scanning.
- [x] Run one bounded read-only account-wide scan and retain only sanitized aggregates and fixed diagnostic-category counts.
- [x] Verify Remaining and Used filters, zero repeated row-level quality labels, and zero visible `<sup>…</sup>`, `‡`, or `®` title artifacts.

**Sanitized live result (2026-07-22):** version `0.2.12` completed with `Scan finished with data notes. 15 cards checked.` Four benefit-bearing card groups exposed 28 eligible benefits while 12 reviewed benefit-empty cards remained hidden behind one aggregate note. Remaining contained 16 rows (10 Not used and 6 Partially used); Used contained 12 Used rows. Both filters had zero repeated row-level quality labels and zero recognized title-footnote artifacts.

All four benefit-bearing cards remained card-level Partial data with the existing generic `benefit_identity_conflict` reason. Ephemeral fixed-category counts were: `tracker_state_collision` on 2 cards, `ambiguous_catalog_join` on 2 cards, `tracker_catalog_candidate_collision` on 2 cards, and `tracker_catalog_key_mismatch` on 0 cards. A card may contribute to more than one category, so category counts are not additive card counts. This confirms the remaining Partial data is fail-closed source ambiguity rather than the removed row-label presentation bug; these cards remain ineligible for future synchronization under the current complete-card write precondition.

No raw provider response, raw title, product/card identity, source ID, amount, period, request body, token, cookie, authorization header, credential, or broad account screenshot was retained. The ephemeral categories remain absent from normalized storage and disappear on reload.

### 13. Owner-authorized local structured conflict review contract

- [x] Add a typed closed `BenefitIdentityConflictDetailSet` with fixed source roles, explicit parsed field states, reviewed key/family arrays, safe relations, detail/candidate caps, truncation flags, and deterministic scan-local conflict keys.
- [x] Populate exact candidate facts for tracker-state collision, tracker/catalog key mismatch, ambiguous catalog join, and tracker/enrollment-candidate collision using only already parsed/validated adapter fields.
- [x] Keep internal join IDs available only for relation comparison and strip all issuer/source IDs, tokens, raw objects, generic passthroughs, and secret-like fields before the result contract.
- [x] Attach detail only to per-card `card_committed` progress events and panel memory while preserving the fixed category, generic persisted issue, card partial disposition, and first-retained fail-closed normalized result.
- [x] Render a bounded accessible card-level diagnostic section with stable `data-amex-*` card/conflict/candidate/field/relation hooks inside the reader-owned open shadow tree.
- [x] Make per-card details replace on successful/partial/failed commit, clear all on new scan/clear, and reconstruct none from storage after reload.
- [x] Add invented adapter, engine, panel, and generated-bundle tests for exact shapes across all four categories, deterministic reversal, caps/truncation, card scope, lifecycle clearing, native DOM extraction, GM absence, and forbidden source/secret fields.
- [x] Bump canonical generated userscript version from `0.2.12` to `0.2.13` without changing match scope, grants, destinations, the three approved reads, mutation authority, or Perks Reminder transport.
- [x] Update the active PRD/design/plan and shared browser-read integration spec for the explicitly authorized sole-local-operator diagnostic contract.
- [x] Run the complete task-allowed automated/static/privacy validation matrix for `0.2.13`.

This refinement is implementation and synthetic validation only. Do not install the userscript, access an authenticated browser, perform a live scan, resolve any conflict, commit, or push. A later main session may use narrow native extraction from the reader host/shadow tree and ask concrete choices under the user's authorization.

**Recorded automated result (2026-07-22):** the initial focused adapter run failed on the missing `conflictDetails` contract before implementation. After implementation, full AMEX Jest passed 11 suites / 105 tests; generated-bundle Playwright passed 9 tests with the opt-in visual test skipped; strict TypeScript and targeted ESLint passed; userscript `0.2.13` built successfully; exact metadata/grant/operation, mutation, sensitive-API, alternate-transport, HTML-sink, polling, sync-destination, structured-data, task-context, package-context, and diff/whitespace audits passed. The known Next/SWC `15.5.11` / `15.5.7` warning remained unchanged. No userscript installation, authenticated browser access, provider scan, conflict resolution, payload inspection, commit, or push occurred.

## Validation commands

Use the exact scripts available in `package.json`; expected minimum commands are:

```bash
npx jest --runInBand src/userscripts/amex-benefit-reader/__tests__/panel.test.ts
npx jest --runInBand src/lib/amex-benefit-reader src/userscripts/amex-benefit-reader
npx tsc --noEmit --pretty false --incremental false
npm run build:amex-userscript
npm run test:e2e:amex
git diff --check
```

Run targeted ESLint with the repository's existing invocation after identifying the changed files. Do not run the general production build as routine validation because it may invoke Prisma migration deployment.

## Risk and rollback points

- **State derivation:** if truthful labels require inferred data, stop and keep Status unavailable.
- **Grouping scale:** if rendering every benefit-bearing card group causes unacceptable DOM or panel behavior, optimize grouping/rendering without restoring lossy identity or changing the product requirement.
- **Provider boundary:** any new endpoint, grant, raw field, or storage schema requires a return to planning.
- **Installed userscript:** repository rollback is insufficient; use a separately authorized monotonic version update to restore behavior.
- **Live data:** never store broad screenshots or payload dumps; sanitize evidence at collection time.

## Final review

- [x] Re-read `prd.md` and `design.md` against the implementation diff.
- [x] Confirm no Perks Reminder transport, database change, provider mutation, autoscan, credential automation, or extension packaging was added.
- [x] Confirm every changed/untracked path is intentional.
- [x] Run `trellis-check` before reporting completion or committing.
