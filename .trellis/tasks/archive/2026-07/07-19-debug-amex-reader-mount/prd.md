# Make the Amex reader available across the member site

## Goal

Make the locally installed Amex Benefit Reader discoverable and manually usable across top-level pages under `https://global.americanexpress.com/`, instead of appearing only on two exact benefit routes, while preserving the existing read-only, local-only, manual-start, and sensitive-data boundaries.

## Background and Confirmed Evidence

- Userscript `0.2.3` matches only `https://global.americanexpress.com/card-benefits/*` (`scripts/build-amex-benefit-reader.mjs:9-20`).
- Its entry also returns unless `isSupportedAmexBenefitsRoute()` accepts the current page (`src/userscripts/amex-benefit-reader.user.ts:7-9`).
- That guard currently accepts only `/card-benefits/view-all` and `/card-benefits/activity` on the exact global Amex origin (`src/userscripts/amex-benefit-reader/visible-context.ts:3-8`).
- Sanitized live diagnosis on 2026-07-19 opened a fresh `/card-benefits/view-all` tab. Exactly one reader region mounted and restored normalized local state without the scan action being invoked. The bundle and installation therefore work; the original missing-panel symptom came from the narrow route contract or a stale tab, not a general `0.2.3` execution failure.
- `VisiblePageContext.selectedCardDisplayFingerprint` is already nullable (`src/lib/amex-benefit-reader/scan-engine.ts:16-24`), but the browser guard currently throws when a selected-card control is absent (`src/userscripts/amex-benefit-reader/visible-context.ts:31-38`).
- Prior sanitized validation observed an enabled legacy `0.1.0` copy. This task does not disable or delete installed scripts without separate action-time approval.

## Product Decisions

- The owner wants the reader to mount and allow an explicit scan from every top-level route on the exact `https://global.americanexpress.com/` origin.
- On non-benefits routes, the reader starts as a compact **PR** launcher to avoid covering account/payment controls. Activating it reveals the complete reader and manual scan action.
- On `/card-benefits/view-all` and `/card-benefits/activity`, the complete panel remains expanded by default.
- Collapse state is transient and is not added to Tampermonkey storage.

## Requirements

### R1 — Exact-origin site-wide mount

- Change metadata to match `https://global.americanexpress.com/*` while retaining `@noframes`, `document-idle`, and the existing three GM storage grants.
- Mount at most one reader host on every matching top-level document, including non-benefits paths and SPA-restored documents.
- Do not match HTTP, another Amex origin/subdomain, frames, or unrelated sites.
- Page load may restore validated normalized local state but must not discover accounts, call benefit endpoints, poll, or schedule a scan.

### R2 — Compact off-route presentation

- Start collapsed on routes other than `/card-benefits/view-all` and `/card-benefits/activity`.
- The collapsed control must have an accessible name, expose expanded state, remain above Amex content without covering a large area, and open the full existing panel on explicit activation.
- The expanded panel must provide an accessible collapse control. Collapse/expand state remains in panel memory only.
- Keep the panel expanded while scanning or cancelling so progress and cancellation remain visible.
- Continue to start expanded on the two benefit routes and in synthetic visual previews that use those routes.

### R3 — Manual scan from any matched route

- Permit **Scan all cards** after explicit expansion/action on any exact-origin route.
- Replace the benefits-route-only visible-context requirement with an exact-origin guard that always captures the current pathname and captures a one-way selected-card display fingerprint only when a recognized selector exists.
- A missing selected-card selector is valid and produces a null fingerprint; it must not block a manually requested scan.
- Final verification must require the same origin/pathname. When a fingerprint was captured, it must also remain present and equal; when none was captured, route invariance is sufficient.
- The reader must not click Amex navigation/account controls, assign `location`, or attempt restoration navigation.

### R4 — Preserve integration safety

- Keep account discovery and benefit reads behind the existing exact named endpoint/method/body allowlist, browser-attached session, timeout/retry, and cancellation contracts.
- Keep raw provider objects and account tokens scan-scoped; persist only normalized observations and HMAC-derived identity metadata.
- Do not add mutation endpoints, enrollment/linking/redemption behavior, privileged transport, remote update metadata, analytics, background polling, or website synchronization.
- Signed-out, HTML, auth, malformed, and request failures continue to fail safely and preserve prior observations as defined by the existing storage policy.

### R5 — Validation and privacy

- Add focused route-guard and panel tests for exact-origin acceptance, other-origin rejection, nullable selector capture, context change detection, collapsed accessibility, expansion, collapse, and scan-state behavior.
- Extend the generated-bundle Chromium harness with a representative non-benefits URL whose synthetic document omits the selected-card selector. Prove no autoscan, collapsed initial UI, explicit expansion, successful manual scan, route-only invariance, normalized persistence, and fail-closed networking.
- Keep all fixtures invented. Do not capture or retain credentials, cookies, headers, raw responses, opaque tokens, account/card/benefit values, storage exports, or authenticated screenshots.
- Bump the userscript patch version and require a new owner-confirmed Tampermonkey update before milestone live validation.

## Acceptance Criteria

- [x] AC1: The built userscript metadata matches every HTTPS path on exactly `global.americanexpress.com`, remains top-frame-only, and has no new grants or destinations.
- [x] AC2: Exactly one reader host mounts without autoscan on representative benefit and non-benefit routes; other origins remain unsupported.
- [x] AC3: A non-benefits route initially shows an accessible compact launcher, explicit expansion reveals restored local data and **Scan all cards**, and collapse state is not persisted.
- [x] AC4: A manual generated-bundle scan completes from a synthetic non-benefits route with no selected-card selector, while origin/path remain unchanged and no unexpected network escapes the harness.
- [x] AC5: When a selected-card display exists, a changed or missing display still fails visible-context invariance; when none exists at capture, unchanged origin/path is sufficient.
- [x] AC6: Scanning/cancelling remains expanded and reachable; loading, expanding, collapsing, or navigating does not automatically start or resume a scan.
- [x] AC7: Storage schema/keys, normalized contracts, endpoint tuples, no-mutation behavior, raw-data lifetime, and supported-credit filtering remain unchanged.
- [x] AC8: Targeted Jest, generated-bundle Chromium E2E, strict TypeScript, targeted ESLint, userscript build/audits, sensitive-data checks, and `git diff --check` pass.
- [x] AC9: After explicit owner installation, sanitized live validation confirms the panel is discoverable on a representative non-benefits Amex route and no scan starts before manual approval.

## Final Evidence

- Automated verification completed with 10 Amex reader Jest suites / 84 tests, the full 43-suite repository Jest run / 319 passing tests with one optional skip, five generated-bundle Playwright scenarios with one optional visual skip, strict TypeScript, targeted ESLint, userscript build/audits, sensitive-data checks, task validation, and `git diff --check` passing. Repository-wide lint retained only the eight known unrelated baseline errors.
- Independent review found and fixed an asynchronous duplicate-mount race; concurrent built-bundle injection now proves exactly one reader host.
- On 2026-07-21 the owner explicitly authorized an observable Tampermonkey update test. The canonical userscript advanced from `0.2.5` to `0.2.6`; Tampermonkey showed installed `0.2.5` before **Update** and installed `0.2.6` after it.
- A task-owned Playwriter page then opened `/account-overview` on the exact origin. A bounded DOM projection found exactly one open-shadow reader host, one collapsed launcher with `aria-expanded="false"`, and no active status or cancel control. Expansion exposed exactly one **Scan all cards** action without invoking it, and collapse restored the idle launcher.
- No live scan, provider mutation, authenticated screenshot, account-content query, storage export, credential/token/header/cookie inspection, or raw-response capture occurred.

## Out of Scope

- Matching another Amex origin/subdomain or non-HTTPS page.
- Automatic/background scans, route-triggered scans, or keep-alive behavior.
- Changing endpoint definitions, response schemas, storage schema, website sync, Prisma, or Next.js behavior.
- Capturing live API payloads, authenticated screenshots, or storage exports.
- Disabling/deleting the legacy installed script without separate authorization.
