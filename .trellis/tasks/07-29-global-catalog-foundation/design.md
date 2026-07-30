# Design — Global catalog foundation

## 1. Source and identity

`src/lib/static-catalog.ts` remains the checked-in, DB-free source consumed by public routes and persistence synchronization. Each product and benefit declares a durable opaque `catalogKey`. AMEX registry entries declare the same benefit key beside semantic identity so validation can compare keys and destination tuples without array-position coupling.

Validation runs before planning writes and checks:

- key presence, format, and global uniqueness;
- benefit parent key and source parent agreement;
- duplicate global/AMEX destination tuples;
- all-or-none AMEX product/family/period identity;
- registry/static key and tuple parity, including 12 products, 56 rows, and writable semantics.

Names, descriptions, ordering, and indexes never generate identity.

## 2. Canonical global persistence

`PredefinedCard` and `PredefinedBenefit` gain unique `catalogKey` and nullable `retiredAt`. Approved terms remain mutable canonical fields; consumers always see the latest values. Synchronization upserts by key:

1. validate the complete source;
2. load existing global rows by key;
3. create missing rows in parent-before-child order;
4. update approved mutable fields without changing IDs/keys;
5. clear retirement when a key returns;
6. retire absent rows rather than deleting them.

A dry-run plan is deterministic and aggregate-safe. Apply uses target verification, exact confirmation, transaction boundaries, and compare-and-set protection against source/database drift.

## 3. Additive relational model

The migration introduces, without deleting legacy data:

- `CreditCard.predefinedCardId` to the global product;
- `BenefitStatus.creditCardId` and `predefinedBenefitId` for standard status ownership;
- nullable legacy `BenefitStatus.benefitId` so later runtime can create standard statuses without a copied benefit;
- migration-ledger records keyed by legacy `Benefit.id` with source/destination and phase metadata;
- AMEX audit destination metadata required by later authority work;
- `RESTRICT` relations from user data to global definitions;
- partial PostgreSQL uniqueness for standard `(creditCardId, predefinedBenefitId, userId, cycleStartDate, occurrenceIndex)` and custom `(benefitId, userId, cycleStartDate, occurrenceIndex)` rows.

Exclusive standard/custom source constraints are deferred until migration parity and cleanup because bridge rows temporarily hold both links. Legacy user identity columns remain present but gain no new authority.

## 4. Migration construction boundary

Schema and checked-in migration SQL are authored/reviewed in this task. Generation, client generation, or apply against a verified development database occurs only under the database workflow's separate authorization. SQL review must prove no table reset, hard delete, status-value update, unsafe default rewrite, or cascading global deletion.

## 5. Compatibility and rollback

Existing application code continues using legacy columns until child 2 is deployed. New columns are nullable, so the migration can land before runtime readers. Rolling back the application ignores additive columns. Reverting database metadata is deferred while references exist; global synchronization rollback restores prior source fields/retirement state through a reviewed forward operation, never row recreation.
