# Implementation plan — Canonical catalog change workflow

- [ ] Inventory behavior in the broad legacy framework and prove each needed behavior is owned by current catalog/materialization/exact-migration modules.
- [ ] Delete `src/lib/benefit-migration/`, its tests, and superseded scripts.
- [ ] Update legacy-utility guard tests to assert removed paths stay absent and current exact operators remain authoritative.
- [ ] Rewrite/delete `docs/benefit-update-quick-guide.md` and catalog portions of `docs/community-data-quality-loop.md`.
- [ ] Remove stale script references from README/CONTRIBUTING/package metadata if any remain after the docs child.
- [ ] Search for seed-first, `update-card-benefits`, broad `migrate-benefits`, and removed imports.
- [ ] Run catalog validation/synchronizer tests, materialization tests, global migration tests, legacy guards, card-template validation, public DB check, strict TypeScript, changed-source ESLint, and `git diff --check`.

Rollback: restore only a proven behavior missing from current modules; do not restore the competing write interface wholesale.
