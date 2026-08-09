# Sanitized production legacy migration dry-run — 2026-07-30

## Authorization and scope

The user separately authorized two complete bounded, read-only production legacy-migration dry-runs and a sanitized aggregate report. No bridge apply, cleanup, rollback, application push/deployment, configuration change, preview, userscript/provider scan, or AMEX status write was authorized or performed.

## Immediate verification

Before reading legacy migration units:

- application and direct database connections matched;
- the database identity matched the provider project and default branch;
- production AMEX resolved effectively to `off`;
- Prisma reported the schema up to date;
- the global-catalog dry-run still reported all 34 cards and 129 benefits unchanged with zero conflicts.

## Complete bounded results

Each complete pass traversed 19 bounded pages of at most 100 units. Both passes returned identical page-level source fingerprints, aggregate counts, reason counts, and pagination structure.

| Aggregate | Count |
|---|---:|
| Units examined | 1,869 |
| Benefits examined | 12,735 |
| Exact standard matches | 11,922 |
| Preserved custom benefits | 813 |
| Unresolved benefits | 0 |
| Blocked units | 0 |

Custom classifications were:

| Reason | Count |
|---|---:|
| Explicit card-linked custom benefit | 807 |
| Benefit on an unmatched custom card | 6 |

No standalone custom, ambiguity, identity conflict, ownership inconsistency, relationship inconsistency, duplicate destination, or ledger conflict reason occurred. Because both passes were dry-run mode, bridge/classification writes, cleanup, rollback, and idempotent-write counts were all zero.

## Interpretation

Every examined legacy benefit was classified through the existing exact rules as either one exact global standard destination or preserved custom data. No unit requires fuzzy inference, repair, or exclusion. The second complete pass proves the reviewed source snapshot and classification are deterministic at the per-batch fingerprint level.

## Current gate

The read-only legacy classification gate passed. Any bridge apply remains a separate production-write boundary. Apply must immediately reverify target, provider default branch, AMEX-off state, migration/catalog stability, and each reviewed batch fingerprint; it must stop on any source drift or blocked unit. Post-apply verification must prove status/audit/provenance preservation and an idempotent replay. Cleanup remains explicitly deferred.

## Privacy

Environment values, raw migration reports, page fingerprints, cursors, identifiers, and row values were held only in temporary private files and removed automatically. This record contains only aggregate counts and reason labels.
