# Implementation Plan — Production global-benefit rollout

## Preconditions

- [x] Children 1–4 are code-complete and their safe static/unit checks have been reviewed.
- [x] Children 1–4 passed separately authorized verified development-database validation.
- [x] Production AMEX remains effectively off.
- [x] Exact targets, stop conditions, point-in-time recovery, and a provider-native recovery branch without compute are verified before production migration.
- [x] The superseded `backfill:amex-catalog --apply` is disabled and will not be invoked.

**Current gate:** The user authorized starting the controlled rollout. Read-only production preflight is complete except recovery-point verification; no production mutation, push, deployment, or activation may occur until that gate passes.

## 1. Review implementation evidence

- [x] Review checked-in migration SQL, catalog/key invariants, runtime projection/materialization, migration preservation, AMEX global authority, and all safe checks.
- [x] Confirm through source review/tests that public anonymous routes remain DB-free and no per-user standard override/authority exists.
- [x] Record the six final full-scope fixes in the parent and owning child implementation artifacts without sensitive values.
- [x] Confirm full Jest (74 suites, 593 passed, 1 skipped), strict TypeScript, all changed-source lint, public DB, card-template, userscript, safe usage-guide source/link, JSON/JSONL/Markdown-link, sensitive-pattern, package-context, and diff checks passed.
- [ ] Resolve any defect found by later development rehearsal in its owning implementation child; do not operationally work around it.

## 2. Verified development rehearsal

- [x] Separately authorize and verify the development target.
- [x] Generate/validate the Prisma client and apply the additive migration as distinct gates.
- [x] Dry-run/apply/rerun global catalog synchronization; prove stable IDs, approved latest-field updates, and retirement.
- [x] Validate new-card no-copy behavior and new-definition propagation to existing active cards without state rewrites.
- [x] Run the legacy dry-run and idempotent replay; require deterministic exact/custom/unresolved classifications.
- [x] Snapshot, bridge apply, and prove equality outside approved bridge/ledger metadata; rerun idempotently.
- [x] Rehearse pre-cleanup rollback and exact re-bridge while keeping ledger cleanup separately gated and unperformed.
- [x] Validate global-only AMEX preview/confirmation with invented local data and production mode off.

**Gate:** Verified-development catalog, runtime, bridge, rollback/re-bridge, propagation, and synthetic AMEX evidence passed. Cleanup remains intentionally deferred and is not an initial-production prerequisite.

## 3. Production target and recovery gate

- [x] Obtain explicit authorization for read-only target/migration/config inspection.
- [x] Verify the production domain, linked Vercel project/deployment, and matching application/direct database identities without retaining or emitting values.
- [x] Verify point-in-time recovery and create a provider-native recovery branch from the exact production parent without provisioning a compute.
- [x] Confirm effective production AMEX mode is `off`, no HMAC is configured, and this rollout initiated no userscript/provider action.

### Sanitized read-only preflight evidence

- The production domain resolves to the intended linked Vercel project and a ready production deployment exists for rollback.
- Production application and direct connections reach the same database, provider project, and branch; both roles connected successfully.
- The additive global-catalog migration is the only newly expected pending migration and no failure/divergence marker was observed.
- Vercel Preview and Production currently reuse the same database targets. The generic build previously had migration authority, so push was stopped. `npm run build` now performs generation/compilation only; `npm run db:prod:migrate` is the separate attended migration command, and `check:public-db` enforces this boundary.
- Production remains effectively `off` with no HMAC. No production mutation, push, deployment, configuration change, provider action, or browser action occurred.
- Neon CLI authentication was refreshed. The provider project/default branch matches the read-only production database identity, point-in-time recovery is configured, and a recovery branch was created from that exact parent without a compute.

## 4. Production schema and global catalog

- [ ] Obtain separate migration-deploy authorization; apply only reviewed additive SQL.
- [ ] Verify migration state independently of build output.
- [ ] Run complete bounded catalog dry-run and review fresh aggregate plan/fingerprint.
- [ ] Obtain separate catalog-apply authorization; apply bounded key-based upserts/retirement.
- [ ] Rerun dry-run to prove deterministic zero remaining plan and stable global IDs.

**Stop:** Any target, key, tuple, ID, retirement, or unexpected data drift.

## 5. Production legacy bridge and parity

- [ ] Run the new complete bounded legacy dry-run twice; record only aggregate standard/custom/unresolved/blocked reasons.
- [ ] Privately review every stop class; do not widen matching or expose row values.
- [ ] Obtain separate bridge authorization and apply bounded exact plans with per-batch fingerprint/CAS checks.
- [ ] After each batch, verify no status creation/deletion/state/timestamp/audit/provenance rewrite and no custom/unresolved mutation.
- [ ] Complete hybrid projection parity and idempotent zero-plan rerun.
- [ ] Keep legacy copied rows and links through the observation window.

## 6. Cleanup/global-first boundary

- [ ] Establish a fresh recovery point and obtain separate cleanup authorization, if cleanup proceeds.
- [ ] Clean only ledger-proven standard copies; verify all custom/unresolved rows and status identity/state remain.
- [ ] Validate exclusive standard/custom sources and global-first consumer parity.
- [ ] Retain legacy columns and ledger for the rollback window.

## 7. Preview and userscript boundary

- [ ] Verify global AMEX authority deployment, exact target, migrations, and effective off state.
- [ ] Separately provision production HMAC and configure preview without exposing values.
- [ ] Redeploy through the approved path and prove authenticated preview is zero-write.
- [ ] Build/audit and separately install the production userscript through the owner-approved procedure.
- [ ] Obtain attended live-scan authorization and review sanitized proposed/unchanged/skipped/failed outcomes.
- [ ] Require zero unexpected destination and no custom/unresolved/user-key authority.

## 8. Write boundary

- [ ] Present sanitized preview evidence and obtain a separate explicit write decision.
- [ ] Enable write through the approved configuration/deployment path.
- [ ] Perform one bounded explicit confirmation.
- [ ] Reconcile attempt, row-audit, provenance, destination status, and unrelated-account aggregates.
- [ ] Return mode off immediately on any mismatch; do not issue compensating repair writes without review.

## 9. Verification and evidence

### Safe implementation evidence already reviewed

```text
Full Jest: 74 suites passed; 593 tests passed; 1 skipped
npx tsc --noEmit --pretty false --incremental false
all changed source lint
npm run check:public-db
npm run card-template:validate
npm run check:amex-userscripts
safe usage-guide source/link consistency
JSON and JSONL parsing; Markdown-link validation
sensitive-pattern scan
python3 ./.trellis/scripts/get_context.py --mode packages
git diff --check
```

### Operational status

- [ ] `npm run build` or any production build — unperformed.
- [x] Read-only production environment, migration status, and database-identity checks — completed with sanitized aggregate output.
- [ ] Production migration deploy, catalog apply, bridge apply, cleanup/rollback, seed, reset, or other database mutation — unperformed.
- [x] Verified development-database migration/catalog/runtime/bridge/rollback-re-bridge/synthetic-AMEX validation — completed.
- [ ] Browser/live AMEX, userscript installation/publication, production preview, or confirmation — unperformed.
- [ ] Production configuration change or deployment — unperformed.
- [ ] Git commit or push — unperformed.

The database-backed usage-guide audit was inadvertently invoked during final source review and failed read-only against the expected unmigrated schema before returning rows. It was not retried and made no mutation. Operational commands run only after their exact authorization; a skipped or blocked gate is not passed.

## Historical evidence handling

- [x] Reference the parent research only as historical scale/diagnostic context and explicitly non-authorizing.
- [ ] Generate fresh new-model counts, fingerprints, parity, and stop evidence.
- [ ] State every future operation as passed, failed, blocked, or skipped and record the resulting effective AMEX mode exactly.

The earlier production read-only inspection and per-user-key dry-run are preserved only in the parent historical ledger. They do not satisfy any development or production prerequisite in this plan.

## Current status

Implementation and verified-development prerequisites are complete. Production preflight proves the intended application/database/provider targets match, the expected additive migration is pending, AMEX is effectively `off`, generic builds cannot deploy migrations, point-in-time recovery is configured, and a recovery branch exists without compute. The next boundary is the separately authorized additive schema migration. Push/deployment, cleanup, preview, userscript/provider activity, and write activation remain later independent boundaries.
