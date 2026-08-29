# Benefit Tracking Modes

A Benefit Tracking Mode is a user-owned, cycle-independent choice about how one
benefit should be tracked. It answers a question `BenefitStatus` cannot: not
"what happened in this cycle" but "how should every future cycle behave".

| Mode | Stored? | New cycles open | Dashboard | Claimed value / ROI |
| --- | --- | --- | --- | --- |
| `TRACK` | No row | Unclaimed | Visible | Counted when the user claims it |
| `AUTO_CLAIM` | Row | Already claimed at `maxAmount` | Visible, in Claimed | **Counted** |
| `IGNORE` | Row | Unclaimed | Hidden everywhere | Excluded |

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

## Effect on the current cycle

Changing a mode is not retroactive beyond the cycle you are looking at. The
exact rules, all in `setBenefitTrackingModeAction`:

| Transition | Current open cycle |
| --- | --- |
| → `AUTO_CLAIM` | Claimed immediately at `maxAmount` (0 when no maximum is stored) |
| `TRACK` → `IGNORE` | Left exactly as-is, then hidden |
| `AUTO_CLAIM` → `TRACK` / `IGNORE` | Reopened: `isCompleted` cleared, `usedAmount` reset to 0 |
| `TRACK` → anything, when the user had already claimed the cycle themselves | **Left untouched** |

The last row is the important one. Leaving `AUTO_CLAIM` only reopens a cycle
that this feature claimed on the user's behalf, decided by the *previous* stored
mode. A cycle the user claimed by hand is never silently un-claimed.

Resetting from the settings screen follows the same rule: the reset only reopens
the currently open cycle, and only when the preference being removed was
`AUTO_CLAIM`.

## Effect on historical ROI

**No mode change rewrites a closed cycle.** Only the currently open cycle is
ever touched, so historical claimed value is preserved as recorded.

The consequence is that ROI is computed from whatever the status rows say, and
those rows are a mix of history under previous modes:

- Turning on `AUTO_CLAIM` does not backfill earlier unclaimed cycles. Past
  cycles you never claimed stay unclaimed, and lifetime ROI still reflects that.
- Turning off `AUTO_CLAIM` does not strip value from cycles it already claimed.
  Those cycles remain claimed and keep counting.
- `IGNORE` is a **read filter, not a delete**. Status rows survive, so ignoring a
  benefit removes its value from every total while the preference is set, and
  resetting to `TRACK` restores that value exactly. Nothing is lost, and the
  change is reversible.

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

The card and custom-benefit paths cannot have a pre-existing preference, since
preferences key on ids those paths are creating. They are routed through the
helper anyway so no path can drift.

**Deliberately not filtered:** integrity and repair tooling
(`/api/cron/benefit-integrity`, the global category repair utilities) reads
`BenefitStatus` directly and stays unfiltered. A display preference must never
hide a row from a consistency check.

## Reset surface

An `IGNORE`d benefit cannot be reached from the dashboard by definition, so
`/settings/benefit-tracking` lists every non-default choice and offers a reset.
It is the only route back, which is why the feature would be incomplete without
it.
