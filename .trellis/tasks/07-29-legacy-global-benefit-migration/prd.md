# Legacy global-benefit migration

## Goal

Build a deterministic, auditable migration that classifies legacy copied benefits, bridges exact standard matches to global definitions without rewriting status history, preserves custom data, and supports separately gated cleanup and rollback.

## Dependencies

- Depends on completed global catalog foundation and hybrid global-benefit runtime.
- Must complete development dry-run/bridge/parity evidence before AMEX global authority or production rollout.

## Requirements

1. Provide a bounded, deterministic, resumable CLI/operator whose default is dry-run and whose apply requires target verification and an exact confirmation.
2. Map a physical card only when exact issuer/name and every existing identity signal agree with exactly one global product.
3. Standalone legacy benefits always remain custom.
4. Map a card-linked legacy benefit to standard only when its complete persisted canonical shape exactly matches one unique active or retired global definition and ownership, card, status, audit, and provenance relationships are consistent.
5. Do not use fuzzy, normalized-nearest, description-only, name-only, partial-shape, or array-position inference. Ambiguous/conflicting rows remain unresolved; valid unmatched rows are preserved as custom.
6. Any ownership/cross-user inconsistency stops that card's migration rather than omitting or repairing data.
7. Bridge apply updates existing statuses in place with card/global-definition metadata while preserving status IDs, legacy benefit link, cycle instants, occurrence, amount, completion, usability, order, provenance, audits, created/updated timestamps, and every unrelated field.
8. Record one idempotent migration-ledger entry keyed by legacy `Benefit.id`; create, delete, merge, recalculate, or reset no status during bridge migration.
9. Provide separately confirmed cleanup only after hybrid parity. Cleanup may null legacy `benefitId` and delete copied standard `Benefit` rows only when the ledger proves the exact mapping; custom/unresolved rows are never deleted by inference.
10. Disable the old `backfill:amex-catalog --apply` path with a stable superseded message. It must never fill user-row identity keys under the global model.
11. Update single-user clone support to rebind global definitions by `catalogKey` while preserving custom and bridge audit relationships.
12. Reports are aggregate-only by default and expose no user, row, target, or sensitive values.

## Acceptance Criteria

- [x] No-mode/dry-run invokes no writer and yields deterministic bounded cursor results.
- [x] Exact unique full-shape mapping is the only standard classification; ambiguity, conflict, and valid unmatched rows are preserved correctly.
- [x] Bridge apply is idempotent and changes only approved metadata/ledger fields; all pre-existing status/audit/provenance values and timestamps remain unchanged.
- [x] Ownership inconsistency blocks the card and duplicate standard destinations fail closed.
- [x] Cleanup requires a separate gate and removes only ledger-proven copied standard rows after parity.
- [x] Custom and unresolved rows retain IDs, ownership, definitions, statuses, and visibility.
- [x] The old per-user AMEX key apply always returns the stable superseded result without a database writer.
- [x] Clone rebinding uses catalog keys and preserves source-kind semantics.
- [x] Targeted classifier/operator/rollback/clone tests, strict TypeScript, sensitive-pattern review, and `git diff --check` pass without database effects.

## Out of Scope

- Production execution, global runtime implementation, AMEX reconciliation changes, legacy-column drops, or automatic cleanup during bridge apply.
