# Deployment and External Effects

## Deployment ownership

- GitHub `main` deploys automatically through Vercel. Agents must not perform a manual production deployment unless the user explicitly requests it.
- The generic build command must not include `prisma migrate deploy`. Local, CI, Vercel Preview, and production builds generate the client and compile only; migration deployment is a separately authorized, target-verified operation. See [Database and Data Safety](database-and-data-safety.md).
- The production domains are served by the Vercel `coupon-cycle` project even though a local checkout may be linked to a different project. Never infer the production target from ignored `.vercel/project.json` alone.
- Provider environment values are managed in Vercel or other provider dashboards. Do not write secret values, project-local copies, or command output containing them to tracked files.

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

## Scenario: production configuration deployment and alias verification

### 1. Scope / Trigger

Apply this contract whenever a production runtime capability depends on newly added or changed provider environment values. A deployment reaching `Ready` is necessary but does not prove that the primary production domain serves that deployment or receives those values.

### 2. Signatures

```text
vercel env add <NAME> production --force [--sensitive]
vercel env ls production
vercel --prod --yes
vercel inspect <immutable-deployment-or-primary-alias>
vercel promote <immutable-deployment> --yes
vercel alias set <immutable-deployment> <existing-primary-alias>
```

`vercel promote` and `vercel alias set` are external production actions. Run them only inside an explicitly authorized deployment boundary. Use `alias set` only when deployment-ID inspection proves promotion did not move the existing primary alias.

### 3. Contracts

- Secret values use provider-sensitive storage and must never be printed, committed, copied into evidence, or inferred as absent merely because `vercel env pull` omits them.
- Verify environment registration by name, target, and provider metadata; verify effectiveness through the narrowest runtime behavior that depends on the value.
- Resolve the intended public origin from the application's production-site contract, not from an immutable deployment URL or a regex that assumes the exported URL is a string literal.
- After deployment, inspect both the immutable Ready deployment and the primary alias. Their deployment IDs must match before the rollout is reported as live.
- A zero-write authenticated probe uses a fresh nonexistent synthetic identity, short-lived credentials, invented non-colliding input, same-origin headers, and before/after identity-scoped counts for every table the endpoint could mutate.
- Evidence contains only response status/mode, aggregate row counts, token-presence booleans, cache-policy booleans, and before/after equality booleans. It never contains raw URLs, IDs, tokens, secrets, headers, or response bodies.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Sensitive value is absent from a pulled environment file but registered as sensitive | Treat omission as expected; do not replace it with a non-sensitive value. |
| Deployment is Ready but primary-alias deployment ID differs | Do not claim rollout success or diagnose runtime behavior from the alias as if it were current. |
| `promote` succeeds but IDs still differ | Stop; use an explicitly authorized `alias set` for the existing primary alias, then compare IDs again. |
| Authenticated capability probe returns fail-closed `503 sync_off` | Verify alias routing and runtime environment delivery; never weaken mode or secret validation. |
| Probe returns `401` | Inspect synthetic session encoding/cookie delivery without using a real session. |
| Probe returns same-origin rejection | Compare the exact configured public origin and request origin. |
| Probe succeeds but any scoped database count changes unexpectedly | Fail the gate and return the capability to its safe mode; do not issue compensating writes without review. |

### 5. Good / Base / Bad Cases

- **Good:** sensitive configuration is registered, a new deployment is Ready, the primary alias and immutable deployment IDs match, and one synthetic authenticated probe succeeds with exactly unchanged scoped counts.
- **Base:** the endpoint remains fail-closed because configuration is intentionally absent; no deployment or alias action is needed.
- **Bad:** a Ready deployment is assumed live, the stale primary alias returns `sync_off`, and the implementation's secret-length requirement is weakened instead of verifying routing.

### 6. Tests Required

- Unit-test capability configuration for exact allowed modes, missing values, short secrets, and newline-contaminated mode values.
- Unit-test preview/write separation so a preview proposal cannot authorize a write-mode confirmation.
- For an authorized production probe, assert the exact HTTP status and returned mode, aggregate row/skip counts, proposal-presence fields, private/no-store headers, and exact before/after equality across all potentially written tables.
- Record alias-to-deployment identity equality separately from deployment readiness; neither assertion substitutes for the other.

### 7. Wrong vs Correct

#### Wrong

```text
Ready deployment + registered env names => production capability is live
```

#### Correct

```text
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
  immutableDeploymentReady: true;
  primaryAliasDeploymentMatches: true;
  effectiveAmexMode: "off";
  targetVerified: true;
  recoveryPointVerified: true;
}
```

### 3. Contracts

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

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Category repair implementation or verified-development rehearsal incomplete | Keep confirmation and cleanup blocked; no production repair |
| Production AMEX still resolves to `write`/`preview` or is uncertain | Do not run repair apply/rollback |
| Off-configured immutable deployment is Ready but primary alias differs | Stop; do not claim effective off |
| Primary alias matches but narrow runtime behavior does not prove `off` | Stop and inspect routing/config delivery; never weaken repair gate |
| Production schema migration is pending without separate deploy approval | Do not deploy or run repair discovery |
| Apply page differs from reviewed private fingerprints | Stop before page writer |
| Repair/parity succeeds | Keep AMEX off and cleanup blocked until their own reviewed decisions |
| Any unexpected user-state, audit, provenance, or unrelated-row change appears | Stop; preserve evidence/recovery point; do not compensate automatically |

### 5. Good / Base / Bad Cases

- **Good:** Verified-development apply/rollback rehearsal passes. A later production hold moves AMEX to effective off with alias proof, then separately approved schema/discovery/apply gates run bounded and retain aggregate-only evidence.
- **Base:** Implementation is complete but no production authorization exists. No provider, deployment, database, manifest, cleanup, or AMEX action occurs.
- **Base:** Repair applies successfully. Production stays off until a new decision reviews parity and chooses whether to resume preview/write.
- **Bad:** Confirm an AMEX proposal before repair, use cleanup to remove the duplicate symptom, or assume setting the environment name to `off` made the primary alias safe for repair writes.

### 6. Tests Required

Unit-test exact off-mode parsing and malformed/newline values; repair writer refusal for preview/write/unknown mode; production state-machine ordering; first-confirmation and cleanup holds; deployment/alias identity mismatch; zero-write effective-off probe shape; separate schema/discovery/apply/rollback-preview/rollback/reactivation approvals; aggregate-only CLI/evidence output; page stop behavior; active repair application deletion guards; rolled-back user-owned evidence cascades; restrictive canonical global targets; and no automatic AMEX reactivation or cleanup after repair. Operational deployment, configuration, database, and runtime probes are skipped during implementation unless separately authorized.

### 7. Wrong vs Correct

```text
Wrong:
checked-in repair code + AMEX_WRITE_MODE=off somewhere
  => run production migration, repair, cleanup, and first confirmation
```

```text
Correct:
implementation + static checks
  => no production authorization

separately approved off transition
  + Ready immutable deployment
  + primary alias deployment identity equality
  + effective-off runtime proof
  + verified target/recovery
  + separate schema/discovery/manifest/apply approvals
  => bounded production repair may begin while confirmation and cleanup stay blocked
```
