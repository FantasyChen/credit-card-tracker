# Design — Legacy global-benefit migration

## 1. Operator contract

```text
npm run migrate:global-benefits -- --dry-run --limit=N [--after=CURSOR]
npm run migrate:global-benefits -- --apply --limit=N [--after=CURSOR] \
  --target-verified --confirm=<exact phrase>
```

No mode means dry-run. Rows are traversed in stable ID order with a bounded opaque cursor. The report contains aggregate examined/classified/bridged/custom/unresolved/conflict counts and closed reason codes; detailed IDs remain private operator data.

## 2. Classification

### Card

A card maps only when normalized storage values are already exact under the approved issuer/name contract and all non-null product evidence agrees with one `PredefinedCard.catalogKey`. Zero, multiple, or contradictory candidates stop the card.

### Benefit

- no linked card: custom;
- linked card with invalid ownership graph: unresolved and stop card;
- linked card with exactly one complete-shape global match: standard candidate;
- valid linked card with zero matches: custom;
- multiple matches, conflicting evidence, or duplicate standard destination: unresolved.

Complete shape compares all canonical definition values represented in persistence, including name, description, category, amount, frequency, cycle alignment, fixed-cycle start/duration, and other supported canonical attributes. IDs, ownership, timestamps, and AMEX keys are evidence/metadata rather than substitutes for shape equality. Active and retired definitions are both eligible so historical copies can resolve, but latest global fields become authoritative after linking.

## 3. Bridge apply

For each fully consistent card, one transaction:

1. re-read card, benefits, statuses, audits/provenance, destination definitions, and ledger state;
2. compare with the dry-run fingerprint and fail on drift;
3. set `CreditCard.predefinedCardId` where exact;
4. set standard status `creditCardId`/`predefinedBenefitId` while retaining `benefitId`;
5. preserve `updatedAt` explicitly/raw-SQL as needed and change no user-state field;
6. insert idempotent ledger entries keyed by legacy benefit;
7. verify before/after snapshots differ only in approved bridge/ledger metadata.

No status is created, deleted, merged, or recalculated.

## 4. Cleanup mode

Cleanup is a distinct command/mode, confirmation phrase, target verification, recovery point, and parity prerequisite. It selects only ledger-proven standard mappings, verifies every status/global relation, records the old ID in durable migration/audit metadata, nulls status `benefitId`, and deletes only the corresponding copied standard definition when no non-ledger/custom reference remains. Any uncertainty aborts the transaction.

## 5. Superseded and clone paths

The old AMEX catalog backfill apply exits before database mutation with a stable message directing operators to this migration. Dry-run classifier code may remain only as test/safety reference.

Single-user clone resolves source global links in the destination by immutable `catalogKey`, never source database IDs. It preserves custom definitions and validates bridge ledger/audit links under the existing sanitized clone contract.

## 6. Rollback

Before cleanup, rollback uses ledger entries and compare-and-set checks to clear only bridge-added global references and restore hybrid legacy reading; legacy rows and status links still exist. Cleanup crosses the deletion boundary and requires recovery capability. Afterwards rollback is forward repair or database recovery, not inferred recreation.
