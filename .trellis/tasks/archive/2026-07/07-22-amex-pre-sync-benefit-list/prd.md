# Refine AMEX pre-sync benefit list

## Goal

Refine the existing AMEX reader panel into a straightforward, trustworthy grouped master list that tells the user which concrete benefits are not used, partially used, or used before anything can be sent to Perks Reminder.

## Background

The reader already scans on explicit request, normalizes supported benefits per physical card, stores only normalized local observations, and displays a card-first benefit list. This milestone reworks that existing panel into one account-wide grouped master list rather than creating a parallel UI or changing the normalized contract to a binary flag.

## Requirements

### R1. Simple truthful states

- Present each eligible benefit as **Not used**, **Partially used**, or **Used** when the source evidence supports that conclusion.
- Present **Enrollment required**, **Link required**, and **Status unavailable** separately rather than misclassifying them as usage states.
- Keep observation quality—current, partial, stale, or failed—secondary and separate from benefit usage.
- Treat compatible observed zero usage as **Not used** even when a generic tracker state says in progress; preserve explicit completion, earned/completed, and amount-at-or-above-target **Used** precedence.
- Keep generic in-progress evidence **Partially used** when compatible zero evidence is absent, including when quantities are missing, incompatible, or uncharacterized.
- Derive presentation from the richer normalized observation; do not persist a lossy used/not-used boolean.

### R2. Straightforward grouped master list

- Reuse the existing panel but replace the selected-card-only workspace with one account-wide benefit list grouped by physical card.
- Label every card group with product name and ending digits so duplicate products remain distinguishable.
- Keep every benefit-bearing physical card and eligible benefit reachable within the grouped master review surface.
- Hide stored cards whose latest normalized observation has zero eligible benefits instead of rendering individual empty groups; disclose only a concise non-identifying aggregate hidden-card count.
- If every reviewed card has zero eligible benefits, show one account-level no-trackable-benefits state plus the aggregate note.
- Keep benefit-bearing cards with zero rows in the active filter reachable as compact zero-count groups without a large empty-message box.
- Scope summary card and data-note counts to benefit-bearing cards so metrics describe the visible review surface; keep scan coverage in the scan status.
- Provide only two top-level filters: **Remaining** and **Used**, with Remaining selected by default.
- Put every state other than Used in Remaining for navigation only; each row must still show its truthful specific label, including Partially used, Not used, Enrollment required, Link required, or Status unavailable.
- Follow Perks Reminder list-row language and styling where applicable.
- Show only the practical essentials inline: benefit name, truthful status, observed used/total amount when available, and benefit period.
- Show stale or partial observation quality once at the accessible card heading when relevant; do not repeat card quality on each benefit row, and keep timestamps, parser fields, confidence, fixed redacted issue reasons, and other technical data hidden in card-level secondary details.
- Decode valid numeric character references once for display and remove only a recognized AMEX footnote adornment: terminal `<sup>‡</sup>` or `<sup>®</sup>`, standalone `‡`, plus either exact superscript marker immediately before the exact suffix ` Statement Credit`. Do not change the normalized stored title; preserve arbitrary nonterminal markers and unrelated markup-like text as inert visible text.

### R3. Trackable benefits only

- Reuse the existing exact-card, shared-catalog matcher.
- Include only uniquely reviewed positive-amount credits on the matched card.
- Continue excluding unsupported, ambiguous, informational, access, protection, insurance, free-night, and status benefits before presentation.

### R4. Local review boundary

- Rendering and reviewing the list must not write to Perks Reminder.
- Scanning remains explicitly initiated and read-only.
- Login, MFA, credentials, cookies, raw responses, and opaque account tokens must not be automated, exposed, logged, or persisted.

### R5. Test-driven browser validation

- Cover status derivation and list presentation with automated tests.
- Use the generated-bundle synthetic browser harness for routine deterministic iteration.
- After the user manually authenticates, perform bounded owner-authorized live read-only account-wide scans as needed for test-driven iteration and render the complete normalized, eligible benefit inventory for joint review.
- Treat the requested "dump" as the in-extension normalized review list and sanitized aggregate evidence, never as an export or persistence of raw AMEX payloads.

### R6. Redacted conflict-path diagnostics

- Preserve `benefit_identity_conflict` as the only persisted issue code and preserve the existing partial/fail-closed disposition.
- Classify every current production conflict site with stable fixed categories for tracker-state collisions, joined tracker/catalog supported-key mismatches, ambiguous catalog joins, and tracker/catalog enrollment-candidate collisions.
- Show only unique fixed categories per affected physical card in the current panel scan. The category vocabulary itself contains no product name, title, source ID, quantity, period, card ending, or raw value.
- Keep the categories ephemeral: do not place them in normalized observations, scan summaries, GM storage, console output, network traffic, or task evidence, and make them disappear when the panel is reconstructed from stored state.
- Do not resolve ambiguity by choosing a cycle, latest/first/last observation, or invented persisted identity, and do not broaden matching or suppress the generic conflict.

### R7. Owner-authorized local semantic conflict review

- Under the user's explicit 2026-07-22 local-operator authorization, attach a typed bounded conflict-detail set only to each affected per-card `card_committed` event and current panel memory.
- Use only already parsed/validated candidate facts: the committed card product/ending, fixed category, reviewed supported credit key/family (both keys for mismatch), fixed source role, bounded display title, explicit parsed enrollment/tracker/completion/activity fields, decimal quantities with characterized unit/currency, period, safe same/different/unavailable relations, and catalog layout/enrollability only when needed.
- Never expose issuer/source IDs, opaque tokens, credentials, cookies, authorization headers, MFA values, raw response objects, generic record passthroughs, or DOM dumps.
- Cap conflict details and candidates, disclose truncation, sort candidates deterministically, and assign each ambiguity a stable scan-local category/family/ordinal key so a later prompt can map a user choice back to the reviewed conflict without creating persisted benefit identity.
- Render details in one bounded accessible card-level secondary section with stable `data-amex-*` hooks inside the userscript host's open shadow root. The sole local operator may use the rendered product names, endings, titles, states, periods, and amounts in local Claude Code prompts.
- Clear details on new scan, per-card successful/partial/failed replacement, clear-data, and reload. Never serialize them into normalized observations, `StoreEnvelopeV1`, scan summaries, GM storage, console/network output, or task evidence.
- This iteration gathers evidence for concrete user choices only. It must not automatically resolve or suppress a conflict and must not add provider reads, grants, destinations, mutation authority, or Perks Reminder transport.

## Acceptance Criteria

- [x] The existing panel shows one clear account-wide master list grouped by physical card without creating a second review UI.
- [x] Supported observations map truthfully to Not used, Partially used, Used, Enrollment required, Link required, or Status unavailable.
- [x] Observation quality never replaces or changes the displayed benefit usage state.
- [x] Benefit rows show only name, truthful status, observed used/total amount when available, and period inline; relevant stale/partial quality appears once at the card heading while fixed redacted diagnostics stay in card-level secondary details.
- [x] Provider titles decode numeric references once, omit only recognized terminal AMEX `<sup>‡</sup>` / `<sup>®</sup>` adornments, standalone `‡`, or either exact superscript marker before ` Statement Credit` for display, remain inert, and retain their original normalized stored values.
- [x] Every benefit-bearing physical card is represented by a clearly labeled group, and duplicate products remain distinguishable by ending digits.
- [x] Globally benefit-empty cards are hidden without exposing their identities, with one aggregate hidden-card note and one account-level empty state when all reviewed cards are empty.
- [x] Benefit-bearing cards with no rows in the active filter remain reachable as compact zero-count groups without repeated empty-message boxes.
- [x] Summary card and data-note metrics are scoped to the visible benefit-bearing review set, while scan coverage remains in scan status.
- [x] Compatible zero usage overrides generic in-progress evidence as Not used without weakening Used precedence or quantity compatibility rules.
- [x] The master list has only Remaining and Used filters; Remaining is the default, and every row retains its exact truthful state label.
- [x] Lululemon and Resy appear when the matched card and AMEX evidence satisfy the existing catalog-backed eligibility rules.
- [x] Intangible, unsupported, and ambiguous benefits remain excluded.
- [x] Viewing or rescanning the list sends no data to Perks Reminder.
- [x] Unit, panel, and generated-bundle browser tests cover the agreed state mapping and list behavior.
- [x] Every current `benefit_identity_conflict` production site maps to a stable redacted category while only the generic issue remains persisted and partial.
- [x] Per-card conflict categories are available only during the active panel scan, contain no source values, deduplicate deterministically, and disappear after reload without new provider reads.
- [x] After manual login, bounded owner-authorized live scans covered every currently discovered account card and rendered every eligible normalized benefit for joint review without capturing sensitive account/session material or raw payloads.
- [x] Every current conflict category exposes an exact typed, bounded, deterministic parsed-candidate detail shape on the current per-card progress event and reader-owned shadow tree only.
- [x] Structured conflict details include reviewed keys/families, fixed source roles, parsed state/quantity/period evidence, safe relations, and required catalog metadata while excluding every issuer/source ID, secret-like field, token, credential/session value, raw object, and generic passthrough.
- [x] Stable scan-local conflict keys and semantic `data-amex-*` hooks let a narrow native DOM projection address each ambiguity for later user choices without resolving it automatically.
- [x] New scan, per-card partial/failed replacement, clear, and reload remove prior details; normalized observations, scan summaries, GM storage, console/network output, and artifacts contain no structured conflict details.
- [x] Userscript `0.2.13` preserves the exact match, three grants, destinations, three approved read operations, fail-closed generic issue/partial handling, and no-mutation/no-sync boundary.

## Dependencies

- This milestone establishes the reviewed normalized/presentation contract consumed by `.trellis/tasks/07-22-sync-reviewed-amex-benefits`.

## Out of Scope

- Migration from the existing Tampermonkey userscript to a packaged Chrome extension.
- Any Perks Reminder write path.
- Automating AMEX login, MFA, CAPTCHA, or credentials.
- Replacing the existing shared-catalog eligibility matcher.
- Applying a user choice, adding a synthetic resolution rule, or automatically resolving/suppressing any AMEX conflict.
