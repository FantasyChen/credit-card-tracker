# Global catalog foundation

## Goal

Establish durable global card/benefit identities, additive relational foundations, and safe catalog synchronization so standard definitions can be shared read-only by every user without deleting or recreating referenced rows.

## Dependencies

- First implementation child; no other child may assume the new relations until this task is reviewed and its migration is development-validated.
- Follow the parent gate at `.trellis/tasks/07-28-roll-out-amex-sync-production`.

## Requirements

1. Use existing `PredefinedCard` and `PredefinedBenefit` as the canonical global catalog.
2. Add explicit, checked-in, immutable `catalogKey` values to every static card and benefit. Keys must not be generated from mutable names, descriptions, or array positions.
3. Validate missing/duplicate keys, parent mismatch, AMEX partial identity, source/registry mismatch, and destination-tuple duplication. Preserve the AMEX 12-product/56-row and writable-set invariants.
4. Store AMEX `productKey`, `creditFamilyKey`, and `periodKey` only on global definitions in the target model; do not populate user-row identity keys.
5. Add retirement semantics. Referenced global definitions are retired, not hard-deleted; mutable approved canonical fields continue to represent latest global terms.
6. Replace delete/recreate seed behavior with deterministic key-based synchronization that preserves global IDs, updates approved fields, creates new definitions, and retires definitions missing from source.
7. Add the additive schema needed by later children: physical-card global product relation, standard-status card/global-definition relations, bridge-compatible nullable legacy status relation, migration ledger/audit metadata, restrictive foreign keys, and partial standard/custom uniqueness.
8. Keep migration SQL null-compatible and non-destructive. Do not drop legacy columns, rewrite status state, or apply any migration to a database in this implementation task without separate authorization.
9. Provide a dry-run-default catalog synchronization operator with bounded reporting, target verification, and exact confirmation for any apply.
10. Preserve public anonymous catalog behavior through the DB-free static catalog source.

## Acceptance Criteria

- [x] Every static card and benefit has one explicit unique immutable catalog key and a valid parent.
- [x] Catalog and AMEX registry validation rejects missing, duplicate, positional, partial, or tuple-conflicting identity.
- [x] Repeated synchronization preserves IDs; approved fields update globally; missing definitions retire; referenced definitions are never deleted.
- [x] Reviewed migration SQL is additive/null-compatible, uses `RESTRICT`, includes the intended partial indexes/ledger, and performs no status-state rewrite.
- [x] No standard user-copy identity is backfilled or treated as future authority.
- [x] Dry-run calls no writer; apply requires verified target and exact confirmation.
- [x] Targeted tests, strict TypeScript, catalog/public-DB checks, migration SQL review, sensitive-pattern review, and `git diff --check` pass safely.

## Out of Scope

- Runtime projection/materialization, legacy cleanup, AMEX authority activation, seed/reset, or any production database operation. Separately authorized verified-development migration/catalog validation is recorded in `implement.md`.
- Per-user standard overrides, definition revisions, or hard deletion of referenced global rows.
