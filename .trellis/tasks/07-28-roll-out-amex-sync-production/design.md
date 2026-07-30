# Design — Global-benefit normalization and production gate

## 1. Parent boundary

This task is the architecture and rollout gate for five independently reviewable children. It no longer authorizes the prior operational AMEX key rollout. Application/schema/tooling work belongs to children 1–4; all development and production operations belong to child 5.

Production capability remains:

```text
AMEX off (current)
  -> global schema/catalog/runtime ready
  -> legacy bridge and parity ready
  -> global AMEX authority ready
  -> separately authorized preview
  -> separately authorized write
  -> off (immediate capability rollback)
```

## 2. Target ownership model

### Global definitions

- Existing `PredefinedCard` and `PredefinedBenefit` rows are the canonical catalog.
- Every source card and benefit has an explicit immutable `catalogKey`; AMEX provider identity is stored only on global definitions.
- Global rows are retired rather than deleted while referenced. Key-based synchronization preserves IDs and updates approved canonical fields.
- Global fields are read-only to users and latest terms are projected everywhere; there is no standard-definition override or revision layer.

### User-owned data

- `CreditCard` remains a physical owned card and links to one global product through `predefinedCardId` when standard.
- `Benefit` becomes the custom-definition model. Valid standalone and card-linked custom rows remain owned and retain identity.
- A standard `BenefitStatus` links the owner, physical card, and global benefit definition; a custom status links a custom `Benefit`.
- During the bridge, a migrated standard status may retain its legacy `benefitId` while the ledger proves its origin. Final source constraints are enforced only after parity and separately gated cleanup.
- Relations to global definitions restrict deletion. Partial uniqueness protects standard and custom cycle occurrences independently.

## 3. Effective projection and propagation

One server-side effective-benefit projection serves dashboards, home data, APIs, notifications, calendar logic, and usage-guide resolution:

- standard source: global card/benefit definition plus user status/card state;
- custom source: user `Benefit` plus user status state;
- bridge source: global fields are authoritative when a global link exists, while legacy links remain available for rollback;
- output: the existing browser/component DTO shape.

Standard definitions expose no edit/delete authority. New active global benefits materialize missing statuses for every existing active linked card. Retired definitions stop future materialization, while prior statuses remain visible. No definition update recalculates an existing cycle or state.

Public anonymous catalog routes remain database-free through `src/lib/static-catalog.ts`.

## 4. Legacy classification and transition

The migration is deterministic, bounded, resumable, and dry-run-first:

1. map a card only when exact issuer/name and all existing identity evidence agree with exactly one global product;
2. preserve standalone benefits as custom;
3. map a card-linked benefit only when every canonical shape field agrees with exactly one active or retired global definition and ownership/status/audit relationships are consistent;
4. preserve valid unmatched rows as custom and stop the card on ownership/cross-user inconsistency;
5. update existing statuses in place with bridge references while preserving all pre-existing fields, timestamps, audits, provenance, and order;
6. record one ledger entry per legacy benefit;
7. clean up only ledger-proven standard copies under a separate confirmation after hybrid-read parity.

The legacy `backfill:amex-catalog --apply` is disabled with a stable superseded response. Its exact-matching logic may be consulted only as classifier/safety reference.

## 5. AMEX authority

AMEX resolves physical-card product identity through `CreditCard.predefinedCard` and destination identity through `PredefinedBenefit` plus standard `BenefitStatus`. Proposal and confirmation bind and transactionally revalidate the physical card, global keys/IDs, definition fingerprint, exact status/cycle occurrence, before-state, ownership, exact last five, and provenance order.

Envelope V3, userscript/mailbox, preview/confirm request shapes, and public response DTOs remain compatible. Preview remains read-only; confirmation retains HMAC, compare-and-set, audits, provenance, and December atomicity.

## 6. Rollout gates

Each gate is independently reviewed:

1. additive migration SQL and catalog validation;
2. verified development migration/client generation;
3. runtime and materialization tests plus development parity;
4. migration dry-runs, bridge apply on development, and deterministic rerun;
5. AMEX global-authority synthetic/local validation;
6. immediate production target verification and recovery point;
7. separately authorized production schema/catalog/bridge phases;
8. global-first parity and separately authorized ledger cleanup;
9. separately configured preview and attended canary;
10. separate write-mode decision.

Any uncertain target, catalog-key drift, ownership inconsistency, non-exact mapping, duplicate destination, status-state rewrite, parity failure, or effective AMEX mode other than `off` before activation stops the rollout.

## 7. Historical evidence boundary

The sanitized 2026-07-29 production target/migration inspection, five-page per-user-key dry-run, zero-status projection, and userscript artifact checks remain preserved in `implement.md` and `research/production-backfill-review.md`. Those observations describe the superseded per-user key architecture. They may inform scale and diagnostics, but are stale for the new schema, classifier, global status model, and apply sequence; they provide no authorization and cannot satisfy a new gate.

## 8. Rollback shape

Before cleanup, rollback clears only ledger-recorded bridge references and returns readers to hybrid legacy behavior while copied rows still exist. Cleanup requires a recovery point and separate authorization. After standard-copy deletion, rollback is forward repair or database recovery, never inferred blanket status reversal. Legacy-column and ledger removal is deferred beyond this task tree.
