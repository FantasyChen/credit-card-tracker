# Community Data Quality Loop

Perks Reminder should make Catalog corrections visible, source-backed, and
recoverable without silently changing a user's usage history.

## User-facing loop

1. Users can suggest fixes from benefit cards, guide pages, card Catalog pages,
   and the guide library.
2. Correction reports should identify the affected card, benefit, or guide and
   include the source or data point that supports the change.
3. Public surfaces should show provenance language and last-updated dates when
   a user is deciding whether to trust Catalog data.

## Maintainer loop

1. Verify the proposed terms against issuer documentation and recent,
   attributable community evidence.
2. Use `card-templates/` for structured intake, then update the matching
   key-preserving definition in `src/lib/static-catalog.ts`.
3. Preserve every existing `catalogKey`; assign a new key only to a genuinely
   new definition. Check the exact parent key for each benefit.
4. Record the global synchronization, existing-Physical-Card status
   propagation, retirement/reactivation, and Benefit Usage Guide dispositions.
5. Review the synchronization plan before any database-backed operation. The
   operator defaults to a database-reading dry-run and remains separately
   authorized even in dry-run mode:

   ```bash
   npm run sync:global-catalog -- --dry-run
   ```

   Apply requires immediate target verification and the exact
   `SYNC_GLOBAL_CATALOG` confirmation. Follow the
   [Catalog and Benefit Updates specification](../.trellis/spec/perks-reminder/catalog-and-benefit-updates.md)
   and [Database and Data Safety](../.trellis/spec/perks-reminder/database-and-data-safety.md)
   before using either mode.

## Guardrails

- A static Catalog or seed edit alone is not an existing-user rollout.
- Synchronization is key-preserving and non-destructive: it never deletes or
  recreates referenced global definitions or resets a user's status.
- New active definitions materialize missing standard statuses insert-only;
  retired definitions create no future statuses while prior statuses remain
  visible and unchanged.
- Keep claimed ROI separate from subjective value assumptions.
- Do not recommend refund-dependent or abuse-prone guide tactics.
