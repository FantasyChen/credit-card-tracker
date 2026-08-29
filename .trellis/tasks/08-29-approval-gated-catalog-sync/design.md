# Technical design

## Boundary

Add one GitHub Actions workflow under `.github/workflows/` plus a small static
workflow validation test/script and operator documentation. Reuse
`npm run sync:global-catalog`; do not change catalog identity, Prisma schema, or
the synchronizer implementation.

## Flow

```text
push to main (catalog paths)
  -> dry-run job (read-only, aggregate artifact)
  -> protected `catalog-sync-production` environment
  -> apply job (manual approval, exact existing operator gates)
  -> aggregate result artifact
```

The dry-run job is automatic but still requires a verified runtime target before
database access according to the database-safety policy. The apply job uses a
GitHub Environment whose required reviewers are configured outside Git and must
not be bypassed by workflow inputs.

## Safety contracts

- The workflow never reads `.env` or prints connection values.
- Database credentials are GitHub Environment secrets. The command receives
  them through the process environment only.
- Dry-run defaults explicitly to `--dry-run`; apply passes
  `--apply --target-verified --confirm=SYNC_GLOBAL_CATALOG`.
- Any nonzero dry-run, conflict, missing secret, or failed apply stops the
  workflow. There is no automatic rollback or compensating write.
- The workflow reports counts and status only. Detailed operator output stays
  in the protected job log and is not uploaded as an artifact.

## Non-goals

- Automatically materializing user statuses or sending notifications.
- Running Prisma migrations, seed, build, cron, or deployment commands.
- Automatically approving or bypassing the protected environment.
