# Design — AMEX global-definition authority

## 1. Authority graph

```text
provider evidence
  -> independent browser/server source resolution
  -> owned active CreditCard
  -> CreditCard.predefinedCard
  -> writable PredefinedBenefit for that global product/tuple
  -> standard BenefitStatus(creditCardId, predefinedBenefitId, userId, occurrence/cycle)
```

A user `CreditCard.productKey`, user `Benefit` key tuple, saved external mapping, card name, four-digit suffix, or custom/legacy-only benefit cannot authorize a destination.

## 2. Repository projection

The repository returns a closed authority record containing physical-card ownership/lifecycle/issuer/exact last five, global product ID/key, global benefit ID/key/AMEX tuple/writable semantics/retirement state, standard status identity and exact persisted cycle, and current state/provenance. The service does not receive mutable user definition fields as standard authority.

Retired definitions can authorize only an already-existing standard status when the reviewed reconciliation contract permits that historical destination; they never cause materialization. Ambiguous/duplicate relations fail closed.

## 3. Definition fingerprint and proposal

A deterministic fingerprint covers every global field relevant to destination identity, write semantics, period/cycle interpretation, and projected display amount/completion constraints. The HMAC proposal binds that fingerprint plus:

- user and physical card;
- exact five digits;
- global product/benefit IDs and catalog/AMEX keys;
- status ID, occurrence, exact persisted cycle start/end;
- source period/evidence and ordered row/group identity;
- before-state, provenance, transition time, mode, and expiry.

A global catalog update after preview invalidates confirmation rather than silently applying against changed terms.

## 4. Transactional confirmation

Within the existing serializable group transaction, reload the complete authority graph and compare every bound field. Validate source period by UTC calendar dates, then use the transaction-loaded exact persisted cycle instants for the final compare-and-set. Write status, provenance, and row audit atomically; grouped December rows succeed or fail together.

Audit records gain `destinationPredefinedBenefitId` and bounded legacy destination metadata while retaining existing status/attempt/audit identity and no sensitive provider values.

## 5. Compatibility

Browser and public server boundaries do not change: envelope V3, mailbox, handoff targets, exact-origin/auth/content-type checks, preview/confirm DTOs, card skips, userscript identities, and response validation remain as specified. Only server-internal destination authority and audit metadata change.

Preview makes no durable write. Production mode remains off throughout implementation and synthetic/local validation.

## 6. Rollback

Before production activation, rollback is code-level return to the hybrid runtime while preserving additive global/audit metadata. Do not re-enable user-key apply. After global authority is used in production, capability rollback is mode `off`; data diagnosis uses global/legacy audit metadata and a separately reviewed forward fix.
