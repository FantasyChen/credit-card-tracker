# Research: production AMEX canary operational playbook

- Query: Exact current operational sequence for target/deployment/alias/effective-mode/recovery verification, `off -> preview -> write -> off`, and sanitized owner-scoped zero-write/write proof for AMEX canary sections 2, 4, and 5.
- Scope: internal
- Date: 2026-08-12

## Findings

### Files found

- `.trellis/spec/perks-reminder/deployment-and-external-effects.md:98-168,170-285` — provider configuration, Ready deployment versus primary-alias identity, effective-off hold, zero-write probe, and repair/reactivation boundaries.
- `.trellis/spec/perks-reminder/database-and-data-safety.md:3-43,136-252` — no-`.env` rule, target/recovery authorization, independent application/direct identities, additive migration and rollback safety, aggregate-only evidence.
- `.trellis/spec/perks-reminder/amex-sync-reconciliation.md:1-145,452-536` — envelope V3, exact-five/card/global/status authority, proposal/confirmation binding, active category-repair authority, and repair-off requirement.
- `.trellis/spec/perks-reminder/verification.md:1-50,57-153` — safe-check matrix and truthful pass/failed/blocked/skipped reporting.
- `src/lib/amex-sync/mode.ts:1-16` — only exact `preview`/`write` plus HMAC length >=32 are active; any missing/invalid/newline-contaminated value resolves to `off`.
- `src/app/api/integrations/amex-sync/preview/route.ts:8-33` — authenticated preview route; off is HTTP 503 `sync_off`; successful responses are private/no-store.
- `src/app/api/integrations/amex-sync/confirm/route.ts:9-41` — confirmation only when effective mode is `write`; wrong mode is HTTP 403 `write_disabled`; revalidation only after applied rows.
- `src/lib/amex-sync/request.ts:1-55` — accepted production origin is the configured approved origin, requires same-origin and JSON, and bounds request size.
- `src/lib/amex-sync/service.ts:250-370` — confirmation verifies write proposal, user, envelope/row/group identity and authority; completed attempts replay durable results; writes are grouped and audited.
- `scripts/build-amex-benefit-reader.mjs:9-26,44-73` and `scripts/check-amex-userscript-artifacts.mjs:5-201` — production artifact is `build/amex-benefit-reader.user.js`, version `0.5.3`, exact transfer handoff include, and a page-realm `unsafeWindow` bridge; local artifact is a distinct identity. Build/check commands are safe artifact checks only.
- `package.json:22-54` — package command names; generic build is migration-free, while `db:prod:migrate` is an explicitly attended operation.
- `.trellis/tasks/archive/2026-08/07-29-production-global-benefit-rollout/research/production-preflight-2026-07-29.md` — prior sanitized target/recovery/off evidence; historical and must be reverified.
- `.trellis/tasks/archive/2026-08/07-29-production-global-benefit-rollout/research/production-amex-preview-2026-07-30.md` — prior preview rollout and zero-write proof.
- `.trellis/tasks/archive/2026-08/07-29-production-global-benefit-rollout/research/production-amex-write-activation-2026-07-31.md` — prior write activation/no-confirm proof and rollback target practice.
- `.trellis/tasks/archive/2026-08/07-29-production-global-benefit-rollout/research/production-application-deployment-2026-07-30.md` — prior alias mistake: immutable URL smoke was not alias proof; corrected alias-based check passed.
- `.trellis/tasks/archive/2026-08/08-06-production-category-drift-repair/implement.md:59-108,110-147,149-175,177-220` — latest repair rollout evidence, migration-first sequence, effective-off hold, private manifests/baselines, page gates, and stop policy.

### Exact safe command shapes (operator-only; not run in this research)

1. **Static/artifact preflight:** `npm run build:amex-userscript && npm run build:amex-userscript:local && npm run check:amex-userscripts`; then the already-passed scoped E2E/focused tests/TypeScript/lint/public-DB checks. These do not authorize provider, deployment, database, browser, or AMEX operations.
2. **Provider metadata/config:** on the exact production `coupon-cycle` project (never infer from local `.vercel/project.json`), inspect environment registration by name/target and use sensitive storage. An exact mode change is shaped as `printf '%s\n' <off|preview|write> | vercel env add AMEX_SYNC_MODE production --force`; HMAC is generated in shell memory and piped directly with sensitive storage. Never use `vercel env pull`, read/create `.env`, or print/copy secrets. `vercel env add`, deployment, promote, and alias actions need separate action-time authorization (broad authorization still requires confirmation before preview and before write/confirm).
3. **Ready/alias proof:** inspect both the immutable Ready deployment and the primary production alias (`vercel inspect <ready-immutable-deployment> --json`, `vercel inspect <primary-alias> --json`). Require readiness and exact deployment-ID equality. If `vercel promote <immutable-deployment> --yes` leaves the custom alias stale, stop and only after explicit approval use `vercel alias set <immutable-deployment> <existing-primary-alias>`, then compare IDs again. Public origin is `https://www.perks-reminder.com`; do not treat an immutable deployment URL as the production origin.
4. **Target/recovery:** immediately before any database/schema or production write, independently verify pooled/application and direct/migration database identities reach the same reviewed provider project/branch/database/schema; verify a fresh provider-native no-compute recovery point whose parent is the exact production branch. Existing prior recovery branch, migration status, environment registration, and old mode observations are stale evidence and cannot be assumed. Do not run Prisma status/migrate, database reads, or recovery commands in this research task.
5. **Mode runtime probes:** `off` proof is a fresh authenticated/read-only preview POST to the primary alias returning HTTP 503 `sync_off`; registration or Ready alone is insufficient. `preview` proof is a fresh synthetic nonexistent identity, short-lived session, invented non-colliding V3 envelope (one synthetic five-digit card, zero rows), same-origin JSON request, successful HTTP 200 with mode `preview`, private/no-store and no-referrer headers, and no confirmation call. `write` activation is a separate config/deployment/alias gate, then the same no-confirm preview probe must return mode `write`; never confirm the preview-mode proposal.
6. **Preview owner-scoped proof:** use a fresh real owner envelope only after the preview reactivation authorization is explicitly confirmed. Record only aggregate proposed/unchanged/skipped/failed counts and closed reasons. Before/after counts/state must be captured for every potentially touched owner-scoped table; preview must show exact equality. Do not log URLs, IDs, user/card endings, proposal tokens, HMAC/JWT/session material, raw responses, headers, database identities, or row values.
7. **One optional write:** present the complete sanitized preview and obtain separate action-time confirmation. Switch to exact `write`, deploy and reprove Ready/alias identity, then generate one new fresh proposal (proposal tokens are mode-bound and short-lived). Confirm at most once. Reconcile only expected status, AMEX attempt/row-audit, and provenance deltas; prove no unrelated owner rows or duplicate destination occurrences changed. Replay the completed attempt and require durable replay/no new writes; run fresh scan/preview for no-repeat evidence.
8. **Return safe:** set exact `off` through a newly verified deployment/alias path and reprove 503 `sync_off`. Do not use compensating writes, strict cleanup, repair rollback/evidence deletion, provider enrollment/activation/linking, or other-account actions as rollback.

### Required approvals and gates

- Synthetic checks and artifact audit are implementation evidence only.
- Preview reactivation requires explicit confirmation after presenting preflight and two-scan sanitized results. It authorizes only `preview` configuration/deploy and one owner-scoped zero-write preview.
- Write requires a new explicit action-time approval after the complete sanitized preview. It authorizes only exact `write` config/deploy and one fresh bounded confirmation; it does not authorize userscript installation, provider mutation, catalog/schema work, cleanup, or repair rollback.
- Returning `off` is the default post-canary safety action and still requires its configuration/deployment/alias/runtime proof. Any failure or uncertainty stops and returns to `off`.

### Stop conditions

Stop before the next boundary on any project/domain/alias/deployment-ID mismatch; uncertain pooled/direct/database/branch identity; missing or stale recovery point; migration divergence or unexpected schema state; mode/HMAC not exact; 503/401/origin/content-type/request-shape mismatch; duplicate reader mount or provider visible-context drift; duplicate physical-card or source-credit/period candidate; missing/ambiguous/not-usable/status authority; proposal/definition/cycle/before-state/provenance/CAS drift; unexpected owner-scoped count/state/audit/provenance change; stale/replayed proposal; privacy leak; or any repair/cleanup operation overlap. Preserve evidence and recovery point; do not compensate automatically.

### Prior temporary/private artifacts that cannot be assumed

Prior sanitized reports explicitly say raw environment output, deployment IDs/aliases, database identities, recovery identifiers, HMAC/JWT/proposal tokens, synthetic identity, manifests, cursors, fingerprints, baselines, row values, and temporary files were removed or retained only in private operator storage. The previously created recovery branch may be deleted, stale, or full; create/reverify a fresh one. Existing Vercel project links can point at the wrong local project. A Ready deployment can serve a stale custom alias. Environment registration can omit sensitive values by design. Prior `off`/`preview`/`write` observations, migration status, userscript install state, browser session, mailbox/envelope, and owner data are all action-time state and must be rechecked. The ignored `build/` and `public/local-development/` artifacts are generated outputs, not installed-script proof; installing or updating Tampermonkey remains a separate owner-authorized action.

## Caveats / Not Found

- No provider, deployment, database, browser, environment, Prisma, migration, or production command was run for this research.
- The repository has no checked-in single-purpose production-canary command that safely performs all target, alias, recovery, synthetic probe, and owner-scoped count checks; the playbook must compose existing provider commands and narrow application probes under separate approvals.
- Previous rollout notes are historical evidence only. They do not authorize the current canary or prove current mode/alias/target/recovery state.
- `scripts/check-database-connection.js` and `scripts/with-dev-db.js` load dotenv/process configuration and are not safe for this no-`.env` production playbook.
