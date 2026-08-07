# Design: Resolve dependency release warnings

## Update Strategy

Use explicit package selections instead of automatic audit remediation. Start with the direct owners of critical/high findings and the coupled toolchains:

- Next toolchain: `next`, `@next/swc-wasm-nodejs`, and `eslint-config-next` at 15.5.23.
- Auth: `next-auth` 4.24.15 and `@auth/prisma-adapter` 2.11.3.
- HTTP client: `axios` 1.19.0.
- Prisma toolchain: `prisma` and `@prisma/client` 6.19.3.
- Lint runtime: latest compatible ESLint 9 release if required to remove the direct advisory.

After the first lockfile resolution, inspect remaining advisory paths. Add only compatible direct/transitive updates or narrowly justified `overrides` when the owning package permits them and verification proves compatibility. Do not cross a major-version boundary to chase a report count.

## Compatibility

No source or schema behavior is intentionally changed. Auth, App Router, Prisma schema, and API contracts remain intact. Coupled packages are version-aligned to reduce generated/runtime mismatch risk.

## Operational Safety

Run local dependency installation with `--ignore-scripts`; the repository `postinstall` invokes `prisma generate`, which is outside the local verification authorization. Do not build or run database-backed checks. GitHub CI may execute its repository-defined install/build workflow as part of the separately authorized CI delivery child.

## Rollback

Dependency changes live in a standalone commit. If tests or CI reveal incompatibility, revise or revert that commit before merge without touching the completed architecture commits.
