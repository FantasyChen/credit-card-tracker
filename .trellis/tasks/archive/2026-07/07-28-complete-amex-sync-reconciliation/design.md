# Technical Design — Complete AMEX Sync Reconciliation

## 1. Design principles

1. **Stable catalog identity is separate from write eligibility.** Every AMEX catalog row receives stable destination keys, but only actual provider `usage` credits receive synchronization authority.
2. **The browser observes and proposes; the server authorizes.** Browser matching may introduce claims, but the server must independently validate provider evidence and destination authority.
3. **Card identity is exact.** Product identity plus exact last five, owner, issuer, and lifecycle are mandatory at preview and write time. Names, manual choices, and saved mappings cannot expand authority.
4. **AMEX is authoritative only for explicit fields.** Explicit used amount/completion replaces local state; omission preserves local state.
5. **Ambiguity fails closed.** Product, benefit, card, period, and status resolution must each produce exactly one authorized result.
6. **Preserve existing safety boundaries.** Keep local product-independent observation, private transfer, authenticated preview/confirmation, signed proposals, compare-and-set writes, provenance, idempotency, and auditing.

## 2. Catalog identity and source-semantics registry

### 2.1 Destination keys

Complete the AMEX catalog so all 12 products have a stable `productKey` and all 56 benefit rows have a stable tuple:

```ts
{
  productKey: AmexProductKey;
  creditFamilyKey: AmexCreditFamilyKey;
  periodKey: AmexPeriodKey;
}
```

Keys are immutable semantic identifiers. They must not contain a mutable amount, marketing phrase, year, database ID, or occurrence ID. The tuple must be unique across the AMEX catalog.

The closed period vocabulary covers:

- recurring calendar month;
- December-only month;
- recurring calendar quarter;
- fixed Q1–Q4 rows;
- fixed H1/H2 rows;
- calendar year;
- card-anniversary quarter;
- card-anniversary year.

### 2.2 Source semantics

Maintain an AMEX-specific reviewed registry that classifies every catalog row as either:

- writable provider `usage` credit, with a stable provider-semantic source credit key; or
- excluded `spend` qualification, free-night certificate, elite/status/access benefit, or other non-credit perk.

The registry is code-owned and validated against the catalog. Catalog keys do not automatically grant write authority. Tests require complete 12-card/56-row classification, unique destination tuples, no authority for excluded rows, and no authority entry without a catalog destination.

### 2.3 Browser and server registries

Keep separate browser projection and server authority registries. They may share pure normalization utilities and type definitions, but the server must enumerate its own allowed products, source credits, periods, and destination tuples. Set-comparison tests detect drift without making browser data authoritative.

## 3. Product resolution

Resolution order:

1. Normalize Unicode, case, whitespace, punctuation, trademark symbols, `Amex`, and `American Express` deterministically.
2. Try reviewed exact aliases first.
3. Apply hard conflict filters before fuzzy scoring:
   - business versus consumer;
   - product tier conflicts;
   - core AMEX versus Hilton/Delta/Marriott cobrand conflicts;
   - incompatible cobrand families;
   - unreviewed affiliation variants.
4. Score remaining candidates with a deterministic weighted token similarity function.
5. Accept only one candidate meeting a named minimum score and a named minimum margin over the runner-up. Initial reviewed defaults are `0.88` score and `0.10` margin.
6. Otherwise return an explicit low-confidence, ambiguous, or hard-conflict disposition and exclude the source card from synchronization.

Morgan Stanley Platinum is a reviewed explicit alias for base Platinum. No general “closest card” fallback or manual product confirmation is added.

## 4. Benefit resolution

Benefit matching is always scoped to the independently resolved product.

Each writable source-credit descriptor contains:

- stable source credit key;
- reviewed exact normalized title aliases;
- required merchant/core-phrase token groups;
- forbidden tokens;
- compatible provider category (`usage` only);
- compatible period shapes;
- optional amount/target constraints used only for consistency.

Resolution order:

1. Require category `usage`.
2. Restrict candidates to the resolved product.
3. Prefer a unique exact alias.
4. Otherwise require one unique structured token-and-period match.
5. Use amount only as a constraint, never as sole identity.
6. Skip zero, duplicate, or multiple candidates without suppressing other unambiguous benefits on the card.

Non-credit, status/access, certificate, and `spend` observations never become writable rows even when their titles resemble catalog benefits.

## 5. Versioned browser-to-application contract

Keep the current local observation format readable, including historical four-digit observations. Introduce a coordinated new sync-envelope version because the write boundary changes materially.

Each source card carries bounded provider product-name evidence, claimed product key, exact five ending digits, observation metadata, and source benefits. Each source benefit carries bounded provider title/category evidence, a claimed source credit key, structured period, explicit amount/target/completion fields, and observation identity.

Contract rules:

- sync source ending must match `^\d{5}$`;
- category is literal `usage`;
- destination card/benefit/status IDs are forbidden;
- manual mappings are absent and rejected as unknown fields;
- provider evidence remains bounded and normalized—no raw response, token, credential, cookie, or account identity enters the envelope;
- existing card/row/size/age limits remain in force;
- incompatible older envelopes fail safely before planning.

The server independently resolves the product and benefit from provider evidence and requires those results to equal the browser claims before using destination keys.

## 6. Destination card resolution

A destination card is eligible only when it:

- belongs to the authenticated user;
- is active;
- is issued by American Express;
- has the independently resolved product key;
- stores exactly five numeric ending digits;
- exactly equals the source ending digits.

Exactly one eligible card is required. Zero matches produce a not-found or last-five prerequisite disposition. Multiple matches are ambiguous. User-defined card names are display-only.

Legacy saved mappings remain stored but are ignored as authority. The preview and confirmation APIs stop accepting manual selections and stop persisting new mapping overrides.

Preview also returns one deduplicated card-level missing-last-five result for each relevant owned destination card, including a server-derived link to the existing card-edit experience and ending-digits field. The handoff UI renders this separately from benefit rows and provides no selector or bypass.

Every applied write reloads and revalidates owner, issuer, lifecycle, product, destination ID, and exact last five inside the serializable transaction. Any change after preview returns a re-preview conflict and writes no status/provenance/success audit.

## 7. Destination period and status resolution

Replace quarter-only authority with a closed period resolver for all catalog shapes.

- Calendar month, quarter, half-year, and year require exact UTC boundaries.
- December-only authority additionally requires month 12.
- Fixed Q1–Q4 and H1/H2 keys require the matching exact range.
- Card-anniversary periods resolve only by exact equality with the already materialized destination status cycle; they are not inferred from calendar boundaries.
- Destination benefit identity still requires one exact product/family/period tuple.
- Destination status still requires the authenticated user, exact cycle range, and expected occurrence.

Missing or duplicate destination benefits/statuses remain unwritable.

## 8. Authoritative status reconciliation

For ordinary one-to-one credits, reconcile each explicit AMEX field independently:

- explicit used amount replaces `usedAmount`, including downward correction and zero;
- explicit completion replaces completion, including clearing completion;
- `completedAt` follows the existing transition rules: set on incomplete-to-complete, preserve while complete remains complete, clear on complete-to-incomplete;
- omitted used amount preserves existing amount;
- omitted completion preserves existing completion;
- an omitted benefit produces no plan row and no inferred reset;
- `isNotUsable` remains locally controlled and prevents unsafe modification;
- an unchanged computed state produces an unchanged result while retaining appropriate observation/provenance behavior.

No unrelated status fields are modified.

## 9. Platinum December Uber split

One December source observation expands into two destination rows:

```text
monthly = min(observed, $15)
bonus   = min(max(observed - $15, $0), $20)
```

Completion is derived independently from each destination target. The aggregate amount is required, must be nonnegative USD, and must not exceed $35. An unrepresentable amount is rejected rather than truncated.

Both destination rows share an atomic group identity and are revalidated and applied in one serializable transaction. Missing, ambiguous, stale, or conflicting state for either destination updates neither. Other independent benefit groups retain current partial-failure isolation.

## 10. Proposal, persistence, and public responses

The signed proposal binds the new envelope version, authenticated user, mode, envelope digest, resolved card identities and exact endings, ordered destination plan, source observation identities, atomic groups, before-state digest, and expiry.

Remove manual-mapping inputs and digests. Preserve idempotency and completed-attempt replay. Group persistence extends the current row transaction model: ordinary observations create one-row groups; December Uber creates one two-row atomic group. Provenance and row audit remain destination-specific.

Public preview/confirmation responses add:

- deduplicated card-level skips;
- explicit product/benefit/card/period/status reasons;
- planned-row identity and source observation identity;
- atomic group identity where applicable;
- field-level before/after information already needed by the handoff.

The handoff removes mapping state/options, renders actionable missing-last-five cards, renders split rows distinctly, and preserves authentication, preview/confirm separation, no-store/no-index behavior, and strict response validation.

## 11. Catalog propagation and backfill

No Prisma DDL change is required. Existing key columns, legacy ending-digits storage, mappings, attempts, provenance, and row audits are retained.

Update the shared static catalog, seed propagation, user-card creation, and every deterministic clone/import path to carry the complete key tuple.

Extend the existing deterministic catalog backfill into a dry-run-first operator path:

1. validate catalog/authority invariants;
2. match predefined and user cards/benefits through exact existing classifiers and complete benefit shape;
3. fill only null keys;
4. preserve and report non-null conflicts, duplicates, ambiguity, and custom unmatched records;
5. materialize only missing statuses needed by newly keyed writable benefits;
6. never modify an existing status amount/completion during backfill;
7. make apply mode explicit, bounded, and idempotent.

This task implements and tests the path but does not run an apply operation or touch production data.

## 12. Compatibility, rollout, and rollback

- Develop and test with sync mode off or synthetic fixtures only.
- Release application and userscript contract changes together. Production userscript releases must increase the previously installed version strictly; the final reviewed artifact is `0.5.1`, superseding `0.5.0`.
- The production artifact is generated under ignored `build/` output and is not distributed by Vercel. Publishing/installing that artifact is a separate, explicitly authorized release action.
- Enable preview before write in an eventual rollout.
- A code rollback first disables sync mode. Additive valid catalog keys may remain populated.
- Never delete saved mappings, attempts, audits, or provenance during rollback.
- If a bad write occurs later, use row-audit before/after evidence for a targeted reviewed repair rather than blanket status resets.

## 13. Main trade-offs

- **Full inferred catalog mapping versus exact retained evidence:** the approved design favors complete catalog-derived descriptors, bounded by unique runtime matching and independent server authority.
- **Fuzzy products versus correctness:** fuzzy matching is permitted only after hard conflict filtering and only with an explicit score/margin threshold.
- **Catalog completeness versus write breadth:** all rows are keyed, but only actual credit usage is writable.
- **Legacy compatibility versus cleaner schema:** keep the misleading `lastFourDigits` field name and legacy mapping rows to avoid unrelated migration risk.
- **December coverage versus source ambiguity:** use the approved sequential $15/$20 split and atomic writes rather than leaving the bonus manual.
