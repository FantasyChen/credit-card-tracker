# Implementation Plan — Legacy global-benefit migration

## Preconditions

- Children 1 and 2 are code-complete and hybrid reads are covered by static/unit tests.
- Implementation tests use injected fakes; no real database operation was used as routine validation.
- Production AMEX remained off and the former per-user key apply remains forbidden.

## 1. Classifier

- [x] Define closed card/benefit classifications and reason codes.
- [x] Implement exact product resolution and exact unique full-shape definition matching, including retired definitions.
- [x] Validate ownership, status, audit/provenance, ledger, and duplicate-destination consistency.
- [x] Preserve standalone/valid-unmatched rows as custom and stop cards on inconsistent/ambiguous graphs.
- [x] Add fixtures for every shape field, ambiguity, contradictory evidence, custom case, and duplicate destination.

## 2. Dry-run/operator shell

- [x] Add bounded ID-ordered cursor traversal and dry-run default.
- [x] Emit deterministic aggregate-only reports and a source/database fingerprint for apply-time drift detection.
- [x] Require explicit apply, exact confirmation, and target-verification attestation before any writer.
- [x] Prove repeated injected-repository dry-runs are zero-write and stable.

## 3. Bridge writer and ledger

- [x] Re-read and compare each batch transactionally.
- [x] Add physical-card/global-status references in place and insert idempotent ledger entries.
- [x] Preserve legacy links and every existing status/audit/provenance/state/timestamp field.
- [x] Verify before/after allowed-field diffs and roll back on any mismatch.
- [x] Add idempotency, resume, stale-plan, CAS, transaction rollback, and exact-preservation tests.

## 4. Cleanup and rollback tooling

- [x] Implement separately gated ledger-proven cleanup with its own confirmation/recovery prerequisites.
- [x] Null/delete only exact proven standard copies; reject any custom, unresolved, shared, or unproven reference.
- [x] Implement pre-cleanup rollback that clears only ledger-recorded bridge metadata.
- [x] Test cleanup/rollback boundaries and forward-fix behavior after deletion.

## 5. Superseded and clone integration

- [x] Make `backfill:amex-catalog --apply` exit before database writing with a stable superseded message.
- [x] Ensure no new path populates user product/family/period keys.
- [x] Rebind global definitions by `catalogKey` in sanitized single-user clone; preserve custom and bridge links.

## 6. Recorded implementation and review evidence

Code and safe static/unit verification are complete for this child. The original operator tests use invented records and injected repositories. A later, separately authorized rehearsal used only the verified development database; its sanitized aggregate evidence is recorded separately below.

- [x] Full Jest: 74 suites passed; 593 tests passed; 1 test skipped.
- [x] Strict TypeScript passed: `npx tsc --noEmit --pretty false --incremental false`.
- [x] ESLint passed for every changed source file.
- [x] Classifier, operator, Prisma-adapter, cleanup, rollback, superseded-backfill, and clone tests passed within the full Jest run.
- [x] Dry-run/default and superseded paths were proven not to call an injected writer.
- [x] Complete invented status/audit fixtures stayed equal outside allowed bridge/ledger/global-audit metadata.
- [x] `npm run check:public-db`, card-template, userscript, safe usage-guide source/link, JSON/JSONL, Markdown-link, sensitive-pattern, package-context, and diff checks passed.

### Verified development bridge evidence

- [x] One bounded deterministic dry-run examined 15 units and 110 benefits with no further page.
- [x] Exact classification produced 104 standard and 6 custom benefits with zero unresolved rows and zero blocked units.
- [x] The reviewed-fingerprint bridge applied 104 standard links and recorded 6 custom classifications.
- [x] Status IDs, legacy links, cycle coordinates, occurrence, amount, completion, usability, order, creation/update timestamps, existing audit fields, and provenance were digest-equal before and after outside approved bridge/audit/ledger metadata; row counts were unchanged.
- [x] Reapplying the same classified graph produced 110 idempotent results and no additional bridge/custom writes.
- [x] Pre-cleanup rollback cleared all 104 standard bridge classifications, preserved every unrelated status/audit/provenance value, and re-bridge restored all 104 links; the 6 custom classifications remained idempotent.
- [ ] Separately gated cleanup was not run.

### Full-scope fixes owned by this child

1. Custom-only card-linked definitions and card-only AMEX audits are now classified without turning those audits into benefit destinations; deterministic reruns accept only exact operator-recorded ledger/card-link state.
2. The Prisma migration adapter now performs relation compare-and-set checks and post-write preservation verification for bridge, cleanup, and rollback; it records custom classifications without rewriting statuses/audits and treats exact repeated rollback as idempotent.

## 7. Operational gate record

- [x] Verified development dry-run, reviewed-fingerprint bridge, exact preservation verification, and idempotent replay completed.
- [x] Pre-cleanup rollback and exact re-bridge rehearsal completed with digest-equal preservation.
- [ ] Ledger cleanup — separately gated and not run.
- [ ] Database-backed clone execution, seed, reset, or production build — not run.
- [ ] Browser/provider/live AMEX, production configuration/deployment, or git commit — not performed.

## Completion status

The legacy global-benefit migration tooling is **code-complete and safe-check complete**; verified development dry-run, bridge, preservation, replay, rollback, and re-bridge passed. It remains `in_progress` because ledger cleanup is a separate deletion/recovery boundary and was deliberately not run. Production remains untouched.
