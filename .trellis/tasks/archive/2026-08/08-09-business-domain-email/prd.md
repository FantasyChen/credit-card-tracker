# Set up business domain and email

## Goal

Give Perks Reminder a professional, domain-based email address that can be used for public contact while preserving the existing production website and transactional email setup.

## Background

- The established product domain is `perks-reminder.com`; `https://www.perks-reminder.com` is live.
- The application already uses Resend for transactional email and expects a provider-managed `FROM_EMAIL` value.
- Public DNS exposes a DMARC policy and a Resend DKIM record, but the root domain currently has no MX record. The domain is therefore prepared for branded outbound mail but not normal inbound mailbox delivery.
- Domain, DNS, mailbox, billing, and provider changes are external effects. Exact provider/account, price, renewal terms, DNS changes, and rollback steps must be reviewed before submission.

## Requirements

- Reuse `perks-reminder.com`; do not purchase or migrate to a second business domain.
- Create `support@perks-reminder.com` as the public forwarding address.
- Forward inbound mail to the user-approved existing mailbox supplied in this conversation; do not persist that destination in repository or task artifacts.
- Preserve the existing Resend transactional sender. Branded interactive replies are not required for this forwarding-only MVP.
- Prefer the simplest provider setup that satisfies the chosen model and makes ownership, recurring price, renewal terms, and recovery options clear.
- Keep credentials, payment data, provider secrets, and DNS/provider state out of the repository and task artifacts.
- Obtain action-time confirmation before any purchase, paid subscription, DNS submission, account creation, permission change, or test message.
- Verify the resulting address with a narrow inbound/outbound test that does not use production notification or cron endpoints.
- Update the checked-in public contact address from the legacy Gmail address to `support@perks-reminder.com`; production deployment remains a separately authorized external action.

## Acceptance Criteria

- [x] `support@perks-reminder.com` exists as a forwarding rule in the domain provider.
- [x] A narrow test message sent to `support@perks-reminder.com` reaches the approved destination mailbox.
- [x] Existing `www` and `loyalty` web routing remains unchanged.
- [x] Existing Resend authentication remains intact and public DNS shows the expected MX/SPF/DKIM/DMARC records for the selected design.
- [x] Checked-in public contact configuration uses `support@perks-reminder.com` and its targeted tests pass.
- [x] Provider, recurring cost, renewal terms, recovery/ownership, and any limitations are summarized for handoff.

## Out of Scope

- Buying another domain or renaming the product.
- Triggering application notification emails, cron routes, deployments, builds, or database operations.
- A hosted mailbox, mailbox migration, or guaranteed branded From address for interactive replies.
- Pushing or deploying the source change without a separate production-action approval.

## Technical Notes

- Authoritative nameservers are `launch1.spaceship.net` and `launch2.spaceship.net`, so Spaceship currently controls DNS.
- Spaceship's current domain-forwarding workflow is available in Domain Manager and supports up to 100 aliases. Account-specific charges, if any, must be reviewed before submission.
- Before this task, the contact page imported a legacy Gmail value through `SUPPORT_EMAIL`. The task changes that shared public constant to the branded alias after forwarding verification; the source change is separate from DNS/provider setup and follows the repository quality gate.
