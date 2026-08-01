# Production global-benefit rollout

## Goal

Operationally migrate and validate the global-benefit model in development and production, then stage AMEX preview/write activation only through separately authorized, observable, reversible gates.

## Dependencies

- Last child. It cannot start operational work until global catalog foundation, global runtime, legacy migration tooling, and AMEX global-definition authority are implemented, checked, and development-validated.
- Parent `.trellis/tasks/07-28-roll-out-amex-sync-production` remains the final gate.

## Requirements

1. Keep production AMEX effectively `off` until new schema, catalog, runtime, legacy bridge, global AMEX authority, target, recovery, and parity evidence all pass.
2. Treat migration inspection/deploy, catalog dry-run/apply, legacy migration dry-run/bridge, cleanup, application deployment, HMAC configuration, preview, userscript installation, live scan, and write as separate authorization boundaries.
3. Immediately verify exact Vercel/database targets and migration state before each consequential operation without exposing secrets, database identity, user/record values, provider payloads, card endings, or tokens.
4. Validate additive migration SQL and all data/runtime behavior on the verified development target before production.
5. Generate fresh bounded, deterministic dry-run evidence from the new catalog and legacy operators. Earlier per-user AMEX-key counts are historical only and cannot satisfy a gate.
6. Apply only exact global catalog synchronization and exact/unique/full-shape legacy mappings. Preserve custom and unresolved rows; never run the superseded per-user AMEX key apply.
7. Require bridge parity proving status identity/state/cycles/timestamps/audits/provenance are unchanged before any cleanup or global-only cutover.
8. Cleanup only ledger-proven copied standard definitions under a separate recovery point and explicit confirmation. Retain legacy columns and ledger through the rollback window.
9. Verify latest global terms, no overrides, and propagation of new definitions to existing active cards without rewriting existing status state.
10. Enable `preview` only after global AMEX authority is deployed and prerequisites pass. Preview must make no status/attempt/audit/provenance mutation.
11. Publish/install the audited userscript only through an owner-approved procedure; live provider scan requires attended authorization.
12. Enable `write` only after a separate decision based on sanitized preview evidence; first confirmation is bounded and reconciled against attempts, audits, provenance, and destination state.
13. Set/retain mode `off` and stop on target uncertainty, migration/parity drift, catalog-key drift, non-exact mapping, ownership inconsistency, unexpected write/materialization, audit mismatch, privacy risk, or failed canary.

## Acceptance Criteria

- [x] Children 1–4 completion and safe checks are reviewed before any operation.
- [x] Development migration, catalog sync, bridge, hybrid parity, pre-cleanup rollback/re-bridge rehearsal, propagation, and AMEX synthetic service validation pass on a verified non-production target; deletion cleanup remains separately gated.
- [x] Fresh production dry-runs reconcile every row to exact standard or preserved custom outcomes with no unresolved unit and no fuzzy inference.
- [x] Production bridge preserves every pre-existing status/state/cycle/timestamp/audit/provenance field and is deterministic/idempotent.
- [ ] Cleanup, if authorized, removes only ledger-proven standard copies and has a tested recovery point.
- [x] Standard definitions are read-only, latest global terms are visible, and catalog additions reach existing active cards without state resets.
- [x] The reviewed application release is merged and deployed with AMEX `off`; anonymous core smoke and post-deployment catalog/bridge invariants pass.
- [x] The old per-user AMEX key apply is not executed and user keys have no runtime authority.
- [x] Preview is authenticated and zero-write; userscript installation and live scan remain unperformed and separately gated.
- [ ] Write, if authorized, is bounded and reconciles expected attempts/audits/provenance/status changes with no unrelated account effects.
- [ ] Rollback to mode `off` and pre-cleanup bridge rollback are operationally verified; evidence is sanitized.

## Out of Scope

- Dropping legacy identity columns or migration ledger after the rollback window.
- Definition revision history, per-user standard overrides, automatic preview-to-write promotion, or unapproved production repair.
