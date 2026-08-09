# Business domain email design

## Boundaries

- Spaceship remains the registrar and authoritative DNS provider for `perks-reminder.com`.
- Spaceship's native Domain Manager forwarding feature owns the inbound alias and provider-managed mail records.
- `support@perks-reminder.com` forwards to the user-approved mailbox supplied in chat. The destination is provider state and must not be written to Git, task files, console evidence, or screenshots shared outside this session.
- Resend remains the application's transactional sending provider. Existing Resend DKIM and DMARC records must not be replaced or weakened.
- The repository owns the public contact address through `SUPPORT_EMAIL` in `src/lib/site.ts`.

## Execution flow

1. Open the exact `perks-reminder.com` domain in the authenticated Spaceship account.
2. Preview the forwarding feature, including price, renewal terms, destination, provider-proposed DNS changes, and any ownership verification.
3. Obtain action-time confirmation before submitting the forwarding rule or any charge.
4. Create only `support@perks-reminder.com` to the approved destination.
5. Verify public MX/SPF/DKIM/DMARC state without exposing account or recipient data.
6. After separate confirmation, send one narrow test message from a user-controlled account and verify delivery at the destination.
7. Change the checked-in `SUPPORT_EMAIL` constant and add/update a targeted static test. Do not run a production build, push, or deploy as routine verification.

## Compatibility and risk controls

- Do not change `www` or `loyalty` web records, nameservers, NextAuth configuration, Resend API configuration, or `FROM_EMAIL`.
- If Spaceship requires replacing or deleting existing Resend authentication, stop rather than submit.
- If the account shows a charge or recurring plan, report the exact price and renewal terms and obtain purchase confirmation before checkout.
- If account access, ownership verification, CAPTCHA, or recipient confirmation blocks progress, leave the exact page open for user handoff.

## Rollback

- Provider rollback: remove the single forwarding rule and restore only records that Spaceship proves it changed for the rule; do not broadly rewrite DNS.
- Source rollback: restore the previous `SUPPORT_EMAIL` constant before any deployment if forwarding verification fails.
- Stop immediately on unexpected changes to web routing, Resend authentication, or any provider/account scope mismatch.
