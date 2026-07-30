# Catalog and Benefit Updates

## Sources and scope

- Verify card terms against issuer terms and recent trustworthy community evidence. Record provenance where public surfaces depend on freshness.
- Track cyclical value such as recurring credits and free nights. Exclude always-on lounge access, insurance, uncapped earning multipliers, elite status, and sign-up bonuses from recurring-benefit modeling unless product requirements explicitly change.
- `src/lib/static-catalog.ts` is the checked-in DB-free public catalog source. Every card/benefit has an explicit immutable `catalogKey` and every benefit has an exact parent key; follow [Global Benefit Definitions and Migration](global-benefit-definitions-and-migration.md) for validation and key-preserving persistence synchronization.
- `prisma/seed.ts` consumes the same static source but is not the routine catalog synchronization or existing-user propagation path. Never restore delete/recreate seeding for referenced global definitions.
- AMEX catalog rows additionally follow [AMEX Sync Reconciliation](amex-sync-reconciliation.md): all 12 products and 56 benefit rows have stable global destination identity and explicit source semantics, while only 47 provider `usage` destinations receive write authority.
- `card-templates/` is the contributor intake format. Validate it with `npm run card-template:validate`.

## Existing-user contract

A catalog benefit change is incomplete until all four dispositions are explicit:

1. update the shared static source while preserving existing keys and assigning a new explicit key only to a genuinely new definition;
2. validate and plan non-destructive global synchronization (`create | adopt | update | retire | unchanged`);
3. disposition propagation of missing standard statuses to every existing active physical card linked to the global product;
4. disposition guide linkage and prior statuses for updated/retired definitions.

Never claim an existing-user rollout from a static/seed edit alone. `npm run sync:global-catalog` defaults to a database-reading dry-run and remains a separately authorized operation even in dry-run mode; apply additionally requires verified target identity and `SYNC_GLOBAL_CATALOG`. Materialization is insert-only and must not reset existing cycles or user state. Legacy copied definitions use the separately gated exact migration in [Global Benefit Definitions and Migration](global-benefit-definitions-and-migration.md), never `scripts/update-card-benefits.js` or the superseded per-user AMEX key apply.

## Modeling rules

- Calendar-fixed monthly credits use `MONTHLY` with `CALENDAR_FIXED`.
- Anniversary-based recurring credits use `CARD_ANNIVERSARY`.
- Split fixed windows (for example Jan–Jun and Jul–Dec) are represented as separate benefits with explicit start month and duration.
- Multi-year credits retain the true duration via `fixedCycleDurationMonths`; do not materialize them annually by accident.
- Guide matching can be card-specific when descriptions overlap, with category/description fallback.

## Verification

- `npm run card-template:validate` is the safe schema/example check.
- `npm run check:public-db` proves guarded public surfaces remain DB-free.
- The usage-guide audit queries a database through the dev wrapper. Run it only against a verified non-production target and only when the task permits DB access; otherwise report it skipped.
- Migration scripts must expose and pass a dry run before any write mode. Dry-run output must include enough counts/identity to review without exposing user data.
