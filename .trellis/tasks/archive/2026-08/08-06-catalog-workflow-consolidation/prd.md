# Consolidate catalog change workflow

## Goal

Retire superseded catalog migration code and align operator documentation with the key-preserving global catalog workflow.

## Requirements

- Preserve immutable catalog keys, exact parents, non-destructive synchronization, retirement semantics, and insert-only status propagation.
- Inventory every caller, test, and manual use of the legacy benefit-migration framework and update-card-benefits scripts before removal.
- Rewrite operator guidance around static source validation, global synchronization planning, propagation disposition, and guide linkage.
- Preserve separately gated exact legacy bridge, cleanup, and rollback operations that remain part of the current contract.
- Complete source consolidation before the active rollout resumes, then rerun affected catalog, migration, and AMEX static/unit verification without executing operational modes.

## Acceptance Criteria

- [ ] No active docs or package scripts recommend seed-only or broad delete/recreate rollout.
- [ ] Superseded implementation and tests are removed only after their remaining behavior is mapped to current owners or explicitly archived.
- [ ] Catalog validation, synchronization, materialization, public DB-free, and legacy guard tests pass.
- [ ] No database or production operation is run as part of implementation verification.
