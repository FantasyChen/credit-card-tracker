# Design — Site-wide Amex reader mount

## Scope and invariants

This change broadens where the existing local reader is discoverable; it does not broaden what the reader can request or persist. The generated userscript remains top-frame-only, manually started, exact-origin, read-only, local-only, and limited to the existing named member/tracker/catalog operations.

The implementation separates three concerns that are currently conflated:

1. **Mount eligibility** — any top-level document on exactly `https://global.americanexpress.com`.
2. **Initial presentation** — expanded on the two primary benefit paths, collapsed elsewhere.
3. **Scan context safety** — exact origin and pathname must remain stable; a selected-card display fingerprint is an additional invariant only when one exists at capture time.

No route observer, Amex navigation automation, polling, or automatic scan is added.

## Component changes

| Component | Responsibility after this change |
| --- | --- |
| `scripts/build-amex-benefit-reader.mjs` | Emit version `0.2.6` and `@match https://global.americanexpress.com/*`; retain current grants, `document-idle`, and `@noframes`. |
| `visible-context.ts` | Own the exact member-site origin helper, the two-path benefits presentation helper, nullable display-fingerprint capture, and final context verification. |
| `amex-benefit-reader.user.ts` | Mount once on the exact origin, derive initial collapse from the current path, wire existing ports, and retain unload cancellation. |
| `panel.ts` | Own transient collapse/expand state and accessible launcher/toggle behavior without changing normalized storage or scan actions. |
| Unit tests | Prove route predicates, optional fingerprints, panel accessibility, no autoscan, and busy-state expansion. |
| Playwright harness/spec | Execute the rebuilt bundle on an invented non-benefits document without a selected-card selector and prove manual scanning remains safe. |

## Route and visible-context contracts

### Predicates

Keep the exact origin and primary paths as single-source constants in `visible-context.ts` and expose distinct predicates:

```ts
const AMEX_MEMBER_ORIGIN = "https://global.americanexpress.com";
const AMEX_BENEFITS_PATHS = new Set([
  "/card-benefits/view-all",
  "/card-benefits/activity",
]);

function isSupportedAmexOrigin(
  locationValue: Pick<Location, "origin"> = window.location,
): boolean;

function isPrimaryAmexBenefitsRoute(
  locationValue: Pick<Location, "origin" | "pathname"> = window.location,
): boolean;
```

`isSupportedAmexOrigin` gates mount and context capture. `isPrimaryAmexBenefitsRoute` controls initial presentation only; it is not a scan allowlist.

### Capture and verification

The existing portable type already permits the intended state:

```ts
interface VisiblePageContext {
  route: string;
  selectedCardDisplayFingerprint: string | null;
}
```

Capture behavior:

1. Refuse any origin other than the exact HTTPS member origin.
2. Capture the current pathname.
3. Run the existing one-way display fingerprint lookup.
4. Store the fingerprint when a recognized selected-card display is present; otherwise store `null` without throwing.

Verification behavior:

| Captured state | Current state | Result |
| --- | --- | --- |
| Exact origin/path; fingerprint present | Same origin/path and same fingerprint | unchanged |
| Exact origin/path; fingerprint present | Fingerprint changed or disappeared | changed |
| Exact origin/path; fingerprint absent | Same origin/path, regardless of a later selector appearing | unchanged |
| Any state | Origin or pathname changed | changed |

A selector appearing after a null capture does not retroactively become an invariant. This avoids comparing state that was not observed at scan start. Query strings and hashes remain outside the existing route contract; pathname changes are the navigation boundary.

The `Location` reference is read at capture and verification time, so scans initiated after an Amex SPA transition capture the current path. The panel itself does not listen to history changes or remount; a same-document panel remains mounted once.

## Panel state and accessibility

Introduce panel construction options rather than adding more positional booleans:

```ts
interface PanelOptions {
  initiallyCollapsed?: boolean;
  requiresReloadAfterClear?: boolean;
}

new AmexBenefitReaderPanel(initialStore, actions, options?);
```

Update the existing clear-data tests/call sites to use the options object. `mountError` accepts the same initial-presentation option so malformed local state remains recoverable without forcing a large panel over non-benefits pages.

The panel owns only transient state:

```ts
private collapsed: boolean;
```

It is not serialized, added to `StoreEnvelopeV1`, or written through GM storage.

### Render states

| State | Rendered behavior |
| --- | --- |
| Collapsed + idle | Small fixed `PR` semantic button with an accessible open label and `aria-expanded="false"`; no scan action is invoked. |
| Expanded + idle | Existing complete panel plus an accessible collapse button and the manual scan action. |
| Scanning/cancelling | Full panel remains expanded; collapse is disabled or unavailable so progress and Cancel stay visible. |
| Scan begins defensively while collapsed | Set `collapsed = false` before rendering progress. |
| Error/recovery | Same initial collapsed choice, with recovery UI available after expansion. |

The expanded region receives a stable ID. Toggle controls expose state through `aria-expanded`; icon/text decoration is hidden from assistive technology when an accessible label supplies the name. Existing focus styles and open Shadow DOM isolation remain intact. The launcher uses a compact fixed footprint at the existing top-right anchor and the full panel retains its current width/scroll behavior.

Initial collapse is computed once when the entry mounts:

```ts
const initiallyCollapsed = !isPrimaryAmexBenefitsRoute();
```

An in-document SPA route transition does not automatically open or close the panel. This avoids page-history monkey-patching and surprising UI changes; any new full document derives state from its own initial pathname.

## Entry wiring and duplicate prevention

`main()` performs these checks before loading GM state:

1. current origin is the exact supported origin;
2. no host with `#perks-reminder-amex-reader` exists.

It then loads the validated store and constructs the panel with `initiallyCollapsed`. No client method is called until the existing panel action invokes `engine.scanAllCards()`. The duplicate host ID remains the only mount deduplication mechanism and is sufficient for duplicate userscript execution in one document.

The metadata wildcard determines which documents Tampermonkey injects into; the runtime exact-origin check is retained as defense in depth and a unit-testable contract.

## Generated-bundle Chromium design

Add an invented non-benefits URL such as:

```ts
const SYNTHETIC_AMEX_NON_BENEFITS_URL =
  "https://global.americanexpress.com/account-overview";
```

The harness router may fulfill this document in addition to the existing benefits document. It still installs before navigation and aborts every unmatched request without fallback. The non-benefits HTML deliberately omits all selected-card selector candidates.

Generalize `openAndInject` to accept one of the harness-owned synthetic document URLs, or add an equivalent explicit helper. Do not accept arbitrary URLs. Existing benefit-route scenarios remain unchanged and expanded by default.

The new E2E scenario proves, through the actual rebuilt IIFE:

1. one host mounts at the non-benefits URL;
2. only the accessible launcher is initially available;
3. member/tracker/catalog request counts remain zero before expansion and after expansion alone;
4. explicit launcher activation reveals **Scan all cards**;
5. explicit scan completes with the existing exact synthetic operations and normalized GM persistence;
6. no selected-card selector is required;
7. `page.url()`/pathname remains unchanged;
8. no unexpected routing/runtime collection is populated.

The existing denied-origin probe, alternate-transport guards, synthetic fixture restrictions, one-worker/no-retry config, cancellation, stale-rescan, reload, and clear-data coverage remain in force.

## Compatibility and migration

- Storage schema remains version 1; there is no data migration.
- Observation contract, parser version, endpoint tuples, response adapters, supported-credit matcher, and local identity are unchanged.
- Previously stored normalized observations load in either collapsed or expanded presentation.
- The userscript namespace and name remain unchanged so `0.2.6` updates the intended installation rather than creating another identity.
- Existing `0.2.3` users remain on the narrow route match until they manually accept the updated bundle.
- The legacy `0.1.0` installation is not altered by this task.

## Risks and mitigations

| Risk | Mitigation | Rollback |
| --- | --- | --- |
| Reader overlays sensitive account controls on unrelated member pages | Compact launcher by default off the two benefit paths; transient explicit expansion. | Revert metadata/runtime mount broadening or reinstall `0.2.3`. |
| Missing selector blocks an otherwise safe scan | Nullable capture and route-only verification, covered by unit and generated-bundle tests. | Restore benefits-only scan eligibility. |
| Context verification becomes too weak when a selector was visible | Preserve strict equality when a fingerprint was captured. | Revert visible-context change independently. |
| Site-wide injection causes background provider traffic | No client call in mount/expand paths; request-count tests before manual scan. | Disable/revert `0.2.6`; stored normalized data remains compatible. |
| Harness broadening accidentally permits arbitrary network | Harness-owned URL allowlist plus existing catch-all abort/no-fallback assertions. | Remove the new synthetic URL/scenario. |
| Duplicate installed copies create duplicate UI | Existing host-ID deduplication; sanitized live host-count check. | Do not modify legacy installation without separate approval. |

## Live rollout boundary

After automated checks and explicit owner approval:

1. serve the rebuilt `0.2.6` artifact locally;
2. open the normal Tampermonkey installation/update page;
3. stop for the owner to complete the extension-protected confirmation;
4. open a representative exact-origin non-benefits page;
5. use only a narrow sanitized DOM query to confirm one host, collapsed launcher state, and no active scan UI;
6. do not take an authenticated screenshot or broad accessibility snapshot;
7. do not start a live scan without a separate explicit action-time authorization.

The live check validates installation/mount/presentation only. Routine scan correctness remains proven with invented generated-bundle fixtures unless the owner separately authorizes a bounded live scan.
