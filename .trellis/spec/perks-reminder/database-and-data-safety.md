# Database and Data Safety

## Non-negotiable rules

- Do not read, create, or modify `.env`. Existing local configuration is private; production secrets belong in provider dashboards.
- Treat `DATABASE_URL` as an application/pooler connection, `DIRECT_URL` as the direct migration connection, and `DATABASE_URL_DEV` as the development branch. Shell variables override dotenv values, so target identity must be verified rather than assumed.
- Never run `prisma migrate reset`, `prisma db push --force-reset`, any `--force-reset` command, manual destructive SQL, or data deletion against production.
- Do not run any Prisma migration, seed, reset, push, or data-mutation command merely as validation. Database operations require task scope, explicit human authorization, verified target identity, and a rollback/recovery plan.
- A command named `dev` is not proof of safety. Verify the actual endpoint before destructive development-database work.

## Changes and migrations

1. Change `prisma/schema.prisma` and create migration files against the verified development database.
2. Review generated SQL for destructive behavior and compatibility with existing data.
3. Validate on development before production.
4. Production `migrate deploy` or seed/upsert is allowed only when the user explicitly requests that production operation and the target has been verified immediately beforehand.
5. Preserve completed, not-usable, and partially used benefit statuses during repair/migration work. Use dry-run and transaction/backup support where provided.

`npm run build` is not a harmless compile check: it runs `prisma generate`, attempts `prisma migrate deploy`, and then runs Next build. Do not use it without authorization and a verified database target.

## Migration-history caveat

The checked-in migration history does not currently replay cleanly on an empty database because three January 2025 migrations sort before the initial schema migration while assuming its tables exist. `docs/supabase-fallback.md` is the authoritative emergency procedure. Do not improvise with reset/force-reset or treat the fallback procedure as preservation of existing user data.

## Recovery and rollback

- Preserve user data before any approved production schema/data operation; Neon point-in-time recovery and explicit migration backups are recovery tools, not substitutes for review.
- Stop immediately after an unexpected production effect. Do not issue compensating writes until the impact and recovery point are understood.
- Supabase fallback requires a Neon export/restore before cutover unless the user explicitly accepts temporary loss of access to existing data. Keep old credentials and the latest dump until cutover is verified.
