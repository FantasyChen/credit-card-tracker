# Local-development AMEX userscript handoff

This workflow is only for an explicitly authorized manual development test. It does not replace or retarget the production userscript. `npm run build:amex-userscript` creates only `build/amex-benefit-reader.user.js` with name `Perks Reminder — Amex Benefit Reader`, namespace `https://perks-reminder.com/`, version `0.5.1`, and the exact handoff match `https://www.perks-reminder.com/integrations/amex-sync`.

The production output lives under the ignored `build/` directory and is not distributed by Vercel. Deploying the Next application therefore does not update an installed userscript. Publishing or installing production `0.5.1` is a separate release action that must use the reviewed generated artifact and separate authorization; this development workflow performs neither action.

## Prerequisites

1. Use the verified development database workflow already approved for the test account. Do not point the local app at production for writes.
2. Start the local Next app with these values supplied to the process that launches it:

   ```bash
   NEXTAUTH_URL=http://localhost:3000 \
   NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
   AMEX_SYNC_MODE=write \
   AMEX_SYNC_HMAC_KEY=<development-only-key-at-least-32-characters> \
   npm run dev:devdb
   ```

   Use `AMEX_SYNC_MODE=preview` when confirmation writes are not required. The HMAC key must be development-only and at least 32 characters. Never place a real key in a tracked file or command transcript.
3. Sign in to the local Perks Reminder app at `http://localhost:3000` using the authorized development account.
4. Be signed in to the reviewed `https://global.americanexpress.com` account in the browser where the local userscript will run. Installation does not authorize a scan; start a scan only under the applicable manual-test authorization.

`NEXT_PUBLIC_SITE_URL` must be present when the Next process starts. The AMEX sync request boundary recognizes only `https://www.perks-reminder.com` and `http://localhost:3000`; other hosts, schemes, and localhost ports fail closed.

## Build and install the local artifact

Build the separate local Tampermonkey identity:

```bash
npm run build:amex-userscript
npm run build:amex-userscript:local
npm run check:amex-userscripts
```

The checker compares both generated artifacts. Build both first, even when only the local identity will be installed.

The generated file is:

```text
public/local-development/amex-benefit-reader.local.user.js
```

While the local Next app is running, open this exact install URL:

```text
http://localhost:3000/local-development/amex-benefit-reader.local.user.js
```

The local artifact uses name `Perks Reminder — Amex Benefit Reader (Local Development)`, namespace `http://localhost:3000/perks-reminder-amex-reader-local/`, and version `0.5.0-local.3`. This monotonic local version makes Tampermonkey offer an update without changing the production identity. Its activation metadata is:

```text
@match   https://global.americanexpress.com/*
@include http://localhost:3000/integrations/amex-sync?transfer=*
```

The localhost handoff uses `@include` because Chrome-style `@match` host patterns do not support ports. The include is limited to the exact localhost origin, port, path, and transfer-query shape; runtime code additionally requires exact origin `http://localhost:3000` and exact pathname `/integrations/amex-sync` before mounting the bridge.

It has the existing `GM.getValue`, `GM.setValue`, and `GM.deleteValue` grants plus local-only `unsafeWindow` access so the isolated Tampermonkey bridge exchanges same-window messages with the localhost app's page realm. It has no update URL, privileged network grant, or extra provider operation. The production `0.5.1` identity does not receive the local-only grant.

## Manual run

1. Confirm Tampermonkey shows `Perks Reminder — Amex Benefit Reader (Local Development)` before installing.
2. Temporarily disable the production `Perks Reminder — Amex Benefit Reader` identity. Both identities match AMEX and intentionally share one panel host, so only the local identity may be enabled for this test.
3. Confirm Tampermonkey shows the local identity enabled at version `0.5.0-local.3`, then open or reload the reviewed AMEX page.
4. Perform the separately authorized manual scan.
5. Review the normalized local results and choose **Sync reviewed**.
6. Confirm the new tab opens at exactly `http://localhost:3000/integrations/amex-sync?transfer=...`.
7. Review the preview in the local app. If a destination card needs five ending digits, open its edit link in the separate tab, save the card, return to the retained sync tab, and choose **Refresh after editing cards**. Review the replacement preview before continuing. A write still requires the existing explicit confirmation action.

The accepted envelope remains only in the retained sync page's React memory. Refresh requests a new preview and proposal; it does not place provider evidence or proposal material in a return URL or browser storage. If the scan has expired, return to AMEX, run a fresh scan, and choose **Sync reviewed** again.

The transfer URL contains only the opaque transfer ID. Mailbox digest, nonce, expiry, payload validation, acknowledgement, and deletion behavior are unchanged. The local artifact accepts handoff messages only from `http://localhost:3000`; the production artifact continues to accept only `https://www.perks-reminder.com`.

## Cleanup

After the manual test, remove or disable the local userscript identity in Tampermonkey, then re-enable the production reader. The generated local artifact is ignored by Git and can be deleted safely. Do not uninstall or replace the production reader as part of local cleanup.
