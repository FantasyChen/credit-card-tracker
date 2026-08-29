# Quick Guide: Updating Catalog Benefits

This guide covers changes to shared Standard Card and Standard Benefit
Definitions. It does not authorize database access or an existing-user
rollout; follow the linked specifications for those gates.

## 1. Prepare the change

1. Verify the terms against issuer documentation and recent trustworthy
   evidence. Record provenance and the relevant Benefit Usage Guide.
2. Start with a file in [`card-templates/`](../card-templates/), then update
   the matching definition in [`src/lib/static-catalog.ts`](../src/lib/static-catalog.ts).
3. Preserve every existing immutable `catalogKey` and each benefit's exact
   `parentCatalogKey`. A genuinely new definition receives a new key; a
   removed definition is retired rather than deleted or recreated.
4. Run the intake validator:

   ```bash
   npm run card-template:validate
   ```

## 2. Review the rollout dispositions

For every Catalog change, document:

- the key-preserving global synchronization plan (`create`, `adopt`, `update`,
  `retire`, or `unchanged`);
- missing standard statuses for existing active Physical Cards and their
  insert-only materialization disposition; and
- Benefit Usage Guide linkage plus the treatment of prior/retired statuses.

The checked-in source is DB-free and powers anonymous Catalog reads. A seed
change or static edit alone does not update existing users.

## 3. Database-backed operations (separately authorized)

The global Catalog operator defaults to a database-reading dry-run:

```bash
npm run sync:global-catalog -- --dry-run
```

Apply additionally requires immediate target verification and the exact
`SYNC_GLOBAL_CATALOG` confirmation. Legacy copied-definition work is a
separate, exact-gated operator and is never part of ordinary Catalog updates:

```bash
npm run migrate:global-benefits -- --dry-run
```

Do not run either command merely to validate documentation. Before any
database-backed operation, read:

- [Catalog and Benefit Updates](../.trellis/spec/perks-reminder/catalog-and-benefit-updates.md)
- [Global Benefit Definitions and Migration](../.trellis/spec/perks-reminder/global-benefit-definitions-and-migration.md)
- [Database and Data Safety](../.trellis/spec/perks-reminder/database-and-data-safety.md)

### Approval-gated automation

After a catalog change reaches `main`, the `Global catalog sync` GitHub Actions
workflow queues a target-verified dry run and publishes aggregate counts. The
dry-run job uses the protected `catalog-sync-preview` environment. The apply
job runs only after that job succeeds and a required reviewer approves the
protected `catalog-sync-production` environment. Configure both environments
with the `CATALOG_SYNC_DATABASE_URL` secret and matching
`CATALOG_SYNC_EXPECTED_FINGERPRINT` secret. The fingerprint is derived from the
intended PostgreSQL host, database, schema, and Neon branch identity and is
never printed by the workflow.

Repository maintainers must configure required reviewers (and restrict the
deployment branch to `main`) for both environments in **Settings → Environments**;
the production environment is the write approval boundary. If target
verification, the aggregate plan, or the apply result is unexpected, reject or
cancel the deployment and investigate before retrying. Do not approve a new
run to compensate for a partial effect.

The workflow does not run migrations, seed, status propagation, notifications,
or rollback automatically. Review the aggregate plan and separately schedule
the insert-only status materialization/propagation step after a successful
catalog apply. A failed apply stops the workflow without compensating writes.

## Common mistakes

- Editing `prisma/seed.ts` as the source of truth.
- Running a seed and assuming current users received new benefits.
- Renaming/reusing keys or matching by mutable card names and descriptions.
- Deleting/recreating global definitions or rewriting existing Benefit Status
  cycles and completion state.
- Using a legacy per-card migration script for a shared Catalog change.

For the complete contracts and operator gates, see [Catalog and Benefit
Updates](../.trellis/spec/perks-reminder/catalog-and-benefit-updates.md) and
[Community Data Quality Loop](community-data-quality-loop.md).
