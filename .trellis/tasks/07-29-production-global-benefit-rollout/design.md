# Design — Production global-benefit rollout

## 1. Operational state machine

```text
off
  -> development migration/runtime/migration parity proven
  -> production schema + global catalog ready
  -> production legacy bridge + hybrid parity ready
  -> optional ledger-proven cleanup/global-first cutover
  -> preview (read-only, separately configured)
  -> write (separately authorized confirmation)
  -> off (immediate capability rollback)
```

No elapsed time or successful earlier stage automatically promotes the next stage.

## 2. Authority and evidence

Provider and database targets are verified immediately before access. Reports contain role labels, migration state, deployment references, aggregate classification/parity counts, and closed reasons only. Raw reports remain in approved private temporary storage and are deleted after sanitization.

The 2026-07-29 per-user-key dry-run/projection in the parent research is historical scale evidence. It predates global IDs, standard status relations, the migration ledger, and the new classifier. Its counts and strict-partial decision are not expected values, prerequisites, or authorization for this rollout.

## 3. Development rehearsal

On a verified development target, under separate database authorization:

1. apply reviewed additive migration and validate client generation independently;
2. run global catalog synchronization dry-run/apply/rerun and prove ID stability/retirement;
3. deploy/use hybrid runtime and prove new-card/no-copy behavior plus existing-card propagation;
4. run legacy migration dry-run twice, bridge apply, snapshot parity, and idempotent rerun;
5. rehearse ledger-proven cleanup and pre-cleanup rollback from a recovery point;
6. test global AMEX authority with synthetic/local data while production remains off.

Failure returns to the owning implementation child.

## 4. Production phase boundaries

Each phase repeats target/migration/config verification and has its own approval:

- additive migration deploy;
- global catalog dry-run and bounded apply;
- legacy classifier dry-run and bounded bridge apply;
- hybrid/global projection parity observation;
- optional ledger-proven cleanup;
- application/global-authority deployment verification;
- HMAC provisioning and preview configuration;
- userscript publication/install and attended live scan;
- write-mode configuration and first bounded confirmation.

Catalog and bridge applies use exact confirmation phrases, target attestation, deterministic cursors, plan/database fingerprints, transactions, and immediate post-batch checks. No phase repairs custom/unresolved data.

## 5. Parity and cutover

Representative and aggregate before/after snapshots prove equality of every legacy status field, exact cycle instants, occurrence, amount, completion, usability, order, created/updated timestamps, audit/provenance links, and owner. Only approved global/ledger metadata may differ during bridge.

Global-first readers must project standard, bridge, and custom rows compatibly. Latest global term changes update displayed definition fields but not persisted cycle/state. New definitions materialize only missing statuses for active cards; retirement blocks future creation.

Cleanup requires complete ledger coverage for standard copies, zero unresolved ownership conflicts, hybrid parity, a recovery point, and separate authorization. Legacy columns/ledger remain after cleanup.

## 6. Preview, write, and userscript

AMEX mode is configured only after global authority is deployed. Preview validates authenticated global-only destinations and writes no status, attempt, audit, or provenance state. The audited production userscript is installed only through the approved owner procedure; installation does not authorize a scan.

Sanitized preview review requires zero unexpected matches/failures and disposition reconciliation. Write requires a new explicit decision. The first confirmation is bounded; attempts, row audits, provenance, and resulting statuses must reconcile before mode remains enabled.

## 7. Stop and rollback

Any uncertainty or drift stops before the next batch and keeps/returns mode off. Before cleanup, ledger-guided rollback clears only bridge-added links and returns to hybrid reads. After cleanup, use the recovery point or a reviewed forward fix. Never seed/reset production, overwrite conflicts, re-enable user-key authority, infer deletions, or blanket-reverse statuses.
