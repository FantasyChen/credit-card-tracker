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

`npm run build` runs Prisma client generation and Next build, but it must never deploy migrations. Migration deployment is an explicit, separately authorized operation (`npm run db:prod:migrate`) performed only after immediate target and recovery verification. A generic local, CI, preview, or production build must have no database mutation authority.

### Schema-dependent deployment completeness

A feature is not deployment-ready merely because `schema.prisma`, TypeScript, `prisma validate`, or `prisma generate` succeeds. Before application code reads new columns, relations, enums, or models:

1. generate the additive migration only under separate authorization against a verified development target;
2. review and check in its SQL, including null compatibility, existing-data constraints, indexes, cascades, and destructive/table-rewrite behavior;
3. separately authorize and validate Prisma client generation;
4. verify the intended target's migration status and apply only under target-specific authorization; and
5. keep the feature's server capability `off` until every prerequisite has evidence.

`prisma generate` creates no database object. A generated client plus a schema diff without a checked-in migration leaves deployment blocked. The generic build deliberately does not run `prisma migrate deploy`, so a completed build is never proof that a migration was applied. Report generation, SQL review, client validation, target verification, and deployment as distinct passed/failed/skipped gates.

## Migration-history caveat

The checked-in migration history does not currently replay cleanly on an empty database: three January 2025 migrations sort before the initial schema migration, and the first two try to create indexes on tables that have not yet been created. The third is defensive cleanup, but its position does not repair the earlier failure. `docs/supabase-fallback.md` is the authoritative emergency procedure. Do not improvise with reset/force-reset or treat the fallback procedure as preservation of existing user data.

## Recovery and rollback

- Preserve user data before any approved production schema/data operation; Neon point-in-time recovery and explicit migration backups are recovery tools, not substitutes for review.
- Stop immediately after an unexpected production effect. Do not issue compensating writes until the impact and recovery point are understood.
- Supabase fallback requires a Neon export/restore before cutover unless the user explicitly accepts temporary loss of access to existing data. Keep old credentials and the latest dump until cutover is verified.

## Scenario: sanitized single-user production-to-development clone

### 1. Scope / Trigger

Use this operator only to prepare an explicitly authorized development test account from one exact production email. Production is a read-only source; the reviewed Neon development branch is the only write target. It is not a general backup, environment copy, account migration, or production writer.

### 2. Signatures

```bash
npm run clone:amex-user:dev -- --email=<normalized-lowercase-email> \
  [--dry-run | --apply] [--target-verified] \
  [--confirm="CLONE PRODUCTION USER <email> TO DEVELOPMENT"] \
  [--replace-confirm="REPLACE DEVELOPMENT USER <email>"]
```

```ts
runSingleUserCloneOperator({
  email,
  mode?,                    // defaults to "dry-run"
  targetVerified?,          // required true for apply
  applyConfirmation?,       // exact email-bound phrase
  replacementConfirmation?,// separately required when destination email exists
  source,
  destination,
}): Promise<UserCloneReport>;
```

Environment inputs are existing `DATABASE_URL` for production and `DATABASE_URL_DEV` for development. The CLI constructs independent Prisma clients; it must never rewrite one environment value into the other.

### 3. Contracts

- Verify both configured PostgreSQL URLs and database-side identities before reading account data. The source must match the reviewed `ep-falling-butterfly` Neon endpoint role, the destination must match `ep-frosty-snowflake`, both branch fingerprints must be present, and source/destination fingerprints must differ.
- Match exactly one production `User.email` to the already-normalized lowercase input. Read the included graph in one `REPEATABLE READ`, explicitly read-only transaction.
- Include `User`, `CreditCard`, card-owned and standalone `Benefit`, `BenefitStatus`, `CreditCardEvent`, `LoyaltyAccount`, `LoyaltyCertificate`, `ExternalCardMapping`, `AmexSyncAttempt`, `BenefitStatusSourceProvenance`, and `AmexSyncRowAudit`.
- Omit `Account`, `Session`, `SearchAnalytics`, `EmailVerificationToken`, and `PasswordResetToken`. Set `User.password`, `CreditCard.cardNumber`, and `LoyaltyAccount.accountNumber` to null. Never select, copy, or report OAuth/session/reset/email tokens, hashes, analytics payloads, IPs, user agents, card digits, loyalty numbers, or arbitrary metadata.
- Preserve included record IDs only after checking model IDs and unique keys against the destination. Validate every owner and optional provenance/audit destination link; a malformed cross-user link fails the operation instead of being omitted.
- Rebind each loyalty account by exactly one destination `LoyaltyProgram.name`; never copy the source program ID.
- Apply in one `Serializable` development transaction. When separately authorized to replace an existing development account, delete its cards before its user, then insert the sanitized graph in dependency order. Recheck target identity, ownership, sanitization, counts, loyalty rebinding, and referential integrity before the transaction commits.
- A report contains only `production`/`development` role labels and aggregate included-table counts. It contains no email, target host/database/fingerprint, record ID, or copied row value.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| No mode flag | Dry-run; no destination mutation |
| Email is not already normalized lowercase or is invalid | Reject before database access |
| URL is not PostgreSQL, endpoint role mismatches, branch identity is missing, or targets resolve to the same branch | Reject before account cloning |
| Production email has zero or multiple exact matches | Reject; do not select a nearest/case-insensitive account |
| Destination email already exists without the separate replacement phrase | Reject before any write |
| Apply lacks `--target-verified` or the exact email-bound clone phrase | Reject before any write |
| Included row has a cross-user owner or invalid optional link | Reject the complete source graph |
| Source ID/unique key collides outside the replaceable destination user | Reject; never overwrite unrelated development data |
| Destination loyalty program has zero or multiple exact name matches | Reject before insertion |
| Any delete, insert, count, sanitization, ownership, or reference check fails | Roll back the complete Serializable transaction |
| A safe diagnostic/report would expose infrastructure or row data | Return a fixed safe error or role/count-only report |

### 5. Good / Base / Bad Cases

- **Good:** Dry-run identifies distinct reviewed branches, reads exactly one sanitized account graph, passes ownership and collision checks, and reports only projected per-table counts.
- **Good:** Apply has both exact confirmations, replaces only the approved development user in one transaction, verifies source-equivalent included counts and references, and commits.
- **Base:** The development email exists. Dry-run may inspect only after the explicit replacement gate, while apply remains blocked until replacement is separately authorized.
- **Bad:** Copy a production password hash, OAuth account/session, full card or loyalty number; print connection fingerprints; mutate production; use case-insensitive account selection; or delete an existing development user based only on the general clone confirmation.

### 6. Tests Required

Assert dry-run default/no writer call; exact normalized email lookup; reviewed PostgreSQL endpoint and distinct branch verification; missing/spoofed identity rejection; missing/multiple source users; sanitized selected/copied fields; complete included counts; inbound cross-user relationship detection; optional-link validation; destination email collision; separate replacement confirmation; outside-user ID/unique collision; exact loyalty-program rebinding; transaction deletion/insertion order; rollback on any failure; post-write count/ownership/reference verification; and role/count-only report/error redaction.

### 7. Wrong vs Correct

#### Wrong

```ts
// Reuses production credentials, copies secrets, and deletes without a separate gate.
process.env.DATABASE_URL = process.env.DATABASE_URL_DEV;
const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
await prisma.user.upsert({ where: { email }, create: user!, update: user! });
```

#### Correct

```ts
const report = await runSingleUserCloneOperator({
  email: "authorized@example.com",
  mode: "dry-run",
  source: independentReadOnlySource,
  destination: independentlyVerifiedDevelopmentTarget,
});
// Apply is a separate operation with targetVerified, the exact clone phrase,
// and a separate email-bound replacement phrase when the dev user exists.
```
