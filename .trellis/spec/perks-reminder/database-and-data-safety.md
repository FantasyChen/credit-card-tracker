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
3. Discover, dry-run, and rollback-preview database access still require explicit authorization and verified target identity. `rollback-preview` derives the reviewed rollback page authority without writes. No mode defaults to write.
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
| Report would expose manifest, cursor payload, fingerprint, ID, row value, or target identity | Return a fixed safe error or aggregate-only report |

### 5. Good / Base / Bad Cases

- **Good:** Static migration tests prove only new structures, restrictive canonical-target references, and lifecycle-safe owned-evidence cascades. A separately authorized verified-development deployment/rehearsal later proves exact apply and rollback without touching production.
- **Good:** Apply stores parent evidence plus complete occurrence preimages, CAS-deletes one unattached loser, verifies protected-state parity, and commits one definition atomically.
- **Base:** A dry-run is needed but database access is not authorized. It is reported skipped, not passed; schema and SQL tests may still run.
- **Bad:** Treat `prisma validate`/generation as deployment evidence, run production discovery because it is read-only, print private fingerprints, or change AMEX from `write` to `off` without a separate authorized configuration/deployment verification.

### 6. Tests Required

Assert migration SQL has no existing-table DML/destructive DDL/uniqueness change; Prisma relation/index/enum parity; restrictive canonical-card/benefit targets; cascading user-owned source/ledger/owner/card/parent/keeper evidence; active-phase application deletion rejection and rolled-back lifecycle deletion; scalar removed IDs; versioned JSON baseline/preimage/audit metadata and SQL `NULL` for absent clone preimages; exact tuple uniqueness; phase/action/source checks; no-writer defaults; read-only rollback-preview; target/recovery/effective-off/phrase/fingerprint gates; serializable evidence-before-delete and rollback-on-failure; aggregate-only redaction; semantic occurrence ordering; clone-portable catalog-bound fingerprint normalization; rollback current-state preservation and drift stops; clone inclusion/counts/deletion-insertion order/catalog-key rebinding/parent-occurrence validation/collision handling; and truthful skip reporting. Database deployment/rehearsal tests are separate, explicitly authorized verified-development work and never routine implementation checks.

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
