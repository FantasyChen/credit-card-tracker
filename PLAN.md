# Post-2.0 Product Priorities

> Retained product/history record. Completed, parked, and archived items below are historical context, not current requirements. Current task requirements live under `.trellis/tasks/` and durable contracts under `.trellis/spec/`.

## Completely Free Product Pivot

### Goal

Make “completely free” a code-backed product invariant.

### Decisions and outcome

- Every account receives unlimited cards, unlimited email reminders, custom reminder windows, loyalty tracking, and data import/export.
- `subscriptionTier` and `isBetaUser` remain dormant compatibility fields.
- `/pricing` remains a stable route that explains the free-product commitment.
- Visible paid-tier gates and Pro/Beta product language were removed.

## Catalog, Card Lifecycle, and Competitor Research

### Outcome

- Added structured card-template intake under `card-templates/`.
- Refreshed high-visibility Catalog definitions and card art with recorded provenance.
- Added Physical Card lifecycle state, events, annual-fee and bonus deadlines, and `/cards/calendar`.
- Added existing-user-safe Catalog synchronization, global definitions, and status materialization contracts.
- Kept Benefit Usage Guides and exact Benefit Cycle behavior as product differentiation.

## Benefit Usage Guides

### Decisions and outcome

- Guides describe qualification, trigger steps, timing, caveats, and failure modes.
- Community data points remain caveated rather than presented as issuer guarantees.
- Card-specific guide matching wins when descriptions overlap, with generic fallback.
- Dashboard cards keep guide links compact; detailed instructions live on guide pages.

## Product wedge roadmap

Completed product slices include:

- duplicate Physical Card identity and display labels;
- Benefit Usage Guides and correction links;
- community data-quality documentation;
- bulk card onboarding;
- a focused iOS companion plan;
- annual-fee, anniversary, bonus, and expiring-benefit calendar views.

### Parked ideas

- A dedicated free-night/certificate dashboard
- Monthly digest and calendar reminder modes
- Best-card-by-category recommendations

These remain product ideas only and require fresh review before implementation.

## Durable product decisions

- “Tracking plus how to use” is the primary differentiation.
- Physical Cards are distinct by identity, not grouped only by product name.
- Claimed ROI remains separate from subjective value estimates.
- The web/PWA remains canonical; native iOS work should focus on widgets, push, and quick actions.
- Catalog freshness requires verified sources and existing-user disposition, not seed-only edits.

## Historical operational note

The former domain-migration announcement is no longer an active task. Any future announcement or migration operation requires a new reviewed task, current recipient/state evidence, explicit authorization, caps, and resumable stop conditions.
