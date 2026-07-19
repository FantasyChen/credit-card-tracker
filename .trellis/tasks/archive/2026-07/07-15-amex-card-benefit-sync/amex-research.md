# Read-only Amex page observations

Observed on 2026-07-15 through the user's authenticated Chrome session using Kimi WebBridge. This record is deliberately redacted: it contains no real card ending digits, balances, loyalty account numbers, raw issuer identifiers, cookies, authorization headers, or raw API payloads.

## Safety boundary

- Navigation and inspection were read-only.
- No enroll, activate, redeem, payment, offer, or account-modification action was clicked.
- No password, MFA value, cookie, authorization header, or raw upstream payload was collected.

## Card discovery surface

- `https://global.americanexpress.com/overview` exposes an account selector and account cards.
- `https://global.americanexpress.com/card-benefits/view-all` and `/card-benefits/activity` expose the same account selector.
- The selector provides card product display name plus four or five ending digits.
- Multiple physical cards may share the same product name, so product name alone is insufficient.
- The selector also includes non-card entries such as overview/business tools and at least one operational account; extraction must positively identify supported card entries rather than treating every option as a credit card.
- Card options expose opaque DOM identifiers that appear distinct per account. Raw values must not leave the Amex page. A design may derive a one-way, user-scoped source fingerprint locally if legal/product review permits it.

## Benefit catalog surface

- `/card-benefits/view-all` displays card-specific benefit definitions grouped by category.
- Visible data includes benefit title, category, descriptive terms, whether enrollment is involved, and card-level status labels such as `Enrolled`, `Enrollment Required`, `Linking Required`, or no status label.
- The page currently loads versioned frontend modules such as `axp-benefits-view-all`, `axp-benefits-activity`, and `axp-benefits-trackers`; module versions demonstrate that upstream UI behavior is independently deployable and must be treated as unstable.

## Benefit activity surface

- `/card-benefits/activity` divides state into observable groups including:
  - benefits available for enrollment;
  - spend-progress trackers;
  - credits earned in the current period;
  - completed benefits.
- Trackers may expose used/earned amount, threshold, remaining amount, cycle wording, completion messages, enrollment state, and non-monetary counters such as visits.
- Amex warns that trackers may lag and may be reversed after refunds; imported state must include observation time and must not be represented as authoritative transaction accounting.
- Different card products expose different tracker mixes, confirming the parser must operate per selected card and tolerate absent sections.

## Candidate extraction approaches

Decision update: the rendered-DOM/packaged-extension recommendation and selector-traversal implications below record the initial research direction. They were superseded later on 2026-07-15 by the owner-approved, exact three-operation private-read userscript boundary documented in the task PRD and design. Chrome extension packaging and website synchronization remain future work.

1. **Rendered DOM/accessibility data**
   - Advantages: does not duplicate private Amex API calls or handle their authorization headers; directly reflects what the user can see.
   - Drawbacks: headings, text, test IDs, and section structure can change; localization complicates parsing.
2. **Existing in-page read responses**
   - The page loads read-oriented endpoints named `ReadLoyaltyBenefitsCardProduct.v1`, `ReadLoyaltyBenefits.v2`, and `ReadBestLoyaltyBenefitsTrackers.v1`.
   - Advantages: likely more structured and complete than visible DOM.
   - Drawbacks: undocumented/private contracts, potentially sensitive identifiers, more legal/maintenance risk, and a higher chance of touching reusable authorization material.

Recommendation: use a packaged Chrome extension and begin with a user-initiated, rendered-page extractor. Keep a versioned parser boundary and redacted fixture tests. Do not capture or relay private API headers or raw payloads. Re-evaluate structured in-page responses only after legal/privacy review and only with a strict field allowlist.

## Planning implications

- A single action must iterate supported account selector entries, navigate each card's benefits pages, wait for loading to settle, and produce an explicit completeness result per card.
- Unknown layouts, non-card entries, unrecognized status wording, or failed card switches must be reported rather than silently omitted.
- Last digits alone are insufficient for durable identity. The design needs a server-enforced user-scoped source link plus an ambiguity workflow.
- The website should receive only approved normalized fields, not raw HTML, raw Amex JSON, balances, reward totals, loyalty numbers, or upstream session material.

## Redacted private-read compatibility validation

Owner-only validation on 2026-07-15 confirmed that a manual scan issued only the approved member, tracker, and catalog read operations and did not change the visible route or selected card. No live response body, request body, token, identifier, display ending, amount, title, header, or storage export was retained for this update.

Safe schema-level findings:

- Member records can place the opaque token and product projection on the top-level record while placing `relationship` and explicit display ending inside a nested `account` projection. This shape occurred across multiple primary records. Supplementary wrappers use the same split: wrapper-level token/product with nested `account.relationship` and display ending.
- The parser may resolve `relationship` and display ending across outer and nested projections only when the fields are absent or agree. Conflicts remain unknown. Token and product resolution are not broadened for top-level records.
- Characterized tracker statuses are `ACTIVE`, `IN_PROGRESS`, and `ACHIEVED`. `IN_PROGRESS` maps to in-progress/incomplete, while `ACHIEVED` maps to completed/complete.
- Characterized tracker categories `spend`, `usage`, `access`, and `loan` carry progress state and normalize to the portable `spend_progress` activity kind while retaining the observed category. Characterized units include `MONETARY` and `PASSES`; currency can be `USD` or not exposed, so the parser must not infer a missing currency or quantity unit.
- Characterized catalog layouts are `ENROLLED`, `NOTENROLLED`, `LOGGEDIN`, and `SUPP`. `LOGGEDIN` and `SUPP` are non-candidate layouts and expose no enrollment state by themselves. `NOTENROLLED` creates a candidate only with explicit `isEnrollable=true`.
- Some supplementary tracker reads validly returned empty tracker arrays. Some corresponding catalog reads exhausted the existing retry policy with an HTTP `502`. A catalog-only transport, HTTP, or schema failure can therefore retain validated tracker observations as current but partial, with the fixed redacted issue code and no fabricated catalog/enrollment data. Cancellation and tracker failure remain hard card-attempt failures.

## Final owner-only userscript 0.2.1 validation

The final owner-only runtime validation was performed after reauthentication and a real page reload. Observation remained read-only and limited to request URL, method, and status metadata. No response or request payload, token, header, cookie, username, credential, card display value, benefit title, or amount was captured for this record.

### Validation sequence

- The first attempt after installing the update still used the userscript `0.2.0` instance already injected into the page because Tampermonkey updates require a page reload. That attempt reached seven card attempts, reported nine unknown account variants, and then encountered an expired session. It is not treated as the final `0.2.1` result.
- After reauthentication and reload, the corrected `0.2.1` parser discovered and attempted 16 distinct cards, replacing the earlier seven-attempt/nine-unknown result.
- The final scan completed with aggregate status `partial`, 16 locally stored card records, and 130 normalized trackable benefit observations.

### Sanitized aggregate result

- Card badges were seven `Current` and nine `Incomplete`, with no card `Error` or no-data records after the scan.
- Five repeated-product groups were represented by distinct stored cards. The largest same-product group contained four cards, confirming that duplicate product names did not collapse physical-card identities.
- Activity kinds comprised 22 completed, 58 spend-progress, and 50 enrollment-candidate observations.
- Completion fields comprised 22 complete, 58 incomplete, and 50 not exposed. Tracker fields comprised 22 completed, 58 in progress, and 50 not exposed. Enrollment fields comprised 36 enrolled, 68 required, and 26 not exposed.
- Six cards retained conservative unknown-quantity issues. Four had only that issue, while two also had benefit-identity conflicts; those two cards were the complete set of cards with benefit-identity conflicts. No quantity or identity value was inferred to remove a partial marker.

### Read-only transport evidence

- Three cards received catalog HTTP `502` responses on both the initial attempt and the one allowed retry. Each had a valid tracker response and was committed as a partial observation rather than an error/no-data record.
- The scan produced this endpoint metadata: one member `GET 200`, 16 tracker `POST 200`, 13 catalog `POST 200`, and six catalog `POST 502` results. The six catalog failures represent three initial attempts and one retry for each.
- No mutation-like request was observed. Network inspection retained URL/method/status metadata only and captured no payloads.
- The visible route and a SHA-256 digest of the route plus selected-display context were identical before and after the scan. The digest value was not retained in this record.

### Persistence and manual-start validation

- After another real page reload and reauthentication, the panel loaded the same 16 card records and 130 benefit observations from Tampermonkey storage.
- The panel returned to its manual idle state and displayed `Last scan partial... Nothing is scanned until you start.` The reload did not trigger a member or tracker scan.
- Normal Amex page traffic did include one catalog request during reload. This evidence therefore confirms that the userscript did not auto-start a scan; it does not claim that the Amex page itself made no private read calls.
- Live clear-data behavior had already been validated earlier in this task and was not repeated after the final scan so the persisted validation evidence remained available.
- Cancellation remains covered by automated tests rather than this final owner-only scan.

### Final automated check recorded before live validation

- Nine suites containing 66 tests passed.
- Strict TypeScript and targeted ESLint checks passed.
- The userscript build, audits, secret scan, JSON and JSONL validation, and diff/whitespace checks passed.
- The existing Next/SWC version mismatch warning is unrelated to this userscript validation.

## Codex Computer Use revalidation on 2026-07-17

The owner supplied an already authenticated Amex tab for a second end-to-end pass. The pass remained read-only. No login flow, enrollment, linking, activation, redemption, offer, payment, or other Amex mutation control was used. No authenticated Amex screenshot, storage export, response/request body, header, cookie, opaque token, card display value, benefit title, or amount was written to the repository.

### Restored-state and manual-start checks

- The supplied tab began on the Amex member home page. Navigating directly to the allowlisted `/card-benefits/view-all` route mounted one reader panel.
- Before a new scan, the panel restored all 16 prior card records, displayed the local-only and raw-response-not-saved disclosures, exposed an enabled **Scan all cards** control, and had no active cancellation control.
- The restored state retained the prior aggregate `partial` classification instead of describing mixed or incomplete data as fully current.

### Fresh live scan

- One manual scan attempted all 16 discovered cards and returned to idle with all 16 observation and attempt timestamps updated on 2026-07-17.
- Five duplicate-product groups containing 14 physical cards remained represented by separate stored records.
- The selected visible card matched a stored physical-card record. Of six visible benefit catalog tiles on that card, one exact title also appeared in the trackable stored observation set; the other visible tiles were not assumed to be user-specific trackable activity.
- The final aggregate remained `partial`. The panel exposed six `unknown_quantity`, two `benefit_identity_conflict`, and three `http_error` issue messages. No signed-out, timeout, content-type, redirect, storage, cancellation, or visible-context issue was exposed.
- The visible benefits route and selected-card context remained unchanged.

### Reload and persistence behavior

- A real reload restored the same 16 records and the same 130 normalized observations with unchanged observation timestamps.
- The reader returned to idle with **Scan all cards** enabled and no active **Cancel** control. The reload did not update any observation timestamp, which confirms that the userscript did not auto-start another scan.
- The stored normalized observations were deliberately left in place. Live clear-data behavior remains covered by the earlier owner validation, and cancellation/raw-lifetime behavior remains covered by the automated scan-engine and storage tests.

### Installed-script caveat

- Tampermonkey currently shows both the intended `0.2.1` userscript and an older `0.1.0` copy enabled.
- Only one reader panel mounted, and the observed scan behavior matched `0.2.1`; the older copy did not produce a second panel or duplicate scan in this pass.
- The older copy was not disabled or deleted because the owner did not authorize changing installed-script state. Removing or disabling it is recommended as environment cleanup so a future change in script ordering cannot expose the retired implementation.

### Repeated final quality gate

- Repository Jest: 42 suites passed; 300 tests passed and one test was skipped.
- Strict TypeScript passed with `--incremental false`.
- The isolated userscript build and `git diff --check` passed.
- Repository-wide lint still fails only on the eight pre-existing unused-variable errors outside the Amex task diff.
- The pre-existing Next.js `15.5.11` versus `@next/swc` `15.5.7` warning remains unrelated.

## Card-first UI revision validation on 2026-07-17

- A synthetic local preview used invented card and benefit data only; it made no provider request and contained no authenticated account information.
- The panel was visually checked at the available desktop viewport in its default, filtered, card-switched, scrolled, and expanded privacy states. The selected physical card remains the central workspace, ending digits distinguish duplicate products, pressed filter state is visible, and technical/data-quality information remains secondary.
- Automated panel coverage now includes 11 tests, including an explicit 16-card / 130-observation account, duplicate products, card switching, filter counts, compatible and incompatible quantities, empty filters, error/no-data, partial/stale quality, scan notes, cancellation, and confirmed local-data clearing.
- The final repository pass completed 42 suites with 304 passing tests and one skipped test; strict TypeScript, targeted ESLint, the isolated userscript build, task/artifact audits, and `git diff --check` passed. Repository-wide lint retains the same eight unrelated baseline errors.
- The ignored userscript artifact was rebuilt as `0.2.2` and the owner approved its installation. Tampermonkey's extension-owned update confirmation required the owner's manual click because browser automation cannot control that protected page.
- After sign-in, the supported Amex benefits route mounted exactly one new card-first panel. It restored 16 cards and 130 observations with nine data-note cards, showed the prior partial scan summary, exposed **Scan all cards**, and had no active cancel control. This confirms the installed update restored local state without auto-starting a scan.
- Verification read only sanitized panel aggregates. No authenticated screenshot, card label, ending digits, benefit title/amount, storage export, response/request data, credentials, or session material was retained.
