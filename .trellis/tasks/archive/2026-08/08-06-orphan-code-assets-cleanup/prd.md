# Remove orphan code and assets

## Goal

Delete verified orphan modules, routes, dependencies, scripts, and assets with external-consumer safeguards.

## Requirements

- Delete only after the deletion test and an inbound-consumer audit.
- Treat route modules and `public/` files as removable when repository-wide search finds no references; production traffic verification is not required by user decision.
- Remove dependencies only after every live import and build/tooling use is ruled out.
- Include orphan candidates such as the no-op benefit action, unused search/drag UI, unused logger, test analytics probe, stale comments, unreferenced starter assets, and unowned one-off scripts.

## Acceptance Criteria

- [ ] Every deletion has recorded repository evidence; direct route and public asset deletion does not require production traffic evidence.
- [ ] Package manifest and lockfile no longer retain packages used only by deleted modules.
- [ ] Maintained search, monitoring, dashboard, PWA, and operational paths still pass targeted checks.
- [ ] Repository-wide searches show no remaining references to deleted routes or assets.
