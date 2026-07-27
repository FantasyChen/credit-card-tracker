# Plan AMEX BenefitSync experience

## Goal

Create a trustworthy AMEX BenefitSync experience that first presents a simple, reviewable picture of the user's concrete AMEX benefit usage and later supports syncing those benefits into Perks Reminder.

## Background

The user will open the AMEX website and complete authentication. Development and verification should then use automated, test-driven browser iteration against that authenticated session. Before any data is synchronized into Perks Reminder, the extension must show what it detected in a straightforward list modeled on Perks Reminder's existing UI patterns.

## Confirmed Facts

- The existing AMEX reader already uses an explicit **Scan all cards** action, normalizes observations per physical card, persists normalized local data, and does not send observations to Perks Reminder (`src/userscripts/amex-benefit-reader.user.ts:17-58`, `src/lib/amex-benefit-reader/scan-engine.ts:105-367`).
- Its normalized contract preserves enrollment, linking, tracker progress, completion, amounts, periods, field uncertainty, and separate observation quality (`src/lib/amex-benefit-reader/contract.ts:31-165`).
- The current panel is card-first and list-based, with human benefit labels, filters, progress details, and Perks Reminder-like styling (`src/userscripts/amex-benefit-reader/panel.ts:25-183`, `src/userscripts/amex-benefit-reader/panel.ts:319-712`). This feature should refine that panel into the requested grouped master list rather than create a second list.
- Trackable-benefit selection is already fail-closed and shared-catalog-backed: a provider title must uniquely match a reviewed, positive-amount credit on that exact card (`src/lib/amex-benefit-reader/supported-card-credits.ts:151-229`). Lululemon and Resy are already supported where represented on reviewed cards.
- Perks Reminder distinguishes Open, Partially used, Claimed, Scheduled, and Not usable states, and stores absolute used amounts per benefit cycle (`src/components/BenefitCardClient.tsx:143-154`, `prisma/schema.prisma:195-216`).
- Website synchronization is not implemented. It requires a separately approved boundary for authentication, card/benefit/cycle mapping, idempotency, provenance, preview, and conflict handling.

## Requirements

### R1. Pre-sync benefit list

- Show detected AMEX benefits in the extension before syncing them into Perks Reminder.
- Use three simple usage states: **Not used**, **Partially used**, and **Used**.
- Show **Enrollment required**, **Link required**, and **Status unavailable** as separate action or uncertainty states rather than forcing them into a usage state.
- Keep observation quality (current, partial, stale, or failed) secondary and separate from benefit usage state.
- Show one account-wide master list grouped by physical card, labeling each group with product name and ending digits.
- Provide only **Remaining** and **Used** top-level filters; Remaining includes every non-used row for navigation while each row retains its exact truthful state label.
- Keep the presentation simple and list-based rather than introducing a complex dashboard.
- Follow existing Perks Reminder UI patterns where they apply.

### R2. Trackable-benefit scope

- Include concrete, usable benefits whose consumption can be meaningfully tracked, such as Lululemon and Resy credits.
- Exclude intangible benefits that do not produce a useful, actionable usage status.
- Define a consistent eligibility rule so unsupported or ambiguous AMEX content is not presented as confidently trackable.

### R3. Review before synchronization

- The pre-sync list is a review step: detection and status presentation must work before synchronization is attempted.
- The user must be able to understand the detected benefit and its usage state without first writing data to Perks Reminder.

### R4. Automated, test-driven delivery

- Use automated tests for parsing, status normalization, and list presentation.
- After the user authenticates to AMEX and separately authorizes the scan, perform one read-only scan across the account and render the complete normalized eligible benefit inventory for joint review and test-driven iteration.
- Treat this "dump" as the in-extension normalized list plus sanitized aggregate evidence, not a raw provider-data export.
- Do not automate credential entry or persist credentials, raw session secrets, or unnecessary raw AMEX data.

### R5. Perks Reminder synchronization direction

- Design the detected benefit model and pre-sync UI so eligible benefits can later be synchronized into Perks Reminder.
- Synchronization behavior must not weaken the correctness or reviewability of the pre-sync experience.

## Delivery Structure

Deliver the work as two independently verifiable milestones:

1. **Pre-sync review list** — refine the existing AMEX reader panel, validate the truthful simplified states, and complete authenticated read-only browser verification.
2. **Perks Reminder synchronization** — after the review list is trusted, add a separately designed preview, authenticated synchronization boundary, mapping, provenance, idempotency, and conflict handling.

The second milestone depends on the normalized review contract established by the first. The parent plan owns cross-milestone requirements and final integration review.

## Acceptance Criteria

- [x] On supported AMEX pages, the Tampermonkey reader renders one account-wide pre-sync master list grouped by physical card, with only Remaining and Used top-level filters.
- [x] Every displayed benefit is presented as Not used, Partially used, Used, Enrollment required, Link required, or Status unavailable without conflating usage with observation quality.
- [x] Concrete benefits such as Lululemon and Resy can be represented when AMEX exposes sufficient evidence.
- [x] Intangible or non-actionable AMEX benefits are excluded from the trackable list.
- [x] Viewing the list does not write benefit data into Perks Reminder.
- [x] The list follows relevant Perks Reminder visual and interaction patterns.
- [x] Parsing, normalization, filtering, and UI behavior have automated test coverage.
- [x] An authenticated browser validation workflow can be run after the user logs in, without automating or storing credentials.
- [x] The synchronization design uses one global Sync action, a first-party Perks Reminder handoff and confirmation summary, exact current-cycle mappings, idempotent partial success, AMEX source precedence, and fail-closed exclusions.

## Cross-Milestone Integration Trace

Final parent review on 2026-07-26 traced the original requirements through both archived child tasks and their committed implementation:

| Parent requirement | Pre-sync milestone evidence | Synchronization milestone evidence | Disposition |
| --- | --- | --- | --- |
| R1. Truthful pre-sync list | `6697fc6` implements the grouped physical-card list, six independent benefit labels, separate card quality, and Remaining/Used filters; `79c51d7` covers unit, panel, high-scale, and generated-bundle behavior. | The global sync control is separate from scanning and leaves the local review list intact. | Code complete; the pre-sync child also recorded bounded authenticated read-only validation of the review surface. |
| R2. Trackable scope | The shared static-catalog matcher admits only unique positive-amount credits on the exact card and fails closed for ambiguous, unsupported, and non-credit content. Lululemon and Resy have direct fixtures. | V2 carries the same stable product/family identity into a server allowlist limited to Platinum Lululemon and Resy. | Complete without a second allowlist at the presentation boundary or title-based server guessing. |
| R3. Review before sync | Scanning remains an explicit local read action and the account-wide list renders before any handoff. | One explicit `Sync reviewed` gesture creates a bounded mailbox; preview is read-only and confirmation is a separate action available only in effective `write` mode. | Complete; viewing or rescanning alone cannot write Perks Reminder state. |
| R4. Automated delivery and private evidence | Reader adapter, state, panel, storage, provider-text, conflict, and generated-IIFE browser tests cover parsing and presentation with invented fixtures and deny-by-default network routing. | Contract, mailbox, authority, proposal, request, route, service, repository, handoff, telemetry, retention, and generated-bundle tests cover the first-party boundary. | Complete for code and synthetic validation; no credential automation or raw-provider export was introduced. |
| R5. Synchronization direction | Normalized V2 preserves stable product/family keys, structured source ranges, scan identity, and the richer reviewed state while V1 remains review-only. | `02204a6`, `0ca2c4a`, and `2d2dc96` implement the envelope/mailbox, additive persistence, authenticated preview/confirm UI, exact-cycle mapping, HMAC binding, provenance, replay defense, independent row transactions, audit retention, and private-route telemetry suppression; `64a14c1` supplies focused coverage. | Code complete behind the server-side kill switch; missing or invalid configuration resolves to `off`. |

The integration review found one parent-level boundary gap: the handoff client previously validated successful preview/confirmation responses only at their top level. It now applies strict, bounded, closed response schemas before rendering or acknowledging preview acceptance, and a focused test proves that an incomplete 2xx preview row does not consume the mailbox.

## Operational Status and Remaining Gates

The implementation is code-complete, but synchronization is not operationally enabled. `AMEX_SYNC_MODE` remains fail-closed and defaults to `off`. The additive migration SQL exists and the Prisma client was generated under the child task's recorded authorization, but none of the following pending actions is implied by these acceptance checkmarks:

- applying the migration to a verified development or production target;
- running the catalog-key backfill dry run or any backfill write;
- deploying the application or changing server mode to `preview` or `write`;
- installing the current `0.3.0` userscript;
- performing a new live authenticated AMEX scan with the synchronization build;
- performing an authenticated first-party preview; or
- confirming any real write.

Each action remains separately authorized and target-verified. Until the migration is applied and the associated catalog keys are deterministically backfilled, null or absent destination keys fail closed and no sync row is writable.

## Out of Scope

- Migrating the proven Tampermonkey workflow to a packaged Chrome extension; revisit packaging after the pre-sync and first synchronization milestones.
- Automating AMEX login, MFA, CAPTCHA, or credential handling.
- Tracking intangible benefits that lack meaningful usage evidence.
- Synchronizing data before the user can review the detected list.
