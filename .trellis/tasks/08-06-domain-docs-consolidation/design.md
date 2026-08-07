# Design — Domain and project documentation

## Canonical memory

- Root `CONTEXT.md` owns concise domain language only.
- `.trellis/spec/` owns executable contracts and safety rules.
- README owns product overview and a safe, minimal developer entry point.
- CONTRIBUTING owns contribution flows and links to authoritative specs.
- Historical plans belong in `docs/archive/` only when they retain durable context; otherwise delete them.

## Classification

- Rewrite: README, CONTRIBUTING, current operational references.
- Archive or delete: completed `PLAN.md` slices, expired migration/email/SEO plans, completed Superpowers artifacts.
- Preserve: current safety runbooks, AMEX handoff guide, card-image provenance, usage sources, version history.
- Catalog-specific operator docs are handed to the catalog child.

## Verification

Use repository link/path searches and command-name checks. Do not execute database, build, email, provider, or deployment instructions while verifying documentation.
