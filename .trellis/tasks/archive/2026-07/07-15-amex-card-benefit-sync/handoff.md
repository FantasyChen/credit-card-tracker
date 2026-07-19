# Handoff — Amex Benefit Reader Phase 1

## Pause state

- Paused on 2026-07-15 at the user's request for continuation with Codex computer use.
- Git branch: `feat/amex-benefit-reader-phase-1`.
- Trellis task intentionally remains `in_progress`; Phase 1 implementation is built and validated, but the task is not archived because the next agent may continue browser validation or plan a later phase.
- No production build, database command, deployment, website synchronization, or Chrome extension packaging was performed.
- The temporary local userscript HTTP server on port 8765 was stopped. Existing browser tabs were not closed.

## Implemented surface

- Portable strict contracts, identity, storage policy, private read client, response adapter, and sequential scan engine live under `src/lib/amex-benefit-reader/`.
- Tampermonkey entry, panel, visible-context guard, and GM storage adapter live under `src/userscripts/`.
- `scripts/build-amex-benefit-reader.mjs` builds the ignored artifact `build/amex-benefit-reader.user.js`.
- The repository build metadata version is `0.2.3`; the last owner-installed and browser-validated version is `0.2.2`. Preserve namespace `https://perks-reminder.com/` or Tampermonkey will treat an update as a different script.
- The exact provider operations, privacy boundary, response shapes, and redacted runtime evidence are in `prd.md`, `design.md`, `implement.md`, `amex-research.md`, and `research/`.
- Reusable project guidance is in `.trellis/spec/perks-reminder/browser-read-integrations.md`.

## Validated state

- Owner-only live run after a real page reload discovered and attempted 16 distinct cards.
- It stored 16 normalized card records and 130 normalized trackable benefit observations.
- Seven records were current and nine conservatively incomplete; there were no error/no-data records.
- Repeated product names remained separate through token-derived HMAC identities.
- Three catalog reads returned HTTP 502 after one retry; valid tracker results were committed as partial instead of being erased.
- Visible route and selected-card context remained unchanged.
- After reload and reauthentication, the panel restored the same 16 records and 130 observations from Tampermonkey storage in manual idle state.
- Live clear-data behavior was validated earlier. Live cancellation was not repeated; cancellation is covered by automated tests.
- Browser evidence is aggregate and redacted. No response bodies, request bodies, headers, cookies, opaque account tokens, card names/endings, benefit titles/amounts, credentials, usernames, storage exports, or context hashes were written to the repository.

## Final checks

- Targeted Jest: 9 suites, 66 tests passed.
- Strict TypeScript passed.
- Targeted ESLint passed.
- Userscript build, source/artifact endpoint and mutation audits, sensitive-data scan, JSON/JSONL parsing, Trellis task validation, final-newline/trailing-whitespace checks, and `git diff --check` passed.
- Repository-wide lint still has eight pre-existing unrelated unused-variable errors outside the task diff.
- Tests still print the pre-existing Next.js `15.5.11` versus `@next/swc` `15.5.7` warning.
- The final check tightened JSON media-type validation to reject `application/jsonp`; this was rebuilt and regression-tested but was not rerun against the live account because valid Amex responses already use JSON.

## Security boundary to preserve

- Only the three task-documented first-party Amex read operations are approved.
- The browser may attach its current session via `credentials: "include"`; code must never read or collect passwords, MFA values, cookie content, authorization headers, CVVs, full card numbers, raw responses, or opaque account tokens.
- Raw responses and tokens are active-scan memory only. Only normalized observations and HMAC-derived identity metadata persist.
- Do not add enrollment, linking, activation, redemption, Add-to-Card, payment, account mutation, keep-alive, polling, background scan, analytics, third-party transport, remote update metadata, or generic privileged networking.
- Do not infer missing quantities, zero values, remaining amounts, currency, period/cadence, title amounts, ending digits, or cross-card totals.

## Recommended next actions for Codex computer use

1. Read task context in this order: `implement.jsonl`, `check.jsonl`, `prd.md`, `design.md`, `implement.md`, `amex-research.md`, then this handoff.
2. Inspect the full branch diff and run the task-scoped checks before changing behavior.
3. If additional authenticated browser validation is needed, keep it owner-only and read-only, use aggregate URL/method/status metadata only, and do not capture payloads or sensitive screenshots.
4. The remaining unchecked browser checklist items in `implement.md` are deliberately conservative. Do not mark them complete solely from automated evidence.
5. Treat website profile synchronization and Chrome extension packaging as future work requiring explicit planning and approval; neither is part of the current Phase 1 implementation.
6. The normalized Tampermonkey observations currently remain in the user's browser. Do not clear them unless the user explicitly asks.

## 2026-07-17 continuation result

- Codex Computer Use completed a second owner-authorized, read-only end-to-end scan from the logged-in Amex tab.
- The reader restored 16 records before scanning, attempted all 16 cards, retained 130 normalized observations, and restored the same timestamps after a real reload without auto-starting another scan.
- Five duplicate-product groups containing 14 physical cards remained separate. The scan stayed conservatively partial with six unknown-quantity, two benefit-identity-conflict, and three HTTP issue messages; the visible route/card context remained unchanged.
- Full Jest passed (42 suites, 300 passed, one skipped), strict TypeScript passed, and the isolated userscript build/diff checks passed. Repository lint retains the same eight unrelated baseline errors.
- Tampermonkey also contains an enabled legacy `0.1.0` copy. Only one panel mounted and current `0.2.1` behavior ran. The legacy copy was left unchanged pending explicit owner approval to disable or delete it.

## 2026-07-17 card-first UI revision

- `panel.ts` now uses a Perks Reminder-styled single-card workspace with a product/ending-digits switcher, benefit-state filters, human status labels, compatible-unit progress, and separate observation-quality labels.
- Synthetic visual QA covered the default panel, pressed filters, duplicate-product card switching, scrolled benefit/details content, and the privacy disclosure without using provider data.
- Panel coverage includes a 16-card / 130-observation scale test and explicit empty-filter and error/no-data states.
- Final verification: 42 suites passed with 304 tests passing and one skipped; strict TypeScript, targeted ESLint, userscript build, structured task/artifact audits, and diff checks passed. Repository lint still has the same eight unrelated baseline errors.
- The built artifact and intended installed script are now `0.2.2`. The owner completed Tampermonkey's protected update confirmation, and a signed-in reload restored exactly one card-first panel with 16 cards and 130 observations in manual idle state.
- The legacy `0.1.0` copy was not disabled, removed, or otherwise modified.

## 2026-07-19 generated-bundle Chromium harness

- Added a task-scoped `@playwright/test` harness that rebuilds and injects the actual ignored `build/amex-benefit-reader.user.js` IIFE into real Playwright Chromium. No source entry/runtime module is substituted for the bundle.
- Interception is installed before navigation to an invented document at the approved Amex benefits URL. The catch-all fulfills only that document, the exact synthetic member/tracker/catalog reads, and required CORS preflights for the two reviewed POST paths; all other requests abort without fallback. Chromium service workers are blocked.
- The harness uses invented account tokens, four/five-digit endings, upstream IDs, quantities, and synthetic title wrappers. Exact card and credit phrases come only from the repository's public static catalog because the fail-closed matcher must recognize them; no live account value is used. A Node-owned in-memory `GM` adapter makes normalized persistence inspectable without any production export/debug interface. A receiver-neutral bound-native-fetch facade models Tampermonkey's callable sandbox fetch while every request still passes through Playwright routing.
- `npm run test:e2e:amex` covers no autoscan, manual progress/completion, duplicate product labels across primary/supplementary cards, supported-credit filtering, card switching, normalized persistence, reload restoration without autoscan, visible-context invariance, confirmed deletion of both keys, and a deterministic catalog-`500` partial-data path.
- `npm run test:e2e:amex:visual` runs the synthetic flow in headed Chromium and writes an ignored screenshot under `test-results/amex-benefit-reader/`. Default E2E is unattended and exits; traces/screenshots are retained only on failure.
- After dependency installation, a machine without the Playwright-managed browser must run `npx playwright install chromium` once before the E2E commands. No system Chrome or real browser profile is required.
- Playwright downloaded only its Chromium browser family (Chrome for Testing plus the Chromium headless shell) into the user's standard Playwright cache. It did not open or use a real browser profile.
- This replaces Tampermonkey/live Amex for routine bundle-level regression iterations only. Milestone validation still requires the bounded owner-only live checks for current response schemas, authenticated cookie/CORS behavior, actual Tampermonkey grants/sandbox behavior, and issuer-side no-mutation evidence.

## 2026-07-19 cancellation and stale-rescan harness coverage

- The generated-bundle Chromium suite now contains four unattended scenarios. No production reader source, parser contract, storage schema, endpoint definition, or userscript version changed.
- A deterministic route gate holds the supplementary card's tracker read after the first physical card commits. The real panel **Cancel** control aborts that in-flight request, produces an interrupted final summary, retains the first card's normalized current observation, starts no later catalog work, persists no second-card snapshot, and leaves route/display context unchanged.
- A separate two-pass scenario first completes both cards, then updates the primary card while the supplementary card's required tracker read returns two synthetic HTTP `500` responses under the production one-retry policy. The primary observation and attempt timestamps advance; the supplementary card retains its original normalized observation and `observedAt`, gains a new `lastAttemptAt` plus `stale_error`/`http_error`, and the aggregate scan remains partial.
- Safe request records contain only operation, synthetic card role, and scan ordinal. The fail-closed no-fallback route, alternate-transport guards, one worker, zero Playwright retries, synthetic-only artifacts, exact tuple/body assertions, and raw-token storage assertions remain in force.
