# Database and Data Safety

## Non-negotiable rules

- Do not access `.env` by default. The exceptions are (a) an explicitly requested repair of named values and (b) the disposable testing-account workflow below. The owner-authorized live E2E workflow below uses the existing authenticated session and does not authorize `.env` access. Existing local configuration is private; production secrets belong in provider dashboards.
- Treat `DATABASE_URL` as an application/pooler connection, `DIRECT_URL` as the direct migration connection, and `DATABASE_URL_DEV` as the development branch. Shell variables override dotenv values, so target identity must be verified rather than assumed.
- Never run `prisma migrate reset`, `prisma db push --force-reset`, any `--force-reset` command, manual destructive SQL, or data deletion against production.
- Do not run any Prisma migration, seed, reset, push, or data-mutation command merely as validation. Database operations require task scope, explicit human authorization, verified target identity, and a rollback/recovery plan.
- A command named `dev` is not proof of safety. Verify the actual endpoint before destructive development-database work.

## Scenario: repair stale local database connection values

### 1. Scope / Trigger

This exception applies only when the user explicitly asks to repair named database connection values in an existing Git-ignored local `.env`. It does not authorize creating an environment file, inspecting unrelated values, rotating credentials, changing provider-managed configuration, or reusing the values in another project.

### 2. Signatures

- Allowed local target: the repository-root `.env` only when `git check-ignore .env` succeeds and the file already exists.
- Allowed keys: only the user-named database connection keys, normally `DATABASE_URL`, `DIRECT_URL`, or `DATABASE_URL_DEV`.
- Allowed source: an authenticated provider CLI or dashboard for the target project and branch identified during the repair.

### 3. Contracts

- Verify the provider project, branch, database, and connection role without printing a connection string before updating the file.
- Parse and replace only the named assignments; preserve every unrelated line byte-for-byte where practical.
- Keep fetched values in process memory, suppress command output that could contain them, and never place them in shell history, logs, chat, tracked artifacts, or plaintext backup copies.
- Do not rotate or mint credentials unless the user separately and explicitly requests rotation.
- After repair, report only which key names changed and whether a redacted, non-mutating connection check passed.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| `.env` is absent or not Git-ignored | Stop; do not create or modify it. |
| Requested key is not explicitly named or is unrelated to database connectivity | Stop and request narrower authorization. |
| Provider project/branch/database is ambiguous | Stop before fetching or writing a value. |
| Provider CLI would print a secret into captured output | Use a non-printing path or stop. |
| Targeted assignment is absent | Stop unless the user explicitly authorizes adding that named key. |
| Redacted connection verification fails | Leave the repaired value in place only if it came from the verified provider source; report the failure without exposing the value. |

### 5. Good/Base/Bad Cases

- Good: the user names `DATABASE_URL` and `DIRECT_URL`; the authenticated Neon CLI confirms the intended project and production branch; an in-memory script replaces exactly those existing assignments and a redacted Prisma status check succeeds.
- Base: no `.env` repair was requested, so agents do not inspect the file.
- Bad: print the file, dump provider CLI output, copy `.env` for backup, replace every URL-like value, create a missing `.env`, or rotate a password as part of repair.

### 6. Tests Required

- Assert `.env` exists and `git check-ignore .env` succeeds before access.
- Assert every requested key already occurs exactly once and every replacement value is non-empty before writing.
- Assert the rewrite changes only the authorized key assignments without emitting old or new values.
- Run only a non-mutating, target-verified connectivity or migration-status check and expose no connection details.

### 7. Wrong vs Correct

#### Wrong

```bash
cat .env
cp .env .env.backup
```

This exposes unrelated secrets and creates another plaintext copy.

#### Correct

Use a non-logging process that validates the existing ignored file, obtains the authorized values from the verified provider target in memory, replaces only the named assignments, and reports key names plus redacted verification results.

## Scenario: disposable production testing account

### 1. Scope / Trigger

This exception applies only when the policy owner explicitly requests a disposable account for authenticated production UI verification. It permits one clearly labeled test identity, temporary local credential storage, and direct database management limited to that identity. It does not authorize general production data editing, credential rotation, or access to another user's records.

### 2. Signatures

```text
local repository `.env` keys:
PERKS_TEST_EMAIL=<dedicated test email>
PERKS_TEST_PASSWORD=<random test password>
```

```text
allowed database scope: User with the exact test email, plus rows whose owner
foreign key is that User.id; cleanup may delete only that test-owned graph.
```

### 3. Contracts

- Before access, verify `.env` is repository-local and Git-ignored (`git check-ignore .env`). Creating it is allowed only when that check succeeds; never create a backup or copy.
- The policy owner must explicitly authorize the test account and its exact email. Use a disposable, non-personal address and a newly generated password; do not reuse a real user's credentials.
- Read or write only `PERKS_TEST_EMAIL` and `PERKS_TEST_PASSWORD`. Keep values in process memory or the local ignored file; never print, log, commit, screenshot, or send them.
- Verify the exact production project, branch, database role, and recovery/stop conditions immediately before any direct database operation. Prefer UI signup for account creation; direct SQL/Prisma is permitted only for the exact test user and test-owned rows.
- Direct management may create fixtures, inspect aggregate test-owned state, and remove the complete test-owned graph. It must not query, update, or delete records belonging to other users, and it must stop on an ownership or uniqueness mismatch.
- Remove the account and its test-owned rows after verification unless the owner explicitly requests retention. Report only aggregate outcomes and key names, never credential values or row data.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| `.env` is absent or not Git-ignored | Stop; do not create or access it. |
| Either dedicated test key is missing, duplicated, or unrelated keys would be touched | Stop before reading or writing. |
| Email is personal, already used by a non-test account, or authorization is ambiguous | Stop; do not create or mutate an account. |
| Production target identity or recovery state cannot be verified | Stop before database access. |
| Any selected row is not owned by the exact test user | Roll back and stop; do not widen the query. |
| Cleanup finds unexpected dependents or multiple matching users | Stop and preserve state for review. |
| Credential or row value would appear in output/evidence | Redact it and fail the operation. |

### 5. Good / Base / Bad Cases

- **Good:** The owner authorizes a disposable address, the ignored `.env` contains only the two dedicated keys, the verified production target is used, and all DB operations are constrained by the exact test-user ID.
- **Base:** The account is created through the UI, browser verification completes, and the account is deleted afterward with aggregate-only evidence.
- **Bad:** Create `.env` in an unignored checkout, store a real user's password, query by a broad email pattern, edit production rows outside the test-user graph, or print credentials in a command log.

### 6. Tests Required

- Assert `.env` ignore status and exact single occurrence of both dedicated keys before access.
- Assert generated credentials are non-empty, non-personal, and never emitted to stdout/stderr.
- Assert database queries include the exact test email/User.id owner scope and reject cross-user rows.
- Assert account creation, fixture writes, and cleanup affect only the test-owned graph; verify aggregate counts before/after.
- Run the narrowest authenticated browser checks and record only pass/fail and aggregate results.

### 7. Wrong vs Correct

#### Wrong

```bash
echo "EMAIL=$REAL_USER_EMAIL" >> .env
psql "$DATABASE_URL" -c "delete from \"User\" where email like '%test%'"
```

This stores a real credential and uses an unsafe broad production delete.

#### Correct

Use a newly generated `PERKS_TEST_EMAIL`/`PERKS_TEST_PASSWORD` pair in a verified ignored local `.env`, constrain every database operation to that exact email/User.id, and report only aggregate results.

## Scenario: owner-authorized live E2E verification

### 1. Scope / Trigger

This exception applies when the policy owner explicitly authorizes the agent
to run a bounded end-to-end test through the currently authenticated browser
session. It removes the disposable-account requirement for that test lane, but
does not authorize credential access, account discovery by email, or operations
outside the one session-derived owner scope.

### 2. Signatures

```text
owner E2E scope:
source = authenticated application session
userId = server-derived exact owner id
purpose = amex-e2e
```

```text
allowed database scope: rows whose owner foreign key is the exact session-
derived User.id, plus explicitly created test fixtures linked to that user;
no email search or cross-user query is permitted.
```

### 3. Contracts

- Require explicit owner authorization for the bounded E2E purpose and verify the exact production project, database role, recovery point, and stop conditions immediately before any database operation.
- Derive `userId` from the authenticated server session or an exact owner-scoped application response. Do not search for, persist, or add the account email to task artifacts.
- Route normal AMEX test behavior through the existing authenticated browser/API flow. Direct database reads may verify only the scoped user's aggregate before/after state; direct writes are limited to reversible fixtures or recovery for rows already proven to belong to that user.
- Preserve the scoped pre-state and perform each fixture/recovery write transactionally. Never delete or rewrite pre-existing user rows merely to manufacture a proposal; cleanup may remove only rows created by the test or explicitly changed by it.
- Do not read `.env`, passwords, session tokens, provider responses, or raw request payloads. Keep evidence aggregate-only and retain only URL/method/status metadata where needed.
- The AMEX preview/confirmation contract, provider no-mutation boundary, bounded one-or-two-row owner canary, replay, rollback, and platform action-time confirmations remain in force.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| No authenticated session or more than one possible owner scope | Stop before reading or writing. |
| Production target, recovery point, or database identity is not verified | Stop before database access. |
| A query or mutation lacks the exact session-derived `userId` predicate | Reject it; do not broaden the scope. |
| Any selected row is not owned by the scoped user | Roll back the current transaction and stop. |
| Operation requests migration, seed, reset, schema change, or unrelated-user data | Reject it as outside this exception. |
| Pre-state differs from the reviewed test scope or an unexpected side effect appears | Stop and preserve recovery evidence; do not issue compensating writes automatically. |
| Output would contain email, credentials, tokens, raw observations, or row values | Redact it and fail the evidence gate. |

### 5. Good / Base / Bad Cases

- **Good:** The owner authorizes the AMEX E2E lane, the signed-in session resolves one user ID, the agent runs scan/preview/canary/replay/rollback, and database checks are limited to aggregate before/after counts for that user.
- **Base:** The browser flow completes but no write proposal is eligible; production remains `off` and no database mutation is attempted.
- **Bad:** Query production users by an email pattern, inspect `.env` for credentials, update another user's status, or alter data to manufacture or resize a canary proposal.

### 6. Tests Required

- Assert that owner scope is derived once from the authenticated session and is never selected by a broad email query.
- Assert every database read/write carries the exact owner predicate and rejects cross-owner rows before mutation.
- Assert pre-existing rows are preserved byte-for-byte outside the explicitly expected canary fields and that cleanup removes only test-created/changed rows.
- Assert no `.env`, credential, token, raw provider payload, or account email enters logs, artifacts, screenshots, or task evidence.
- Run the narrowest authenticated browser checks and report only sanitized aggregates plus URL/method/status metadata.

### 7. Wrong vs Correct

#### Wrong

```sql
UPDATE "BenefitStatus" SET "isCompleted" = true
WHERE "benefitId" = $1;
```

This can mutate another user's status and is not an owner-scoped test.

#### Correct

```text
Resolve the current session's exact User.id, verify the target and recovery
point, and perform only a transactionally scoped read/write whose predicates
include that User.id. Preserve the pre-state and emit aggregate evidence.
```

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

Because GitHub `main` deploys automatically, merging request-path code that parses, selects, joins, inserts, updates, or deletes a new database object is itself a production application release. Such code may merge only after the production migration gate has passed, or when a reviewed server capability defaults `off` and the complete `off` path is schema-independent: it must not import a generated delegate for the new object, reference the object in raw SQL, or execute a readiness probe that assumes the object exists. A friendly catch boundary does not make an unconditional missing-table query deployment-safe.

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
- Include `User`, `CreditCard`, card-owned and standalone `Benefit`, `BenefitStatus`, `CreditCardEvent`, `LoyaltyAccount`, `LoyaltyCertificate`, `ExternalCardMapping`, `AmexSyncAttempt`, `BenefitStatusSourceProvenance`, `AmexSyncRowAudit`, `GlobalBenefitCategoryRepair`, and `GlobalBenefitCategoryRepairOccurrence`.
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

## Scenario: category-drift repair database safety

### 1. Scope / Trigger

Use this contract for schema changes, database discovery, manifest preparation, apply, rollback, rehearsal, clone handling, or operational verification involving `GlobalBenefitCategoryRepair` and `GlobalBenefitCategoryRepairOccurrence`. The checked-in schema/migration is additive evidence design only. It does not authorize Prisma generation, migration deployment, database access, manifest generation, repair writes, cleanup, or production activity. There is no production authorization in this contract.

Production repair remains blocked until a separately authorized transition from the current AMEX capability to effective `off` is independently verified. A configured value, deployment record, or earlier observation does not satisfy the immediate database-side gate.

### 2. Signatures

```ts
interface CategoryRepairWriteGate {
  targetVerified: true;
  recoveryPointVerified: true;
  amexOffVerified: true;
  expectedInventoryFingerprint: string;
  expectedManifestFingerprint: string;
  expectedPageFingerprint: string;
  confirmation:
    | "APPLY_REVIEWED_CATEGORY_DRIFT_REPAIR"
    | "ROLLBACK_REVIEWED_CATEGORY_DRIFT_REPAIR";
}

runGlobalBenefitCategoryRepairOperator({
  mode, // discover | dry-run | rollback-preview | apply | rollback
  database,
  ...gate,
}): Promise<AggregateOnlyCategoryRepairReport>;
```

Private manifests and temporary fingerprints are operator inputs. They are never committed, logged, returned by public APIs, or retained in sanitized evidence.

The development rehearsal command is a separate explicitly authorized boundary:

```bash
npm run rehearse:global-benefit-category-repair:dev -- \
  --recovery-point-verified \
  --confirm=REHEARSE_CATEGORY_DRIFT_REPAIR_ON_VERIFIED_DEVELOPMENT
```

It reads `DATABASE_URL_DEV` directly from the process and never invokes dotenv, `with-dev-db`, Prisma CLI commands, or environment-variable reassignment. A private expected development host, database/schema/branch identity fingerprint, and branch fingerprint plus forbidden production host/branch fingerprints are mandatory process inputs and never output.

### 3. Contracts

1. The migration creates only new enums, tables, indexes, checks, and foreign keys. It alters, updates, backfills, deletes, or changes uniqueness on no existing row/table. Relations to canonical global definitions are restrictive; relations to user-owned source, ledger, owner, card, parent evidence, and keeper status cascade repair evidence so rolled-back history cannot permanently block normal lifecycle deletion.
2. Migration generation, SQL review, client generation, target migration status, development deployment, rehearsal, production deployment, and data repair are distinct gates. None implies the next.
3. Discover, dry-run, and rollback-preview database access still require explicit authorization and verified target identity. `rollback-preview` derives the reviewed rollback page authority without writes; a manifest-covered row that now has invalid evidence is reported as a closed aggregate stop rather than rejected as an uncovered page, while every currently safe row must remain manifest-authorized. No mode defaults to write.
4. Apply/rollback require an exact reviewed private manifest, bounded page, all expected fingerprints, exact mode phrase, immediate target verification, a verified recovery point, and independent effective-AMEX-off proof.
5. Every definition writes in one serializable transaction. Evidence and rollback preimages become durable before a loser deletion; any CAS, relation, fingerprint, or postimage mismatch rolls back the complete unit.
6. Parent evidence retains restrictive relations only to canonical global targets. User-owned legacy benefit, ledger, owner, and physical-card deletion cascades the parent; parent, owner, physical-card, and keeper-status deletion cascades occurrence evidence. Removed row IDs remain scalar because their rows may be absent. Authenticated mutation paths must reject these deletions while the matching repair is `APPLIED`; the database cascade exists for rolled-back lifecycle, not as an active-repair bypass.
7. JSON preimages are versioned and complete for restoration but remain private data. An absent rollback preimage/source is persisted as SQL `NULL`, never JSONB `null`, so database checks retain their intended meaning. CLI output exposes only mode, limit, `hasMore`, aggregate counts, action counts, and closed stop counts—never cursor payloads, fingerprints, IDs, manifests, or row values.
8. Rollback preserves mutable keeper state acquired after apply. It refuses new attachment/provenance/AMEX activity, source/cycle drift, occupied IDs/unique tuples, cleanup, catalog-key rebinding failure, or evidence mismatch.
9. Production and development operations use independently verified clients/targets. Never repoint an existing client by rewriting environment variables.
10. The sanitized single-user clone includes both repair tables; validates parent/source/ledger/card/keeper and every occurrence action/source/tuple relation; rejects destination status/ID/unique-key collisions; rebinds global targets and nested snapshot IDs by destination catalog key; preserves scalar removed IDs, timestamps, phases, fingerprints, and SQL-null preimages; and fails closed on zero/multiple/cross-product binding.
11. Replacement deletion order removes occurrence evidence before parent evidence and only then the replaceable user's ordinary graph. Insert order restores ordinary source/global-bound rows before parent and occurrence evidence.
12. Cleanup or dropping repair/preimage data is a new destructive boundary with its own retention/recovery design; it is not part of apply or rollback.
13. Portable repair fingerprints first validate exact environment-local global relations and catalog keys, then normalize those global database IDs to a catalog-bound marker inside graph/action/manifest inputs. They never normalize physical-card, source, ledger, status, cycle, or occurrence identity. This preserves authority across sanitized clone rebinding without weakening exact relation validation.
14. Occurrence evidence must be read, verified, cloned, and hashed in semantic tuple order—cycle start, cycle end, occurrence index, keeper status ID—rather than evidence-row UUID order.
15. Rehearsal input validation completes before client construction: exact PostgreSQL development URL host, distinct forbidden production host, exact 16-character expected database/schema/branch identity fingerprint, exact distinct 16-character branch fingerprints, exact confirmation, recovery attestation, and raw/effective AMEX `off`. The one client is then independently identified by existing database/schema/branch machinery. Missing repair tables fail before fixture creation, and identity is repeated immediately before setup/bootstrap/apply/replay/CAS/rollback/reapply/provenance writes/final rollback/cleanup.
16. The harness invents only `example.invalid` fixture data with in-memory IDs, selects one active writable AMEX global definition deterministically by catalog key, and never creates or deletes a global catalog row. It uses a first-page limit of one and fails if unrelated development data enters that bounded page. The placeholder ledger digest is replaced only after adapter `readBatch` and canonical `legacyBenefitSourceFingerprint` agree.
17. Normal completion and failure recovery delete only exact fixture-owned rows after proving repair evidence `ROLLED_BACK` or absent. If target verification, ordinary rollback, graph authority, or exact deletion counts fail, cleanup is reported incomplete. Active or invalid evidence is never force-deleted. No native database error, target value, URL, ID, email, key, cursor, fingerprint, manifest, or snapshot enters stdout/stderr.
18. Aggregate parity reads that intentionally span the complete repair graph run in one explicitly bounded `REPEATABLE READ` interactive transaction. They must set a parity-specific `maxWait` and timeout instead of inheriting the shorter process-wide request-path default. Recognizable Prisma transaction expiry is classified to one fixed safe timeout error; every other native database error remains the fixed generic safe database error.
19. A completed parity read with failed comparison gates is not a database failure. It returns or carries only the closed aggregate report (`mode`, booleans, counts, actions, and stop counts), exits nonzero, and never includes native errors or private authority. A timeout/unavailable database still emits no partial parity claim.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Migration SQL contains existing-table DML, destructive DDL, or changed status uniqueness | Reject SQL; do not deploy |
| Database target, branch, direct/application identity, or effective mode is uncertain | Stop before read/write; expose no infrastructure values |
| Discover/dry-run lacks database-access authorization | Skip; static tests are the only permitted evidence |
| Write lacks any gate or exact reviewed fingerprint | Reject before writer invocation |
| Effective AMEX is `preview`, `write`, malformed, or cannot be proven `off` | Reject apply/rollback |
| Unit re-plan/CAS/postimage differs | Roll back the unit; continue only under reviewed stop policy |
| Removed preimage is incomplete/unversioned, or an absent preimage is encoded as JSONB `null` | Block deletion or clone insertion; require a complete object or SQL `NULL` |
| Active repair source/card/status/account deletion reaches an application mutation path | Reject before database mutation; do not invoke owned-evidence cascades |
| Rolled-back owner/card/source/ledger/status is ordinarily deleted | Cascade its dependent repair evidence; do not retain an orphan or permanent lifecycle block |
| Canonical global definition is deleted while evidence references it | Restrictive foreign key blocks deletion |
| Rollback would overwrite current keeper state or attached/provenanced rows | Refuse rollback |
| Clone catalog key resolves zero/multiple/cross-product targets, parent/occurrence relations are malformed, or an ID/destination tuple collides | Reject the complete clone |
| Complete parity snapshot exceeds its explicit transaction timeout | Stop the read and return the fixed safe parity-timeout error; do not emit partial gates or retry as a writer |
| Parity database read succeeds but one or more comparison gates fail | Emit the closed aggregate failure report and exit nonzero; do not collapse it into an opaque database error |
| Report would expose manifest, cursor payload, fingerprint, ID, row value, or target identity | Return a fixed safe error or aggregate-only report |

### 5. Good / Base / Bad Cases

- **Good:** Static migration tests prove only new structures, restrictive canonical-target references, and lifecycle-safe owned-evidence cascades. A separately authorized verified-development deployment/rehearsal later proves exact apply and rollback without touching production.
- **Good:** Apply stores parent evidence plus complete occurrence preimages, CAS-deletes one unattached loser, verifies protected-state parity, and commits one definition atomically.
- **Base:** A dry-run is needed but database access is not authorized. It is reported skipped, not passed; schema and SQL tests may still run.
- **Bad:** Treat `prisma validate`/generation as deployment evidence, run production discovery because it is read-only, print private fingerprints, or change AMEX from `write` to `off` without a separate authorized configuration/deployment verification.

### 6. Tests Required

Assert migration SQL has no existing-table DML/destructive DDL/uniqueness change; Prisma relation/index/enum parity; restrictive canonical-card/benefit targets; cascading user-owned source/ledger/owner/card/parent/keeper evidence; active-phase application deletion rejection and rolled-back lifecycle deletion; scalar removed IDs; versioned JSON baseline/preimage/audit metadata and SQL `NULL` for absent clone preimages; exact tuple uniqueness; phase/action/source checks; no-writer defaults; read-only rollback-preview; target/recovery/effective-off/phrase/fingerprint gates; serializable evidence-before-delete and rollback-on-failure; aggregate-only redaction; explicit parity `REPEATABLE READ` max-wait/timeout options; fixed timeout versus generic database error classification with native-detail redaction; closed aggregate/nonzero output for completed failed gates; semantic occurrence ordering; clone-portable catalog-bound fingerprint normalization; rollback current-state preservation and drift stops; clone inclusion/counts/deletion-insertion order/catalog-key rebinding/parent-occurrence validation/collision handling; and truthful skip reporting. Database deployment/rehearsal tests are separate, explicitly authorized verified-development work and never routine implementation checks.

### 7. Wrong vs Correct

```ts
// Wrong: schema completion is treated as permission to inspect and repair production.
await execa("prisma", ["migrate", "deploy"]);
await runGlobalBenefitCategoryRepairOperator({ mode: "apply", database });
```

```ts
// Correct: implementation stops at additive SQL and static evidence. A later
// operation must independently establish every target/recovery/mode gate.
const report = await runGlobalBenefitCategoryRepairOperator({
  mode: "apply",
  database: independentlyVerifiedTarget,
  targetVerified: true,
  recoveryPointVerified: true,
  amexOffVerified: true,
  expectedInventoryFingerprint: reviewed.inventory,
  expectedManifestFingerprint: reviewed.manifest,
  expectedPageFingerprint: reviewed.page,
  confirmation: "APPLY_REVIEWED_CATEGORY_DRIFT_REPAIR",
});
```
