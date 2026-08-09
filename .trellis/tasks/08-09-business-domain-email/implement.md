# Implementation plan

1. Load the Perks Reminder deployment, frontend, and verification specifications before changing provider state or code.
2. Inspect the authenticated Spaceship Domain Manager entry for `perks-reminder.com`; confirm the account, forwarding feature, price/renewal terms, and exact proposed DNS changes.
3. Request action-time confirmation, then create `support@perks-reminder.com` forwarding to the destination supplied in chat. Complete only the narrowly required ownership verification.
4. Check public MX/SPF/DKIM/DMARC records and confirm `www` and `loyalty` routing remain unchanged.
5. Request action-time confirmation, send one narrow inbound test, and verify delivery without using application notification or cron paths.
6. Update `SUPPORT_EMAIL` in `src/lib/site.ts` to `support@perks-reminder.com` and add/update a targeted test.
7. Run safe checks: the targeted Jest file, strict TypeScript if the change affects TypeScript compilation, `git diff --check`, full diff/untracked review, and a sensitive-data scan. Do not build, deploy, access a database, or trigger application email.
8. Run the Trellis quality review. Commit the source/task changes only after the checks pass. Any push or production deployment requires separate authorization.
9. Summarize the live forwarding result, verification evidence, provider cost/renewal/limitations, rollback path, source commit, and any deployment still pending.

## Completion evidence

- Spaceship Domain Manager shows the individual `support@perks-reminder.com` forwarding rule. The flow showed no charge, subscription, or renewal term.
- Ownership/recovery remain with Spaceship as registrar and authoritative DNS provider; rollback is limited to removing this single forwarding rule and restoring only records the provider proves it changed. The workflow remains forwarding-only (no hosted mailbox or branded-reply guarantee), supports up to 100 aliases, and only this one alias was created.
- Public DNS exposes both Spaceship forwarding MX hosts and the forwarding SPF include while the existing DMARC and Resend DKIM records remain present.
- `www` and `loyalty` continue resolving to the existing Vercel address.
- A test sent from a distinct user-controlled mailbox reached the approved destination Gmail account; the received conversation exposes the Inbox label. The earlier self-sent test was treated as inconclusive because Gmail deduplicated it.
- Repository implementation and independent Trellis review passed targeted Jest, strict TypeScript, changed-source ESLint, repository lint with one pre-existing warning, package discovery, `git diff --check`, and sensitive/artifact review.
- Production push/deployment was not authorized and remains outside this task's completed external actions.
