# Current AMEX reader and handoff UI audit

## First-party handoff

- `src/app/integrations/amex-sync/page.tsx:21` correctly remains a thin,
  authenticated Server Component boundary. The redesign should stay in the
  route-local client component.
- `src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:433` uses a narrow
  three-column-width layout and a sequence of visually similar bordered cards.
  The primary review decision is not distinguishable at a glance.
- `src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:426` already has row
  disposition counts, but exposes them as one punctuation-delimited string.
- `src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:228` renders only the
  credit-family suffix. The accepted envelope has safe `providerProductName`,
  `endingDigits`, `providerTitle`, and `sourcePeriod` fields that can supply
  decision context without expanding the server DTO or persisting anything.
- `src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:513` renders expiry
  as a small absolute clock time. There is no countdown or urgency/recovery
  affordance.
- `src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:453` places exclusions
  before prerequisites and proposed rows, adding length before the decision.
- `src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:468` is safe but
  fragmented for multiple cards: each exact link opens a separate editor and
  one refresh re-previews the retained in-memory envelope.
- `src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:539` reports generic
  success after the rows, while `reasonText("proposed_update")` still says
  `Ready to update` for rows whose disposition became `updated`.

## AMEX reader panel

- `src/userscripts/amex-benefit-reader/panel.ts:488` owns all styling inside the
  Shadow DOM. It uses local CSS variables and a system stack, so it is fully
  isolated from AMEX but does not share the first-party app's utility classes.
- `src/userscripts/amex-benefit-reader/panel.ts:492` provides a strong fixed
  launcher but the expanded surface has nested card-on-card-on-card treatment.
- `src/userscripts/amex-benefit-reader/panel.ts:637` gives the privacy disclosure
  large persistent prominence. Trust copy should remain clear while yielding
  more room to the scan and benefit-review task.
- `src/userscripts/amex-benefit-reader/panel.ts:671` has correct coverage and
  filter projections. Visual changes must not surface the internal coverage
  kinds or diagnostic information.
- `src/userscripts/amex-benefit-reader/panel.ts:576` correctly replaces the whole
  terminal interface with an isolated progress workspace. This is a safety and
  clarity strength to preserve.
- Existing 40px controls are slightly below the preferred mobile touch target;
  the redesign should use 44px where the fixed panel dimensions permit it.

## Contractual tests to preserve and extend

- The handoff tests prove strict mailbox acquisition, URL stripping, preview
  without write, separate confirmation, response-shape rejection, exact
  protected prerequisite links, memory-only refresh, stale proposal replacement,
  refresh/confirm exclusion, expired refresh failure, mode-off behavior, and
  unsupported-origin failure.
- The panel tests prove no autoscan, accessible collapse/expand, isolated
  progress and cancellation, no incremental data reveal, hidden diagnostics,
  filter-aware physical-card groups, structured period formatting, truthful
  benefit state, and destructive clear confirmation.
- New tests should assert the redesign's information hierarchy and truthful
  copy without weakening those behavioral contracts or overfitting class names.
