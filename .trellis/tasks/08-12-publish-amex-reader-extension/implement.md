# Implementation Plan — public AMEX reader distribution

## 1. Shared runtime and branding

- [x] Extract distribution-neutral storage/window interfaces without changing
  reader contracts or persisted observation schema.
- [x] Create a flat owned icon master and deterministic icon/listing derivatives.
- [x] Polish launcher, panel, scan workspace, filters, states, responsive layout,
  light/dark styling, keyboard/focus behavior, and accessible labels.
- [x] Extend unit/generated E2E coverage for the visual/semantic contract.

## 2. Greasy Fork artifact

- [x] Advance the canonical production userscript to `1.0.0` with MIT,
  icon/homepage/support metadata and Greasy Fork-owned update behavior.
- [x] Preserve exact origins, transfer include, grants, noframes, no remote code,
  storage shape, upgrade behavior, and live-installed duplicate prevention.
- [x] Extend the artifact audit for exact public metadata, match/include/grant
  scope, and forbidden update/transport drift; generate an upload-ready `.user.js`
  and release hash.

## 3. Chrome Manifest V3 package

- [x] Add a reproducible extension build producing manifest, exact content
  scripts, shared core, popup HTML/CSS/JS, icons, license, and no source maps or
  private/generated leftovers.
- [x] Implement `chrome.storage.local` adapter and exact handoff bridge without
  tabs/activeTab/scripting/background/remote-code permissions.
- [x] Add manifest/package audit and synthetic E2E parity for AMEX scan, storage,
  handoff, forbidden origins, reload, cancellation, and duplicate mounting.
- [x] Load the unpacked package in Chrome and prove a clean install, one idle
  mount, zero autoscan, manual synthetic/live-read boundaries, popup links, and
  coexistence warning without exposing private data.

## 4. Store and privacy assets

- [x] Update the public privacy policy and repository privacy summary with exact
  browser-reader collection/use/storage/sharing/deletion behavior.
- [x] Write Chrome short/long description, single-purpose statement, permission
  justifications, data-use answers, support/homepage text, category, release
  notes, and non-affiliation/coexistence notices.
- [x] Write Greasy Fork title/description/additional info/release notes with MIT
  license, support, install/upgrade, coexistence, and privacy guidance.
- [x] Render synthetic-only 1280x800 screenshots and a 440x280 promo; audit sizes,
  legibility, brand ownership, and absence of real/private data.
- [x] Add the public Greasy Fork setup/onboarding path with a shared listing link,
  manual signed-in Amex scan instructions, exact-five matching guidance,
  privacy/support links, and the one-distribution coexistence warning.

## 5. Quality and release review

- [x] Run targeted Jest, TypeScript, ESLint, userscript/extension artifact audits,
  generated E2E for both channels, visual screenshot review, public-DB invariant,
  task parsing, sensitive scan, and `git diff --check`.
- [x] Run independent Trellis check and update durable browser-integration specs.
- [ ] Present final package hashes, exact permissions/grants, parity results,
  screenshots, listing copy, privacy answers, and known review risks to the user.
- [ ] Reinstall or update the exact public Greasy Fork `1.0.0` artifact, run the
  final bounded zero-write/read canary, and retain only sanitized aggregate
  evidence before production activation.
- [ ] For the remaining production release, verify the target/recovery gates,
  deploy preview, obtain fresh action-time confirmation, deploy write for one
  bounded canary, repeat preview to prove no repeated mutation, and return to
  exact `off`. Chrome Web Store review/publication is excluded.

## 6. Attended publication

- [x] Reverify Chrome Web Store and Greasy Fork publisher-account readiness.
- [x] Stop for user handling of login/MFA, developer agreement, registration fee,
  or identity/profile choices where required.
- [x] Obtain action-time approval, upload the Chrome ZIP, complete listing/privacy
  fields, choose Public, and submit for review; record sanitized review state.
- [x] Obtain separate action-time approval, create/update the Greasy Fork listing,
  upload exact audited userscript `1.0.0`, and publish; verify public install/update.
- [ ] If either channel cannot be submitted, finish with upload-ready artifacts
  and the exact external blocker; do not claim publication.

## Implementation evidence (2026-08-12)

- Shared browser storage/identity/result/mailbox ports now power both the existing Greasy Fork userscript adapter and the Chrome `chrome.storage.local` adapter. The shared handoff bridge owns the same validated mailbox/message/origin checks for both channels.
- `npm run build:amex-reader-extension` produced the MV3 package, Greasy Fork `1.0.0` userscript, owned icon PNGs, 440x280 promo, Playwright-captured synthetic 1280x800 screenshot from the shared `AmexBenefitReaderPanel`, runtime-only Chrome ZIP, and `release/hashes.json`.
- `npm run check:amex-reader-extension` passed exact declarative content-script matches with no `host_permissions`, storage-only permission, no service worker/remote code, Greasy metadata/license/support/homepage, approved origins, asset dimensions/non-icon duplication, runtime/store-asset ZIP separation, reproducible rebuild hashes, and package absence of source maps/private files.
- Targeted Jest passed 6 suites/35 tests including exact query-bearing handoff activation and Chrome storage; strict TypeScript passed; changed-source ESLint passed (the repository ignores build/check scripts by its configured script ignore, with no errors); `git diff --check` passed.
- Final review tightened the Greasy Fork audit and manifest/popup surface checks, aligned panel dark-mode contrast tokens, and made the userscript runtime require exactly one valid 32-hex `transfer` query parameter (matching the MV3 classifier); the generated 14-test AMEX suite remained green.
- The post-live receiver fix is captured as a durable browser-integration contract: receiver-sensitive native APIs use a neutral `globalThis` wrapper, with a regression that rejects a non-global default-fetch receiver. Independent final review passed 16 Jest suites/119 tests, strict TypeScript, changed-source lint, public-DB and artifact audits, 14 generated E2E scenarios, task parsing, sensitive scan, and diff checks. Its sole consistency finding was resolved by advancing the canonical standalone production userscript build and its E2E assertion from `0.5.3` to the same public `1.0.0` release; local development remains separately named/versioned.
- At the initial implementation boundary, no live Chrome install, provider/browser scan, store upload, Greasy Fork submission, publisher account, privacy form, deployment, database, or `.env` action had been performed. The later sanitized live Chrome evidence is recorded below; store publication, deployment, database, and `.env` actions remain unperformed.

## Live Chrome evidence (2026-08-12)

- The unpacked MV3 extension mounted exactly one idle open-shadow reader on the exact AMEX benefits route with version `1.0.0`; no scan, progress, status, or cancel control appeared before the manual action.
- The first live extension scan failed closed at member discovery with zero observations. A temporary, separately built sanitized diagnostic bundle exposed only closed stage/classification/count fields and identified a client-side `network` failure before any response. It retained no raw response, token, identifier, label, ending, URL, header, body, or storage export and was removed from the clean release build.
- Root cause: the client stored bare native `fetch` and later invoked it as an object method. Chrome's isolated content-script world rejected the wrong receiver as an illegal invocation; Tampermonkey's facade and the receiver-neutral synthetic harness had hidden the defect. The production client now stores a `globalThis.fetch(...)` wrapper, with a regression that requires the global receiver.
- The fixed authorized read-only scan discovered and attempted 8 primary cards: 5 complete, 3 partial, 0 failed, 26 normalized benefit rows, 5 row-bearing groups, and unchanged visible context. The partial results came from optional catalog enrichment HTTP errors; tracker-backed normalized observations remained available by contract. No Sync reviewed action, preview, confirmation, handoff, or write occurred.
- Reload restored the same 26 rows and 5 groups with zero automatic scan activity. A second manual scan again discovered/attempted 8 cards with 5 complete, 3 partial, 0 failed and exactly the same 26 rows/5 groups, proving no display duplication or duplicate mount.
- The clean release rebuild contains no temporary diagnostic marker. Final hashes are Chrome ZIP `e3f7bd1a17c062d7337e4d9ef2ef26a63accb38f490503fde0d923665b08a347` and Greasy Fork `aa0733b3f2f0844c0c80f2aba0405e5b6c763c9818fed5153041c338c6aa37d3`.

## Publication evidence (2026-08-14)

- Greasy Fork public script `591349`, **Perks Reminder — Amex Benefit Reader**, was published under the authenticated publisher account after separate action-time confirmation. Google profile synchronization was subsequently disabled while retaining Google login, and the public username was changed to **Perks Developer**. The script and profile pages expose the new public name and no former account name. The public page reports version `1.0.0`, MIT, the expected AMEX and Perks Reminder targets, support link, install control, and reviewed additional information.
- The public install artifact SHA-256 is `516d3be8ed7eacc84d2e410329bc0a75f78e004c4992d3b3b33a9149176d150f`. Its only difference from the audited local artifact is Greasy Fork's generated `@downloadURL` and `@updateURL`; removing those two lines produces byte-exact equality and the approved local SHA-256 `aa0733b3f2f0844c0c80f2aba0405e5b6c763c9818fed5153041c338c6aa37d3`.
- The exact audited Chrome ZIP was uploaded manually and remains a draft. The Store Listing now has the owned icon, synthetic screenshot, 24-bit RGB small promo, plain-text description, Tools category, English language, homepage/support links, and mature-content setting saved. The Privacy form has the narrow single-purpose and permission justifications, no-remote-code declaration, financial/website-content disclosures, three limited-use certifications, and public privacy URL saved. Distribution is free, Public, and all regions; credential-free reviewer steps cover manual scan, no autoscan, repeat-scan deduplication, optional handoff, and the fact that the extension never requests AMEX credentials. The dashboard enabled Submit for review after these saves.
- The initially rejected promo asset contained an alpha channel. The builder now flattens it to 24-bit RGB and the artifact audit enforces three channels/no alpha. Rebuild and audit passed; `file` reports `440 x 280, 8-bit/color RGB`, and the runtime-only Chrome ZIP retained SHA-256 `e3f7bd1a17c062d7337e4d9ef2ef26a63accb38f490503fde0d923665b08a347`.
- Chrome protects publisher-profile fields from browser scripting and stopped exposing the editable profile form through the attended UI surface. The authenticated publisher selector still visibly uses the prior publisher label; the user explicitly waived that rename.
- After action-time confirmation, **Submit for review** was invoked with automatic publication after approval left enabled. The dashboard accepted the final click without an error or additional agreement/CAPTCHA/payment prompt. A fresh authenticated status tab then verified `Status: Pending review` and `This draft is pending review.` The task remains open until Chrome review passes and the public listing is verified.

## Public onboarding and post-publication release evidence (2026-08-15)

- The public `/integrations/amex-sync/setup` page links to the exact Greasy Fork
  `1.0.0` listing and explains Tampermonkey installation, a signed-in manual
  Amex scan, exact five-digit destination matching, local/privacy boundaries,
  support, and the requirement to enable only one reader distribution. The
  authenticated transfer route remains separate and `noindex`.
- The remaining release sequence is intentionally gated after this onboarding:
  verify the exact public artifact, run an authenticated zero-write preview,
  obtain fresh action-time confirmation before any production write, run one
  bounded write canary, repeat the scan/preview for idempotency and no duplicate
  mutation, and restore exact `off`. Chrome Web Store review/publication remains
  outside this sequence.

## Independent final review (2026-08-12)

- Receiver-safe native-fetch regression and all affected reader/storage/panel/extension suites passed: 16 Jest suites, 119 tests.
- Strict TypeScript, changed-source ESLint, `npm run check:public-db`, task JSON/JSONL parsing, changed-surface sensitive scan, and `git diff --check` passed.
- The extension build/audit, both userscript builds/audit, and generated AMEX synthetic E2E passed (14 tests); release hashes were regenerated and matched the recorded values above.
- No publication, store upload, publisher-account action, deployment, database/provider operation, or `.env` access was performed.

## Post-publication release review (2026-08-15)

- Independent Trellis review passed the complete current worktree: 85 Jest
  suites with 772 tests passed and one skipped, strict TypeScript,
  changed-source ESLint, the public-DB invariant, userscript and extension
  builds/audits with reproduced hashes, all 14 generated AMEX E2E scenarios,
  task JSON/JSONL parsing, sensitive/untracked-path review, and
  `git diff --check`.
- Review added the new public setup route to the explicit anonymous
  public-surface database guard and removed one unused build-script import. No
  further findings remained.
- The authenticated Greasy Fork page visibly reports publisher **Perks
  Developer**, version `1.0.0`, MIT, the expected AMEX/Perks Reminder targets,
  support/privacy information, and the published update artifact. The browser
  currently offers **Update to 1.0.0**, so the exact public artifact has not yet
  been activated for the final canary.
- The signed-in AMEX overview tab currently contains zero reader hosts. This is
  a safe idle state with no duplicate mount, but it is not installed-artifact
  evidence. No scan, provider request, handoff, preview, configuration,
  deployment, database operation, confirmation, or `.env` action occurred in
  this review.
