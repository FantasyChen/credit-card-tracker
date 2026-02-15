# Safe Migration Guide (Neon Dev + Prod)

This project uses Neon PostgreSQL with two database URLs:

- `DATABASE_URL`: production (main branch)
- `DATABASE_URL_DEV`: development branch

## Golden Rules

- Always test migrations on `DATABASE_URL_DEV` first.
- Never run destructive commands on shared/prod DBs:
  - `npx prisma migrate reset`
  - `npx prisma db push --force-reset`
- Prefer `prisma migrate deploy` for applying existing migration files.

## Standard Workflow

```bash
# 1) Verify current target
node scripts/check-database-connection.js

# 2) Apply migrations to dev
DATABASE_URL="$DATABASE_URL_DEV" npx prisma migrate deploy
DATABASE_URL="$DATABASE_URL_DEV" npx prisma migrate status

# 3) Apply migrations to prod when approved
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$DATABASE_URL" npx prisma migrate status
```

## If a Migration Fails Mid-Deploy

Typical causes in older environments:
- object already exists (table/index/enum value/constraint)
- object does not exist but migration assumes it does

### Recovery pattern

1. Make migration SQL idempotent:
   - use `IF EXISTS` for drops/alters on optional objects
   - use `IF NOT EXISTS` for creates/adds/indexes
   - guard enum additions and constraints via `DO $$ ... IF NOT EXISTS ... $$`
2. Mark failed migration as rolled back:
   ```bash
   DATABASE_URL="<target>" npx prisma migrate resolve --rolled-back <migration_name>
   ```
3. Re-run deployment:
   ```bash
   DATABASE_URL="<target>" npx prisma migrate deploy
   DATABASE_URL="<target>" npx prisma migrate status
   ```

## Quick Verification Commands

```bash
DATABASE_URL="$DATABASE_URL_DEV" npx prisma migrate status
DATABASE_URL="$DATABASE_URL" npx prisma migrate status
```

Expected healthy output:
- `Database schema is up to date!`
