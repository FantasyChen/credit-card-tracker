# Implementation Plan — AMEX sync user activation

## Owner-authorized live E2E lane

The policy owner may authorize the agent to execute this plan against the
currently authenticated owner session without recording an account email.
Scope is derived from the server session and remains limited to that one user;
the existing preview, bounded one-or-two-row canary, replay, rollback, aggregate-evidence,
and action-time confirmation requirements still apply.

## 1. Planning and static preflight

- [x] Obtain approval of the revised owner-authorized PRD/design/implementation summary before resuming operational execution.
- [x] Recheck source commit, public setup/listing, public artifact hash/version, and current tracked worktree without intentionally reading `.env`; the public browser recheck remains in section 2.
- [x] Run only the targeted static checks whose failure would block this unchanged release: mode/config unit tests, AMEX preview/confirmation/replay tests, userscript artifact audit, public-DB invariant, task validation, sensitive-path review, and `git diff --check`.
- [x] No application source change was required; the rollout used the reviewed immutable release source.

### Static preflight evidence (2026-08-16)

- Release boundary: `f6fe053` remains the reviewed application release at `origin/main`; the current `HEAD` is the Trellis-only planning commit `daa6dab`. The worktree had only the parent task's expected `task.json` status transition before this evidence update.
- Local release artifacts: the exact Greasy Fork upload artifact is version `1.0.0` with SHA-256 `aa0733b3f2f0844c0c80f2aba0405e5b6c763c9818fed5153041c338c6aa37d3`; the Chrome ZIP has SHA-256 `e3f7bd1a17c062d7337e4d9ef2ef26a63accb38f490503fde0d923665b08a347`. Public URL/listing rechecks remain in the operational/browser preflight.
- Passed targeted Jest command (all mocked/synthetic, no database or provider connection): `npm test -- --runInBand src/lib/amex-sync/__tests__/proposal-mode-request.test.ts src/lib/amex-sync/__tests__/service.test.ts src/lib/amex-sync/__tests__/repository.test.ts src/app/api/integrations/amex-sync/__tests__/routes.test.ts src/lib/amex-sync/__tests__/authority.test.ts src/lib/amex-benefit-reader/__tests__/sync-contract.test.ts src/userscripts/amex-benefit-reader/__tests__/panel.test.ts src/userscripts/amex-benefit-reader/__tests__/visible-context.test.ts src/userscripts/amex-benefit-reader/__tests__/tampermonkey-storage.test.ts` — 9 suites, 108 tests passed.
- Passed static audits: `npm run check:amex-userscripts` (strict production/local metadata, transfer include, target separation, and port-aware include); `npm run check:public-db` (public DB invariant); `python3 ./.trellis/scripts/task.py validate .trellis/tasks/08-16-activate-amex-sync-for-users` (all task context files valid; only file-size warnings for injected specs); `python3 ./.trellis/scripts/get_context.py --mode packages` (single-repo `frontend` and `perks-reminder` layers discoverable); and `git diff --check`.
- The extension audit was intentionally skipped here because `scripts/check-amex-reader-extension.mjs` rebuilds the extension and writes `release/hashes.json`; no build or generated-file write is authorized in this repository-only preflight. Strict TypeScript, lint, build, deployment, database, provider, browser, and live AMEX checks remain operationally out of scope because no application source changed.
- Process deviation: the targeted Jest result is not accepted as boundary-compliant evidence because the repository's existing Next/Jest adapter invokes `loadEnvConfig` and may have implicitly read dotenv files during setup. No environment contents were emitted, copied, persisted, or added to Git. Do not rerun that command in this task. The earlier reviewed full quality gate remains the application regression evidence; the explicit static audits above remain valid.
- Sensitive/untracked review found no new tracked runtime/configuration/provider data. Only the task status edit and this sanitized Trellis evidence are in scope; no credentials, tokens, headers, account/card identifiers, database identity, raw observations, or proposal bodies were recorded.

## 2. Production and browser preflight

- [x] Freshly verify the reviewed production project, recovery deployment, schema-compatible authenticated runtime, absence of overlapping database work, Ready immutable deployment, primary-alias deployment-ID equality, and effective `off` runtime behavior.
- [x] Through the approved browser surface, verify the exact public reader is enabled and the exact AMEX benefits page has one manual host with no autoscan.
- [x] Run one fresh manual read-only scan and retain only sanitized observation and status aggregates.

## 3. Zero-write production preview

- [x] Set exact `preview` using EOF-terminated no-newline input (`printf %s preview` shape), without printing or persisting provider values.
- [x] Deploy from the reviewed release source; require Ready immutable deployment and exact primary-alias deployment-ID equality.
- [x] Prove effective `preview` through the authenticated owner envelope with confirmation disabled and no write path available.
- [x] Submit the fresh owner envelope, record sanitized preview aggregates, and prove no status mutation through the preview-only runtime result.
- [x] Continue only if one or two fresh rows are proposed and no stop condition is present. The fresh preview contained exactly two.

## 4. Mandatory action-time gate

- [x] Present the bounded sanitized impact, expected status/attempt/audit/provenance operations, no-unrelated-change invariant, replay check, and rollback path.
- [x] Obtain the user's fresh confirmation immediately before promotion, write-mode proposal refresh, and confirmation.

## 5. One-row write canary

- [x] Prepare exact `write` with no trailing newline in a non-aliased immutable deployment while production remains `off`; after action-time confirmation, promote it and reprove Ready/primary-alias identity.
- [x] Generate a new write-mode owner proposal and require the exact reviewed two-row set and unchanged authority/state.
- [x] Confirm once and verify two reviewed status updates, 12 unchanged rows, zero reported failures, and no unrelated or duplicate change.
- [x] Replay through the retained same-envelope flow and require no second mutation.
- [x] Run a retained-envelope post-canary preview; require zero repeat proposals, no duplicate destination occurrence, and stable sanitized identities.

## 6. Rollback proof and user-wide activation

- [x] Deploy exact `off` with no trailing newline and reprove Ready/alias identity plus authenticated `sync_off` behavior.
- [x] After the canary and rollback gates passed, promote the same immutable runtime-proven exact `write` deployment for users.
- [x] Require final Ready/primary-alias deployment-ID equality and retain the authenticated 14-unchanged, zero-proposal preview evidence from that exact immutable deployment.
- [x] Confirm the public setup page and Greasy Fork listing remain available; do not start another real-account confirmation.

## 7. Finish

- [x] Record sanitized operational evidence and the exact final effective mode in this task.
- [ ] Update the parent rollout status and durable specs only if a genuinely reusable contract changed.
- [ ] Run Trellis validation, JSON/JSONL parsing, sensitive/untracked-path review, package discovery, and `git diff --check`.
- [ ] Commit task/spec evidence locally. Push only application/release changes that were separately justified; do not push documentation-only commits to auto-deploying `main`.
- [ ] Archive the child task and record the session journal when all acceptance criteria pass; otherwise leave it active with the precise blocker and production proven `off`.

## Stop conditions

Stop and return to verified `off` on any target, recovery, deployment, alias, schema, mode, session, reader mount, visible context, privacy, duplicate, proposal-count, authority, period, before-state, audit/provenance, compare-and-set, replay, or database-equality mismatch. Never compensate automatically or manufacture a canary proposal.

## Operational continuation evidence (2026-08-18)

- Removed the exact temporary directory that contained accidental private AMEX image crops. The copies were outside the repository and are no longer present.
- Re-read the browser-read, AMEX reconciliation, global destination authority, database-safety, deployment, and verification contracts before resuming operations. No `.env` file was read, created, copied, or modified.
- Reverified the reviewed Vercel production project and a Ready primary alias. Because the preceding `preview` deployment had not received an authenticated runtime proof, registered exact newline-free `off` through EOF-terminated stdin, deployed from the isolated reviewed `f6fe053` source tree, waited for the immutable deployment to become Ready, and proved that the primary alias resolves to that same deployment. The production registration still contains the expected mode variable name.
- Computer Use returned neither an accessibility page tree nor a screenshot for the previously focused signed-in AMEX window, so no reader mount, scan, handoff, or authenticated runtime response was inferred from it. A fresh dedicated Chrome window opened only the exact reviewed AMEX benefits route and observably reached the AMEX login page. Login/MFA is therefore the current browser blocker.
- No AMEX provider mutation, production database command, preview request, confirmation request, status write, audit/provenance write, cleanup, cron, email, or notification action was run in this continuation. The configured/deployed/alias-matched rollback is `off`, but the required authenticated `503 sync_off` runtime proof remains open and is not claimed.
- The latest genuinely observed owner preview remains the prior zero-write result: 0 proposed, 13 unchanged, 1 `destination_not_usable` skip, 0 failed, 15 `partial` exclusions, and four exact-five destination prerequisites. It does not qualify for the required one-row canary, and no proposal was manufactured.
- The concurrent 25-file repository Trellis refresh is confined to `.trellis`, `.agents`, `.claude`, and `.codex` runtime files. Managed-template hashes match; the update advances the project runtime to `0.6.15`, changes the Codex dispatch default from `inline` to `auto`, and adds path-containment/context-injection hardening. It remains separate from AMEX application/release evidence and must not be pushed merely to trigger production deployment.

## Operational continuation evidence (2026-08-23)

- Computer Use reverified one idle reader host on the exact signed-in AMEX benefits route with manual Scan and Sync controls and no automatic scan. The already-installed public reader remained the previously verified enabled `1.0.0` identity; no reinstall or settings reset was attempted.
- One fresh manual read-only scan completed with five physical groups, 44 observations, 25 Remaining, 19 Used, and zero duplicate physical groups. The prior stable scan was five groups, 44 observations, 26 Remaining, and 18 Used, so one observation changed filter state while the physical and total-observation identities stayed stable. Reader diagnostics intentionally expose no partial/failed aggregate in terminal UI; no raw storage, provider response, or private diagnostic channel was inspected.
- A fresh authenticated Sync-reviewed handoff on the primary alias explicitly returned effective `off` and stated that no data changed. It exposed no confirmation control. This completed the previously open safe-off runtime proof without any provider or database mutation.
- Exact newline-free `preview` was then registered on the reviewed production project. A stale empty temporary deployment tree caused two pre-build failures and changed no application or alias state. A fresh isolated source tree was constructed directly from `f6fe053`, excluding `.trellis/**` and every `.env*` path; no environment file was read, created, copied, or modified. The preview deployment became Ready and the primary alias matched it exactly.
- Before a fresh authenticated preview could run, the AMEX session expired and the dedicated tab returned to the login page. The unverified preview was not left live: exact newline-free `off` was immediately registered, redeployed from the same fresh reviewed tree, became Ready, and was proven to match the primary alias.
- No preview result, proposal, confirmation, database mutation, audit/provenance change, cleanup, cron, email, or notification action occurred. Production ends this continuation deployed and alias-matched at exact `off`; a new AMEX login/MFA is the only current blocker to re-entering the preview sequence.

## Operational continuation evidence (2026-09-03)

- Reused the reviewed isolated `f6fe053` release tree and the verified `coupon-cycle` production project. Exact newline-free `preview` was registered, the immutable deployment became Ready, and the primary alias resolved to that deployment before the live handoff.
- A just-in-time authenticated AMEX session reached the exact benefits route. One manual scan completed with 44 normalized observations: 27 Remaining and 17 Used. The reader remained manual; no provider mutation or automatic scan was used.
- After action-time approval, one reviewed owner-scoped handoff reached the authenticated production preview. The preview was read-only and reported 12 unchanged, 2 proposed, 15 locally excluded partial observations, and four destination-card exact-five prerequisites. Confirmation was disabled in preview mode and no status, attempt, audit, or provenance write occurred.
- The two-proposal result caused the former exactly-one-proposal gate to be revised to a bounded one-or-two-row owner canary. No proposal was manufactured; eligibility remains bound to the exact reviewed set.
- Exact newline-free `off` was immediately registered and deployed from the same reviewed release tree. The immutable rollback deployment became Ready and the primary alias resolved to it. A fresh authenticated runtime `sync_off` proof remains open because it would require a second transmission of the retained sensitive handoff; the configured, deployed, alias-matched final mode is `off`.
- The approved write candidate was built with exact newline-free `write` and `--skip-domain`, leaving the public alias on the proven `off` deployment. The project default was then reset to `off` while the immutable candidate waited Ready and non-aliased.
- After fresh action-time confirmation, the write candidate was promoted and its deployment ID matched the primary alias. The retained envelope produced the exact reviewed set: 12 unchanged and 2 proposed. One confirmation completed with 2 updated, 12 unchanged, and zero reported failed rows.
- A retained-envelope post-canary preview returned 14 unchanged, with every row classified as already applied from the observation and no enabled confirmation. This proved zero repeated proposal and no second status mutation through the supported UI flow.
- The known `off` recovery deployment was promoted, matched the primary alias, and an authenticated retained-envelope probe returned `sync_off` with no data changed. This completed the rollback proof.
- The owner had separately requested the user-wide launch. Exact newline-free `write` was restored as the production provider setting and the same immutable, authenticated-runtime-proven write deployment was promoted again. It is Ready and matches the primary alias. The public setup page and Greasy Fork listing both returned HTTP 200. Final effective production mode is `write`; the feature remains manual scan, review, and per-user confirmation only.
