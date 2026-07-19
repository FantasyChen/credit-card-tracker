# Implementation Plan — Amex Benefit Reader Phase 1

## Preconditions and review gates

- [ ] User approves `prd.md`, `design.md`, and this implementation plan.
- [ ] Task is started only after approval; planning approval does not imply implementation approval.
- [ ] Load project conventions with `trellis-before-dev` before editing product code.
- [ ] Confirm the active task context points to `.trellis/tasks/07-15-amex-card-benefit-sync`.
- [ ] Keep Phase 1 isolated from website APIs, Prisma, NextAuth, analytics, and production deployment.
- [ ] Never commit live Amex DOM, screenshots, ending digits, opaque IDs, balances, loyalty data, cookies, headers, network captures, or Tampermonkey storage exports.

## 1. Add the portable contract and build boundary

- [ ] Add `src/lib/amex-benefit-reader/contract.ts` with strict Zod schemas and TypeScript types for:
  - observed/not-exposed/unrecognized fields;
  - quantities and units;
  - card and benefit observations;
  - completeness/freshness/error states;
  - storage envelope and scan summary.
- [ ] Name the displayed card field `endingDigits` and validate exactly four or five digits.
- [ ] Define independent constants for observation contract, storage schema, and parser versions.
- [ ] Reject unknown keys and forbidden sensitive field names at persistence boundaries.
- [ ] Add contract tests before implementing the parser.
- [ ] Add direct `esbuild` development dependency, dedicated userscript build script, and `build:amex-userscript` package command.
- [ ] Ensure the generated artifact goes under ignored `build/` and contains the minimal metadata grants from `design.md`.

**Gate:** contract tests pass and the empty/thin userscript bundle builds without modifying website runtime behavior.

## 2. Add the allowlisted read client, response adapter, and sanitized JSON fixtures

- [ ] Pin the reviewed public reference revision and define only the characterized account-discovery, benefit-tracker, and benefit-catalog read operations in `amex-api-contract.ts`.
- [ ] For each operation, fix the exact origin, path, HTTP method, credentials mode, headers, timeout, redirect policy, and minimal body builder; do not expose a generic URL/options caller and do not define mutation endpoints.
- [ ] Implement `amex-api-client.ts` with fresh browser-session requests, `AbortSignal`, bounded timeout, fixed redacted HTTP/auth errors, content-type checks, and strict response-envelope validation.
- [ ] Keep raw JSON and raw account tokens in request/scan-scoped local variables only. Assert they never cross the normalized observation or storage boundary.
- [ ] Create synthetic account, tracker, and catalog JSON fixtures using invented data only.
- [ ] Add fixture variants for:
  - four- and five-digit endings;
  - duplicate product names and distinct account tokens;
  - primary and supplementary relationships;
  - known non-card and unknown account variants;
  - enrollment, spend progress, credit earned, and completed records;
  - monetary and count quantities;
  - recognized empty arrays and optional missing fields;
  - malformed envelopes and unknown status/relationship values;
  - conflicting benefit identities.
- [ ] Implement versioned response parsing in `amex-response-adapter.ts`, including positive card classification and explicit known-non-card/unknown results.
- [ ] Require an explicit product name and four/five-digit display field; never derive visible digits from an opaque token.
- [ ] Parse trackable tracker records, enrich them from catalog category/enrollment data, preserve decimal strings/unknown fields, and avoid reference behaviors that infer zero, remainder, or annual period.
- [ ] Deduplicate identical observations and make conflicts explicit issues.
- [ ] Add client/adapter tests for every fixture and assert raw fixture tokens, raw responses, headers, and forbidden fields are absent from serialized output.

**Gate:** request-allowlist and response-fixture tests prove complete, partial, empty, malformed, auth, timeout, and denied-mutation outcomes without using live account data.

## 3. Implement local identity and storage policy

- [ ] Add Web Crypto installation-secret generation and full HMAC-SHA-256 fingerprinting in `identity.ts`.
- [ ] Keep raw API account tokens inside transient active-scan references only; never persist or display them.
- [ ] Implement conservative exact/reconciled/new/ambiguous card identity behavior.
- [ ] Implement semantic benefit-key generation without list positions.
- [ ] Add identity tests for deterministic fingerprints, separate same-name cards, conflicts, and raw-token non-serialization.
- [ ] Implement pure validated store initialization/migration/refusal and per-card merge policy in `storage-policy.ts`.
- [ ] Implement complete/partial replacement, failed-card stale preservation, first-seen failure shell, mixed ages, revision increments, and fixed redacted errors.
- [ ] Add tests for malformed/unknown-future schemas and clear-data behavior.

**Rollback point:** contract, fixtures, identity, and storage modules are pure and can be reverted without affecting any runtime entry point.

## 4. Implement the read-only API scan state machine

- [ ] Define testable `AmexReadClient`, `VisibleContextGuard`, `ResultStore`, `Clock`, and `ScanReporter` ports.
- [ ] Implement one-active-scan enforcement and cancellation through `AbortController`.
- [ ] Capture a non-sensitive visible card/route guard before discovery; the client must not navigate or click Amex UI.
- [ ] Call account discovery once, classify/deduplicate supported relationships, and report real totals plus unknown-variant accounting.
- [ ] For every supported card, initially sequentially:
  - derive/reconcile local identity from the transient account token;
  - call only the allowlisted tracker and catalog reads;
  - strictly validate and normalize both responses;
  - release raw per-card response objects;
  - merge and commit that card independently.
- [ ] Continue after individual card failures and preserve stale prior observations.
- [ ] In `finally`, discard scan-scoped raw account/response state and verify the visible card/route remained unchanged.
- [ ] Treat full unload as interruption without persisting transient tokens or raw responses.
- [ ] Add fake-port tests for ordering, auth/HTTP/schema failures, cancellation, timeout, continuation, bounded concurrency, raw-data disposal, commit disposition, and visible-page invariance.
- [ ] Add safety tests proving every request uses an exact approved read origin/path/method/body and every known mutation endpoint/method is denied.

**Gate:** engine/client tests pass with exact synthetic `fetch` mocks; `XMLHttpRequest`, `sendBeacon`, and `WebSocket` patched to throw; and mutation endpoint/control instrumentation failing if activated.

## 5. Add Tampermonkey storage and side-panel UI

- [ ] Add a thin `GM.getValue`/`GM.setValue`/`GM.deleteValue` adapter using the two versioned storage keys.
- [ ] Mount a single Shadow-DOM panel host on supported routes.
- [ ] Render stored per-card results before any new scan, with timestamps and freshness.
- [ ] Add local-only disclosure, first-party Amex read/raw-not-saved disclosure, manual scan, cancel, progress, mixed-age warning, card status badges, benefit summary/details, and confirmed clear-data controls.
- [ ] Use semantic buttons, headings, status regions, keyboard behavior, and `aria-live` progress.
- [ ] Ensure Amex styles do not leak into the panel and panel styles do not leak into Amex.
- [ ] Add panel tests for idle/scanning/cancelling/complete/mixed/error/incompatible-storage states.
- [ ] Add the thin `.user.ts` entry with exact route guard and dependency wiring; keep parser/storage policy out of the entry.
- [ ] Confirm there is no autoscan, interval, background behavior, keep-alive, remote update metadata, generic request escape hatch, or mutation endpoint.
- [ ] Prefer ordinary first-party `fetch` with browser-attached credentials. If runtime forces a privileged network grant or page-world bridge, stop for a design review before adding it.

**Gate:** the generated `.user.js` contains the expected metadata and only the exact reviewed Amex read endpoints; no mutation, website, analytics, update, third-party, or generic-network code is present.

## 5a. Revise the panel for card-first status clarity

- [x] Add pure presentation helpers for observation quality, human benefit status, filter buckets, compatible-unit progress, and concise amount/period copy without changing normalized contracts.
- [x] Keep transient selected-card and benefit-filter state inside `AmexBenefitReaderPanel`; preserve the selected card across scan progress rerenders and select a deterministic fallback when records change.
- [x] Replace the all-card continuous list with a labeled native card switcher and one selected-card workspace.
- [x] Add selected-card summary counts and filters for all, needs action, in progress, and completed using semantic buttons with `aria-pressed`.
- [x] Restyle the panel to match Perks Reminder: neutral rounded surfaces, subtle borders/shadows, dark primary action, amber open/action state, emerald complete state, muted unknown state, compact badges, and clear typographic hierarchy.
- [x] Replace ambiguous user-facing labels (`Incomplete`, `Used/earned`, raw enum wording) with explicit observation-quality and benefit-status copy.
- [x] Render compatible progress bars without deriving or persisting missing values. Retain observed remaining values only when Amex exposed them.
- [x] Move card issue codes/timestamps and technical normalized fields behind secondary disclosures. Keep local-only/request disclosure visible and move clear-data into a secondary data/privacy disclosure.
- [x] Add empty-filter, no-benefit, stale, partial, error/no-data, scan progress, cancellation, and reload-required states.
- [x] Expand panel tests for card switching, duplicate product labels, status mapping, filters/counts, compatible progress, non-inference, accessible pressed/selected state, scale, and legacy safety states.
- [x] Bump the userscript patch version to `0.2.2` and rebuild the ignored artifact.
- [x] Update the intended Tampermonkey copy only with explicit action-time approval. The owner completed Tampermonkey's extension-owned confirmation for `0.2.2`; the legacy `0.1.0` copy remained untouched.

**Gate:** targeted panel tests demonstrate that a 16-card / 130-observation store renders one selected card at a time, every observation remains reachable, benefit status is distinct from data quality, and no provider/network/storage contract changes.

**Result:** the synthetic card-first preview was visually checked at the available desktop viewport, including card switching, pressed filter state, benefit details, data-quality notes, panel scrolling, and the privacy disclosure. The 11 panel tests include an explicit 16-card / 130-observation scale case and error/empty-filter states.

## 5b. Restrict normalized output to represented usable card credits

- [x] Add one portable `supported-card-credits.ts` owner for conservative Amex product aliases, catalog-backed usable-credit rules, and card-scoped semantic credit keys.
- [x] Extract a small DB-free `american-express-card-catalog.ts` source consumed by both the general Perks Reminder static catalog and the userscript matcher; activate a rule only when the matched card exists and a reviewed anchor resolves to a positive-amount catalog benefit.
- [x] Keep product matching exact after punctuation/trademark normalization; support only reviewed title phrases and omit ambiguous, unmatched, wrong-card, and unknown-card records.
- [x] Apply support filtering before status/category/quantity interpretation so intentionally unsupported informational, protection, access-only, free-night/status, and other non-credit items do not create false partial markers.
- [x] Deduplicate equivalent supported wording variants with a card-scoped key while retaining a conflict issue for materially different observations of the same supported credit.
- [x] Pass the prepared card product into normalization without changing endpoint definitions, response schemas, raw-data lifetime, storage schema, or panel persistence contracts.
- [x] Project compatible schema-1 stores through the same support matcher on load and rewrite only when legacy unsupported rows were removed, so stale pre-`1.1.0` rows do not remain persisted or visible before a rescan.
- [x] Add focused matcher/adapter/storage tests for represented credits, intentional product/title variants, wrong-card rejection, unknown cards, non-credit exclusion, no false partial status, deduplication, and legacy-store filtering.
- [x] Keep the storage schema at version 1, bump parser rules to `amex-api-us/1.1.0`, bump the userscript patch to `0.2.3`, and rebuild only the ignored artifact.

**Gate:** targeted reader tests, strict TypeScript, targeted ESLint, isolated userscript build, and diff checks pass; existing API client and storage tests continue to prove the unchanged network and persistence boundaries.

## 5c. Add generated-bundle Chromium E2E coverage

- [x] Add `@playwright/test`, a task-scoped Chromium config, build-first package commands, and ignored screenshot/trace/result directories without invoking the general production build or a database command.
- [x] Install fail-closed routing before navigation: fulfill one invented Amex benefits document, exact synthetic member/tracker/catalog reads, and only their necessary CORS preflights; abort every other request without fallback.
- [x] Assert exact methods, origins, paths, `Accept`/JSON content type, and fixed request-body structures while keeping all fixture tokens, endings, titles, and quantities invented.
- [x] Install inspectable promise-based `GM.getValue`/`setValue`/`deleteValue` bindings and a receiver-neutral bound-native-fetch facade that models the Tampermonkey sandbox without adding production storage or transport hooks.
- [x] Build and inject the actual generated `build/amex-benefit-reader.user.js` IIFE, then interact only through the mounted open Shadow DOM.
- [x] Cover no autoscan, manual progress/completion, primary/supplementary duplicate products, supported-credit inclusion and non-credit/wrong-card omission, card switching, normalized storage, reload restoration without autoscan, visible-context invariance, confirmed two-key deletion, and unexpected-network refusal.
- [x] Add a deterministic catalog-`500` retry scenario proving tracker observations remain current partial data.
- [x] Add `npm run test:e2e:amex:visual` for a headed synthetic preview whose screenshot remains below ignored `test-results/`.
- [x] Record that routine iterations use the harness while milestone releases still need bounded owner-only checks for live schemas, session/CORS, Tampermonkey behavior, and issuer-side no-mutation evidence.

**Gate:** `npm run test:e2e:amex` passes in installed Playwright Chromium with two unattended scenarios and no unexpected request; the optional headed preview passes and writes only a synthetic ignored screenshot.

## 6. Automated quality checks

Run targeted checks first:

```bash
npm test -- --runInBand src/lib/amex-benefit-reader src/userscripts/amex-benefit-reader
npm run test:e2e:amex
npx tsc --noEmit --pretty false --incremental false
npx eslint playwright.amex.config.ts tests/e2e/amex-benefit-reader
npm run build:amex-userscript
git diff --check
```

Then run repository checks required by current Trellis specs, avoiding the general database-deploying build command unless the current verification guidance explicitly makes it safe:

```bash
npm test -- --runInBand
npm run lint
```

- [ ] Inspect the generated artifact for metadata grants, exact endpoint constants, denied mutation fragments, and forbidden external destinations.
- [ ] Serialize every fixture-derived store and assert no raw token, raw response object, header, request body, or forbidden key is present.
- [ ] Confirm tests cover every acceptance criterion that can be automated.
- [ ] Run `trellis-check` and resolve all confirmed issues before browser validation.

## 7. Owner-only browser validation

This validation uses only the owner's authenticated Amex session and remains read-only.

### Recorded final status — userscript 0.2.1

The final owner-only run was completed after reauthentication and a real page reload. The sanitized evidence is recorded in `amex-research.md`: 16 distinct card attempts produced 16 stored records and 130 normalized observations; the scan was partial, repeated products remained distinct, three catalog reads exhausted one retry while retaining valid tracker data, no mutation-like request was observed, and the visible route/selected-display digest remained unchanged. A subsequent reload restored the same records in manual idle state without triggering a member or tracker scan. Normal Amex page traffic did make one catalog request during that reload, so this result is specifically evidence against userscript autoscan rather than all page-private traffic.

Live clear-data behavior was validated earlier in the task and was not repeated after the final run in order to preserve the stored evidence. Cancellation is covered by automated tests, not by this final owner-only scan. Before live validation, nine suites/66 tests, strict TypeScript, targeted ESLint, the userscript build, audits, secret scan, JSON/JSONL validation, and diff checks passed; the existing Next/SWC version mismatch warning was unrelated.

- [x] Build and manually install/update `build/amex-benefit-reader.user.js` in Tampermonkey.
- [x] Open a supported benefits page and confirm no scan occurs until **Scan all cards** is pressed.
- [x] Confirm the panel loads existing local records and displays the local-only disclosure.
- [x] Run one scan and verify:
  - attempted card count matches supported relationships returned by account discovery;
  - non-card products are excluded;
  - primary/supplementary cards and duplicate product names remain separate;
  - displayed trackable benefit states/amounts match the corresponding visible Amex UI where available;
  - unknown/optional fields are represented without guesses;
  - the original selected card and route remain unchanged.
- [x] Confirm no enroll/link/activate/redeem/add-offer/payment control or write endpoint was invoked.
- [x] Observe only redacted request metadata and confirm userscript traffic is limited to the exact approved first-party account/tracker/catalog read destinations and methods. Do not capture or save live response bodies, headers, cookies, request bodies, or account tokens.
- [ ] Inspect Tampermonkey storage structurally and confirm only the two expected keys exist and no raw response, opaque token, header, request body, or forbidden sensitive field is stored; do not export the values.
- [ ] Confirm raw response objects disappear after completion/cancellation by runtime-owned diagnostics or lifecycle counters, not by exporting payload contents.
- [x] Simulate a safe response/card failure using a synthetic fixture or controlled adapter test; confirm the successful cards update while the failed card retains prior data as stale.
- [x] Test cancellation and verify already committed cards remain safe and the run is marked interrupted.
- [x] Use **Clear local data** and verify both result and identity-secret keys are removed. This was completed earlier in the task and was not repeated after the final `0.2.1` scan.
- [x] Do not save or commit authenticated screenshots, live page exports, console dumps, or storage exports.
- [x] Run the available project verification workflow for end-to-end observable behavior before any commit (`trellis-check`; no separate `verify` skill is installed).

**Browser rollback:** cancel the scan, clear local data if desired, disable the userscript, and restore the previous bundle.

## 8. Final review and documentation

- [x] Map test and browser evidence to AC1–AC11 in `prd.md` and the sanitized validation sections of `amex-research.md`.
- [x] Recheck that no Phase 2 website sync/API/database work entered the diff.
- [x] Recheck the Chrome-extension migration boundary: portable contract/response/engine modules contain no Tampermonkey/Next/Prisma/website-auth dependencies, and issuer-session transport remains behind the client port.
- [x] Update `amex-research.md` only with redacted endpoint/schema/parser facts learned during validation; never record live URLs containing identifiers, bodies, headers, tokens, or payload values.
- [x] Update project specs only if implementation establishes a reusable project-wide convention. The browser-read spec now records both the authenticated-read boundary and the reusable presentation rule that observation quality must remain separate from benefit state; the duplicate installed-script observation remains task-local.
- [x] Run final `trellis-check`, targeted tests, type-check, userscript build, lint, full tests, and `git diff --check`. Full Jest, TypeScript, userscript build, and diff checks pass; repository lint was run and retains eight pre-existing unrelated errors.
- [x] Review the diff for secrets and authenticated account data before commit.

## Risk and rollback summary

| Risk | Prevention | Rollback |
|---|---|---|
| Accidental Amex mutation | Endpoint-specific read client; no generic requester/write constants; method/path deny tests; mutation-control spies | Cancel/disable userscript |
| Sensitive data retention | Scan-scoped raw objects, strict normalized schemas, store denylist, HMAC identity, synthetic fixtures | Cancel scan; clear both local keys |
| Private response change | Versioned endpoint/response adapter, strict envelopes, unknown/incomplete states | Reinstall previous parser bundle |
| Wrong card association | Token-derived HMAC identity, explicit ending field, relationship checks, ambiguity errors | Preserve prior stale record |
| Partial scan erases good data | Per-card merge and stale preservation | Previous per-card observations remain |
| Broken website/deployment | No website/API/Prisma code; isolated ignored bundle | Revert isolated modules/dependency |
| Storage incompatibility | Explicit schema version/migrations; refuse unknown schemas | Clear local data or restore prior bundle |
