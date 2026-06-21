# Card Template Contributions

This folder is the public-friendly intake path for predefined card updates.
Perks Reminder still seeds production catalog data from `prisma/seed.ts`, but
new card and benefit corrections can start here as one JSON file per card.

## Workflow

1. Copy `examples/chase-sapphire-preferred-2026.json`.
2. Replace the card metadata, benefits, and source links.
3. Run `npm run card-template:validate -- path/to/template.json`.
4. Open a PR with the template and any matching card image under
   `public/images/cards/`.

Maintainers then convert accepted templates into `prisma/seed.ts` and, when
needed, run the existing benefit migration flow so current users receive the
updated benefits and materialized statuses.

## Rules

- Include official issuer terms whenever possible.
- Use community or forum data points as supporting context, not as the only
  source for issuer-published benefits.
- Include recurring statement credits, promo credits, annual credits, spend
  thresholds, and certificate-style benefits that users can track.
- Do not include always-on access, insurance, elite status, or earning
  multipliers unless they are useful notes for reviewers.
- Keep `imageUrl` pointed at an existing local file if the PR includes an image.

## Benefit Fields

- `frequency`: `MONTHLY`, `QUARTERLY`, `YEARLY`, or `ONE_TIME`
- `cycleAlignment`: `CARD_ANNIVERSARY` or `CALENDAR_FIXED`
- `fixedCycleStartMonth`: 1-12, only for fixed calendar windows
- `fixedCycleDurationMonths`: number of months in the fixed window
- `occurrencesInCycle`: optional count when multiple uses exist in one cycle
