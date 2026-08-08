# Catalog workflow contract summary

- `static-catalog.ts` is the checked-in DB-free catalog source; `prisma/seed.ts` consumes it but is not rollout authority.
- Card and benefit `catalogKey` values are explicit, immutable, unique, and never generated from mutable fields.
- Synchronization actions are `create | adopt | update | retire | unchanged`; apply is serializable, compare-and-set, key-preserving, and non-destructive.
- A catalog change is incomplete until static edit, synchronization plan, existing-active-card status propagation, and guide/prior-status disposition are explicit.
- Materialization is insert-only and never resets existing cycle or user state.
- `global-benefit-migration.ts` is the supported exact legacy bridge/cleanup/rollback operator; its bounded modes, confirmations, fingerprints, privacy, and preservation gates remain.
- `scripts/update-card-benefits.js` and the broad `benefit-migration` framework are explicitly superseded by the project spec.
- Public anonymous catalog surfaces remain DB-free.
- Implementation verification is static/unit only: no catalog dry-run, database read, apply, seed, migration, build, or production operation.
