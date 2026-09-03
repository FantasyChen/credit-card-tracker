# Perks Reminder — AMEX Benefit Reader

Manually reads normalized benefit progress from your signed-in American Express session. Nothing scans automatically. The panel keeps observations local until you explicitly choose **Sync reviewed**, which opens the separate Perks Reminder preview/confirmation flow.

This userscript is MIT-licensed and intended for Greasy Fork. It uses only the reviewed AMEX origin and exact Perks Reminder transfer surface, with storage grants and the page-realm bridge needed for the handoff. It has no remote code, privileged network transport, provider mutation, enrollment, or background polling.

Install either this userscript or the Perks Reminder Chrome extension, never both together. Perks Reminder is independent and not affiliated with or endorsed by American Express.

Support: https://github.com/lifan-builds/perks-reminder/issues
Privacy: https://www.perks-reminder.com/privacy

## Install and upgrade

Install the 1.0.1 artifact from Greasy Fork. Existing Perks Reminder userscript installations under the same name and namespace can upgrade monotonically from 1.0.0. Review the grants and exact matches before enabling it.

## What's new in 1.0.1

The Quiet Ledger redesign makes physical-card and benefit context easier to scan, clarifies progress and result states, improves responsive and dark-mode layouts, and strengthens keyboard focus without changing the manual-scan or local-storage boundaries.
