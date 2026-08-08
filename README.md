# Perks Reminder

Perks Reminder is a free, open-source credit card benefit tracker. It tracks recurring credits, Benefit Cycles, claimed value, annual fees, loyalty expirations, and practical Benefit Usage Guides without connecting to bank accounts.

[Open Perks Reminder](https://www.perks-reminder.com/)

## Product model

- A Physical Card is always tracked separately, even when a user owns several copies of the same product.
- Standard Card Definitions and Standard Benefit Definitions come from the shared Catalog.
- Custom Benefit Definitions remain user-owned.
- Benefit Status stores usage state for one Benefit Cycle.
- Every account receives unlimited cards, reminders, custom reminder timing, loyalty tracking, and import/export.

See [CONTEXT.md](CONTEXT.md) for the project vocabulary.

## Features

- Monthly, quarterly, yearly, anniversary, and multi-year Benefit Cycles
- Completion, partial completion, and not-usable tracking
- Claimed-value and annual-fee ROI summaries
- Duplicate Physical Card labels using nickname and stored ending digits
- Benefit Usage Guides with qualification, timing, and caveats
- Email reminders and loyalty-expiration tracking
- Data import/export and bulk card onboarding
- Optional manual AMEX Observation and confirmation workflow
- Installable PWA and focused Capacitor iOS shell

## Technology

- Next.js 15, React 19, and TypeScript
- PostgreSQL through Prisma
- NextAuth authentication
- Resend transactional email
- Vercel hosting and cron scheduling
- Jest and Playwright tests

## Local development

Install dependencies and start the application using an already configured local environment:

```bash
npm install
npm run dev
```

Secrets and runtime configuration are intentionally not documented in tracked project files. Do not create or copy `.env` files from repository instructions. Project operators manage configuration through approved local state and provider dashboards.

Before any database command, read:

- [.trellis/spec/perks-reminder/database-and-data-safety.md](.trellis/spec/perks-reminder/database-and-data-safety.md)
- [.trellis/spec/perks-reminder/deployment-and-external-effects.md](.trellis/spec/perks-reminder/deployment-and-external-effects.md)

## Safe verification

These checks do not require a database or production access:

```bash
npm test -- --runInBand
npx tsc --noEmit --pretty false --incremental false
npm run check:public-db
npm run card-template:validate
npm run check:amex-userscripts
```

Do not use `npm run build` as a routine verification command. Follow [.trellis/spec/perks-reminder/verification.md](.trellis/spec/perks-reminder/verification.md) when selecting checks.

## Catalog contributions

The checked-in DB-free Catalog lives in `src/lib/static-catalog.ts`. `card-templates/` is the contributor intake format:

```bash
npm run card-template:validate
```

A Catalog change is not complete until immutable keys, global synchronization, existing-card status propagation, and Benefit Usage Guide disposition are addressed. `prisma/seed.ts` consumes the shared source but is not the normal rollout mechanism.

Read:

- [.trellis/spec/perks-reminder/catalog-and-benefit-updates.md](.trellis/spec/perks-reminder/catalog-and-benefit-updates.md)
- [card-templates/README.md](card-templates/README.md)
- [docs/community-data-quality-loop.md](docs/community-data-quality-loop.md)

## Project guidance

- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution workflow
- [AGENTS.md](AGENTS.md) — Trellis entry point and safety boundary
- [.trellis/spec/perks-reminder/index.md](.trellis/spec/perks-reminder/index.md) — domain, database, catalog, AMEX, and deployment contracts
- [.trellis/spec/frontend/index.md](.trellis/spec/frontend/index.md) — frontend engineering contracts
- [docs/version-history.md](docs/version-history.md) — user-facing release history

## License

MIT. See [LICENSE](LICENSE), [PRIVACY.md](PRIVACY.md), and [TERMS.md](TERMS.md).
