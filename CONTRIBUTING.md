# Contributing to Perks Reminder

Thank you for helping improve Perks Reminder. Contributions should preserve the project vocabulary in [CONTEXT.md](CONTEXT.md) and the executable contracts under `.trellis/spec/`.

## Before you begin

1. Read [AGENTS.md](AGENTS.md).
2. Read [.trellis/spec/perks-reminder/index.md](.trellis/spec/perks-reminder/index.md).
3. For frontend changes, also read [.trellis/spec/frontend/index.md](.trellis/spec/frontend/index.md).
4. Follow the linked checklist documents for the files and behavior you will change.

Never read, create, copy, or modify `.env`. Do not run database, build, deployment, cron, email, notification, Vercel, or live-provider operations without satisfying the target-verification and authorization rules in the specs.

## Development

With an already configured local environment:

```bash
npm install
npm run dev
```

The repository uses strict TypeScript, Next.js App Router, React Server and Client modules, Prisma, Jest, and Playwright.

## Repository structure

```text
src/app/          routes, pages, server actions, and cron entrypoints
src/components/   shared UI modules
src/lib/          reusable domain and application logic
src/userscripts/  AMEX userscript entry and runtime modules
prisma/           schema and migration history
scripts/          explicit operational or verification tooling
card-templates/   contributor-facing Catalog intake
docs/             current runbooks, provenance, and archived history
.trellis/spec/    durable engineering contracts
```

## Catalog and benefit updates

Use `card-templates/` for structured contribution intake and `src/lib/static-catalog.ts` as the checked-in DB-free Catalog source.

```bash
npm run card-template:validate
```

Every Standard Card Definition and Standard Benefit Definition has an immutable `catalogKey`. Do not rename or reuse keys, infer identity from mutable text, or treat a seed edit as an existing-user rollout.

A complete Catalog change addresses:

1. verified source terms and provenance;
2. the key-preserving static Catalog edit;
3. global synchronization disposition;
4. missing Benefit Status propagation for existing active Physical Cards;
5. Benefit Usage Guide and retired/prior-status disposition.

Follow [.trellis/spec/perks-reminder/catalog-and-benefit-updates.md](.trellis/spec/perks-reminder/catalog-and-benefit-updates.md). Database-backed synchronization remains separately authorized even in dry-run mode.

## Card images

Use the documented ingestion and provenance process:

- [docs/card-image-ingestion.md](docs/card-image-ingestion.md)
- [docs/card-image-sources.md](docs/card-image-sources.md)

Do not download or replace images without recording an approved source.

## Code changes

- Keep domain behavior behind its owning module.
- Prefer deep modules with a small interface and test through that interface.
- Search before changing constants, payload fields, shared types, or helper logic.
- Preserve authenticated ownership checks and server-side validation for durable mutations.
- Keep anonymous public Catalog routes DB-free.
- Keep Physical Cards distinct by `CreditCard.id`.
- Add explicit types at wire and caller-branching interfaces.
- Preserve accessibility, loading, error, empty, and populated states for changed UI.

## Tests and safe checks

Choose checks from [.trellis/spec/perks-reminder/verification.md](.trellis/spec/perks-reminder/verification.md). Common safe checks include:

```bash
npm test -- --runInBand
npx tsc --noEmit --pretty false --incremental false
npm run check:public-db
npm run card-template:validate
npm run check:amex-userscripts
git diff --check
```

Run focused tests first, then the broader safe suite appropriate to the change. Do not substitute a production-affecting command for a static check.

## Pull requests

Describe:

- the user-visible or domain outcome;
- the owning modules and interfaces changed;
- relevant invariants and safety constraints;
- tests run and checks intentionally skipped;
- Catalog provenance or migration disposition when applicable;
- rollback considerations for risky changes.

Keep changes scoped. Unrelated cleanup belongs in a separate task unless it is required for the selected implementation.

## Reporting data issues

Use the correction links on card, benefit, and Benefit Usage Guide surfaces, or open a GitHub issue with the affected card/benefit, current source, expected terms, and supporting issuer/community evidence.

See [docs/community-data-quality-loop.md](docs/community-data-quality-loop.md) for the maintainer review flow.
