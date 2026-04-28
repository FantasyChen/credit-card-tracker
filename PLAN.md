# Domain Migration Announcement

## Goal
All existing users receive one clear announcement that CouponCycle is now Perks Reminder, with no duplicate sends and a recoverable batch process.

## Progress
- [x] Create migration announcement email content.
- [x] Send one live smoke test to `fantasychen2016@gmail.com`.
- [x] Start production send through Resend from `notifications@perks-reminder.com`.
- [x] Stop sending after Resend returned `daily_quota_exceeded`.
- [x] Save sent and remaining recipient lists in `announcement-state/`.
- [ ] Send remaining users in daily capped batches after quota resets.
- [ ] Re-audit remaining list after each batch.

## Findings
- Intended recipient count is 481 after excluding `@example.com` test accounts.
- First quota failure was `mlee092161@gmail.com`.
- Local state currently records 195 sent and 286 remaining.
- Resend free plan quota is recipient-based, so daily quota can be consumed quickly by production announcements.

## Decisions
- Use `announcement-state/migration-announcement-remaining.txt` as the next-batch source.
- Use `--limit` for future batches so normal transactional reminders still have quota headroom.
- Stop immediately on `daily_quota_exceeded` instead of continuing through the remaining list.

## Archive
None.
