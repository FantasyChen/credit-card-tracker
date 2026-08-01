# Sanitized production AMEX write activation — 2026-07-31

## Authorization and scope

After reviewing the authenticated zero-write preview evidence, the user explicitly selected **Enable write, no confirm**. This authorized changing the verified production AMEX mode to `write`, provisioning the required production-project HMAC, redeploying, and verifying runtime effectiveness without confirmation. It did not authorize userscript installation or publication, a provider scan, a real-account proposal, the confirmation endpoint, a benefit-status mutation, cleanup, or compensating writes.

## Immediate target verification

- The repository was on clean `main`, and the generic build remained migration-free.
- The first preflight correctly stopped because the repository's local Vercel link was not the project serving the production primary domain. No configuration changed during that failed precondition check.
- An isolated temporary Vercel link then verified the exact production project, Ready primary alias, and currently served deployment without modifying the repository's local Vercel link.
- The production project did not expose explicit AMEX variable registrations through its project environment listing. No secret was copied or inferred from the differently linked project.
- A fresh HMAC was generated in shell memory and registered directly on the verified production project as sensitive. It was never printed, persisted, or written to a pulled environment file.
- `AMEX_SYNC_MODE` was registered as the exact newline-free value `write`.

## Deployment and rollback

- The currently served Ready preview deployment was retained as the rollback target.
- The same reviewed source revision was rebuilt for the production target after the production-project variables were registered; the retained immutable deployment remained unchanged.
- The new deployment reached Ready, and deployment-ID comparison proved that the primary production alias served it.
- No schema migration, catalog operation, legacy migration, cleanup, seed, reset, userscript action, browser action, provider action, or database mutation occurred during configuration and deployment.

## Authenticated no-confirm verification

Runtime effectiveness was verified with a fresh nonexistent synthetic identity, a 120-second synthetic NextAuth JWE, an invented five-digit ending, one synthetic card, and zero benefit rows. The preview endpoint was called once; the confirmation endpoint was never called.

The successful response had only these sanitized properties:

- HTTP status: 200;
- mode: `write`;
- proposal rows: 0;
- card skips: 0 because the synthetic identity owned no destination cards;
- signed proposal token: present;
- proposal expiry: present;
- cache policy: private and no-store;
- referrer policy: no-referrer.

The JWT, proposal token, HMAC, NextAuth secret, production URL, synthetic identity, deployment identifiers, database identity, raw response body, and raw headers were never emitted or retained.

## Zero-write proof

Immediately before and after the request, synthetic-user-scoped counts were zero and exactly unchanged across:

- `User`;
- `Account`;
- `Session`;
- `CreditCard`;
- `Benefit`;
- `BenefitStatus`;
- `ExternalCardMapping`;
- `AmexSyncAttempt`;
- `BenefitStatusSourceProvenance`;
- `AmexSyncRowAudit`.

No proposal was confirmed, so no attempt, row audit, provenance, or status mutation was authorized or performed.

## Current gate

Production AMEX now resolves to `write`, and the deployed preview endpoint proves the runtime received that mode while remaining zero-write without confirmation. Userscript installation/publication, live provider scanning, real-account proposal review, and the first bounded confirmation remain separate unperformed boundaries. Cleanup also remains separately gated.
