# Research: AMEX `benefit_identity_conflict` production paths and sanitized 0.2.10 finding

- **Query**: Trace every `benefit_identity_conflict` production path in the adapter, matcher, identity/key logic, tests, and history; explain card-only conflicts; rank likely causes of the sanitized all-four-card finding; recommend a synthetic, test-first, fail-closed diagnostic/fix strategy without raw-response inspection or persistence.
- **Scope**: internal
- **Date**: 2026-07-22

## Executive finding

The observed shape is directly producible by current code and does **not** imply that a hidden benefit row must carry the same issue. The adapter maintains two separate issue channels:

1. a card-level `issues` set returned as `BenefitNormalizationResult.issueCodes`; and
2. a per-normalized-row `itemIssues` set stored on `NormalizedBenefitObservationV1.issueCodes`.

Three major production families can emit `benefit_identity_conflict` only at card level while retaining zero conflict-tagged rows: a supported-credit collision detected by `add`, a joined tracker/catalog alias disagreement, and a supported ambiguous catalog record skipped by the catalog pass. The most direct match is the `add` collision path at `amex-response-adapter.ts:427-436`: it keeps the first normalized row, adds only the global issue when a later row with the same card-scoped supported-credit key differs, and never adds the issue to the retained row.

Given all four benefit-bearing cards show the same conflict, a recurring parser/model mismatch is more likely than four unrelated valid ambiguities. The strongest repository-backed hypothesis is that one card-scoped credit key is collapsing multiple tracker/cycle observations or a tracker plus an unjoined catalog candidate. The shared catalog explicitly models several credits as multiple calendar windows, while the matcher intentionally returns only one key per card/credit and the collision comparator includes dynamic status, quantity, enrollment, and period fields. The current sanitized aggregate cannot uniquely distinguish that path from tracker/catalog alias mismatch or catalog duplication.

## Findings

### Files Found

| File Path | Description |
|---|---|
| `src/lib/amex-benefit-reader/amex-response-adapter.ts` | All four source locations that add `benefit_identity_conflict`; tracker/catalog join, supported-credit grouping, and output issue separation. |
| `src/lib/amex-benefit-reader/supported-card-credits.ts` | Exact product/title matcher and one card-scoped `creditKey` per reviewed semantic credit. |
| `src/lib/amex-benefit-reader/identity.ts` | Card identity and final normalized `benefitKey`; not the map key that triggers this conflict. |
| `src/lib/amex-benefit-reader/contract.ts` | Generic conflict issue enum, parser version, row/card schemas, and unique final `benefitKey` constraint. |
| `src/lib/amex-benefit-reader/scan-engine.ts` | Promotes adapter-level issues to card-level partial observations. |
| `src/lib/amex-benefit-reader/storage-policy.ts` | Maps the generic code to “Two benefits could not be distinguished safely.” |
| `src/userscripts/amex-benefit-reader/panel.ts` | Renders card-level and row-level issue arrays independently. |
| `src/lib/amex-benefit-reader/__tests__/amex-response-adapter.test.ts` | Existing duplicate-catalog and semantic-collision tests. |
| `src/lib/amex-benefit-reader/__tests__/supported-card-credits.test.ts` | Matcher coverage; no joined tracker/catalog mismatch or cycle-collision matrix. |
| `src/lib/amex-benefit-reader/__tests__/identity.test.ts` | Verifies benefit keys do not use list position; does not cover supported-credit grouping. |
| `tests/e2e/amex-benefit-reader/harness.ts` | Synthetic bundle fixtures; high-scale fixture gives each credit one tracker and an empty catalog, so it cannot reproduce current conflict families. |
| `src/lib/american-express-card-catalog.ts` | Static catalog contains multiple explicit period windows for several credits that map to one supported key. |
| `.trellis/tasks/archive/2026-07/07-15-amex-card-benefit-sync/amex-research.md` | Earlier redacted live history: two cards already had this conflict before 0.2.10. |
| `.trellis/tasks/archive/2026-07/07-15-amex-card-benefit-sync/design.md` | Original intent: collapse identical duplicates, never invent ordinals, and mark conflicting indistinguishable observations at card level. |
| `.trellis/tasks/archive/2026-07/07-15-amex-card-benefit-sync/prd.md` | Fail-closed benefit identity requirement and privacy boundary. |
| `.trellis/tasks/07-22-amex-pre-sync-benefit-list/design.md` | 0.2.10 task explicitly left adapter/matcher/normalized storage behavior unchanged. |
| `.trellis/tasks/07-22-amex-pre-sync-benefit-list/implement.md` | 0.2.10 was a presentation/card-quality refinement, not an identity-parser revision. |
| `.trellis/spec/perks-reminder/browser-read-integrations.md` | Current shared contracts for fail-closed filtering, normalized-only persistence, and fixed redacted issue codes. |
| `.git/logs/HEAD` | Local history anchors for initial reader, quality/matcher work, browser harness, and docs; inspected directly without running git commands. |

## Code Patterns

### 1. Identity layers are distinct

There are three different identities in play:

- **Physical-card identity**: HMAC source fingerprint plus local UUID in `identity.ts:34-57,70-112`. Its failures produce `identity_ambiguous` or `identity_conflict`, not `benefit_identity_conflict`.
- **Supported semantic credit identity**: `matchSupportedAmexCardCredit` returns a public card-scoped key such as `american-express-platinum-card:airline-fee` at `supported-card-credits.ts:203-229`. This is the key used by the adapter’s deduplication map at `amex-response-adapter.ts:427-436,482,514`.
- **Final normalized row key**: `createBenefitKey` hashes normalized title/category/activity kind at `identity.ts:114-139`; the adapter calls it at `amex-response-adapter.ts:359-365,468,515`. It is validated for uniqueness only after rows have survived supported-credit grouping (`contract.ts:99-122`).

Therefore a hash collision in `createBenefitKey`, card fingerprint reconciliation, or final schema uniqueness is not a production path to `benefit_identity_conflict`. The conflict is produced earlier by adapter logic keyed primarily by `SupportedAmexCardCreditMatch.creditKey`.

### 2. Matcher behavior that feeds the conflict paths

`matchSupportedAmexCardCredit`:

- exact-normalizes product aliases (`supported-card-credits.ts:168-191,203-209`);
- strips punctuation/markup punctuation into words but does not semantically parse HTML (`:135-145`);
- rejects explicit non-credit phrases (`:151-166,209-210`);
- matches reviewed title phrases only when the static card has a positive-amount represented benefit (`:194-225`);
- returns `null` when no title rule wins uniquely (`:223-225`); and
- returns one **card + credit** key, not one cycle or issuer-record key (`:226-229`).

Matcher ambiguity by itself is silent omission under the fail-closed policy; the matcher does not emit an issue. A `benefit_identity_conflict` appears only when the adapter has enough matched evidence to detect disagreement or a collision.

Notable rule overlap exists on Gold: `dining` accepts `dining credit`/`grubhub credit`, while `resy` accepts `resy dining credit`/`resy credit`/`resy` (`supported-card-credits.ts:25-29`). Most-specific matching resolves a single title, but tracker and joined catalog titles are resolved independently, so different wording for the same joined source can choose different keys.

### 3. Every production path

#### Path A — duplicate live catalog issuer ID becomes ambiguous

At `amex-response-adapter.ts:410-425`, catalog records are indexed by non-empty `sorBenefitId`. If a repeated ID differs in any compared field—ID, short title, title, name, layout, or enrollability (`:367-377`)—the ID is removed from the map and added to `ambiguousCatalogIds`.

This preprocessing does not immediately emit an issue. It feeds two later emission sites:

##### A1 — tracker row with ambiguous catalog ID (`:440-452`)

- Catalog enrichment is withheld (`:440-443`).
- If the tracker title still matches a supported credit, `itemIssues` gets `benefit_identity_conflict` (`:451-452`).
- With a recognized activity category, that issue is stored on the row (`:467-483`) and also promoted globally.
- With an unknown activity category, the row is dropped and both `benefit_identity_conflict` and `unknown_activity_kind` are promoted globally (`:453-456`). That cannot explain a card whose **only** reason is the identity conflict.

This path normally creates a benefit-level issue on a retained row. It can nevertheless look card-only if:

- the affected row is under the uninspected **Used** filter rather than one of the 16 inspected Remaining rows;
- the tracker title cannot match without catalog enrichment, in which case this branch is skipped and A2 emits globally;
- a prior row with the same supported key is retained and this row loses an `add` collision, making the visible result order-dependent; or
- the affected row is later absent from the current filter.

##### A2 — supported ambiguous catalog record (`:487-495`)

If a catalog title matches a supported credit and its ID is ambiguous, the adapter adds the issue only to the global set and skips the candidate. No benefit row exists to carry the issue. This exactly supports card-only conflict output.

#### Path B — joined tracker/catalog titles resolve to different supported credit keys

`supportedTrackerTitle` independently matches tracker and catalog titles (`amex-response-adapter.ts:338-348`). If both match but their `creditKey` values differ, it returns `"conflict"` (`:349`). The tracker loop adds only the global issue and skips the tracker (`:444-449`).

Because catalog-only candidate suppression checks whether any tracker has the same `sorBenefitId` (`:510-512`), the joined catalog record is normally skipped as already joined even though the tracker row was discarded for alias disagreement. Result: one card-level conflict, no issue-bearing benefit row from that joined pair.

There is no direct unit test for this production branch.

#### Path C — two normalized observations map to one supported credit but differ

The adapter’s `normalized` map is keyed by card-scoped supported credit (`amex-response-adapter.ts:427-436`). The first row wins. A later row with the same key is compared through `sameSupportedCreditObservation` (`:379-400`). If different, only the global issue is added (`:435`); neither the retained first row nor the discarded later row receives a new row issue.

The comparison includes:

- category;
- activity kind;
- enrollment/tracker/completion state;
- current, target, and remaining quantities;
- period;
- confidence; and
- the row’s existing issue-code array.

It deliberately excludes title and final `benefitKey` (`:379-392`). Thus title variants with identical state collapse silently, while any dynamic state/period/amount difference conflicts.

Inputs that reach Path C include:

1. two tracker rows in the same or different tracker blocks that map to one supported credit (`:438-485`);
2. one tracker row plus one unjoined `NOTENROLLED && isEnrollable=true` catalog candidate mapping to the same credit (`:487-528`);
3. multiple source IDs or aliases for one semantic credit;
4. repeated tracker observations for different cycles/statuses of the same credit;
5. an issue-bearing row colliding with an otherwise identical clean row, because `confidence` and `issueCodes` are compared.

The existing test at `amex-response-adapter.test.ts:429-437` proves this exact card-only shape: two Adobe tracker records have different amounts, output has one benefit, the card result contains `benefit_identity_conflict`, and no ordinal is invented. The test does not assert row-level issue codes, but the retained first row has none by construction.

Two catalog-only enrollment candidates mapping to one key usually do **not** conflict because their state is constructed identically and title/key are excluded from comparison; they silently collapse. A tracker plus catalog candidate generally does conflict because activity/enrollment/tracker state differs.

#### Path D — supported ambiguous catalog record in the catalog pass

This is the line-494 emission already described as A2, but it is operationally a separate card-only production site. Any supported live catalog record whose `sorBenefitId` was marked ambiguous is skipped with a global issue at `amex-response-adapter.ts:492-495`. No row-level issue is created.

### 4. Card-level versus row-level propagation

- Adapter result separates `benefits` and global `issueCodes` (`amex-response-adapter.ts:37-40,531`).
- Scan engine copies all adapter global codes into the card observation and marks the card partial whenever any exists (`scan-engine.ts:246-268`).
- The panel shows card issues from `record.latest.issueCodes` in card-level “Data quality and timestamps” (`panel.ts:434-450`).
- A row shows notes only from `benefit.issueCodes` (`panel.ts:380-385`).

Consequently, “all four card quality reasons contain the conflict” plus “zero of 16 Remaining rows contain it” is internally consistent.

Important limitation of the sanitized observation: only the 16 Remaining row details were checked. The 12 Used rows also exist, so the evidence does not prove that **all 28** rows have empty conflict arrays. That distinction matters most for Path A1.

### 5. Static catalog/cycle evidence

The static catalog represents several source benefits as multiple explicit calendar windows:

- Gold Resy Jan–Jun and Jul–Dec (`american-express-card-catalog.ts:54-73`);
- Platinum Saks Jan–Jun and Jul–Dec (`:110-129`);
- Platinum Resy Q1–Q4 (`:130-170`);
- Platinum Lululemon Q1–Q4 (`:171-210`);
- Platinum hotel Jan–Jun and Jul–Dec (`:211-230`);
- Business Platinum hotel Jan–Jun and Jul–Dec (`:285-304`);
- Aspire resort Jan–Jun and Jul–Dec (`:420-439`).

The matcher uses one semantic key for each merchant/credit family (`supported-card-credits.ts:20-125`) and checks only that at least one matching positive catalog benefit exists (`:194-200`). It carries no catalog cadence/window identity into normalization. Meanwhile, archived research states that trackers may expose cycle wording (`.trellis/tasks/archive/2026-07/07-15-amex-card-benefit-sync/amex-research.md:28-35`), and the adapter includes period in the equality comparison.

This is strong structural evidence that multiple period-specific source observations can legitimately map to one supported key and then look “materially different” to Path C.

### 6. Test coverage and gaps

Covered:

- equivalent same-key tracker wording deduplicates without conflict (`amex-response-adapter.test.ts:209-225`);
- duplicate live catalog rows with one repeated issuer ID prevent enrichment and produce a global conflict (`:408-427`);
- different same-key tracker amounts produce one retained row plus global conflict and no ordinal (`:429-437`);
- exact matcher aliases, non-credit exclusions, card representation, and unknown products (`supported-card-credits.test.ts:7-77`);
- final benefit key is stable and has no list position (`identity.test.ts:68-71`).

Not covered:

- tracker title and joined catalog title resolving to different credit keys;
- explicit assertions of card-level versus row-level conflict placement for every path;
- a supported ambiguous catalog record with no retained tracker row;
- two tracker blocks containing the same credit;
- same credit across explicit different periods/cycles/statuses;
- tracker plus unjoined catalog candidate collision;
- collision order invariance;
- clean/issue-bearing duplicate order and which row survives;
- repeated live catalog IDs that differ only in aliases but normalize to the same supported key and same enrollment semantics;
- multiple live catalog IDs mapping to one supported key;
- a bundle-level conflict scenario.

The high-scale E2E fixture creates one tracker per credit key and empty catalogs (`tests/e2e/amex-benefit-reader/harness.ts:224-265`), so its 16-card/130-observation predecessor does not stress identity collision behavior.

## Ranked hypotheses for the sanitized all-four-card finding

### 1. Multiple tracker/cycle observations collapsed into one semantic credit key — high evidence

Why it fits:

- Path C produces exactly a card-only issue while retaining the first row.
- The collision comparison includes status, quantities, and period, so current versus completed, one cycle versus another, or otherwise distinct tracker snapshots conflict.
- The matcher key has card + credit but no cycle identity.
- The static catalog explicitly has many multi-window credits, and archived research says tracker period/cycle wording is exposed.
- A systemic issue on every benefit-bearing card is more consistent with a repeated modeling rule than four unrelated malformed records.

Variants include two tracker rows for one source credit and a tracker row colliding with an unjoined catalog enrollment candidate.

What remains unknown: no raw titles, source IDs, periods, amounts, product names, or per-path counters were retained, so the exact variant is not provable.

### 2. Joined tracker/catalog alias mismatch — medium-high evidence

Why it fits:

- Path B is always card-only for the mismatched joined pair.
- Tracker and catalog titles are matched independently, and the source join ID is used only to find enrichment, not to force one semantic mapping.
- Gold has a concrete overlap between dining and Resy vocabularies.
- If the four visible cards are repeated physical cards of one product, one taxonomy mismatch would repeat on all four.

Why below #1: the finding retained no product-group information, and broad cross-key overlap is not obvious across all supported card families.

### 3. Live catalog duplication or catalog-only candidate collision — medium evidence

Why it fits:

- Repeated `sorBenefitId` records are considered conflicting when any title/layout/enrollment field differs, before semantic projection.
- A supported ambiguous catalog record emits card-only at line 494.
- A different-ID catalog enrollment candidate can collide with a tracker of the same supported credit at line 435.
- Catalog surfaces can contain browse/enrollment records distinct from tracker activity records by design.

Why below #2: existing sanitized evidence does not say whether catalog reads succeeded for all four or whether affected rows are enrollment candidates.

### 4. Valid unresolved ambiguity between two genuinely distinct benefits sharing one reviewed credit key — medium-low evidence

This is possible and is the reason the current fail-closed behavior exists. Examples could include two independently usable credits whose titles both match one broad merchant rule. However, all four benefit-bearing cards showing the same issue makes a systematic granularity mismatch more plausible than four independent exceptional ambiguities. A cycle-specific pair is “validly distinct” at source level but still indicates the current one-key-per-credit model is too coarse for the desired list/sync use.

### 5. Ambiguous same-ID catalog join with a retained row — low for a wholly card-only result

A retained supported tracker normally receives a benefit-level issue at line 452. It remains possible if the affected row is one of the 12 uninspected Used rows, if catalog title matching supplies the only supported title, or if collision order retains a clean row instead.

### 6. Benefit-key hash collision, physical-card identity, or the mid-title footnote itself — very low / not a direct path

- Final `benefitKey` is not the supported-credit map key and cannot emit this issue.
- Card reconciliation emits different issue codes.
- Mid-title markup-like text can affect phrase adjacency in the matcher, but matcher non-match is a silent omission; it becomes this issue only through a separate joined-key disagreement or collision. The presentation defect is analyzed separately.

## Relevant history

### Task and repository history

- Initial reader commit: `.git/logs/HEAD:108` (`21043fb…`, “feat: add local Amex benefit reader”).
- Quality/matcher-era commit: `.git/logs/HEAD:109` (`1c7716e…`, “feat: improve Amex benefit reader quality”).
- Browser harness and contract docs followed at `.git/logs/HEAD:110-115`.
- Site-wide mount changes at `.git/logs/HEAD:116-120` did not describe parser identity changes.
- Original requirements explicitly said to deduplicate browse/activity observations, avoid invented ordinal identities, and mark conflicting indistinguishable benefits incomplete (`archive/.../prd.md:70-80`; `design.md:271-274,294-300`).
- The archived 2026-07-15/17 redacted runs already recorded two cards with `benefit_identity_conflict` (`amex-research.md:81-88,121-127`; `handoff.md:59-65`). This proves the behavior predates installed 0.2.10.
- The active 0.2.10 design explicitly kept the scan engine, normalized contract, storage policy, and exact-card matcher unchanged (`.trellis/tasks/07-22-amex-pre-sync-benefit-list/design.md:3-31`). Its final refinement changed card-level presentation/title formatting and bumped 0.2.9 to 0.2.10 (`implement.md:116-126`).

Interpretation: 0.2.10 made card-level quality easier to inspect but did not create these conflict paths. The increase from two historically reported conflict cards to all four currently benefit-bearing cards can reflect changed provider observations, the narrower supported-credit projection making only four cards visible, or a repeated issue on a product group; current sanitized data cannot choose among them.

## Recommended test-first diagnostic and implementation plan

### Safety constraints to preserve

- Do not add raw-response, raw-title, raw-ID, amount, ending-digit, or account-token logging/export/persistence.
- Keep unknown and contradictory observations partial/fail-closed.
- Do not resolve with source-list position or invented ordinals.
- Do not broaden product/title matching globally to suppress the warning.
- Keep issuer IDs scan-local; current E2E tests already assert `sorBenefitId` is absent from serialized storage (`tests/e2e/amex-benefit-reader/amex-benefit-reader.spec.ts:66,159`).
- Keep the existing public `benefit_identity_conflict` until every unresolved collision remains represented by that generic code.

### Phase 1 — lock down every current path with invented fixtures

Add table-driven adapter tests before behavior changes:

1. **Tracker collision**: same key/equal state; same key/different amount; different period; ACTIVE versus ACHIEVED; same and different `sorBenefitId`; same and separate tracker blocks.
2. **Joined alias mismatch**: tracker and catalog share an invented ID but resolve to two public fixture credit keys.
3. **Ambiguous catalog ID**: retained tracker-title match, tracker-title miss/catalog-title match, same semantic title with different raw title fields, and conflicting layout/enrollment.
4. **Catalog candidate collision**: tracker plus same-key candidate with same ID (already suppressed), different ID (current conflict), and two candidate aliases.
5. **Order reversal**: reverse every duplicate pair and assert the result is either identical or explicitly quarantined; current first-wins behavior is order-dependent.
6. **Issue locality**: assert card issue arrays and every row issue array separately, including a Used row case.
7. **Bundle path**: one generated-bundle synthetic card should reproduce card-only conflict and prove storage still contains only normalized fields/generic issue codes.

These tests can reproduce all symptom-compatible paths without accessing a browser or retaining provider data.

### Phase 2 — add a fixed-enum internal classifier, not raw diagnostics

Refactor conflict creation behind a pure internal result such as:

- `tracker_state_collision`;
- `tracker_catalog_key_mismatch`;
- `ambiguous_catalog_join`;
- `tracker_catalog_candidate_collision`.

The classifier should contain only fixed enum values and counts. It must not contain product names, titles, source IDs, quantities, periods, card endings, or raw values. Production persistence can continue storing only the generic `benefit_identity_conflict` code.

For synthetic diagnosis, unit tests assert which enum path fires. If future owner-authorized runtime confirmation is required, the least-data option is an opt-in, ephemeral account-level count by fixed enum that is never written to GM storage, console, network, screenshots, or task artifacts and disappears on reload. That is safer than inspecting payloads. It is not necessary for the initial synthetic test matrix.

### Phase 3 — replace first-wins mutation with deterministic bucket resolution

Collect candidates by supported credit key first, then resolve each bucket. This removes source-order dependence.

Safe resolver rules:

1. Collapse exact semantic duplicates.
2. Merge only **complementary** fields under explicit rules: same observed values agree; observed may enrich `not_exposed`; contradictory observed values remain a conflict; unrecognized evidence retains its issue.
3. Treat repeated catalog records with the same issuer join ID as equivalent only when their projected supported key and normalized enrollment semantics agree. Differences in unused title fields alone should not automatically create ambiguity; differing supported keys, layouts with different semantics, or enrollability remain conflicts.
4. Keep joined tracker/catalog key disagreement quarantined until an exact reviewed alias-pair test proves which public credit key is correct. Fix only that exact pair; do not add fuzzy matching.
5. For multiple period/status observations of one credit, do **not** choose “latest,” “completed,” first, or last without characterized semantics. Either:
   - retain the generic conflict and omit/quarantine that key; or
   - distinguish rows only after the normalized/sync model gains an explicit, reviewed cycle identity based on approved stable evidence.

If a bucket cannot be resolved by these rules, the most fail-closed output is to omit/quarantine the ambiguous key and keep the card-level conflict, rather than retain whichever candidate happened to arrive first.

### Phase 4 — cycle-aware fix only if synthetic classifier confirms it

The repository’s static catalog proves cycle granularity exists, but the current normalized benefit identity does not model it. If the dominant synthetic/live-safe reason is multiple period observations:

1. Define the intended output first: one reusable benefit with current-cycle state versus multiple explicit benefit-cycle observations.
2. Add invented tests for monthly, quarterly, semiannual, completed-prior/current-active, absent period, equal period, and conflicting period.
3. Use only an explicit normalized cycle field or a reviewed stable transient join discriminator. Do not use list position or infer cadence from title text.
4. If period is absent/unknown or two candidates claim the same cycle with contradictory state, retain `benefit_identity_conflict`.
5. Bump parser version for changed normalization behavior; change storage schema only if the persisted shape changes.

### Phase 5 — verification

Run targeted adapter/matcher/identity/storage/panel tests, then the generated-bundle E2E with deny-by-default synthetic routing. Assert:

- no raw identifiers in normalized output or GM storage;
- unresolved conflicts remain partial;
- resolved equivalents are order-independent;
- no extra provider operation, grant, destination, or mutation authority;
- card-level and row-level issue placement is intentional;
- existing unknown-card and ambiguous-title fail-closed behavior remains unchanged.

## External References

None. The relevant provider APIs are private/undocumented, and this task explicitly excluded browser/raw-data access. Repository contracts and redacted archived evidence are the authoritative sources used here.

## Related Specs

- `.trellis/spec/perks-reminder/browser-read-integrations.md:104-125` — bounded raw lifetime, normalized-only persistence, conservative identity, fail-closed matching, and fixed redacted quality behavior.
- `.trellis/spec/perks-reminder/browser-read-integrations.md:127-162` — validation/error matrix for partial observations, unknowns, title matching, and compatible storage.
- `.trellis/spec/perks-reminder/browser-read-integrations.md:179-205` — required synthetic coverage, including conflicting observations and no raw identifiers.

## Caveats / Not Found

- No raw response, raw title, amount, product name, source ID, or card ending was accessed or reconstructed.
- No browser, userscript installation, scan, network operation, production command, commit, or push was performed.
- The 16 inspected rows were only the Remaining filter; the 12 Used row details were not reported as inspected, so a row-level Path A1 issue cannot be fully excluded.
- Current generic persisted issue codes do not identify which production site fired. Exact attribution is impossible from the sanitized aggregate alone.
- Git commands were not run under the research boundary. Commit sequencing was taken from the local HEAD reflog plus task history; no commit diff was inspected.
