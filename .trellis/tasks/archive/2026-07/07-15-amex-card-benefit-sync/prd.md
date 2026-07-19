# Read and display Amex card benefit status

## Goal

Enable the project owner, while already signed in to the U.S. American Express website, to deliberately run a private Tampermonkey scan that discovers eligible cards and reads trackable benefit status through characterized first-party Amex read endpoints, stores normalized per-card observations locally, and displays them in a simple side panel without modifying the Amex account or transmitting data outside American Express.

Website-profile synchronization and public distribution are deferred to later phases. The Phase 1 normalized contract must remain reusable by a future Chrome extension and sync implementation.

## Background and Confirmed Evidence

### Product decisions

- Phase 1 is a private Tampermonkey prototype for the project owner's current U.S. Amex account/layout.
- The user signs in to Amex themselves; the prototype never handles login credentials or MFA.
- Every scan is user-initiated and attempts all supported cards.
- Results appear in a clearly labeled side panel on the Amex benefits page.
- Only usable card credits represented in the existing Perks Reminder catalog for the conservatively matched Amex card are included. Upstream enrollment candidates, spend-progress trackers, credits earned, and completed records are eligible only after that card-specific support match.
- Informational benefits, insurance/protection, access-only perks, free-night/status awards, unmatched titles, wrong-card credits, and unknown card products are omitted rather than relabeled as supported. An intentional omission alone does not make the card observation partial.
- Approved normalized results persist locally without application-level encryption; no result is sent to the website or a third party.
- The user explicitly approved replacing the rendered-DOM-only boundary with characterized private Amex read endpoints. Requests may use the browser's existing authenticated Amex session, but the script must not read, log, or persist cookie values, authorization material, or credentials.
- Raw private response objects and raw account tokens may exist only in memory during the user-started scan. They are discarded when the scan completes, is cancelled, or the document unloads; only validated normalized observations and HMAC-derived local identity metadata persist.
- Read-only Amex exploration was authorized and completed without enrolling, linking, activating, redeeming, dismissing, submitting, or otherwise changing account state. Redacted observations are recorded in `amex-research.md`, and the public reference comparison is recorded under `research/`.
- Owner feedback after the `0.2.1` end-to-end run is that the panel is super unclear and unintuitive about benefit status. The current implementation presents all cards and benefits in one long list, uses `Incomplete` for card-level data quality, and uses compact normalized labels such as `required`, `in progress`, and `Used/earned` without a clear action hierarchy.

### Observed Amex surfaces

- The authenticated overview and benefits pages expose an account selector with card product names and displayed four- or five-digit endings. Multiple physical cards may share a product name; this remains useful owner-validation evidence against API-normalized display data.
- The account selector also includes non-card entries, and the private account response includes product/relationship variants, so the scanner must positively classify supported card records rather than assuming every account is a card.
- `/card-benefits/view-all` displays card-specific benefit definitions, categories, and labels such as enrolled, enrollment required, and linking required.
- `/card-benefits/activity` displays enrollment candidates, spend-progress trackers, credits earned for a current period, and completed benefits.
- Tracker fields vary and can include earned/used amount, target, remainder, period wording, completion state, and non-monetary counters.
- Amex warns that tracker data may lag or be reversed after refunds. Stored values are time-stamped observations, not authoritative transaction accounting.
- The rendered application calls private first-party account and benefit endpoints. The public `olddonkey/amex-assistant` reference demonstrates token-parameterized card discovery and benefit reads without visible account switching; its exact observed revision and source anchors are recorded under `research/`.
- Phase 1 may issue fresh requests only to an explicit allowlist of characterized first-party Amex read endpoints, using exact methods and validated request shapes. It must not intercept unrelated page traffic, replay captured authorization material, or call any write/mutation endpoint.
- Responses and account tokens may contain sensitive identifiers. Raw values remain scan-scoped in memory; they must never be displayed, logged, exported, committed as fixtures, or persisted. A keyed local fingerprint is derived before the raw token is discarded.

### Repository context

- The repository is a Next.js 15, Prisma/PostgreSQL, and NextAuth application (`package.json:45-75`, `prisma/schema.prisma:1-12`, `src/lib/auth.ts:96-101`). Phase 1 adds no website route, database migration, or authentication flow.
- Existing mutation conventions derive ownership from `session.user.id`; a future sync client must not supply its destination user ID (`.trellis/spec/perks-reminder/architecture-and-domain.md:59-71`).
- `CreditCard` stores `name`, `issuer`, `userId`, and optional `lastFourDigits`, while intentionally allowing multiple physical copies of one product (`prisma/schema.prisma:87-111`, `src/lib/cardDisplayUtils.ts:56-99`).
- Existing Amex display validation supports four or five ending digits (`src/lib/cardDisplayUtils.ts:9-51`). The portable observation field must therefore be named `endingDigits`, not `lastFourDigits`.
- No current database constraint or source-link field gives cards a safe issuer identity (`prisma/schema.prisma:87-111`). Existing import matching is non-transactional and vulnerable to replay/concurrency duplication (`src/app/api/user-cards/import/route.ts:118-141`, `src/lib/actions/cardUtils.ts:24-31`, `src/lib/actions/cardUtils.ts:62-137`); it must not be reused by a later sync unchanged.
- `BenefitStatus` has a cycle-level uniqueness/upsert pattern, but card and benefit records have no issuer-side key or sync provenance (`prisma/schema.prisma:195-216`, `src/lib/actions/benefitActions.ts:64-100`).
- Website session cookies are HttpOnly, Secure, and SameSite=Lax, and no extension token or cross-origin sync contract exists (`src/lib/auth.ts:102-127`).
- No userscript, Chrome extension, Amex parser, or extension build tooling currently exists.
- Existing privacy and FAQ copy describes user-provided data and promises not to request banking credentials; a future issuer-sync release requires separate disclosure updates (`PRIVACY.md:1-12`, `src/app/privacy/page.tsx:34-66`, `src/lib/faq-data.ts:6-9`).

## Requirements

### R1 — User-initiated, read-only scan

- Run only on allowlisted U.S. Amex routes after the user has signed in.
- Do not scan automatically on load, route changes, an interval, or in the background.
- On **Scan all cards**, call the characterized account-discovery read endpoint, enumerate every supported card relationship, exclude known non-card products, and mark unknown response variants as completeness issues.
- Read card-specific benefit tracker and catalog data through an exact allowlist of characterized first-party Amex endpoints, HTTP methods, and request schemas. Use the opaque account token only in memory to parameterize those reads.
- Do not intercept arbitrary Amex traffic or capture/replay cookies, authorization headers, or request credentials. Let the browser attach its existing authenticated session to fresh first-party requests.
- Never call a write endpoint or click/invoke benefit enrollment, linking, activation, redemption, offer, payment, or another mutation control.
- The API-based scan must not change the visibly selected card or benefits route; verify they remain unchanged when the scan finishes.
- Provide cancellation, bounded timeouts, bounded concurrency, and per-card failure isolation so the user is never trapped in a scan.

### R2 — Card identity and duplicate handling

- Persist only normalized product name, an explicit issuer response field containing four- or five-digit `endingDigits`, local identity metadata, and observation state. Never derive display digits from an opaque account token.
- Keep multiple physical cards with the same product name separate, including supplementary relationships returned by account discovery.
- Derive a stable, installation-local pseudonymous fingerprint from the in-memory opaque account token and a local random secret; never persist the raw token.
- Produce at most one normalized record per observed physical card in a scan.
- Treat ambiguous or conflicting identity matches as errors rather than silently merging cards.

### R3 — Trackable benefit normalization

- Validate account, tracker, and catalog response envelopes at the transport boundary; unknown or malformed variants fail safely without persisting raw payloads.
- Before normalization, conservatively match the Amex product name to an American Express card in the DB-free Perks Reminder static catalog, then retain only upstream titles that match an explicitly supported usable-credit vocabulary for that exact card.
- Include enrollment candidates, spend-progress trackers, credits earned, and completed observations only when the matched catalog card represents that usable credit with a positive credit amount.
- Exclude unmatched and wrong-card titles plus purely informational, insurance/protection, access-only, free-night/status, and otherwise non-credit benefits. Do not add a parser issue or partial marker solely because an unsupported upstream item was omitted.
- Keep card and title wording aliases exact and reviewed after punctuation/trademark normalization; do not use fuzzy product matching or infer support from generic status/category fields.
- Normalize, when visibly exposed: title, category, activity kind, enrollment state, tracker state, completion state, earned/used amount, target/limit, remaining amount, period, confidence, issue codes, and observation time.
- Distinguish `observed`, `not_exposed`, and `unrecognized`; do not infer a state from an absent label or invent a quantity.
- Preserve monetary and non-monetary units without using floating-point arithmetic for persisted decimal values.
- Deduplicate the same benefit observed across the browse and activity surfaces; conflicting indistinguishable benefits make that card incomplete rather than receiving an invented ordinal identity.

### R4 — Local per-card persistence

- Store only approved normalized records in Tampermonkey-managed browser storage.
- Maintain one latest record per physical card, including its observation time, parser version, schema version, freshness, completeness, and one current redacted error state.
- Replace records for cards that scan successfully or partially with safe normalized observations.
- If a card scan fails structurally, retain its prior observation, retain the original observation time, and mark it stale with the latest attempt time and fixed error code.
- If a first-seen card fails before producing safe data, show an error/no-data record without inventing a snapshot.
- Disclose mixed observation times and never describe an account containing stale, partial, unknown, interrupted, or failed records as fully current.
- Validate and version the whole storage envelope. Refuse to overwrite malformed or unknown-future schemas.
- Provide a confirmed **Clear local data** action that removes both normalized results and the installation-local identity secret.
- Phase 1 supports one active scan tab at a time.

### R5 — Minimal side-panel UI

- Mount an accessible, clearly isolated side panel on supported Amex benefits pages.
- Always display **Local only — not sent to Perks Reminder** and disclose that a manual scan makes first-party Amex read requests with the current signed-in session while raw responses are not saved.
- Provide **Scan all cards**, **Cancel** while scanning, progress, per-card freshness/completeness, observation and attempt times, and **Clear local data**.
- Emphasize card product/ending digits and each benefit's primary status plus amount/progress.
- Put category, enrollment, tracker, period, completion, confidence, and field-availability details in a compact secondary view.
- Display actionable fixed error messages without raw DOM, opaque tokens, account identifiers, or other sensitive diagnostics.
- Separate benefit action/progress state from observation freshness and parser completeness. A user must not have to interpret card-level `Incomplete` as a benefit that still needs use.
- Make the most important benefit states understandable without opening technical details. Human-facing copy should distinguish at least enrollment needed, in progress, completed, unavailable/unknown, stale data, and partial scan data.
- Avoid rendering every card and every technical field at equal visual priority. The default view must remain usable with the validated 16-card / 130-observation account while preserving access to every normalized observation.
- Keep issue codes, confidence, raw field availability, and parser diagnostics secondary to the user-facing status summary.

### R6 — Private API and local-data boundary

- The userscript may make credentialed first-party network requests only to reviewed Amex read endpoints on an exact origin/path/method allowlist. Every other destination and every mutation method/endpoint is denied.
- Do not read, collect, log, export, or persist passwords, MFA values, cookie contents, authorization headers, CVVs, full card numbers, balances, loyalty account numbers, transaction data, or unrelated response fields.
- Raw account and benefit responses and opaque account tokens may exist only in scan-scoped memory. Discard them on completion, cancellation, timeout, or unload. Do not put them in Tampermonkey storage, page storage, diagnostics, fixtures, screenshots, or task artifacts.
- Persist only strict normalized observations and HMAC-derived local identity metadata. Local normalized storage is not application-level encrypted and relies on the security of the owner's browser profile and Tampermonkey installation.
- Do not transmit observations to the Perks Reminder website, analytics, logging services, or any third party. First-party requests to American Express are the only Phase 1 network activity.
- Do not add remote update/download metadata, keep-alive traffic, session-extension behavior, or background polling.

### R7 — Compatibility and maintainability

- Isolate the normalized contract, allowlisted Amex read client, response adapter, scan engine, identity policy, storage policy, Tampermonkey adapter, and side-panel UI.
- Version endpoint/request definitions and response-parser rules independently from the storage schema.
- Treat unknown routes, response versions/shapes, account relationships, benefit records, and status values as safe incomplete/error states rather than guessing.
- Build an installable Tampermonkey artifact with only the minimum grants needed for local storage and the selected first-party request mechanism; do not request broad cross-origin access or page-global access unless owner-only runtime validation proves it is required and the task design is reviewed again.
- Keep the portable observation free of Tampermonkey-only identity secrets so a future Manifest V3 extension and separately reviewed website transport can reuse it.

### R8 — Bundle-level synthetic Chromium validation

- Provide an unattended real-Chromium harness that builds and injects the generated userscript IIFE at an approved Amex benefits URL; routine end-to-end iteration must not require Tampermonkey installation or an authenticated Amex session.
- Install interception before the synthetic document is navigated. Fulfill only that invented document, browser CORS preflights for the two exact reviewed cross-origin reads, and the three exact account/tracker/catalog operations; abort every other request without network fallback.
- Provide a browser-compatible inspectable `GM.getValue`/`setValue`/`deleteValue` mock, using invented fixtures only, so persistence and deletion can be asserted without adding a production debug/export surface.
- Exercise the panel through its open Shadow DOM as a user, including manual start, progress, duplicate physical cards, supported-credit filtering, card switching, persistence/reload without autoscan, partial read handling, visible-context invariance, and confirmed deletion of both local keys.
- Keep screenshots, traces, and browser results ignored and synthetic. A separate optional headed visual-preview command may create a synthetic screenshot for developer inspection.
- Treat this harness as repeatable regression evidence, not as a replacement for milestone owner-only validation of the Tampermonkey sandbox, authenticated session/CORS behavior, current private response compatibility, or absence of issuer mutations on the live site.

## Acceptance Criteria

- [ ] AC1: Nothing is scanned before the user presses **Scan all cards** on a supported, authenticated Amex benefits page.
- [ ] AC2: The scan discovers every supported card relationship from the characterized account response, excludes known non-card products, flags unknown variants, and leaves the original visible card/route unchanged.
- [ ] AC3: Separate physical cards sharing a product name remain distinct, and neither cards nor benefits are duplicated within a scan.
- [ ] AC4: Each safely scanned card displays only card-specific usable credits represented in the Perks Reminder catalog; unmatched, wrong-card, informational, insurance/protection, access-only, free-night/status, and otherwise non-credit items are absent from normalized/persisted output and therefore from the panel.
- [ ] AC5: Unknown response shapes/status values, HTTP/auth failures, timeouts, cancellation, and schema mismatches produce explicit partial/interrupted/error states without guessed data.
- [ ] AC6: Successful/partial cards update independently; failed cards preserve prior observations with stale/error markers and mixed-age warnings.
- [ ] AC7: The local side panel shows scan progress, simple benefit summaries, freshness/completeness, timestamps, local-only disclosure, cancellation, and confirmed local-data deletion.
- [ ] AC8: Serialized storage and diagnostics contain none of the forbidden sensitive fields, raw responses, or raw upstream identifiers. Runtime network evidence contains only the exact approved first-party Amex read endpoints and methods, with no write, website, analytics, update, or third-party request.
- [ ] AC9: Synthetic redacted JSON fixtures cover four- and five-digit endings, duplicate product names, primary/supplementary relationships, non-card and unknown account variants, enrollment/progress/earned/completed groups, monetary and count units, optional/missing fields, unknown status values, malformed envelopes, and conflicting benefit identities.
- [ ] AC10: Unit, response-fixture, type-check, bundle, and owner-only browser validation demonstrate the complete read-only flow, confirm raw payloads are scan-scoped only, and confirm no Amex mutation endpoint/control is activated.
- [ ] AC11: The portable normalized contract and core modules do not depend on Tampermonkey, Next.js, Prisma, or website authentication and can be reused by a future Chrome extension/sync phase.
- [ ] AC12: The panel uses a card-first single-card workspace, clearly separates benefit state from observation/data quality, provides understandable status labels and compatible-unit progress, and remains usable with 16 cards and 130 observations without a continuous all-card list.
- [ ] AC13: Synthetic tests prove catalog-backed card/title variants, wrong-card rejection, unknown-card fail-closed behavior, non-credit omission without partial status, supported-credit deduplication, compatible legacy-store filtering, and unchanged storage schema and network allowlist behavior.
- [x] AC14: Playwright runs the actual generated userscript IIFE in real Chromium against invented responses, proves no private read occurs before manual start, allows only the exact synthetic document/read boundary, exercises complete, partial, mid-scan cancellation, later-rescan stale-preservation, reload, and clear behavior through Shadow DOM, and persists no raw fixture token or unsupported benefit.

## Out of Scope

- Logging in to Amex or handling passwords, MFA, CAPTCHAs, or access controls.
- Intercepting arbitrary Amex traffic; capturing/replaying credentials; persisting/exporting raw private responses; calling unreviewed endpoints; or reverse-engineering beyond the characterized read request/response shapes needed for this owner-only prototype.
- Activating, enrolling, linking, redeeming, dismissing, paying, adding offers, or otherwise changing Amex account state through either UI controls or write endpoints.
- Sending data to Perks Reminder, adding a website API/auth bridge, changing Prisma models, or persisting data in a website profile.
- Historical local snapshots, analytics, background/automatic scans, multiple simultaneous scan tabs, public userscript distribution, localization, or support for other Amex layouts/accounts.
- Supporting issuers other than American Express.
- Packaging the Manifest V3 Chrome extension; Phase 1 only preserves the migration boundary.
- Using the synthetic browser harness to claim that current live Amex schemas, authenticated cookies/CORS, Tampermonkey grants, or issuer-side no-mutation behavior have been revalidated; those remain milestone owner-only checks.

## Open Product Question — UI clarity revision

- **Resolved:** the owner chose a **card-first** hierarchy. The default panel must make physical-card identity the primary navigation level, then explain benefit status within the chosen card. Account-level scan health and data-quality issues remain visually separate from whether an individual benefit needs action.
- **Resolved by product design:** show one selected card at a time through a compact, accessible native card switcher. Within the selected card, provide compact filters for all benefits, needs action, in progress, and completed. This avoids recreating the current 16-card continuous scroll while retaining access to every normalized observation.

## UI Clarity Revision — Product Direction

- Match the Perks Reminder visual language: neutral card surfaces, rounded borders, subtle shadows, dark primary actions, muted secondary text, amber open/action states, emerald completed states, and compact pill badges.
- Keep the global header focused on scan control and account-level scan health. Move destructive local-data clearing into a secondary data/privacy area.
- Show one physical card at a time. The switcher label must include product name and ending digits so duplicate products remain distinguishable.
- Replace ambiguous card badges such as `Incomplete` with explicit observation labels: `Up to date`, `Partial data`, `Stale data`, or `Could not read`.
- Replace normalized vocabulary with human-facing benefit labels such as `Enrollment required`, `Link required`, `Not started`, `In progress`, `Credit earned`, `Completed`, and `Status unavailable`.
- Present benefit title, status, amount/progress, and period as the primary card content. Put category, confidence, raw field availability, parser issue messages, and timestamps behind secondary disclosures.
- Show a progress bar only when current and target quantities are both observed with compatible units. Never infer missing values or derive a remaining amount.
- Preserve the manual-start, read-only, local-only, no-autoscan, and no-new-persistence boundaries.
