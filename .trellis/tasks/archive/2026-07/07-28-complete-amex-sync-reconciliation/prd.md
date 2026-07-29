# Complete AMEX sync reconciliation

## Goal

Make AMEX synchronization reliably reconcile plugin-discovered cards and credit-usage benefits with the correct PerksReminder records, require exact last-five card identity, and treat explicitly observed AMEX usage and completion as authoritative.

## Background

The existing AMEX reader and handoff already provide authenticated preview and confirmation, stable destination keys for a narrow Platinum scope, absolute usage/completion reconciliation, compare-and-set writes, provenance, idempotency, and row audits. The remaining gaps are incomplete catalog mapping and period support, four-or-five-digit card matching, manual/saved mapping bypasses, and incomplete transaction-time card identity checks.

The PerksReminder AMEX catalog currently contains 12 cards and 56 benefit rows. Writable synchronization is currently limited to the base U.S. Platinum card's Resy and Lululemon families. Repository-safe observations do not contain exact same-product title evidence for every catalog card and benefit, so full catalog coverage requires reviewed catalog-derived matching rules with fail-closed runtime ambiguity handling.

## Requirements

### R1 — Complete card and benefit identity mapping

- Review all 12 AMEX catalog cards and all 56 catalog benefit rows using the existing Platinum mapping approach as the baseline.
- Assign every catalog card a stable product key and every catalog benefit a stable product, family, and period identity.
- Classify every catalog benefit by source semantics.
- Synchronize only provider observations whose category represents actual credit `usage`.
- Keep free-night certificates, elite/status/access perks, and `spend` qualification trackers keyed but excluded from AMEX status writes.
- Build catalog-derived product and benefit mappings even when retained repository evidence does not contain the exact same-product AMEX wording.
- Resolve products through reviewed exact aliases first, then bounded fuzzy matching that requires one unique high-confidence candidate and a clear margin over the runner-up.
- Treat product-tier and business/consumer conflicts as disqualifying. Allow reviewed affiliation aliases, including Morgan Stanley Platinum to base Platinum.
- Skip low-confidence, tied, or hard-conflicting product matches without offering a manual product override.
- Resolve benefits only inside the already-resolved product through product-scoped structured merchant/core-phrase rules, compatible source period, and a unique candidate. Amount may validate a match but must not be its sole identity.
- Skip unsupported, duplicated, or ambiguous source benefits without affecting other unambiguous benefits on the card.
- Extend browser projection and independent server authority to the complete approved credit-usage mapping set; browser claims alone must not authorize destination writes.
- Support monthly, December-only, quarterly, fixed-quarter, half-year, calendar-year, and card-anniversary period identities required by the catalog.
- For Platinum `Uber Cash` in December, split aggregate observed usage sequentially: the first $15 maps to the regular monthly row and the next $20 maps to the December bonus. Derive completion separately for each destination; reject an unrepresentable aggregate instead of truncating it.

### R2 — Exact last-five prerequisite and card matching

- A PerksReminder AMEX card is eligible for synchronization only when exactly five ending digits are stored.
- Keep legacy local observations readable, but exclude source cards that do not expose exactly five ending digits from synchronization.
- Resolve a destination card only when authenticated ownership, AMEX issuer, active lifecycle, product identity, and exact five-digit equality all match.
- Require exactly one eligible destination card. Zero matches skip; multiple matches are ambiguous and skip.
- Do not match by user-supplied card name, four-digit suffix, closest card, or manual selection.
- Show one card-level skip message for each owned AMEX destination card missing exactly five digits, with a direct link to edit that card.
- Do not offer manual mapping as a missing-last-five or ambiguity bypass.
- Retain legacy saved mapping records for compatibility and audit history, but never let them expand current card identity authority.
- Revalidate owner, issuer, lifecycle, product, destination card, and exact last five inside the status-write transaction. A preview-to-confirmation identity change must require a new preview and write nothing.

### R3 — AMEX-authoritative benefit status

- For an unambiguously matched eligible card and benefit, explicitly observed AMEX credit usage and completion are the source of truth.
- Explicit AMEX used amount must overwrite PerksReminder `usedAmount`, including increases, decreases, and zero.
- Explicit AMEX completion must overwrite PerksReminder completion, including setting and clearing completion and the corresponding `completedAt` transition behavior.
- If AMEX omits one status field, preserve that field's existing value while applying any other explicit authoritative field.
- If AMEX omits the entire benefit, leave the PerksReminder benefit unchanged; absence is not evidence of zero usage or incompletion.
- AMEX does not overwrite `isNotUsable`; preserve the existing fail-closed behavior for such rows.
- Status reconciliation must not modify unrelated cards, benefits, cycles, users, or status fields.

### R4 — Compatibility, rollout, and safety

- Preserve the existing product-independent local observation model, private mailbox, authenticated same-origin preview/confirmation flow, explicit confirmation, proposal binding, ownership checks, provenance, idempotency, compare-and-set writes, and row auditing.
- Preserve existing non-AMEX card entry and card-management behavior.
- Use a coordinated versioned sync contract when the changed identity evidence is incompatible with the existing envelope.
- Keep unsupported, missing, duplicated, low-confidence, or ambiguous identities unwritable.
- Key and backfill existing deterministic catalog/user records additively. Preserve non-null conflicts and ambiguous/customized records rather than overwriting them.
- Any database-affecting backfill must be dry-run-first and separately authorized; implementation and tests must not run a production write.

## Acceptance Criteria

- [ ] All 12 AMEX catalog cards and all 56 benefit rows have stable product/family/period identities and explicit sync-semantics classification.
- [ ] Every approved credit-usage mapping exists in browser projection and independent server authority; excluded semantic classes have no write authority.
- [ ] Exact aliases resolve deterministically, while fuzzy product matching accepts only one high-confidence, clearly separated candidate without tier or business/consumer conflict.
- [ ] Benefit matching is product-scoped, period-compatible, and unique; unsupported or ambiguous source rows cannot write.
- [ ] All required calendar and anniversary period shapes resolve to one exact destination benefit/status cycle.
- [ ] December Platinum Uber usage splits sequentially into $15 monthly and $20 bonus destinations, and both destinations update atomically or neither does.
- [ ] Source and destination cards without exactly five ending digits are skipped and receive no AMEX-sourced update.
- [ ] Each destination missing-last-five skip appears once at card level with a direct card-edit link and no manual-mapping control.
- [ ] One owned, active AMEX card with matching product and exact last five resolves without relying on its display name.
- [ ] Ambiguous, unsupported, wrong-owner, wrong-issuer, inactive, wrong-product, or digit-mismatched cards cannot write.
- [ ] Legacy saved mappings remain stored but cannot bypass current exact identity requirements.
- [ ] Transaction-time identity changes cause a re-preview conflict and no status, provenance, or successful audit write.
- [ ] Explicit AMEX used amount and completion overwrite conflicting PerksReminder values, including decreases and completion clearing.
- [ ] Omitted fields and omitted benefits remain unchanged, and `isNotUsable` is not overwritten.
- [ ] Updates remain scoped to the authenticated user's exact matched card, benefit, period, and status.
- [ ] Existing non-AMEX behavior remains unchanged.
- [ ] Automated tests cover catalog invariants, product/benefit matching, period resolution, exact last-five policy, skip UI, saved-mapping non-authority, transaction revalidation, authoritative overwrite, omission preservation, December split atomicity, and ownership scoping.
- [ ] Safe type-check, lint, targeted tests, full tests, Prisma validation when applicable, and `git diff --check` pass before completion.

## Out of Scope

- Live AMEX website or production-data testing; the user will provide the live testing approach after implementation.
- Synchronizing free-night certificates, status/access perks, or provider `spend` qualification trackers.
- Renaming the legacy `lastFourDigits` database field or deleting legacy saved mapping rows.
- Applying a database backfill or enabling production write mode as part of this implementation.
