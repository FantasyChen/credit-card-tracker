# Catalog and Benefit Updates

## Sources and scope

- Verify card terms against issuer terms and recent trustworthy community evidence. Record provenance where public surfaces depend on freshness.
- Track cyclical value such as recurring credits and free nights. Exclude always-on lounge access, insurance, uncapped earning multipliers, elite status, and sign-up bonuses from recurring-benefit modeling unless product requirements explicitly change.
- `src/lib/static-catalog.ts` is the DB-free public catalog source; `prisma/seed.ts` imports catalog data for persistence. Keep them aligned rather than maintaining competing catalogs.
- `card-templates/` is the contributor intake format. Validate it with `npm run card-template:validate`.

## Existing-user contract

A catalog benefit change is incomplete until all three dispositions are explicit:

1. update the shared template/static source for new card additions;
2. migrate matching existing user cards when the change should apply to current users;
3. materialize the required `BenefitStatus` rows so the dashboard can display the changed benefit.

Never claim an existing-user rollout from a seed/template edit alone. Prefer `scripts/update-card-benefits.js`, always inspect `--dry-run` first, and execute `--force` only after target verification and explicit authorization. Complex migrations use the migration framework, dry-run first, with transaction and backup support for approved production work.

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
