# Repair global benefit category drift

## Goal

Safely reconcile historical card-owned benefit copies that were classified custom solely because their category differs from one canonical global definition, eliminating custom/global duplicate authority without changing genuine custom benefits or inferring user intent from conflicting status state.

## Background

The exact global-benefit bridge intentionally compares category as part of the full definition shape. A read-only production audit found 813 custom classifications; 533 ownerless card-linked definitions uniquely match one canonical definition under the same global product when category alone is excluded. Global materialization subsequently created canonical statuses while the legacy definitions continued custom materialization, producing 447 currently visible duplicate pairs across 15 products. These counts are diagnostic only and must be regenerated before any production operation.

## Requirements

1. Keep the existing full-shape classifier strict and preserve `CatalogMigrationLedger` history as `CUSTOM / CLASSIFIED` for these rows.
2. Discovery may propose only ownerless, card-linked, ledgered rows with one exact same-product destination after excluding category alone; all other fields and non-null provider identity must agree.
3. Category-only discovery is not write authority. Every database-backed mode requires separately authorized target verification before its first read. Apply additionally requires an exact privately reviewed manifest, inventory/manifest/page fingerprints, bounded pagination, AMEX-off verification, recovery verification, and a repair-specific confirmation phrase.
4. Add additive repair evidence without changing the historical ledger. Only semantically `APPLIED_VALID` evidence grants suppression/canonical bridge authority; `APPLIED_INVALID`, rolled-back, or absent evidence grants none.
5. Pair occurrences only by user, physical card, canonical definition, exact cycle start/end, and occurrence. Preserve the history-bearing keeper ID and all state/timestamps/audits/provenance. Delete only an unattached loser after storing an exact rollback preimage.
6. Never resolve conflicting meaningful state, dual attachments, non-exact overlaps, duplicate destinations, cross-owner relations, or graph drift automatically. Block the definition without changing it.
7. Semantically valid applied evidence must stop custom materialization, project canonical read-only terms, and authorize AMEX only when all repair/card/definition/status relations agree. Authenticated definition/card deletion must block both valid and malformed `APPLIED` evidence so invalid evidence cannot be erased.
8. Genuine custom and unmanifested rows remain visible, mutable, and independently materialized.
9. Repair rollback preserves current user state, clears only repair-added relations, restores removed rows exactly, and stops after attachment/provenance/AMEX drift or cleanup. Rolled-back evidence must not permanently block normal account/card/status lifecycle deletion; active repair deletion remains application-blocked.
10. The sanitized production-to-development clone must preserve and catalog-key-rebind repair evidence or fail closed.
11. Runtime behavior must not use category/description/amount/timestamp dashboard heuristics or a checked-in production ID list.
12. Code completion does not authorize production schema/configuration/data operations, cleanup, provider activity, or AMEX confirmation. Production repair requires a separately authorized transition from current `write` mode to effective `off`.

## Acceptance Criteria

- [x] Additive Prisma schema and migration define repair/evidence state without rewriting existing data or changing current uniqueness.
- [x] Pure planner produces deterministic category-only proposals, private-manifest digests, exact action/stop classes, opaque cursors, and aggregate-only reports.
- [x] Prisma adapter applies and rolls back each reviewed definition in a serializable transaction with in-transaction re-planning, CAS writes, exact snapshots, postimage verification, and idempotent replay.
- [x] Existing strict classifier remains category-inclusive and unmanifested rows retain their original classification and capabilities.
- [x] `APPLIED_VALID` evidence suppresses only its legacy source and yields one canonical effective/AMEX authority; every `APPLIED` parent blocks incompatible authenticated deletion, while rolled-back user-owned evidence cascades with normal lifecycle and canonical global targets remain restrictive.
- [x] Every keeper preserves ID, exact cycles, occurrence, usage, completion, completedAt, usability, order, createdAt/updatedAt, audits, and provenance except explicitly recorded canonical audit metadata.
- [x] Conflicting state, attachments, overlap, ambiguity, inventory/manifest tampering, and source/catalog drift produce closed stop reasons and no writes.
- [x] Clone support rebinds global targets by immutable catalog key and preserves rollback evidence.
- [x] Targeted and full Jest, strict TypeScript, changed-source lint, Prisma/migration checks, public DB invariant, card-template/userscript checks, sensitive-pattern review, and diff checks pass.
- [ ] Verified-development rehearsal demonstrates apply, runtime suppression, exact rollback, post-apply state preservation, blocked provenance drift, and reapply idempotency before any production authorization is requested.

## Out of Scope

- Production AMEX mode changes, schema deployment, private manifest generation, canary/full repair apply, rollback, or cleanup.
- Live userscript/provider scans or AMEX proposal confirmation.
- Automatic adjudication of overlapping or conflicting legacy statuses.
- Deleting repaired legacy definitions or dropping rollback columns/ledgers.
