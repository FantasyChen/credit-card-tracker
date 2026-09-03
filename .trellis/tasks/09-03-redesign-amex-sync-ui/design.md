# Quiet Ledger technical design

## Design intent

The AMEX reader and sync handoff are not analytics dashboards or marketing
pages. They are a short-lived financial review flow. The design should make
three things immediately legible:

1. what needs attention;
2. what will change if the user confirms; and
3. what actually changed afterward.

The distinctive device is a **decision rail**: one vertical signal that changes
from ink/mint (ready), to gold (attention/expiry), to mint/check (completed).
It encodes the state of the workflow rather than decorating the page. The rest
of the interface behaves like a quiet statement: aligned labels and values,
physical-card groupings, ruled rows, and restrained surfaces.

## Visual system

### Core palette

| Token | Value | Role |
| --- | --- | --- |
| Ledger ink | `#172033` | Brand anchor, primary actions, strongest text |
| Ledger paper | `#F7F8F6` | Calm page/panel ground |
| Ledger white | `#FFFFFF` | Raised review and action surfaces |
| Ledger slate | `#667085` | Secondary text and inactive structure |
| Ledger mint | `#8FE3C1` | Ready/completed signal and focus accent |
| Ledger gold | `#FFCF70` | Expiry, prerequisite, and reversal attention |

Error/destructive states continue to use the repository's established semantic
red tokens. Dark mode maps the same roles onto deep ink surfaces with readable
foregrounds; mint and gold remain accents rather than large text backgrounds.

### Type and spacing

- First-party handoff: existing Geist Sans only, with tabular numerals for
  amounts, counts, and time.
- Shadow DOM reader: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif`; no remote font request.
- Type scale: 12 / 14 / 16 / 20 / 28 pixels with deliberate role boundaries.
  Body copy is 16 pixels on narrow first-party layouts; compact reader metadata
  may remain 12–14 pixels where it is supplemental rather than body prose.
- Spacing uses an 8-pixel rhythm with 4-pixel optical adjustments. Corners vary
  by hierarchy: larger shell, medium sections, subtle row rounding only when a
  row is actionable or exceptional.

### Motion

Use one action-linked transition: when confirmation finishes, the decision
rail and summary settle into the completed state over roughly 180–220ms. Do not
stagger every row or animate scrolling, dimensions, counters, or background
decoration. `prefers-reduced-motion` renders the final state immediately.

## Layout

All primary copy is left-aligned. Numeric changes align on their value edge when
space permits and remain tabular. Center alignment is reserved for true empty
states.

### Handoff desktop

```text
┌─ decision rail ───────────────────────────────────────────────┐
│ Review 3 benefit updates                     Ready · 4m left │
│ Private normalized handoff · nothing written yet             │
├──────────────────────────────────┬────────────────────────────┤
│ Updates to review                │ Review summary             │
│                                  │ 3 will update              │
│ Platinum ••••• 12345             │ 1 needs card details       │
│ Resy · Jul–Sep 2026              │                            │
│ $100 → $40 · Completed → No      │ [Confirm 3 updates]        │
│                                  │ Close this page to cancel  │
│ Gold ••••• 67890                 │                            │
│ Dining · Sep 2026                │                            │
├──────────────────────────────────┴────────────────────────────┤
│ ▸ Card details needed (1)                                    │
│ ▸ Already current (8)                                        │
│ ▸ Not included from local scan (2)                           │
└───────────────────────────────────────────────────────────────┘
```

The DOM order remains summary, proposed review, action, prerequisites, and
secondary disclosures. Desktop grid placement may put the action surface beside
the review, but keyboard and screen-reader order follows the review decision.
The action surface may be sticky within the page only when it does not obscure
content or create a second mobile sticky layer.

### Handoff mobile

```text
┌─ Review 3 updates ───────────┐
│ Ready · 4m left              │
├──────────────────────────────┤
│ Platinum ••••• 12345         │
│ Resy · Jul–Sep 2026          │
│ $100 → $40                   │
│ Completed: Yes → No          │
├──────────────────────────────┤
│ Gold ••••• 67890             │
│ Dining · Sep 2026            │
├──────────────────────────────┤
│ [Confirm 3 updates]          │
│ ▸ Details needing attention  │
│ ▸ Already current            │
└──────────────────────────────┘
```

Comparisons stack at narrow widths. There is no horizontal table and no fixed
bottom confirmation bar.

### Reader panel

```text
┌──────────────────────────────────────┐
│ [mark] Amex benefits      [Collapse] │
│ Stays local until Sync reviewed      │
│ [Scan all cards] [Sync reviewed]     │
├──────────────────────────────────────┤
│ Remaining 7            Used 4        │
│                                      │
│ Platinum ••••• 12345                 │
│ ┃ Resy                    Not used   │
│ ┃ $0 of $50 · Jul–Sep 2026           │
│ ───────────────────────────────────  │
│ ┃ Uber Cash               Used       │
│ ┃ $15 of $15 · Sep 2026              │
│                                      │
│ Gold ••••• 67890                     │
│ ...                                  │
├──────────────────────────────────────┤
│ ▸ Data and privacy                   │
└──────────────────────────────────────┘
```

Card groups become quiet sections and benefit entries become ruled ledger rows,
removing the current nested-card effect. During scanning/cancellation, the
existing isolated title/status/native-progress/Cancel workspace remains the
only visible content.

## State and information architecture

### Handoff state model

The existing state machine remains authoritative:

```text
waiting → previewing → preview → confirming → result
    └──────────── any strict failure ─────────────→ invalid
```

The redesign derives presentation only:

- `preview`: proposed rows first; prerequisites next when present; unchanged,
  skipped, and exclusions in accessible disclosures.
- `confirming`: preserve review content, disable competing actions, and update
  the single contextual live status.
- `result`: group `updated`, `failed`, `skipped`, and `unchanged` truthfully;
  change `proposed_update` copy to `Updated` only when disposition is `updated`.
- `invalid`: show the specific existing status message plus one recovery action
  description. Do not claim that every failure is expiry.
- preview-only server mode: show the same review without a confirmation control.

### Row context projection

The browser already holds the validated envelope in React memory. For each
public result row:

1. locate the exact source card by `sourceLocalCardId`;
2. show its safe normalized `providerProductName` and exact five ending digits;
3. locate the exact normalized source benefit by `creditFamilyKey` and show its
   inert formatted `providerTitle` and structured `sourcePeriod`;
4. for the reviewed December Uber bonus expansion, fall back to its known base
   family on the same source card;
5. if no exact approved source context exists, show the canonical family label
   and card identity without guessing another title or period.

The projection is recomputed from the memory-only envelope. It is never placed
in URL state, browser storage, cookies, logs, or a new server response.

The existing inert provider-title and structured-period formatters should move
to a shared client-safe `src/lib/amex-benefit-reader/presentation.ts` module and
remain re-exported from the current panel owner so existing imports/tests do not
break. No server-only module enters either client graph.

### Disclosures and ordering

- Proposed/updated rows are expanded and grouped by physical card.
- Reversal warnings remain inline on the exact affected row.
- Card prerequisites show a visible compact checklist. They are not hidden when
  they block confirmation.
- Failed result rows are expanded because they require attention.
- Skipped rows are collapsed by default when proposed rows exist, and expanded
  when no update is possible.
- Unchanged rows and envelope exclusions are collapsed by default with counts.
- Native `<details>/<summary>` is preferred for durable keyboard and semantic
  behavior; disclosure labels include counts and do not rely on chevron state.

## Proposal freshness

Derive a presentation value from `proposalExpiresAt` and the local clock:

- more than two minutes: `Ready · N min left`;
- from two minutes through one second: `Expires soon · M:SS left`;
- zero or below: `Preview expired`.

The client schedules coarse updates while far from expiry and one-second updates
only inside the urgent window. The effect cleans up its timer on replacement or
unmount. Client expiry disables confirmation and presents recovery guidance;
the server continues to reject stale proposals authoritatively.

Refreshing uses the retained envelope and replaces the old proposal only after
strict validation, exactly as today. Result-state refresh copy becomes `Check
again` while prerequisite-state copy remains `Check card details`.

## Boundaries and compatibility

- `page.tsx` remains a force-dynamic, no-store, authenticated Server Component.
- `AmexSyncHandoffClient.tsx` remains the owner of mailbox acquisition, strict
  response parsing, React memory, fetches, and in-flight exclusion.
- A route-local CSS module may own the first-party Quiet Ledger composition and
  tokens. The reader keeps equivalent scoped variables inside its Shadow DOM.
- No API route, database model, reconciliation plan, destination authority,
  provider transport, normalization, scan storage, or userscript permission
  changes are required.
- No new package, font, state store, charting library, or animation runtime is
  introduced.
- Existing public text that documents `Scan all cards`, `Sync reviewed`, and the
  separate confirmation step remains recognizable.

## Design self-critique

The first generated external recommendations—liquid glass, scrolling story,
luxury serif, decorative dark gradients, and GSAP reveal—would make the flow
feel like a template or campaign page. They were removed.

Quiet Ledger could still become a generic card dashboard if every section gains
the same white box and shadow. The corrective rule is: one outer review folio,
one state rail, quiet ruled rows, and raised surfaces only for the current action
or required recovery. The design should be reviewed in screenshots and one
decorative element removed if it does not encode state or hierarchy.

## Rollback shape

The work is presentation-only plus shared pure display helpers. Rollback is a
normal source revert of the handoff component/CSS, panel presentation, helper,
and tests. There is no data migration, stored-format change, deployment step,
or cleanup operation.
