# Sanitized production preflight — 2026-07-29

## Result

The controlled rollout may proceed to the separately authorized additive schema migration. Production application/database/provider targets and recovery are verified. Production AMEX is effectively `off`. The only production-side change so far is a provider-native recovery branch without compute; no application-database mutation, deployment, configuration change, userscript action, browser action, or provider call occurred.

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

- Neon CLI authentication was refreshed through the provider OAuth flow.
- The provider project/default branch matches the database-side production identity, and point-in-time recovery is configured.
- A recovery branch was created from the exact production parent without provisioning a compute; parentage and branch creation were verified without retaining provider identifiers.
- The recovery gate is passed. Schema migration remains a separate explicit authorization boundary; catalog synchronization, legacy bridge, push/deployment, cleanup, preview, and write remain later boundaries.

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
