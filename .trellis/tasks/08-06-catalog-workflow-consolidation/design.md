# Design — Canonical catalog change workflow

## Supported modules

- Static catalog validation and key-preserving synchronization remain the catalog authority.
- Insert-only global status materialization/propagation remains the existing-user path.
- `global-benefit-migration.ts` plus its Prisma adapter remains the exact legacy bridge/cleanup/rollback operator.

## Removed modules

The broad `src/lib/benefit-migration/` framework and its `update-card-benefits`, `migrate-benefits`, and `validate-migration` scripts are superseded. Their delete/recreate, card-name-based, and backup-file interfaces are not part of the current contract.

## Documentation

Catalog operator guidance describes the four required dispositions: static key-preserving edit, synchronization plan, existing-card status propagation, and guide/prior-status disposition. It never treats seed as rollout authority.

## Compatibility

Guard tests are rewritten to assert the superseded paths are absent and the current operators remain fail-closed. No database command is executed.
