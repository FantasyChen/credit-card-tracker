# Design: Refine AMEX pre-sync benefit list

## Overview

Refine the existing Tampermonkey panel in place. Keep the AMEX read client, normalized observation contract, storage policy, and shared-catalog eligibility matcher unchanged unless implementation reveals a presentation-blocking defect. Replace the selected-card workspace and four current filters with one account-wide master list grouped by physical card and two filters: Remaining and Used. The scan engine may carry fixed conflict categories plus explicitly authorized bounded parsed candidate details to panel memory and the reader-owned shadow tree, but must not add either to normalized or durable state.

The panel remains a local, read-only review surface. This milestone adds no Perks Reminder transport or mutation authority.

## Boundaries

### Reused unchanged

- Manual scan orchestration in `src/lib/amex-benefit-reader/scan-engine.ts`.
- Strict provider reads and transient raw-data handling.
- `NormalizedCardObservationV1` / `NormalizedBenefitObservationV1` persistence.
- Exact-card shared-catalog filtering in `supported-card-credits.ts`.
- Physical-card identity and product-plus-ending labels.
- Separate observation freshness/completeness metadata.
- Site-wide exact-origin mount behavior and local clear-data behavior.

### Changed

- Benefit presentation state derivation in `src/userscripts/amex-benefit-reader/panel.ts` or a small adjacent pure presentation module if extraction materially improves testability.
- Panel hierarchy, filter model, empty states, and styles.
- Panel unit tests and generated-bundle browser scenarios that currently assume selected-card navigation and four filters.
- Adapter conflict-site classification, the ephemeral `card_committed` scan-progress projection, and current-panel-only redacted conflict details.

### Not changed

- AMEX endpoint inventory, grants, credentials mode, retry policy, schemas, or normalization.
- Stored observation schema.
- Supported-benefit matcher policy.
- Perks Reminder APIs, database, authentication, or benefit statuses.
- Tampermonkey-to-extension packaging.

## Presentation contract

### Truthful row state

Derive one display state without mutating or reducing the normalized observation:

1. **Enrollment required** when the normalized enrollment field explicitly requires enrollment.
2. **Link required** when the normalized enrollment/link field explicitly requires linking.
3. **Used** when source evidence explicitly reports completion, a recognized earned/completed tracker state, or compatible observed used/target quantities establish `used >= target`.
4. **Not used from zero evidence** when compatible observed quantities establish `used = 0 < target`, even if the generic tracker state says in progress.
5. **Partially used** when compatible quantities establish `0 < used < target`, or when a recognized in-progress state remains after zero evidence is unavailable, incompatible, or uncharacterized.
6. **Not used from explicit state** when a recognized not-started state remains after higher-precedence evidence.
7. **Status unavailable** when none of the above can be established without inference.

Implementation must preserve existing conservative field semantics. It must not manufacture zero, infer compatible units, parse amounts from titles, or turn missing/unknown evidence into Not used.

### Observation quality

Observation quality is a separate presentation fact:

- current;
- partial data;
- stale data retained after a failed rescan;
- could not read/no usable observation.

A partial or stale badge never changes a benefit's truthful row state. Observation quality appears once at the accessible card-group heading rather than on every benefit row, while timestamps, parser fields, confidence, and fixed redacted issue reasons remain in card-level secondary details.

### Provider title presentation

Decode valid numeric character references exactly once, then remove only a reviewed AMEX footnote adornment: terminal literal `<sup>‡</sup>` or `<sup>®</sup>`, the same exact text produced by that one decoding pass, standalone trailing `‡`, or either exact superscript marker immediately followed by the exact suffix ` Statement Credit`. For the suffix shape, remove only the marker and retain one separating space before `Statement Credit` when a nonempty prefix remains. Trim trailing whitespace and fall back to the decoded title if terminal removal would make it empty. Preserve arbitrary other nonterminal markers, named entities, double-encoded references, other symbols/tags, unrelated markup-like text, whitespace variants, and broader suffixes, and insert the result only through `textContent`. This formatter is presentation-only and must not rewrite normalized storage or shared-catalog matching data.

### Ephemeral conflict diagnostics and authorized local detail

Keep `benefit_identity_conflict` as the normalized/persisted card or row issue and continue marking the card partial. The adapter still returns the fixed-enum, unique diagnostic list ordered as:

1. `tracker_state_collision`;
2. `tracker_catalog_key_mismatch`;
3. `ambiguous_catalog_join`;
4. `tracker_catalog_candidate_collision`.

The category is based only on the internal branch. Under the user's explicit 2026-07-22 authorization for sole-operator local review, the adapter also returns `BenefitIdentityConflictDetailSet`, a closed bounded projection of already parsed fields. Each detail contains a scan-local `category:family:ordinal` key, reviewed card-scoped credit keys/families, capped deterministically ordered candidates, capped counts/truncation flags, and same/different/unavailable join/period/amount/state relations. Each candidate contains only a fixed source role (`tracker`, `joined_catalog`, or `catalog_enrollment_candidate`), bounded display title, supported credit key/family, explicit observed/not-exposed/unrecognized category/activity/enrollment/tracker/completion fields, parsed decimal quantities with characterized units/currency, period, and required catalog layout/enrollability. Internal join IDs may be compared while normalizing but are stripped before the result; no issuer/source ID or raw object enters the detail contract.

The scan engine attaches category and detail only to the in-memory per-card `card_committed` progress event. The panel stores them together in a per-card memory map, replaces that card's entry on every successful/partial/failed commit, clears all entries at scan start and clear-data, and reconstructs with an empty map after reload. The panel renders one bounded accessible section under the card's existing quality disclosure. Stable `data-amex-reader-card-group`, `data-amex-conflict-details`, `data-amex-conflict`, `data-amex-conflict-candidate`, `data-amex-conflict-field`, and `data-amex-conflict-relation` hooks permit narrow native extraction from only the userscript host's open shadow root. Product names, endings, titles, parsed periods/states/amounts, and reviewed keys may appear there and in the sole local operator's prompt; credentials/session material, tokens, issuer/source IDs, raw data, and generic DOM exports may not.

Neither categories nor details are part of `NormalizedCardObservationV1`, `ScanSummaryV1`, `StoreEnvelopeV1`, GM storage, console/network output, or task artifacts. Same-supported-credit handling remains fail-closed and first-retained. Details are evidence for a later user decision only: this milestone does not choose a cycle/latest observation, invent persisted identity, merge contradictory state, broaden matching, resolve/suppress the generic conflict, or add transport authority.

### Filters

Use exactly two top-level filters:

- **Remaining** (default): every row whose truthful state is not Used, including Partially used, Not used, Enrollment required, Link required, and Status unavailable.
- **Used**: only rows whose truthful state is Used.

The filter is navigation, not normalization. Do not relabel Remaining rows.

## Master-list hierarchy

1. Panel header and scan state.
2. Remaining / Used segmented filter with accessible pressed/selected state and counts.
3. One continuous list of physical-card groups, sorted deterministically using the existing product-name and ending-digit ordering unless repository conventions require a more stable existing order.
4. Summary metrics count cards with eligible benefits and data-note cards within that same benefit-bearing set; attempted scan coverage remains in scan status.
5. Cards whose latest normalized observation has zero eligible benefits do not render individual groups. One aggregate, non-identifying note reports how many reviewed cards are hidden, and an all-empty account shows one no-trackable-benefits state.
6. Each visible card group header shows product name, ending digits, relevant observation-quality warning, and visible-row count.
7. Each group renders only rows matching the active filter. A benefit-bearing card with zero matching rows remains as a compact header/zero-count group without a repeated dashed empty box.
8. Each row shows only:
   - benefit name;
   - truthful state;
   - observed used/target amount when compatible and available;
   - observed period when available.
9. Card observation quality remains in the card heading, and technical details plus fixed redacted reasons remain behind the existing card-level secondary disclosure pattern.

The panel remains bounded by its existing viewport and scroll behavior. It does not render a second overlay or separate page.

## Accessibility

- Use semantic buttons for the two filters and expose selected state with `aria-pressed` or the existing equivalent.
- Preserve keyboard access, focus visibility, and touch target sizing.
- Card headings form a navigable hierarchy and do not rely on color alone.
- Status and quality use text labels in addition to visual treatment.
- Compact zero-count card groups expose their active-filter count through visible and accessible text; globally empty identities are not rendered.
- The all-empty account state and aggregate hidden-card note remain concise and non-identifying.

## Data flow

```text
Manual Scan all cards
  -> existing exact AMEX reads
  -> existing exact-card supported-credit normalization
     -> generic conflict issue -> existing normalized local store
     -> fixed category + bounded parsed candidate detail -> ephemeral card_committed event -> panel memory + reader shadow tree only
  -> restore/render all physical-card records
  -> derive truthful row state + separate quality
  -> apply Remaining or Used view filter
  -> group by physical card
  -> render practical list rows
```

No data leaves Tampermonkey storage in this milestone.

## Test strategy

### Pure/panel tests

Cover the state precedence matrix, including explicit completion, earned/completed tracker states, compatible amount-at-target, partial usage, zero/not-started, enrollment/link prerequisites, unknown/unavailable fields, and incompatible units.

Cover:

- Remaining default and Used selection;
- exact filter membership without relabeling;
- account-wide grouping;
- duplicate products distinguished by ending digits;
- globally benefit-empty cards hidden behind a non-identifying aggregate note, including the all-empty account state;
- every benefit-bearing card represented under both filters, with compact zero-count groups;
- visible-surface metrics scoped to benefit-bearing and data-note cards;
- practical inline fields only;
- partial/stale quality independent from usage state;
- accessible filter state and keyboard semantics;
- no Perks Reminder transport or sync control;
- literal and one-pass-decoded `<sup>‡</sup>` / `<sup>®</sup>` terminal and exact ` Statement Credit` cleanup, including separator normalization, plus arbitrary-prose, whitespace-variant, broader-suffix, other-tag/symbol, named/malformed, double-encoded, multiple-marker, and empty-fallback negatives;
- all four fixed conflict categories and exact structured candidate shapes, both mismatch keys, fixed source roles, parsed fields and safe relations, detail/candidate caps and truncation, deterministic category/detail/candidate order and scan-local keys under reversal, card scoping, new-scan/per-card-replacement/clear/reload lifecycle, generic issue locality/partial handling, semantic shadow-DOM hooks, and complete absence from serialized normalized storage.

### Generated-bundle browser tests

Update the synthetic Chromium harness to prove:

- one account-wide scan renders all benefit-bearing fixture cards while preserving globally empty records in normalized storage;
- aggregate hidden-card and visible-surface metric assertions expose no hidden card identity;
- high-scale fixture remains reachable and bounded, with compact filter-empty groups;
- Remaining is default and Used switches globally;
- card-first selector/four-filter assumptions are removed;
- restore performs no provider reads;
- unsupported benefits remain absent;
- one synthetic card exercises all fixed conflict categories and structured candidate details through the built artifact, proves narrow native extraction from only stable hooks in the reader host/shadow tree, retains only the generic issue in storage, and loses the ephemeral category/detail display after restore-only reload;
- no network destination, grants, or mutation authority is added.

### Live validation

After automated checks pass:

1. Build a monotonic userscript version.
2. Ask for action-time authorization before installing/updating that exact version.
3. Let the user open AMEX and complete login/MFA manually.
4. Ask for action-time authorization before pressing Scan all cards.
5. Perform one read-only account-wide scan.
6. Review the in-panel normalized master list and retain only sanitized aggregate evidence.
7. Iterate through the same test/build/install/scan loop if live evidence exposes a parser or presentation defect.

Never capture or persist raw payloads, tokens, cookies, credentials, headers, full account identifiers, or broad screenshots containing account data.

## Compatibility and migration

- No database or normalized-store migration is expected.
- Existing compatible stored observations render through the new presentation after userscript update, with no conflict-path categories or structured details reconstructed from prior generic issue codes.
- Clear-data behavior and installation identity remain unchanged.
- The future synchronization child consumes the same normalized observations; this UI does not add a lossy boolean or transport-specific state.

## Rollout and rollback

- Roll out as a monotonic Tampermonkey userscript update after tests.
- If the master list is unusable, reinstall a later monotonic version restoring the previous selected-card presentation; repository revert alone does not change an installed script.
- Since storage and normalized contracts are unchanged, presentation rollback does not require data conversion.
- Stop and return to planning if implementation requires provider endpoint, permission, storage-schema, or transport expansion.
