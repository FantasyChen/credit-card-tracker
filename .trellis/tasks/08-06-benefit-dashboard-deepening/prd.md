# Deepen benefit dashboard projection

## Goal

Concentrate dashboard and home effective-benefit reads, claimed-value semantics, and projection behavior behind a deeper module.

## Requirements

- Preserve the standard/bridge/custom/legacy effective source union.
- Resolve the intended meaning of home `totalClaimedValue` and test it across source kinds and history.
- Define home `totalClaimedValue` as value recorded during the current calendar year across the effective standard/bridge/custom/legacy source union; compare it with current annual fees for net annual-fee position.
- Move caller-owned dashboard assembly, authoritative card terms, usage-guide fallback, deduplication, tabs, totals, and ROI toward one deep module.
- Keep physical cards distinct by `CreditCard.id`.

## Acceptance Criteria

- [ ] Benefits and home callers no longer recreate effective read semantics or coordinate shallow helper modules.
- [ ] One interface is the main dashboard test surface; internal refactors do not require caller-test rewrites.
- [ ] Standard, bridge, custom, legacy, duplicate-card, history, guide, and ROI scenarios retain intentional behavior.
- [ ] Prior-year statuses do not contribute to home claimed value; completed and partial current-year usage does.
- [ ] Public and authenticated database-read contracts remain unchanged.

## Decision

- Home claimed value and net annual-fee position use the current calendar year.
