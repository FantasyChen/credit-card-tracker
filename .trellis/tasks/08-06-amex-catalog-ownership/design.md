# Design — Neutral AMEX catalog ownership

## Deep neutral module

Create `src/lib/amex-catalog/` as the owner of AMEX product/benefit identity and pure matching policy:

- catalog registry and writable destinations;
- period keys and exact-range resolution;
- selection-text normalization;
- source-credit policy and structural source-period/quantity evidence types.

## Adapters

- Static catalog imports the neutral module without importing `amex-sync`.
- Browser observation imports neutral identity/policy and retains observation/storage/schema ownership.
- Server reconciliation imports neutral identity/policy and retains request, authority, proposal, repository, and persistence ownership.

The source-credit policy accepts structural evidence types so it does not import the browser observation contract. Reader compatibility re-exports may be temporary during the move but must not remain as a second authority.

## Invariants

- Exactly 12 products, 56 benefit identities, and 47 writable usage destinations.
- Catalog keys, product keys, credit-family keys, period keys, source semantics, and source credit keys remain byte-for-byte stable.
- Public catalog remains DB-free.
- Userscript envelope/storage/parser contracts and server confirmation behavior do not change.

## Rollout interaction

This refactor lands before the active rollout resumes. All affected catalog, userscript, request, authority, proposal, sync, privacy, and service tests must be rerun; no operational gate is exercised.
