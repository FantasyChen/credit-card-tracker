# Perks Reminder AMEX Benefit Reader 1.0.1

## Chrome Web Store short description

Manually read normalized American Express benefit progress locally—nothing scans automatically.

## Long description

Perks Reminder AMEX Benefit Reader is a focused, read-only browser reader for your signed-in American Express benefits page. Start a scan yourself, review normalized benefit progress by physical card, and optionally choose **Sync reviewed** to send a validated handoff to Perks Reminder for its separate preview and confirmation flow.

The reader does not connect to a bank account, mutate American Express, enroll offers, or scan in the background. It does not inspect passwords, cookies, MFA values, authorization headers, or opaque provider tokens. Raw provider responses are not saved. Normalized observations and a local identity fingerprint stay in browser storage until you clear them.

Use either this Chrome extension or the Greasy Fork userscript, never both at the same time. Perks Reminder is an independent project and is not affiliated with or endorsed by American Express.

Privacy: https://www.perks-reminder.com/privacy
Support: https://github.com/lifan-builds/perks-reminder/issues

## Single-purpose statement

This extension has one purpose: manually read and display normalized American Express benefit progress in an in-page panel, with an optional reviewed handoff to Perks Reminder.

## Permission justification

- `storage`: retain only normalized observations, a local installation fingerprint, and a short-lived validated handoff mailbox on the device.
- Content-script site access to `global.americanexpress.com`: inject the reader on the reviewed AMEX pages and issue the three named first-party read requests only after the user presses Scan all cards.
- The tracker and catalog reads are fixed, named first-party CORS-permitted operations issued from the reviewed American Express page context; no separate functions-origin permission is requested.
- Content-script site access to `www.perks-reminder.com/integrations/amex-sync`: complete the optional validated handoff after the user presses Sync reviewed.

No `tabs`, `activeTab`, `scripting`, background worker, analytics, or remote executable code is used.

## Data-use answers

- Handles personal data: yes, only user-visible benefit observations and local identity material.
- Purpose: app functionality, specifically local display and an optional user-requested Perks Reminder handoff.
- Transfer: no sale or unrelated sharing; only the explicit handoff to Perks Reminder.
- Authentication: uses the existing browser session; never reads credentials or cookies.

## Release notes

1.0.1 — Introduces the Quiet Ledger redesign with clearer card and benefit context, calmer progress and result states, responsive dark-mode layouts, and improved keyboard focus.

1.0.0 — First public release with a shared read-only runtime, local normalized storage, exact handoff validation, accessible panel, and Chrome/Greasy Fork distribution parity.
