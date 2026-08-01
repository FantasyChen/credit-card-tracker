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
