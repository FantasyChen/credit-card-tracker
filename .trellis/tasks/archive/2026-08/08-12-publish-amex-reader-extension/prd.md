# Polish and publish AMEX reader extension

## Goal

Turn the production-proven AMEX benefit reader into a polished, trustworthy
distribution with one shared behavior core, a branded UI and icon system, a
Manifest V3 Chrome extension package, and a Greasy Fork userscript release.

## Background

- Production userscript `0.5.3` has completed a real-account canary, including
  exact-five card matching, one bounded confirmation, duplicate prevention,
  post-write idempotency, and a final effective-`off` production state.
- The repository currently builds production/local Tampermonkey artifacts but
  has no Chrome extension manifest, service worker, popup, options page, store
  package, screenshots, or release automation.
- The in-page panel is accessible and functional but uses a plain `PR` text
  mark and minimal visual styling.
- Current Chrome Web Store guidance requires a registered developer account
  with a one-time fee, complete listing/privacy declarations, review, and an
  explicit visibility choice. Public and unlisted items both undergo policy
  review.
- Greasy Fork requires accurate functionality/metadata, proper language,
  compliant code behavior, and an explicit `@license`.

## Requirements

1. Preserve the proven read-only provider operations, normalized local storage,
   exact handoff, preview/confirmation separation, and duplicate/idempotency
   contracts. UI and packaging must not broaden provider reads or sync authority.
2. Create one shared runtime/UI source used by both the userscript and Manifest
   V3 extension so security fixes and parser behavior cannot drift between
   distribution channels.
3. Polish the panel and collapsed launcher with an original Perks Reminder icon,
   clearer visual hierarchy, responsive layout, accessible labels/focus/contrast,
   scan/sync states, and consistent light/dark presentation without exposing
   raw or diagnostic provider data.
4. Package a minimal-permission Chrome extension that runs only on the reviewed
   AMEX origin and exact Perks Reminder handoff surface, stores normalized data
   locally, contains no remote executable code, and has reproducible build/audit
   output suitable for Chrome Web Store upload.
5. Publish a Greasy Fork-compatible userscript with stable public metadata,
   icon, namespace, description, license, support/homepage links, reviewed
   update behavior, and the same exact origin/path/grant boundary as the audited
   production artifact.
6. Produce store-ready artifacts: icons at required sizes, screenshots/promotional
   image where required, concise/long descriptions, single-purpose statement,
   permission justifications, data-use/privacy disclosures, support URL, release
   notes, and install/test instructions.
7. Validate clean install, upgrade, idle/no-autoscan, manual scan, handoff,
   duplicate mount prevention, cancellation, reload, forbidden-origin behavior,
   and channel parity with synthetic data before any public submission.
8. Treat account registration fees, agreement acceptance, publisher identity,
   privacy declarations, upload, submission for review, and public release as
   attended external-action gates. Never expose credentials or private account
   state in Git or task evidence.
9. Launch the Chrome extension as a public listing. Position Greasy Fork as the
   advanced/manual-install alternative, and clearly tell users not to enable
   both channels at the same time because both mount the same reader host.
10. Reuse the original Perks Reminder brand identity and MIT license. Do not use
    AMEX logos, card art, or language that implies American Express endorsement.
    Extend the public privacy policy with the browser reader's exact local data,
    first-party session-read, and optional Perks Reminder handoff behavior.
11. The Chrome toolbar icon opens a small branded popup with extension readiness,
    privacy/manual-scan context, and ordinary links to AMEX and Perks Reminder.
    The popup must not scan, sync, inspect the active tab, or require `tabs`,
    `activeTab`, `scripting`, background, analytics, or remote-code permission.
12. Use public release version `1.0.0` across both channels. Preserve the existing
    production userscript name/namespace so Greasy Fork installation is a
    monotonic upgrade from `0.5.3`; Chrome uses its own extension identity but
    the same visible product name and release notes.
13. After the Greasy Fork publication, provide a public, discoverable setup page
    that links to the exact public `1.0.0` listing, explains Tampermonkey/manual
    scanning from a signed-in Amex session, requires exact five-digit matching
    before reviewed sync, links privacy/support, and warns users to enable only
    one reader distribution. The remaining release work excludes Chrome Web
    Store publication and keeps production sync gated behind its separate
    preview/write confirmation sequence.

## Acceptance Criteria

- [ ] The polished panel and icon set render correctly and accessibly across
  supported sizes and light/dark contexts.
- [ ] One source of truth produces audited Greasy Fork and Manifest V3 builds
  with no parser/runtime duplication.
- [ ] The extension uses the minimum reviewed permissions, contains no remote
  code, and passes manifest/package/artifact checks plus synthetic E2E parity.
- [ ] The userscript has compliant Greasy Fork metadata, explicit license and
  public support/homepage/update behavior, and passes artifact/E2E checks.
- [ ] Store assets, listing copy, privacy/data-use answers, permission
  justifications, and release notes are complete and truthful.
- [ ] A clean local Chrome install and userscript upgrade both prove exactly one
  idle reader, no automatic provider reads, manual scan behavior, exact handoff,
  and duplicate safety.
- [ ] The user reviews the final listing/package evidence before each external
  submission boundary.
- [ ] If publisher accounts are ready and the user approves the final action,
  the Chrome item is submitted for review and the Greasy Fork item is published;
  otherwise both channels end with upload-ready artifacts and precise blockers.
- [ ] The public Greasy Fork listing has a discoverable setup path with accurate
  manual-scan, exact-five, local-privacy, support, and channel-coexistence copy;
  the post-publication artifact canary uses the exact public `1.0.0` script.
- [ ] The remaining production release sequence is documented and gated: verify
  the final source, run zero-write preview, obtain fresh action-time approval,
  enable write for one bounded canary, prove idempotency/no duplication, then
  return to the exact safe-off state with sanitized evidence. Chrome Web Store
  review/publication is explicitly outside this sequence.

## Out of Scope

- Firefox/Safari/Edge store releases in this task.
- Automatic background scans, provider mutations, offer enrollment/linking,
  credential/cookie access, or raw-response storage.
- Expanding AMEX product/benefit matching or re-enabling production sync.
- Paid promotion, analytics, advertising, or unrelated browser permissions.
