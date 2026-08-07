# Implementation plan — Free-product compatibility module

- [x] Reconfirm every subscription export caller.
- [x] Remove unused tier/card/email/feature/beta/display exports and `subscription-limits.ts`.
- [x] Preserve auth effective-tier compatibility without changing session fields.
- [x] Simplify notification selection and delivery by removing impossible email-limit branches and counter writes.
- [x] Update tests to use the remaining interface and assert no quota persistence.
- [x] Run subscription, notification-digest, cron-route, navbar, and pricing tests.
- [x] Run strict TypeScript, changed-source ESLint, and `git diff --check`.

Rollback: restore compatibility code only if a live caller or serialized session contract requires it; do not restore paid gates.
