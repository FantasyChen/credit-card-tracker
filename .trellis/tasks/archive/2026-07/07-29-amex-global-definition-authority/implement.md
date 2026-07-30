# Implementation Plan — AMEX global-definition authority

## Preconditions

- Children 1–3 are code-complete with global relations, hybrid projection, and bridge/parity behavior covered by static/unit tests.
- Production AMEX remained off; tests use invented data and injected repositories.

## 1. Authority and repository

- [x] Replace user card-key resolution with owned active physical-card/global-product relation resolution.
- [x] Replace user benefit-key resolution with global writable definition plus standard-status resolution.
- [x] Return a closed typed authority projection and reject custom, unresolved, duplicate, inactive, wrong-owner, partial, or user-key-only matches.
- [x] Add tests proving saved mappings, names, four digits, and user keys have no authority.

## 2. Proposal binding

- [x] Define the global definition fingerprint and include every identity/semantic field relevant to a write.
- [x] Bind physical/global/status IDs and keys, exact last five, occurrence/cycle instants, source period, before-state, provenance, ordering, mode, and expiry.
- [x] Require re-preview on any catalog/global-definition drift.

## 3. Transaction revalidation and persistence

- [x] Reload the full authority graph inside serializable confirmation transactions.
- [x] Revalidate exact persisted cycle dates/instants, source evidence, before-state, and provenance before compare-and-set.
- [x] Preserve explicit amount/completion semantics, not-usable skip, completion timestamps, retries/replay, and row isolation.
- [x] Preserve atomic December grouping.
- [x] Record global destination audit metadata plus bounded legacy diagnostic metadata atomically.

## 4. Contract compatibility

- [x] Keep envelope/mailbox/userscript/preview/confirm request and public response schemas unchanged.
- [x] Preserve exact-origin, authentication, private/no-store, proposal HMAC, card-prerequisite, and strict response-validation behavior.
- [x] Ensure preview invokes no durable writer.
- [x] Remove remaining runtime authority from user keys without removing rollback columns.

## 5. Recorded implementation and review evidence

Code, safe static/unit verification, and synthetic verified-development validation are complete for this child. All AMEX evidence was invented. No provider, browser, preview route, confirmation route, userscript installation, or production operation was used; the database-backed check invoked the server service boundary directly against the verified development target.

- [x] Full Jest: 74 suites passed; 593 tests passed; 1 test skipped.
- [x] Strict TypeScript passed: `npx tsc --noEmit --pretty false --incremental false`.
- [x] ESLint passed for every changed source file.
- [x] `npm run check:public-db` and `npm run check:amex-userscripts` passed.
- [x] Authority, repository, service, proposal/mode/request, route-contract, superseded-backfill, and clone coverage passed in the full Jest run.
- [x] Exact-last-five, global-only authority, definition drift, retired/custom/unresolved rejection, exact persisted inclusive cycle instants, CAS conflicts, provenance ordering, explicit reconciliation, replay/retry, and December atomicity are covered.
- [x] Public envelope/mailbox/request/response DTOs and production/local userscript authority remained compatible.
- [x] Card-template, safe usage-guide source/link, JSON/JSONL, Markdown-link, sensitive-pattern, package-context, and `git diff --check` checks passed.

### Verified development evidence

- [x] A synthetic global-only AMEX preview produced exactly one proposed row with no card prerequisite skip.
- [x] Confirmation updated exactly one standard status from `0` to the invented authoritative amount; audit and provenance were persisted atomically.
- [x] Repeating confirmation replayed the one durable result without creating a second attempt, audit, provenance row, or status change.
- [x] A separate synthetic AMEX card without exactly five stored digits produced zero proposals and one `destination_last_five_required` card skip.
- [x] Synthetic users, cards, statuses, attempts, audits, and provenance were removed after validation; no synthetic validation user remained.
- [x] Production was not accessed or modified and AMEX production capability remained effectively off.

### Final full-scope fix owned by this child

1. Confirmation now revalidates the complete physical/global/status graph and uses the transaction-loaded exact persisted cycle instants in compare-and-set writes. Already-current provenance updates are atomic, and completed or completion-race attempts replay durable audits before expected post-write state is mistaken for proposal drift; December groups remain all-or-nothing.

## 6. Operational gate record

- [x] Verified development migration, catalog synchronization, and legacy bridge prerequisites completed before AMEX validation.
- [x] Database-backed synthetic preview, confirmation, durable replay, and exact-last-five fail-closed validation completed on the verified development target.
- [ ] Local browser/API-route/userscript validation, live provider scan, or userscript installation/publication — not run.
- [ ] Production configuration/deployment, preview, write confirmation, or git commit — not performed.

## Completion status

AMEX global-definition authority is **code-complete, safe-check complete, and verified-development complete**. It is eligible for completion/archive after the task evidence transition. Production capability remains off, and every production/browser/provider boundary remains pending.
