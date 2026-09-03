# Implementation plan

## 1. Shared safe presentation helpers

- [ ] Add a client-safe AMEX presentation module for inert provider-title
      formatting and structured source-period formatting.
- [ ] Import and re-export those helpers from the reader panel so current test
      and caller compatibility remains intact.
- [ ] Add focused tests for existing formatter behavior and the December Uber
      source-context fallback used by the review display.

Rollback point: helper extraction can be reverted independently before UI work.

## 2. First-party handoff hierarchy

- [ ] Keep the authenticated server page and strict mailbox/network state
      machine unchanged.
- [ ] Add a local presentation projection that groups public rows by
      disposition and physical source card using only the accepted in-memory
      envelope.
- [ ] Fix disposition-aware row copy so `updated` rows say `Updated`, while
      preview rows say `Ready to update` and replay/failure reasons remain exact.
- [ ] Replace the punctuation count line and equal-weight section stack with the
      Quiet Ledger decision rail, state summary, grouped primary review, and
      accessible secondary disclosures.
- [ ] Keep reversal warnings directly on affected rows and visually prominent.
- [ ] Present missing-five-digit prerequisites as one compact checklist with
      the existing exact protected links and one context-aware refresh action.
- [ ] Add proposal countdown/urgency/expired presentation with timer cleanup,
      client-side stale-confirm disablement, and the existing server authority.
- [ ] Integrate the confirmation outcome into the main state summary and make
      result-state verification copy truthful.
- [ ] Add a route-local CSS module for responsive Quiet Ledger composition,
      focus, dark mode, and the one result transition; do not change global site
      tokens unless implementation proves it necessary.

Rollback point: the handoff UI and CSS module are isolated from API/database
behavior and can be reverted together.

## 3. Shadow DOM reader redesign

- [ ] Retain the single isolated Shadow DOM root and existing local CSS-variable
      ownership.
- [ ] Restyle the launcher and expanded shell with Quiet Ledger ink, paper,
      mint, gold, and semantic status tokens in light/dark mode.
- [ ] Simplify brand/privacy copy hierarchy without weakening the local-only
      disclosure or changing `Scan all cards` / `Sync reviewed` semantics.
- [ ] Replace nested benefit cards with ruled ledger rows grouped by exact
      physical card; preserve observed amount/target and period density.
- [ ] Increase practical touch targets to 44px, keep visible focus and pressed
      state, and prevent horizontal overflow on narrow AMEX viewports.
- [ ] Preserve the active-scan/cancel workspace exactly as an isolated minimal
      state and never render terminal observations during it.
- [ ] Preserve all hidden-diagnostic, active-filter, empty-state, and inert-text
      contracts.

Rollback point: panel presentation changes do not alter persisted store shape,
scan engine, provider reads, or handoff projection.

## 4. Behavioral and visual tests

- [ ] Extend handoff tests with mixed proposed/unchanged/skipped rows, physical
      card/title/period context, disclosure semantics, countdown and expiry,
      prerequisites, truthful updated state, replay, and partial failure.
- [ ] Update reader panel tests for the new structure using roles, names, and
      user-visible behavior rather than brittle style selectors.
- [ ] Preserve tests for no autoscan, collapse/expand, isolated scan/cancel,
      no incremental reveal, hidden diagnostics, filter membership, structured
      periods, inert provider text, and clear confirmation.
- [ ] Extend the synthetic AMEX browser fixture/visual assertion only as needed
      to exercise the redesigned panel at desktop and narrow sizes. No live
      provider or account session is part of this task.
- [ ] Render and inspect representative light/dark desktop and mobile states;
      verify proposed, prerequisite, success, partial failure, and expiry views.
- [ ] Apply the frontend-design removal pass: remove one non-semantic decorative
      treatment if the screenshots read as card-heavy or template-like.

## 5. Validation gate

Run only safe static, unit, artifact, and synthetic-browser checks:

```bash
npm test -- --runInBand \
  src/app/integrations/amex-sync/__tests__/AmexSyncHandoffClient.test.tsx \
  src/app/integrations/amex-sync/__tests__/AmexSyncHandoffClient.local.test.tsx \
  src/app/integrations/amex-sync/__tests__/AmexSyncHandoffClient.unsupported-origin.test.tsx \
  src/userscripts/amex-benefit-reader/__tests__/panel.test.ts \
  src/userscripts/amex-benefit-reader/__tests__/provider-text.test.ts
npx tsc --noEmit --pretty false --incremental false
npx eslint \
  src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx \
  src/app/integrations/amex-sync/__tests__ \
  src/lib/amex-benefit-reader/presentation.ts \
  src/userscripts/amex-benefit-reader/panel.ts \
  src/userscripts/amex-benefit-reader/__tests__/panel.test.ts
npm run build:amex-userscript
npm run build:amex-userscript:local
npm run check:amex-userscripts
npm run build:amex-reader-extension
npm run check:amex-reader-extension
npm run test:e2e:amex
git diff --check
python3 ./.trellis/scripts/get_context.py --mode packages
```

Run the optional synthetic visual command when a headed browser is available:

```bash
npm run test:e2e:amex:visual
```

Do not run `npm run build`, Prisma/database commands, live AMEX scans, account
operations, deployment, cron, email, notification, or production commands for
this UI task.

## 6. Final review and rollback check

- [ ] Inspect every changed/untracked path and confirm no generated build,
      screenshot, browser/session, credential, `.env`, or provider artifact is
      included.
- [ ] Confirm no API/database/provider authority or userscript metadata grant/
      match scope changed.
- [ ] Compare the final UI to every PRD acceptance criterion and record any
      deliberate deferral before commit.
- [ ] If any behavioral contract regresses, revert the owning presentation
      slice to the prior checkpoint rather than weakening the contract.
