# Community Data Quality Loop

Perks Reminder should make catalog corrections feel normal, visible, and recoverable.

## User-Facing Loop

1. Users can suggest fixes from benefit cards, guide pages, card catalog pages, and the guide library.
2. Correction emails should include the card, benefit, guide slug, and the source or data point that supports the change.
3. Public surfaces should show provenance language and last-updated dates where a user is deciding whether to trust catalog data.

## Maintainer Loop

1. Verify the change against issuer terms and recent community data points.
2. Update `prisma/seed.ts` for predefined cards, benefits, or `BenefitUsageWay` content.
3. Run `npx prisma db seed` against the intended non-production target first.
4. For benefit template changes, run the unified script:

```bash
node scripts/update-card-benefits.js --card "Card Name" --dry-run
node scripts/update-card-benefits.js --card "Card Name" --force
```

The unified script is preferred because it updates existing user cards and creates benefit statuses, which keeps current users from silently missing new or changed benefits.

## Guardrails

- Do not rely on seed changes alone for existing-user benefit updates.
- Do not recommend refund-dependent or abuse-prone guide tactics.
- Keep claimed ROI separate from subjective value assumptions.
- If a migration is complex, use the advanced migration framework with `--dry-run` first and `--backup` for production-approved changes.
