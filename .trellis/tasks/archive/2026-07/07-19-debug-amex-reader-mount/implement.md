# Implementation Plan — Site-wide Amex reader mount

## Preconditions and review gate

- [x] User reviews and approves `prd.md`, `design.md`, and this plan.
- [x] Run `task.py start` only after that approval; task-creation/planning consent is not implementation consent.
- [x] Load `trellis-before-dev` before product edits and follow the curated JSONL context.
- [x] Preserve the existing exact read-operation allowlist, manual-start behavior, local storage contract, and sensitive-data restrictions.
- [x] Do not run a live scan, modify the legacy userscript, or capture authenticated page/account data.

## 1. Separate mount, presentation, and scan-context route rules

- [x] In `visible-context.ts`, define one exact member-origin predicate and one two-path primary-benefits predicate; remove the implication that only benefits paths are scan-capable.
- [x] Keep the exact origin/path constants in one module and reuse the predicates from the entry and tests.
- [x] Change `capture()` to accept any exact-origin pathname and return `selectedCardDisplayFingerprint: null` when no recognized selector exists.
- [x] Change `verifyUnchanged()` to require exact origin and pathname equality, plus fingerprint equality only when capture produced a fingerprint.
- [x] Preserve the existing one-way fingerprint algorithm and avoid storing/displaying its source text.
- [x] Update `visible-context.test.ts` for:
  - both primary benefit routes;
  - representative arbitrary exact-origin paths and root;
  - HTTP, sibling-subdomain, and unrelated-origin rejection;
  - selector-present capture/equality;
  - selector changed/disappeared failure;
  - selector-absent null capture and route-only success;
  - pathname/origin change failure.

**Gate:** focused visible-context tests pass without changing the scan-engine interface.

## 2. Add transient collapsed launcher behavior

- [x] Replace the panel's positional reload boolean with a `PanelOptions` object containing `initiallyCollapsed` and `requiresReloadAfterClear`; update all tests/call sites.
- [x] Add transient `collapsed` state initialized from options and never persisted.
- [x] Render a compact semantic `PR` launcher in collapsed idle state with an accessible name and `aria-expanded="false"`.
- [x] Expand only on explicit launcher activation; expansion alone must not call `startScan`.
- [x] Add an accessible collapse control to the full panel and preserve visible focus behavior.
- [x] Prevent/undo collapse while scanning or cancelling so progress and Cancel remain visible.
- [x] Let error/recovery mounting honor the same initial collapsed presentation.
- [x] Extend `panel.test.ts` to prove:
  - collapsed construction renders one accessible launcher and no full workspace;
  - no autoscan on construction or expansion;
  - launcher expansion reveals restored data and **Scan all cards**;
  - expanded collapse control returns to launcher state;
  - expanded-by-default construction retains current behavior;
  - scanning started after expansion remains expanded and cancellable;
  - collapse state creates no GM/store action.

**Gate:** panel tests pass at current 16-card/130-observation scale and existing clear-data/cancellation tests remain valid.

## 3. Broaden entry and userscript metadata

- [x] Update the entry guard to mount on the exact supported origin and continue preventing duplicate host IDs.
- [x] Derive `initiallyCollapsed` from the primary-benefits predicate at mount time and pass it to normal and error panel construction.
- [x] Keep engine construction, reporter wiring, before-unload cancellation, and all action callbacks unchanged.
- [x] Change metadata to `@match https://global.americanexpress.com/*`.
- [x] Bump only the userscript patch version from `0.2.3` to `0.2.6`; preserve name, namespace, run-at, noframes, and existing GM grants.
- [x] Search for stale benefits-only mount assumptions in source/tests/docs before proceeding.

**Gate:** isolated userscript build succeeds and metadata contains one exact-origin wildcard with no new grants, connects, remote update URLs, or destinations.

## 4. Extend the generated-bundle harness

- [x] Add one harness-owned synthetic non-benefits URL under the exact Amex origin.
- [x] Fulfill only that exact invented document in the pre-navigation catch-all router; keep every other destination aborted with no `continue`/`fallback` path.
- [x] Render the non-benefits document without any selected-card selector candidate.
- [x] Generalize bundle injection/navigation only enough to select between the existing benefits URL and the new harness-owned URL; do not expose arbitrary navigation.
- [x] Add a Playwright scenario that:
  - observes one collapsed host after actual IIFE injection;
  - asserts the launcher's accessible name and collapsed state;
  - asserts zero named reads before and after expansion;
  - expands, explicitly clicks **Scan all cards**, and waits for completion;
  - verifies normalized persistence excludes raw tokens/upstream identifiers;
  - verifies the exact pathname is unchanged without a selector fingerprint;
  - runs the denied-origin/network/runtime final assertions.
- [x] Preserve existing complete, catalog-failure, cancellation, stale-rescan, reload, clear-data, and optional visual scenarios on the benefits route.

**Gate:** `npm run test:e2e:amex` executes the rebuilt artifact with all scenarios passing and no unexpected network/runtime event.

## 5. Automated validation

Run targeted checks first:

```bash
npm test -- --runInBand \
  src/userscripts/amex-benefit-reader/__tests__/visible-context.test.ts \
  src/userscripts/amex-benefit-reader/__tests__/panel.test.ts

npm test -- --runInBand src/lib/amex-benefit-reader src/userscripts/amex-benefit-reader
npm run test:e2e:amex
npx tsc --noEmit --pretty false --incremental false
npx eslint \
  scripts/build-amex-benefit-reader.mjs \
  src/userscripts/amex-benefit-reader.user.ts \
  src/userscripts/amex-benefit-reader/visible-context.ts \
  src/userscripts/amex-benefit-reader/panel.ts \
  src/userscripts/amex-benefit-reader/__tests__/visible-context.test.ts \
  src/userscripts/amex-benefit-reader/__tests__/panel.test.ts \
  playwright.amex.config.ts \
  tests/e2e/amex-benefit-reader
npm run build:amex-userscript
git diff --check
```

- [x] Inspect generated metadata and source/artifact strings for exact match/grants, approved read destinations, no mutation fragments, no privileged transports, and no remote update or website-sync destination.
- [x] Confirm no new endpoint constant, response field, storage key/schema, parser version, or supported-credit rule entered the diff.
- [x] Confirm all fixtures and generated reports remain invented/ignored and no live browser/session/account material was added.
- [x] Parse task JSONL and inspect the full diff/all untracked paths.
- [x] Run `npm run lint` and report the known unrelated baseline failures truthfully if they remain; do not edit unrelated source to force a pass.
- [x] Do not run `npm run build`, Prisma/database commands, provider calls, deployment, cron, or email commands.

## 6. Independent quality check and spec update

- [x] Dispatch `trellis-check` with the active task and curated `check.jsonl` context.
- [x] Resolve every verified in-scope finding, rerun affected checks, then rerun the full task-scoped validation set.
- [x] Update `.trellis/spec/perks-reminder/browser-read-integrations.md` with the reusable contract established by the implementation:
  - exact-origin mount eligibility is separate from manual scan eligibility and primary-route presentation;
  - absent selected-card UI permits route-only capture/verification;
  - off-primary-route UI starts as an accessible collapsed launcher;
  - generated-bundle coverage must include a selector-free non-primary route.
- [x] Recheck documentation against the final code rather than copying this plan verbatim.

## 7. Owner-only installation and bounded live validation

Only after automated checks pass and the owner explicitly approves the outward-facing update:

- [x] Serve the rebuilt `0.2.6` artifact from the existing local build server flow.
- [x] Open the userscript update page and require owner action-time approval for the exact version before manual or native protected confirmation.
- [x] Navigate to one representative non-benefits page on the exact global Amex origin.
- [x] Use a narrow sanitized DOM evaluation only to confirm:
  - exactly one reader host;
  - an accessible collapsed launcher;
  - no active scan/progress state before manual action.
- [x] Do not take an authenticated screenshot, broad accessibility snapshot, network payload capture, storage export, or account-content query.
- [x] Do not start a live scan unless the owner gives separate explicit action-time authorization.
- [x] Leave the legacy installed script and current normalized storage untouched unless separately instructed.

## Final acceptance review

- [x] Map automated and bounded live evidence to AC1–AC9 in `prd.md`.
- [x] Confirm the final diff contains only task-owned source, tests, Trellis artifacts, and the reusable spec update; ignored build/test output is not staged.
- [x] Confirm rollback requires no storage migration: reverting to `0.2.3` only narrows injection again and existing normalized data remains compatible.
- [x] Commit only after the Trellis Phase 3 commit gate and explicit workflow authorization; do not push.
