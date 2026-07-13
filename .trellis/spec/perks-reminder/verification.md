# Verification

Choose checks by changed surface. Report commands as passed, failed, or skipped; an environmental or safety skip is not a pass.

## Safe static checks

| Change | Minimum safe checks |
| --- | --- |
| Trellis/spec migration | `python3 ./.trellis/scripts/get_context.py --mode packages`, context/phase parsing, adapter target checks, structured-config parsing, `git diff --check` |
| Public routes/catalog | `npm run check:public-db` |
| Card-template intake | `npm run card-template:validate` |
| TypeScript-only changes | `npx tsc --noEmit --pretty false --incremental false` |
| Documentation/config | parse changed JSON/YAML/TOML as applicable, link/path review, `git diff --check` |

## Conditional checks

- Jest, Next build, Prisma generate/migrate/seed/status/reset/push, database-backed audits, Vercel commands, cron calls, email/notification commands, and browser/live production checks are not generic migration validation. Run only when the task explicitly permits them and all target/side-effect prerequisites are satisfied.
- `npm run build` can attempt a production migration and must not be used as a routine pre-commit check.
- `npm run usage-guides:audit` is database-backed through the dev wrapper; verify the database target first.
- Frontend behavior should be rendered when practical, but never by weakening auth, caching, database, or external-effect safeguards.

## Review requirements

- Inspect the complete diff and all untracked paths, not only summary output.
- Scan for credentials, tokens, authorization headers, OAuth/session material, email addresses from runtime data, database URLs/hostnames, provider project state, browser data, migration backups, and `.env` content.
- Confirm public/static paths do not introduce Prisma imports or DB calls.
- For database changes, inspect migration SQL and current-user compatibility; for catalog changes, review template, existing-user, and status-materialization paths together.
- Residual `.cursor`, Context Harness, or retired-script references must be either removed or explicitly classified as historical prose; no live command may depend on a removed path.
