# Global-benefit normalization and production gate

## Goal

Coordinate the migration from per-user copies of standard card benefits to canonical global card and benefit definitions, and remain the final gate for any development migration or production rollout. This parent supersedes the former per-user AMEX catalog-key rollout plan.

## Product Decisions

- `PredefinedCard` and `PredefinedBenefit` are the global, read-only standard catalog; users cannot override standard fields.
- Standard displays use the latest global terms. Definition revision history is not required.
- Catalog additions and approved changes propagate to every existing active card of that product without resetting or recalculating existing cycle boundaries, usage, completion, usability, timestamps, audits, or provenance.
- Custom benefits remain user-owned. Valid standalone and card-linked custom rows are preserved.
- A legacy row may map to a standard definition only through an exact, unique, full-shape match. Ambiguous, conflicting, inconsistent, or unmatched valid rows remain custom or unresolved; no fuzzy, description-only, or nearest match is allowed.
- Production AMEX synchronization remains effectively `off` until the entire new rollout gate is separately satisfied and authorized.

## Child Task Map and Ordering

1. `07-29-global-catalog-foundation` — durable catalog identities, additive schema, and key-based catalog synchronization.
2. `07-29-global-benefit-runtime` — global standard-status materialization, hybrid projection, and read-only standard behavior; depends on child 1.
3. `07-29-legacy-global-benefit-migration` — exact classifier, bridge/ledger operator, and separately gated cleanup; depends on children 1 and 2.
4. `07-29-amex-global-definition-authority` — AMEX resolution and write authority through global definitions/statuses; depends on children 1–3 and preserves public V3 contracts.
5. `07-29-production-global-benefit-rollout` — operational development/production migration and activation gates; depends on completion and review of children 1–4.

The tree records ownership, not dependency by itself; each child repeats its dependencies and stop conditions.

## Requirements

1. The parent remains a coordination and production gate, not an application-code implementation target.
2. Each complex child must have reviewed `prd.md`, `design.md`, `implement.md`, and real implementation/check context manifests before it is started.
3. Additive schema and catalog work must be reviewed and validated on a verified development target before any production database operation.
4. Runtime compatibility must support global standard statuses, custom benefits, and legacy bridge rows before legacy cleanup.
5. Migration must preserve existing user status identity and state, record auditable legacy mappings, and preserve custom/unresolved rows.
6. AMEX must use global product/definition authority rather than user-row identity keys while retaining preview, confirmation, proposal, audit, provenance, and atomicity guarantees.
7. Production migration, catalog synchronization, legacy bridge, cleanup, HMAC configuration, preview enablement, userscript installation, live scan, and write mode are independent authorization boundaries.
8. The old `backfill:amex-catalog --apply` path is superseded. It must not be used to populate per-user AMEX identity keys, including the previously discussed strict partial apply.
9. Earlier sanitized production inspection, dry-run, projection, and artifact evidence is retained as historical evidence only. It does not describe or authorize the new migration apply plan and must be regenerated under the new operators before any decision.

## Acceptance Criteria

- [x] Children 1–4 are implemented, checked, and development-validated in order.
- [x] Hybrid runtime parity is demonstrated before any legacy cleanup or AMEX authority cutover.
- [x] The new migration dry-run reconciles every legacy row as standard, custom, or unresolved without fuzzy inference or data loss.
- [x] Standard definitions are globally read-only and latest-term catalog changes reach existing active cards without rewriting existing status state/cycles.
- [x] The old per-user AMEX key apply is disabled and documented as superseded.
- [x] Production remains effectively `off` until child 5 receives separate, attended authorization for each operational boundary.
- [ ] Final production evidence proves target, migration, parity, audit, rollback, and privacy requirements without exposing sensitive data.

## Out of Scope

- Production migration/database/configuration/deployment, live provider action, userscript installation/publication, or git operation without its own rollout authorization.
- Development cleanup remains a separate deletion/recovery boundary from the completed bridge and rollback/re-bridge validation.
- Definition-version history or per-user overrides of standard definitions.
- Dropping legacy columns or migration-ledger data before a separately planned rollback-window task.
