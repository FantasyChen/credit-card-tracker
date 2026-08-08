# Dependency remediation evidence

Recorded 2026-08-07 on the dependency-remediation worktree. No `.env`, Prisma, database, build, deployment, provider, cron, email, notification, or production operation was run.

## Baseline

- `npm audit --json`: 30 findings (4 critical, 17 high, 3 moderate, 6 low).
- `npm ls next @next/swc-wasm-nodejs eslint-config-next prisma @prisma/client --all`: Next `15.5.11`, SWC `15.5.7`, `eslint-config-next` `15.3.0`, Prisma/client `6.16.3`.
- Direct high/critical owners were `@auth/prisma-adapter`, `axios`, `next`, `next-auth`, and `prisma`; ESLint had a low advisory.

## Applied changes

`package.json` and `package-lock.json` were updated with the reviewed same-major selections:

- `@auth/prisma-adapter` `^2.11.3`
- `axios` `^1.19.0`
- `next` `^15.5.23`
- `@next/swc-wasm-nodejs` `^15.5.23`
- `eslint-config-next` `15.5.23`
- `eslint` `^9.39.5`
- `next-auth` `^4.24.15`
- `@prisma/client` and `prisma` `^6.19.3`

Lockfile installation used `npm install --ignore-scripts`; no lifecycle script or Prisma generation ran.

## Final dependency checks

- `npm ls next @next/swc-wasm-nodejs eslint-config-next prisma @prisma/client --all`: passed; all requested framework/ORM entries resolve to Next/SWC/config `15.5.23` and Prisma/client `6.19.3`, with no invalid or extraneous entries.
- Explicit in-range transitive refreshes updated `brace-expansion`, `flatted`, `js-yaml`, `lodash`, `minimatch`, `nanoid`, `picomatch`, `tar`, and `ws` without overrides or parent-major changes.
- `npm audit --json`: 6 findings (1 critical, 4 high, 0 moderate, 1 low), down from 30. Exit status is `1` because the deferred Next/Auth major advisories remain.

## Residual advisory paths

These remain documented rather than hidden or force-remediated:

- `next@15.5.23` remains a direct high finding; npm's fix is `next@16.3.0` (major 16), outside this task.
- `next-auth@4.24.15` remains a direct high finding, with vulnerable optional peer `@auth/core@0.34.3`; the audit metadata offers no valid same-major v4 remediation (its suggested `4.24.7` is marked a major/unsafe change). A future Auth.js major decision is required.
- Next 15 pins `postcss@8.4.31` and selects `sharp@0.34.x`; those two nested high advisories require the Next major path reported by npm.
- The remaining low finding is `cookie` under the deferred `@auth/core` chain.

## Safe verification

- `npm test -- --runInBand`: passed (81 suites, 758 passed, 1 skipped).
- `npx tsc --noEmit --pretty false --incremental false`: passed.
- `npm run check:public-db`: passed.
- `npm run card-template:validate`: passed.
- `npm run check:amex-userscripts`: passed.
- `python3 ./.trellis/scripts/get_context.py --mode packages`: passed; single-repo `perks-reminder`/`frontend` layers discoverable.
- `git diff --check`: passed.
- Changed-source ESLint: skipped; only manifests/lockfile/evidence changed.
