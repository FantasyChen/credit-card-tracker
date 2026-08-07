# Card Catalog Contributions

This directory is the contributor intake format for proposed Standard Card and
Standard Benefit Definitions. The checked-in DB-free Catalog source is
[`src/lib/static-catalog.ts`](../src/lib/static-catalog.ts); this directory is
not a database seed or an existing-user rollout mechanism.

## Workflow

1. Copy [`examples/chase-sapphire-preferred-2026.json`](examples/chase-sapphire-preferred-2026.json).
2. Replace the card metadata, benefits, and source links. Keep the source
   terms and access dates specific enough for review.
3. Validate the file (or all examples):

   ```bash
   npm run card-template:validate -- path/to/template.json
   ```

4. Open a pull request with the template and any matching card image under
   `public/images/cards/`.

Maintainers verify the sources, then update the static Catalog with explicit,
immutable `catalogKey` values and exact benefit parent keys. A checked-in
Catalog change also needs a separately reviewed global synchronization plan,
existing-Physical-Card status propagation disposition, and Benefit Usage Guide
disposition. Read the [Catalog and Benefit Updates specification](../.trellis/spec/perks-reminder/catalog-and-benefit-updates.md)
before changing the source.

`prisma/seed.ts` consumes the static source for compatible database setup, but
editing or running the seed does not synchronize existing users. Any
database-backed synchronization is a separately authorized operation; the
operator defaults to a dry-run and uses the exact gates in the specification:

```bash
npm run sync:global-catalog -- --dry-run
```

Do not use legacy per-card update scripts or infer identity from a card name,
description, amount, array order, or database ID.

## Rules

- Include official issuer terms whenever possible and add community evidence
  only as supporting context.
- Include recurring statement or promotional credits, annual credits, spend
  thresholds, and certificate-style benefits that users can track.
- Do not model always-on access, insurance, elite status, or earning
  multipliers as recurring benefits unless product requirements change.
- Keep `imageUrl` pointed at an existing local file when the proposal includes
  an image, and record image provenance in the relevant documentation.
- Preserve existing `catalogKey` values. A genuinely new definition gets a new
  key; a changed or retired definition is never deleted and recreated.

## Benefit fields

- `frequency`: `MONTHLY`, `QUARTERLY`, `YEARLY`, or `ONE_TIME`
- `cycleAlignment`: `CARD_ANNIVERSARY` or `CALENDAR_FIXED`
- `fixedCycleStartMonth`: 1-12, only for fixed calendar windows
- `fixedCycleDurationMonths`: positive number of months in the fixed window
- `occurrencesInCycle`: optional count when multiple uses exist in one cycle
