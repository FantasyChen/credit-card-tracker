# Sanitized production preflight — 2026-07-29

## Result

The controlled rollout may proceed through local commit preparation, but production migration and remote push remain stopped until a database recovery point is authenticated and verified. Production AMEX is effectively `off`. No production mutation, deployment, configuration change, userscript action, browser action, or provider call occurred.

## Verified read-only gates

- GitHub authentication targets the expected repository and `main` remains the production branch.
- The production domain resolves to the intended linked Vercel project and a ready production deployment exists as the application rollback baseline.
- Production environment configuration contains both application and direct database connections.
- Independent read-only database queries proved the application and direct connections reach the same database, provider project, and branch; both roles connected successfully.
- Production AMEX resolves to `off`; no production HMAC is configured.
- Prisma migration inspection reports the additive global-catalog migration as the expected pending migration and reports no failed/divergent/missing-local migration marker.
- No production userscript, provider scan, preview, confirmation, or write was initiated.

## Release-safety finding and correction

Vercel Preview and Production currently reuse the same database targets. Before correction, the generic `npm run build` invoked `prisma migrate deploy`; therefore a branch push could have modified production through a preview build before the attended migration boundary.

The release was stopped before push. The reviewed correction:

```text
npm run build           -> Prisma generation + Next compilation only
npm run db:prod:migrate -> explicit attended Prisma migration deployment
```

`npm run check:public-db` now fails if the generic build contains a Prisma migration command. Final source review and the full static/unit suite passed after this correction.

## Recovery gate

- Local Neon CLI authentication state exists, but it is not currently authenticated to the production provider project.
- Provider project/branch matching and point-in-time recovery availability therefore could not be verified through the provider control plane.
- Do not apply the schema migration, catalog synchronization, legacy bridge, or push an automatically deployed branch until authentication is refreshed and a recovery branch/point is created and verified.

## Stop conditions

Stop and keep AMEX `off` if any of the following occurs:

- provider target or branch does not match the read-only database identity;
- a recovery point cannot be created or verified;
- migration inspection reports anything beyond the expected additive migration;
- catalog dry-run reports conflicts, ambiguous adoption, unintended creates, or identity drift;
- legacy migration reports unresolved/blocked units requiring inference;
- any status identity/state/cycle/timestamp/audit/provenance value changes outside approved bridge metadata;
- preview/build regains database migration authority;
- any report would expose a connection value, provider/database identity, user/record value, card ending, token, cursor, or plan fingerprint.

## Privacy handling

Production environment files and command output were held only in temporary files and removed immediately. Only booleans and aggregate gate states were emitted. No connection value, database/provider identifier, user/card/benefit/status identifier, card ending, token, cursor, or plan fingerprint is retained in this report.
