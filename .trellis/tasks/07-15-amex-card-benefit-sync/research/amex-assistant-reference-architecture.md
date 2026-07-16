# Research: `olddonkey/amex-assistant` reference architecture

- **Query**: Inspect the public `olddonkey/amex-assistant` repository for card discovery, card/account switching, reload/SPA handling, benefit/status extraction, state persistence, and userscript/extension structure, then compare it with Phase 1.
- **Scope**: mixed (public GitHub reference plus local task design and implementation)
- **Date**: 2026-07-15
- **Decision update**: The original rendered-DOM/no-network boundary analyzed below was superseded later on 2026-07-15. The approved design now permits exact characterized first-party Amex **read** endpoints, keeps raw responses/tokens in scan-scoped memory only, persists normalized observations only, and still prohibits all mutation endpoints and third-party transmission. Treat older “out-of-scope” labels below as historical comparison, not current requirements.
- **Reference revision**: [`4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87`](https://github.com/olddonkey/amex-assistant/commit/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87) (repository HEAD observed 2026-07-15)

## Findings

### Files Found

| File Path / URL | Description |
|---|---|
| [`src/amex-assistant.user.js`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js) | The 7,202-line single-source userscript containing API access, state, benefit logic, mutations, and Shadow-DOM UI. |
| [`build/build-extension.mjs`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/build/build-extension.mjs) | Generates a Manifest V3 extension from the userscript body. |
| [`test/network.test.mjs`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/network.test.mjs) | Tests API account enumeration, capped concurrency, retries, progress, and per-card failures. |
| [`test/benefits.test.mjs`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/benefits.test.mjs) | Tests benefit tracker/catalog normalization and cross-card aggregation. |
| [`README.md`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/README.md) | Product behavior, installation, privacy claims, and development structure. |
| [`docs/FINDINGS.md`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md) | Documents the private Amex endpoints and request shapes the implementation replays. |
| `src/userscripts/amex-benefit-reader/amex-page-driver.ts` | Current rendered-DOM account-selection and benefits-surface driver. |
| `src/lib/amex-benefit-reader/scan-engine.ts` | Current per-card traversal, commit, restoration, and summary state machine. |
| `.trellis/tasks/07-15-amex-card-benefit-sync/prd.md` | Phase 1 requirements and strict privacy boundary. |
| `.trellis/tasks/07-15-amex-card-benefit-sync/design.md` | Phase 1 module, traversal, storage, identity, and extension-migration design. |
| `.trellis/tasks/07-15-amex-card-benefit-sync/implement.md` | Phase 1 execution plan, including full-unload handling and owner-only validation. |

### Card discovery

The reference does **not** discover cards from the rendered account selector. It calls a private member endpoint, reads an account-token field, and flattens top-level and supplementary entries:

- Endpoint constants: [`src/amex-assistant.user.js#L73-L99`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L73-L99).
- Account request and supplementary flattening: [`#L919-L967`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L919-L967).
- Display digits are taken from several private response fields; if unavailable, display labels can fall back to the last characters of the opaque account token: [`#L1053-L1119`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1053-L1119).
- `snapshot()` enumerates those API-returned accounts and runs capped workers with a real total/progress count: [`#L1131-L1203`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1131-L1203). The corresponding progress test expects `0/N` through `N/N`: [`test/network.test.mjs#L194-L210`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/network.test.mjs#L194-L210).

This differs fundamentally from Phase 1 R1/R2/R6: Phase 1 must discover positively characterized options from rendered DOM, may use an opaque DOM identifier only transiently, and cannot read or replay a private member payload (`prd.md:46-62`, `prd.md:94-99`). The reference's account discovery is therefore not an implementation pattern for the Phase 1 adapter.

### Card/account switching

The reference performs no visible account-selector switch. Every card-specific read is parameterized directly with the account token in the private request body:

- Offer snapshot loops tokens rather than selecting accounts: [`src/amex-assistant.user.js#L1163-L1203`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1163-L1203).
- Benefit trackers and catalog are fetched by token: [`#L1253-L1267`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1253-L1267), [`#L1367-L1382`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1367-L1382).
- The repository itself says multi-card operation is token iteration that bypasses the page UI: [`docs/FINDINGS.md#L11-L14`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L11-L14).

Consequently, this repository contains no safe rendered-DOM technique for selecting an account, verifying the selected option after the listbox closes, or restoring the original selected account.

### Reload and SPA navigation

No `MutationObserver`, History API wrapping, `popstate`, `hashchange`, or route-specific remount logic exists in the reference source. The script matches the whole Amex origin, installs one launcher at document idle, and does not navigate the Amex SPA to scan cards:

- Global match and document-idle metadata: [`src/amex-assistant.user.js#L1-L15`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1-L15).
- Launcher/panel mounting and startup: [`#L7047-L7202`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L7047-L7202).

A full reload simply creates a new userscript state. The reference does not persist or resume an active scan, card snapshot, benefit observations, or scan summary across reloads. It only persists UI preferences (described below). Its avoidance of card/route navigation is why it does not solve the current selector-triggered lifecycle problem.

### Benefit and status reading

The reference benefits implementation reads two private JSON surfaces, not rendered benefit cards:

1. Tracker endpoint returns per-card tracker records: [`src/amex-assistant.user.js#L1253-L1267`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1253-L1267).
2. Catalog endpoint supplies titles and not-enrolled entries: [`#L1367-L1382`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1367-L1382).
3. `fetchAllBenefits()` reads only `BASIC` relationship cards, joins catalog titles by issuer benefit ID, and adds enrollable `NOTENROLLED` catalog entries: [`#L1440-L1514`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1440-L1514).
4. It excludes spend-goal and pass-based trackers from tracked benefits: [`#L1352-L1365`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1352-L1365).
5. Numeric normalization uses `parseFloat`, defaults absent/invalid values to zero, and derives a missing remainder as `target - spent`: [`#L1308-L1338`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1308-L1338).
6. Not-enrolled entries infer a monetary target from title text and force a yearly period: [`#L1399-L1437`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1399-L1437).
7. Cross-card rows are grouped by normalized display name, then amounts are summed and remainder is re-derived: [`#L1567-L1615`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1567-L1615).

These semantics conflict with Phase 1 R3: Phase 1 includes spend-progress and non-monetary counters, preserves decimal strings, distinguishes `not_exposed`/`unrecognized`, does not manufacture remainder or period, retains per-physical-card observations, and treats ambiguous benefit identity as incomplete (`prd.md:64-71`).

### State and persistence

The reference keeps account tokens, cards, offers, benefits, run progress, and timestamps in one in-memory `state` object: [`src/amex-assistant.user.js#L2454-L2509`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2454-L2509). Its benefits tab is lazy-loaded and cached only for the current document: [`#L4283-L4367`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L4283-L4367).

Persisted values are page-origin `localStorage` preferences:

- Language: [`#L2525-L2569`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2525-L2569).
- Launcher/panel positions: [`#L2592-L2625`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2592-L2625).
- Density and keep-alive preferences are also stored under page-origin keys (source hits at lines 2652-2698 and 2772-2858).

It does not implement Phase 1's validated storage envelope, per-card latest observation, stale preservation, redacted error shell, identity-secret clearing, or mixed observation times (`prd.md:73-83`; `design.md:268-307`).

### Userscript and extension structure

- The userscript is a single IIFE and doubles as the installable artifact; under Node it exports testable functions: [`src/amex-assistant.user.js#L17-L28`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L17-L28).
- The panel and launcher each use an open Shadow DOM and fixed host: [`#L7047-L7062`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L7047-L7062), [`#L7136-L7194`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L7136-L7194).
- The extension builder strips the userscript header and emits the same body as an MV3 content script, defaulting to an isolated world; it has an optional `MAIN`-world escape hatch: [`build/build-extension.mjs#L1-L18`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/build/build-extension.mjs#L1-L18), [`#L50-L85`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/build/build-extension.mjs#L50-L85).

Phase 1's modular contract/adapter/engine/storage/UI boundary is materially different and more reusable (`design.md:22-128`). The reference's single-source packaging idea is separable from its monolithic code shape.

### Safe-to-adapt techniques

These are technique-level patterns only; they do not require copying private endpoint behavior:

- **Manual activation before account reads**: the launcher is installed at load, but account reads begin only when the panel is opened (and after first-run language choice): [`src/amex-assistant.user.js#L7101-L7115`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L7101-L7115). Phase 1 is stricter and already binds scanning to **Scan all cards**.
- **Shadow-DOM isolation**: fixed host plus independent styles, without modifying Amex benefit tiles: [`#L7047-L7062`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L7047-L7062).
- **Honest real-total progress**: enumerate first, then emit `0/N` and one completion step per card: [`#L1145-L1203`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1145-L1203).
- **Per-card failure isolation**: a non-blocking read failure marks that card failed while retaining the card in the result; test coverage is at [`test/network.test.mjs#L160-L180`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/network.test.mjs#L160-L180). Phase 1 already expresses the stronger persisted stale/error policy.
- **One portable UI source for userscript and extension packaging**: extension generation from the userscript artifact is a useful release pattern, while Phase 1 should retain its separate portable core modules and adapters.
- **Text-only rendering**: the reference builds nodes and uses text content rather than injecting issuer HTML into the panel; its API-title decoder explicitly notes that display still uses `textContent`: [`src/amex-assistant.user.js#L1384-L1396`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1384-L1396).

### Out-of-scope or unsafe techniques for Phase 1

- Private member/benefit endpoint calls and replay with browser session credentials.
- Raw opaque account tokens retained in broad runtime state and passed into every request.
- Display fallback derived from an opaque token when visible ending digits are absent.
- Filtering benefits to primary/`BASIC` cards only.
- Omitting spend-goal/pass/count trackers that Phase 1 must represent.
- `parseFloat`, zero-defaulting, inferred remainder, inferred annual period, and cross-card amount summation.
- Page-origin `localStorage` for Phase 1 observations or identity data.
- A monolithic userscript that mixes issuer transport, mutations, normalization, state, and UI.
- Optional extension execution in the page `MAIN` world; Phase 1 explicitly avoids page-global access.
- Any account/offer mutation behavior; the reference includes Add-to-Card controls and write requests, while Phase 1 prohibits issuer mutation controls.

## Related Specs

- `.trellis/tasks/07-15-amex-card-benefit-sync/prd.md:46-107` — rendered-DOM-only scanning, local identity, normalization, persistence, privacy, and minimal grants.
- `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:76-128` — adapter/engine/storage/UI module responsibilities.
- `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:229-266` — required rendered-selector traversal and restoration.
- `.trellis/spec/perks-reminder/database-and-data-safety.md:1-19` — no database work is part of this research or Phase 1 runtime.

## Caveats / Not Found

- The reference repository contains no rendered account-selector traversal, selection verification, or restoration implementation.
- It contains no active-scan checkpoint/resume protocol for full reloads.
- It contains no persisted normalized benefit-observation contract comparable to Phase 1.
- Source facts are pinned to the observed HEAD commit; future repository revisions may differ.
