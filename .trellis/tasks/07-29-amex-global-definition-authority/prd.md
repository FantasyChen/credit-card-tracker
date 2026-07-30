# AMEX global-definition authority

## Goal

Cut AMEX destination authorization over from duplicated user-row keys to global product/benefit definitions and standard statuses while preserving every established read-only preview, confirmation, audit, provenance, privacy, and public contract.

## Dependencies

- Depends on completed global catalog foundation, global-benefit runtime, and development-validated legacy bridge contracts.
- Production AMEX remains effectively `off`; activation belongs only to `07-29-production-global-benefit-rollout`.

## Requirements

1. Resolve destination product identity through the owned active physical card's `predefinedCard` relation, never `CreditCard.productKey`.
2. Resolve destination benefit identity through global `PredefinedBenefit` and a standard `BenefitStatus`, never user `Benefit` product/family/period keys.
3. Require exact global catalog key/AMEX tuple parity and writable source semantics; custom, unresolved, retired-without-existing-status, and legacy-only destinations receive no write authority.
4. Bind the proposal to user, physical card ID, exact last five, global product/benefit IDs and keys, global definition fingerprint, status ID, occurrence, exact persisted cycle instants, source period, before-state, transition time, and provenance order.
5. During confirmation, transactionally reload and revalidate ownership, active AMEX lifecycle, physical/global relations, exact last five, writable tuple, definition fingerprint, status occurrence/cycle, before-state, and monotonic provenance before compare-and-set.
6. Preserve explicit-field reconciliation, not-usable fail-closed behavior, completion timestamp semantics, atomic December Uber split, row failure isolation, idempotent attempts, audits, and provenance.
7. Add global destination metadata to audits while retaining status/audit IDs and sufficient legacy destination metadata for rollback/diagnosis.
8. Keep envelope V3, mailbox, browser projection, userscript, preview/confirm requests, public response DTOs, origin/auth/privacy boundaries, and card-prerequisite behavior unchanged.
9. A catalog/global definition fingerprint change after preview requires re-preview; latest global terms are authoritative and users cannot override them.
10. Disable any remaining user-key authority and keep the old per-user key backfill apply superseded.

## Acceptance Criteria

- [x] Product and benefit authorization succeeds using only owned physical-card/global-definition/status relations and fails if only user keys match.
- [x] Custom, unresolved, ambiguous, non-writable, inactive, wrong-owner, wrong-last-five, or relation-conflicting destinations fail closed.
- [x] Proposal/confirmation detect definition, card, cycle, before-state, or provenance drift and write no successful state on conflict.
- [x] Exact persisted inclusive cycle instants are used in the transaction compare-and-set.
- [x] Explicit amount/completion semantics, December atomicity, audit/provenance, replay, and partial retry remain intact.
- [x] Public V3, userscript, mailbox, API request, and response contracts remain compatible.
- [x] Audits identify the global destination without dropping legacy diagnostic continuity.
- [x] Targeted authority/repository/service/proposal/route tests, strict TypeScript, public-DB and userscript checks, sensitive-pattern review, and `git diff --check` pass safely.

## Out of Scope

- Browser-reader observation changes, legacy cleanup, production configuration/deployment, userscript installation/publication, live provider scan, browser-route confirmation, or production preview/write activation. Synthetic verified-development service validation is recorded in `implement.md`.
