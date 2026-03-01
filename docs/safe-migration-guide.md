# Safe Migration Guide (Neon Dev + Prod)

This project uses **Neon PostgreSQL** with two database branches:

| Variable | Branch | Host | Purpose |
|---|---|---|---|
| `DATABASE_URL` | main | `ep-falling-butterfly-...-pooler` | Production queries (pooler) |
| `DIRECT_URL` | main | `ep-falling-butterfly-...` (no pooler) | Production migrations (direct) |
| `DATABASE_URL_DEV` | dev | `ep-frosty-snowflake` | Development / testing |

> **Why two production URLs?** Neon's connection pooler doesn't support PostgreSQL advisory locks. `prisma migrate deploy` needs advisory locks, so it must use the direct (non-pooler) endpoint. Normal app queries use the pooler for better connection handling.

## Golden Rules

- **Always test migrations on dev first** before pushing to production.
- **Never run destructive commands on production:**
  - `npx prisma migrate reset`
  - `npx prisma db push --force-reset`
- Production migrations run automatically via `prisma migrate deploy` during Vercel builds.

## npm Scripts (Recommended)

```bash
# Check both databases at once
npm run db:check

# Development database operations
npm run db:dev:status     # Show migration status
npm run db:dev:migrate    # Apply pending migrations
npm run db:dev:seed       # Seed with predefined data
npm run db:dev:reset      # Reset dev DB (destroys dev data only)

# Production database (read-only check)
npm run db:prod:status    # Show migration status

# Run dev server against dev database
npm run dev:devdb
```

## Standard Development Workflow

```bash
# 1) Check current state
npm run db:check

# 2) Make schema changes in prisma/schema.prisma

# 3) Create migration on dev database
node scripts/with-dev-db.js npx prisma migrate dev --name your_migration_name

# 4) Test locally against dev database
npm run dev:devdb

# 5) When satisfied, commit and push
#    Vercel runs: prisma generate && (prisma migrate deploy || echo 'skipped') && next build
git add -A && git commit -m "feat: your changes" && git push
```

## Advanced: Direct Database URL Override

For one-off commands, use the `scripts/with-dev-db.js` helper:

```bash
# Run any Prisma command against the dev database
node scripts/with-dev-db.js npx prisma studio
node scripts/with-dev-db.js npx prisma db seed
node scripts/with-dev-db.js npx prisma migrate dev --name add_feature
```

Or use the shell variable override pattern:

```bash
DATABASE_URL="$DATABASE_URL_DEV" npx prisma migrate status
DATABASE_URL="$DATABASE_URL_DEV" npx prisma migrate deploy
```

## If a Migration Fails Mid-Deploy

Typical causes:
- Object already exists (table/index/enum value/constraint)
- Object does not exist but migration assumes it does

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
   ```

## Deployment Pipeline

The build command in `package.json` is:

```
prisma generate && (prisma migrate deploy || echo 'Migration deploy skipped') && next build
```

This means every Vercel deployment:
1. Generates the Prisma client
2. Applies any pending migrations using `DIRECT_URL` (non-pooler endpoint)
3. Falls back gracefully if the database is slow or `DIRECT_URL` is missing
4. Builds the Next.js application

The Prisma schema configures both endpoints:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // pooler — for app queries
  directUrl = env("DIRECT_URL")        // direct — for migrations
}
```

No manual migration steps are needed after pushing to main.
