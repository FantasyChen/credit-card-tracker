# Browser-Side Authenticated Read Integrations

## Scenario: manual read-only account import

### 1. Scope / Trigger

Use this contract when browser code reads data from a provider using the user's existing signed-in browser session and converts it into local Perks Reminder observations. The current reference implementation is `src/lib/amex-benefit-reader/` plus `src/userscripts/amex-benefit-reader.user.ts`.

This boundary is different from website authentication and server-side import. Browser session credentials may be attached by the browser, but the integration must never inspect, copy, log, export, or persist passwords, MFA values, cookies, authorization headers, opaque provider tokens, or raw provider responses. Provider-specific endpoint inventories and live validation evidence belong in the owning task research rather than this project-wide spec.

### 2. Signatures

Keep provider transport, normalization, visible-context checks, and persistence behind narrow ports. The current source contract is:

```ts
interface AmexReadClient {
  discoverAccounts(signal: AbortSignal): Promise<MemberResponse>;
  readBenefitTrackers(
    rawAccountToken: string,
    signal: AbortSignal,
  ): Promise<TrackerResponse>;
  readBenefitCatalog(
    rawAccountToken: string,
    signal: AbortSignal,
  ): Promise<CatalogResponse>;
}

interface VisibleContextGuard {
  capture(): VisiblePageContext;
  verifyUnchanged(context: VisiblePageContext): boolean;
}

interface ResultStore {
  load(): Promise<StoreEnvelopeV1>;
  commitCard(result: CardAttemptResult): Promise<StoredCardRecordV1>;
  recordScanSummary(summary: ScanSummaryV1): Promise<void>;
  clear(): Promise<void>;
}
```

The persisted observation boundary is versioned and normalized:

```ts
interface NormalizedBenefitObservationV3 {
  benefitKey: string;
  title: string;
  category: ObservedField<string>;
  activityKind: "credit_usage" | "completed";
  enrollmentState: ObservedField<EnrollmentState>;
  trackerState: ObservedField<TrackerState>;
  completionState: ObservedField<"complete" | "incomplete">;
  earnedOrUsed: ObservedField<QuantityV1>;
  targetOrLimit: ObservedField<QuantityV1>;
  remaining: ObservedField<QuantityV1>;
  period: ObservedField<string>;
  sourcePeriod: ObservedField<SourcePeriodV2>;
  confidence: "high" | "medium" | "low";
  issueCodes: IssueCode[];
}

interface NormalizedCardObservationV3 {
  contractVersion: "amex-benefits/3";
  issuer: "american_express_us";
  localCardId: string;
  productName: string;
  endingDigits: string;
  observedAt: string;
  parserVersion: "amex-api-us/3.0.0";
  scanId: string;
  completeness: "complete" | "partial";
  issueCodes: IssueCode[];
  benefits: NormalizedBenefitObservationV3[];
}

// Destination authority is deliberately absent from local V3 observations:
// no productKey on the card and no creditFamilyKey on a benefit.
```

Account ownership is decided before identity preparation or card-specific reads:

```ts
interface TransientAccountCard {
  rawAccountToken: string;
  productName: string;
  endingDigits: string;
}

interface AccountDiscovery {
  cards: TransientAccountCard[];
  knownNonCardCount: number;
  unknownVariantCount: number;
  issueCodes: IssueCode[];
}

function parseAccountDiscovery(response: MemberResponse): AccountDiscovery;

const PRIMARY_ONLY_COMPATIBILITY_KEY =
  "perksReminder.amexBenefitReader.compat.primaryOnly.v1";
const PRIMARY_ONLY_COMPATIBILITY_VALUE = "primary-only/1";

const V3_SELECTION_COMPATIBILITY_KEY =
  "perksReminder.amexBenefitReader.compat.v3Selection.v1";
const V3_SELECTION_COMPATIBILITY_VALUE = "v3-selection/1";
```

Local provider observation and destination synchronization are separate boundaries. The current writable boundary is specified in [AMEX Sync Reconciliation](amex-sync-reconciliation.md). The narrow matcher signature below records the historical envelope-V2 Platinum-only baseline; do not use it as the current envelope-V3 mapping or write-authority contract.

```ts
function normalizeAmexSelectionText(value: string): string;
function isIgnoredAmexCatalogBenefitTitle(title: string): boolean;
function isEligibleLocalAmexUsageTitle(title: string): boolean;

interface AmexBrowserSyncMatch {
  productKey: "american-express-platinum-card";
  creditFamilyKey:
    | "american-express-platinum-card:resy"
    | "american-express-platinum-card:lululemon";
}

function matchAmexBrowserSyncCredit(
  productName: string,
  trackerTitle: string,
): AmexBrowserSyncMatch | null;

type BenefitUsageLabel =
  | "Not used"
  | "Partially used"
  | "Used"
  | "Enrollment required"
  | "Link required"
  | "Status unavailable";

type BenefitTone = "amber" | "blue" | "green" | "muted";

interface BenefitUsagePresentation {
  label: BenefitUsageLabel;
  tone: BenefitTone;
  filter: "remaining" | "used";
}

function deriveBenefitUsageState(
  benefit: NormalizedBenefitObservationV3,
): BenefitUsagePresentation;

function decodeNumericCharacterReferences(value: string): string;
function formatAmexBenefitTitle(value: string): string;
function formatAmexSourcePeriod(period: SourcePeriodV2): string;

type CardCoverageKind =
  | "benefit_bearing"
  | "confirmed_empty"
  | "latest_scan_unresolved"
  | "older_retained";

interface CardCoverageEntry {
  record: StoredCardRecordV1;
  kind: CardCoverageKind;
}

function projectCardCoverage(store: StoreEnvelopeV1): CardCoverageEntry[];

type BenefitIdentityConflictDiagnostic =
  | "tracker_state_collision"
  | "tracker_catalog_key_mismatch"
  | "ambiguous_catalog_join"
  | "tracker_catalog_candidate_collision";

type BenefitIdentityConflictSourceRole =
  | "tracker"
  | "joined_catalog"
  | "catalog_enrollment_candidate";

type ConflictDiagnosticField<T> =
  | { state: "observed"; value: T }
  | { state: "not_exposed" }
  | { state: "unrecognized" };

interface BenefitIdentityConflictDetail {
  conflictKey: string;
  category: BenefitIdentityConflictDiagnostic;
  reviewedCreditKeys: string[];
  reviewedCreditFamilies: string[];
  candidateCount: number;
  candidatesTruncated: boolean;
  candidates: BenefitIdentityConflictCandidateDetail[];
  relations: {
    sameJoinId: "same" | "different" | "unavailable";
    period: "same" | "different" | "unavailable";
    amount: "same" | "different" | "unavailable";
    state: "same" | "different" | "unavailable";
  };
}

interface BenefitIdentityConflictDetailSet {
  details: BenefitIdentityConflictDetail[];
  totalCount: number;
  truncated: boolean;
}

interface BenefitNormalizationResult {
  benefits: NormalizedBenefitObservationV3[];
  issueCodes: IssueCode[];
  conflictDiagnostics: BenefitIdentityConflictDiagnostic[];
  conflictDetails: BenefitIdentityConflictDetailSet;
}
```

`BenefitIdentityConflictCandidateDetail` is a closed projection containing only a one-based scan-local candidate index, one fixed source role, bounded parsed display title, explicit parsed/not-exposed/unrecognized category/activity/enrollment/tracker/completion fields, parsed decimal quantity fields with characterized units/currency, parsed period, and bounded catalog layout/enrollability. V3 local conflicts carry no destination product/family claims; legacy supported-credit key/family slots remain null. The projection has no generic record field, issuer/source ID, provider token, request metadata, or raw object. The current Amex caps are 24 conflict details and four rendered candidates per conflict; bounded total counts plus truncation booleans disclose omitted detail without retaining unbounded output.

```ts
type ScanProgress =
  | { type: "started" }
  | {
      type: "discovered";
      cardCount: number;
      unknownEntryCount: number;
    }
  | {
      type: "card";
      cardIndex: number;
      cardCount: number;
      productName: string;
      endingDigits: string;
      phase: CardReadPhase;
    }
  | {
      type: "card_committed";
      record: StoredCardRecordV1;
      conflictDiagnostics: BenefitIdentityConflictDiagnostic[];
      conflictDetails: BenefitIdentityConflictDetailSet;
    }
  | { type: "verifying_context" }
  | { type: "finished"; summary: ScanSummaryV1 };

interface ScanReporter {
  report(progress: ScanProgress): void;
}
```

`deriveBenefitUsageState` is a conservative presentation projection, not a persisted binary status. `decodeNumericCharacterReferences` decodes one pass of valid semicolon-terminated decimal or hexadecimal Unicode scalar references for display and leaves named, malformed, null, surrogate, and out-of-range references literal. `formatAmexBenefitTitle` applies that one-pass decoder and removes only a reviewed Amex adornment: terminal `<sup>‡</sup>` or `<sup>®</sup>`, standalone `‡`, or either exact superscript marker immediately before the exact suffix ` Statement Credit`. It trims trailing whitespace, preserves one separating space before `Statement Credit` when a nonempty prefix remains, and falls back to the decoded title when terminal removal would make it empty. Formatted output must still enter the DOM through text-only APIs such as `textContent`.

`isEligibleLocalAmexUsageTitle` is product-independent and is used only after a tracker category normalizes exactly to `usage`. It rejects the closed reviewed titles `35% Airline Bonus` and `Link Your Resy Profile`, plus explicit non-credit access/protection/insurance/free-night/status phrases. Exact `spend`, `access`, `loan`, missing, and unrecognized categories are omitted before title joining, field interpretation, candidate evidence, or conflict creation. Product name, amount, state, cadence, ending digits, and destination catalog membership are never local-row admission evidence.

Catalog data can enrich enrollment state only for an already-admitted tracker row through one unambiguous transient issuer-ID join. Catalog titles never replace the tracker title, catalog-only records never manufacture local rows, and issuer IDs never enter normalized output. An ambiguous join leaves the tracker-backed row present, records bounded internal conflict evidence, marks the card partial, and therefore keeps synchronization fail closed.

`matchAmexBrowserSyncCredit` is a separate destination-boundary function. It matches one closed exact-normalized product/title pair to one destination product/family and uses no substring, amount, cadence, ending, or near-product inference. Local observations contain neither `productKey` nor `creditFamilyKey`; those fields exist only in a projected sync envelope. The browser mapping does not replace or share authority with the independent server allowlist.

`parseAccountDiscovery` emits only characterized top-level cards whose exact resolved relationship is `BASIC`. A nested exact `SUPP` relationship is an understood primary-only policy exclusion and is skipped before its token, ending, or product fields are inspected; it creates no identity preparation, card-specific provider request, discovered/attempted count, normalized record, panel group, or sync candidate. Missing, contradictory, and uncharacterized relationship shapes remain fail-closed unknown variants. Structure and relationship are authoritative because a supplementary entry may inherit an ordinary supported parent product name.

`projectCardCoverage` classifies each stored physical card against the latest scan as benefit-bearing, conclusively empty, unresolved in the latest scan, or older retained. This classification remains an internal projection for correctness; the panel does not expose quality counts, quality badges, scan notes, timestamps, parser/confidence fields, issue explanations, or other diagnostic metadata. Active-filter row membership alone decides which card groups render. `formatAmexSourcePeriod` renders observed V3 UTC date ranges deterministically as compact English calendar text: a full year as `2026`, a full month as `Jul 2026`, a same-year whole-month range as `Jul–Sep 2026`, and irregular/cross-year ranges with explicit compact dates. Raw provider duration text is a legacy or unavailable-structured-period fallback only.

`BenefitIdentityConflictDiagnostic` remains an internal fixed vocabulary derived only from the adapter branch that detected a generic `benefit_identity_conflict`. The fixed category contains no source values or destination identity. The adapter may additionally project the minimum already-parsed candidate facts into `conflictDetails` for in-memory debugging and tests, but the panel must ignore both fields and must not expose them in visible copy, accessibility text, semantic DOM hooks, normalized observations, scan summaries, storage, logs, network traffic, reload reconstruction, or task evidence.

Do not expose a generic `request(url, init)` port to scan orchestration. Add a named method and an exact operation contract for every newly approved read.

### 3. Contracts

1. **Mount, presentation, and manual start are separate**: an integration may mount throughout one reviewed exact HTTPS origin while using a smaller set of primary paths only to choose its initial presentation. Off-primary routes must begin as a compact accessible launcher when the full reader could obscure provider controls. Mounting, restoring state, expanding, collapsing, or changing routes must not discover accounts or perform provider reads; those begin only after an explicit scan action. Page load must not scan, poll, keep the session alive, or schedule background work.
2. **Exact operation allowlist**: each operation fixes origin, path, method, headers, body builder, credentials mode, redirect behavior, timeout, response schema, and retry policy. Deny every tuple not represented by a named operation.
3. **Browser-session attachment only**: `credentials: "include"` may let the browser attach its existing provider session. Code must not read cookie content, password-manager state, MFA values, or authorization material.
4. **Bounded raw lifetime**: raw responses and opaque account tokens may exist only in active-scan memory. Remove each token from scan-wide collections before its card attempt; clear per-card responses and tokens in `finally`; clear remaining transient values on completion, cancellation, timeout, error, or unload.
5. **Strict projection**: parse external JSON through bounded schemas that retain only approved scalar fields and nested projections. Do not use permissive raw-object fields. Accept JSON media type only when it is exactly `application/json`, optionally followed by parameters; `application/jsonp` is not JSON.
6. **Normalized persistence only**: persist versioned observations, redacted issue codes, a random local card ID, and an installation-secret HMAC fingerprint. Never persist raw responses, provider tokens, request headers, full account numbers, or diagnostics derived from them.
7. **Conservative identity**: duplicate product names are not identities. Reconcile cards with the HMAC fingerprint and explicit four- or five-digit display endings; reject conflicts and full-number fields rather than truncating them.
8. **No inferred provider facts**: preserve decimal quantities as strings. Do not default missing values to zero, infer currency or cadence, derive a remaining amount, parse amounts from titles, derive display digits from opaque tokens, or sum quantities across cards.
9. **Partial observations are explicit**: retain safe normalized tracker data when an optional enrichment read fails with an eligible redacted issue code. Mark the observation partial; do not fabricate enrichment fields. Cancellation and required-read failures are not partial success.
10. **Per-card commit and stale preservation**: commit each successful or partial card independently. A failed card preserves its prior observation as stale when one exists; it must not erase good data from an earlier scan.
11. **No mutation or transport expansion**: browser readers must not enroll, activate, link, redeem, add offers, pay, or change provider state. They must not send observations to Perks Reminder, analytics, or third parties unless a separate task defines and approves that contract.
12. **Visible-context invariant**: capture the reviewed exact origin and current pathname before scanning, plus a one-way selected-display fingerprint only when a recognized selected-card control is present. Final verification always requires the same origin/pathname. A captured fingerprint must remain present and equal; an absent selector is valid and makes route invariance sufficient, even if a selector appears later. Report changed or unavailable context without persisting the visible display string.
13. **Keep evidence quality internal and benefit state truthful**: user-facing presentation must never reuse parser completeness/freshness as a benefit status, and it must not expose observation-quality labels, quality badges, scan notes, issue explanations, timestamps, parser/confidence fields, or conflict diagnostics. `Enrollment required`, `Link required`, `Used`, `Partially used`, `Not used`, and `Status unavailable` describe the benefit. Apply state precedence in this order: enrollment/linking requirements; explicit completion, recognized earned/completed tracker or activity kind, or compatible used-at/above-target evidence as `Used`; compatible observed zero-below-target evidence as `Not used` even when a generic tracker state says in progress; explicit in-progress or compatible positive-below-target evidence as `Partially used`; explicit not-started evidence as `Not used`; otherwise `Status unavailable`. Generic in-progress remains `Partially used` when compatible zero evidence is absent, including when quantities are missing, incompatible, or uncharacterized.
14. **Scale by physical card identity, isolate active scans, and render only active-filter rows**: when an account can contain many observations or repeated product names, maintain internal coverage by physical card and include product plus explicit ending digits in every terminal card-group label. The terminal card list is filter-aware: render a group only when it has at least one row in the selected filter. `Remaining` is the default and contains every non-`Used` row; `Used` contains only `Used` rows; membership never relabels a row. An all-used card is absent from `Remaining` and appears with rows under `Used`; zero-benefit partial/failed/stale/older-retained records create no empty card shell or data-quality copy. Use one filter-specific terminal empty state that points to the other filter when applicable. While scanning or cancelling, replace the entire terminal panel body with a dedicated workspace containing only the panel title, minimal accessible status text, a native progress element, and Cancel (disabled while cancelling). Do not render stale or incrementally committed cards, filters, summaries, Sync, privacy/footer/details controls, diagnostic copy, or timestamps. Progress is indeterminate until discovery yields a positive card count; then use real card index/count events, clamp the value to the discovered count, and remain in the isolated workspace through context verification. A zero-eligible-card scan remains indeterminate. Only the engine's `finished` event may restore terminal results; resolving `startScan()` is not terminal authority.
15. **Product-independent local observation**: every characterized top-level exact `BASIC` card uses the same local selection rule regardless of product display name. Admit only tracker-backed rows whose normalized provider category is exactly `usage` and whose bounded title passes the reviewed non-credit exclusions. Use the tracker title as local display/identity evidence. Never require a shared-catalog card match, borrow another product's rules, or infer local eligibility from product resemblance, amount, cadence, or ending digits. A successfully read unknown product commits V3; an empty usage set is a truthful complete V3 empty observation.
16. **Fail-closed filtering and enrichment before interpretation**: omit exact `spend`, `access`, `loan`, missing, and unrecognized tracker categories before status/quantity interpretation, joining, candidate evidence, or conflict creation. Remove catalog titles in the closed reviewed exclusion set (`35% Airline Bonus`, `Link Your Resy Profile`) before issuer-ID grouping. Catalog evidence may enrich one tracker-backed row only through an unambiguous same-card join; it cannot create a row, replace its title, add destination identity, or erase a valid usage row. Intentional omission produces no row or issue. Materially different duplicate trackers and ambiguous enrichment retain the generic conflict and partial/fail-closed behavior.
17. **Versioned compatibility and exact sync projection**: when physical-card ownership or local selection authority changes and old observations cannot reconstruct discarded evidence, validate first and invalidate rather than guess. The primary-only marker clears role-unverified cards and `lastScan`; the V3-selection marker removes V1/V2 cards and `lastScan`; both delete legacy/current pending mailboxes, preserve the installation identity secret, read markers before the store, and write each marker last. Increment only when state changes, make later loads idempotent, clear every marker/mailbox key, and refuse malformed/future stores unchanged and unmarked. Sync projection requires the exact current V3 contract, parser, scan ID, freshness, completeness, successful disposition, structured period, and a closed exact browser product/title mapping. It introduces destination keys only in the envelope and never promotes partial history or clears a generic conflict.
18. **Conservative quantity compatibility**: infer usage from used-versus-target comparison only when both values are valid nonnegative decimal strings, the target is positive, both units are characterized and equal, and currencies are equal. Matching `unknown` units are never compatible. Compare decimal strings deterministically rather than converting them to floating point. Incompatible, invalid, negative, missing, or nonpositive-target quantities cannot infer usage state. A combined inline used/target amount requires equal characterized units and currencies; an individual characterized used or target quantity may still be shown when its counterpart is absent.
19. **Practical row density and structured periods**: show benefit name, exact truthful state, safely available observed used/target evidence, and period inline. For V3, prefer an observed structured UTC source range and render it deterministically with compact English month labels (`2026`, `Jul 2026`, `Jul–Sep 2026`); use explicit compact start/end dates for irregular or cross-year ranges. Show the raw normalized period only as a legacy or unavailable-structured-period fallback, never alongside a valid structured range. Keep completeness/freshness, fixed redacted reasons, parser fields, confidence, issue codes, observation/scan timestamps, and other technical evidence internal; do not render them in card headings, secondary disclosures, notes, summaries, or accessibility text.
20. **Provider text remains inert**: decode valid decimal and hexadecimal numeric character references exactly once at the presentation boundary, leave unsupported or invalid references literal, and insert the result with `textContent` or an equivalent text-only API. A provider-specific presentation formatter may remove only a reviewed footnote adornment after that single pass; for Amex, this is a terminal literal or numeric-reference-derived `<sup>‡</sup>` or `<sup>®</sup>`, standalone `‡`, or either exact superscript marker immediately before the exact suffix ` Statement Credit`. Preserve one separating space before `Statement Credit` when a nonempty prefix remains, trim trailing whitespace, and fall back to the decoded title when terminal stripping would empty it. Preserve arbitrary other nonterminal markers, whitespace variants, broader suffixes, other tags/symbols, double-encoded references, and unrelated markup-like text. Never decode provider text by assigning it to `innerHTML`, never use `DOMParser` or broad tag stripping for display cleanup, never execute decoded markup, and do not rewrite the stored normalized title solely for presentation compatibility.
21. **Internal conflict diagnostics only**: retain `benefit_identity_conflict` as the only persisted issue and preserve partial/fail-closed handling. Classify active V3 conflict sites with the stable fixed enum; local candidates carry no destination product/family claim and any legacy supported-key slots remain null. A per-card `card_committed` event may contain a bounded closed projection of already-parsed candidate facts for in-memory debugging and deterministic tests: category; fixed source role; bounded display title; explicit parsed enrollment/tracker/completion/activity, decimal quantity/unit/currency, and period fields; same/different/unavailable relations; and catalog layout/enrollability only where needed. Cap details and candidates, mark truncation, sort deterministically, and use stable scan-local keys. The production panel must ignore this projection and expose no category, detail, scan note, semantic diagnostic hook, or restored explanation in visible or accessible DOM. Never include credentials, cookies, authorization headers, MFA values, opaque provider tokens, raw response objects, or issuer/source IDs; never place structured details or categories in normalized snapshots, scan summaries, GM storage, console, network, task artifacts, or reload reconstruction. Diagnostics must not choose an observation, invent persisted benefit identity, broaden matching, merge contradictory state, resolve/suppress a conflict, or expand transport authority.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Reader mounts, restores, expands, collapses, or observes an in-document route change before manual scan | Restore normalized local state only; make no reader discovery/tracker requests |
| Redirect or HTML/login response | Reject; do not follow as a successful read or parse it as JSON |
| `401`/`403` or equivalent signed-out classification | Hard card/discovery failure; no retry; never downgrade to partial enrichment |
| Network failure or `5xx` | At most one retry for that operation |
| Other `4xx`, timeout, cancellation, redirect, content-type error, or schema error | No retry |
| Content type is `application/json` or `application/json; ...` | Parse with the operation's bounded schema |
| Content type is `application/jsonp`, HTML, missing, or unrelated | Reject as `content_type_invalid` |
| Required discovery/tracker read fails | Fail that attempt; preserve prior observation as stale when available |
| Tracker read succeeds and optional catalog/enrichment fails with an approved partial issue code | Normalize tracker data with enrichment absent; commit a partial observation with the exact redacted issue code |
| Cancellation occurs at any phase | Abort and record interruption; do not convert cancellation into partial success |
| Top-level account resolves exactly to relationship `BASIC` | Admit it to discovery only when its token, product, and explicit ending validate |
| Nested supplementary entry resolves exactly to relationship `SUPP` | Treat it as an understood primary-only exclusion before inspecting identity fields; create no unknown issue, identity work, card request, count, stored record, panel group, or sync candidate |
| Relationship is missing, contradictory, uncharacterized, or appears in an unapproved structural layer | Do not guess; classify the entry as an unknown account variant and keep the scan fail closed |
| Product, token, or display-ending candidates conflict on an eligible BASIC entry | Do not guess; classify the entry as unknown or identity-conflicted |
| Quantity value, unit, currency, status, or activity vocabulary is uncharacterized | Preserve only safe fields, add an issue code, and mark partial; do not infer |
| Local envelope fails schema/migration validation | Refuse to scan into malformed state and offer explicit local-data recovery |
| Exact origin/pathname changes, or a selected display captured at scan start changes/disappears | Finish safe commits, but mark the summary changed or unavailable |
| No recognized selected-card control exists at capture | Capture a null fingerprint and verify exact origin/pathname only; do not block manual scan or infer a display identity |
| Observation is partial/stale while a benefit row exists | Render the row's truthful benefit state only; keep completeness/freshness, issue reasons, and timestamps internal |
| Duplicate primary products or a high-observation account are restored | Keep physical cards distinct by product plus ending digits, but render a group only when it has rows in the active filter; expose no aggregate quality or retained-card counts |
| Stored-card count exceeds latest attempted-card count | Keep reconciliation internal and omit zero-row older records from the card list; render no data note or diagnostic count |
| Latest-scan card has zero benefits after a partial catalog HTTP failure | Omit its empty card shell and all quality/error copy; do not claim the partial read proved no trackable benefits |
| Benefit-bearing card has only Used rows while `Remaining` is selected | Render no card group for it; keep Used filter membership available and render the card with rows after selecting `Used` |
| No card has a row in the active filter | Render one filter-specific terminal empty state; direct the user to the other filter when it contains rows |
| Scan is started or cancellation is requested | Replace terminal content with title, minimal live status, native progress, and Cancel only; expose no prior or incrementally committed result data |
| Discovery has not produced a positive card count, including zero eligible cards | Keep progress indeterminate and remain in the isolated workspace until `finished` |
| Positive discovery and card events are reported | Set progress max to discovered card count and value to the clamped current card index; do not show card identity or result rows |
| `startScan()` resolves before a terminal engine event | Remain isolated; only `finished` may restore terminal result UI |
| Amex tracker category normalizes exactly to `usage` and its bounded title passes reviewed exclusions | Admit it locally for every characterized BASIC product, independent of product name and amount |
| Amex tracker category is exact `spend`, `access`, or `loan`, or is missing/unrecognized | Omit it before joining, interpretation, candidate evidence, conflicts, persistence, panel rendering, and sync projection |
| Amex catalog title is exactly a reviewed ignored title after bounded normalization | Omit it before issuer-ID grouping and enrollment-candidate creation; it cannot make a supported joined catalog record ambiguous |
| V3 benefit has an observed structured UTC source range | Render deterministic compact calendar text and suppress the raw provider duration token; use raw period only when structured data is unavailable |
| Benefit is anything other than `Used` | Include it in `Remaining` while preserving its exact truthful state label |
| Compatible used quantity is zero below a positive target while tracker state is `in_progress` | Show `Not used`; the specific zero-usage evidence overrides the generic in-progress fallback |
| Tracker state is `in_progress` and compatible observed zero evidence is absent | Show `Partially used`, including when quantities are missing, incompatible, or uncharacterized |
| Used and target quantities have matching `unknown` units or mismatched units/currencies | Do not compare them, infer state from the quantities, or show a combined used/target amount |
| Used or target quantity is invalid/negative, or the target is nonpositive | Do not infer usage state from the comparison; malformed quantities remain rejected by the normalized schema |
| Benefit title contains a valid semicolon-terminated decimal or hexadecimal numeric character reference | Decode one pass for display and insert the result as inert text |
| Benefit title contains a named, malformed, null, surrogate, or out-of-range reference | Leave it literal; do not throw or create markup |
| Benefit title contains a double-encoded numeric reference | Decode at most the outer reference; leave any newly produced reference literal rather than decoding twice |
| Amex benefit title ends with literal `<sup>‡</sup>` or `<sup>®</sup>`, an exact equivalent produced by the one decoding pass, or standalone `‡` | Remove only that terminal presentation adornment and trailing whitespace; retain the original normalized title in storage |
| Literal or one-pass-decoded Amex `<sup>‡</sup>` or `<sup>®</sup>` is immediately followed by the exact suffix ` Statement Credit` | Remove only the marker, preserve one separating space before `Statement Credit` when a nonempty prefix remains, and retain the original normalized title in storage |
| Amex benefit title contains either recognized superscript marker in arbitrary mid-title prose, an unreviewed superscript symbol/tag, a whitespace variant or broader suffix, unrelated markup-like text, double encoding, or only the terminal adornment | Preserve nonterminal/unrelated text as inert visible text; decode only the original pass; if terminal stripping would empty the title, show the decoded original |
| An adapter path emits `benefit_identity_conflict` | Keep the generic issue and partial disposition; any fixed category or bounded parsed candidate projection remains internal to the current event/debug path |
| A `card_committed` event contains conflict diagnostics or details | Ignore those fields in panel presentation; expose no visible/accessibility copy or semantic diagnostic hooks and make no automatic choice |
| A card is committed again, panel reloads/reconstructs from a stored generic conflict, or a new scan/clear begins | Show no prior conflict category/detail and infer nothing from storage |
| Product name has no exact normalized destination mapping | Persist and display its valid local usage rows, but project no sync card; do not guess a nearby product or borrow destination authority |
| Exact usage tracker title has no destination mapping | Persist and display it locally, but omit it from the sync envelope without changing card completeness |
| Title contains a credit brand plus an explicit non-credit phrase such as access, protection, insurance, free night, or status | Reject the local row even when a broader merchant phrase also appears |
| Catalog record has no tracker-backed usage row | Do not create a local observation, enrollment candidate, panel row, or sync row |
| Primary-only compatibility marker is absent for a valid existing snapshot | Invalidate all cards and `lastScan`, delete legacy/current pending mailboxes, preserve the identity secret, increment revision once when state existed, and write the marker only after successful mutation |
| V3-selection compatibility marker is absent for a valid store containing V1/V2 | Remove selection-incomplete legacy cards and `lastScan`, preserve valid V3/null-latest state and the identity secret, delete both mailbox keys, and write the marker last |
| Concurrent compatibility loads or a persistence step fails | Marker-before-store read ordering prevents stale return after completed migration; an unwritten marker makes partial failure retryable and later loads converge on the invalidated snapshot |
| Observation or mailbox is not exact current V3/parser/envelope-v2/mailbox-v2 | Reject it from synchronization projection/schema validation and require a fresh scan |
| Stored envelope is malformed or from a future schema | Refuse it unchanged and unmarked; do not project, invalidate, or overwrite storage |

### 5. Good / Base / Bad Cases

- **Good**: a manual scan uses named read methods, projects provider JSON into strict schemas, clears each transient token in `finally`, commits every card independently, keeps repeated products distinct through an HMAC fingerprint, and restores only normalized observations after reload.
- **Base**: an optional catalog read fails after valid tracker data. The reader records the redacted catalog issue, leaves enrollment fields unexposed, and commits the tracker observation as partial.
- **Bad**: a generic fetch helper accepts arbitrary paths, stores raw JSON for debugging, derives an ending from a full account number or token, defaults a missing amount to zero, or turns a catalog authentication failure into partial success.
- **Ownership good**: discovery emits validated top-level exact `BASIC` cards only; nested exact `SUPP` is an understood exclusion before token/identity/request work, even when its product text says ordinary Platinum; unknown relationships still degrade discovery fail closed.
- **Ownership bad**: flatten supplementary cards, filter by `Additional`/`Companion` display wording, or let a SUPP entry inherit the parent product and reach tracker/catalog requests.
- **Presentation good**: duplicate primary products remain distinct by ending; only active-filter row-bearing groups render; `Remaining` contains exact non-used labels without flattening them; and completeness/freshness, scan notes, issue reasons, timestamps, parser/confidence fields, and conflict diagnostics remain internal.
- **Presentation base**: an all-used card is absent under `Remaining`, while selecting `Used` renders that card's used rows. A catalog failure with no rows creates neither a card shell nor diagnostic copy. A valid V3 quarterly source range renders as `Jul–Sep 2026` rather than `QuarterYear`.
- **Presentation bad**: retain compact `0 remaining benefits` groups, render unresolved zero-row card shells, expose quality/data-note/timestamp/debug fields, replace benefit state with card quality, group duplicate products only by name, show raw `CalenderYear` despite a structured range, or relabel every Remaining row as not used.
- **Active-scan good**: scan start immediately replaces all terminal content with title, accessible minimal status, native indeterminate/determinate progress, and Cancel; positive discovery/card events advance real progress; zero-card discovery stays indeterminate; and only `finished` restores terminal results.
- **Active-scan bad**: leave old cards or filters behind, append committed cards as they arrive, expose Sync/details/footer controls mid-scan, mark progress complete before context verification, or treat a resolved `startScan()` promise as terminal authority.
- **Provider-text good**: `&#36;` in a provider title displays as `$` through a single numeric-reference decoder, an Amex terminal `<sup>‡</sup>` / `<sup>®</sup>` or either exact marker before ` Statement Credit` is omitted only from display, and the DOM receives the result through `textContent` while normalized storage retains the source title.
- **Provider-text bad**: provider text is assigned to `innerHTML`, decoded repeatedly, broadly stripped as markup, has arbitrary nonterminal markers removed, is rewritten in normalized storage, or is allowed to throw on a malformed/out-of-range reference.
- **Conflict-diagnostic good**: all current generic identity-conflict sites map to unique fixed branch categories and bounded deterministic candidate projections for internal tests, while normalized storage contains only `benefit_identity_conflict` and the panel exposes no category, candidate, reason, or diagnostic hook.
- **Conflict-diagnostic bad**: a detail appears in visible/accessibility DOM, includes an issuer/source ID, token, raw object, credential/session material, or generic passthrough; enters a normalized snapshot/scan summary/storage/log/network/artifact channel; survives reload; or is used to pick one contradictory observation automatically.
- **Selection good**: the same exact `usage` tracker response normalizes identically for recognized, unknown, and partner-branded BASIC product names. Tracker title owns local identity; catalog evidence can only enrich it. Exact `spend`/`access`/`loan` and the closed ignored titles disappear before conflicts can form.
- **Selection base**: a provider returns a valid Delta Stays usage tracker, a spend-qualified flight credit, and a catalog-only rideshare offer. The reader keeps only Delta Stays locally, regardless of product mapping; the card remains sync-ineligible unless an independent exact mapping exists.
- **Selection bad**: gate local rows on a finite card registry, add a partner-card alias to reuse another product's rules, admit all non-`spend` categories, create catalog-only rows, use a global merchant substring, or infer destination identity from amount/product resemblance.
- **Compatible-store good**: missing primary-only or V3-selection markers invalidate unreconstructable legacy evidence, clear legacy/current mailbox state, preserve the identity secret, write markers last, and make the second load a no-op. Sync projection independently requires exact current V3/parser and exact reviewed product/title mapping.

### 6. Tests Required

For each browser-side provider reader, assert:

- every named operation emits the exact origin/path/method/headers/body/credentials/redirect tuple;
- an unapproved destination, method, body, redirect, or mutation path is unreachable by construction;
- retry occurs once only for network failures and `5xx`, and never for the other matrix rows;
- `application/json` with optional parameters is accepted while `application/jsonp`, HTML, and missing content type are rejected;
- bounded schemas strip unrelated fields and reject object-valued scalar candidates;
- four- and five-digit explicit endings are accepted, while conflicts and full numbers are rejected without truncation;
- only validated top-level exact `BASIC` accounts are emitted; nested exact `SUPP` entries—including explicit Additional/Companion names and inherited-parent supported product text—cause no identity/card-specific request/count/storage work and no unknown issue, while missing/conflicting/uncharacterized relationships remain fail-closed unknown variants;
- duplicate primary product names remain distinct and duplicate primary tokens do not create duplicate cards;
- missing or unknown quantities, statuses, categories, and layouts remain explicit and never become inferred values;
- optional enrichment failure after tracker success produces a partial observation, while authentication, cancellation, and tracker failure remain hard/interrupted paths;
- raw responses and tokens never enter panel state, normalized output, diagnostics, storage, or exported errors and are cleared on every terminal path;
- per-card success replaces the latest observation, failure preserves stale prior data, and summary counts match attempted dispositions;
- exact-origin page load restores local normalized state without scanning, primary paths start expanded, and non-primary paths expose an accessible collapsed launcher whose expansion/collapse does not scan or persist UI state; clear-data removes both normalized state and the installation identity secret;
- visible context is reported as unchanged, changed, or unavailable without persisting its source display value; selector-present capture requires stable display equality, while selector-free capture permits unchanged route-only verification;
- scan start and cancelling render only the title, minimal live status, native progress, and Cancel; stale and incrementally committed cards, filters, summaries, Sync, privacy/footer/details controls, quality/data-note/timestamp/debug copy, and semantic diagnostic hooks are absent until `finished`; progress is indeterminate before positive discovery and for zero eligible cards, determinate/clamped from real card index/count events afterward, remains isolated through context verification, and is not terminated by a resolved action promise;
- all six truthful benefit labels follow the required precedence, `Remaining`/`Used` state and membership are accessible, only groups with rows in the active filter render, all-used cards move from absent under Remaining to row-bearing under Used, unresolved/stale/older-retained zero-benefit records create no card shells or diagnostic copy, duplicate primary products remain distinct by ending digits, and observation quality/timestamps remain internal;
- observed V3 structured periods format deterministically for full-year, full-month, same-year multi-month, irregular, and cross-year ranges; valid structured ranges suppress raw provider duration tokens, while legacy/unavailable-structured-period rows retain the bounded raw fallback;
- decimal comparisons avoid floating point and cover equal/above/below/zero behavior; compatible zero overrides generic in-progress as `Not used`; explicit completion remains `Used` despite conflicting zero/in-progress evidence; generic in-progress without compatible zero remains `Partially used`; missing, incompatible, and matching-`unknown` quantities infer no state from quantity comparison; incompatible/unknown pairs show no combined amount; and malformed quantities remain rejected by the normalized schema;
- valid semicolon-terminated decimal/hex numeric character references decode exactly once into inert title text; named, malformed, null, surrogate, and out-of-range inputs remain literal; double-encoded input decodes only its outer layer; literal/numeric-derived terminal Amex `<sup>‡</sup>` / `<sup>®</sup>`, standalone `‡`, and either exact superscript marker before ` Statement Credit` are removed only for display; spacing normalizes to one separator before `Statement Credit` when a prefix remains; arbitrary nonterminal markers, whitespace variants, broader suffixes, multiple markers, other tags/symbols, and unrelated markup-like text remain visible and inert; empty-result fallback is safe; and normalized storage retains the original title;
- every active `benefit_identity_conflict` production site maps to its stable fixed category using invented fixtures; structured detail has an exact closed destination-key-free shape, fixed source roles, parsed candidate fields and safe relations, candidate/detail caps and truncation, deterministic ordering and scan-local keys under relevant reversal, and correct card scoping; generic card-versus-row issue locality and partial disposition remain unchanged; neither categories nor details contain source IDs/secret-like fields or serialize into normalized observations, scan summaries, GM storage, console, network, artifacts, visible/accessibility DOM, or semantic panel hooks;
- a synthetic high-scale fixture keeps every eligible row reachable through its truthful filter while rendering only row-bearing card groups; mixed internal coverage containing confirmed-empty, unresolved zero-benefit, benefit-bearing, and older-retained records produces no empty shells, quality counts, data notes, timestamps, or false empty claims; terminal all-empty/partial cases use only non-diagnostic filter/result copy;
- product-independent fixtures prove the same usage trackers normalize under recognized, partner-branded, and unknown BASIC product names; Morgan-like coverage includes CLEAR+ and Equinox, truthful empty Hilton creates no shell, and Delta Business retains only Delta Stays while spend Flight Credit and catalog-only Rideshare remain absent;
- every exact `spend`, `access`, `loan`, missing, or unrecognized tracker category plus `35% Airline Bonus` and `Link Your Resy Profile` is omitted before interpretation/conflict creation and creates no normalized row, issue, panel row, or sync row; order reversal does not change output, while materially different duplicate usage trackers stay partial/fail-closed;
- equivalent usage observations deduplicate through deterministic local benefit identity, while materially different observations do not merge or depend on provider response order;
- missing primary-only or V3-selection compatibility invalidates unreconstructable V1/V2 cards/lastScan and both mailbox keys while preserving identity secret, writes fixed markers last, increments only on state change, handles concurrent loads without stale return, retries after partial persistence failure, clears all markers with local data, and refuses malformed/future stores unchanged/unmarked; sync schema/projection additionally requires exact current V3/parser/current/latest/complete/successful gates and exact source mapping;
- the built userscript contains only approved grants and destinations and contains no mutation fragments, privileged transport, background polling, remote update metadata, or website-sync destination.

Run targeted Jest for the reader and userscript surfaces, strict TypeScript, targeted ESLint, the isolated userscript build, artifact/source allowlist audits, a sensitive-data scan, structured-data parsing, and `git diff --check`. Authenticated browser validation requires explicit owner authorization and must capture only sanitized aggregates and URL/method/status metadata—never payloads.

### 7. Wrong vs Correct

#### Wrong

```ts
async function providerRequest(url: string, token: string) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ accountToken: token }),
  });
  const raw = await response.json();
  localStorage.setItem("provider-debug", JSON.stringify(raw));
  return raw;
}
```

This creates an unrestricted destination, retains a provider token in a generic request path, accepts unvalidated JSON, and persists a raw private response.

#### Correct

```ts
async function readBenefitCatalog(
  rawAccountToken: string,
  signal: AbortSignal,
): Promise<CatalogResponse> {
  const response = await fetch(CATALOG_READ_URL, {
    method: CATALOG_READ_ENDPOINT.method,
    credentials: "include",
    redirect: "manual",
    headers: CATALOG_READ_ENDPOINT.headers,
    body: JSON.stringify(buildCatalogRequest(rawAccountToken)),
    signal,
  });

  assertApprovedStatusRedirectAndJson(response);
  return catalogResponseSchema.parse(await response.json());
}

let catalog: CatalogResponse | null = null;
try {
  catalog = await client.readBenefitCatalog(rawAccountToken, signal);
  return normalizeBenefits(trackers, catalog);
} finally {
  catalog = null;
  rawAccountToken = "";
}
```

The named operation fixes the request tuple, validates the projected response, and makes transient cleanup part of the control flow. The scan engine—not the transport—owns whether an eligible optional-read failure becomes a redacted partial observation.

#### Primary-card ownership boundary

```ts
// Wrong: flatten nested supplementary entries, or decide ownership from
// mutable display product wording after card-specific reads already occurred.
for (const supplementary of account.supplementary_accounts ?? []) {
  cards.push(parseCard(supplementary, account.product));
}

// Correct: relationship plus structural placement decides scope before token,
// identity, product inheritance, tracker, or catalog work.
if (resolvedTopLevelRelationship(account) === "BASIC") {
  addCard(parseValidatedPrimary(account));
}
for (const supplementary of account.supplementary_accounts ?? []) {
  if (resolvedNestedRelationship(supplementary) === "SUPP") continue;
  unknownVariantCount += 1;
}
```

A known nested `SUPP` is deliberately out of scope, while an unknown relationship remains fail closed. Product names are never a substitute for ownership metadata.

#### Presentation boundary

```ts
// Wrong: parser quality overwrites benefit state, diagnostics enter the panel,
// and the card shell remains even when no row matches.
const label = card.completeness === "partial"
  ? "Incomplete"
  : activeFilter === "remaining"
    ? "Not used"
    : benefit.trackerState;
renderDataNotes(card.issueCodes, card.observedAt);
renderCardGroup(card, card.benefits.filter(matchesActiveFilter));

// Correct: keep quality metadata internal. Filter membership controls both row
// and group presence; terminal UI renders only truthful benefit information.
const visibleBenefits = card.benefits.filter(
  (benefit) => deriveBenefitUsageState(benefit).filter === activeFilter,
);
if (visibleBenefits.length > 0) renderCardGroup(card, visibleBenefits);
```

```ts
// Wrong: keep terminal results mounted and restore them when the action promise
// resolves, even if the engine has not emitted its terminal event.
renderStoredCards();
await actions.startScan();
mode = "idle";

// Correct: active scan/cancel modes render one isolated progress workspace.
if (mode === "scanning" || mode === "cancelling") {
  renderProgressWorkspace({ status, cardIndex, cardCount, cancel });
  return;
}
// Only report({ type: "finished", summary }) restores terminal result UI.
```

This boundary prevents internal data-collection uncertainty and timestamps from becoming product UI, prevents partial/stale cards from leaking mid-scan, and prevents diagnostic-only or zero-count card shells from occupying the active benefit list.


#### Provider-text boundary

```ts
// Wrong: provider-controlled title text becomes an HTML parsing sink.
row.innerHTML = decodeProviderText(benefit.title);

// Correct: decode one pass, remove only the exact reviewed Amex terminal
// or Statement Credit footnote shape, then render without changing storage.
row.textContent = formatAmexBenefitTitle(benefit.title);
```

Single-pass numeric decoding plus narrow terminal-adornment cleanup fixes provider-visible labels without turning a presentation compatibility rule into markup execution, broad tag stripping, or a normalized-storage migration.

#### Local observation versus synchronization authority

```ts
// Wrong: a finite destination-card registry decides whether provider facts may
// exist locally, so partner-branded and unknown products silently become empty.
const match = matchSupportedCardCredit(productName, tracker.benefitName);
if (!match) return null;
return normalizeTracker(tracker, match.productKey, match.creditFamilyKey);

// Correct: exact usage trackers are local provider facts for every BASIC card.
if (normalizeCategory(tracker.category) !== "usage") return null;
if (!isEligibleLocalAmexUsageTitle(tracker.benefitName)) return null;
return normalizeV3Tracker(tracker); // no destination keys
```

Product display wording is not local credit authority. Catalog records may enrich an existing row through a transient unambiguous join, but cannot replace the tracker title or create a catalog-only observation.

```ts
// Wrong: infer destination identity from local presence or a merchant substring.
const family = title.toLowerCase().includes("resy")
  ? "american-express-platinum-card:resy"
  : null;

// Correct: destination authority appears only at sync projection through one
// closed exact-normalized product/title mapping, then the server reauthorizes it.
const mapping = matchAmexBrowserSyncCredit(
  observation.productName,
  benefit.title,
);
if (!mapping) return null;
return projectSyncRow(benefit, mapping);
```

Local-only rows remain visible but produce no envelope row. Browser mapping and server write authority are separate closed checks; neither uses fuzzy matching, amounts, cadence, endings, or product resemblance.

## Historical scenario: envelope-V2 reviewed handoff and confirmed AMEX synchronization

> **Superseded:** This section records the original Platinum-only `amex-sync-envelope/2` contract. The current production userscript `0.5.3`, envelope V3, global-definition catalog authority, exact-last-five matching, status reconciliation, and grouped persistence live in [AMEX Sync Reconciliation](amex-sync-reconciliation.md); global catalog and legacy transition contracts live in [Global Benefit Definitions and Migration](global-benefit-definitions-and-migration.md). Preserve the reusable privacy, authentication, proposal, provenance, idempotency, and audit principles below, but do not reintroduce V2 manual mappings, its narrow allowlist, or per-user destination-key authority.

### 1. Scope / Trigger

Use this historical contract to understand the original boundary through which locally reviewed provider observations crossed from a browser-session reader into an authenticated first-party preview and confirmed write.

The initial writable policy is deliberately finite: product `american-express-platinum-card`, credit families `american-express-platinum-card:lululemon` and `american-express-platinum-card:resy`, a valid current structured UTC source range, and exactly one existing destination cycle/occurrence. Every broader or locally unmapped product/family, legacy V1/V2 record, invalid period, stale/partial/failed observation, duplicate-family projection, or ambiguous mapping remains review-only. Raw provider responses, browser-session material, source fingerprints, and installation secrets never cross the handoff.

### 2. Signatures

The public browser and server boundaries are:

```ts
type AmexSyncMode = "off" | "preview" | "write";

interface AmexSyncConfiguration {
  mode: AmexSyncMode;
  hmacKey: string | null;
}

interface AmexSyncEnvelope {
  envelopeVersion: "amex-sync-envelope/2";
  observationContractVersion: "amex-benefits/3";
  scanId: string;
  scanFinishedAt: string;
  cards: AmexSyncCard[];
  exclusions: Array<{ reason: SyncExclusionReason; count: number }>;
}

interface AmexSyncMailbox {
  mailboxVersion: "amex-sync-mailbox/2";
  transferId: string; // 32 lowercase hexadecimal characters
  nonce: string; // 32 lowercase hexadecimal characters
  createdAt: string;
  expiresAt: string;
  digest: string; // 64-character SHA-256 hexadecimal digest
  envelope: AmexSyncEnvelope;
}

type HandoffMessage =
  | { type: "perks-reminder:amex-sync-ready"; transferId: string }
  | {
      type: "perks-reminder:amex-sync-payload";
      transferId: string;
      nonce: string;
      digest: string;
      envelope: AmexSyncEnvelope;
    }
  | {
      type: "perks-reminder:amex-sync-accepted";
      transferId: string;
      nonce: string;
    };

interface SyncStatusProjection {
  usedAmount: number;
  isCompleted: boolean;
  completedAt: string | null;
  isNotUsable: boolean;
}

interface SyncResponseRowBase {
  sourceRowIdentity: string; // 64 lowercase hexadecimal characters
  sourceLocalCardId: string; // UUID
  productKey: AmexProductKey;
  creditFamilyKey: CreditFamilyKey;
  destinationCardId: string | null;
  before: SyncStatusProjection | null;
  after: SyncStatusProjection | null;
  changes: {
    amountDecrease: boolean;
    amountIncrease: boolean;
    completionSet: boolean;
    completionCleared: boolean;
  };
}

type PreviewSyncRow = SyncResponseRowBase & (
  | { disposition: "proposed"; reason: "proposed_update" }
  | {
      disposition: "unchanged";
      reason: "already_current" | "unchanged_replay";
    }
  | { disposition: "skipped"; reason: NonAppliedAmexSyncReason }
);

type ConfirmationSyncRow = SyncResponseRowBase & (
  | { disposition: "updated"; reason: "proposed_update" }
  | {
      disposition: "unchanged";
      reason: "already_current" | "unchanged_replay";
    }
  | { disposition: "skipped"; reason: NonAppliedAmexSyncReason }
  | {
      disposition: "failed";
      reason: "conflict_repreview_required" | "persistence_failed";
    }
);

interface PreviewResponse {
  mode: "preview" | "write";
  rows: PreviewSyncRow[]; // at most AMEX_SYNC_MAX_ROWS
  proposalToken: string; // 1..16,384 characters
  proposalExpiresAt: string;
  mappingOptions: Array<{
    id: string; // 1..128 characters
    productKey: AmexProductKey;
    label: string; // 1..200 characters
  }>;
}

interface ConfirmationResponse {
  attemptId: string; // 1..128 characters
  replayed: boolean;
  rows: ConfirmationSyncRow[]; // at most AMEX_SYNC_MAX_ROWS
  updatedCount: number; // integer equal to rows with disposition "updated"
}

function previewAmexSync(input: {
  userId: string;
  envelope: AmexSyncEnvelope;
  manualMappings: ManualCardSelection[];
  mode: "preview" | "write";
  hmacKey: string;
  now?: Date;
}): Promise<PreviewResponse>;

function confirmAmexSync(input: {
  userId: string;
  envelope: AmexSyncEnvelope;
  manualMappings: ManualCardSelection[];
  proposalToken: string;
  hmacKey: string;
  now?: Date;
}): Promise<ConfirmationResponse>;
```

The first-party API consists only of `POST /api/integrations/amex-sync/preview` and `POST /api/integrations/amex-sync/confirm`. Server-only `AMEX_SYNC_MODE` and `AMEX_SYNC_HMAC_KEY` select capability; the key must be at least 32 characters, and missing, invalid, or incomplete configuration resolves to `off`. Durable uniqueness is `(userId, source, sourceLocalCardId)` for mappings, `(userId, idempotencyKey)` for attempts, `(benefitStatusId, source)` for latest provenance, and `(attemptId, sourceRowIdentity)` for row audits.

### 3. Contracts

1. **Current-parser V3-only, exact candidate projection**: transfer only strict `amex-sync-envelope/2` rows projected from the latest completed `amex-benefits/3` scan whose card observation is current, complete, successfully attempted, and stamped with the exact current `PARSER_VERSION`. Local V3 contains no destination keys; projection introduces them only through the closed exact-normalized browser product/title mapping. Unmapped local rows and cards stay review-only. Multiple materially distinct rows mapping to one destination family exclude the whole source card. The scan must remain within 30 minutes at confirmation. The independent server allowlist reauthorizes every projected product/family; a display title or browser map alone is never write authority.
2. **One private mailbox**: a direct global Sync gesture creates at most one bounded `amex-sync-mailbox/2` value under the fixed GM key. Its ten-minute lifetime may not exceed the source scan deadline. The top-level handoff URL contains only the opaque transfer ID. No payload, nonce, digest, proposal, card ending, title, or amount belongs in a URL, page storage, DOM attribute, clipboard, or wildcard message.
3. **Acknowledge server acceptance, not local acquisition**: the handoff validates exact origin/source/type/transfer/nonce, schema, digest, size, creation time, expiry, and scan deadline; safely acquires the envelope into memory; strips the locator with `history.replaceState`; calls preview; validates the complete typed preview response; and only then sends `perks-reminder:amex-sync-accepted`. `off`, HTTP failure, malformed response, unmount, or client exception sends no acceptance. The userscript deletes the mailbox only after the exact accepted message or terminal cancellation, clear, expiry, malformed content, replay, or timeout.
4. **Early branch isolation**: the userscript entry rejects frames and selects the exact first-party handoff branch before dynamically importing provider client, scan engine, panel, or reader runtime. The handoff branch receives mailbox read/delete capability only and must not construct provider transport. Every unrelated origin/path returns without side effects.
5. **Authenticated read-only preview and confirmed write**: both routes authenticate first, derive `userId` only from the server session, require exact first-party Origin and same-origin Fetch Metadata, accept strict bounded JSON only, and emit no CORS response. Preview performs no Prisma create/update/upsert/delete/transaction, mapping save, attempt/audit/provenance write, status materialization, or revalidation. Confirmation re-authenticates and requires `write` mode plus a valid short-lived HMAC proposal bound to purpose, user, effective mode, envelope digest, manual mappings, ordered row identities, before state, transition time, and expiry. The client strictly validates every successful response as a closed complete DTO, including nested status/change objects and disposition/reason compatibility: preview permits only proposed/unchanged/skipped rows, confirmation permits only updated/unchanged/skipped/failed rows, and `updatedCount` must equal the final updated-row count. Mapping options are limited to active user-owned cards whose finite product key is represented in the source envelope, sorted deterministically, capped at `AMEX_SYNC_MAX_ROWS`, and labeled with at most 200 characters while preserving ending digits.
6. **Exact transaction-time authority**: preview-time planning and HMAC binding are necessary but insufficient. Each applied or newer-already-current row runs in a serializable transaction that revalidates user ownership, active card lifecycle, exact non-null product/family/period keys, destination card/benefit/status IDs, cycle start/end, occurrence, before-state values, and current source provenance. Applied rows use a scoped compare-and-set; a count other than one is `conflict_repreview_required`. Confirmed manual mappings independently re-read ownership, lifecycle, and product compatibility inside their transaction.
7. **Advance provenance for newer no-op observations**: `unchanged_replay` means equal source time and digest and advances nothing. `already_current` means a newer accepted source derives destination values already present; it performs no status update but transactionally advances `BenefitStatusSourceProvenance` and records an `UNCHANGED` audit. Both already-current and applied paths reject an older observation or an equal-time conflicting digest inside the transaction so provenance cannot move backward.
8. **Resumable attempts and monotonic audits**: `COMPLETED` attempts replay stored results. `PROCESSING` and `PARTIAL_FAILED` attempts resume the same attempt ID. Existing `UPDATED`, `UNCHANGED`, or `SKIPPED` audits are terminal and are replayed; `FAILED` may retry and promote to any successful terminal disposition, including audit-only skipped or unchanged rows. A concurrent failure must never downgrade a successful result. One row failure does not stop unrelated rows, and final attempt counts/state come from durable row results.
9. **Private-route telemetry boundary**: before the exact handoff path can expose a locator, suppress Google Analytics, Vercel Analytics, search analytics, service-worker interception, automatic/custom error reporting, and source-data console serialization. Return private/no-store, no-referrer, no-index, and non-frameable policy. Client and server monitoring retain origin/pathname only, independently suppress the exact handoff, strictly validate other reports, and preserve ordinary telemetry on lookalike paths.
10. **Schema-dependent rollout gate**: keep synchronization operationally `off` until the additive migration exists, its SQL has been reviewed, the generated Prisma client has been validated, and the target migration status is verified under the separately authorized database workflow. Client generation does not create database objects, and a build or swallowed migration failure is not deployment evidence. See [Database and Data Safety](database-and-data-safety.md).

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Valid mailbox payload while server mode is `off` | Strip the locator only after safe acquisition; do not preview, acknowledge, confirm, or write; preserve the mailbox until terminal cleanup |
| Preview returns non-2xx or a malformed response | Do not acknowledge; show a generic local failure; expose no confirm state |
| Typed preview response succeeds | Acknowledge exactly once with the matching transfer ID and nonce; the bridge deletes only that mailbox |
| Successful preview/confirmation response has missing or unknown fields, oversized arrays/strings, an impossible disposition/reason pair, or an incomplete nested state/change object | Reject the response locally; do not acknowledge a preview, enable confirmation, or report confirmation success |
| Confirmation `updatedCount` differs from the number of `updated` rows | Reject the complete response and show no success state |
| Mapping options include an inactive/unowned card, a product absent from the source envelope, duplicate/unsorted overflow, or a label over 200 characters | The server omits, sorts/caps, or bounds the option before response validation; the client rejects any nonconforming DTO |
| Message origin/source/type/transfer/nonce is wrong | Ignore it; do not preview, acknowledge, or clear another mailbox |
| Source is older than latest provenance | Return `stale_replay`; change no status, provenance, or success audit |
| Source time and digest equal latest provenance | Return `unchanged_replay`; do not advance provenance |
| Source time equals latest provenance but digest differs | Return `source_conflict`; perform no write |
| Newer source derives values already current | Leave status unchanged; advance provenance and write `UNCHANGED` atomically |
| Card, benefit, key, cycle, occurrence, before state, or provenance changed since preview | Return `conflict_repreview_required`; write no success audit or provenance |
| Scoped status compare-and-set affects zero rows | Return `conflict_repreview_required`; do not upsert provenance or a successful audit |
| Existing successful row audit is retried | Replay it; never execute or downgrade the row |
| Existing `FAILED` audit retries successfully | Promote it to `UPDATED`, `UNCHANGED`, or `SKIPPED` as derived |
| One independent row fails | Continue other rows and leave the attempt `PARTIAL_FAILED` until all durable results are terminal successes |
| Exact handoff path is requested | Emit no analytics/automatic monitoring, service-worker interception, query/referrer retention, indexing, or framing authority |
| Schema changed but migration/client/target verification is absent | Keep mode `off`; report deployment blocked rather than claiming rollout success |

### 5. Good / Base / Bad Cases

- **Good**: a newer complete Resy observation derives the same values already stored. Confirmation rechecks exact ownership, card, benefit, current cycle, before state, and provenance in one serializable transaction, performs no status update, advances provenance, and records `UNCHANGED`.
- **Good response boundary**: the server returns deterministically sorted, bounded mapping options plus complete phase-specific rows; the client accepts the closed DTO, verifies the confirmation count invariant, and only then advances UI/mailbox state.
- **Base**: one row updates while another row's audit write fails. The first remains durable, the attempt becomes `PARTIAL_FAILED`, and the same idempotency key later retries only the failed row and may promote its audit.
- **Bad response boundary**: a 2xx response with a partial row, unknown field, preview-only `updated` disposition, invalid reason pair, oversized mapping options, or inconsistent `updatedCount` is cast and rendered without full validation.
- **Bad**: delete the mailbox immediately after receiving its payload, before a typed server preview accepts it.
- **Bad**: trust preview-time mapping, update a status by ID alone, or upsert provenance without transaction-local ordering and compare-and-set authority.
- **Bad**: statically import provider transport before selecting the exact userscript branch, or enable synchronization because `prisma generate` passed without a reviewed migration.

### 6. Tests Required

For every reviewed browser-to-first-party synchronization:

- assert no acknowledgement in `off`, after preview HTTP failure, or after a malformed preview body; assert exactly one matching acknowledgement only after typed preview success and mailbox deletion only after acceptance or terminal cleanup;
- assert successful preview/confirmation responses reject missing and unknown fields, incomplete nested state/change objects, oversized arrays/strings, impossible phase dispositions, invalid disposition/reason combinations, and inconsistent `updatedCount`; assert mapping options are active, owned, limited to source-envelope product keys, deterministically sorted, capped, and labeled within 200 characters;
- assert exact userscript provider/handoff scopes, the three storage grants plus reviewed page-realm `unsafeWindow`, `@noframes`, top-frame checks, no provider runtime on the handoff, and no side effects on unrelated origins/paths;
- assert V1/V2 remain review-only, non-current envelope/mailbox/parser versions fail closed, current-parser V3 selection is latest/current/complete/fresh/successful, local observations contain no destination keys, browser product/title mapping is exact, duplicate destination families exclude the card, server product/family authority is independently exact, and structured source ranges resolve exactly one current cycle/occurrence;
- assert older, equal-identical, equal-conflicting, newer-applied, and newer-already-current provenance ordering;
- assert transaction-local ownership/card/benefit/cycle/before-state/provenance revalidation, a scoped status compare-and-set, and atomic status/provenance/audit persistence;
- assert completed replay; processing/partial resume; `FAILED` promotion to updated, unchanged, and skipped; no successful-audit downgrade; row-failure isolation; and aggregate counts from durable results;
- assert exact-path analytics/error/service-worker suppression, pathname-only monitoring, strict monitoring input, private headers, and unchanged policy on lookalike routes;
- assert schema changes have separately reviewed migration SQL and generated-client/target verification before mode enablement; missing or skipped evidence keeps rollout blocked;
- run targeted unit/route/component tests, strict TypeScript, targeted ESLint, the isolated userscript build and metadata/authority audits, deny-by-default synthetic browser tests, structured parsing, sensitive-data scans, and `git diff --check`. Live scans, real previews/writes, migration generation/deployment, client generation, cron invocation, and production builds remain separate operational authorizations.

### 7. Wrong vs Correct

#### Mailbox acknowledgement

```ts
// Wrong: local receipt is mistaken for server acceptance.
setEnvelope(payload.envelope);
postAccepted(payload);
await runPreview(payload.envelope, []);

// Correct: only a valid preview response consumes the one-time mailbox.
setEnvelope(payload.envelope);
const accepted = await runPreview(payload.envelope, []);
if (accepted) postAccepted(payload);
```

#### Successful response validation

```ts
// Wrong: a 2xx and top-level array are treated as a trustworthy result.
const preview = await response.json() as PreviewResponse;
setPreview(preview);
postAccepted(payload);

// Correct: the complete closed, bounded, phase-specific DTO must validate.
const preview = previewResponseSchema.safeParse(await response.json());
if (!preview.success) return showGenericPreviewFailure();
setPreview(preview.data);
postAccepted(payload);
```

#### Durable row application

```ts
// Wrong: preview-time resolution is trusted and provenance can move backward.
await tx.benefitStatus.update({ where: { id: row.destinationStatusId }, data: row.after });
await tx.benefitStatusSourceProvenance.upsert(provenanceArgs);

// Correct: re-resolve exact authority and provenance, then compare-and-set.
const current = await loadAuthorizedDestinationStatus(tx, userId, row);
assertExactCardBenefitCycleAndBeforeState(current, row);
await assertAmexProvenanceCanAdvance(tx, row);
const result = await tx.benefitStatus.updateMany({ where: exactBeforeState(row), data: row.after });
if (result.count !== 1) throw new Error("conflict_repreview_required");
await tx.benefitStatusSourceProvenance.upsert(provenanceArgs);
await writeOrPromoteSuccessfulAudit(tx, row);
```

The explicit acceptance event preserves local recovery until the first-party server accepts the bounded envelope. Transaction-local authority and monotonic provenance prevent a valid preview or newer no-op observation from becoming authorization for a later stale write.

## Scenario: generated-bundle synthetic browser validation

### 1. Scope / Trigger

Use this contract when routine browser-reader iteration needs real-Chromium evidence without installing the userscript, opening an authenticated profile, or contacting the provider. This supplements unit tests and milestone owner-only validation; it does not claim live provider, cookie/CORS, or Tampermonkey-sandbox compatibility.

### 2. Signatures

The Amex reference commands and harness boundary are:

```bash
npx playwright install chromium      # one-time browser prerequisite
npm run test:e2e:amex                # unattended generated-bundle checks
npm run test:e2e:amex:visual         # optional headed synthetic preview
```

```ts
type HarnessScenario =
  | "complete"
  | "benefit_empty"
  | "all_benefit_empty"
  | "conflict_diagnostics"
  | "catalog_failure"
  | "cancellation"
  | "rescan_tracker_failure"
  | "high_scale";

class SyntheticAmexHarness {
  readonly storage: Map<string, unknown>;
  installBeforeNavigation(): Promise<void>;
  openAndInject(): Promise<void>;
  reloadAndInject(): Promise<void>;
  proveUnexpectedNetworkIsBlocked(): Promise<void>;
  assertNetworkStayedSynthetic(): void;
}
```

The task-scoped Playwright config must point only at the provider-reader E2E directory, use one worker with retries disabled, block service workers, and retain traces/screenshots only for failed or explicit visual runs.

### 3. Contracts

1. **Build and inject the artifact**: the command rebuilds the userscript, verifies the artifact exists, and injects that opaque IIFE. E2E code must not import the production entry, engine, adapter, matcher, or panel to bypass bundle wiring.
2. **Intercept before navigation**: install a browser-context catch-all route before the first navigation. Fulfill only the invented provider document, exact named read tuples, and exact browser-generated preflights required by those tuples.
3. **No network fallback**: every unrecognized origin, path, method, header set, or body is aborted and recorded as a routing error. The route must never call `continue`, `fallback`, or another path that can reach live Amex or a third party. Include a denied-origin probe proving this behavior.
4. **Synthetic extension storage**: install asynchronous `GM.getValue`, `GM.setValue`, and `GM.deleteValue` mocks before bundle evaluation. Keep the map owned by the harness so tests can inspect normalized persistence, while production receives no debug/export interface.
5. **Exact request and mount evidence**: assert operation origin, path, method, accepted content type, fixed request body, retry count, and zero provider reads before manual start or after restore-only reload. For an exact-origin reader with primary-route presentation, include a harness-owned non-primary document with no selected-card selector and prove collapsed mount, expansion without reads, manual scan, and route-only invariance through the generated bundle.
6. **Alternate transport denial**: disable or fail on `XMLHttpRequest`, WebSocket, EventSource, `sendBeacon`, popups, unexpected main-frame navigation, service workers, uncaught page errors, unexpected console errors, failed requests, and unexpected dialogs.
7. **Synthetic-only output**: fixtures, screenshots, traces, and test reports contain invented identifiers/amounts plus public catalog vocabulary only. Generated outputs remain ignored by Git and must never contain live browser/session data.
8. **Milestone boundary**: live private response shape, authenticated cookie/CORS behavior, Tampermonkey grants/sandbox behavior, and issuer-side no-mutation evidence still require separately authorized owner-only validation.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Built artifact is absent or cannot execute | Fail before asserting UI behavior; do not fall back to source imports |
| Initial synthetic document request matches exactly | Fulfill invented HTML at the approved provider route |
| Named member/tracker/catalog request matches its complete tuple | Fulfill the scenario fixture and record only sanitized method/origin/path metadata |
| Browser emits a preflight for an approved POST | Fulfill only when origin, requested method, requested headers, and path match exactly |
| Origin/path/method/body/header is unknown or malformed | Abort, record a sanitized routing error, and fail the test; never contact the network |
| Deliberate denied-origin probe runs | Observe a locally aborted request and no external response |
| Before the manual scan button is pressed | Zero member, tracker, and catalog operations |
| Page reload restores local state | Reinject the built artifact, preserve GM state, and perform zero new provider reads |
| Page error, unexpected console error, dialog, popup, navigation, failed request, WebSocket, or service worker occurs | Record and fail unless the exact event is an explicitly asserted scenario outcome |
| Serialized synthetic storage contains fixture token/upstream ID, an unsupported benefit, or an ephemeral conflict category/detail field | Fail the test |
| Visual preview passes | Write only an ignored synthetic screenshot and exit normally |
| Live provider/Tampermonkey behavior is needed | Stop at the harness boundary and use a separately authorized milestone validation |

### 5. Good / Base / Bad Cases

- **Good**: routing is installed before navigation, the rebuilt IIFE runs with preinstalled async GM mocks, exact synthetic operations complete after a click, reload restores without scanning, and a denied-origin probe is locally aborted.
- **Base**: the synthetic catalog operation returns one retryable `500`; the exact retry occurs once, tracker data remains partial/current, and no unrelated console or network event is accepted.
- **Bad**: navigate first and add routes later, use `route.continue()` for unknown requests, import source modules instead of the artifact, accept every console/dialog failure, or use a real browser profile to make routine tests pass.

### 6. Tests Required

For each generated-bundle provider harness, assert:

- test discovery is scoped and the unit-test runner excludes browser E2E files;
- the default command rebuilds the artifact and completes unattended with deterministic one-worker/no-retry isolation;
- no named provider operation occurs before the explicit scan action, including after expansion from an off-primary-route launcher;
- exact complete-flow operation counts for multiple top-level BASIC cards, zero identity/tracker/catalog work for an invented nested SUPP card, account-wide duplicate primary-card grouping, supported/non-credit filtering, filter-aware `Remaining`/`Used` switching without provider reads, and visible route/display invariance;
- a selector-free non-primary exact-origin document mounts collapsed, expands without reads, completes a manual scan with route-only context verification, and remains on the same pathname;
- normalized GM storage excludes raw fixture tokens and upstream identifiers, survives reload without autoscan, and clear-data removes store, identity, mailbox, and primary-only compatibility keys; a seeded unmarked role-unverified snapshot/mailbox invalidates once on restore with zero provider reads while preserving identity secret and a second restore is idempotent;
- deterministic partial/failure paths exercise the built artifact and exact retry/error behavior; unresolved/stale zero-benefit records produce neither card groups nor aggregate quality/debug copy, and all-used groups move from absent under Remaining to visible with rows under Used;
- the generated bundle replaces all prior terminal content with the isolated scan workspace immediately after manual start, advances accessible determinate progress only from positive discovery/card events, keeps zero-card progress indeterminate, exposes no incremental committed result, and restores terminal results only after `finished`;
- an invented conflict-diagnostics scenario exercises every fixed category through the built artifact while proving the panel exposes no category, candidate detail, or semantic diagnostic hook and storage contains only the generic issue/partial observation;
- a route gate proves cancellation keeps the same isolated workspace, aborts a later physical-card read only after an earlier card is committed, starts no later work, and records the engine's interrupted attempt/disposition counts;
- a successful scan followed by a failed rescan proves a successful card advances with changed data while the failed card preserves its entire prior observation as stale after exactly one retry;
- expected cancellation failures are matched to the exact gated browser request rather than accepted by URL or scenario alone;
- an unapproved-origin probe is aborted by the catch-all, and every routing/runtime error collection is empty at scenario end;
- alternate transports, popups, navigations, service workers, page errors, console errors, failed requests, and dialogs cannot pass silently;
- the visual command is optional, bounded, synthetic-only, and writes to an ignored location;
- the production artifact remains free of harness bindings, privileged transport, expanded grants/destinations, mutation fragments, and debug storage APIs.

Run this browser suite alongside targeted Jest, strict TypeScript, targeted ESLint, the isolated userscript build and artifact audit, sensitive-data scanning, structured-config validation, and `git diff --check`. Run authenticated provider/Tampermonkey validation only when an applicable exact-action authorization or recorded durable unchanged-scope read-only authorization covers it.

### 7. Wrong vs Correct

```ts
// Wrong: an unmatched request can escape to the live network.
await page.goto(providerUrl);
await context.route("**/*", async (route) => {
  if (isKnown(route.request())) await route.fulfill(syntheticResponse);
  else await route.continue();
});

// Correct: interception exists before navigation and unknown traffic is denied.
await context.route("**/*", async (route) => {
  if (isExactSyntheticDocument(route)) return route.fulfill(syntheticDocument);
  if (isExactNamedRead(route)) return route.fulfill(syntheticResponse);
  recordSanitizedRoutingError(route);
  return route.abort("blockedbyclient");
});
await page.goto(syntheticProviderUrl);
await page.addScriptTag({ path: builtUserscriptPath });
```

The browser URL may resemble the approved provider route so the real entry guard executes, but every byte must come from the preinstalled synthetic router.

## Scenario: authorized Tampermonkey update automation

### 1. Scope / Trigger

Use this contract when an owner authorizes installing an exact locally built userscript version into their current Tampermonkey profile so a milestone can prove the complete build → install → live-mount iteration loop. Authorization is exact-action by default: one version or task does not authorize future updates, scans, account actions, extension permission expansion, or changes to other installed scripts. A clearly stated durable authorization may cover later monotonic updates and read-only scans only within its recorded unchanged scope; it never expands to login/MFA automation, provider mutation, broader matches/grants, credential access, raw-response persistence, or other installed scripts.

A same-version **Reinstall** is not valid update evidence. Tampermonkey may leave the page open, provides no version transition, and warns that script settings will be reset. Use a canonical monotonic version bump so the pre-action and post-action states are distinguishable.

### 2. Signatures

The reference build and loopback-serving boundary is:

```bash
npm run build:amex-userscript
python3 -m http.server <loopback-port> \
  --bind 127.0.0.1 \
  --directory build
```

The live page check returns only a bounded projection:

```ts
interface InstalledReaderMountEvidence {
  exactOrigin: boolean;
  pathname: string;
  hostCount: number;
  hasOpenShadowRoot: boolean;
  launcherCount: number;
  launcherExpanded: "true" | "false" | null;
  statusCount: number;
  cancelButtonCount: number;
}
```

Browser responsibility is split by authority:

- **Playwriter** owns explicit task-created HTTP(S) pages for the loopback handoff and sanitized provider-page DOM evaluation.
- **Peekaboo** owns only the protected `chrome-extension://...` Tampermonkey confirmation UI that page automation cannot control.

### 3. Contracts

1. **Recorded authorization scope**: before the consequential action, identify the userscript name, namespace, incoming version, currently installed version, exact match scope, and grants. Proceed only when the observed metadata matches the built artifact and either the owner authorized that exact update or a recorded durable authorization explicitly covers monotonic updates with the same name/namespace/match/grants and read-only purpose. Any metadata or authority expansion requires fresh authorization.
2. **Observable version transition**: bump the canonical build version, rebuild, and require the Tampermonkey **Userscript update** page to show `incomingVersion > installedVersion`. Do not use a same-version reinstall, timestamp, page refresh, or click-delivery result as proof.
3. **Least-authoritative routing**: use a task-owned Playwriter page to open the loopback `.user.js` URL. Switch to Peekaboo only after Tampermonkey opens its protected confirmation page; do not attach DevTools or inspect browser-profile state to bypass the extension boundary.
4. **Fresh protected-UI observation**: observe only a narrow installer region containing the script identity/version and confirmation controls. Do not take broad browser accessibility dumps or screenshots that include unrelated tabs, bookmarks, account pages, messages, email, password-manager UI, or browser history.
5. **Confirmed native action**: prefer a semantic native control when exposed. If Tampermonkey does not expose **Update** through Accessibility, use fresh narrow visual evidence plus keyboard focus navigation: prove the visible focus ring moved from the default **Cancel** control to **Update**, then send Return. Coordinate clicks are a last resort and are not successful merely because the input tool reports delivery.
6. **Post-install proof**: require the update confirmation tab to close or transition, then reopen the same loopback artifact. Tampermonkey must report the new version as **INSTALLED VERSION** on the resulting same-version re-installation page. Cancel that verification page; do not reinstall again.
7. **Sanitized live mount proof**: on a task-owned exact-origin provider page, query only the reader host/shadow-root and known reader controls. Confirm one host, expected collapsed/expanded presentation, and no active status/cancel state. Expansion and collapse are allowed, but mount proof does not press the scan button. A subsequent scan is a separate consequential action and requires either exact-scan authorization or a recorded durable unchanged-scope read-only-scan authorization; installation authority alone never implies scan authority.
8. **Tool-overlay isolation**: if Playwriter's own toolbar intercepts a fixed reader control, remove or close only the tool-owned `[data-playwriter-toolbar]` overlay before retrying a fresh strict locator. Never remove, hide, or mutate provider-page elements to make validation pass.
9. **Cleanup**: close task-owned provider pages, cancel the verification installer, delete the Playwriter session, and stop the loopback server. Temporary narrow installer captures remain outside the repository and must not be copied into task artifacts.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Incoming version equals installed version and Tampermonkey offers **Reinstall** | Stop; do not claim self-update evidence or reset script settings |
| Script name, namespace, match scope, grants, or incoming version differs from the built artifact or recorded authorization scope | Cancel; do not install |
| Neither exact-action nor applicable durable authorization covers the consequential update | Stop at the protected confirmation page |
| Durable authorization exists but the update broadens matches, grants, purpose, provider mutation authority, or credential/raw-data access | Treat it as out of scope and obtain fresh authorization |
| Tampermonkey shows the expected old → new version and **Update** | Freshly observe the control, invoke one native action, then verify post-install state |
| Accessibility does not expose **Update** | Use a narrow visual region and verified keyboard focus; do not guess from a broad screenshot or stale coordinates |
| Input delivery reports success but the page neither closes/transitions nor later reports the new installed version | Treat the update as unverified, not successful |
| Verification reopen reports the new installed version | Cancel the re-installation page and proceed to bounded live validation |
| Updated exact-origin page mounts one idle reader | Expand/collapse only as needed; keep **Scan all cards** untouched |
| Reader is absent, duplicated, busy, or on an unexpected origin/path | Fail the live check without inspecting account content or starting a scan |
| A tool overlay intercepts the reader launcher | Remove only the identified tool-owned overlay and retry once with a fresh locator |
| Loopback server, task page, or browser session is no longer needed | Stop/close/delete the owned resource; never replace an unknown process or port owner |

### 5. Good / Base / Bad Cases

- **Good**: the canonical artifact advances from `0.2.5` to `0.2.6`; Tampermonkey shows **Userscript update** with installed `0.2.5`; verified keyboard focus activates **Update**; reopening reports installed `0.2.6`; an exact-origin page mounts one idle launcher; all task-owned resources are cleaned up.
- **Base**: the installer exposes **Update** through Accessibility. Peekaboo invokes that semantic action directly, then the same post-install version and sanitized mount checks prove completion.
- **Bad**: repeatedly click **Reinstall** for an already-installed version, infer success from a click tool's acknowledgment, inspect all Chrome tabs to find the prompt, retain installer screenshots in Git, or start a provider scan as part of installation verification.

### 6. Tests Required

For each owner-authorized automated userscript update, record or assert:

- the applicable exact-action or durable authorization scope is recorded, and any durable scope is bounded to unchanged name/namespace/matches/grants/read-only purpose;
- the canonical source and built metadata contain the same authorized new version;
- build and artifact metadata/grant/match audits pass before opening Tampermonkey;
- the pre-action installer narrowly shows the expected userscript identity, incoming new version, installed old version, and **Update**, not **Reinstall**;
- the native confirmation action is based on fresh semantic state or a visibly verified focus ring;
- the confirmation page closes/transitions and a verification reopen reports the new installed version;
- the verification prompt is cancelled without resetting script settings;
- the post-install exact-origin DOM projection contains exactly one open-shadow reader host, expected launcher state, and zero active cancellation/progress controls;
- expanding exposes one manual scan button without pressing it, and collapsing restores the launcher;
- no provider/account content, credentials, cookies, authorization material, storage exports, network payloads, or raw response data enter tool output or repository artifacts;
- task-owned pages/session/server are closed, deleted, or stopped; and
- the isolated build plus `git diff --check` pass after the version change.

### 7. Wrong vs Correct

#### Wrong

```ts
// Same-version reinstall has no observable success transition and may reset settings.
await openLocalArtifact("0.2.5");
await clickCoordinates(195, 495);
console.log("updated"); // input delivery is not installation evidence
```

#### Correct

```ts
await buildCanonicalArtifact({ from: "0.2.5", to: "0.2.6" });
await playwriterPage.goto(loopbackUserscriptUrl);

const before = await observeNarrowTampermonkeyUpdate();
assert.deepEqual(before, {
  incomingVersion: "0.2.6",
  installedVersion: "0.2.5",
  action: "Update",
});

await focusNativeUpdateControlAndPressReturn();
await expectTampermonkeyConfirmationToCloseOrTransition();

const after = await reopenAndObserveInstalledVersion(loopbackUserscriptUrl);
assert.equal(after.installedVersion, "0.2.6");
await cancelVerificationPrompt();

const mount = await evaluateSanitizedReaderMount(taskOwnedProviderPage);
assert.equal(mount.hostCount, 1);
assert.equal(mount.launcherExpanded, "false");
assert.equal(mount.cancelButtonCount, 0);
```

The version transition proves installation; the native focus proof establishes which protected action was invoked; and the bounded provider-page projection proves the newly installed script executes without broad browser/account inspection or an unapproved scan.
