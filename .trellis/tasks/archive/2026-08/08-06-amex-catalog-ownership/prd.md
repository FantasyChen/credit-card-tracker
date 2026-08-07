# Neutralize AMEX catalog ownership

## Goal

Remove public catalog and reader/sync cross-import leakage while preserving one canonical AMEX identity source.

## Requirements

- Preserve one canonical source for all 12 AMEX products, 56 benefit rows, and 47 writable usage destinations.
- Preserve public DB-free catalog behavior and userscript bundle constraints.
- Remove reader/sync cross-import leakage while retaining normalization, identity, source-credit policy, and destination authority semantics.
- Coordinate file moves and contracts with active AMEX rollout tasks; do not change production mode, provider state, or reconciliation behavior.
- This refactor runs before the active rollout resumes; affected rollout verification must be rerun after module ownership changes.

## Acceptance Criteria

- [ ] Public catalog modules no longer depend on integration-specific implementation ownership.
- [ ] Browser observation and server reconciliation share neutral domain definitions without a cyclic ownership graph.
- [ ] Static registry parity, userscript contract, request, proposal, authority, and sync tests pass.
- [ ] No envelope, confirmation, replay, privacy, or destination-authority behavior changes unintentionally.
