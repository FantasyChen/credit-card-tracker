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

## 6. Automated quality checks

Run targeted checks first:

```bash
npm test -- --runInBand src/lib/amex-benefit-reader src/userscripts/amex-benefit-reader
npx tsc --noEmit --pretty false
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
- [ ] Confirm the panel loads existing local records and displays the local-only disclosure.
- [ ] Run one scan and verify:
  - attempted card count matches supported relationships returned by account discovery;
  - non-card products are excluded;
  - primary/supplementary cards and duplicate product names remain separate;
  - displayed trackable benefit states/amounts match the corresponding visible Amex UI where available;
  - unknown/optional fields are represented without guesses;
  - the original selected card and route remain unchanged.
- [ ] Confirm no enroll/link/activate/redeem/add-offer/payment control or write endpoint was invoked.
- [x] Observe only redacted request metadata and confirm userscript traffic is limited to the exact approved first-party account/tracker/catalog read destinations and methods. Do not capture or save live response bodies, headers, cookies, request bodies, or account tokens.
- [ ] Inspect Tampermonkey storage structurally and confirm only the two expected keys exist and no raw response, opaque token, header, request body, or forbidden sensitive field is stored; do not export the values.
- [ ] Confirm raw response objects disappear after completion/cancellation by runtime-owned diagnostics or lifecycle counters, not by exporting payload contents.
- [ ] Simulate a safe response/card failure using a synthetic fixture or controlled adapter test; confirm the successful cards update while the failed card retains prior data as stale.
- [ ] Test cancellation and verify already committed cards remain safe and the run is marked interrupted.
- [x] Use **Clear local data** and verify both result and identity-secret keys are removed. This was completed earlier in the task and was not repeated after the final `0.2.1` scan.
- [ ] Do not save or commit authenticated screenshots, live page exports, console dumps, or storage exports.
- [ ] Run the project `verify` skill for end-to-end observable behavior before any commit.

**Browser rollback:** cancel the scan, clear local data if desired, disable the userscript, and restore the previous bundle.

## 8. Final review and documentation

- [ ] Map test and browser evidence to AC1–AC11 in `prd.md`.
- [ ] Recheck that no Phase 2 website sync/API/database work entered the diff.
- [ ] Recheck the Chrome-extension migration boundary: portable contract/response/engine modules contain no Tampermonkey/Next/Prisma/website-auth dependencies, and issuer-session transport remains behind the client port.
- [x] Update `amex-research.md` only with redacted endpoint/schema/parser facts learned during validation; never record live URLs containing identifiers, bodies, headers, tokens, or payload values.
- [ ] Update project specs only if implementation establishes a reusable project-wide convention.
- [ ] Run final `trellis-check`, targeted tests, type-check, userscript build, lint, full tests, and `git diff --check`.
- [ ] Review the diff for secrets and authenticated account data before commit.

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
