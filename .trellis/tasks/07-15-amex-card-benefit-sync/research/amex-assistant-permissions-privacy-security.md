# Research: `olddonkey/amex-assistant` permissions, network, privacy, and security boundary

- **Query**: Identify the reference userscript/extension permissions and network behavior, and separate privacy/security patterns safe for Phase 1 from patterns forbidden by the stricter rendered-DOM-only, no-network requirements.
- **Scope**: mixed (public GitHub reference plus local Phase 1 requirements)
- **Date**: 2026-07-15
- **Decision update**: The original rendered-DOM/no-network boundary analyzed below was superseded later on 2026-07-15. The approved design now permits exact characterized first-party Amex **read** endpoints with browser-attached session credentials, keeps raw responses/tokens in scan-scoped memory only, persists normalized observations only, and still prohibits all mutation endpoints and third-party transmission. Historical “unsafe” labels below apply only to the earlier boundary.
- **Reference revision**: [`4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87`](https://github.com/olddonkey/amex-assistant/commit/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87)

## Findings

### Files Found

| File Path / URL | Description |
|---|---|
| [`src/amex-assistant.user.js`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js) | Metadata, authenticated first-party fetches, account tokens, offer mutation, keep-alive behavior, and local preferences. |
| [`PRIVACY.md`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/PRIVACY.md) | Public privacy claims and extension permission description. |
| [`DISCLAIMER.md`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/DISCLAIMER.md) | Undocumented-API and account-automation disclaimers. |
| [`docs/FINDINGS.md`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md) | Explicit private endpoint and cookie/session behavior. |
| [`build/build-extension.mjs`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/build/build-extension.mjs) | MV3 host match and execution-world generation. |
| `build/amex-benefit-reader.user.js:0-11` | Current Phase 1 artifact metadata: exact benefits-route match, `@noframes`, and only GM local-storage grants. |
| `.trellis/tasks/07-15-amex-card-benefit-sync/prd.md:94-107` | Phase 1 privacy, data minimization, permissions, and no-network requirements. |
| `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:9-20` | Exact metadata allowlist and explicitly omitted capabilities. |

### Permissions and network behavior in the reference

The reference userscript declares:

- `@match https://global.americanexpress.com/*`
- `@grant none`
- `@run-at document-idle`
- remote GitHub `@updateURL` and `@downloadURL`

See [`src/amex-assistant.user.js#L1-L15`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1-L15).

`@grant none` means it does not use privileged GM networking, but it does **not** mean no network access. The script directly calls browser `fetch` with `credentials: "include"`:

- Request wrapper, HTTP classification, and JSON parsing: [`src/amex-assistant.user.js#L814-L838`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L814-L838).
- Credentialed GET/POST helpers: [`#L840-L870`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L840-L870).
- The destinations include both `global.americanexpress.com` and the separate `functions.americanexpress.com` origin: [`#L73-L99`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L73-L99).
- The repository documentation states that private calls bypass the Amex UI and use the logged-in browser session: [`docs/FINDINGS.md#L11-L14`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L11-L14), [`#L20-L40`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L20-L40).

The source includes a write endpoint for Add-to-Card offer enrollment (`src/amex-assistant.user.js:84-85`, request code at lines 1022-1041). README explicitly describes selecting targets and submitting Add-to-Card requests: [`README.md#L131-L156`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/README.md#L131-L156).

The Chrome extension build requests no named extension APIs, but registers the content script for the whole Amex origin: [`build/build-extension.mjs#L60-L77`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/build/build-extension.mjs#L60-L77). It defaults to an isolated content-script world and supports an optional `MAIN` world build: [`#L12-L18`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/build/build-extension.mjs#L12-L18).

### Privacy patterns present in the reference

The reference states that it has no backend, telemetry, analytics, developer data collection, or third-party transmission: [`PRIVACY.md#L10-L36`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/PRIVACY.md#L10-L36). It also states that it does not read cookie contents; authenticated cookies are attached by the browser to its requests: [`README.md#L184-L195`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/README.md#L184-L195).

Account/offer/benefit runtime data appears to remain in memory rather than being persisted. The broad runtime state includes raw account tokens and issuer-derived card/benefit data (`src/amex-assistant.user.js:2454-2509`), while page-origin `localStorage` is used for preferences such as language and panel position (`src/amex-assistant.user.js:2525-2625`). No session storage or IndexedDB usage was found.

The project is public source and uses local fetch mocks for tests, avoiding a live login in the test suite: [`README.md#L197-L210`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/README.md#L197-L210), [`test/mock-fetch.mjs#L1-L5`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/mock-fetch.mjs#L1-L5).

### Safe-to-adapt techniques

The following patterns fit the Phase 1 direction when applied within the stricter contract:

1. **No backend, telemetry, analytics, or third-party endpoints.** This aligns with `prd.md:94-99`.
2. **Do not read cookie contents, credentials, or MFA values.** The reference relies on browser session attachment rather than reading cookies; Phase 1 goes further by making no userscript network calls.
3. **Local synthetic mocks instead of authenticated fixtures.** Phase 1 design requires invented DOM fixtures and forbids live DOM, screenshots, network captures, and storage exports (`design.md:335-362`).
4. **Shadow-DOM UI isolation and text-node rendering.** These limit style coupling and avoid rendering upstream markup as active HTML.
5. **Default isolated extension content-script world.** This is consistent with Phase 1's no-page-global-access boundary; the reference's optional main-world mode is not.
6. **Transparent public permission/privacy documentation.** The reference separately documents host access and local-only behavior; Phase 1's panel disclosure is the runtime counterpart.

### Out-of-scope or unsafe techniques that must not be copied

1. **Any direct private endpoint call, interception, or replay.** This includes read-only member, tracker, catalog, offers, and savings calls. Phase 1 may read only rendered DOM/accessibility content (`prd.md:51`, `prd.md:96-99`).
2. **`fetch(..., {credentials: "include"})` from the userscript.** Phase 1's userscript must perform no network request. Normal Amex traffic caused by ordinary selector/tab navigation remains Amex page behavior, not userscript transport (`implement.md:137`).
3. **Issuer mutations.** Add-to-Card requests, enroll controls, retries, verification reads, and write-result state are outside Phase 1 (`prd.md:52`, `prd.md:123-129`).
4. **Using `@grant none` as proof of no network.** Ordinary page-context `fetch`, images, beacons, sockets, and other browser mechanisms remain available. Phase 1's no-network property must come from source/runtime behavior plus tests, not metadata alone (`design.md:362`).
5. **Remote `@updateURL` / `@downloadURL`.** The current design explicitly omits both (`design.md:20`); a userscript manager may contact those URLs independently of the script body.
6. **Broad whole-origin match.** Phase 1 permits only the exact benefits route family and validates exact paths at runtime (`design.md:9-20`; current artifact `build/amex-benefit-reader.user.js:5-10`).
7. **Page-origin `localStorage` for scanner observations, fingerprints, or identity secrets.** It is visible to scripts in the Amex origin and lacks the task's validated envelope boundary. Phase 1 uses Tampermonkey-managed storage with only approved normalized records (`prd.md:73-83`, `design.md:288-307`).
8. **Raw account token in persistent or portable state, token-derived display digits, or raw issuer payload storage.** Phase 1 allows a raw opaque DOM token only transiently and persists a keyed local fingerprint instead (`prd.md:58-62`, `design.md:204-223`).
9. **Main-world extension execution.** Phase 1 omits page-global access; no `unsafeWindow` or equivalent should enter the artifact (`design.md:9-20`).
10. **Keep-alive behavior.** The reference defaults a keep-alive feature on, suppresses visibility/blur/pagehide/freeze-like events, invokes an observed page timeout manager, dispatches synthetic focus/mouse movement, and runs an interval: [`src/amex-assistant.user.js#L2790-L2859`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2790-L2859). Phase 1 must not alter issuer session/visibility behavior and explicitly prohibits intervals/background scanning.
11. **Opaque-token fallback identity displayed to the user.** The reference can derive labels/digits from the account token if issuer display fields are absent (`src/amex-assistant.user.js:1053-1067`, `1188-1196`). Phase 1 must fail safely unless four/five visible ending digits are present.
12. **Persisting account-specific preferences on the issuer origin by default.** Even non-observation preferences add keys to Amex's storage namespace; Phase 1's design scopes its own state to Tampermonkey storage.

### Comparison with current Phase 1 artifact

Current built metadata at `build/amex-benefit-reader.user.js:0-11` is narrower than the reference:

- Exact Amex benefits-route match rather than the whole origin.
- `@noframes`.
- Only `GM.getValue`, `GM.setValue`, and `GM.deleteValue` grants.
- No `@connect`, `GM_xmlhttpRequest`, `unsafeWindow`, `@updateURL`, or `@downloadURL` metadata.

Current storage code uses two Tampermonkey keys, validates the result envelope, stores an installation secret separately, fingerprints raw selector tokens, and clears both keys (`src/userscripts/amex-benefit-reader/tampermonkey-storage.ts:25-65`; `src/lib/amex-benefit-reader/storage-policy.ts:13-14`). This matches the task boundary more closely than the reference's page-origin preference storage.

## External References

- [Reference repository README privacy section](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/README.md#L184-L195) — stated no-backend/no-telemetry behavior and `@grant none` metadata.
- [Reference privacy policy](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/PRIVACY.md#L10-L42) — first-party network and local settings disclosure.
- [Reference private API documentation](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L1-L40) — confirms behavior that Phase 1 excludes.

## Related Specs

- `.trellis/tasks/07-15-amex-card-benefit-sync/prd.md:94-107` — strict privacy and grants.
- `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:9-20` — exact artifact metadata.
- `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:335-366` — synthetic fixtures, network-constructor guards, and owner-only validation.
- `.trellis/spec/perks-reminder/deployment-and-external-effects.md:3-8` — avoid unrelated deployment/external effects.

## Caveats / Not Found

- No evidence of telemetry or third-party application endpoints was found in the pinned reference source.
- “No third-party transmission” in the reference is weaker than “no network transmission”: the reference intentionally sends account tokens and request bodies to Amex private endpoints.
- The source search found no direct cookie read or authorization-header construction, but credentialed browser requests still use the authenticated session.
- Repository metadata and public policy describe current intent, not a formal browser sandbox guarantee.
