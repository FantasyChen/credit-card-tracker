# Implementation Plan — AMEX sync user activation

## 1. Planning and static preflight

- [x] Obtain approval of the final PRD/design/implementation summary, then start the Trellis task.
- [x] Recheck source commit, public setup/listing, public artifact hash/version, and current tracked worktree without intentionally reading `.env`; the public browser recheck remains in section 2.
- [x] Run only the targeted static checks whose failure would block this unchanged release: mode/config unit tests, AMEX preview/confirmation/replay tests, userscript artifact audit, public-DB invariant, task validation, sensitive-path review, and `git diff --check`.
- [ ] If any application source changes are required, stop the operational rollout, plan the defect, run the full affected quality gate, and release it separately.

### Static preflight evidence (2026-08-16)

- Release boundary: `f6fe053` remains the reviewed application release at `origin/main`; the current `HEAD` is the Trellis-only planning commit `daa6dab`. The worktree had only the parent task's expected `task.json` status transition before this evidence update.
- Local release artifacts: the exact Greasy Fork upload artifact is version `1.0.0` with SHA-256 `aa0733b3f2f0844c0c80f2aba0405e5b6c763c9818fed5153041c338c6aa37d3`; the Chrome ZIP has SHA-256 `e3f7bd1a17c062d7337e4d9ef2ef26a63accb38f490503fde0d923665b08a347`. Public URL/listing rechecks remain in the operational/browser preflight.
- Passed targeted Jest command (all mocked/synthetic, no database or provider connection): `npm test -- --runInBand src/lib/amex-sync/__tests__/proposal-mode-request.test.ts src/lib/amex-sync/__tests__/service.test.ts src/lib/amex-sync/__tests__/repository.test.ts src/app/api/integrations/amex-sync/__tests__/routes.test.ts src/lib/amex-sync/__tests__/authority.test.ts src/lib/amex-benefit-reader/__tests__/sync-contract.test.ts src/userscripts/amex-benefit-reader/__tests__/panel.test.ts src/userscripts/amex-benefit-reader/__tests__/visible-context.test.ts src/userscripts/amex-benefit-reader/__tests__/tampermonkey-storage.test.ts` — 9 suites, 108 tests passed.
- Passed static audits: `npm run check:amex-userscripts` (strict production/local metadata, transfer include, target separation, and port-aware include); `npm run check:public-db` (public DB invariant); `python3 ./.trellis/scripts/task.py validate .trellis/tasks/08-16-activate-amex-sync-for-users` (all task context files valid; only file-size warnings for injected specs); `python3 ./.trellis/scripts/get_context.py --mode packages` (single-repo `frontend` and `perks-reminder` layers discoverable); and `git diff --check`.
- The extension audit was intentionally skipped here because `scripts/check-amex-reader-extension.mjs` rebuilds the extension and writes `release/hashes.json`; no build or generated-file write is authorized in this repository-only preflight. Strict TypeScript, lint, build, deployment, database, provider, browser, and live AMEX checks remain operationally out of scope because no application source changed.
- Process deviation: the targeted Jest result is not accepted as boundary-compliant evidence because the repository's existing Next/Jest adapter invokes `loadEnvConfig` and may have implicitly read dotenv files during setup. No environment contents were emitted, copied, persisted, or added to Git. Do not rerun that command in this task. The earlier reviewed full quality gate remains the application regression evidence; the explicit static audits above remain valid.
- Sensitive/untracked review found no new tracked runtime/configuration/provider data. Only the task status edit and this sanitized Trellis evidence are in scope; no credentials, tokens, headers, account/card identifiers, database identity, raw observations, or proposal bodies were recorded.

## 2. Production and browser preflight

- [ ] Freshly verify the reviewed production project, recovery point, application/database identity where required, migration compatibility, no overlapping repair/cleanup, Ready immutable deployment, primary-alias deployment-ID equality, and effective `off` runtime behavior.
- [ ] Through Computer Use only, verify the exact public userscript `1.0.0` is enabled and the exact AMEX benefits page has one idle host and no duplicate mount/autoscan.
- [ ] Run one fresh manual read-only scan and retain only sanitized physical-group, observation, partial/failed, and duplicate-group aggregates.

## 3. Zero-write production preview

- [ ] Set exact `preview` using EOF-terminated no-newline input (`printf %s preview` shape), without printing or persisting provider values.
- [ ] Deploy from the reviewed release source; require Ready immutable deployment and exact primary-alias deployment-ID equality.
- [ ] Prove effective `preview` with a fresh synthetic authenticated zero-row envelope and exact before/after equality for every potentially written table.
- [ ] Submit the fresh owner envelope, record sanitized preview aggregates, and independently prove no database mutation.
- [ ] Continue only if exactly one fresh row is proposed and no stop condition is present. If zero or multiple rows are proposed, restore/prove exact `off` and record the truthful blocker.

## 4. Mandatory action-time gate

- [ ] Present the one-row sanitized impact, expected status/attempt/audit/provenance deltas, no-unrelated-change invariant, replay check, rollback path, and conditional user-wide launch.
- [ ] Obtain the user's fresh confirmation immediately before the `write` deployment and confirmation. Do not treat task approval or prior blanket approval as this gate.

## 5. One-row write canary

- [ ] Set exact `write` with no trailing newline, deploy, and reprove Ready/primary-alias identity plus effective write mode through a no-confirm zero-write probe.
- [ ] Generate a new write-mode owner proposal and require the same single proposed row and unchanged authority/state.
- [ ] Confirm once and verify exactly one expected status change with expected aggregate attempt/audit/provenance deltas and no unrelated or duplicate change.
- [ ] Replay the completed attempt and require durable replay with no second mutation.
- [ ] Run a fresh manual scan and preview; require no repeat proposal, no duplicate destination occurrence, and stable sanitized identities.

## 6. Rollback proof and user-wide activation

- [ ] Deploy exact `off` with no trailing newline and reprove Ready/alias identity plus authenticated `sync_off` behavior.
- [ ] If and only if every canary and rollback gate passed, deploy exact `write` for users from the reviewed release source.
- [ ] Require final Ready/primary-alias deployment-ID equality and a fresh authenticated synthetic zero-write probe returning effective `write`, private/no-store behavior, and exact before/after equality.
- [ ] Confirm the public setup page and Greasy Fork listing remain available; do not start another real-account confirmation.

## 7. Finish

- [ ] Record sanitized operational evidence and the exact final effective mode in this task.
- [ ] Update the parent rollout status and durable specs only if a genuinely reusable contract changed.
- [ ] Run Trellis validation, JSON/JSONL parsing, sensitive/untracked-path review, package discovery, and `git diff --check`.
- [ ] Commit task/spec evidence locally. Push only application/release changes that were separately justified; do not push documentation-only commits to auto-deploying `main`.
- [ ] Archive the child task and record the session journal when all acceptance criteria pass; otherwise leave it active with the precise blocker and production proven `off`.

## Stop conditions

Stop and return to verified `off` on any target, recovery, deployment, alias, schema, mode, session, reader mount, visible context, privacy, duplicate, proposal-count, authority, period, before-state, audit/provenance, compare-and-set, replay, or database-equality mismatch. Never compensate automatically or manufacture a canary proposal.
