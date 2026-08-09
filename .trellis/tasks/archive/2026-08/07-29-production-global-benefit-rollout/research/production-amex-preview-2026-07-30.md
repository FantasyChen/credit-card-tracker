# Sanitized production AMEX preview verification — 2026-07-30

## Authorization and scope

The user selected the zero-write production preview boundary. This authorized publishing sanitized deployment evidence, provisioning a production AMEX HMAC key, setting mode to `preview`, redeploying, and issuing one controlled authenticated synthetic preview verification. It did not authorize a userscript installation or publication, provider scan, confirmation request, benefit-status write, cleanup, or production write mode.

## Configuration and deployment

- Production `AMEX_SYNC_MODE` is configured as the exact newline-free value `preview`.
- A fresh production `AMEX_SYNC_HMAC_KEY` was generated in shell memory and sent directly to Vercel as a sensitive environment variable. It was not printed, written to the repository, or retained in a pulled environment file.
- Both variable names are registered for the production environment.
- The preview-configured deployment reached `Ready` in the production target.
- The primary production domain initially remained attached to the preceding Ready deployment, so the first authenticated endpoint request failed closed with HTTP 503 `sync_off` and made no database writes.
- Vercel's promotion command completed but did not move this project's custom primary-domain alias. The existing alias was therefore pointed explicitly at the already verified latest Ready production deployment, and deployment-ID comparison then proved they matched.

## Synthetic authenticated verification

The verification used a fresh nonexistent synthetic user identity, a 120-second synthetic NextAuth JWE, an invented five-digit ending, one synthetic card, and zero benefit rows. No real account, browser session, provider data, userscript, AMEX scan, or confirmation endpoint was used.

The successful response had only these sanitized properties:

- HTTP status: 200;
- mode: `preview`;
- proposal rows: 0;
- card skips: 0, because the fresh nonexistent synthetic identity owned no destination cards;
- signed proposal token: present;
- proposal expiry: present;
- cache policy: private and no-store;
- referrer policy: no-referrer.

The JWT, proposal token, HMAC, NextAuth secret, production URL, synthetic identity, deployment identifiers, raw response body, and raw headers were never emitted or retained.

## Zero-write proof

Immediately before and after the successful request, synthetic-user-scoped counts were zero and exactly unchanged across:

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

The earlier fail-closed request also left the same scoped counts unchanged. No confirmation endpoint was called, so no status, attempt, audit, or provenance mutation was authorized or performed.

## Current gate

Production AMEX now resolves to `preview`, and the authenticated deployed preview endpoint has passed its zero-write gate. Cleanup, userscript installation/publication, live provider scanning, and `write` mode remain separate unapproved boundaries. A preview-mode proposal cannot authorize a later write-mode confirmation.
