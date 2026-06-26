# Supabase Fallback Runbook

Use this only if Neon remains unusable after public DB traffic has been removed and unused Neon branches/computes have been cleaned up.

## Guardrails

- Do not switch production to an empty Supabase database unless the user explicitly approves losing temporary access to existing user data.
- Preserve existing user data by exporting from Neon before cutover.
- Keep Supabase as PostgreSQL so Prisma, NextAuth, migrations, and seed data remain compatible.

## Prepare Supabase

1. Create a Supabase Free project.
2. Copy the pooled connection string into `DATABASE_URL`.
3. Copy the direct/session connection string into `DIRECT_URL`.
4. Run `npx prisma migrate deploy` against Supabase.
5. Run `npm run db:seed` against Supabase to create catalog and loyalty template data.

## Export Neon Data

Preferred path, once Neon is readable:

```bash
pg_dump "$NEON_DIRECT_URL" --format=custom --no-owner --no-acl --file=neon-backup.dump
pg_restore --dbname "$SUPABASE_DIRECT_URL" --clean --if-exists --no-owner --no-acl neon-backup.dump
```

If `pg_dump` and `psql` are unavailable locally, install PostgreSQL client tools or write a one-off two-connection Prisma/SQL script. Do not use destructive Neon commands.

## Verify Before Cutover

1. `DATABASE_URL="$SUPABASE_POOLER_URL" DIRECT_URL="$SUPABASE_DIRECT_URL" npm run db:check`
2. `DATABASE_URL="$SUPABASE_POOLER_URL" DIRECT_URL="$SUPABASE_DIRECT_URL" npx tsc --noEmit --pretty false`
3. Run a local production smoke test against Supabase:
   - sign in
   - add a card
   - view dashboard
   - view benefits
   - export data
4. Update Vercel `DATABASE_URL` and `DIRECT_URL` only after the smoke test passes.

## Rollback

Keep Neon credentials and the latest dump until Supabase production traffic is verified. If Supabase cutover fails before user writes occur, restore Vercel env vars to Neon and redeploy.
