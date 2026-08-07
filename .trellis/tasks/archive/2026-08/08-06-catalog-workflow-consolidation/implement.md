# Implementation plan — Canonical catalog change workflow

- [x] Inventory behavior in the broad legacy framework and confirm current catalog/materialization/exact-migration modules own the supported behavior.
- [x] Delete `src/lib/benefit-migration/`, its tests, and superseded scripts.
- [x] Update legacy-utility guard tests to assert removed paths stay absent and current exact operators remain authoritative.
- [x] Rewrite `docs/benefit-update-quick-guide.md` and catalog portions of `docs/community-data-quality-loop.md`.
- [x] Remove stale script references from README/CONTRIBUTING/package metadata.
- [x] Search for seed-first, `update-card-benefits`, broad `migrate-benefits`, and removed imports.
- [x] Run catalog validation/synchronizer tests, materialization tests, global migration tests, legacy guards, card-template validation, public DB check, strict TypeScript, changed-source ESLint, and `git diff --check`.

Rollback: restore only a proven behavior missing from current modules; do not restore the competing write interface wholesale.
