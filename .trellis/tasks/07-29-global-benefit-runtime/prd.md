# Global benefit runtime

## Goal

Make global standard definitions the runtime source for new and existing active cards while preserving custom benefits, legacy compatibility, existing status state, and current browser/component contracts.

## Dependencies

- Depends on reviewed global catalog identities and additive schema from `07-29-global-catalog-foundation`.
- Must be complete and parity-tested before legacy cleanup or AMEX global-authority cutover.

## Requirements

1. Treat standard card/benefit fields as global and read-only. Users have no standard override, edit, or delete path; displays use the latest global terms.
2. Keep custom benefits user-owned, including standalone and valid card-linked custom rows. Card-linked creation must verify card ownership and be custom by construction.
3. Refactor card creation into one transaction that creates the physical card linked to a global product, its event, and standard statuses directly from active global definitions; do not create copied standard `Benefit` rows.
4. Generalize cycle materialization around cycle coordinates so global and custom sources share cycle logic without duplicating definition persistence.
5. Materialize missing standard statuses for every active physical card and every active global definition of its product. New definitions must propagate to existing active cards; retired definitions create no future statuses.
6. Never recompute or reset an existing cycle boundary, usage amount, completion, usability, timestamp, order, audit, or provenance merely because a global definition changes.
7. Provide one server-side effective-benefit projection for dashboard, home, APIs, notifications, calendar, and usage guides. It must support new global standard rows, bridge rows, legacy rows during rollback, standalone custom rows, and card-linked custom rows.
8. Preserve existing browser/component DTO shapes. Standard entries expose stable opaque identity but no mutation controls; usage guides resolve through direct global linkage rather than text heuristics.
9. Authenticated routes may adapt global database rows; public anonymous catalog routes remain DB-free.
10. Enforce authenticated ownership for all user-owned reads/writes and keep physical cards distinct by `CreditCard.id`.

## Acceptance Criteria

- [x] Card creation is atomic, creates no standard `Benefit`, and creates standard statuses linked to the correct physical card/global definitions.
- [x] Adding a global definition reaches every existing active linked card; retirement blocks future materialization while old statuses remain visible.
- [x] Standard fields show latest global values and cannot be overridden, edited, or deleted by users.
- [x] Existing cycles and status/audit/provenance state remain byte-for-byte unchanged when definitions synchronize or materialization reruns.
- [x] Global standard, bridge, legacy, standalone custom, and card-linked custom records project into compatible DTOs.
- [x] Custom creation verifies ownership and custom statuses continue using shared cycle logic.
- [x] Cron/materialization is idempotent and bounded; duplicate physical products remain separate.
- [x] Targeted runtime/action/route/projection tests, strict TypeScript, public-DB invariant, sensitive-pattern review, and `git diff --check` pass safely.

## Out of Scope

- Classifying/applying legacy migration, deleting copied standard rows, AMEX authority changes, schema deployment, or production rollout.
- Standard definition history or per-user standard overrides.
