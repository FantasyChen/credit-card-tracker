# Research: Credit-card, benefit, status, and AMEX catalog identities

- **Query**: Document the current `CreditCard`/`Benefit`/`BenefitStatus` schema and static catalog identities, and identify exact gaps for AMEX card mappings, source provenance, sync attempts, cycle mapping, and stale replay protection.
- **Scope**: internal
- **Date**: 2026-07-22

## Findings

### Files Found

| File Path | Description |
|---|---|
| `prisma/schema.prisma` | Durable user-card, benefit, status, catalog, and auth models. |
| `src/lib/american-express-card-catalog.ts` | Shared DB-free AMEX card/benefit definitions. |
| `src/lib/static-catalog.ts` | Public catalog projection and generated public IDs. |
| `src/lib/amex-benefit-reader/supported-card-credits.ts` | Exact product aliases and card-scoped semantic credit keys. |
| `src/lib/amex-benefit-reader/contract.ts` | Portable normalized card/benefit observation schema. |
| `src/lib/amex-benefit-reader/amex-response-adapter.ts` | Semantic matching/deduplication and emitted benefit identity. |
| `src/lib/amex-benefit-reader/identity.ts` | Local physical-card HMAC identity and generated benefit key. |
| `src/lib/actions/cardUtils.ts` | Copy from `PredefinedCard`/`PredefinedBenefit` into user-owned records. |
| `prisma/seed.ts` | Persistent predefined-catalog seeding behavior. |
| `src/lib/benefit-cycle.ts` | UTC cycle calculations. |
| `src/lib/benefit-cycle-materialization.ts` | Exact status-row materialization with occurrence indices. |

### Current durable models

#### `CreditCard`

`CreditCard` stores generated `id`, mutable/display `name` and `issuer`, optional `cardNumber`, optional `lastFourDigits`, optional nickname/open/expiry/lifecycle dates, `userId`, and child benefits/events (`prisma/schema.prisma:87-111`). Relevant identity facts:

- `CreditCard.id` is the durable physical-card identity in Perks Reminder.
- There is no `predefinedCardId` relation on a user card, even though the card is created from one.
- There is no external/source card ID, AMEX local card ID, source product key, or saved mapping relation.
- There is no uniqueness constraint on `(userId, name, lastFourDigits)`, which is correct for the possibility of duplicates but means application logic must require exactly one match.
- Card creation copies template name/issuer and ending digits into the new record (`src/lib/actions/cardUtils.ts:62-75`) but does not retain the template ID.

#### `Benefit`

`Benefit` stores generated `id`, description/category/percentage/max amount, active dates, frequency, optional card/user ownership, cycle alignment/start/duration, and `occurrencesInCycle` (`prisma/schema.prisma:130-150`). Relevant identity facts:

- A user-card benefit does not retain `predefinedBenefitId`, a stable catalog semantic key, an AMEX `creditKey`, or a source-period key.
- Card creation copies scalar template fields into a new benefit (`src/lib/actions/cardUtils.ts:89-107`); later catalog edits do not automatically identify/update that row.
- Split windows are distinct `Benefit` rows represented by separate descriptions and fixed-cycle metadata. Examples include Gold Resy Jan–Jun/Jul–Dec (`src/lib/american-express-card-catalog.ts:54-73`), Platinum Saks halves (`:111-129`), Platinum Resy/Lululemon quarters (`:130-210`), and hotel half-years (`:212-230`).

#### `BenefitStatus`

`BenefitStatus` stores `benefitId`, `userId`, cycle start/end, completion flags/time, not-usable, absolute `usedAmount`, ordering, occurrence index, and timestamps (`prisma/schema.prisma:195-216`). It has one important uniqueness constraint:

```text
@@unique([benefitId, userId, cycleStartDate, occurrenceIndex])
```

That identifies one destination cycle/occurrence and prevents duplicate status rows. It does not record who/what last set the amount, the source observation time, parser/contract version, request idempotency key, or pre-sync value.

### Static and persistent catalog identities

#### Card identities

- The shared AMEX catalog is keyed and named by exact canonical names (`src/lib/american-express-card-catalog.ts:26-616`). It contains Gold, Platinum, Business Platinum, Business Gold, three Hilton cards, three Delta cards, and two Marriott cards.
- The browser matcher defines exact normalized product aliases and returns canonical `catalogCardName` plus a card-scoped `creditKey` (`src/lib/amex-benefit-reader/supported-card-credits.ts:20-125`, `:203-229`). Example: `american-express-platinum-card:airline-fee` (`src/lib/amex-benefit-reader/__tests__/supported-card-credits.test.ts:8-29`).
- The public DB-free catalog generates a card ID by slugifying the card name (`src/lib/static-catalog.ts:2497-2502`, `:2536-2562`). These IDs are deterministic while the canonical name is stable.
- `PredefinedCard.name` is unique in the database (`prisma/schema.prisma:152-161`). Its generated CUID is persistent for the card row, but user-owned cards do not retain it.

#### Benefit identities

- The public static catalog generates benefit IDs as `<card-slug>-benefit-<1-based source-array index>` before sorting for output (`src/lib/static-catalog.ts:2536-2554`). These IDs depend on source-array order and are not copied into user-owned `Benefit` rows.
- `PredefinedBenefit.id` is a generated CUID (`prisma/schema.prisma:163-180`). Seed updates delete all existing predefined benefits and recreate them (`prisma/seed.ts:23-57`), so those IDs are not stable across a seed refresh.
- The browser's card-scoped semantic `creditKey` is stable at the credit-family level and is used to deduplicate normalization (`src/lib/amex-benefit-reader/amex-response-adapter.ts:427-435`, `:482`). It is **not emitted** into `NormalizedBenefitObservationV1`.
- The emitted `benefitKey` is generated from normalized title, category, and `activityKind` (`src/lib/amex-benefit-reader/amex-response-adapter.ts:359-365`, `:467-482`; `src/lib/amex-benefit-reader/identity.ts:114-139`). Because `activityKind` can change as a benefit moves from progress to earned/completed, this key is not the stable card-scoped catalog semantic key required by the sync PRD.
- The adapter's semantic `creditKey` may intentionally represent multiple destination rows for time windows. For example, one `:resy` family maps to two Gold rows or four Platinum quarterly rows; exact period/cycle evidence is required to choose one.

### Normalized observation capabilities and gaps

`NormalizedCardObservationV1` contains contract version, issuer, local card UUID, product name, 4–5 ending digits, observed time, parser version, completeness, issue codes, and benefits (`src/lib/amex-benefit-reader/contract.ts:99-123`). `NormalizedBenefitObservationV1` contains benefit key/title, observed fields for category/enrollment/tracker/completion/amounts/period, activity kind, confidence, and issue codes (`src/lib/amex-benefit-reader/contract.ts:72-97`).

Important boundaries:

- The portable card observation intentionally excludes the installation secret and HMAC source fingerprint (`.trellis/tasks/archive/2026-07/07-15-amex-card-benefit-sync/design.md:201-218`, `:250-269`). Only the random local card UUID is portable.
- `period` is bounded free-form visible text, not structured start/end dates (`src/lib/amex-benefit-reader/contract.ts:93`).
- Card-level `completeness` is portable, but record-level `freshness` (`current`, `stale_error`, `error_no_data`) exists only in `StoredCardRecordV1` (`src/lib/amex-benefit-reader/contract.ts:131-165`). The userscript must exclude stale records before creating a portable sync set, and the server still needs an observed-at freshness bound.
- Quantities are decimal strings with explicit unit/currency (`src/lib/amex-benefit-reader/contract.ts:31-40`), whereas durable `BenefitStatus.usedAmount` and `Benefit.maxAmount` are `Float` (`prisma/schema.prisma:135`, `:204`). Synchronization must accept only explicitly compatible units in the first scope and perform one reviewed conversion.

### Exact schema gaps

| Required capability | Current support | Exact gap |
|---|---|---|
| Automatic card match | `CreditCard.name`, `issuer`, `lastFourDigits`, `userId` | No canonical source-product field; matcher canonical name is not retained separately from display name. Logic can still query exact canonical name/issuer/endings and require count = 1. |
| Saved manual card mapping | None | No model joining `(userId, source system, source local card ID)` to `CreditCard.id`; no uniqueness/ownership constraint for a saved exception. |
| Stable benefit mapping | Browser matcher has internal `creditKey` | `creditKey` is discarded; emitted `benefitKey` is title/category/activity-derived; `Benefit` has no catalog semantic key. |
| Exact period/cycle mapping | Benefit cycle metadata and status cycle dates | Source period is free-form text; no structured observed period start/end; no reviewed source-period mapping table/key. |
| Exact occurrence mapping | `occurrenceIndex` and unique key | Source observation has no occurrence identity; rows with `occurrencesInCycle > 1` must be skipped unless a reviewed rule resolves exactly one occurrence. |
| Source provenance | Generic `createdAt`/`updatedAt` | No source enum, source observation ID/hash, observed time, parser/contract version, synced time, or source-completion evidence. |
| Sync attempts/results | None | No attempt/idempotency record, payload digest, preview/confirm state, aggregate disposition, or per-row result/audit record. |
| Stale replay protection | None | No per-destination latest AMEX `observedAt` or monotonic source version to compare before writing. `updatedAt` mixes all edit sources and cannot establish source freshness. |
| Idempotent row creation | Status compound unique key | Prevents duplicate status rows only; does not deduplicate/replay a sync attempt or preserve previous response results. |
| Manual-vs-AMEX attribution | None | Current status does not identify whether its value came from manual action or AMEX, so UI/audit cannot distinguish them. |
| Rollback evidence | None | No before/after snapshot for an applied source overwrite. |

### Recommended additive persistence capabilities

The least-coupled initial model needs three distinct durable concerns rather than overloading `BenefitStatus.updatedAt`:

1. **Saved external card mapping**: user + source system + portable source local card ID → owned `CreditCard.id`, with a unique source mapping and server-enforced ownership. Store canonical source product key and ending digits as review context, not as authorization.
2. **Sync attempt and row audit**: one attempt keyed by authenticated user + server-computed idempotency key/payload digest; per-row outcome with source card/credit/period identity, destination IDs, observed/parser/contract versions, and before/after status snapshots. This supports retry result replay, confirmation reporting, and rollback analysis.
3. **Latest source observation on the destination**: either source-specific fields on `BenefitStatus` or a one-to-one/latest-observation relation keyed by destination status + source. It must include source observed time and observation identity/hash so an older/equal replay can be rejected/no-op independently of manual `updatedAt`.

For benefit/cycle mapping, the normalized transport also needs the stable matcher `creditKey` and sufficiently structured period identity. Two viable exact representations are:

- extend the portable contract version with `creditKey` plus validated ISO date-only `periodStart`/`periodEnd`; or
- keep the portable source text but allow only an explicit reviewed card+credit+period vocabulary that resolves to exactly one destination cycle.

The first approach provides a clearer server contract. In either case, the source `benefitKey` alone is insufficient for durable semantic mapping.

### Related Specs

- `.trellis/spec/perks-reminder/architecture-and-domain.md:12-16` — owners of cycle/status logic and physical-card identity invariant.
- `.trellis/spec/perks-reminder/architecture-and-domain.md:18-24` — catalog and cycle invariants.
- `.trellis/spec/perks-reminder/catalog-and-benefit-updates.md:10-25` — template, existing-user, materialization, and split-window rules.
- `.trellis/spec/perks-reminder/browser-read-integrations.md:41-56`, `:86-97` — portable normalized observation and local-only fingerprint boundary.
- `.trellis/tasks/07-22-sync-reviewed-amex-benefits/prd.md:27-47` — exact mapping, provenance, stale replay, and AMEX precedence requirements.

## Caveats / Not Found

- No source provenance or external mapping model was found in migration history.
- The prior pre-sync task PRD defines the approved review states, but its acceptance boxes remain unchecked and the current `panel.ts` still implements a selected-card/four-filter UI (`src/userscripts/amex-benefit-reader/panel.ts:392-458`, `:676-712`). The sync design should consume the approved normalized contract and product decisions, while implementation sequencing must verify the review milestone has landed.
- The first writable scope remains an explicit product open question (`.trellis/tasks/07-22-sync-reviewed-amex-benefits/prd.md:81-84`). Uncharacterized period/occurrence formats must remain skipped.
