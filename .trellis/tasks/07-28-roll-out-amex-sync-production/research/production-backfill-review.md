# Sanitized production AMEX catalog backfill review

## Decision summary

**Recommendation: a separately authorized strict partial apply is supportable, with a zero-status-materialization stop condition.**

The accepted rollout policy is deliberately narrower than catalog repair:

- Apply only the 7,076 exact canonical full-shape benefit proposals and 1,126 deterministic card proposals. Of the benefit proposals, 6,788 have writable `usage` semantics and 288 have non-writable `spend` semantics.
- Never widen matching or normalize shape drift. Leave all 2,739 conflicts unkeyed and unwritable, including the 2,310 writable-semantics conflicts and 40 safely unattributed rows.
- A read-only projection at one controlled 2026-07-29 UTC reference instant reproduced the user classifier totals and projected one status row for each of the 6,759 proposed user-owned writable benefits. All 6,759 projected unique rows already exist, so the exact missing/materialized projection is **zero**.
- The projection found no materializer warning, 24-row cap issue, duplicate desired key, or existing cycle-end mismatch. It did identify 22 Business Platinum Hilton rows whose existing calendar-quarter start month is not congruent with the card-opened month despite the canonical `card-anniversary-quarter` key. No status would be created or changed; transaction-time period equality remains fail closed. Treat this as an explicit preview/skip monitoring condition, not permission to alter the row or matching policy.

This evidence removes the unknown-volume blocker for a strict partial apply. It does not authorize the production write by itself. Immediately before a separately approved apply, reverify the target and rerun the same projection; require zero missing statuses. Apply in bounded batches, stop if the operator reports any materialized status or runtime conflict, then require a complete zero-proposal dry-run with all 2,739 conflicts preserved. Production synchronization remains effectively `off` until that apply and the later preview configuration boundary are separately completed.

## Scope, method, and privacy boundary

- Regenerated on 2026-07-29 using an equivalent read-only aggregation of the production backfill classifier.
- Used the reviewed production application and direct URL roles from an isolated temporary provider link. URL values and database-side identity were verified in process and were not emitted.
- Queried in one `RepeatableRead` transaction after setting the transaction read-only.
- Used a page limit of 250 and continued both independent cursors until both streams reported no remaining page.
- Re-ran the exact user classifier and the existing `materializeBenefitStatusRows` projection at one controlled 2026-07-29 UTC reference instant. Existing-row comparison used the writer's `skipDuplicates` uniqueness semantics: benefit, owner, exact projected cycle start, and occurrence index. Cycle end was independently compared for diagnostics.
- Produced only aggregate dimensions derived from public catalog product keys, canonical family/period keys, source-semantics classes, closed conflict reasons, shape-field names, and status-count distributions.
- No database/project identity, connection value, user/card/benefit/status ID, email, card ending, account value, row value, transfer token, or proposal token is included.
- User benefit descriptions were never emitted. A conflict was associated with a canonical family only when its description exactly matched one unique public canonical description for that product. The 40 rows without that proof remain an unresolved aggregate.
- The permission-restricted environment, temporary scripts, and intermediate working files were removed after producing and validating the sanitized aggregation. The temporary sanitized JSON used to author this report was also removed after validation.
- No apply, mutation, environment change, deployment, browser action, live AMEX call, or mode change occurred.

## Complete-run totals and arithmetic

| Scope | Pages completed | Cards examined | Cards proposed | Benefits examined | Benefits proposed | Conflicts | Applied cards | Applied benefits | Materialized statuses |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Predefined | Included in shared 5-page traversal | 12 | 12 | 56 | 32 | 24 | 0 | 0 | 0 |
| User | Included in shared 5-page traversal | 1,114 | 1,114 | 9,759 | 7,044 | 2,715 | 0 | 0 | 0 |
| **Total** | **5** | **1,126** | **1,126** | **9,815** | **7,076** | **2,739** | **0** | **0** | **0** |

Arithmetic reconciliation:

- Cards: `12 + 1,114 = 1,126` examined and proposed.
- Benefits examined: `56 + 9,759 = 9,815`.
- Benefits: `32 + 7,044 = 7,076` proposed.
- Conflicts: `24 + 2,715 = 2,739`.
- Every examined benefit is accounted for: `7,076 proposals + 2,739 conflicts = 9,815 examined`.
- Both final continuation flags were false.
- Runtime conflicts were zero because this was read-only; no writer was called.

All 1,126 proposed cards currently have a null card `productKey`. All 7,076 proposed benefits currently have null `productKey`, `creditFamilyKey`, and `periodKey`; no partially keyed proposal was observed. No exact canonical row in this bounded population was already fully keyed.

## Product-level reconciliation

| Scope | Product key | Cards examined/proposed | Benefits examined | Benefits proposed | Conflicts |
|---|---|---:|---:|---:|---:|
| Predefined | `american-express-business-gold-card` | 1 / 1 | 2 | 0 | 2 |
| Predefined | `american-express-business-platinum-card` | 1 / 1 | 10 | 9 | 1 |
| Predefined | `american-express-gold-card` | 1 / 1 | 5 | 2 | 3 |
| Predefined | `american-express-platinum-card` | 1 / 1 | 19 | 16 | 3 |
| Predefined | `delta-skymiles-gold-american-express-card` | 1 / 1 | 2 | 0 | 2 |
| Predefined | `delta-skymiles-platinum-american-express-card` | 1 / 1 | 3 | 0 | 3 |
| Predefined | `delta-skymiles-reserve-american-express-card` | 1 / 1 | 3 | 0 | 3 |
| Predefined | `hilton-honors-american-express-aspire-card` | 1 / 1 | 5 | 4 | 1 |
| Predefined | `hilton-honors-american-express-business-card` | 1 / 1 | 1 | 0 | 1 |
| Predefined | `hilton-honors-american-express-surpass-card` | 1 / 1 | 1 | 1 | 0 |
| Predefined | `marriott-bonvoy-brilliant-american-express-card` | 1 / 1 | 2 | 0 | 2 |
| Predefined | `marriott-bonvoy-business-american-express-card` | 1 / 1 | 3 | 0 | 3 |
| User | `american-express-business-gold-card` | 38 / 38 | 76 | 0 | 76 |
| User | `american-express-business-platinum-card` | 95 / 95 | 950 | 855 | 95 |
| User | `american-express-gold-card` | 203 / 203 | 1,015 | 406 | 609 |
| User | `american-express-platinum-card` | 322 / 322 | 6,118 | 5,152 | 966 |
| User | `delta-skymiles-gold-american-express-card` | 41 / 41 | 82 | 0 | 82 |
| User | `delta-skymiles-platinum-american-express-card` | 11 / 11 | 33 | 0 | 33 |
| User | `delta-skymiles-reserve-american-express-card` | 13 / 13 | 39 | 0 | 39 |
| User | `hilton-honors-american-express-aspire-card` | 242 / 242 | 1,210 | 600 | 610 |
| User | `hilton-honors-american-express-business-card` | 4 / 4 | 4 | 0 | 4 |
| User | `hilton-honors-american-express-surpass-card` | 71 / 71 | 71 | 31 | 40 |
| User | `marriott-bonvoy-brilliant-american-express-card` | 61 / 61 | 122 | 0 | 122 |
| User | `marriott-bonvoy-business-american-express-card` | 13 / 13 | 39 | 0 | 39 |

The table shows that an apply would assign card-level product identity even for products whose benefits all remain conflicted. That behavior is additive and fail-closed at the benefit boundary, but it is partial catalog preparation rather than complete readiness.

## Proposal semantics

| Scope | Writable `usage` | Non-writable `spend` | Certificate | Status/access | Total |
|---|---:|---:|---:|---:|---:|
| Predefined | 29 | 3 | 0 | 0 | 32 |
| User | 6,759 | 285 | 0 | 0 | 7,044 |
| **Total** | **6,788** | **288** | **0** | **0** | **7,076** |

`spend` rows are expected catalog identities but do not acquire AMEX write authority. The operator's status-materialization writer is limited to user rows whose tuple belongs to the writable destination registry, so these 288 `spend` proposals do not authorize status writes.

The 6,759 user `usage` proposals are the population for which apply invokes missing-status materialization. The separate read-only projection below proves that every desired uniqueness tuple already exists at the controlled reference instant, so apply is projected to create zero status rows.

## Exact status-materialization projection

### Totals and per-benefit distribution

| Measure | Exact count |
|---|---:|
| Proposed user-owned writable benefits | 6,759 |
| Status rows the writer would project | 6,759 |
| Projected rows already present by writer uniqueness | 6,759 |
| Missing rows / projected `createMany` inserts | **0** |
| Benefits projecting 1 row | 6,759 |
| Benefits projecting more than 1 row | 0 |
| Maximum projected rows for one benefit | 1 |
| Materializer warnings | 0 |
| Benefits exceeding the 24-row cap | 0 |
| Duplicate desired status keys | 0 |
| Existing rows with a different cycle end | 0 |

Arithmetic: `6,759 projected = 6,759 existing + 0 missing`. Every benefit has the same distribution: one projected row, one existing row, and zero missing rows. The 24-row safeguard therefore has 23 rows of headroom for every proposed benefit, and no truncation occurs.

### Product, family, and period breakdown

| Product key | Family | Period | Benefits / projected | Existing | Missing |
|---|---|---|---:|---:|---:|
| `american-express-business-platinum-card` | `american-express-business-platinum-card:airline-fee` | `calendar-year` | 95 | 95 | 0 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:dell` | `calendar-year` | 95 | 95 | 0 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:hilton` | `card-anniversary-quarter` | 95 | 95 | 0 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:hotel` | `calendar-half-h1` | 95 | 95 | 0 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:hotel` | `calendar-half-h2` | 95 | 95 | 0 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:indeed` | `calendar-quarter` | 95 | 95 | 0 |
| `american-express-gold-card` | `american-express-gold-card:resy` | `calendar-half-h1` | 203 | 203 | 0 |
| `american-express-gold-card` | `american-express-gold-card:resy` | `calendar-half-h2` | 203 | 203 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:airline-fee` | `calendar-year` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:hotel` | `calendar-half-h1` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:hotel` | `calendar-half-h2` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:lululemon` | `calendar-quarter-q1` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:lululemon` | `calendar-quarter-q2` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:lululemon` | `calendar-quarter-q3` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:lululemon` | `calendar-quarter-q4` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:oura` | `calendar-year` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:resy` | `calendar-quarter-q1` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:resy` | `calendar-quarter-q2` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:resy` | `calendar-quarter-q3` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:resy` | `calendar-quarter-q4` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:saks` | `calendar-half-h1` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:saks` | `calendar-half-h2` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:uber-cash-december-bonus` | `calendar-month-december` | 322 | 322 | 0 |
| `american-express-platinum-card` | `american-express-platinum-card:uber-one` | `calendar-year` | 322 | 322 | 0 |
| `hilton-honors-american-express-aspire-card` | `hilton-honors-american-express-aspire-card:clear-plus` | `calendar-year` | 144 | 144 | 0 |
| `hilton-honors-american-express-aspire-card` | `hilton-honors-american-express-aspire-card:flight` | `calendar-quarter` | 144 | 144 | 0 |
| `hilton-honors-american-express-aspire-card` | `hilton-honors-american-express-aspire-card:hilton-resort` | `calendar-half-h1` | 156 | 156 | 0 |
| `hilton-honors-american-express-aspire-card` | `hilton-honors-american-express-aspire-card:hilton-resort` | `calendar-half-h2` | 156 | 156 | 0 |
| `hilton-honors-american-express-surpass-card` | `hilton-honors-american-express-surpass-card:hilton` | `calendar-quarter` | 31 | 31 | 0 |
| **Total** |  |  | **6,759** | **6,759** | **0** |

### Cycle diagnostics

All fixed calendar families projected the expected canonical cycle, and every projected cycle exactly matched the end instant of its existing uniqueness collision. The materializer emitted no warning.

One bounded diagnostic remains: 22 of the 95 Business Platinum Hilton `card-anniversary-quarter` rows use the same existing three-month calendar-quarter cycle that the current writer projects, but that cycle's start month is not congruent modulo three with the corresponding card-opened month. The other 73 are congruent; no card is missing its opening-date anchor. This diagnostic exposes no date or account history, changes no projection count, and causes no status insert. Do not repair, normalize, or remap it in this rollout. During preview, require exact transaction-authorized period equality and monitor this family for fail-closed period skips or unexpected proposals.

### Bounded apply and stop recommendation

- Immediately before apply, repeat target verification, the complete classifier, and this status projection at the intended apply reference instant. Require the same proposal/conflict arithmetic and exactly zero missing statuses.
- Use at most 100 cards per independent cursor stream per invocation. Review the private cursor and sanitized report after each invocation before continuing.
- Expected per invocation: key-only null fills and `statusesMaterialized = 0`. Stop the entire operation if any status is materialized, any runtime compare-and-set conflict occurs, any non-null key conflict is encountered, the 2,739 retained-conflict population changes unexpectedly, or pagination/arithmetic fails.
- After all bounded pages, run a complete dry-run. Require zero card and benefit proposals, zero runtime conflicts, and all 2,739 classified conflicts still present and untouched.
- Keep server mode effectively `off` throughout apply. Preview configuration and deployment are a later, separately reviewed boundary.

## Benefit proposal counts by canonical family and period

All entries below are exact full-shape matches. `usage` is writable source semantics; `spend` is catalog identity only and remains unwritable.

| Product key | Family | Period | Semantics | Predefined | User | Total |
|---|---|---|---|---:|---:|---:|
| `american-express-business-platinum-card` | `american-express-business-platinum-card:adobe` | `calendar-year` | spend | 1 | 95 | 96 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:airline-fee` | `calendar-year` | usage | 1 | 95 | 96 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:amex-travel-flight` | `calendar-year` | spend | 1 | 95 | 96 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:dell` | `calendar-year` | usage | 1 | 95 | 96 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:hilton` | `card-anniversary-quarter` | usage | 1 | 95 | 96 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:hotel` | `calendar-half-h1` | usage | 1 | 95 | 96 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:hotel` | `calendar-half-h2` | usage | 1 | 95 | 96 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:indeed` | `calendar-quarter` | usage | 1 | 95 | 96 |
| `american-express-business-platinum-card` | `american-express-business-platinum-card:one-ap` | `calendar-year` | spend | 1 | 95 | 96 |
| `american-express-gold-card` | `american-express-gold-card:resy` | `calendar-half-h1` | usage | 1 | 203 | 204 |
| `american-express-gold-card` | `american-express-gold-card:resy` | `calendar-half-h2` | usage | 1 | 203 | 204 |
| `american-express-platinum-card` | `american-express-platinum-card:airline-fee` | `calendar-year` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:hotel` | `calendar-half-h1` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:hotel` | `calendar-half-h2` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:lululemon` | `calendar-quarter-q1` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:lululemon` | `calendar-quarter-q2` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:lululemon` | `calendar-quarter-q3` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:lululemon` | `calendar-quarter-q4` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:oura` | `calendar-year` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:resy` | `calendar-quarter-q1` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:resy` | `calendar-quarter-q2` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:resy` | `calendar-quarter-q3` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:resy` | `calendar-quarter-q4` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:saks` | `calendar-half-h1` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:saks` | `calendar-half-h2` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:uber-cash-december-bonus` | `calendar-month-december` | usage | 1 | 322 | 323 |
| `american-express-platinum-card` | `american-express-platinum-card:uber-one` | `calendar-year` | usage | 1 | 322 | 323 |
| `hilton-honors-american-express-aspire-card` | `hilton-honors-american-express-aspire-card:clear-plus` | `calendar-year` | usage | 1 | 144 | 145 |
| `hilton-honors-american-express-aspire-card` | `hilton-honors-american-express-aspire-card:flight` | `calendar-quarter` | usage | 1 | 144 | 145 |
| `hilton-honors-american-express-aspire-card` | `hilton-honors-american-express-aspire-card:hilton-resort` | `calendar-half-h1` | usage | 1 | 156 | 157 |
| `hilton-honors-american-express-aspire-card` | `hilton-honors-american-express-aspire-card:hilton-resort` | `calendar-half-h2` | usage | 1 | 156 | 157 |
| `hilton-honors-american-express-surpass-card` | `hilton-honors-american-express-surpass-card:hilton` | `calendar-quarter` | usage | 1 | 31 | 32 |

## Conflict classification

All 2,739 operator conflicts use the closed reason `benefit_template_missing`, but that reason alone is not enough to decide safety.

| Classification | Predefined usage | Predefined non-writable | User usage | User non-writable | Unresolved | Total |
|---|---:|---:|---:|---:|---:|---:|
| One unique canonical description, other shape drift | 18 | 6 | 2,292 | 383 | 0 | 2,699 |
| No safe unique canonical attribution | 0 | 0 | 0 | 0 | 40 | 40 |
| **Total** | **18** | **6** | **2,292** | **383** | **40** | **2,739** |

Non-writable conflict semantics break down as 42 `spend`, 319 certificate, and 28 status/access rows. They remain unwritable, but their mismatch is still suspicious catalog drift rather than proof that the conflict is expected or safe. Source semantics controls AMEX write authority; it does not turn a shape mismatch into a valid identity match.

### Shape-field mismatch totals

These counts overlap when one conflict differs in multiple fields:

| Shape field present in conflict | Count |
|---|---:|
| `cycleAlignment` | 2,527 |
| `category` | 549 |
| `fixedCycleStartMonth` | 196 |
| `fixedCycleDurationMonths` | 196 |
| Unattributed without exposing description text | 40 |

Exact disjoint mismatch sets reconcile to 2,739:

| Mismatch set | Count |
|---|---:|
| `cycleAlignment` | 2,126 |
| `category + cycleAlignment` | 205 |
| `category` | 172 |
| `category + cycleAlignment + fixedCycleStartMonth + fixedCycleDurationMonths` | 172 |
| `cycleAlignment + fixedCycleStartMonth + fixedCycleDurationMonths` | 24 |
| Unattributed | 40 |
| **Total** | **2,739** |

### Canonically attributable conflicts by family

No private description is shown. Each family below was assigned only through one unique exact match to its public canonical description.

| Canonical family / period | Semantics | Mismatch field set(s) | Predefined | User | Total |
|---|---|---|---:|---:|---:|
| `american-express-business-gold-card:flexible-business` / `calendar-month` | usage | `cycleAlignment` | 1 | 38 | 39 |
| `american-express-business-gold-card:walmart-plus` / `calendar-month` | usage | `cycleAlignment` | 1 | 38 | 39 |
| `american-express-business-platinum-card:wireless` / `calendar-month` | usage | `cycleAlignment` | 1 | 95 | 96 |
| `american-express-gold-card:dining` / `calendar-month` | usage | `cycleAlignment` | 1 | 203 | 204 |
| `american-express-gold-card:dunkin` / `calendar-month` | usage | `cycleAlignment` | 1 | 203 | 204 |
| `american-express-gold-card:uber-cash` / `calendar-month` | usage | `cycleAlignment`; some also `category` | 1 | 203 | 204 |
| `american-express-platinum-card:digital-entertainment` / `calendar-month` | usage | `cycleAlignment` | 1 | 322 | 323 |
| `american-express-platinum-card:uber-cash` / `calendar-month` | usage | `cycleAlignment` | 1 | 322 | 323 |
| `american-express-platinum-card:walmart-plus` / `calendar-month` | usage | `cycleAlignment` | 1 | 322 | 323 |
| `delta-skymiles-gold-american-express-card:delta-flight` / `card-anniversary-year` | spend | `cycleAlignment`; some also `category` | 1 | 41 | 42 |
| `delta-skymiles-gold-american-express-card:delta-stays` / `card-anniversary-year` | usage | `cycleAlignment`; some also `category` | 1 | 41 | 42 |
| `delta-skymiles-platinum-american-express-card:delta-stays` / `card-anniversary-year` | usage | `cycleAlignment`; some also `category` | 1 | 11 | 12 |
| `delta-skymiles-platinum-american-express-card:resy` / `calendar-month` | usage | `cycleAlignment` | 1 | 11 | 12 |
| `delta-skymiles-platinum-american-express-card:rideshare` / `calendar-month` | usage | `cycleAlignment`; some also `category` | 1 | 11 | 12 |
| `delta-skymiles-reserve-american-express-card:delta-stays` / `card-anniversary-year` | usage | `cycleAlignment`; some also `category` | 1 | 13 | 14 |
| `delta-skymiles-reserve-american-express-card:resy` / `calendar-month` | usage | `cycleAlignment` | 1 | 13 | 14 |
| `delta-skymiles-reserve-american-express-card:rideshare` / `calendar-month` | usage | `cycleAlignment`; some also `category` | 1 | 13 | 14 |
| `hilton-honors-american-express-aspire-card:clear-plus` / `calendar-year` | usage | `cycleAlignment`, start/duration; some also `category` | 0 | 98 | 98 |
| `hilton-honors-american-express-aspire-card:flight` / `calendar-quarter` | usage | `cycleAlignment`, start/duration; some also `category` | 0 | 98 | 98 |
| `hilton-honors-american-express-aspire-card:free-night` / `card-anniversary-year` | certificate | `cycleAlignment`; some also `category` | 1 | 242 | 243 |
| `hilton-honors-american-express-aspire-card:hilton-resort` / `calendar-half-h1` | usage | `category` | 0 | 86 | 86 |
| `hilton-honors-american-express-aspire-card:hilton-resort` / `calendar-half-h2` | usage | `category` | 0 | 86 | 86 |
| `hilton-honors-american-express-business-card:hilton` / `card-anniversary-quarter` | usage | `cycleAlignment` | 1 | 4 | 5 |
| `marriott-bonvoy-brilliant-american-express-card:dining` / `calendar-month` | usage | `cycleAlignment` | 1 | 61 | 62 |
| `marriott-bonvoy-brilliant-american-express-card:free-night` / `card-anniversary-year` | certificate | `cycleAlignment`; some also `category` | 1 | 61 | 62 |
| `marriott-bonvoy-business-american-express-card:elite-night-credits` / `card-anniversary-year` | status/access | `cycleAlignment` | 1 | 13 | 14 |
| `marriott-bonvoy-business-american-express-card:free-night` / `card-anniversary-year` | certificate | `cycleAlignment`; some also `category` | 1 | 13 | 14 |
| `marriott-bonvoy-business-american-express-card:gold-elite-status` / `card-anniversary-year` | status/access | `cycleAlignment` | 1 | 13 | 14 |
| Unresolved Hilton Surpass aggregate | unresolved | not attributed; raw descriptions omitted | 0 | 40 | 40 |

## Why the conflicts remain excluded

1. **Calendar versus anniversary authority is unresolved for the conflict population.** The schema gives nullable alignment fields a database default, while some static template rows omit alignment and the destination registry assigns a closed period key. The strict partial decision does not equate or normalize these shapes.
2. **The drift affects writable rows at scale.** There are 2,310 writable `usage` conflicts, not just excluded certificate/status/spend records. All remain unkeyed and outside write authority.
3. **The conflict pattern is not uniform.** In addition to alignment, 549 rows have category drift and 196 rows have start/duration drift. No broad ignore, fallback, or nearest-template rule is permitted.
4. **Forty rows are not safely attributable.** Their descriptions may be legacy or user-edited and are intentionally omitted. The partial apply leaves them untouched without requiring private inspection as a prerequisite for the deterministic subset.
5. **Partial apply is intentionally not catalog repair.** It leaves 2,739 benefits unkeyed, including major writable-semantics families, while assigning deterministic card and benefit identity only where the complete shape matches. Preview therefore represents only the exact prepared subset.
6. **Status volume is now bounded.** The exact create projection is zero. Any nonzero actual materialization is drift from the reviewed state and is a mandatory stop, not acceptable variation.

## Review questions before a new apply decision

The user has accepted the strict partial rollout policy, not the production apply itself, and the status projection is complete. These questions are deferred catalog-repair questions and do not authorize widening the partial rollout:

1. For every excluded family with `cycleAlignment` drift, what is the intended persisted alignment, and is it compatible with the registry period key?
2. Should omitted static alignment ever be normalized, or must calendar and anniversary families continue to require explicit complete-shape data?
3. Are the excluded category differences approved historical aliases, user edits, or evidence that exact-shape matching must remain blocked?
4. For excluded Aspire flight/CLEAR rows, which start month and duration are authoritative, and does changing them require a separate data migration rather than key backfill?
5. What are the 40 unresolved Surpass rows when reviewed in a private operational channel, and can they be mapped without fuzzy or nearest-template inference?
6. Should card-only proposals for products with zero benefit proposals be deferred in a future operator revision? The accepted current partial rollout policy follows the existing deterministic card proposal contract without granting benefit write authority.
7. Should the 22 Business Platinum Hilton anniversary-anchor diagnostics remain fail-closed preview observations or return to a separate catalog/cycle design review before broader rollout?

## Stop conditions

Keep synchronization effectively `off` and do not start or continue apply if any of the following is true:

- target identity or migration state cannot be reverified immediately before the approved operation;
- the complete classifier no longer reconciles to 1,126 card proposals, 7,076 exact benefit proposals, and 2,739 retained conflicts;
- a proposed tuple is not an exact canonical full-shape match with null-only destination keys;
- the immediate pre-apply projection does not reconcile to 6,759 unique desired status rows, all existing and zero missing;
- any materializer warning, duplicate desired key, cycle-end mismatch, 24-row cap condition, or new cycle diagnostic appears;
- any unresolved/private-description row is automatically mapped, overwritten, or exposed;
- a bounded apply report shows any status materialization or runtime compare-and-set conflict;
- pagination is incomplete or aggregate arithmetic does not reconcile;
- final dry-run has any remaining proposal or does not retain all 2,739 conflicts;
- any conflict is overwritten rather than retained;
- production mode, provider configuration, userscript state, or live AMEX behavior would change as part of the backfill operation.

## Required evidence for strict partial apply

A later strict partial apply requires:

1. immediate production target and migration reverification;
2. a new complete bounded dry-run with the same product/family/period reconciliation;
3. a repeated read-only status projection with exactly 6,759 existing and zero missing rows;
4. separate explicit apply authorization using the exact confirmation phrase and target-verification guard;
5. at-most-100-card cursor continuation with private raw output and sanitized aggregate monitoring after every invocation;
6. immediate stop on any materialized status, runtime conflict, count drift, widened match, or changed cycle diagnostic;
7. a final complete zero-proposal dry-run with all 2,739 conflicts reported and left untouched; and
8. only then, separately configured `preview` mode and an attended canary review before any write-mode decision.

The unresolved shape-drift and private-description populations remain deferred rather than repaired. Under these gates, the recommendation is **permit a separately authorized strict partial key apply; keep AMEX synchronization off during the operation and until preview is separately enabled**.
