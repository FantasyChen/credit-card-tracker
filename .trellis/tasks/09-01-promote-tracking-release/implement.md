# Implementation Plan

## 1. Planning and static preflight

- [x] Validate the task artifacts and read the deployment, database-safety, frontend, and tracking-mode contracts.
- [x] Run focused tracking-mode/dashboard tests, type-check, and `git diff --check` before production actions.
- [x] Confirm the working tree contains no `.env`, provider output, generated artifacts, or unrelated changes.
- [x] Prepare the sanitized release record fields (source commit, migration status, immutable deployment ID, primary-alias deployment ID, and rollback boundary).

## 2. Production target and release verification

- [x] Inspect the exact `coupon-cycle` project and current `www.perks-reminder.com` alias without inferring from local `.vercel` state.
- [x] Inspect the candidate deployment associated with `0401edc`; verify Ready status and release/source identity.
- [x] Verify the production database target and recovery readiness without exposing connection values.
- [x] Verify migration status before applying anything; stop if the target is uncertain or the candidate release is not the tracking release.

## 3. Migration and promotion sequence

- [x] Confirm `20260831000000_migrate_not_usable_to_ignore` is already applied; no migration write was needed.
- [x] Recheck migration status and aggregate-only migration outcome.
- [x] Promote the verified `0401edc` deployment to the primary alias.
- [x] Inspect the primary alias and immutable deployment and require exact deployment-ID equality.
- [x] Persist the aggregate release/alias comparison and rollback boundary.

## 4. Runtime and regression verification

- [x] Run an authenticated read-only UI/runtime check for the tracking dashboard, confirming `Ignored` is present and `Not Usable` is absent after reload.
- [x] Verify `TRACK` restoration behavior and status preservation through the existing mocked action/dashboard tests; no other users were inspected.
- [x] Run the final static checks and review changed paths.

## 5. Finish

- [x] Update the tracking-mode documentation and task evidence with sanitized deployment/migration results.
- [x] Run Trellis validation, package discovery, JSON/JSONL checks as applicable, and `git diff --check`.
- [ ] Commit repository documentation/spec/script changes locally. Do not push a documentation-only commit or perform unrelated production actions.
- [ ] Archive the task only after every acceptance criterion passes; otherwise leave it active with the exact blocker and the verified rollback state.

## Stop conditions

Stop immediately on any target, recovery, deployment, alias, migration, schema, authentication, ownership, data-integrity, or privacy mismatch. Never bypass a failed migration guard, manufacture a legacy target, or compensate with unrelated writes.

## Execution evidence (2026-09-01)

- `origin/main` resolved to `0401edc7929b9b96b64244449bbaa64be85a196f`; the candidate Vercel deployment was Ready and the exact `coupon-cycle` project/primary alias were verified.
- Before promotion, `www.perks-reminder.com` resolved to `dpl_FtTVLar87QSVQdDVf14yjKTSxrWN`; after promotion it resolved to the `0401edc` deployment `dpl_D5jxU1qwrT1CQo9DSSurwjzrvaJN`. Both deployment and alias were Ready and identity-matched after the change.
- `npm run db:prod:status` before and after promotion reported `Database schema is up to date` across all 26 migrations, including `20260831000000_migrate_not_usable_to_ignore`; no production migration command or data write was run.
- Focused Jest coverage passed: 4 suites, 60 tests. The release-identity guard's three Node tests passed for Ready/commit/alias matching, drift rejection, supported commit metadata, and missing-config fail-closed behavior. Strict TypeScript, task validation, package discovery, JSON/package parsing, release-check syntax, and `git diff --check` passed. The new `npm run check:production-release` guard fails closed when its provider configuration is absent and emits no output containing secrets.
- An authenticated read-only Chrome reload showed Upcoming, Claimed, Scheduled, and `Ignored (28)` tabs; the Not Usable tab count was zero and 25 visible benefit cards exposed tracking-mode controls. No benefit control or form was clicked. No AMEX, cron, email, notification, cleanup, or unrelated database action was performed.
