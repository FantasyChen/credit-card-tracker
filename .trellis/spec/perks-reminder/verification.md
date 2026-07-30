# Verification

Choose checks by changed surface. Report commands as passed, failed, or skipped; an environmental or safety skip is not a pass.

## Safe static checks

| Change | Minimum safe checks |
| --- | --- |
| Trellis/spec migration | `python3 ./.trellis/scripts/get_context.py --mode packages`, context/phase parsing, adapter target checks, structured-config parsing, `git diff --check` |
| Public routes/catalog | `npm run check:public-db`, plus targeted route/component tests for changed behavior |
| Card-template intake | `npm run card-template:validate` |
| TypeScript/frontend changes | `npx tsc --noEmit --pretty false --incremental false`, plus targeted Jest files |
| Server Action mutation | targeted mocked action test covering auth, validation, ownership, success, failure, and revalidation |
| Documentation/config | parse changed JSON/YAML/TOML as applicable, link/path review, `git diff --check` |

## Public DB invariant scope

`npm run check:public-db` is a narrow static guard, not a transitive or runtime proof. `scripts/check-public-db-invariant.cjs`:

- checks a fixed list of anonymous page/component files for direct Prisma/auth imports and selected API fetches;
- checks a fixed list of public API files for module-scope Prisma/auth imports;
- confirms the build script does not run `prisma db seed`.

It does not follow imports, execute routes, prove that every anonymous surface is listed, or prove that a dynamically imported authenticated branch is unreachable anonymously. Review changed dependency paths and run targeted tests in addition to the script.

## Targeted Jest checks

Jest with the repository's global mocks is safe for narrow code paths that do not deliberately connect to external services. Examples:

```bash
npm test -- --runInBand src/components/__tests__/BenefitsDisplayClient.test.tsx
npm test -- --runInBand src/app/cards/__tests__/actions.test.ts
npm test -- --runInBand src/lib/__tests__/benefit-status-transitions.test.ts
```

Choose changed test files rather than the entire suite when a narrow result is sufficient. Report the exact files run.

## Conditional checks

- Next build, Prisma generate/migrate/seed/status/reset/push, database-backed audits, Vercel commands, cron calls, email/notification commands, and browser/live production checks are not generic validation. Run only when the task explicitly permits them and all target/side-effect prerequisites are satisfied.
- `npm run build` must remain migration-free, but it still performs Prisma client generation and a production Next build; do not use it as a routine pre-commit check.
- `npm run usage-guides:audit` directly creates a Prisma client using the current process environment; it does not use `scripts/with-dev-db.js`. Verify the non-production database target first.
- Frontend behavior should be rendered when practical, but never by weakening auth, caching, database, or external-effect safeguards.

## Review requirements

- Inspect the complete diff and all untracked paths, not only summary output.
- Scan for credentials, tokens, authorization headers, OAuth/session material, email addresses from runtime data, database URLs/hostnames, provider project state, browser data, migration backups, and `.env` content.
- Confirm public/static paths do not introduce Prisma imports or DB calls.
- For database changes, inspect migration SQL and current-user compatibility; for catalog changes, review immutable static keys/parents, key-preserving synchronization, retirement/reactivation, existing-card propagation, status materialization, and guide linkage together.
- Residual `.cursor`, Context Harness, or retired-script references must be either removed or explicitly classified as historical prose; no live command may depend on a removed path.
