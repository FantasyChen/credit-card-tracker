# Technical Design

## Release and alias boundary

Use the `coupon-cycle` Vercel project and the canonical `www.perks-reminder.com` alias. First inspect the candidate deployment and verify its source commit/build identity. The known candidate is the successful deployment associated with `0401edc`; the currently served deployment is a separate Ready deployment and must not be assumed equivalent.

Promote only the verified candidate with the existing Vercel promotion flow. If the candidate is unavailable or does not contain the tracking release, stop and use the normal GitHub `main` deployment path rather than deploying from an unreviewed local tree. After promotion, inspect the alias and candidate again and require exact deployment-ID equality.

## Data migration boundary

Run the existing `20260831000000_migrate_not_usable_to_ignore` migration through the attended production migration command, using the verified direct production migration target. Before applying it, run a non-mutating migration status check and verify the recovery point and target identity. The migration is transactional and includes ownership/shape guards; a guard failure is a stop condition, not a reason to weaken SQL or guess identities.

The migration is data-changing but scoped to legacy `isNotUsable` rows and their corresponding preference identities. It preserves cycle dates, completion state, amounts, and timestamps. After applying, rerun migration status and perform only the narrowest aggregate/read-only verification available; do not query unrelated users or emit row values.

## Documentation consistency

Update `docs/benefit-tracking-modes.md` to describe `IGNORE` as visible in the dashboard's read-only Ignored tab while excluded from tracked tabs, totals, and ROI. Keep the documented deployment order accurate by naming both tracking-preference migration and the legacy backfill migration.

## Recurrence prevention

Capture a sanitized release record for this rollout and codify the same gate in
the deployment and database specs: source commit, migration status, immutable
deployment ID, and primary-alias deployment ID must be compared together. An
intentional rollback must name its source commit and explicitly list omitted
capabilities. This makes alias drift observable and prevents a Ready build or
successful GitHub check from being mistaken for the release users are seeing.

## Rollback and stop conditions

- If alias identity differs, promote no further deployment and restore the last verified application deployment.
- If migration status or target identity is uncertain, do not run the migration.
- If the migration aborts on malformed ownership/shape data, preserve the database state and report the exact aggregate blocker without compensating writes.
- If post-migration checks show unrelated changes, stop and preserve the recovery point for operator review.
- Do not change AMEX mode, run confirmation, or trigger notifications as part of this task.
