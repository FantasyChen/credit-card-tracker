# Design — public AMEX reader distribution

## 1. Architecture

One source tree owns parsing, scan orchestration, normalization, presentation,
sync projection, and the in-page panel. Distribution adapters supply only:

```text
shared reader core + shared panel + shared brand assets
  ├─ Greasy Fork adapter: GM storage + unsafeWindow page-realm bridge
  └─ Chrome MV3 adapter: chrome.storage.local + reviewed content-script bridge
       └─ static action popup: readiness copy + ordinary navigation links
```

The build fails if parser/runtime/panel source is copied into a second channel.
Both channel artifacts expose release `1.0.0` and a distribution identifier for
diagnostics/tests, but local observations retain the same schema and storage
contract so the userscript upgrade is non-destructive.

## 2. Manifest V3 boundary

The Chrome extension contains no service worker and no remote code. Its manifest
declares:

- `manifest_version: 3`;
- one visible name/description/version;
- `storage` permission only;
- declarative content-script site-access matches limited to the reviewed AMEX
  pages and Perks Reminder handoff path; no `host_permissions` API grant is
  requested because the content script's named reads retain the page-origin
  CORS contract;
- content scripts limited to the AMEX site and reviewed handoff path, with
  runtime origin/path/query checks still authoritative;
- an action popup and owned local icons.

The popup does not inspect tabs or invoke scans. Links use ordinary anchors with
`noopener noreferrer`. Content scripts use a shared `StoragePort`; handoff is
verified in a real unpacked extension because page/isolated-world behavior cannot
be proven solely by direct script injection.

## 3. Greasy Fork boundary

The public userscript preserves the production name and namespace and advances
from `0.5.3` to `1.0.0`. Metadata includes exact match/include scope, existing GM
storage plus `unsafeWindow`, `@noframes`, MIT license, owned HTTPS icon,
homepage/support links, and accurate description. It contains no `@require`,
privileged network request, remote code, explicit alternate update authority, or
additional provider operation.

## 4. Visual system

Refine the existing Perks Reminder cycle/arrow into a flat SVG master and
deterministic PNG exports at 16/32/48/128 plus listing sizes. The in-page launcher
and header use the same inline SVG mark. Visual changes keep the Shadow DOM,
semantic controls, 40px minimum targets, focus rings, reduced-motion behavior,
and text-only provider rendering.

Panel layout:

- compact branded launcher with tooltip/accessible name;
- header with icon, reader title, local/read-only trust label, and collapse;
- primary scan action and secondary reviewed-sync action;
- clearer segmented Remaining/Used filters;
- denser but readable benefit cards and truthful statuses;
- responsive light/dark theme using `prefers-color-scheme`;
- isolated scan/cancel workspace unchanged in authority.

Chrome listing media are rendered from a Playwright capture that bundles and
instantiates the shared `AmexBenefitReaderPanel` with synthetic normalized data
at 1280x800; no panel markup is duplicated in the asset builder.
The 440x280 promo uses only the owned icon, product name, and short purpose copy.

## 5. Privacy and channel coexistence

The public privacy page and store copy disclose:

- manual first-party reads through the user's signed-in AMEX browser session;
- no password/cookie/token inspection and no raw-response persistence;
- normalized observations and local identity material stored locally;
- optional reviewed normalized handoff to `www.perks-reminder.com` only after an
  explicit Sync action;
- no sale, ads, analytics, or unrelated sharing.

Both listings warn that Chrome and Greasy Fork editions must not be enabled
together. Runtime host-ID duplicate prevention remains the last safety layer.

## 6. Public onboarding and post-publication release

The authenticated `/integrations/amex-sync` route remains a transfer-only,
`noindex` handoff surface. Public discovery uses a separate
`/integrations/amex-sync/setup` page linked from the site footer, signed-in
Settings, and the sitemap. It points to the exact published Greasy Fork `1.0.0`
listing and keeps the onboarding contract explicit: install through
Tampermonkey, sign in to Amex in the same browser, start a manual scan, match
exactly five ending digits before a reviewed sync, review privacy/support, and
enable only one reader distribution.

After the public artifact is installed, the release sequence is: verify the
source and exact public artifact, run an authenticated zero-write preview,
request fresh action-time confirmation using sanitized aggregates, enable
production write for one bounded canary, repeat the scan/preview to prove
idempotency and no duplicate mutation, and restore/verify the exact `off` mode.
Chrome Web Store review and publication are excluded from this remaining
sequence; any production write still requires its own current confirmation.

## 7. Release gates and rollback

Implementation and local packaging do not publish anything. After all checks:

1. Present package hashes, manifest/grants, screenshots, listing copy, privacy
   answers, and clean-install evidence.
2. Reverify publisher accounts and stop for authentication, fee, agreement, or
   identity setup that requires the user.
3. Obtain action-time approval before each upload/submission/publish action.
4. Record only public URLs, versions, review state, booleans, and sanitized
   provider responses—never credentials or account identifiers.
5. If a channel is rejected, keep the other channel unchanged and fix forward;
   do not broaden permissions or weaken privacy gates to pass review.

Production AMEX sync remains `off` throughout this task unless a separate task
and approval explicitly changes it.
