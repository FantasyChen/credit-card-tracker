# Store policy and repository evidence

## Repository findings

- The AMEX reader currently has one TypeScript runtime and panel compiled into
  production/local Tampermonkey artifacts; there is no Manifest V3 package.
- The reader already enforces manual scan, named first-party operations,
  normalized-only storage, exact handoff, one panel host, and no autoscan.
- `public/favicon.png` is an original Perks Reminder cycle/arrow mark with owned
  192/512/apple variants. It is suitable as the source identity, but store icons
  need a flatter small-size treatment and Chrome's transparent-padding rules.
- The repository is MIT licensed. Public listing and Greasy Fork metadata can
  use SPDX `MIT` without adding a new license.
- The public privacy policy describes the web app but not the browser reader;
  it must disclose provider-page reads, normalized local storage, and the
  optional first-party handoff before public submission.

## Current external requirements reviewed (2026-08-12)

### Chrome Web Store

- A publisher must register a Chrome Web Store developer account, accept the
  developer agreement/policies, provide a durable developer email, and pay the
  one-time registration fee.
- Public and unlisted visibility both undergo policy review; the user chose a
  public listing.
- The extension must have one narrow, understandable purpose; request only the
  permissions needed for that purpose; provide accurate privacy/data-use fields;
  and avoid remote executable code.
- Required listing media include a 128x128 PNG extension icon (96x96 artwork
  with 16px transparent padding per side), a 440x280 small promotional image,
  and at least one 1280x800 or 640x400 full-bleed screenshot.
- Descriptions, screenshots, permission justifications, and privacy statements
  must match actual behavior. Synthetic screenshots are required here because
  real account/card data may not enter store assets.

### Greasy Fork

- A posted script must accurately describe its behavior, have a reason to be a
  userscript, use correct listing language, and comply with external-code and
  update rules.
- `@license` should use an SPDX identifier; `MIT` matches the repository.
- `@supportURL`, homepage metadata, and `@icon` are supported. Greasy Fork strips
  `@updateURL`/`@downloadURL` and becomes the update authority for scripts
  installed from its listing, so the public artifact must not depend on a
  separate update host.

## Planning consequences

- Build Chrome and Greasy artifacts from one shared behavior/UI core with thin
  storage and handoff-window adapters.
- Use only `storage` plus exact declarative content-script site matches in Manifest V3; no `host_permissions`, tabs,
  activeTab, scripting, service worker, analytics, or remote code.
- Keep scan/sync exclusively in the in-page panel. The popup is static readiness
  copy plus normal links, requiring no privileged APIs.
- Use original Perks Reminder branding and an explicit non-affiliation note;
  never use AMEX logos or card art.
- Stop for user action/confirmation at developer registration fee/agreement,
  authentication, privacy deployment, upload, review submission, and public
  publishing boundaries.
