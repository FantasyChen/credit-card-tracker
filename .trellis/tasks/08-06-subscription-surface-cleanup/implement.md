# Implementation plan — Free-product compatibility module

- [ ] Reconfirm every subscription export caller.
- [ ] Remove unused tier/card/email/feature/beta/display exports and `subscription-limits.ts` if no live interface remains.
- [ ] Simplify auth effective-tier compatibility without changing session fields.
- [ ] Simplify notification selection and delivery by removing impossible email-limit branches and counter writes.
- [ ] Update tests to use the remaining interface and assert no quota persistence.
- [ ] Run subscription, auth-adjacent, notification-digest, cron-route, and navbar/settings tests.
- [ ] Run strict TypeScript, changed-source ESLint, and `git diff --check`.

Rollback: restore compatibility code only if a live caller or serialized session contract requires it; do not restore paid gates.
