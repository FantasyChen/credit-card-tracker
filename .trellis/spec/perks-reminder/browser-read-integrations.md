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
interface NormalizedCardObservationV1 {
  contractVersion: "amex-benefits/1";
  issuer: "american_express_us";
  localCardId: string;
  productName: string;
  endingDigits: string;
  observedAt: string;
  parserVersion: string;
  completeness: "complete" | "partial";
  issueCodes: IssueCode[];
  benefits: NormalizedBenefitObservationV1[];
}
```

Provider-benefit selection is a separate shared-catalog boundary, not a presentation filter:

```ts
interface SupportedAmexCardCreditMatch {
  catalogCardName: string;
  productKey: AmexProductKey;
  creditKey: string;
}

function matchSupportedAmexCardCredit(
  productName: string,
  benefitTitle: string,
): SupportedAmexCardCreditMatch | null;

function isIgnoredAmexCatalogBenefitTitle(title: string): boolean;

interface RetainableAmexBenefit {
  title: string;
  category?: { state: string; value?: unknown };
}

function retainSupportedAmexCardCredits<T extends RetainableAmexBenefit>(
  productName: string,
  benefits: T[],
): T[];

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
  benefit: NormalizedBenefitObservationV1,
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
  benefits: NormalizedBenefitObservationV1[];
  issueCodes: IssueCode[];
  conflictDiagnostics: BenefitIdentityConflictDiagnostic[];
  conflictDetails: BenefitIdentityConflictDetailSet;
}
```

`BenefitIdentityConflictCandidateDetail` is a closed projection containing only a one-based scan-local candidate index, one fixed source role, bounded parsed display title and supported-credit key/family, explicit parsed/not-exposed/unrecognized category/activity/enrollment/tracker/completion fields, parsed decimal quantity fields with characterized units/currency, parsed period, and bounded catalog layout/enrollability. It has no generic record field, issuer/source ID, provider token, request metadata, or raw object. The current Amex caps are 24 conflict details and four rendered candidates per conflict; bounded total counts plus truncation booleans disclose omitted detail without retaining unbounded output.

```ts
interface CardCommittedProgress {
  type: "card_committed";
  record: StoredCardRecordV1;
  conflictDiagnostics: BenefitIdentityConflictDiagnostic[];
  conflictDetails: BenefitIdentityConflictDetailSet;
}
```

`deriveBenefitUsageState` is a conservative presentation projection, not a persisted binary status. `decodeNumericCharacterReferences` decodes one pass of valid semicolon-terminated decimal or hexadecimal Unicode scalar references for display and leaves named, malformed, null, surrogate, and out-of-range references literal. `formatAmexBenefitTitle` applies that one-pass decoder and removes only a reviewed Amex adornment: terminal `<sup>‡</sup>` or `<sup>®</sup>`, standalone `‡`, or either exact superscript marker immediately before the exact suffix ` Statement Credit`. It trims trailing whitespace, preserves one separating space before `Statement Credit` when a nonempty prefix remains, and falls back to the decoded title when terminal removal would make it empty. Formatted output must still enter the DOM through text-only APIs such as `textContent`.

`isIgnoredAmexCatalogBenefitTitle` is the exact reviewed catalog-title exclusion boundary. The current closed set is `35% Airline Bonus` and `Link Your Resy Profile` after the same bounded title normalization used by matching. Catalog rows matching this set are removed before issuer-ID grouping, joined enrichment, ambiguity detection, or enrollment-candidate creation. Trackers whose normalized provider category is exactly `spend` are qualifying-spend requirements and are removed even earlier, before title joining, field interpretation, candidate evidence, or conflict creation. Missing, unknown, and every non-`spend` category continue through the ordinary supported-credit and fail-closed paths; title, amount, state, and period are not substitutes for the category decision.

`retainSupportedAmexCardCredits` reapplies both the exact title exclusion and observed-`spend` exclusion to normalized observations. Storage compatibility projection and synchronization projection must call the same function. A no-op returns the original array reference; removal creates a new array. Compatibility filtering never clears a generic conflict, changes quality, or promotes a historical partial card.

`projectCardCoverage` classifies each stored physical card against the latest scan as benefit-bearing, conclusively empty, unresolved in the latest scan, or older retained. `formatAmexSourcePeriod` renders observed V2 UTC date ranges deterministically as compact English calendar text: a full year as `2026`, a full month as `Jul 2026`, a same-year whole-month range as `Jul–Sep 2026`, and irregular/cross-year ranges with explicit compact dates. Raw provider duration text is a V1/unavailable-structured-period fallback only.

`BenefitIdentityConflictDiagnostic` remains an internal fixed vocabulary derived only from the adapter branch that detected a generic `benefit_identity_conflict`. The fixed category contains no source values. Under an explicit owner authorization that permits local semantic review, the same adapter may additionally project the minimum already-parsed candidate facts into `conflictDetails`; those facts are restricted to the current per-card progress event, panel memory, and the reader-owned open shadow tree. Neither the category nor structured details are part of normalized observations, scan summaries, storage, logs, network traffic, reload reconstruction, or task evidence.

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
13. **Separate evidence quality from benefit state**: user-facing presentation must not reuse parser completeness/freshness as a benefit status. `Current`, `Partial data`, `Stale data`, and `Could not read` describe the card observation and belong once in the accessible card-group heading plus its secondary quality disclosure, not repeated on every benefit row. `Enrollment required`, `Link required`, `Used`, `Partially used`, `Not used`, and `Status unavailable` describe the benefit. Apply state precedence in this order: enrollment/linking requirements; explicit completion, recognized earned/completed tracker or activity kind, or compatible used-at/above-target evidence as `Used`; compatible observed zero-below-target evidence as `Not used` even when a generic tracker state says in progress; explicit in-progress or compatible positive-below-target evidence as `Partially used`; explicit not-started evidence as `Not used`; otherwise `Status unavailable`. Generic in-progress remains `Partially used` when compatible zero evidence is absent, including when quantities are missing, incompatible, or uncharacterized.
14. **Scale by physical card identity and classify coverage before hiding**: when an account can contain many observations or repeated product names, group one account-wide master list by physical card and include product plus explicit ending digits in every rendered group label. Keep every benefit-bearing physical-card group represented under both filters; when a benefit-bearing card has no rows in the active filter, retain a compact zero-count group rather than a repeated empty-message box. Hide a zero-benefit card only when exactly one latest-scan disposition identifies it as complete, its record and observation are current/complete, and its V2 scan ID agrees when available. Render latest-scan partial/failed zero-benefit cards and older retained records with truthful quality/coverage copy; never describe them as having no trackable benefits. Reconcile attempted latest-scan cards, total stored card records, and older retained records in the account summary, and include unresolved/retained records in data-note counts. Show the account-level no-trackable-benefits state only when every relevant latest observation is conclusively empty and no unresolved or older retained record remains. The only top-level benefit filters are `Remaining` (default; every non-`Used` row) and `Used` (only `Used` rows); filter membership never relabels a row. A site-wide reader may keep collapse/filter state only in panel memory, but scanning and cancelling must force the full progress/cancellation workspace to remain reachable.
15. **Shared-catalog, card-specific selection**: normalized/persisted benefits must be usable, trackable credits represented by a positive-amount benefit on the matched Perks Reminder card. Product and benefit aliases belong to one browser-safe matcher backed by the shared static catalog; do not maintain a disconnected userscript allowlist or admit a credit represented only on a different card.
16. **Fail-closed filtering before interpretation**: unknown product names, unreviewed benefit wording, ambiguous matches, and access/protection/insurance/free-night/status/informational/non-credit titles are omitted before provider status, quantity, category, or layout fields are interpreted. For Amex, also omit every tracker whose exact normalized provider category is `spend`, plus catalog titles in the closed reviewed exclusion set (`35% Airline Bonus`, `Link Your Resy Profile`). Remove reviewed catalog exclusions before issuer-ID grouping so they cannot manufacture `ambiguous_catalog_join`; remove `spend` trackers before joining or candidate evidence so they cannot manufacture any identity conflict. Do not infer either exclusion from amount, state, period, or broad merchant wording. Intentional omission produces no normalized row, issue code, conflict diagnostic/detail, panel row, or synchronization row, and must not make an otherwise complete card partial. Every other materially different supported candidate remains fail-closed.
17. **Compatible-store and sync projection**: when a parser update narrows the supported-credit set without changing the observation/storage schema, project compatible stored observations through the same title/category retention function before display and future persistence, and reapply that function before sync-row projection as defense in depth. Preserve observation quality, freshness, timestamps, scan summaries, redacted errors, and legacy generic conflict state; increment storage revision and rewrite only when rows are actually removed. Never promote a historical partial card or clear `benefit_identity_conflict` merely because an ignored row was removed; only a later complete scan can replace that evidence. Malformed or future-schema stores remain refused, not repaired.
18. **Conservative quantity compatibility**: infer usage from used-versus-target comparison only when both values are valid nonnegative decimal strings, the target is positive, both units are characterized and equal, and currencies are equal. Matching `unknown` units are never compatible. Compare decimal strings deterministically rather than converting them to floating point. Incompatible, invalid, negative, missing, or nonpositive-target quantities cannot infer usage state. A combined inline used/target amount requires equal characterized units and currencies; an individual characterized used or target quantity may still be shown when its counterpart is absent.
19. **Practical row density and structured periods**: show benefit name, exact truthful state, safely available observed used/target evidence, and period inline. For V2, prefer an observed structured UTC source range and render it deterministically with compact English month labels (`2026`, `Jul 2026`, `Jul–Sep 2026`); use explicit compact start/end dates for irregular or cross-year ranges. Show the raw normalized period only as a V1 or unavailable-structured-period fallback, never alongside a valid structured range. Show partial/stale quality once at the card heading, and keep fixed redacted reasons, parser fields, confidence, issue codes, timestamps, and other technical evidence in a card-level secondary disclosure. Do not repeat card quality on each benefit row or make the grouped master list a raw normalized-data dump.
20. **Provider text remains inert**: decode valid decimal and hexadecimal numeric character references exactly once at the presentation boundary, leave unsupported or invalid references literal, and insert the result with `textContent` or an equivalent text-only API. A provider-specific presentation formatter may remove only a reviewed footnote adornment after that single pass; for Amex, this is a terminal literal or numeric-reference-derived `<sup>‡</sup>` or `<sup>®</sup>`, standalone `‡`, or either exact superscript marker immediately before the exact suffix ` Statement Credit`. Preserve one separating space before `Statement Credit` when a nonempty prefix remains, trim trailing whitespace, and fall back to the decoded title when terminal stripping would empty it. Preserve arbitrary other nonterminal markers, whitespace variants, broader suffixes, other tags/symbols, double-encoded references, and unrelated markup-like text. Never decode provider text by assigning it to `innerHTML`, never use `DOMParser` or broad tag stripping for display cleanup, never execute decoded markup, and do not rewrite the stored normalized title solely for presentation compatibility.
21. **Ephemeral authorized conflict review**: retain `benefit_identity_conflict` as the only persisted issue and preserve partial/fail-closed handling. Classify existing conflict sites with the stable fixed enum for tracker-state/same-supported-credit collision, joined tracker/catalog supported-key mismatch, ambiguous catalog join/record, and tracker/catalog enrollment-candidate collision. Without explicit owner authorization, expose only fixed redacted categories. When an owner explicitly authorizes local semantic conflict review, a per-card `card_committed` event may also contain a bounded closed projection of already-parsed candidate facts: card product/ending from the committed record; category; reviewed supported credit key/family (both keys for mismatch); fixed source role; bounded display title; explicit parsed enrollment/tracker/completion/activity, decimal quantity/unit/currency, and period fields; same/different/unavailable relations that compare joins, periods, amounts, and states without exposing issuer IDs; and catalog layout/enrollability only where needed. Cap details and candidates, mark truncation, sort candidates deterministically, and assign a stable scan-local key from category, reviewed family, and deterministic ordinal. Render the projection only in a bounded accessible card-level secondary section inside the reader-owned open shadow root, with semantic `data-amex-*` hooks for narrow native DOM extraction. It is acceptable for that local reader subtree and the sole operator's local prompt to contain authorized product names, endings, titles, states, periods, and amounts. Never include credentials, cookies, authorization headers, MFA values, opaque provider tokens, raw response objects, or issuer/source IDs; never place structured details or categories in normalized snapshots, scan summaries, GM storage, console, network, task artifacts, or reload reconstruction. Clear the card's prior details on any new committed success/failure, clear all details on scan start/clear, and reconstruct none from stored generic issues. Details are evidence for later user choices only: they must not choose a cycle/latest/first/last observation, invent persisted benefit identity, broaden matching, merge contradictory state, resolve/suppress the conflict, or expand transport authority.

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
| Relationship, product, token, or display-ending candidates conflict | Do not guess; classify the entry as unknown or identity-conflicted |
| Quantity value, unit, currency, status, or activity vocabulary is uncharacterized | Preserve only safe fields, add an issue code, and mark partial; do not infer |
| Local envelope fails schema/migration validation | Refuse to scan into malformed state and offer explicit local-data recovery |
| Exact origin/pathname changes, or a selected display captured at scan start changes/disappears | Finish safe commits, but mark the summary changed or unavailable |
| No recognized selected-card control exists at capture | Capture a null fingerprint and verify exact origin/pathname only; do not block manual scan or infer a display identity |
| Observation is partial/stale while a benefit is used or partially used | Show both facts independently; expose card quality once at the accessible card heading and keep fixed redacted reasons in card-level details, without repeating quality on each row or relabeling the benefit |
| Duplicate products or a high-observation account are restored | Render one grouped account-wide master list and keep every benefit-bearing physical card represented by product plus ending digits under both filters; hide only conclusively complete/current latest-scan empty cards and keep unresolved/older retained records visible with secondary quality details |
| Stored-card count exceeds latest attempted-card count | Reconcile attempted, stored, and older-retained counts explicitly; do not include an older retained record in the confirmed-empty aggregate |
| Latest-scan card has zero benefits after a partial catalog HTTP failure | Render the card as unresolved with catalog-unavailable copy; do not claim it has no trackable benefits or hide it as conclusively empty |
| Amex tracker category normalizes exactly to `spend` | Omit it before joining, interpretation, candidate evidence, conflicts, persistence, panel rendering, and sync projection; retain non-`spend` usage independent of amount |
| Amex catalog title is exactly a reviewed ignored title after bounded normalization | Omit it before issuer-ID grouping and enrollment-candidate creation; it cannot make a supported joined catalog record ambiguous |
| V2 benefit has an observed structured UTC source range | Render deterministic compact calendar text and suppress the raw provider duration token; use raw period only when structured data is unavailable |
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
| An existing adapter path emits `benefit_identity_conflict` without authorized semantic review | Keep the generic issue and partial disposition; add only its fixed redacted branch category to the current card's ephemeral scan outcome |
| An owner-authorized local semantic review detects a conflict | Keep the generic issue and partial disposition; attach only the typed bounded parsed candidate projection to that card's `card_committed` event and reader shadow tree; expose no issuer/source ID and make no automatic choice |
| A card is committed again, panel reloads/reconstructs from a stored generic conflict, or a new scan/clear begins | Replace or clear that card's prior ephemeral details, show no restored prior conflict category/detail, and infer nothing from storage |
| Product name has no exact normalized catalog alias | Omit all benefits for that card; do not guess a nearby product or borrow another card's credit rules |
| Benefit title has no unique reviewed alias for a positive-amount credit on the matched card | Omit the record before interpreting its provider fields; do not add a parser issue or partial marker solely for the omission |
| Title contains a credit brand plus an explicit non-credit phrase such as access, protection, insurance, free night, or status | Reject the record even when a broader merchant alias also appears |
| Compatible stored observation contains benefits no longer supported by the current matcher | Remove only those rows, preserve record/scan quality metadata, and rewrite with one revision increment only when the projection changes the store |
| Stored envelope is malformed or from a future schema | Refuse it unchanged; do not apply the supported-credit projection or overwrite storage |

### 5. Good / Base / Bad Cases

- **Good**: a manual scan uses named read methods, projects provider JSON into strict schemas, clears each transient token in `finally`, commits every card independently, keeps repeated products distinct through an HMAC fingerprint, and restores only normalized observations after reload.
- **Base**: an optional catalog read fails after valid tracker data. The reader records the redacted catalog issue, leaves enrollment fields unexposed, and commits the tracker observation as partial.
- **Bad**: a generic fetch helper accepts arbitrary paths, stores raw JSON for debugging, derives an ending from a full account number or token, defaults a missing amount to zero, or turns a catalog authentication failure into partial success.
- **Presentation good**: a partial card can still show an observed benefit as `Used`, while one accessible card-heading `Partial data` badge and card-level details explain observation quality without repeating it on every row; benefit-bearing, unresolved zero-benefit, and older retained physical cards remain visible in one grouped list; only conclusively complete/current latest-scan empty cards contribute to the aggregate hidden-card note; and `Remaining` contains exact non-used labels without flattening them.
- **Presentation base**: a benefit-bearing card has no rows under the active filter, so its product-plus-ending group remains visible as a compact zero-count group. A latest-scan catalog failure has no retained benefits, so it remains visible as unresolved rather than being counted as confirmed empty. A valid V2 quarterly source range renders as `Jul–Sep 2026` rather than `QuarterYear`.
- **Presentation bad**: a card-level `Incomplete` badge replaces the benefit state, duplicate products are grouped only by name, every zero-benefit record is described as confirmed empty, stored and attempted counts are mixed without explaining retained cards, a raw `CalenderYear` token is shown despite a valid structured range, `Remaining` relabels every row as not used, or all normalized/technical fields render at equal priority.
- **Provider-text good**: `&#36;` in a provider title displays as `$` through a single numeric-reference decoder, an Amex terminal `<sup>‡</sup>` / `<sup>®</sup>` or either exact marker before ` Statement Credit` is omitted only from display, and the DOM receives the result through `textContent` while normalized storage retains the source title.
- **Provider-text bad**: provider text is assigned to `innerHTML`, decoded repeatedly, broadly stripped as markup, has arbitrary nonterminal markers removed, is rewritten in normalized storage, or is allowed to throw on a malformed/out-of-range reference.
- **Conflict-diagnostic good**: all current generic identity-conflict sites map to unique fixed branch categories; an explicitly authorized local review additionally shows capped deterministic candidates with parsed titles/states/amounts/periods and safe join relations in the active reader shadow tree, while normalized storage contains only `benefit_identity_conflict`; restore-only reload retains the generic quality reason but no category or detail.
- **Conflict-diagnostic bad**: a detail includes an issuer/source ID, token, raw object, credential/session material, or generic passthrough; enters a normalized snapshot/scan summary/storage/log/network/artifact channel; survives replacement/reload; escapes the reader-owned subtree without authorization; or is used to pick one contradictory observation automatically.
- **Selection good**: an exact reviewed product alias and benefit-title alias resolve to one positive-amount credit on that same shared-catalog card; the stable card-scoped credit key owns deduplication. An Amex `usage` tracker remains eligible independent of amount, while an exact `spend` tracker and the closed ignored catalog titles are removed before conflicts can form.
- **Selection base**: a provider returns an access-only Resy item, `Link Your Resy Profile`, `35% Airline Bonus`, a qualifying-spend tracker, a free-night award, or an otherwise unrepresented tracker. The reader silently omits it before parsing or grouping can affect supported rows, while the Resy credit, `$200 Airline Fee Credit`, and other supported usage credits remain complete.
- **Selection bad**: a global merchant substring list admits a credit on every card, a broad `Resy`/`Saks` match admits access or protection, a catalog exclusion happens only after duplicate join grouping, a spend requirement is chosen or rejected by its dollar amount, or panel-only filtering leaves unsupported rows in local storage.
- **Compatible-store good**: loading a schema-compatible pre-filter store removes unsupported title/category rows once while preserving freshness, completeness, observation/attempt times, generic conflict state, errors, and last-scan summary; sync projection reapplies the same predicate without making a legacy partial card eligible.

### 6. Tests Required

For each browser-side provider reader, assert:

- every named operation emits the exact origin/path/method/headers/body/credentials/redirect tuple;
- an unapproved destination, method, body, redirect, or mutation path is unreachable by construction;
- retry occurs once only for network failures and `5xx`, and never for the other matrix rows;
- `application/json` with optional parameters is accepted while `application/jsonp`, HTML, and missing content type are rejected;
- bounded schemas strip unrelated fields and reject object-valued scalar candidates;
- four- and five-digit explicit endings are accepted, while conflicts and full numbers are rejected without truncation;
- duplicate product names remain distinct and duplicate tokens do not create duplicate cards;
- missing or unknown quantities, statuses, categories, and layouts remain explicit and never become inferred values;
- optional enrichment failure after tracker success produces a partial observation, while authentication, cancellation, and tracker failure remain hard/interrupted paths;
- raw responses and tokens never enter panel state, normalized output, diagnostics, storage, or exported errors and are cleared on every terminal path;
- per-card success replaces the latest observation, failure preserves stale prior data, and summary counts match attempted dispositions;
- exact-origin page load restores local normalized state without scanning, primary paths start expanded, and non-primary paths expose an accessible collapsed launcher whose expansion/collapse does not scan or persist UI state; clear-data removes both normalized state and the installation identity secret;
- visible context is reported as unchanged, changed, or unavailable without persisting its source display value; selector-present capture requires stable display equality, while selector-free capture permits unchanged route-only verification;
- all six truthful benefit labels follow the required precedence, observation-quality labels remain independent and appear once per accessible card heading rather than on each benefit row, fixed redacted quality reasons remain in card-level details, `Remaining`/`Used` filter state and counts are accessible, every benefit-bearing card group persists under both filters, only conclusively complete/current latest-scan empty cards are hidden, unresolved and older-retained zero-benefit cards remain visible with truthful copy, attempted/stored/retained totals reconcile, account-level empty state appears only when conclusive, and duplicate products remain distinct by ending digits;
- observed V2 structured periods format deterministically for full-year, full-month, same-year multi-month, irregular, and cross-year ranges; valid structured ranges suppress raw provider duration tokens, while V1/unavailable-structured-period rows retain the bounded raw fallback;
- decimal comparisons avoid floating point and cover equal/above/below/zero behavior; compatible zero overrides generic in-progress as `Not used`; explicit completion remains `Used` despite conflicting zero/in-progress evidence; generic in-progress without compatible zero remains `Partially used`; missing, incompatible, and matching-`unknown` quantities infer no state from quantity comparison; incompatible/unknown pairs show no combined amount; and malformed quantities remain rejected by the normalized schema;
- valid semicolon-terminated decimal/hex numeric character references decode exactly once into inert title text; named, malformed, null, surrogate, and out-of-range inputs remain literal; double-encoded input decodes only its outer layer; literal/numeric-derived terminal Amex `<sup>‡</sup>` / `<sup>®</sup>`, standalone `‡`, and either exact superscript marker before ` Statement Credit` are removed only for display; spacing normalizes to one separator before `Statement Credit` when a prefix remains; arbitrary nonterminal markers, whitespace variants, broader suffixes, multiple markers, other tags/symbols, and unrelated markup-like text remain visible and inert; empty-result fallback is safe; and normalized storage retains the original title;
- every existing `benefit_identity_conflict` production site maps to the expected stable fixed category using invented fixtures; owner-authorized structured detail has exact closed shapes for all four categories, both reviewed keys on mismatch, fixed source roles, parsed candidate fields and safe relations, candidate/detail caps and truncation, deterministic ordering and scan-local keys under relevant reversal, correct card scoping, replacement on partial/failed rescan, and clearing on new scan/clear/reload; generic card-versus-row issue locality and partial disposition remain unchanged; neither categories nor details contain source IDs/secret-like fields or serialize into normalized observations, scan summaries, GM storage, console, network, or artifacts; and generated-bundle tests prove narrow native availability under the reader-owned shadow tree only;
- a synthetic high-scale fixture (currently 16 benefit-bearing cards / 130 observations for Amex) keeps every benefit-bearing card group visible under both filters and keeps every eligible observation reachable through its truthful filter in the account-wide grouped master list; a mixed coverage fixture proves 16 stored versus 15 latest-attempted records, seven confirmed-empty hidden cards, four unresolved empty cards, four benefit-bearing cards, and one older retained card reconcile without false empty claims; separate fixtures cover the conclusive all-empty account state;
- every positive-amount benefit intended for provider synchronization in the shared card catalog has an exact-card matching fixture, while zero-value/access/protection/insurance/free-night/status/informational records, wrong-card titles, unknown products, and ambiguous wording fail closed;
- unsupported provider records with malformed or unknown status/category fields, every exact normalized Amex `spend` tracker, `35% Airline Bonus`, and `Link Your Resy Profile` are omitted before interpretation/conflict creation and do not create normalized rows, partial observations, issue codes, conflict diagnostics/details, panel rows, or sync rows; order-reversed fixtures prove Dell `usage`, `$200 Airline Fee Credit`, and the Resy credit remain while unrelated genuine collisions stay fail-closed;
- equivalent reviewed wording deduplicates through the same card-scoped credit key, while materially different credit observations do not merge;
- compatible legacy-store projection preserves schema, quality/freshness metadata, timestamps, generic conflict state, errors, and scan summary; rewrites/increments revision only when title/category rows are removed; is idempotent on the second load; refuses malformed/future stores without overwrite; and shares the exact retention predicate with sync projection, which retains all existing complete/current/latest-V2 card gates;
- shared-catalog extraction has a website parity assertion so browser-safe reuse cannot silently remove or alter static catalog cards/benefits;
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

#### Presentation boundary

```ts
// Wrong: parser quality overwrites the benefit state, and Remaining flattens
// every non-used row into one inaccurate label.
const label = card.completeness === "partial"
  ? "Incomplete"
  : activeFilter === "remaining"
    ? "Not used"
    : benefit.trackerState;

// Correct: derive independent facts. The filter controls membership only.
const observationLabel = presentObservationQuality(card); // "Partial data"
const usage = deriveBenefitUsageState(benefit); // e.g. "Partially used"
const isVisible = usage.filter === activeFilter;
```

This separation prevents data-collection uncertainty or navigation state from being mistaken for the benefit's truthful usage state.

#### Provider-text boundary

```ts
// Wrong: provider-controlled title text becomes an HTML parsing sink.
row.innerHTML = decodeProviderText(benefit.title);

// Correct: decode one pass, remove only the exact reviewed Amex terminal
// or Statement Credit footnote shape, then render without changing storage.
row.textContent = formatAmexBenefitTitle(benefit.title);
```

Single-pass numeric decoding plus narrow terminal-adornment cleanup fixes provider-visible labels without turning a presentation compatibility rule into markup execution, broad tag stripping, or a normalized-storage migration.

#### Supported-credit boundary

```ts
// Wrong: a global substring filter admits the merchant on unsupported cards
// and leaves rejected rows persisted for the panel to hide.
const visibleBenefits = observation.benefits.filter((benefit) =>
  ["resy", "saks", "uber"].some((merchant) =>
    benefit.title.toLowerCase().includes(merchant),
  ),
);

// Correct: normalize through the shared-catalog, card-specific matcher before
// provider fields enter the normalized observation or compatible local store.
const match = matchSupportedAmexCardCredit(productName, providerBenefit.title);
if (!match) return null;
return normalizeSupportedBenefit(providerBenefit, match.creditKey);
```

The matcher must verify both sides of the contract: the card is a reviewed product alias, and the title resolves uniquely to a positive-amount usable credit represented on that exact shared-catalog card. Broad merchant wording never overrides explicit non-credit phrases.

```ts
// Wrong: reviewed exclusions happen after grouping/normalization, so ignored
// rows can still create conflicts or survive in storage and synchronization.
const groupedCatalog = groupCatalogByIssuerId(catalogResponse.benefits);
const visible = normalizeTrackers(trackers, groupedCatalog).filter(panelFilter);

// Correct: remove exact reviewed source roles before candidate/conflict creation,
// then reuse the normalized-observation predicate at storage and sync boundaries.
const selectedCatalog = catalogResponse.benefits.filter(
  (row) => !isIgnoredAmexCatalogBenefitTitle(catalogTitle(row)),
);
const selectedTrackers = trackers.filter(
  (row) => normalizeCategory(row.category) !== "spend",
);
const normalized = normalizeSelectedBenefits(selectedTrackers, selectedCatalog);
const retained = retainSupportedAmexCardCredits(productName, normalized);
```

Source selection must happen early enough that an ignored row cannot alter ambiguity, issue codes, or completeness. Compatibility and sync filtering are defense in depth, not permission to normalize a known ignored source first.

## Scenario: reviewed observation handoff and confirmed AMEX synchronization

### 1. Scope / Trigger

Use this contract when locally reviewed provider observations cross from a browser-session reader into an authenticated first-party preview and may later update durable benefit state. Scanning, local review, handoff, preview, and confirmation are separate explicit actions. Preview is read-only; only effective `write` mode plus a separate confirmation may persist.

The initial writable policy is deliberately finite: product `american-express-platinum-card`, credit families `american-express-platinum-card:lululemon` and `american-express-platinum-card:resy`, a valid current structured UTC source range, and exactly one existing destination cycle/occurrence. Every broader product, family, period, V1 record, stale/partial/failed observation, or ambiguous mapping remains review-only. Raw provider responses, browser-session material, source fingerprints, and installation secrets never cross the handoff.

### 2. Signatures

The public browser and server boundaries are:

```ts
type AmexSyncMode = "off" | "preview" | "write";

interface AmexSyncConfiguration {
  mode: AmexSyncMode;
  hmacKey: string | null;
}

interface AmexSyncMailbox {
  mailboxVersion: "amex-sync-mailbox/1";
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

1. **V2-only, exact candidate projection**: transfer only strict `amex-sync-envelope/1` rows projected from the latest completed `amex-benefits/2` scan whose card observation is current and complete. Before row projection, reapply the browser reader's shared supported-credit retention predicate so reviewed ignored titles and observed `spend` requirements cannot cross the handoff even from a directly supplied compatible store; this defense never promotes a partial card or bypasses latest-scan gates. The scan must remain within 30 minutes at confirmation. Stable product/family keys and a validated structured UTC date range are authority; display titles and free-form periods are not.
2. **One private mailbox**: a direct global Sync gesture creates at most one bounded `amex-sync-mailbox/1` value under the fixed GM key. Its ten-minute lifetime may not exceed the source scan deadline. The top-level handoff URL contains only the opaque transfer ID. No payload, nonce, digest, proposal, card ending, title, or amount belongs in a URL, page storage, DOM attribute, clipboard, or wildcard message.
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
- assert exact two userscript match scopes, storage-only grants, `@noframes`, top-frame checks, no provider runtime on the handoff, and no side effects on unrelated origins/paths;
- assert V1 remains review-only, V2 candidate selection is latest/current/complete/fresh, the finite product/family allowlist is exact, and structured source ranges resolve exactly one current cycle/occurrence;
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
- exact complete-flow operation counts, account-wide duplicate physical-card grouping, supported/non-credit filtering, global `Remaining`/`Used` switching without provider reads, and visible route/display invariance;
- a selector-free non-primary exact-origin document mounts collapsed, expands without reads, completes a manual scan with route-only context verification, and remains on the same pathname;
- normalized GM storage excludes raw fixture tokens and upstream identifiers, survives reload without autoscan, and clear-data removes both store and identity keys;
- deterministic partial/failure paths exercise the built artifact and exact retry/error behavior;
- an invented conflict-diagnostics scenario exercises every fixed category through the built artifact, exposes the exact bounded structured candidate projection through stable semantic hooks in the reader-owned shadow tree only during the active panel scan, stores only the generic issue/partial observation, and loses category labels/details after restore-only reload without provider reads;
- a route gate proves cancellation aborts a later physical-card read only after an earlier card is committed, starts no later work, and records the engine's interrupted attempt/disposition counts;
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
