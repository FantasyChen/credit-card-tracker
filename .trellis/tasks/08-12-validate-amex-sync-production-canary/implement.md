# Implementation Plan — AMEX sync production canary

## 1. Pre-live regression gate

- [x] Build both userscript targets and run the artifact audit.
- [x] Run the scoped generated-bundle Playwright AMEX E2E suite.
- [x] Run focused reader, mailbox/handoff, resolver, preview, confirmation, category-repair authority, repository, and route tests.
- [x] Run strict TypeScript, affected lint, public-DB invariant, package discovery, sensitive-pattern review, and `git diff --check`.

### Pre-live regression evidence (2026-08-12)

- `npm run build:amex-userscript` originally passed for `0.5.2`; the later isolated-world fix advances the reviewed production artifact to `0.5.3` in ignored `build/` output.
- `npm run build:amex-userscript:local` passed and generated the reviewed local artifact in ignored `public/local-development/` output.
- `npm run check:amex-userscripts` passed for the final `0.5.3` artifact: production/local metadata, strict monotonic production version, target separation, approved origins, reviewed grants, and forbidden transport/sensitive markers were verified.
- `npm run test:e2e:amex` initially passed 13 generated-bundle Playwright tests; after the transfer-scope fix, the full suite passed 14 tests, adding metadata-derived production activation and exact handoff exclusion coverage.
- Focused Jest passed: 37 suites, 411 tests. The run covered the reader adapter/scan/storage/identity/mailbox/handoff contracts; userscript panel/provider/visible-context behavior; AMEX catalog and sync authority/resolver/repository/service/proposal/confirmation/replay/partial/December-grouped persistence; handoff UI/API routes/privacy; and category-repair authority, parity/rehearsal, Prisma adapter, and legacy utility guards.
- `npx tsc --noEmit --pretty false --incremental false` passed.
- `npx eslint src/lib/amex-benefit-reader src/lib/amex-sync src/lib/amex-catalog src/lib/global-benefit-category-repair.ts src/lib/prisma-global-benefit-category-repair.ts src/lib/global-benefit-category-repair-authority.ts src/lib/global-benefit-category-repair-development-rehearsal.ts src/lib/global-benefit-category-repair-parity.ts src/app/api/integrations/amex-sync src/app/integrations/amex-sync src/userscripts/amex-benefit-reader src/userscripts/amex-benefit-reader.user.ts tests/e2e/amex-benefit-reader playwright.amex.config.ts` passed.
- `npm run check:public-db` passed; `npm run card-template:validate` passed (1 template).
- `python3 ./.trellis/scripts/task.py validate .trellis/tasks/08-12-validate-amex-sync-production-canary` passed for both JSONL context files (warnings only for intentionally large referenced specs). Direct JSON/JSONL parsing of all task artifacts also passed.
- `python3 ./.trellis/scripts/get_context.py --mode packages` passed and reported the single-repo `perks-reminder`/`frontend` spec layers.
- A bounded sensitive-pattern scan over all six active task artifacts found zero private keys, credential-bearing connection URIs, JWT-like values, provider-secret markers, or authorization/cookie values. No `.env`, browser/provider, database, deployment, or generated artifact was added to the task.
- `git diff --check` passed. The worktree contains only the task directory as an untracked path; generated bundles and test output remain ignored.

No live browser/provider access, userscript installation, production configuration/deployment, database/Prisma operation, application build, or confirmation/write action was run in this gate. The initial synthetic gate needed no source fix; the later production handoff defect gate and rerun are recorded below.

### Production handoff activation defect fix (2026-08-12)

- **Defect:** the audited production userscript `0.5.1` declared an exact no-query `@match` for `/integrations/amex-sync`. Tampermonkey did not activate it on the actual transfer URL (`?transfer=...`), while the analogous local `@include` did activate. Production therefore remained effectively off before this implementation; no provider or production action was taken to compensate.
- **Fix:** production metadata now uses the exact transfer-bearing `@include https://www.perks-reminder.com/integrations/amex-sync?transfer=*`; the production version advances monotonically to `0.5.2`. Name, namespace, provider/host scope entries, and all three storage-only grants remain unchanged. Runtime origin/path validation and mailbox integrity gates are unchanged.
- **Audit/tests:** the artifact checker asserts the positive transfer URL and rejects no-query, sibling path, alternate origin, alternate scheme, alternate port, and localhost URLs. Generated-bundle Playwright now derives activation from artifact metadata, proves one production handoff activates only on the transfer URL, and proves all excluded URLs remain idle with no mailbox consumption or provider requests. The local identity remains covered by its existing exact localhost include tests.
- **Sanitized evidence:** no card ending, account/user/row identifier, provider token/response, transfer nonce/digest, deployment/configuration value, browser session, database state, or generated artifact was copied into task evidence. Build output remains ignored.

### Production isolated-world handoff defect fix (2026-08-12)

- **Defect:** live `0.5.2` activated on the correct transfer URL, but the app's page-realm `postMessage` never reached the bridge. Production used the isolated userscript `window`, while the local build already used granted `unsafeWindow`; the direct-injection synthetic E2E ran in the page realm and therefore could not expose the mismatch.
- **Fix:** production advances to `0.5.3`, grants `unsafeWindow`, and uses the page-realm window for the same exact-origin, exact-path, typed-message and digest-checked protocol. No privileged network grant, new transport, provider operation, or broader URL scope is added.
- **Prevention:** the artifact audit now requires both the reviewed grant and page-realm binding. The cross-layer guide records that direct page injection cannot prove extension isolated-world behavior; a real installed zero-write handoff remains mandatory.

## 2. Production and userscript preflight

- [x] Reverify production alias/immutable deployment identity, exact effective mode, schema state, database/provider identity when required, and recovery readiness without exposing values. This remains immediately before preview reactivation.
- [x] Build the production `0.5.3` artifact and audit its exact metadata against the prior installed scope; the installed `0.5.2` runtime activation was later found unable to bridge the page-realm handoff and is superseded by the isolated-world defect gate below.
- [x] If installed metadata is older but unchanged in scope, perform one owner-authorized monotonic update and verify the installed version; otherwise stop on any scope/grant mismatch.
- [x] Prove one idle reader mount and zero provider reads before manual start.

Historical installed-script evidence (2026-08-12, superseded for transfer activation): the signed-in page initially had exactly
one idle host from the separately named local-development reader. The audited
production artifact matched the existing production script's name, namespace,
two prior match entries, and three storage grants; Tampermonkey showed an
observable `0.3.3 -> 0.5.1` update. After Update, reopening the artifact reported
installed version `0.5.1`; the same-version reinstall was cancelled without
resetting settings. The temporary loopback server was stopped. The
local-development script was disabled and the production script enabled; reload
then proved exactly one idle host at version `0.5.1` and zero automatic provider
reads. The later transfer-URL activation defect invalidates that artifact for
handoff use; no new installation or production action is authorized by this
implementation. No other script was modified. The duplicate mount-risk stop
worked as designed before any scan.

## 3. Live read-only validation

- [x] Run attended scan A and retain only normalized local storage plus sanitized aggregates.
- [x] Review primary/supplementary policy, physical-card multiplicity, benefit admission, partial/failure/conflict issue codes, and duplicate source-credit/period groups.
- [x] Run scan B without page/account context drift and compare sanitized stable aggregates.
- [x] Stop on unexplained drift, partial relevant cards, identity conflict, duplicate group, unsupported contract, or visible-context mismatch.

Live read-only evidence (2026-08-12): scan A and scan B each completed from the
same signed-in page/context with one production reader host, zero rendered alerts,
five distinct benefit-bearing physical-card identities, 26 Remaining rows, and 18
Used rows. Each filter rendered five card groups; neither filter contained a
duplicate product-plus-ending physical identity. The complete sanitized identity
and per-card row-count projection was identical across scans. Repeated products
remained distinct physical cards. No provider mutation, handoff, production preview,
production configuration, or Perks Reminder write occurred. No card ending,
account/user/row ID, provider token, raw response, transfer authority, or private
observation value was retained in this task evidence.

## 4. Zero-write production preview

- [x] Obtain and record explicit preview-reactivation authorization after presenting the preflight/scan results.
- [x] Configure exact `preview`, deploy through the reviewed path, and prove Ready primary-alias identity plus effective runtime mode.
- [x] Use a fresh live envelope to preview once and record only sanitized proposed/unchanged/skipped/failed counts and closed reasons.
- [x] Verify exact-five unique physical-card resolution, global definition/status/repair authority, exact periods, not-usable behavior, and no duplicate destinations.
- [x] Prove owner-scoped database counts/state are unchanged by preview.

Preview activation evidence (2026-08-12): Neon CLI access was renewed only after
action-time approval. Read-only provider inspection proved the intended production
project/default branch Ready with 24-hour history retention and the prior
no-compute category-repair recovery child still Ready and correctly parented. A
fresh no-compute recovery branch was rejected before creation because the branch
quota was full; no resource or partial state was created, no older branch was
deleted, and PITR readiness was retained as the canary recovery gate.

The repository's ignored local Vercel link targeted a different project, so an
isolated link selected the exact `coupon-cycle` project without changing repository
`.vercel` state. `AMEX_SYNC_MODE` was updated to exact sensitive `preview`; the
existing provider-stored HMAC was retained. An initial deployment from a metadata-
only isolated directory failed safely before Ready and received no primary alias.
The corrected isolated source workspace excluded `.env*`, `.git`, `.vercel`,
generated userscript output, test output, and private task evidence. Its production
deployment reached Ready, and independent inspection proved the primary alias and
immutable deployment IDs equal. The generic build ran through Vercel and retained
the migration-free package contract. No database migration or data operation ran.

This first preview attempt stopped when the owner's AMEX session expired: no
envelope was transmitted and no preview request or write occurred. The later
fresh attended scan, successful zero-write preview, confirmation, idempotency,
and safe return are recorded below.

## 5. Optional bounded confirmation

- [x] Present the complete sanitized preview and request explicit action-time approval for one confirmation.
- [x] If approved, configure exact `write`, verify Ready alias/runtime identity, and generate a new fresh preview/proposal under write mode.
- [x] Confirm exactly once; verify only expected status/audit/provenance changes and zero unrelated/duplicate occurrence changes.
- [x] Replay the same completed attempt and require durable idempotent results with no write.
- [x] Run a fresh scan/preview and require unchanged/no-repeat outcomes.
- [x] Return mode to exact `off` and verify Ready alias/runtime identity unless the user separately approves retaining an active mode.

### Live preview evidence (2026-08-12)

Production userscript `0.5.3` completed a fresh stable scan with the same five
physical cards and 44 normalized rows observed earlier. The repaired installed
bridge consumed the one-time mailbox, removed the transfer locator, and reached
the owner-scoped production preview. Preview returned 5 proposed, 8 unchanged,
and 1 safely skipped row (`destination_not_usable`), with no ambiguous-card,
duplicate-source, duplicate-destination, or failed result. Fifteen local
observations were excluded as partial, and four destination cards require exact
five-digit identity before they can participate; neither set can be written.
Two proposed rows decrease the stored amount and clear completion, while the
other three increase or complete reviewed status. The server remained exact
`preview`, confirmation was disabled, and no data changed. A fresh action-time
approval is required before exact `write`, a new proposal, and one confirmation.

### Confirmation, idempotency, and safe-return evidence (2026-08-12)

After explicit action-time approval, the production database target was
reidentified uniquely through its previously established 24-hour retention
profile. Its default branch and five existing non-default recovery branches
were Ready; the branch quota remained full, so no new branch was created or
resource deleted. Exact `write` was deployed to the reviewed production project,
and the Ready immutable deployment and primary alias IDs matched.

A new live scan remained stable at five physical cards and 44 normalized rows.
Its write-mode proposal exactly matched the approved preview: 5 proposed, 8
unchanged, 1 `destination_not_usable` skip, 15 partial exclusions, and four
destination-card exact-five prerequisites. Confirmation was invoked exactly
once. The authoritative result was 5 updated, 8 unchanged, 1 skipped, and zero
failed. Refreshing the consumed locator failed closed without a second write.
A new scan and proposal then returned 13 unchanged, 1 not-usable skip, zero
proposed rows, and a disabled confirmation control, proving no repeated mutation
or duplicate occurrence.

Finally, exact `off` was deployed through the same isolated production project
link. The new deployment reached Ready, the primary alias resolved to the same
deployment ID, and a fresh authenticated handoff returned `sync_off`; no data
changed in the final probe. Production therefore ends effectively off.

## 6. Final review

- [x] Classify every gate as passed, failed, blocked, or skipped.
- [x] Confirm no private browser/provider/database artifact entered Git, logs, task evidence, or chat.
- [x] Update durable specs only if live evidence reveals a reusable contract change.
- [x] Run final applicable checks and archive the task after user-visible evidence is complete.
