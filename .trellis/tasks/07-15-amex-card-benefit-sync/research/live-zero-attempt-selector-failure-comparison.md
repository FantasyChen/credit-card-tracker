# Research: live zero-attempt selector failure compared with the reference

- **Query**: Compare the live evidence—9 supported cards discovered, no observations produced, and the panel returning to a prior/failed 0-attempt state, with suspected account-selector handling—against `olddonkey/amex-assistant`, `prd.md`, `design.md`, `implement.md`, and the current Phase 1 source.
- **Scope**: mixed (user-provided live evidence, local implementation, and public GitHub reference)
- **Date**: 2026-07-15
- **Decision update**: The rendered-DOM selector approach analyzed below was superseded later on 2026-07-15. The approved design now uses exact characterized first-party Amex read endpoints, making the selector lifecycle defect a migration reason rather than a required fix. Raw responses/tokens remain scan-scoped only, and all mutation endpoints remain prohibited.

## Findings

### Files Found

| File Path / URL | Description |
|---|---|
| `src/userscripts/amex-benefit-reader/amex-page-driver.ts` | Opens/enumerates the selector, clicks card options, waits for selected-token equality, navigates surfaces, and restores context. |
| `src/lib/amex-benefit-reader/scan-engine.ts` | Emits discovery progress, increments attempt count, scans/commits cards, and persists the final summary in `finally`. |
| `src/userscripts/amex-benefit-reader.user.ts` | Mounts once at document idle on an exact supported route and creates a new in-document engine. |
| `src/userscripts/amex-benefit-reader/panel.ts` | Shows in-memory progress events and initializes from the last persisted store after a new document load. |
| `src/lib/amex-benefit-reader/contract.ts` | Persists only a completed `lastScan` summary; there is no active/in-progress scan checkpoint. |
| `src/lib/amex-benefit-reader/__fixtures__/selector-live-structure.html` | Sanitized characterized selector: trigger has no card token; option IDs carry transient identity. |
| `src/userscripts/amex-benefit-reader/__tests__/amex-page-driver.test.ts` | Tests trigger/link allowlists, but not the lifecycle after clicking a real selector option. |
| `src/lib/amex-benefit-reader/__tests__/scan-engine.test.ts` | Uses a fake driver whose `selectCard` mutates an in-memory variable and never reloads/removes DOM. |
| [Reference `src/amex-assistant.user.js`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js) | Avoids selector and route navigation by calling private endpoints per account token. |
| `.trellis/tasks/07-15-amex-card-benefit-sync/prd.md` | Requires all-card attempts, explicit navigation failures, restoration, cancellation, bounded timeouts, and no private APIs. |
| `.trellis/tasks/07-15-amex-card-benefit-sync/design.md` | Anticipates full unload as a per-card failure/interruption and defines selected-card verification. |
| `.trellis/tasks/07-15-amex-card-benefit-sync/implement.md` | Calls for full-unload handling and owner validation of the complete read-only flow. |

### Evidence sequence in the current implementation

1. The engine captures context, discovers account options, and reports `discovered` with the card count (`scan-engine.ts:125-134`).
2. The panel renders `Found 9 supported cards` directly from that transient event (`panel.ts:89-107`). This event is not persisted by itself.
3. For the first loop item, `attemptedCardCount` increments before identity preparation and card selection (`scan-engine.ts:138-145`).
4. The driver opens the view-all surface, opens the account selector, finds the option by raw token, calls `option.click()`, and waits up to eight seconds for `getSelectedRawToken(document) === card.rawToken` (`scan-engine.ts:172-179`; `amex-page-driver.ts:155-184`).
5. The selected-token reader checks either a selected option inside the selector root or a characterized trigger carrying a token/current-account attribute (`amex-dom-adapter.ts:244-255`).
6. The sanitized live-structure fixture has the current token only on the selected option ID; its combobox trigger has no account token (`selector-live-structure.html:1-21`).
7. A card observation is not committed until both view-all and activity surfaces have settled, parsed, and passed selected-card verification (`scan-engine.ts:172-215`).
8. The final scan summary is persisted only after the main try/catch reaches `finally` (`scan-engine.ts:247-288`; `tampermonkey-storage.ts:37-40`).
9. On a new document, the entry script creates a new store/panel/engine and loads whatever `lastScan` had already been persisted (`amex-benefit-reader.user.ts:6-39`). The storage contract has `lastScan` but no active-run/discovery/checkpoint field (`contract.ts:175-193`).

### What the live symptom establishes

- Discovery itself reached a complete enough DOM state to classify 9 supported card options; the failure is downstream of the `discovered` report.
- No per-card observation reached `commitCard`, because the panel showed no new observations.
- A displayed prior/failed summary with `0` attempts is compatible with a new document loading an older `lastScan`, because discovery progress is only in memory and the new scan summary is written only at the end.
- The symptom does **not** by itself distinguish a full document navigation from every possible selector/verification failure. The current code supplies two concrete selector-stage mechanisms consistent with the evidence:
  1. **Document replacement during `option.click()`**: the old JavaScript context ends before card commit/final-summary persistence; the userscript remounts and reads the prior stored summary.
  2. **Selector option unmount after click**: if the closed selector is removed and the trigger does not expose the current raw token, `getSelectedRawToken()` becomes `null`; the wait eventually reports `selection_mismatch`. This path would normally persist a failed first-card attempt if the document stays alive, so by itself it is less consistent with seeing only the prior 0-attempt summary.

The first mechanism is therefore the tighter fit to the exact “discovered 9, then old 0-attempt status” sequence, while the second remains an account-selector verification hazard visible in source.

### Reload/SPA lifecycle gap relative to task documents

- The design explicitly says a full unload is a card failure/interruption case (`design.md:253`) and says restoration runs unless the document unloads (`design.md:109-114`).
- The implementation plan says to treat a full unload as interruption without persisting transient tokens (`implement.md:64-80`).
- Current driver/engine code has no `pagehide`, `beforeunload`, navigation-entry, or cross-document resume/checkpoint mechanism. `waitUntil()` only polls the current document (`amex-page-driver.ts:44-55`).
- Current entry code runs once per supported document and has no startup logic that recognizes a scan interrupted by the preceding document (`amex-benefit-reader.user.ts:6-39`).
- Current persisted schema represents only finished summaries (`contract.ts:175-193`).

This describes why a selector-caused full navigation can erase the in-memory run while leaving the prior summary intact.

### Test coverage shape relevant to the symptom

- Page-driver tests validate exact route allowlisting, the characterized combobox trigger, and safe benefits links (`amex-page-driver.test.ts:7-71`). They do not click a card option, close/unmount a listbox, observe a selected-token transfer, or simulate page replacement.
- Scan-engine tests use a fake driver where `selectCard()` only assigns an in-memory variable (`scan-engine.test.ts:49-73`). The “attempts every card” assertion therefore demonstrates engine ordering but not browser selector lifecycle (`scan-engine.test.ts:94-110`).
- The current source has no test fixture in which the combobox closes and its selected option disappears after click.

### Comparison with `olddonkey/amex-assistant`

The reference does not exercise this failure surface:

- It discovers accounts with a private member API and flattens them: [`src/amex-assistant.user.js#L919-L967`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L919-L967).
- It reads each card by putting the account token into private request bodies, with capped concurrent workers: [`#L1131-L1203`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1131-L1203).
- It reads benefit trackers/catalog by token: [`#L1253-L1267`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1253-L1267), [`#L1367-L1382`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1367-L1382).
- No account-selector click, selected-card DOM verification, benefits-route navigation, or restoration exists.
- No active-scan state is persisted across a reload. Only UI preferences survive reload; data/run state is in memory: [`#L2454-L2509`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2454-L2509), [`#L2525-L2625`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2525-L2625).

Accordingly, the reference explains why API-driven tools avoid selector/reload failures, but that avoidance is prohibited by Phase 1 and cannot be copied.

### Safe-to-adapt techniques for this failure class

These techniques exist conceptually in the reference and remain compatible with Phase 1, but they do not supply selector mechanics:

- **Enumerate before per-card work and display the real total**: reference snapshot progress is based on the fetched total and emits one completion per card ([`src/amex-assistant.user.js#L1145-L1203`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1145-L1203)). Current Phase 1 already reports discovery before scanning.
- **Per-card failure isolation**: the reference preserves failed cards in the result instead of silently dropping them ([`test/network.test.mjs#L160-L180`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/network.test.mjs#L160-L180)). Current Phase 1 storage policy is stricter because prior observations become stale rather than disappearing.
- **Manual data loading, not load-time scanning**: the reference mounts a launcher without reading accounts until user action ([`src/amex-assistant.user.js#L7101-L7115`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L7101-L7115)).
- **Keep transient run state separate from persisted preferences/results**: the reference separates in-memory run data from the few persisted preference keys. Phase 1 additionally requires explicit finished/interrupted observations and must never persist raw selector tokens.

### Out-of-scope or unsafe techniques for this failure class

- Replacing account-selector traversal with the reference's member/private benefit APIs.
- Capturing or replaying an account-token-bearing request to avoid UI navigation.
- Persisting the raw selector/account token as a cross-document continuation key.
- Deriving visible ending digits from the opaque token if the selector no longer exposes them.
- Suppressing `pagehide`/visibility/freeze events or enabling the reference keep-alive loop to keep a scan alive; the reference does this at [`src/amex-assistant.user.js#L2790-L2859`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2790-L2859), but Phase 1 must not interfere with issuer lifecycle/session behavior.
- Automatically restarting a scan on load or route change; PRD R1 requires every scan to remain user-initiated (`prd.md:46-54`).

### Requirement comparison

| Requirement | Current/reference observation |
|---|---|
| Every supported card attempted (`prd.md:49-50`, AC2) | Live discovery found 9, but no observations were committed; reference avoids DOM attempts entirely. |
| Normal selector navigation only (`prd.md:51`) | Current driver uses `option.click()`; reference uses private tokenized requests and is out of scope. |
| Explicit selection mismatch/unload outcomes (`prd.md:105`, AC5) | Current same-document mismatch is coded; cross-document interruption is described in plans but has no persisted active-run representation. |
| Restore original card/route (`prd.md:53`) | Current restoration is in `finally`, which cannot execute after old-document destruction; reference never changes the visible card/route. |
| Failed cards preserve prior data (`prd.md:78-80`) | Works after a caught same-document failure; no per-card failure commit is possible if the document ends before catch/commit. |
| No autoscan on load/route (`prd.md:49`) | Current entry does not autoscan; any cross-document mechanism remains constrained by this requirement. |
| No raw token persistence (`prd.md:60`, R6) | Current store persists only a fingerprint; reference keeps raw account tokens in memory and uses them in private requests. |

## External References

- [Reference account discovery and flattening](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L919-L967) — demonstrates API-driven discovery, not a selector solution.
- [Reference snapshot worker](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1131-L1203) — real-total progress and per-card isolation.
- [Reference reload persistence](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2525-L2625) — only language/position preferences survive reload.

## Related Specs

- `.trellis/tasks/07-15-amex-card-benefit-sync/prd.md:46-62` — user-initiated traversal and safe identity.
- `.trellis/tasks/07-15-amex-card-benefit-sync/prd.md:73-83` — failed-card/stale persistence and one active tab.
- `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:229-266` — selector discovery, per-card flow, full-unload failure, and restoration.
- `.trellis/tasks/07-15-amex-card-benefit-sync/implement.md:64-83` — traversal state machine and explicit full-unload handling.

## Caveats / Not Found

- The “9 cards, then prior/failed 0 attempts” evidence is supplied in the research request; no authenticated screenshot, DOM export, console dump, token, or storage export was collected or persisted.
- No browser network capture was used. It remains unverified from stored evidence whether the first option click caused a full document navigation, SPA subtree replacement, or another issuer behavior.
- The source-based full-navigation explanation is the closest match to the old-summary symptom, not a direct live trace.
- The public reference provides no rendered-selector implementation that can be safely transplanted under Phase 1 constraints.
