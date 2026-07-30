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
