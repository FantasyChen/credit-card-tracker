# Sanitized production schema migration — 2026-07-29

## Authorization and scope

The user separately authorized applying the reviewed additive global-catalog schema migration and immediately verifying migration status. No catalog synchronization, legacy bridge, cleanup, application push/deployment, configuration change, preview, provider scan, or AMEX write was authorized or performed in this boundary.

## Immediate pre-apply verification

- Application and direct database connections reached the same database/provider project/default branch.
- The provider control-plane target matched the database-side identity.
- Point-in-time recovery was configured and the verified recovery branch already existed without compute.
- Production AMEX resolved to `off`.
- Prisma reported exactly the expected additive global-catalog migration pending, with no failure/divergence/missing-local marker.

## Apply result

- The explicit attended production migration command completed successfully.
- The expected additive migration was reported as applied.
- Independent post-apply migration status reported the schema up to date.
- Read-only information-schema verification found every required additive global card, global benefit, physical-card bridge, and standard-status bridge column.
- No seed, reset, catalog synchronization, legacy migration, cleanup, or status mutation command ran.

## Current gate

The schema gate passed. Production AMEX remains `off`. The next boundary is the complete read-only global-catalog synchronization dry-run. Any catalog apply requires a separate review of sanitized aggregate actions/conflicts and a separate authorization.

## Privacy

Environment values and raw command output were held only in temporary files and removed. This record contains no connection value, database/provider identifier, branch identifier, user/record value, card ending, token, cursor, or plan fingerprint.
