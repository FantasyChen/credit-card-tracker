# Design: resolve live AMEX reader conflicts and panel quality issues

## Scope and boundaries

This change corrects three reviewed false-conflict mechanisms and the confirmed panel presentation defects found in the redacted live-data review.

It changes only local reader normalization, compatibility filtering, sync-envelope defense-in-depth, panel projection, tests, and userscript/parser version markers. It does not change AMEX request tuples, grants, response schemas, mailbox behavior, server synchronization authority, database schema, migrations, or deployment configuration.

No live scan, Sync action, mailbox handoff, confirmation, account mutation, database write, browser installation, or production rollout is part of implementation or validation. A future manual scan requires separate explicit authorization.

## Data flow

```text
bounded AMEX tracker/catalog responses
  -> reviewed raw-source exclusions
  -> existing supported-card/credit matching
  -> normalized V2 observations
  -> compatibility projection on stored observations
  -> panel coverage/presentation projection
  -> complete-card-only sync-envelope projection
```

The integrity boundary remains normalization and shared compatibility policy. The panel must not be the first place an ignored record disappears.

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

Only confirmed-empty cards are hidden and counted as having no trackable benefits. Empty unresolved and older-retained cards render as card groups so their quality/error state is visible.

The account summary must reconcile:

- `attemptedCardCount` as cards checked in the latest scan;
- stored card-record count;
- number of older retained records.

For the reviewed live shape, the expected presentation is equivalent to:

- 15 cards checked in the latest scan;
- 16 stored card records;
- 1 older retained card;
- 7 cards confirmed to have no trackable benefits and hidden;
- 4 zero-benefit cards unresolved after catalog HTTP errors, rendered rather than hidden.

The account-wide “no trackable benefits” state is allowed only when every relevant latest-scan card is conclusively empty and there are no unresolved or older-retained records requiring attention.

## Benefit presentation

Credit-usage behavior remains unchanged:

- `Used`
- `Partially used`
- `Not used`
- enrollment/linking/status precedence as currently defined

Newly normalized and compatibility-projected `spend` rows do not reach the panel. The panel may retain conservative fallback behavior for malformed or unsupported legacy values, but it must not reintroduce ignored rows.

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

No contract or store schema version changes.

Because normalization and display behavior change:

- bump parser marker from `amex-api-us/2.0.0` to `amex-api-us/2.0.1`;
- bump userscript version from `0.3.0` to `0.3.1`;
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

### Panel

Prove the reviewed 16-stored/15-attempted shape reconciles correctly, hides only seven confirmed-empty cards, renders four catalog-error empty cards and one older retained card truthfully, and does not show account-wide conclusive-empty copy.

Prove compact period formatting for annual, monthly, quarterly, half-year, irregular, cross-year, and fallback cases, including absence of raw provider tokens when `sourcePeriod` is observed.

### Synthetic E2E

Use only the local synthetic harness. Cover the three reviewed exclusions, one genuine control conflict, corrected empty-card coverage, usage wording, compact periods, and sanitized GM storage. No live AMEX or Perks Reminder origin may be contacted.

## Rollback

The source rollback is limited to parser/matcher/panel changes and version markers. No schema or database rollback is needed.

If compatibility filtering is found too broad before release, revert the shared normalized-observation predicate and parser version bump. Existing stores are not promoted or rewritten during source-only implementation; any later installed userscript may have removed ignored rows but cannot reconstruct missing rows without another scan, which is already required for completeness verification.
