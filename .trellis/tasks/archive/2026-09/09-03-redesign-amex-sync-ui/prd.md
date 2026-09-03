# Redesign AMEX sync UI/UX

## Goal

Make the AMEX reader and authenticated sync handoff feel like one beautiful,
trustworthy financial workflow: understand what was found, focus on decisions
that need attention, confirm eligible changes, and immediately know what
happened afterward.

The redesign should reduce cognitive load for accounts with many cards and
benefits without weakening the existing privacy, identity, preview, or
confirmation contracts.

## Background

- The current reader is functional but visually generic: dense system-font
  cards and inline CSS give every status and section similar weight
  (`src/userscripts/amex-benefit-reader/panel.ts:488`).
- The current handoff renders proposed, unchanged, and skipped rows in one
  undifferentiated list (`src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:504`).
- A row heading exposes only a credit-family label, so repeated benefits do not
  visibly carry their card, ending digits, source title, or period context
  (`src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:228`). The accepted
  in-memory envelope already contains those safe display fields.
- Successful confirmation replaces the response rows with `updated` results,
  but the row reason still reads `Ready to update`; the page then adds a
  separate generic `Confirmation recorded` block
  (`src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:165`,
  `src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:539`).
- The persistent prerequisite action says `Refresh after editing cards` even
  after confirmation, when the likely intent is to verify again
  (`src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:468`).
- Preview expiry is shown only as a small absolute timestamp, with no urgency
  state or direct recovery guidance (`src/app/integrations/amex-sync/AmexSyncHandoffClient.tsx:513`).
- Multiple missing-card prerequisites require one new tab per card. The exact
  internal edit-link and memory-only handoff contract requires this page to
  remain open, so the redesign must make that workflow feel coherent rather
  than attempting an unsafe single-page resume.
- Prior product research identifies Perks Reminder's durable wedge as
  privacy-first manual tracking, precise benefit periods, and practical
  guidance. It does not support imitating a bank-link automation dashboard.
- The user delegated the visual decision. **Quiet Ledger** is selected: calm
  premium financial utility, deep ink surfaces, restrained mint/gold signals,
  efficient spacing, and one statement-like decision rail.
- External design-skill research is recorded in
  `research/vetted-ui-design-skills.md`; the local UI audit is in
  `research/current-flow-ui-audit.md`.

## Requirements

### R1. One coherent visual language

- Use one deliberate visual direction across the Shadow DOM reader and the
  first-party handoff while respecting the host surface of each.
- Retain the existing Perks Reminder ink, mint, and gold mark as the identity
  anchor. Use semantic colors for proposed, attention, skipped, and completed
  states in addition to text and icons, never color alone.
- Prefer the existing Geist family in the app and a compatible local/system
  sans stack in the isolated reader. Do not add a remote font dependency.
- Avoid liquid glass, decorative gradients, a luxury serif, parallax, generic
  repeated SaaS cards, or motion that competes with review work.

### R2. Decision-first handoff hierarchy

- Lead with an outcome summary that distinguishes proposed updates, blockers,
  unchanged rows, exclusions, and the current confirmation state.
- Put proposed updates and destructive reversals first. Keep the separate
  explicit confirmation gesture and make its scope/count obvious.
- Group or otherwise label rows with safe card context: provider product name,
  five ending digits, provider benefit title, and structured source period when
  present. Resolve this from the accepted memory-only envelope; do not expose
  internal diagnostics or persist a display mirror.
- Place unchanged, skipped, and excluded information behind accessible
  progressive disclosure when it is not needed for the primary decision.
  Counts and recovery actions must remain visible without expanding details.
- Preserve exact row dispositions and warning semantics. A visual redesign may
  not flatten or relabel server outcomes inaccurately.

### R3. Truthful post-confirmation state

- After confirmation, updated rows must visibly say they were updated rather
  than `Ready to update`.
- Replace the generic success addendum with an integrated result summary that
  reports updated, unchanged, skipped, and failed counts and keeps row-level
  outcomes inspectable.
- Give the post-confirmation refresh action context-appropriate copy such as
  verifying card edits or checking again; it must never imply that confirmation
  needs repeating when it does not.
- Replayed confirmation, partial failure, conflict re-preview, and malformed
  confirmation responses must remain distinct and truthful.

### R4. Expiry and recovery

- Present proposal freshness as a human-readable remaining-time state, backed
  by the server expiry timestamp, with a visible urgency change near expiry.
- Expiry presentation must not silently mutate domain state or enable a stale
  confirmation. Server validation remains authoritative.
- When a preview is expired or invalid, provide one clear recovery path: return
  to AMEX, run a fresh scan, and choose `Sync reviewed` again.
- Timer behavior must clean up on unmount, avoid unnecessary rerenders, and
  remain understandable with reduced motion.

### R5. Cohesive card-prerequisite workflow

- Keep one server-derived exact-card link per missing destination card, opening
  in a separate `noopener noreferrer` tab so the accepted envelope stays only
  in the original page's memory.
- Present the prerequisite cards as a compact checklist with completion
  guidance and a single refresh/verify action. Do not add manual card mapping,
  multi-card mutation, browser persistence, or a resume URL.
- Disable refresh and confirm against the existing shared in-flight guard.

### R6. Reader clarity and polish

- Preserve manual scan start, local-only disclosure, Remaining/Used filter
  semantics, physical-card labels, and the isolated scan/cancel workspace.
- Strengthen hierarchy between brand/privacy, primary action, account summary,
  filters, physical cards, and benefit rows without exposing timestamps,
  quality/freshness labels, parser fields, issue codes, or conflict diagnostics.
- Keep card groups visible only when they contain a row in the active filter;
  keep confirmed-empty and unresolved zero-row cards out of the terminal list.
- Use one restrained action-linked motion moment, such as the transition from
  completed scan to reviewed results or confirmation to final outcomes. With
  reduced motion, render the final state immediately.

### R7. Responsive and accessible interaction

- Work without horizontal overflow at 320, 375, 414, 768, 1024, and 1440 CSS
  pixels where the owning surface can reach those sizes.
- Reflow row comparisons and action areas for narrow screens; do not truncate
  card names, errors, safety text, or action labels.
- Interactive targets must be at least 44 by 44 CSS pixels where practical,
  with visible focus, semantic controls, logical headings, accessible names,
  correct expanded/pressed state, and usable keyboard order.
- Normal text must meet WCAG AA contrast. Status must use text/icon semantics in
  addition to color. Live feedback should use one contextual atomic status,
  not multiple competing announcements.
- Preserve dark-mode support for both surfaces and `prefers-reduced-motion`.

### R8. Focused regression coverage

- Update component tests to cover decision ordering/disclosure, card and period
  context, countdown/expiry recovery, prerequisite workflow, truthful success
  and partial-result states, and accessible control state.
- Update reader panel tests for the new hierarchy while preserving no-autoscan,
  filter membership, isolated scan progress, inert provider text, hidden
  diagnostics, collapsed launcher, and destructive clear confirmation.
- Add synthetic visual verification at representative desktop and mobile sizes;
  no live provider/account data is required for this task.

## Acceptance Criteria

- [ ] On a mixed preview, proposed updates and any reversal warnings are visible
      before unchanged/skipped/excluded details, and the confirmation control
      states the number or scope of eligible changes.
- [ ] Every rendered sync row has enough safe context to distinguish repeated
      benefit names across physical cards and periods.
- [ ] Unchanged, skipped, and excluded rows remain discoverable with visible
      counts but do not dominate the initial review.
- [ ] Missing last-five prerequisites appear as one accessible checklist with
      exact protected edit links and one explicit refresh/verify action.
- [ ] Proposal freshness is understandable without parsing a clock time, warns
      near expiry, and routes an expired user to a fresh AMEX scan.
- [ ] A successful confirmation changes proposed rows to truthful updated
      outcomes and shows an integrated result summary; replay and partial/failure
      outcomes remain accurate.
- [ ] The reader and handoff share a recognizable Perks Reminder visual language
      while remaining visually appropriate to their different hosts.
- [ ] Reader behavior still requires an explicit scan, exposes no prohibited
      diagnostics, preserves exact filters and physical-card identity, and shows
      only progress/status/Cancel during active scan or cancellation.
- [ ] Keyboard, focus, screen-reader state, contrast, dark mode, reduced motion,
      200% text sizing, and mobile reflow are verified for changed interactions.
- [ ] Targeted Jest, strict TypeScript, changed-source lint, isolated userscript
      build/audit, synthetic browser checks, sensitive-data scan, and
      `git diff --check` pass under the repository's safe verification rules.

## Out of Scope

- Changing AMEX provider reads, account discovery, normalization, matching,
  destination authority, database schema, reconciliation, or write behavior.
- Auto-scan, background polling, automatic confirmation, provider mutation, or
  a bypass around exact five-digit physical-card identity.
- Persisting the envelope, proposal, or a resume token in URL, storage, cookie,
  database, or another durable channel.
- A general site redesign, new global state library, new remote font, charting
  library, animation dependency, or AMEX-branded card art/logo treatment.
- Live AMEX, database, deployment, notification, or production release actions.
