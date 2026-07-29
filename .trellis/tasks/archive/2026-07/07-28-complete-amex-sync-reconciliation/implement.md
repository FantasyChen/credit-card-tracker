# Implementation Plan — Complete AMEX Sync Reconciliation

## Preconditions

- Use `prd.md` as the requirements authority and `design.md` as the technical contract.
- Read the curated Trellis specs and `research/amex-card-benefit-mapping-matrix.md` before editing.
- Preserve the current authenticated handoff, proposal, ownership, idempotency, provenance, and audit boundaries.
- Do not read or modify `.env`, call live AMEX, run seed/migrations against a database, apply a backfill, or enable production sync mode.

## 1. Complete catalog identities and classifications

- [x] Add stable product keys for all 12 AMEX catalog cards.
- [x] Add stable product/family/period tuples for all 56 catalog benefit rows.
- [x] Add a closed period-key vocabulary covering month, December, quarter, fixed quarters, halves, year, and anniversary periods.
- [x] Add explicit source-semantics classification for every row; grant source credit keys only to provider `usage` credits.
- [x] Update AMEX-specific catalog types, static-catalog/seed propagation, and deterministic card/benefit clone paths.
- [x] Add catalog invariants for counts, complete classification, tuple uniqueness, valid period shape, and excluded-row non-authority.

**Gate: Verified.** Catalog tests prove 12/56 completeness and no duplicate destination identity before sync behavior changes.

**Rollback:** Revert code-only catalog changes; no database command has run.

## 2. Implement product and benefit matching policies

- [x] Extract deterministic AMEX normalization utilities.
- [x] Add reviewed browser product descriptors and a separately enumerated server authority registry.
- [x] Implement exact aliases, hard tier/business/cobrand conflicts, weighted fuzzy scoring, minimum score, and runner-up margin.
- [x] Add Morgan Stanley Platinum as the reviewed base-Platinum affiliation alias.
- [x] Add product-scoped source-credit descriptors using exact aliases, required/forbidden token groups, compatible periods, and optional amount constraints.
- [x] Require category `usage` and exactly one benefit candidate.
- [x] Add browser/server set-comparison invariants without sharing the authoritative allowlist object.
- [x] Add synthetic positive, negative, threshold-boundary, cross-product, duplicate, and ambiguity tests.

**Gate: Verified.** Matching tests prove no closest-card/title fallback and no business/consumer, tier, or cobrand cross-match.

**Rollback:** Registries remain inactive until the new envelope is integrated.

## 3. Add the coordinated sync-envelope version

- [x] Preserve local observation compatibility for historical four-digit cards.
- [x] Require exactly five source ending digits at the sync projection boundary.
- [x] Carry bounded provider product/title/category evidence and source-semantic claims.
- [x] Remove manual mapping fields and browser-supplied destination IDs.
- [x] Keep strict schemas, payload limits, freshness limits, and forbidden sensitive-field scans.
- [x] Update userscript/mailbox/handoff strict validators for the new version and explicit unsupported-old-version behavior.
- [x] Add projection/contract tests for source eligibility, limits, unknown fields, legacy rejection, and sensitive-field boundaries.

**Gate: Verified.** Browser projection emits only complete, current, exact-five, provider-`usage` rows under the new version.

**Rollback:** Application and userscript contract changes are reverted together; sync mode remains off.

## 4. Harden server planning and destination identity

- [x] Independently resolve source product and source credit from provider evidence and compare them with browser claims.
- [x] Expand destination context to include issuer and exact ending digits.
- [x] Remove manual selection precedence and saved-mapping authority from card resolution.
- [x] Resolve exactly one owned, active AMEX destination card by product and exact last five.
- [x] Return deduplicated card-level missing-last-five skips with server-derived edit links.
- [x] Add the complete closed period resolver.
- [x] Resolve exactly one destination product/family/period benefit and exact status cycle.
- [x] Add stable plan-row and atomic-group identities.
- [x] Add focused authority/service tests for every card, benefit, period, ambiguity, and ownership disposition.

**Gate: Verified.** Preview remains read-only and cannot plan a write through names, four digits, manual selections, saved mappings, or browser claims alone.

**Rollback:** Revert preview planning while leaving catalog keys harmlessly additive.

## 5. Implement authoritative transitions and grouped persistence

- [x] Reconcile explicit AMEX used amount and completion independently; preserve omitted fields.
- [x] Preserve omitted benefits and `isNotUsable` behavior.
- [x] Preserve completion timestamp transition semantics.
- [x] Implement the approved December Uber $15/$20 sequential split and validation.
- [x] Apply split destinations atomically in one serializable group transaction.
- [x] Revalidate ownership, issuer, lifecycle, product, destination ID, exact last five, destination tuple, cycle, before state, and provenance order inside each write transaction.
- [x] Preserve independent failure isolation between unrelated groups.
- [x] Keep status, provenance, and row-audit writes atomic for every applied destination.
- [x] Update proposal binding and idempotency for the new plan/group identities and remove mapping digests/persistence.
- [x] Add repository tests for preview-to-confirmation identity changes, upward/downward overwrite, completion set/clear, omission preservation, replay, provenance, audit, and split atomicity.

**Gate: Verified.** A changed card identity or either changed split destination produces no status/provenance/success-audit write and requires re-preview.

**Rollback:** Disable sync mode; preserve audits/provenance for diagnosis.

## 6. Update API DTOs and handoff UI

- [x] Remove manual mappings and mapping options from requests, responses, services, and strict validators.
- [x] Add card-level skip DTOs and the expanded row/atomic-group dispositions.
- [x] Remove the handoff mapping state and card selectors.
- [x] Render one actionable missing-last-five message per destination card with the existing card-edit route/ending-digits focus target.
- [x] Render December split destinations distinctly.
- [x] Update AMEX card-form guidance to state that five digits are required for sync without changing non-AMEX validation.
- [x] Preserve authentication, origin/media/size guards, private cache behavior, no-index behavior, preview/confirm separation, and accessible semantics.
- [x] Update route, component, and accessibility tests.

**Gate: Verified.** The UI explains every prerequisite skip without exposing a bypass, and strict response parsing accepts every new server disposition.

**Rollback:** Revert UI and DTO changes with the coordinated envelope version.

## 7. Implement additive dry-run backfill support

- [x] Extend the deterministic catalog backfill for the complete key set.
- [x] Add a dry-run-first operator entry point with explicit apply mode.
- [x] Fill only null deterministic keys; preserve/report non-null conflicts and ambiguity.
- [x] Include predefined cards/benefits, user cards/benefits, and missing status materialization in the report.
- [x] Never alter existing status amount/completion during backfill.
- [x] Add dry-run, apply, idempotency, conflict, ambiguity, and no-status-reset tests using isolated fixtures/mocks only.
- [x] Document that production dry-run/apply and rollout remain separately authorized and are not executed here.

**Gate: Verified.** Dry-run writes nothing; repeated apply is idempotent; conflicts remain untouched.

**Rollback:** Do not run apply. If applied later, disable sync first and use the exact changed-ID report for targeted correction.

## 8. Validation and review

Run targeted checks as each layer changes, then the full safe suite. Confirm exact available scripts from `package.json` before execution.

Expected checks:

```bash
npx tsc --noEmit --pretty false --incremental false
npm run lint
npm test -- --runInBand src/lib/amex-benefit-reader
npm test -- --runInBand src/lib/amex-sync
npm test -- --runInBand src/app/integrations/amex-sync
npm test -- --runInBand
npx prisma validate
git diff --check
```

Run a build only if the project verification spec classifies it as safe in the current environment. Do not substitute `prisma db seed`, migration deployment, backfill apply, live provider calls, or production checks for static validation.

Final review must verify:

- [x] every PRD acceptance criterion has test or inspection evidence;
- [x] browser and server authorities remain independently enumerated;
- [x] all changed request/response schemas and UI consumers agree;
- [x] every status-write path revalidates exact last five and ownership transactionally;
- [x] non-AMEX behavior remains covered;
- [x] no `.env`, credential, raw provider response, browser/session data, generated bundle, or database artifact was added;
- [x] all changed/untracked paths are intentional;
- [x] failures and skipped checks are reported truthfully.

**Final safe-check disposition:** strict TypeScript, all targeted AMEX suites, changed-source lint, operational-script lint, userscript production/local builds and artifact audit, synthetic Playwright, public database invariant, catalog validation, structured artifact parsing, sensitive-value scan, and `git diff --check` passed. Repository-wide lint remains blocked by eight pre-existing unused-variable errors in three untouched files. Repository-wide Jest remains blocked by seven pre-existing failures in the untouched cron-benefit suite whose mock lacks `$transaction`; its isolated rerun reproduces the same baseline failure. `npm run build` was intentionally skipped because it deploys Prisma migrations. `prisma validate` passed but automatically reported loading `.env`; no value was printed and no database command ran. No production userscript publication/install, Vercel deployment, database backfill, migration, provider call, or production sync enablement was performed.

## 9. Authorized manual-test environment setup (2026-07-28)

- [x] Add and independently review the dry-run-first sanitized single-user production-to-development clone operator.
- [x] Apply the existing additive AMEX sync migration to the verified `ep-frosty-snowflake` development branch; all 22 migrations are current.
- [x] Run the authorized account dry-run, detect the existing development-account collision, and obtain separate replacement approval before any deletion.
- [x] Replace only the approved development account graph in one Serializable transaction. Verified aggregate copied counts: 1 user, 13 cards, 105 benefits, 233 statuses, 6 loyalty accounts, and 4 certificates; the remaining included tables were empty.
- [x] Preserve production as read-only and sanitize password, full card number, loyalty account number, sessions, OAuth accounts/tokens, verification/reset tokens, and analytics data.
- [x] Start `NEXTAUTH_URL=http://localhost:3000 npm run dev:devdb` and verify `/auth/signup` returns HTTP 200.

The cloned account intentionally has no password. Establish a development-only password through the existing signup flow before signing in for the manual AMEX test. The live provider interaction and AMEX write confirmation remain user-driven manual actions.

The source account had no `emailVerified` timestamp. Signup stored the new development password but retained the unverified state, and the route displayed its verification-success message even though delivery was not observable because it ignores `sendEmail()`'s boolean result. After separate user authorization, only the cloned development account was marked verified with a compare-and-set update and its obsolete development verification token was removed. Production remained untouched.

## 10. Local userscript handoff for manual testing

- [x] Preserve the production identity, metadata, output path, grants, and exact production handoff origin; increase the final artifact from the previously installed `0.5.0` to `0.5.1` so Tampermonkey's strict monotonic update guard can accept it.
- [x] Add separately named/namespaced local `0.5.0-local.3` artifact targeting only AMEX and exact `http://localhost:3000/integrations/amex-sync`.
- [x] Compile the handoff target into URL generation, page activation, sender/receiver origin checks, and `postMessage`; reject all other origins and wrong message sources.
- [x] Preserve transfer ID, nonce, digest, expiry, preview-before-acknowledgement, and mailbox deletion semantics.
- [x] Add artifact authority auditing plus unit and generated-bundle regressions for production/local cross-target isolation.
- [x] Independently review and fix match-path breadth, artifact checks, cross-target activation coverage, and documentation.
- [x] Restart the verified development server with exact localhost auth/site origins, write mode, and an ephemeral 32+ character development-only HMAC key.
- [x] Verify `http://localhost:3000/local-development/amex-benefit-reader.local.user.js` responds with HTTP 200 and JavaScript content.
- [x] Correct the real-browser localhost activation metadata from an invalid port-bearing `@match` to the exact transfer-query `@include`; install and verify local `0.5.0-local.2` activates on the handoff page.
- [x] Bridge the local Tampermonkey sandbox through the localhost page-realm `unsafeWindow`, retain exact page-window/origin checks, install local `0.5.0-local.3`, and verify a fresh real-browser handoff reaches preview.

Real-browser verification installed the exact `0.5.0-local.2` to `0.5.0-local.3` Tampermonkey update with the local-only `unsafeWindow` grant, reloaded the AMEX page, and created a fresh transfer. The localhost handoff advanced from waiting to the read-only preview, cleared the transfer query, rendered prerequisite/skip dispositions, and left confirmation disabled because no rows were proposed. No benefit-status write was requested or performed.

The local artifact is ignored by Git and must be disabled or removed from Tampermonkey after the authorized manual test. It cannot silently replace the production userscript identity.

## 11. Development-only catalog enablement and status-write verification

- [x] Inspect only the authorized development account and report aggregate AMEX identity coverage without printing card endings, record IDs, database identity, or provider payloads.
- [x] Run an account-scoped dry run before apply, then fill only null deterministic keys through compare-and-set writes: 9 card product keys and 74 benefit identity tuples were added; 17 benefits without an exact template remained untouched; no status amount, completion, usability, or cycle was materialized or reset.
- [x] Create a fresh real-provider scan and localhost handoff. Preview remained read-only and produced 3 proposed, 6 unchanged, and 5 skipped rows; four development cards without exact five digits remained prerequisite skips.
- [x] Exercise the explicitly authorized development confirmation. The first attempt failed all 3 proposed rows with `conflict_repreview_required` and changed no benefit status.
- [x] Diagnose the false conflict: source periods and transaction authorization compared UTC calendar dates, but the final compare-and-set reconstructed a midnight cycle end while real materialized cycles store an inclusive end-of-day instant.
- [x] Use the exact persisted cycle start/end instants loaded and authorized inside the serializable transaction for single-row and grouped compare-and-set selectors. Keep all ownership, issuer, lifecycle, product, exact-last-five, destination, occurrence, before-state, and provenance checks.
- [x] Add materialized end-of-day regressions for single and grouped writes plus rejection of a different calendar cycle before mutation. Targeted repository tests passed 17/17, the full AMEX sync suite passed 96/96, TypeScript and targeted lint passed, and `git diff --check` passed. Repository-wide lint still has the separately known unrelated failures.
- [x] Perform a new scan, handoff, preview, and explicitly authorized development confirmation after the fix. The final UI reported 3 updated, 6 unchanged, 5 skipped, and no failed rows.
- [x] Verify the latest development attempt read-only: it completed with 14 row audits and matching 3/6/5/0 disposition totals; all 3 updated statuses match their audited after-state; all 9 updated/current rows have latest-attempt AMEX provenance; durable completed-attempt replay data is complete and verifiable without issuing another write.

Production remained read-only throughout. No raw provider response, browser/session secret, card/account/loyalty value, HMAC material, database identity, or opaque transfer/record identifier is recorded here.

## 12. Production userscript release readiness

- [x] Increase the final production userscript from the previously installed `0.5.0` to strict-monotonic version `0.5.1`; retain the separate local identity at `0.5.0-local.3`.
- [x] Add an artifact regression that rejects a production version not newer than `0.5.0`.
- [x] Document that ignored `build/amex-benefit-reader.user.js` is not distributed by Vercel and requires a separate authorized publication/install action.
- [x] Build and audit both generated identities without publishing, installing, deploying, or touching production.

## 13. Preserve sync while editing prerequisite cards

- [x] Keep the accepted validated envelope only in the sync page's React memory; do not add URL, browser-storage, cookie, or durable resume state.
- [x] Open strictly validated internal card-edit links in a separate tab with `noopener noreferrer`, card-specific accessible names, and explicit save/return/refresh guidance.
- [x] Add **Refresh after editing cards** to request a replacement read-only preview with the retained envelope, clear any prior confirmation result, and replace the active rows/proposal only after strict response validation.
- [x] Share one in-flight guard between refresh and confirmation, retain explicit confirmation, and fail closed with fresh-scan guidance when the retained handoff is invalid or expired.
- [x] Add regressions for new-tab security/accessibility, rejection of non-internal edit URLs before acknowledgement, retained-envelope reuse, replacement-proposal confirmation, loading/result clearing, refresh/confirmation exclusion, and invalid/expired refresh behavior.
- [x] Verify the complete AMEX handoff component suite passes 20/20 tests across 4 suites; targeted ESLint, strict TypeScript, and `git diff --check` pass. The existing non-failing Next/SWC version warning remains.
