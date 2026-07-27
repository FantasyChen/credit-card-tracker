# Design: resolve live AMEX reader conflicts and panel quality issues

## Scope and boundaries

This change corrects three reviewed false-conflict mechanisms, excludes supplementary relationships from the primary-card reader, and fixes the confirmed panel presentation defects found in the redacted live-data reviews.

It changes only local account discovery, reader normalization, compatibility invalidation/filtering, sync-envelope defense-in-depth, panel projection, tests, and userscript/parser version markers. It does not change AMEX request tuples, grants, response schemas, mailbox behavior, server synchronization authority, database schema, migrations, or deployment configuration.

No live scan, Sync action, mailbox handoff, confirmation, account mutation, database write, browser installation, or production rollout is part of implementation or validation. A future manual scan requires separate explicit authorization.

## Data flow

```text
bounded AMEX member response
  -> admit top-level BASIC; exclude nested SUPP
  -> primary-card identity and tracker/catalog reads
  -> reviewed raw-source exclusions
  -> existing supported-card/credit matching
  -> normalized V2 observations
  -> compatibility projection on stored observations
  -> panel coverage/presentation projection
  -> complete-card-only sync-envelope projection
```

The ownership boundary is account discovery; the benefit integrity boundary remains normalization and shared compatibility policy. The panel must not be the first place an ignored relationship or benefit record disappears.

## Primary-card discovery policy

The bounded member response already distinguishes characterized roles through both structure and relationship:

- top-level `accounts[]` with exact resolved relationship `BASIC` are eligible primary cards;
- nested `supplementary_accounts[]` with exact resolved relationship `SUPP` are understood policy exclusions.

`parseAccountDiscovery` excludes exact `SUPP` before `addCard`. These records do not reach identity-secret loading, token fingerprinting, tracker/catalog requests, discovered/attempted counts, normalization, persistence, panel projection, or synchronization consideration. A known excluded `SUPP` relationship does not count as an unknown account variant or make a clean scan partial. Unknown, missing, or contradictory relationship shapes keep existing fail-closed unknown-variant behavior.

Role/structure is authoritative; display product phrases are not. A supplementary entry can inherit its parent product description and look like an ordinary supported Platinum card, so matching `Additional` or `Companion` names is insufficient.

The persistent normalized contracts do not gain a role field. Existing v0.3.1 snapshots cannot reliably reconstruct ownership, so a one-time local compatibility marker invalidates all pre-primary-only cards and `lastScan`, deletes any pending mailbox derived from that snapshot, and preserves the installation identity secret. Validation happens before mutation; malformed/future stores are refused unchanged; the marker is written only after successful invalidation; later loads are idempotent.

## Reviewed source-selection policy

### Tracker policy

A tracker is ignored before title joining, status parsing, quantity parsing, candidate evidence, conflict collection, or normalized-row creation when its normalized provider category is exactly `spend`.

Rationale:

- The user does not want qualifying-spend requirements tracked.
- The live `spend` rows were Dell qualification spend, Adobe qualification spend, and One AP qualification spend.
- Selection must not depend on observed amount, title, status, or period.
- A Dell `usage` tracker remains eligible even if its current limit changes from the observed $150.

Unknown, missing, or unrecognized categories are not treated as `spend`; they continue through existing fail-closed handling.

### Catalog-title policy

Two reviewed catalog titles are outside the reader's credit purpose and are ignored before catalog records are grouped by provider join ID:

- `35% Airline Bonus`
- `Link Your Resy Profile`

Matching must use the same bounded title normalization already used by supported credit matching and narrow reviewed phrases. Ignored catalog rows are excluded from:

- catalog join grouping and ambiguity detection;
- tracker enrichment;
- catalog-only enrollment candidate creation;
- conflict diagnostics/details;
- normalized observations.

The `$200 Airline Fee Credit` and Resy credit titles remain eligible. All other duplicate or contradictory catalog rows retain existing fail-closed ambiguity behavior.

### Why filtering occurs before grouping

`normalizeBenefits` currently groups all catalog records by `sorBenefitId` before supported title matching. Therefore an unsupported `35% Airline Bonus` can make an otherwise unique airline-fee catalog join ambiguous. Removing only reviewed ignored records before grouping fixes that false ambiguity without weakening the generic duplicate-join rule.

### Shared normalized-observation policy

`retainSupportedAmexCardCredits` remains the compatibility policy for normalized observations and is extended to reject:

- reviewed ignored titles;
- observations whose category is `{ state: "observed", value: "spend" }`.

The helper must retain its current reference-equality behavior when nothing changes, because Tampermonkey compatibility loading uses identity to avoid unnecessary writes.

This shared policy is reused by:

- Tampermonkey compatibility projection, removing ignored historical rows without clearing old card-level issue/completeness state;
- sync-envelope projection, preventing directly supplied compatible stores from projecting ignored rows.

Old generic `benefit_identity_conflict` issues are never cleared and old partial cards are never promoted to complete. Detailed conflict locality was not persisted, so only a future authorized scan can prove a new complete observation.

## Genuine-conflict behavior

The existing four conflict categories and bounded transient details remain unchanged:

- `tracker_state_collision`
- `tracker_catalog_key_mismatch`
- `ambiguous_catalog_join`
- `tracker_catalog_candidate_collision`

After reviewed ignored records are removed, every remaining materially different candidate continues to add `benefit_identity_conflict`, mark the observation/card partial, and block synchronization through the existing complete-card gate.

Persisting conflict diagnostics or changing the storage schema is not part of this iteration.

## Panel coverage projection

The panel derives four card groups from the store and latest scan summary:

1. **Benefit-bearing** — latest observation contains at least one retained benefit.
2. **Confirmed empty** — card belongs to the latest scan; latest disposition, record, and observation are complete/current; V2 scan identity agrees when available; retained benefit list is empty.
3. **Latest-scan unresolved** — card belongs to the latest scan but is partial, failed, stale after failure, or otherwise not conclusively complete.
4. **Older retained** — stored card is not represented in the latest scan summary.

Coverage remains an internal account-quality projection, but active-filter rendering is a separate presentation projection. A card group renders only when it contains at least one row in the selected filter:

- `Remaining` renders cards with at least one conservatively classified non-used row;
- `Used` renders cards with at least one used row;
- zero-benefit partial, failed, stale, and older-retained records render no card group;
- an all-used card renders no compact group under `Remaining`, but appears with rows under `Used`;
- partial/stale cards with actual rows remain visible in the corresponding filter without a quality badge or disclosure.

The completed panel does not render account metrics, scan notes, coverage reconciliation, hidden-card counts, or quality-problem copy. Those classifications continue to support correct omission and conclusive-empty decisions internally. Filter-specific empty states still point users to the other filter when it contains rows.

For the reviewed v0.3.1 shape, only cards with rows in the selected filter render; zero-benefit unresolved/retained groups do not. After primary-only migration and a separately authorized fresh scan, supplementary relationships are absent from both internal counts and storage.

## Scan workspace and benefit presentation

Credit-usage behavior remains unchanged after a scan reaches its terminal `finished` event:

- `Used`
- `Partially used`
- `Not used`
- enrollment/linking/status precedence as currently defined

Newly normalized and compatibility-projected `spend` rows do not reach the panel. The panel may retain conservative fallback behavior for malformed or unsupported legacy values, but it must not reintroduce ignored rows.

During `scanning` or `cancelling`, the panel is a distinct workspace rather than a progressively updated result view. It renders only an accessible determinate progress bar, concise progress copy, and the cancellation control. `discovered` supplies the total card count; each `card` event supplies the one-based current card index; start and context-verification phases remain indeterminate until a total is known or the terminal result arrives. `card_committed` may update the panel's in-memory store so final rendering is accurate, but it must not render the store, card headings, benefit rows, summaries, filters, Sync, footer controls, diagnostics, or timestamps before `finished`.

At `finished`, the panel returns to its normal filter-aware result view. The visible result view deliberately excludes scan notes, coverage/data-quality metrics and labels, issue/error explanations, conflict diagnostics/details, parser/confidence fields, and observation/attempt timestamps. These fields remain in the existing normalized store and scan contracts for fail-closed behavior, compatibility, and synchronization eligibility; presentation removal must not mutate or relax them.

## Structured period formatting

For V2 observations, `sourcePeriod` is the display authority when observed. Formatting is deterministic, English, and UTC-based; it does not use environment-dependent locale formatting.

Required compact forms:

- full calendar year: `2026`
- full month: `Jul 2026`
- whole multi-month same-year range: `Jul–Sep 2026`
- half-year: `Jul–Dec 2026`
- irregular or cross-year ranges: compact explicit start/end dates

When a valid structured period exists, raw provider duration tokens such as `CalenderYear`, `QuarterYear`, and `HalfYear` are not rendered. V1 observations and V2 observations without an observed structured period retain the existing bounded raw-period fallback.

## Compatibility and versioning

No normalized contract or store schema version changes.

Because ownership authority and display behavior change:

- bump parser marker from `amex-api-us/2.0.1` to `amex-api-us/2.0.2`;
- bump userscript version from `0.3.1` to `0.3.3`;
- add a non-sensitive fixed compatibility marker for one-time role-unverified snapshot invalidation;
- require current-parser observations at sync-envelope projection/validation so pre-primary-only V2 data fails closed pending a fresh scan;
- update generated-bundle assertions.

Building the userscript is allowed as local validation. Installing it into Tampermonkey or performing a live scan is a separate outward-facing step and requires explicit authorization after implementation review.

## Testing strategy

### Supported-credit and compatibility policy

Prove:

- `$200 Airline Fee Credit` and Resy credit titles remain supported;
- `35% Airline Bonus` and `Link Your Resy Profile` are rejected;
- every normalized observed `spend` row is removed independent of title and amount;
- `usage` rows remain;
- no-op filtering preserves array identity.

### Adapter normalization

Use input-order-reversed fixtures to prove:

- mixed Dell `spend` and `usage` trackers yield only the usage row and no conflict;
- airline-fee and airline-bonus catalog rows sharing a join ID yield only the fee-credit row and no ambiguity;
- a Resy credit tracker plus profile-link catalog rows yields only the credit and no enrollment candidate/conflict;
- ignored records do not appear in issue codes, conflict diagnostics, conflict details, or serialized normalized output;
- unrelated contradictory duplicate rows still fail closed.

### Storage and synchronization

Prove compatibility loading removes ignored normalized rows, increments revision once, is idempotent, preserves quality/issues/timestamps, and never clears legacy partial conflict state.

Prove sync projection reapplies the shared retention policy while preserving all current V2/current/latest-scan/complete-card gates.

### Discovery, compatibility, and panel

Prove top-level exact `BASIC` is the only emitted card; nested exact `SUPP`, including inherited-parent product shapes, causes no identity or benefit requests and does not count unknown. Prove unknown/conflicting relationships remain fail closed.

Prove the one-time compatibility migration invalidates every role-unverified card and pending mailbox, preserves the identity secret, refuses malformed/future data unchanged, and is idempotent.

Prove the reviewed mixed-quality shape retains filter-aware card-group membership without rendering user-facing quality labels, coverage/count notes, issue explanations, timestamps, parser/confidence fields, or conflict diagnostics. Zero-benefit unresolved/stale/retained groups and all-used compact groups are absent from `Remaining`; used cards appear under `Used`.

Prove a running or cancelling panel renders only the accessible progress workspace, with a determinate value derived from actual discovery/card progress once discovery completes; it must conceal prior and newly committed card data until the terminal `finished` event restores the final result view.

Prove compact period formatting for annual, monthly, quarterly, half-year, irregular, cross-year, and fallback cases, including absence of raw provider tokens when `sourcePeriod` is observed.

### Synthetic E2E

Use only the local synthetic harness. Cover the three reviewed exclusions, one genuine control conflict, corrected empty-card coverage, usage wording, compact periods, and sanitized GM storage. No live AMEX or Perks Reminder origin may be contacted.

## Rollback

The source rollback is limited to parser/matcher/panel changes and version markers. No schema or database rollback is needed.

If compatibility invalidation or primary-only filtering is found incorrect before release, revert the compatibility marker, parser gate, and discovery change before installation. Once an installed v0.3.3 invalidates a role-unverified snapshot, observations cannot be reconstructed without another scan; that fresh authenticated scan is already required to establish primary-only completeness and remains separately authorized.
