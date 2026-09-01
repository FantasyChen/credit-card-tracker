# Benefit Tracking Modes

A Benefit Tracking Mode is a user-owned, cycle-independent choice about how one
benefit should be tracked. It answers a question `BenefitStatus` cannot: not
"what happened in this cycle" but "how should every future cycle behave".

| Mode | Stored? | New cycles open | Dashboard | Claimed value / ROI |
| --- | --- | --- | --- | --- |
| `TRACK` | No row | Unclaimed | Visible | Counted when the user claims it |
| `AUTO_CLAIM` | Row | Already claimed at `maxAmount` | Visible, in Claimed | **Counted** |
| `IGNORE` | Row | Unclaimed | Visible in the read-only Ignored tab | Excluded |

`TRACK` is the default and is represented by the *absence* of a row, so the
feature adds nothing for users who never touch it.

## Why not `isNotUsable`

`BenefitStatus.isNotUsable` describes one Benefit Cycle and resets when the next
cycle materializes, so it cannot carry a standing intent. Its accounting is also
the opposite of `AUTO_CLAIM`: it excludes value from ROI, which is correct for a
credit you genuinely cannot use and wrong for one you reliably use.

## Identity

Preferences are keyed exactly the way `BenefitStatus` addresses a benefit:

- Standard benefits: `(userId, creditCardId, predefinedBenefitId)`
- Custom benefits: `(userId, benefitId)`

Keying on `creditCardId` rather than the catalog definition means two Physical
Cards of the same product are configured independently, which matches the
product model where a Physical Card is always tracked separately.

## Claim provenance

`BenefitStatus.claimSource` records who last set a row's claim state:

| Value | Meaning |
| --- | --- |
| `NULL` | Untouched since materialization |
| `AUTO` | Claimed by this feature (mode switch, materialization, or window entry) |
| `USER` | Any manual action, batch completion, or applied AMEX Sync Confirmation |

Every manual mutation path stamps `USER`. Mode changes may only ever undo
`AUTO` rows — a claim the user made or edited is permanently out of reach of
this feature. Rows that predate the migration are `NULL`, so on day one no
existing claim can be reopened by a mode change at all.

## Effect on the current cycle

A mode change addresses the benefit, not one status row: every occurrence in
the **currently open** Benefit Cycle transitions together, and rows outside
that window — closed history and future scheduled cycles — are never written.
The exact rules, all in `setBenefitTrackingModeAction`:

| Transition | Open-cycle occurrences |
| --- | --- |
| → `AUTO_CLAIM` | Unclaimed ones claimed at `maxAmount` (0 when none is stored), stamped `AUTO`, with `isNotUsable` cleared atomically so a row can never sit in both accounting paths |
| `TRACK` → `IGNORE` | Left exactly as-is, then hidden |
| `AUTO_CLAIM` → `TRACK` / `IGNORE` | Rows stamped `AUTO` reopened; rows stamped `USER` untouched |
| → `TRACK` | The preference row is deleted, restoring the documented absence-means-default state |

Closed cycles are structurally immutable: every status update carries
`cycleStartDate <= now <= cycleEndDate` in its `where` clause, so historical
claimed value and ROI cannot change regardless of provenance.

Resetting from the settings screen follows the same rules.

## Effect on historical ROI

**No mode change rewrites a closed cycle.** Only the currently open cycle is
ever touched, so historical claimed value is preserved as recorded.

The consequence is that ROI is computed from whatever the status rows say, and
those rows are a mix of history under previous modes:

- Turning on `AUTO_CLAIM` does not backfill earlier unclaimed cycles. Past
  cycles you never claimed stay unclaimed, and lifetime ROI still reflects that.
- Turning off `AUTO_CLAIM` strips value only from the open cycle's `AUTO` rows.
  Closed cycles it claimed remain claimed and keep counting, and open-cycle
  claims the user made or edited (`USER`) are untouched.
- `IGNORE` is a **read filter, not a delete**. Status rows survive, so ignoring a
  benefit moves it to the read-only Ignored tab and removes its value from
  tracked tabs and totals while the preference is set. Resetting to `TRACK`
  restores it exactly. Nothing is lost, and the change is reversible.

So `IGNORE` retroactively changes what totals *display*, while `AUTO_CLAIM`
changes only what happens from now on. That asymmetry is deliberate: ignoring
says "this was never worth anything to me", and auto-claiming says "keep
counting this, just stop asking".

## Where the modes are applied

Handling is centralized in `src/lib/benefit-tracking-preferences.ts`. Surfaces
must not re-implement filtering.

**Reads** call `fetchTrackedBenefitStatuses` instead of
`fetchEffectiveBenefitStatuses`:

- benefits dashboard and its totals and card-level ROI
- home dashboard summary
- card calendar
- `GET /api/benefits`, `GET /api/user-cards`
- the notification digest, which resolves each row against its own owner because
  it fans out across users in one query

**Writes** call `applyTrackingModesToPlannedRows` before inserting statuses, so
`AUTO_CLAIM` applies in every materialization path:

- the `check-benefits` cron, which is where recurring cycles are actually born
- adding a Physical Card
- creating a custom benefit, via the server action and via `POST /api/benefits`
- **window entry**: cycles materialized ahead of time simply become current as
  time passes, so the cron also runs `claimWindowEntryAutoClaims`, claiming
  virgin rows (`claimSource NULL`, unclaimed, unused, usable) whose window has
  opened under an `AUTO_CLAIM` preference. A row the user deliberately reopened
  carries `USER` and is skipped forever.

The card and custom-benefit paths cannot have a pre-existing preference, since
preferences key on ids those paths are creating. They are routed through the
helper anyway so no path can drift.

**Deliberately not filtered:** integrity and repair tooling
(`/api/cron/benefit-integrity`, the global category repair utilities) reads
`BenefitStatus` directly and stays unfiltered. A display preference must never
hide a row from a consistency check.

## Scheduled benefits

The tracking control is available on scheduled cards too. The preference is
stored immediately; the open-cycle window keeps future status rows untouched
until their cycle opens, at which point window-entry claiming applies.

## Deployment sequence

The migration is purely additive — a new table, two new enums, one nullable
column, and a CHECK constraint on the new table — and old application code
never references any of it. The safe order is therefore strict but simple:

1. `npm run db:prod:migrate` (applies the tracking-preference schema migration
   and, when pending, `20260831000000_migrate_not_usable_to_ignore`)
2. Verify with `npm run db:prod:status` and an aggregate/read-only check of
   `"BenefitTrackingPreference"`; never expose row values
3. Deploy or promote the application release and verify the primary alias

Deploying the application before the migration would 500 every authenticated
read, since the dashboard queries the new table unconditionally. Where `main`
auto-deploys, run the migration before merging.

## Reset surface

The dashboard's Ignored tab is read-only except for the tracking-mode control.
`/settings/benefit-tracking` also lists every non-default choice and offers a
reset, so both surfaces can restore a benefit to `TRACK` without deleting its
history.
