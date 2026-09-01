# Deployment and External Effects

## Deployment ownership

- GitHub `main` deploys automatically through Vercel. Agents must not perform a manual production deployment unless the user explicitly requests it.
- The generic build command must not include `prisma migrate deploy`. Local, CI, Vercel Preview, and production builds generate the client and compile only; migration deployment is a separately authorized, target-verified operation. See [Database and Data Safety](database-and-data-safety.md).
- A merge to `main` is a production application release even when no one runs `vercel --prod`. Schema-dependent request-path code must not merge before its production migration, unless a reviewed default-off capability leaves the entire off path independent of the new tables, columns, enums, relations, and generated delegates. A successful build or friendly database-error fallback does not satisfy this gate.
- The production domains are served by the Vercel `coupon-cycle` project even though a local checkout may be linked to a different project. Never infer the production target from ignored `.vercel/project.json` alone.
- Provider environment values are managed in Vercel or other provider dashboards. Do not write secret values, project-local copies, or command output containing them to tracked files.

### Release/alias drift prevention

After every production deployment from `main`, verify the primary alias resolves
to that exact deployment ID before reporting the release live. A successful
GitHub/Vercel deployment check is not sufficient: a later rollback or manual
redeploy can silently move the alias to an older source tree. If a rollback is
intentional, record the rollback source commit and the capabilities it omits,
then re-run the release check before the next feature is announced.

For releases that include Prisma migrations, the migration status gate must be
completed before the application deployment is promoted. A Ready build without
the corresponding production migration is an incomplete release. Keep the
release and migration checks separate, aggregate-only, and repeatable so a
manual redeploy cannot hide a pending migration.

## Cron and notification safety

- `vercel.json` currently schedules `/api/cron/check-benefits` at `0 5 * * *` and `/api/cron/send-notifications` at `30 5 * * *`; both handlers export `maxDuration = 10`. Preserve those source-controlled contracts unless the task intentionally changes scheduling/runtime behavior. Provider plan limits and available cron slots are external state and must be verified in Vercel rather than asserted from the repository.
- Cron authorization uses `Authorization: Bearer <CRON_SECRET>`. Log authorization presence and aggregate counts, never the secret or recipient data.
- Never trigger notification/email endpoints against production data during testing. A non-production `mockDate` changes time selection but does not prevent email delivery.
- Do not send production announcement or notification batches without explicit authorization, dry-run evidence, recipient counts, a cap, and resumable/auditable state.
- Resend quota is recipient-based. One message with many recipients can consume one unit per recipient; do not infer safety from message count.

## Operational review

Before any Vercel, DNS, cron, email, or production-domain action:

1. identify the exact project, domain, database, and side effect;
2. preview without exposing secrets;
3. obtain authorization for the production action;
4. define rollback or stop conditions;
5. run the narrowest post-change check.

`docs/vercel-domains-and-deploy.md` and `docs/supabase-fallback.md` retain detailed operator procedures. Specs define the safety contract; do not duplicate or casually rewrite provider commands in unrelated changes.

## Scenario: public support email forwarding

### 1. Scope / Trigger

Use this contract when changing the public support address, its inbound forwarding destination, or the provider-managed mail records for `perks-reminder.com`. Inbound support forwarding is separate from Resend transactional delivery and from any hosted mailbox or branded-reply capability.

### 2. Signatures

```ts
// src/lib/site.ts
export const SUPPORT_EMAIL = 'support@perks-reminder.com';
```

```text
public alias: support@perks-reminder.com
provider: Spaceship Domain Manager email forwarding
destination: user-approved provider state; never checked in
```

### 3. Contracts

1. `support@perks-reminder.com` is the public inbound contact identity. Its private forwarding destination exists only in the provider account and authorized operator session.
2. Spaceship's individual forwarding rule owns inbound MX/SPF configuration. Do not replace nameservers or web records to create the alias.
3. Resend remains outbound transactional authority. Preserve its DKIM record, DMARC, `RESEND_API_KEY`, and provider-managed `FROM_EMAIL`; an inbound forwarding change does not authorize changing them.
4. Forwarding does not promise a hosted mailbox or branded replies. A later send-as/mailbox feature needs its own provider and authentication design.
5. Obtain action-time confirmation before submitting a rule, charge, DNS change, recipient verification, or test message. Never expose the private destination, credentials, provider identifiers, or message content in tracked evidence.
6. The checked-in contact constant changes only after the provider rule is ready. A push to auto-deploying `main` remains a separate production release action.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Domain/account is not exactly the established Perks Reminder owner | Stop before editing or submitting |
| Provider shows a charge or recurring plan | Report exact price/renewal terms and obtain purchase confirmation |
| Forwarding setup would replace Resend DKIM/DMARC or web records | Stop; do not submit |
| Destination appears in Git, task evidence, logs, or screenshots | Remove/redact it and fail the privacy gate |
| Test originates from the destination mailbox itself | Treat it as inconclusive because Gmail can deduplicate its own Message-ID |
| Distinct-sender test is searchable at the destination with the Inbox label | Accept inbound delivery as verified |
| MX/SPF exists but no independent message arrives | Keep the task open and inspect propagation/provider state; do not claim success |

### 5. Good / Base / Bad Cases

- **Good:** The exact Spaceship domain receives one individual support alias, preserves Resend and Vercel records, and an independent sender reaches the private destination Inbox.
- **Base:** Public DNS is correct but no distinct sender is available. Report DNS ready and delivery unverified rather than using a self-sent message as proof.
- **Bad:** Publish the private Gmail destination, create a catch-all rule, replace outbound authentication, or trigger production notification endpoints as a delivery test.

### 6. Tests Required

- Assert `SUPPORT_EMAIL` equals the public alias in a narrow unit test.
- Check public MX and SPF after the rule is active; separately confirm DMARC, Resend DKIM, and `www` / `loyalty` routing remain present.
- Send one uniquely titled message from a distinct user-controlled mailbox and verify it appears in the approved destination account with the Inbox label.
- Run safe TypeScript/test/diff checks. Do not build, deploy, access a database, or trigger cron/notification routes merely to validate forwarding.

### 7. Wrong vs Correct

```text
Wrong:
destination Gmail -> public alias -> same Gmail Sent/All Mail
  => claim forwarding works

Correct:
distinct sender -> public alias -> private destination Inbox label
  + MX/SPF present
  + Resend DKIM/DMARC and web routing preserved
  => inbound forwarding verified
```

## Scenario: production configuration deployment and alias verification

### 1. Scope / Trigger

Apply this contract whenever a production runtime capability depends on newly added or changed provider environment values. A deployment reaching `Ready` is necessary but does not prove that the primary production domain serves that deployment or receives those values.

### 2. Signatures

```text
printf %s <VALUE> | vercel env add <NAME> production --force [--sensitive]
vercel env ls production
vercel --prod --yes
vercel inspect <immutable-deployment-or-primary-alias>
vercel promote <immutable-deployment> --yes
vercel alias set <immutable-deployment> <existing-primary-alias>
```

`vercel promote` and `vercel alias set` are external production actions. Run them only inside an explicitly authorized deployment boundary. Use `alias set` only when deployment-ID inspection proves promotion did not move the existing primary alias.

### 3. Contracts

- Secret values use provider-sensitive storage and must never be printed, committed, copied into evidence, or inferred as absent merely because `vercel env pull` omits them.
- Exact finite configuration values must enter `vercel env add` without a trailing newline or carriage return. Use EOF-terminated stdin such as `printf %s preview`, not `echo preview` or `printf '%s\n' preview`; the current CLI can preserve the line terminator, and exact mode parsing then fails closed to `off` even though registration, deployment readiness, and alias identity all pass.
- Verify environment registration by name, target, and provider metadata; verify effectiveness through the narrowest runtime behavior that depends on the value.
- Resolve the intended public origin from the application's production-site contract, not from an immutable deployment URL or a regex that assumes the exported URL is a string literal.
- After deployment, inspect both the immutable Ready deployment and the primary alias. Their deployment IDs must match before the rollout is reported as live.
- A zero-write authenticated probe uses a fresh nonexistent synthetic identity, short-lived credentials, invented non-colliding input, same-origin headers, and before/after identity-scoped counts for every table the endpoint could mutate.
- Evidence contains only response status/mode, aggregate row counts, token-presence booleans, cache-policy booleans, and before/after equality booleans. It never contains raw URLs, IDs, tokens, secrets, headers, or response bodies.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Sensitive value is absent from a pulled environment file but registered as sensitive | Treat omission as expected; do not replace it with a non-sensitive value. |
| Exact mode input contains a trailing newline or carriage return | Treat the capability as effectively `off`; replace the provider value with no-line-terminator stdin, redeploy, and repeat the runtime probe. |
| Deployment is Ready but primary-alias deployment ID differs | Do not claim rollout success or diagnose runtime behavior from the alias as if it were current. |
| `promote` succeeds but IDs still differ | Stop; use an explicitly authorized `alias set` for the existing primary alias, then compare IDs again. |
| Authenticated capability probe returns fail-closed `503 sync_off` | Verify alias routing and runtime environment delivery; never weaken mode or secret validation. |
| Probe returns `401` | Inspect synthetic session encoding/cookie delivery without using a real session. |
| Probe returns same-origin rejection | Compare the exact configured public origin and request origin. |
| Probe succeeds but any scoped database count changes unexpectedly | Fail the gate and return the capability to its safe mode; do not issue compensating writes without review. |

### 5. Good / Base / Bad Cases

- **Good:** an exact finite value is written with `printf %s`, sensitive configuration is registered, a new deployment is Ready, the primary alias and immutable deployment IDs match, and one synthetic authenticated probe succeeds with exactly unchanged scoped counts.
- **Base:** the endpoint remains fail-closed because configuration is intentionally absent; no deployment or alias action is needed.
- **Bad:** `echo preview` writes a line-terminated mode, a Ready deployment is assumed live, the authenticated probe returns `sync_off`, and mode validation is weakened instead of correcting the provider value and redeploying.

### 6. Tests Required

- Unit-test capability configuration for exact allowed modes, missing values, short secrets, and newline-contaminated mode values.
- Unit-test preview/write separation so a preview proposal cannot authorize a write-mode confirmation.
- For an authorized production probe, assert the exact HTTP status and returned mode, aggregate row/skip counts, proposal-presence fields, private/no-store headers, and exact before/after equality across all potentially written tables.
- Record alias-to-deployment identity equality separately from deployment readiness; neither assertion substitutes for the other.

### 7. Wrong vs Correct

#### Wrong

```text
echo preview | vercel env add AMEX_SYNC_MODE production --force --sensitive
Ready deployment + registered env names => production capability is live
```

#### Correct

```text
printf %s preview | vercel env add AMEX_SYNC_MODE production --force --sensitive
registered env metadata
  + Ready immutable deployment
  + primary alias resolves to the same deployment ID
  + narrow runtime probe
  + exact zero-write before/after proof
  => production preview gate passes
```

## Scenario: category-repair production hold and rollout

### 1. Scope / Trigger

Use this contract whenever production schema deployment, repair discovery/apply/rollback, application release, AMEX configuration, first confirmation, or global-benefit cleanup could overlap with the category-drift repair. The repair implementation and checked-in migration grant no production authorization. The current production AMEX capability must be separately transitioned from `write` to effective `off` and verified on the primary alias before any repair write.

### 2. Signatures

```text
repair implementation complete
  -> reviewed additive migration
  -> verified-development deployment and rehearsal
  -> separate production hold approval
  -> AMEX off configuration + Ready deployment + primary-alias identity match
  -> authenticated/read-only effective-off proof
  -> separate schema deploy approval
  -> separate discovery/manifest review
  -> separate bounded repair apply approval
  -> parity and rollback evidence
  -> separate decision for later AMEX preview/write or global cleanup
```

```ts
interface ProductionCategoryRepairGate {
  requestPathSchemaReady: true;
  immutableDeploymentReady: true;
  primaryAliasDeploymentMatches: true;
  effectiveAmexMode: "off";
  targetVerified: true;
  recoveryPointVerified: true;
}
```

### 3. Contracts

**Incident record — 2026-08-04.** An automatically deployed `main` release began
reading the new `GlobalBenefitCategoryRepair` relation from authenticated
request paths before the additive production migration had been applied.
PostgreSQL returned `42P01` (`relation "GlobalBenefitCategoryRepair" does not
exist`), so authenticated dashboard/effective-benefit reads failed while
database-free public routes remained available. The release was Ready because
the build generated the Prisma client and compiled the app, but did not prove
that the migration was present. Recovery used the last schema-compatible
deployment; this record authorizes no database or provider action.

1. First live AMEX confirmation and global-benefit cleanup remain blocked while the category-repair child is incomplete or any production repair/parity gate is pending.
2. Moving AMEX from current `write` to `off` is a separately authorized provider configuration and deployment action. Do not infer effectiveness from environment registration or a Ready immutable deployment.
3. Effective `off` requires primary alias and immutable deployment ID equality plus the narrowest authenticated/read-only runtime behavior proving confirmation cannot proceed. Evidence exposes no URL, token, secret, user, card, or provider data.
4. Application release, schema deploy, database discovery, private manifest review, apply, rollback, cleanup, and later AMEX reactivation are separate approvals with separate stop conditions.
5. Production schema deploy occurs only after checked-in additive SQL, static invariants, verified-development deployment, exact apply/rollback rehearsal, recovery evidence, and target verification pass.
6. Private manifests, cursor payloads, fingerprints, database identities, and row values remain outside Git, console output, and sanitized rollout records. The repair CLI emits only mode, limit, `hasMore`, aggregate counts, action counts, and closed stop counts; sanitized operational records may retain those aggregates plus boolean gate results.
7. Apply proceeds in bounded reviewed pages and stops on any fingerprint, parity, target, mode, deployment, or postimage drift. No operational workaround may relax classification or occurrence matching.
8. Rollback is not an automatic response to a failed unit. Stop, preserve the recovery point, and decide between evidence-scoped rollback, forward repair, or database recovery after impact review.
9. Successful repair does not automatically re-enable AMEX or authorize a confirmation. Re-enable preview/write only through the existing production configuration deployment and proposal review gates.
10. Successful repair does not authorize strict-ledger cleanup or bulk deletion of category repair evidence/preimages. Those remain independent destructive boundaries. Ordinary user-owned lifecycle deletion after rollback may cascade its dependent evidence, while canonical global target deletion remains restrictive.
11. Before schema deployment, review must prove active repair deletion is application-blocked and rolled-back evidence cannot permanently block user/card/status lifecycle; deployment must not substitute unconditional restrictive owned-data foreign keys for that phase-aware runtime policy.
12. Because `main` auto-deploys, category-repair request paths that reference the repair tables must not merge or be promoted while those tables are absent. The allowed alternatives are: deploy the reviewed additive migration first under its separate gate, or keep the code behind a reviewed default-off capability whose off path contains no repair-table delegate or raw-SQL reference. If an incompatible application release reaches the primary alias, stop new deployments and roll the alias back to the last schema-compatible deployment before continuing the rollout.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Category repair implementation or verified-development rehearsal incomplete | Keep confirmation and cleanup blocked; no production repair |
| Production AMEX still resolves to `write`/`preview` or is uncertain | Do not run repair apply/rollback |
| Off-configured immutable deployment is Ready but primary alias differs | Stop; do not claim effective off |
| Primary alias matches but narrow runtime behavior does not prove `off` | Stop and inspect routing/config delivery; never weaken repair gate |
| Production schema migration is pending without separate deploy approval | Do not deploy or run repair discovery |
| `main` would auto-deploy request-path references before the repair tables exist | Do not merge or promote; use a schema-independent default-off gate or complete the separately approved migration first |
| Primary alias serves an application build that queries an absent repair table | Stop further releases, roll back to the last schema-compatible deployment, verify authenticated reads, and preserve all database state |
| Apply page differs from reviewed private fingerprints | Stop before page writer |
| Repair/parity succeeds | Keep AMEX off and cleanup blocked until their own reviewed decisions |
| Any unexpected user-state, audit, provenance, or unrelated-row change appears | Stop; preserve evidence/recovery point; do not compensate automatically |

### 5. Good / Base / Bad Cases

- **Good:** Verified-development apply/rollback rehearsal passes. A later production hold moves AMEX to effective off with alias proof, then separately approved schema/discovery/apply gates run bounded and retain aggregate-only evidence.
- **Good:** A default-off application can merge before schema deployment only when tests prove every ordinary authenticated/cron/mutation off path avoids repair-table SQL and generated delegates; activation waits for migration and target evidence.
- **Base:** Implementation is complete but no production authorization exists. No provider, deployment, database, manifest, cleanup, or AMEX action occurs.
- **Base:** The implementation is complete but unconditionally reads the new repair tables. Keep production on the last schema-compatible deployment and do not merge/promote the implementation until the migration gate passes.
- **Base:** Repair applies successfully. Production stays off until a new decision reviews parity and chooses whether to resume preview/write.
- **Bad:** Confirm an AMEX proposal before repair, use cleanup to remove the duplicate symptom, assume setting the environment name to `off` made the primary alias safe for repair writes, or merge unconditional repair-table reads because the Next build is green.

### 6. Tests Required

Unit-test exact off-mode parsing and malformed/newline values; repair writer refusal for preview/write/unknown mode; production state-machine ordering; first-confirmation and cleanup holds; deployment/alias identity mismatch; zero-write effective-off probe shape; separate schema/discovery/apply/rollback-preview/rollback/reactivation approvals; aggregate-only CLI/evidence output; page stop behavior; active repair application deletion guards; rolled-back user-owned evidence cascades; restrictive canonical global targets; and no automatic AMEX reactivation or cleanup after repair. When code may precede schema, tests must also prove the default-off authenticated dashboard, API, cron, and mutation paths contain no repair-table delegate/raw-SQL access; otherwise the rollout test must keep merge/promotion blocked until migration evidence exists. Operational deployment, configuration, database, and runtime probes are skipped during implementation unless separately authorized.

### 7. Wrong vs Correct

```text
Wrong:
checked-in repair code + AMEX_WRITE_MODE=off somewhere
  => run production migration, repair, cleanup, and first confirmation

green application build + checked-in migration + unconditional repair-table JOIN
  => merge to auto-deploying main before production migration
```

```text
Correct:
implementation + static checks
  => no production authorization

schema-dependent request paths
  => keep production on the last compatible deployment
  => merge/promote only after the separately approved migration

or reviewed schema-independent default-off paths
  => merge while capability remains off
  => activate only after migration and target evidence

separately approved off transition
  + Ready immutable deployment
  + primary alias deployment identity equality
  + effective-off runtime proof
  + verified target/recovery
  + separate schema/discovery/manifest/apply approvals
  => bounded production repair may begin while confirmation and cleanup stay blocked
```
