# Apply production category-drift repair

## Goal

Remove the duplicate standard-benefit entries caused by category-only legacy/global
definition drift while preserving the exact history-bearing `BenefitStatus` identity,
usage, completion, cycles, timestamps, audit, and provenance state.

## Background

The production global-benefit rollout materialized canonical standard statuses while
some ownerless card-linked legacy definitions remained classified custom because
their category differed from the canonical definition. This created two visible
statuses for the same physical card, canonical benefit, cycle, and occurrence.

The repair implementation and additive evidence migration are complete. A second
isolated-development rehearsal passed deterministic discovery, apply/replay,
runtime authority, mutable keeper-state preservation, rollback/reapply,
provenance-drift refusal, final graph equality, and exact fixture cleanup. Production
AMEX is configured `off`; a Ready schema-compatible deployment serves the primary
alias, and an authenticated preview request returned HTTP `503`, proving effective
off behavior. Production repair tables have not been deployed and no production
repair discovery or write has run.

## Requirements

1. Cover every safely eligible production account represented by the complete reviewed manifest inventory. Do not narrow the repair to the requesting account; conflicting, ambiguous, drifted, or otherwise ineligible units remain unchanged.
2. Create and verify a fresh provider-native recovery point from the exact production branch before production schema or repair writes.
3. Apply only the reviewed additive category-repair migration, with immediate application/direct database identity verification and independent post-migration status evidence.
4. Release the reviewed schema-dependent application only after the migration exists; verify the immutable Ready deployment and primary-alias deployment IDs match before repair-table reads.
5. Add and review an aggregate-only parity verifier that captures private pre-apply authority and proves exact allowed deltas after apply without exposing identities, fingerprints, or row values.
6. Run deterministic bounded discovery twice across the complete inventory and retain private manifests, cursors, row identities, and fingerprints only in permission-restricted temporary operator storage.
7. Repair only manifest-covered ownerless card-linked legacy definitions that match one canonical same-product definition after excluding category alone; all other fields and non-null provider identity must agree.
8. Preserve the history-bearing status ID and every user-state/audit/provenance field. Store complete rollback evidence before deleting only an exact redundant loser occurrence.
9. Block and leave unchanged every conflicting, ambiguous, attached, cross-owner, non-exact, drifted, or unmanifested unit.
10. Apply in bounded reviewed pages with immediate target, recovery, effective-AMEX-off, inventory, manifest, page-fingerprint, and exact-confirmation checks at every writer boundary.
11. Prove post-apply duplicate suppression, canonical effective authority, exact keeper-state preservation, audit/provenance parity, idempotent replay, and no unrelated-row changes using aggregate-only evidence.
12. Keep AMEX `off`; do not perform strict legacy cleanup, delete repair evidence, or reactivate preview/write as part of this task.
13. Do not read, create, copy, or modify `.env`; production URLs and private repair artifacts remain process/private operator inputs and never enter Git or console evidence.
14. Stop without compensating writes on any target, recovery, migration, deployment, manifest, fingerprint, graph, state, CAS, provenance, catalog, postimage, or parity mismatch.

## Acceptance Criteria

- [ ] A fresh production recovery point and exact application/direct target identity are verified without exposing private values.
- [ ] The additive repair migration is the only intended schema change, applies successfully, and independent status/table checks pass.
- [ ] The reviewed application deployment is Ready and the primary alias resolves to the same deployment before repair-table access.
- [ ] A reviewed parity verifier captures private pre-apply baselines and emits only closed aggregate/boolean results.
- [ ] Two discovery passes produce identical bounded aggregate plans and private manifests with no leaked identities or fingerprints.
- [ ] Every safely eligible manifest-covered unit across all production accounts is applied or idempotently replayed; no eligible page is silently omitted.
- [ ] Every applied unit preserves its keeper status identity and exact protected/mutable user state while removing only the reviewed redundant occurrence.
- [ ] Conflicting or ineligible units are reported as closed aggregate stops and receive no write.
- [ ] Bounded apply replay is idempotent and post-repair aggregate parity reports no unexpected user, status, audit, provenance, or unrelated-row effect.
- [ ] Authenticated dashboard verification shows one canonical entry with preserved usage/history for a representative repaired duplicate.
- [ ] AMEX remains effectively `off`; cleanup/reactivation remain separately gated.
- [ ] All operational results are recorded as sanitized aggregates and all private manifests/temporary credentials remain outside Git.

## Out of Scope

- Automatically resolving conflicting meaningful state or ambiguous/non-category drift.
- Strict legacy-definition cleanup or deletion of category-repair evidence/preimages.
- AMEX preview/write reactivation, userscript activity, provider scans, or proposal confirmation.
- Schema changes other than the checked-in additive category-repair migration.
- Manual dashboard deduplication or use of superseded duplicate-status scripts.
