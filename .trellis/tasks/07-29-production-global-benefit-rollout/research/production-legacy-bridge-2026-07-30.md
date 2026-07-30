# Sanitized production legacy bridge — 2026-07-30

## Authorization and scope

The user separately authorized applying the reviewed exact legacy bridge, fresh target/source verification, per-batch fingerprints, preservation checks, and a complete idempotent replay. This boundary did not authorize or perform cleanup, legacy-row deletion, application push/deployment, configuration changes, preview, userscript/provider scan, or AMEX status reconciliation.

## Immediate gates

Immediately before bridge writes:

- application and direct database connections matched;
- the database identity matched the provider project and default branch;
- production AMEX resolved effectively to `off`;
- Prisma reported the schema up to date;
- the global catalog remained all unchanged with zero conflicts;
- a fresh complete 19-page source traversal exactly matched the reviewed 11,922 standard, 813 custom, zero unresolved, and zero blocked classification;
- the migration ledger was initially empty.

Every write batch used its reviewed source fingerprint, exact target/confirmation flags, and serializable per-unit transactions. Each unit was re-read and reclassified before mutation and re-read again before commit. A source, ownership, relationship, fingerprint, compare-and-set, or preservation mismatch would roll back that unit.

## Interrupted first attempt

The first orchestrated pass stopped during page 16 after a child command returned nonzero:

- pages 1–15 had completed;
- page 16 had committed 614 of 664 benefit classifications;
- pages 17–19 were untouched;
- the ledger contained 10,177 bridged standard and 813 classified custom benefits;
- the failing unit rolled back atomically;
- all committed card/status/ledger relationships were valid;
- a complete read-only dry-run still matched the reviewed source with zero unresolved or blocked units.

The child command intentionally exposed no raw output, identifiers, or row values, so the exact transient command cause was not retained. The next pending unit was ordinary-sized. No cleanup, rollback, compensating repair, or matching-policy change was performed.

## Safe resume and final result

The operation resumed through the same full target, mode, migration, catalog, source-fingerprint, and partial-state gates. Already committed units were required to replay idempotently; only the remaining reviewed units could bridge.

Final bridge state:

| Classification | Count |
|---|---:|
| Standard / `BRIDGED` | 11,922 |
| Custom / `CLASSIFIED` | 813 |
| Unresolved | 0 |
| Blocked units | 0 |
| Cleaned | 0 |

All 19 resume pages completed. A second complete 19-page apply replay reported every 12,735 benefit classification idempotent and no new bridge/classification work.

The resume process emitted a complete success record with all gates true, but its outer monitoring wrapper subsequently reported a nonzero process status. No completion claim relied on that wrapper alone: an independent read-only production verification then confirmed the exact full ledger counts, valid card/status relationships, unchanged catalog, stable 19-page classification, zero unresolved/blocked units, and zero cleanup.

## Preservation and parity

- Per-unit post-bridge fingerprints proved source state remained unchanged before each transaction committed.
- Protected-state snapshots across the resume, final bridge, and full idempotent replay were equal after excluding only the approved card/status/audit bridge fields.
- Legacy `Benefit` rows and `BenefitStatus.benefitId` links remain present.
- Definition, standard-status, custom-status, audit, and duplicate-occurrence parity checks all passed.
- No status identity, owner, cycle boundary, occurrence, amount, completion, unusable state, order, timestamp, provenance, or non-bridge audit field was intentionally changed.
- Cleanup remains deferred and no ledger row is in `CLEANED` phase.

## Current gate

The schema, catalog, legacy bridge, preservation, hybrid parity, and idempotency gates passed. Production AMEX remains `off`. The next independent boundary is publishing the reviewed release branch and deploying the application while retaining AMEX `off`, followed by read-only core smoke tests. Cleanup, HMAC provisioning, preview, userscript/provider activity, live scanning, and write activation remain separately gated.

## Privacy

Environment values, raw child output, page fingerprints, cursors, identifiers, and row values were held only in private temporary storage and removed. This record contains only aggregate counts, boolean gate outcomes, and non-identifying operational phases.
