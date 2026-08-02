# Global Benefit Definitions and Migration

## Scenario: shared standard definitions, effective benefit reads, and exact legacy transition

### 1. Scope / Trigger

Use this contract when changing the checked-in card catalog, synchronizing `PredefinedCard` / `PredefinedBenefit`, creating or materializing benefit statuses, projecting standard/custom benefits, classifying copied legacy definitions, bridging or cleaning legacy rows, rolling back bridge metadata, cloning globally linked rows, or resolving a global definition as an AMEX destination.

The target model separates definition ownership from user state:

```text
checked-in static catalog
  -> stable keyed PredefinedCard / PredefinedBenefit definitions
  -> owned physical CreditCard linked by predefinedCardId
  -> BenefitStatus user state
       standard: creditCardId + predefinedBenefitId
       bridge:   creditCardId + predefinedBenefitId + retained benefitId
       custom:   benefitId, with no predefinedBenefitId
       legacy:   benefitId only during the migration/rollback window
  -> one effective server projection
  -> dashboard, home, authenticated APIs, notifications, calendar, and guides
```

`Benefit` is the user-owned custom-definition model. Standard definitions are not copied into `Benefit` for new cards. Nullable global keys and relations exist only for additive migration compatibility; they are not permission to infer identity.

This specification defines code and operator behavior. It does not authorize schema deployment, database reads, catalog apply, legacy bridge/cleanup/rollback, production configuration, AMEX preview/write mode, browser installation, or live provider activity. Each such operation remains separately authorized under [Database and Data Safety](database-and-data-safety.md) and [Deployment and External Effects](deployment-and-external-effects.md).

### 2. Signatures

#### Catalog validation and synchronization

```ts
interface StaticPredefinedCard {
  catalogKey: string;
  productKey?: string;
  name: string;
  issuer: string;
  annualFee: number;
  imageUrl: string | null;
  benefits: readonly StaticPredefinedBenefit[];
}

interface StaticPredefinedBenefit {
  catalogKey: string;
  parentCatalogKey: string;
  productKey?: string;
  creditFamilyKey?: string;
  periodKey?: string;
  category: string;
  description: string;
  percentage: number;
  maxAmount: number;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";
  cycleAlignment?: "CARD_ANNIVERSARY" | "CALENDAR_FIXED";
  fixedCycleStartMonth?: number;
  fixedCycleDurationMonths?: number;
  occurrencesInCycle?: number;
}

validateStaticCatalog(
  cards: readonly StaticPredefinedCard[],
): {
  cards: number;
  benefits: number;
  amexCards: number;
  amexBenefits: number;
  amexWritableBenefits: number;
};

const GLOBAL_CATALOG_SYNC_CONFIRMATION = "SYNC_GLOBAL_CATALOG";

runGlobalCatalogSyncOperator({
  source,
  database,
  mode?,             // "dry-run" by default, or "apply"
  targetVerified?,   // must be true for apply
  confirmApply?,     // exact constant above for apply
  now?,
}): Promise<{
  mode: "dry-run" | "apply";
  source: { cards: number; benefits: number };
  plan: {
    cards: CatalogSyncCounts;
    benefits: CatalogSyncCounts;
    conflictCount: number;
  };
}>;
```

```bash
npm run sync:global-catalog -- [--dry-run | --apply] \
  [--target-verified] [--confirm=SYNC_GLOBAL_CATALOG]
```

Synchronization actions are the closed set `create | adopt | update | retire | unchanged`. `adopt` may assign a key only to one bidirectionally unique, unkeyed legacy global row with an exact canonical shape. Provider identity must either be wholly absent on the legacy row or wholly equal to the source; adoption is not a key rename or a conflicting identity overwrite.

#### Effective status union and materialization

```ts
type EffectiveBenefitSource =
  | { kind: "standard"; predefinedBenefitId: string; creditCardId: string }
  | {
      kind: "bridge";
      predefinedBenefitId: string;
      creditCardId: string;
      legacyBenefitId: string;
    }
  | { kind: "custom"; benefitId: string; creditCardId: string | null }
  | { kind: "legacy"; benefitId: string; creditCardId: string | null };

interface EffectiveBenefitStatus {
  id: string;
  benefitId: string; // compatibility identity; synthetic only for global-only rows
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  usedAmount: number | null;
  isCompleted: boolean;
  completedAt: Date | null;
  isNotUsable: boolean;
  orderIndex: number | null;
  source: EffectiveBenefitSource;
  isCustomBenefit: boolean;
  canMutateDefinition: boolean;
  // compatible effective definition/card fields consumed by existing callers
}

fetchEffectiveBenefitStatuses(
  database,
  filters: { userId: string } | { userIds: string[] },
): Promise<EffectiveBenefitStatus[]>;

findEffectiveBenefitStatus(
  database,
  userId: string,
  statusId: string,
): Promise<EffectiveBenefitStatus | null>;

planBenefitStatusMaterialization(
  standardDefinitions: StandardMaterializationDefinition[],
  customDefinitions: CustomMaterializationDefinition[],
  referenceDate: Date,
): {
  rows: Array<{
    benefitId: string | null;
    creditCardId: string | null;
    predefinedBenefitId: string | null;
    userId: string;
    cycleStartDate: Date;
    cycleEndDate: Date;
    occurrenceIndex: number;
  }>;
  warnings: string[];
};
```

Standard occurrence uniqueness is `(creditCardId, predefinedBenefitId, userId, cycleStartDate, occurrenceIndex)`. Custom occurrence uniqueness is `(benefitId, userId, cycleStartDate, occurrenceIndex)`. Persistence is insert-only with conflict handling; planning or materialization never updates an existing status.

#### Legacy migration operator

```ts
const GLOBAL_BENEFIT_BRIDGE_CONFIRMATION =
  "BRIDGE_EXACT_GLOBAL_BENEFITS";
const GLOBAL_BENEFIT_CLEANUP_CONFIRMATION =
  "CLEANUP_LEDGER_PROVEN_GLOBAL_BENEFITS";
const GLOBAL_BENEFIT_ROLLBACK_CONFIRMATION =
  "ROLLBACK_LEDGER_PROVEN_GLOBAL_BENEFITS";

runGlobalBenefitMigrationOperator({
  mode?,                    // "dry-run" by default; "apply" | "cleanup" | "rollback"
  limit?,                   // 1..500, default 100
  after?,                   // validated one-way opaque v2 cursor; contains no row key
  targetVerified?,          // true for every non-dry-run mode
  confirmation?,            // exact mode-specific phrase
  parityVerified?,          // additionally true for cleanup
  recoveryPointVerified?,   // additionally true for cleanup
  expectedSourceFingerprint?, // exact reviewed dry-run batch fingerprint for writes
  database,
}): Promise<GlobalBenefitMigrationReport>;
```

```bash
npm run migrate:global-benefits -- [--dry-run | --apply | --cleanup | --rollback] \
  [--limit=N] [--after=CURSOR] \
  [--target-verified] [--confirm=PHRASE] \
  [--parity-verified] [--recovery-point-verified] \
  [--expect-fingerprint=SHA256]
```

No mode means dry-run. Multiple mode flags, unknown flags, malformed cursors, unbounded/non-ascending pages, and limits outside `1..500` are rejected. Reports expose only mode, limit, pagination state, opaque next cursor, batch fingerprint, aggregate counts, and closed reason counts; user, row, target, and source values remain private.

The closed classification reasons are:

```ts
type LegacyMigrationReason =
  | "exact_standard_match"
  | "standalone_custom"
  | "unmatched_card_custom"
  | "unmatched_benefit_custom"
  | "card_product_ambiguous"
  | "card_identity_conflict"
  | "benefit_match_ambiguous"
  | "benefit_identity_conflict"
  | "ownership_inconsistent"
  | "relationship_inconsistent"
  | "duplicate_standard_destination"
  | "ledger_conflict";
```

#### AMEX global destination authority

```ts
resolveAmexGlobalDefinitionAuthority({
  product: DestinationPredefinedCardSnapshot,
  benefit: DestinationPredefinedBenefitSnapshot,
  sourceCreditKey: string,
}): AmexCatalogBenefitIdentity | null;

amexDestinationDefinitionFingerprint({
  product,
  benefit,
  sourceIdentity,
}): string; // deterministic SHA-256 hexadecimal digest

interface AmexSyncPlanRow {
  destinationCardId: string | null;
  destinationPredefinedCardId: string | null;
  destinationProductCatalogKey: string | null;
  destinationPredefinedBenefitId: string | null;
  destinationBenefitCatalogKey: string | null;
  destinationDefinitionFingerprint: string | null;
  destinationStatusId: string | null;
  destinationOccurrenceIndex: number | null;
  destinationCycleStartInstant: string | null;
  destinationCycleEndInstant: string | null;
  destinationBenefitId: string | null; // legacy bridge metadata only
  beforeProvenance: DestinationProvenanceSnapshot | null;
  // source evidence, exact last five, source period, before/after state, grouping
}
```

The proposal binds the ordered plan through `destinationAuthorityDigest`, as specified in [AMEX Sync Reconciliation](amex-sync-reconciliation.md). Public envelope, request, and response DTOs do not expose these internal fields.

### 3. Contracts

1. **Catalog keys are explicit immutable identity.** Every checked-in card and benefit declares a unique opaque `catalogKey` matching the closed key format and the benefit declares its exact parent key. Keys are never generated from a mutable name, description, amount, order, array index, database ID, or AMEX display evidence. Once assigned, a key is not renamed or reused for another definition; a semantic replacement receives a new key and the old definition is retired.
2. **The static catalog is the DB-free source.** `src/lib/static-catalog.ts` is the checked-in source for anonymous public catalog reads and persistence synchronization. Public anonymous routes do not query Prisma. `prisma/seed.ts` may consume the same source but is not the routine synchronization or existing-user propagation mechanism.
3. **Validation precedes every plan or write.** Validation rejects missing/invalid/positional/duplicate keys, duplicate product names or product keys, parent mismatch, partial AMEX identity, static/registry mismatch, duplicate AMEX destination tuples, source-authority mismatch, and non-AMEX provider identity. AMEX completeness remains exactly 12 products, 56 benefits, and 47 writable `usage` destinations; non-`usage` rows have no source credit.
4. **Synchronization preserves identity and references.** Planning is deterministic by key. Apply runs in a serializable transaction, re-plans from current rows, compare-and-sets existing IDs/key/`updatedAt`, creates parents before children, updates only approved canonical fields, clears retirement when the same key returns, and marks absent keyed rows retired. It never deletes or recreates a global definition, changes its ID/key, hard-deletes a referenced row, mutates a user status, or populates legacy user-row AMEX keys.
5. **Unkeyed adoption is exact and bounded.** One source card may adopt exactly one unkeyed global card whose canonical name, issuer, annual fee, and image match exactly. One source benefit may adopt exactly one unkeyed child under that exact parent whose canonical category, description, percentage, amount, frequency, alignment, fixed-cycle settings, and occurrence count match exactly. For either kind, every stored provider-identity field must be wholly null (bootstrap of newly introduced metadata) or the complete identity must equal the source; partial or conflicting identity is never overwritten. Each candidate must map to exactly one source and each source to exactly one candidate. Ambiguous or unmatched rows are conflicts; apply stops rather than creating a competing identity or choosing a nearest row.
6. **Global definitions own standard terms.** `PredefinedCard` and `PredefinedBenefit` contain current approved canonical terms and global AMEX identity. Standard terms are read-only to users and have no per-user override or revision layer. A canonical field update changes the effective displayed definition for every linked standard status but does not rewrite historical user state or materialized cycle coordinates.
7. **BenefitStatus is an explicit source union.** A global-only standard status has owned `creditCardId` and `predefinedBenefitId` and no `benefitId`. A custom status has an owned `benefitId` and no `predefinedBenefitId`; its custom `Benefit` may be standalone or linked to an owned card. A bridge status temporarily has all three links and remains standard because global identity wins. A legacy-only row is a compatibility state, not authority for new standard writes. Invalid source-less, cross-owner, or cross-product rows fail closed.
8. **One effective projection owns read semantics.** Dashboard, home, authenticated API, notification, calendar, and usage-guide consumers use the effective projection or a typed adapter from it. If `predefinedBenefitId` exists, global definition/card fields are authoritative and the retained legacy `Benefit` is not an override. Otherwise the owned custom/legacy `Benefit` supplies definition fields. Persisted status state, exact cycle instants, occurrence, order, and timestamps always come from `BenefitStatus`.
9. **Mutation capability follows source kind.** Standard and bridge rows set `isCustomBenefit: false` and `canMutateDefinition: false`; user routes omit or reject definition edit/delete. A classifier-proven standard legacy row remains read-only during a `CLASSIFIED`-before-`BRIDGED` window. Only a valid owned custom row can expose definition mutation; all status transitions still reload and scope the status by authenticated `userId`.
10. **Card creation creates global state atomically.** Adding a standard card validates one active global product, then creates the owned physical `CreditCard` with `predefinedCardId`, its card event, and standard statuses from active global benefits in one transaction. It creates no copied standard `Benefit`. Duplicate physical cards for one product remain distinct by `CreditCard.id` and receive independent statuses.
11. **Propagation is additive and insert-only.** Materialization enumerates active physical cards with active global definitions and custom definitions separately, derives cycles through the shared cycle owner, and inserts only missing source-specific occurrence tuples. A newly added active global benefit reaches every existing active linked physical card through bounded materialization. Retirement stops future status creation but never hides, deletes, resets, or recalculates an existing status.
12. **Definition changes never rewrite status history.** Catalog synchronization and materialization preserve status ID, owner, card, source links except an explicitly authorized bridge/cleanup transition, exact cycle instants, occurrence, amount, completion, completion timestamp, usability, order, audit, provenance, and status timestamps. If an existing occurrence conflicts with newly derived coordinates, report/stop rather than update it.
13. **Legacy classification is exact and conservative.** A physical card maps only when exact stored issuer/name and every non-null identity signal agree with exactly one global product. Standalone benefits are custom. A card-linked benefit is standard only when every canonical shape field represented globally—category, description, percentage, amount, frequency, alignment, fixed start/duration, and occurrence count—matches exactly one active or retired global child and the complete owner/card/status/audit/provenance graph is consistent. Valid zero-match rows remain custom; ambiguity, contradiction, duplicate destination occurrence, ledger conflict, or cross-user relation is unresolved and blocks the complete card unit.
14. **Bridge apply is dry-run-bound and preserving.** Every write batch requires the exact reviewed `sourceFingerprint`. In one serializable transaction per unit, the writer re-reads/reclassifies the graph, compare-and-sets the card/global links, adds `creditCardId` / `predefinedBenefitId` to existing standard statuses while retaining `benefitId`, adds global audit metadata, and upserts one ledger row keyed by legacy benefit. It creates, deletes, merges, recalculates, or resets no status and verifies that only approved bridge/ledger metadata changed. Custom classification writes only its idempotent ledger evidence.
15. **Cleanup is a separate deletion boundary.** Cleanup additionally requires `parityVerified === true`, `recoveryPointVerified === true`, the cleanup phrase, target verification, reviewed fingerprint, and exact `BRIDGED` ledger coverage. It compare-and-sets every relation, nulls `BenefitStatus.benefitId`, deletes exactly one ledger-proven copied standard `Benefit` only when no incompatible reference remains, advances the ledger to `CLEANED`, and verifies the copy and legacy links are absent. Custom, unresolved, unledgered, and inferred rows are never deleted.
16. **Rollback is ledger-scoped and pre-cleanup only.** Rollback requires target verification, its exact phrase, and the reviewed fingerprint. For exact `BRIDGED` rows it clears only bridge-added status/global audit fields, preserves the copied `Benefit` and every status value, marks the ledger `ROLLED_BACK`, and clears the card's global link only when no bridged standard row remains. `CLEANED` rows cannot be recreated by inference; recovery is a reviewed forward repair or database recovery.
17. **Clone rebinding uses keys, not source IDs.** The sanitized single-user production-to-development clone resolves every global product and benefit in the destination by immutable `catalogKey`, validates bridge ledger/audit links, and preserves standard/custom/bridge meaning. It never copies source global database IDs as destination authority and retains all secret/token/number redaction rules in [Database and Data Safety](database-and-data-safety.md).
18. **Old per-user AMEX key apply is permanently superseded.** `backfill:amex-catalog --apply` exits before a writer with a stable superseded result. It may not populate `CreditCard.productKey` or `Benefit.productKey` / `creditFamilyKey` / `periodKey` as write authority. Those legacy columns remain rollback/diagnostic compatibility only.
19. **AMEX authority traverses the global graph.** A writable destination is exactly one owned active AMEX physical card with exact five digits and a registry-valid `predefinedCard`, exactly one registry-valid writable global benefit under that product, and exactly one owned standard/bridge status whose `creditCardId`, `predefinedBenefitId`, occurrence, and persisted cycle match. Card names, user-row keys, custom benefits, legacy-only statuses, and `ExternalCardMapping` never authorize writes. Retired definitions may authorize only an already-existing exact standard status; they never materialize a new status.
20. **Definition fingerprint drift requires re-preview.** The fingerprint covers global product key/issuer/product/retirement state; benefit key/parent/canonical amount and cycle fields/AMEX tuple/retirement state; and registry source semantics/source credit. The ordered destination digest also binds physical/global/status IDs and keys, exact last five, exact persisted cycle instants, source period/evidence, before state, provenance, transition, and atomic grouping. Any difference at confirmation yields `conflict_repreview_required` before successful status/provenance/audit writes.
21. **AMEX confirmation reloads global authority transactionally.** In the existing serializable single/group writer, reload status, owned card, global product, global benefit, exact last five, lifecycle/issuer, source tuple, fingerprint, occurrence, exact cycle instants, before state, and provenance. First compare source-period UTC dates; then use the transaction-loaded exact persisted instants in the final compare-and-set. Status, provenance, and audit—including `destinationPredefinedBenefitId`, fingerprint, status/card IDs, and bounded legacy `destinationBenefitId`—succeed atomically. December Uber retains two-row atomicity.
22. **Operational rollout remains separate.** Implemented code and passing synthetic tests do not authorize or prove a database migration, catalog sync, legacy bridge/cleanup/rollback, deployment, production parity, AMEX configuration, preview, or write. Production capability stays `off` until the separately reviewed rollout completes every target, recovery, migration, catalog, bridge, parity, and activation gate.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Catalog key is missing, malformed, positional, duplicated, renamed, or reused | Reject validation/planning; do not infer identity or write |
| Benefit parent key differs from its source card | Reject the complete catalog |
| AMEX identity is partial, tuple-duplicated, registry-inconsistent, or writable without `usage` source authority | Reject the complete catalog before persistence planning |
| One bidirectionally unique unkeyed global row has exact canonical shape and provider identity is wholly absent or wholly exact | Plan `adopt`; preserve its database ID and existing references, and populate only the reviewed source identity |
| Provider identity is partial/conflicting, zero/multiple unkeyed rows match, or an unkeyed row remains unclaimed | Report a conflict; apply writes nothing |
| Existing keyed canonical fields differ | Plan a key-preserving update; do not alter user status/cycle state |
| Existing keyed definition is absent from source | Set `retiredAt`; never hard-delete it |
| A retired key returns in the checked-in source | Clear retirement on the same row/ID after compare-and-set validation |
| Catalog plan/database changes before apply | Abort with compare-and-set conflict; do not apply a stale partial plan |
| Standard status has global benefit under a different global product/card | Fail the projection/materialization/authority path closed |
| Bridge status has legacy terms different from current global terms | Project current global terms; retain legacy fields only for rollback/diagnosis |
| Custom status references another user's benefit or card | Reject/omit mutation; perform no write |
| New active global benefit exists for existing active linked cards | Materialize only missing standard occurrences for each physical card |
| Global benefit is retired | Create no future status; keep previously materialized statuses visible and unchanged |
| Materialization encounters an existing occurrence | Skip through source-specific uniqueness; never update/reset it |
| Legacy card has exact issuer/name but conflicting non-null identity evidence | `card_identity_conflict`; block the complete card unit |
| Standalone legacy benefit | Classify `custom`; never attach it to a global definition by shape |
| Card-linked benefit has one exact full-shape destination and consistent graph | Classify `standard`; bridge only under gated apply |
| Card-linked benefit has zero exact destinations and otherwise valid ownership | Preserve as `custom` |
| Multiple shape matches, duplicate destination occurrence, or ownership/audit/provenance inconsistency | Classify unresolved, block the unit, and preserve all rows |
| No migration mode | Dry-run; call no bridge/cleanup/rollback writer |
| Non-dry-run lacks target verification, exact phrase, or reviewed source fingerprint | Reject before writer invocation |
| Database page is over limit, out of ID order, behind the cursor, or cursor is malformed | Reject the batch; expose no private key in the report |
| Source graph changes after reviewed dry-run | Fingerprint/reclassification mismatch; roll back the unit |
| Bridge reruns with exact ledger/links | Return idempotent aggregate result; rewrite no user state |
| Cleanup lacks parity or recovery-point attestation | Reject before cleanup writer invocation |
| Cleanup sees a non-`BRIDGED`, conflicting, unledgered, custom, or referenced copy | Abort transaction; delete nothing |
| Rollback sees a `CLEANED` ledger | Refuse inferred recreation; require forward repair or database recovery |
| Old per-user AMEX backfill receives `--apply` | Return the stable superseded result before any database writer |
| Destination matches only `CreditCard.productKey` / user `Benefit` keys | No AMEX authority; return missing/conflicting destination as applicable |
| Destination is custom, legacy-only, wrong-owner, inactive, non-AMEX, four-digit, or relation-conflicting | Fail closed; write no status/provenance/success audit |
| Global definition/retirement/fingerprint changes after preview | `conflict_repreview_required`; require a new preview |
| Status cycle has an inclusive end-of-day instant | Authorize by UTC date, then compare-and-set using the exact transaction-loaded instant |
| Existing exact status belongs to a retired global definition | It may remain writable only if every global tuple/status/fingerprint check passes; create no replacement status |
| Production operation is requested as routine verification | Skip and report it separately; static/unit checks are not operational authorization |

### 5. Good / Base / Bad Cases

- **Good:** A new checked-in benefit has a new explicit key under an existing product. Dry-run plans one global create. After separately authorized synchronization and bounded materialization, each active linked physical card receives one standard status, existing statuses remain byte-for-byte unchanged, and public anonymous catalog reads still use static data.
- **Good:** An approved description or amount changes under the same catalog key. Synchronization preserves global IDs and links; the effective projection shows the latest terms while each status keeps its original cycle instants, amount used, completion, usability, timestamps, audit, and provenance.
- **Good:** An exact copied legacy standard benefit bridges in place. The status retains its ID, `benefitId`, occurrence, inclusive cycle instants, state, order, and timestamps while gaining exact card/global links; the ledger and audit receive bounded global metadata atomically.
- **Good:** AMEX confirmation reloads an owned physical card, registry-valid global product/benefit, and standard bridge status. It verifies the same fingerprint and source period by UTC date, then uses the loaded inclusive cycle instants in the compare-and-set and records global plus bounded legacy audit identity atomically.
- **Base:** A global benefit is retired after statuses exist. The statuses remain visible through the effective projection and may remain exact historical AMEX destinations, but materialization creates no new rows for the retired definition.
- **Base:** A valid card-linked user benefit has no exact global shape match. It remains a custom definition and status source; the operator records only custom classification and never assigns global AMEX authority.
- **Base:** Before cleanup, rollback clears exact ledger-added global links and restores legacy reads without recreating or resetting anything. After cleanup, the same request is refused and recovery uses the recovery point or a reviewed forward fix.
- **Bad:** Generate keys from array indexes or descriptions, delete/reseed global rows, copy each standard benefit into every user's `Benefit`, update existing cycles after a terms change, infer a standard match from name/amount alone, or treat migration cleanup as part of ordinary bridge apply.
- **Bad:** Authorize AMEX from `CreditCard.productKey`, user `Benefit` family/period keys, card display name, a saved mapping, or four ending digits; trust a preview after a global definition changed; or write a reconstructed midnight cycle end.
- **Bad:** Run a database-backed dry-run, synchronization apply, bridge, cleanup, rollback, seed, migration, preview, or write merely to prove that documentation or unit tests pass.

### 6. Tests Required

For changes to this contract, assert:

- every static card/benefit has one explicit valid globally unique non-positional key and exact parent; key/name/product duplication, key reuse/rename fixtures, and parent mismatch fail before planning;
- AMEX static/registry parity remains 12 products, 56 definitions, 47 writable `usage` rows, unique destination tuples, complete identity, and null source credit for excluded semantics;
- catalog no-mode/default dry-run, exact apply gates, deterministic create/adopt/update/retire/unchanged counts, bidirectionally unique canonical-shape adoption with wholly absent or wholly exact provider identity, partial/conflicting identity rejection, ambiguous/unmatched conflict, parent-before-child writes, ID/key preservation, retirement/reactivation, serializable re-plan, and compare-and-set drift rollback;
- catalog synchronization never deletes global rows, mutates statuses, fills user-row AMEX keys, or gives public anonymous routes a Prisma dependency;
- effective projection covers global-only standard, bridge, classifier-proven pre-bridge standard, standalone custom, card-linked custom, and legacy fallback; global-first terms, direct guide identity, stable physical card identity, source-kind capability flags, owner scoping, and invalid source/cross-product rejection are explicit;
- standard card creation is one transaction, links `predefinedCardId`, creates its event and standard statuses, creates no standard `Benefit`, and fully rolls back on any failure;
- materialization shares cycle logic, separates standard/custom source tuples, is bounded/idempotent/insert-only, propagates new active definitions to every active physical card, excludes retired definitions from future creation, preserves duplicate physical products, and never updates an existing status;
- catalog term updates and materialization reruns preserve exact cycle instants, occurrence, amount, completion, `completedAt`, usability, order, IDs, source links, audits, provenance, and timestamps except for explicitly tested bridge/cleanup metadata;
- classifier fixtures cover exact card identity, every full-shape field, active/retired definitions, standalone custom, valid unmatched custom, zero/multiple benefit matches, conflicting user keys, duplicate destination occurrences, cross-owner card/status/audit/provenance links, ledger conflicts, and deterministic order reversal;
- migration default dry-run calls no writer; mode exclusivity, unknown flags, limit `1..500`, opaque cursor validation, ordered bounded pages, `hasMore`, aggregate-only reports, closed reasons, and no identity/target leakage are enforced;
- bridge/cleanup/rollback each require target verification, exact mode phrase, and reviewed batch fingerprint; cleanup additionally requires parity and recovery point; drift is detected before mutation;
- bridge writes are serializable and idempotent, retain legacy links, preserve every status/audit/provenance field and timestamp, add only approved card/global/audit/ledger metadata, and roll back completely after any compare-and-set/post-verification failure;
- cleanup deletes only one exact ledger-proven standard copy after nulling verified legacy status links, preserves custom/unresolved rows, advances the ledger, and rolls back on residual or conflicting references;
- pre-cleanup rollback clears only ledger-added status/card/audit global metadata, preserves legacy rows and user state, is idempotent, and refuses `CLEANED` rows;
- sanitized clone rebinding resolves global definitions by destination `catalogKey`, rejects zero/multiple/cross-product matches, preserves standard/custom/bridge links and aggregate-only reporting, and never copies source global IDs as authority;
- old `backfill:amex-catalog --apply` invokes no writer and returns the stable superseded outcome;
- AMEX planning succeeds from physical-card/global-product/global-benefit/standard-status relations even when user keys are null, and fails when only user keys, names, saved mappings, custom rows, or legacy-only rows match;
- AMEX product/benefit registry tuple, writable semantics, exact owner/lifecycle/issuer/last-five, exact one-card/one-benefit/one-status resolution, retired-existing-status behavior, definition fingerprint fields, and ordered destination digest binding are covered;
- confirmation revalidates every global relation and fingerprint, exact source dates plus persisted cycle instants, occurrence, before state, and provenance inside serializable single/group writes; definition/card/cycle/state/provenance drift yields no successful mutation/audit;
- explicit amount decrease/zero, completion set/clear/timestamp preservation, not-usable skip, newer no-op provenance, replay/partial retry, audit global/legacy metadata, row isolation, and December two-row atomicity remain unchanged;
- public envelope/mailbox/request/response snapshots and userscript artifacts remain unchanged because global destination fields are server-internal;
- strict TypeScript, targeted catalog/runtime/migration/AMEX tests, `npm run check:public-db`, `npm run check:amex-userscripts`, sensitive-pattern review, structured config parsing, link review, context discovery, and `git diff --check` pass without database or external effects.

Do not use production builds, Prisma generation/migration/seed/status, database-backed catalog or migration operators, provider/browser actions, live AMEX preview/confirmation, or production configuration as routine verification.

### 7. Wrong vs Correct

#### Catalog identity and synchronization

```ts
// Wrong: mutable content and position manufacture identity, and reseeding
// destroys referenced IDs.
const key = `benefit-${cardIndex}-${benefit.description.toLowerCase()}`;
await prisma.predefinedBenefit.deleteMany();
await prisma.predefinedBenefit.createMany({ data: sourceBenefits });
```

```ts
// Correct: checked-in opaque keys plan non-destructive, compare-and-set actions.
validateStaticCatalog(predefinedCardsData);
const report = await runGlobalCatalogSyncOperator({
  source: predefinedCardsData,
  database,
  mode: "dry-run",
});
// Apply is a separate authorized operation requiring target verification and
// confirmApply: "SYNC_GLOBAL_CATALOG".
```

#### Standard versus custom status

```ts
// Wrong: every standard definition is copied into a mutable user Benefit.
const copied = await tx.benefit.create({ data: { ...templateBenefit, userId } });
await tx.benefitStatus.create({ data: { benefitId: copied.id, userId, ...cycle } });
```

```ts
// Correct: the physical card and global definition own standard identity;
// BenefitStatus owns only user/cycle state.
await tx.benefitStatus.create({
  data: {
    benefitId: null,
    creditCardId: ownedCard.id,
    predefinedBenefitId: globalBenefit.id,
    userId,
    ...cycle,
  },
});
```

#### Effective projection

```ts
// Wrong: a retained copied definition overrides updated global terms.
const definition = status.benefit ?? status.predefinedBenefit;
```

```ts
// Correct: a global link is authoritative; legacy is fallback/rollback only.
const definition = status.predefinedBenefit ?? status.benefit;
if (!definition) throw new Error("Benefit status has no definition source.");
```

#### Legacy bridge and cleanup

```ts
// Wrong: partial shape inference rewrites status history and deletes the copy
// during the ordinary bridge.
if (legacy.description === global.description) {
  await tx.benefitStatus.updateMany({
    where: { benefitId: legacy.id },
    data: { predefinedBenefitId: global.id, cycleEndDate: recalculate(global) },
  });
  await tx.benefit.delete({ where: { id: legacy.id } });
}
```

```ts
// Correct: dry-run classifies the complete graph and returns a batch fingerprint.
const review = await runGlobalBenefitMigrationOperator({
  mode: "dry-run",
  limit: 100,
  database,
});

// A later, separately authorized bridge rechecks that exact batch and retains
// benefitId plus every existing status value. Cleanup has another phrase plus
// parity/recovery gates and is never implicit in bridge apply.
await runGlobalBenefitMigrationOperator({
  mode: "apply",
  targetVerified: true,
  confirmation: "BRIDGE_EXACT_GLOBAL_BENEFITS",
  expectedSourceFingerprint: review.sourceFingerprint,
  limit: review.limit,
  database,
});
```

#### AMEX destination authority

```ts
// Wrong: legacy user keys and a suffix become destination authority.
const card = userCards.find((candidate) =>
  candidate.productKey === source.productKey
  && candidate.lastFourDigits?.endsWith(source.endingDigits.slice(-4)),
);
const benefit = card?.benefits.find((candidate) =>
  candidate.creditFamilyKey === row.creditFamilyKey
  && candidate.periodKey === row.periodKey,
);
```

```ts
// Correct: resolve and bind the owned physical/global/status graph.
const product = destinationCard.predefinedCard;
const globalBenefit = product?.benefits.find((candidate) =>
  resolveAmexGlobalDefinitionAuthority({
    product,
    benefit: candidate,
    sourceCreditKey: row.sourceCreditKey,
  }) !== null,
);
const status = globalBenefit?.statuses.find((candidate) =>
  candidate.userId === userId
  && candidate.creditCardId === destinationCard.id
  && candidate.predefinedBenefitId === globalBenefit.id,
);
if (!product || !globalBenefit || !status) return destinationNotAuthorized();

// Confirmation reloads this complete graph, recomputes the definition
// fingerprint, and uses status.cycleStartDate/status.cycleEndDate exact instants
// in the final compare-and-set.
```

## Scenario: reviewed category-only legacy repair overlay

### 1. Scope / Trigger

Use this contract only for historical card-owned `Benefit` definitions that remain `CUSTOM / CLASSIFIED` in `CatalogMigrationLedger` but differ from exactly one same-product global definition in `category` alone. The strict legacy classifier is not relaxed. Discovery is operator-only evidence preparation; request paths consume only exact persisted relations that the centralized classifier proves `APPLIED_VALID`.

Implementation, static checks, or a checked-in migration do not authorize schema deployment, discovery against a database, manifest generation, apply, rollback, cleanup, AMEX mode changes, provider activity, or confirmation. There is no production authorization in this contract. Every repair write additionally requires effective AMEX mode `off` under the separately reviewed operational boundary.

### 2. Signatures

```ts
type GlobalBenefitCategoryRepairPhase = "APPLIED" | "ROLLED_BACK";
type GlobalBenefitCategoryRepairAction =
  | "PROMOTE_LEGACY_STATUS"
  | "RETAIN_CANONICAL_STATUS";
type GlobalBenefitCategoryRepairStatusSource =
  | "LEGACY_CUSTOM"
  | "CANONICAL_STANDARD";

const GLOBAL_BENEFIT_CATEGORY_REPAIR_APPLY_CONFIRMATION =
  "APPLY_REVIEWED_CATEGORY_DRIFT_REPAIR";
const GLOBAL_BENEFIT_CATEGORY_REPAIR_ROLLBACK_CONFIRMATION =
  "ROLLBACK_REVIEWED_CATEGORY_DRIFT_REPAIR";

runGlobalBenefitCategoryRepairOperator({
  mode?,                       // discover | dry-run | rollback-preview | apply | rollback
  limit?,                      // bounded 1..500
  after?,                      // validated opaque one-way cursor
  manifest?,                   // private exact reviewed manifest for non-discover modes
  onDiscoveryManifest?,        // private manifest sink; discovery only
  expectedInventoryFingerprint?,
  expectedManifestFingerprint?,
  expectedPageFingerprint?,
  targetVerified?,
  recoveryPointVerified?,
  amexOffVerified?,
  confirmation?,
  database,
}): Promise<GlobalBenefitCategoryRepairReport>;

type GlobalBenefitCategoryRepairAuthorityState =
  | "NONE"
  | "ROLLED_BACK"
  | "APPLIED_VALID"
  | "APPLIED_INVALID";

classifyGlobalBenefitCategoryRepairAuthority(
  input: RuntimeCategoryRepairAuthorityInput,
): GlobalBenefitCategoryRepairAuthorityState;
```

```bash
npm run repair:global-benefit-categories -- \
  [--discover | --dry-run | --rollback-preview | --apply | --rollback] \
  [--limit=N] [--after=CURSOR] [--manifest=PRIVATE_PATH] \
  [--manifest-output=PRIVATE_PATH] \
  [--expect-inventory=SHA256] [--expect-manifest=SHA256] \
  [--expect-page=SHA256] [--target-verified] \
  [--recovery-point-verified] [--amex-off-verified] \
  [--confirm=PHRASE]
```

The CLI prints only mode, limit, `hasMore`, aggregate counts, action counts, and closed stop counts. Internal operator cursors/fingerprints and private manifests are never printed. `--manifest-output` is discovery-only, creates a new file exclusively with mode `0600`, synchronizes it before close, and never overwrites an existing path.

### 3. Contracts

1. **Historical classification remains exact.** Category remains part of strict full-shape classification. A repair never changes a `CUSTOM / CLASSIFIED` ledger row or reclassifies an unmanifested definition.
2. **Discovery is conservative.** A candidate is ownerless, card-linked, ledgered `CUSTOM / CLASSIFIED`, attached to an owned card with one global product, and has exactly one child under that product matching every canonical field except category. Every non-null provider identity field must agree.
3. **Explicit custom ownership excludes repair.** A same-owner or standalone custom definition is not a candidate even when its shape is otherwise similar.
4. **A private manifest is write authority.** Category-only similarity, a checked-in ID list, a dashboard duplicate, or a fresh nearest match cannot authorize apply. The manifest binds the complete strict-custom inventory, source, ledger, owner, card, global target catalog keys, graph, destination, and per-entry digest.
5. **Evidence is additive and semantically scoped.** One `GlobalBenefitCategoryRepair` is keyed one-to-one to the legacy definition and original migration ledger. Only exact `APPLIED_VALID` evidence grants suppression and canonical bridge capability. `APPLIED_INVALID`, `ROLLED_BACK`, and absent evidence grant none. Historical ledger state is unchanged.
6. **Catalog keys survive cloning.** Parent and occurrence evidence retain target card/benefit catalog keys in addition to database relations and fingerprints. A destination clone must rebind by those keys, never source database IDs.
7. **Occurrences pair exactly.** Pairing uses user, physical card, target global definition, exact persisted cycle start, exact persisted cycle end, and occurrence index. Non-exact overlap or duplicate destination blocks the complete definition.
8. **Keeper history wins.** Preserve the meaningful/history-bearing status. If both candidates are pristine or exactly equal and unattached, preserve the legacy status. Never synthesize a merged state.
9. **Losers are deletion-bounded.** Delete only an unattached pristine or exactly-equal loser after persisting its scalar ID, source kind, complete versioned JSON preimage, and plan fingerprint. Deleted-row IDs are evidence, not foreign keys.
10. **Keeper state is immutable during apply.** Preserve keeper ID, owner, exact cycle instants, occurrence, used amount, completion, `completedAt`, usability, order, timestamps, audits, and provenance. Only exact planned canonical links and explicitly recorded repair audit metadata may be added.
11. **Every definition is one serializable unit.** Re-read and re-plan the complete graph in transaction, compare all reviewed fingerprints, persist evidence before destructive CAS, and verify exact postimage and protected-state parity before commit.
12. **Runtime authority is exact.** `APPLIED_VALID` evidence suppresses only its source custom definition, projects canonical read-only terms, and may authorize AMEX only when repair, owner, card, global definition, status, cycle, occurrence, action/source kind, and evidence versions all agree. Authenticated benefit/card deletion paths reject every intersecting `APPLIED` parent—including malformed `APPLIED_INVALID` evidence—so invalid rows cannot erase the evidence needed for diagnosis or recovery.
13. **Rollback is evidence-scoped.** Rollback preserves current mutable keeper state, clears only repair-added links/audit metadata, recreates removed rows from exact snapshots, and marks the parent `ROLLED_BACK`. It stops on new attachment, provenance/AMEX activity, cycle/source drift, occupied identities, missing catalog binding, or cleanup.
14. **Owned lifecycle is not permanently restricted.** Repair evidence cascades with its user-owned legacy benefit, historical ledger, owner, physical card, parent repair, or keeper status. These cascades are safe only after application-level active-repair guards pass and ensure `ROLLED_BACK` evidence cannot block normal owned-data deletion forever. Canonical `PredefinedCard` and `PredefinedBenefit` targets remain restrictive during the evidence window.
15. **Generic migration cleanup is isolated.** Strict bridge cleanup/rollback ignores category-repair evidence and may not delete or invalidate an active repair source, keeper, or preimage.
16. **No heuristic runtime deduplication.** Dashboard category, description, amount, timestamps, names, or a checked-in production ID set never hide or authorize rows. Blocked and unmanifested definitions remain ordinary visible custom benefits.
17. **Fingerprint roles are distinct and clone-portable.** `graphFingerprint` binds the immutable reviewed graph; `reviewedCurrentGraphFingerprint` separately binds the mutable pre-apply graph required for rollback reconstruction. Fingerprints validate exact current relations before hashing but normalize environment-local global IDs to catalog-bound markers, so catalog-key rebinding does not invalidate otherwise identical evidence. Physical/source/status IDs and array order remain bound.
18. **Occurrence evidence order is semantic.** Evidence is reconstructed and hashed by exact cycle start, cycle end, occurrence index, and keeper status ID—not random evidence-row UUID. Multi-occurrence apply/replay therefore produces the same postimage and plan fingerprints in every environment.
19. **Runtime authority is four-state and centralized.** Only `APPLIED_VALID` grants suppression, canonical read-only projection, strict-migration replay exception, or AMEX authority. `APPLIED_INVALID` grants none but, like valid `APPLIED`, blocks authenticated deletion that could erase evidence. `ROLLED_BACK` and `NONE` grant neither authority nor an application deletion block.
20. **Compatibility paths fail closed.** Generic strict cleanup/rollback and executable legacy template/status utilities stop before mutating an active repair source, keeper, physical card, target global product, or exact occurrence tuple. Cron reads are bounded at the SQL boundary, prioritize unrepaired custom candidates, and load repair evidence only for that bounded page.
21. **Historical replay is manifest-scoped.** APPLIED replay and rollback use the original manifest/evidence authority for manifest-covered units and tolerate unrelated later inventory changes. Blocked, unmanifested rows on the same database page neither gain authority nor invalidate that historical replay.
22. **Every database read is target-gated.** Discover, dry-run, rollback-preview, apply, and rollback reject before `readBatch` unless `targetVerified === true`. That flag attests a separately authorized, immediate target-identity check; it does not expose the target identity or replace recovery/effective-off/write confirmation gates.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Source is standalone, user-owned, unledgered, non-`CUSTOM`, or non-`CLASSIFIED` | Exclude; preserve ordinary custom behavior |
| Zero/multiple same-product targets or any non-category shape/provider mismatch | Closed stop; write nothing for the definition |
| Exact one category-only target but no reviewed manifest entry | Discovery evidence only; no write authority |
| Inventory, manifest, page, graph, destination, definition, plan, or postimage fingerprint differs | Abort the unit before commit |
| Occurrence tuple differs by either exact instant or occurrence index | Non-exact overlap; block the definition |
| Both candidates carry conflicting meaningful state or attachments | Block; never choose, merge, or reset |
| One candidate is meaningful and the loser is pristine/unattached | Preserve the meaningful keeper and store exact loser preimage before deletion |
| Apply/rollback lacks target, recovery, effective-AMEX-off attestation, exact phrase, or reviewed fingerprints | Reject before writer invocation |
| Apply reruns against exact `APPLIED` evidence/postimage | Idempotent aggregate result; no state rewrite |
| Rollback sees new audit/provenance/AMEX activity, occupied removed ID, cleanup, or catalog-key failure | Refuse rollback; preserve current rows |
| Repair classifies `ROLLED_BACK` or `NONE` | No suppression, canonical projection, application mutation block, or AMEX authority; later owned-data deletion may cascade historical rolled-back evidence |
| Parent phase is `APPLIED` but semantic evidence classifies `APPLIED_INVALID` | Grant no suppression/projection/migration/AMEX authority, but block authenticated deletion that could erase the invalid evidence |
| Active repair source/card/status/account deletion is requested | Reject in the authenticated application path before owned-data cascades can run |
| Canonical global target deletion is requested while repair evidence exists | Restrictive foreign key blocks deletion; use a separately reviewed retirement/evidence lifecycle |
| Production operation is proposed as implementation verification | Skip and report separately; code completion grants no authorization |

### 5. Good / Base / Bad Cases

- **Good:** One ownerless card-linked ledgered custom definition differs from one child of the linked global product only in category. Its meaningful legacy occurrence is preserved, the pristine canonical duplicate is snapshotted and removed, and active evidence projects canonical terms without altering keeper state.
- **Good:** The canonical occurrence carries the only meaningful state. It remains the keeper, the unattached equal/pristine legacy occurrence receives a complete preimage before deletion, and the original ledger remains `CUSTOM / CLASSIFIED`.
- **Base:** An exact category-only candidate has no overlapping canonical status. Apply may promote the legacy keeper only when the reviewed manifest, full graph, occurrence tuple, and all write gates agree.
- **Base:** A genuine custom definition resembles a global row but is user-owned, standalone, unmanifested, or differs in another field. It remains mutable and independently materialized.
- **Base:** After rollback, evidence grants no runtime authority. A later ordinary owner/card/status deletion may cascade the historical repair rows; active repair application paths still reject the same deletion before database mutation.
- **Bad:** Change the strict classifier to ignore category, hide dashboard duplicates by content, infer a destination from production IDs, merge conflicting usage/completion, delete active repair evidence through a lifecycle cascade, or delete a loser before its exact preimage is durable.

### 6. Tests Required

Assert strict category-inclusive classification remains unchanged; ownerless/card-linked/ledgered eligibility; explicit custom and standalone exclusion; exact all-fields-except-category matching; non-null provider agreement; zero/multiple target and duplicate-destination stops; deterministic order reversal; complete inventory/manifest/entry/page/graph/reviewed-current-graph/destination/definition/plan/postimage fingerprints; catalog-bound normalization of environment-local global IDs only; opaque bounded pagination and aggregate-only CLI output with secure non-overwriting `0600` discovery manifests; target verification before every database-backed mode; read-only rollback-preview; exact write gates including effective AMEX `off`; full occurrence tuple equality including inclusive instants and semantic evidence ordering; pristine/meaningful/equal/conflicting action cases; attachment/provenance/audit relation blocking; evidence-before-delete ordering; scalar removed IDs and complete versioned preimages; keeper field/timestamp/audit/provenance preservation; serializable CAS rollback; idempotent replay; historical replay authority restricted to manifest-covered units despite unrelated later inventory; all four runtime authority states; valid-only suppression/projection/strict-migration/AMEX authority; valid-or-invalid APPLIED deletion guards; bounded cron candidate/evidence reads without suppression starvation; owned user/card/benefit/ledger/status evidence cascades after guards; restrictive canonical global targets; generic cleanup and executable legacy utility isolation; exact rollback restoration with current keeper state preserved; clone catalog-key rebinding, SQL-null absent preimages, parent/occurrence validation, and collision rejection; no checked-in IDs or runtime content heuristics; additive migration SQL; and explicit operational skips.

Do not run Prisma generation/migration/seed/status, database-backed discovery/dry-run/apply/rollback, provider/browser actions, AMEX preview/confirmation, configuration changes, or production commands as routine verification.

### 7. Wrong vs Correct

```ts
// Wrong: relaxed matching becomes runtime authority and silently chooses state.
if (legacy.description === global.description && legacy.maxAmount === global.maxAmount) {
  await deleteStatus(pristineLookingStatus.id);
  return projectAsStandard(legacy, global);
}
```

```ts
// Correct: request paths require exact semantically valid persisted evidence;
// only the separately gated operator may discover category-only candidates.
const graph = await loadExactCategoryRepairGraph(legacy.id);
const authority = classifyGlobalBenefitCategoryRepairAuthority(graph);
if (authority !== "APPLIED_VALID") return projectOrdinaryCustom(legacy);
return projectCanonicalReadOnly({
  repair: graph.repair,
  keeperStatus: graph.status,
  globalDefinition: graph.benefit,
});
```
