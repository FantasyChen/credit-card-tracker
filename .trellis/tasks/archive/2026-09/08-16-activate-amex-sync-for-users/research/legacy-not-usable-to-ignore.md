# Research: legacy not-usable rows to IGNORE

- Query: Safest migration and projection changes for replacing `BenefitStatus.isNotUsable` with cycle-independent `BenefitTrackingPreference(mode=IGNORE)`.
- Scope: internal
- Date: 2026-08-31

## Findings

`BenefitTrackingPreference` was introduced by migration `prisma/migrations/20260827000000_add_benefit_tracking_preferences/migration.sql`. Its target-shape check allows exactly either `(creditCardId, predefinedBenefitId)` with `benefitId IS NULL` (standard, including bridge statuses where global identity wins) or `benefitId` alone (custom/legacy). Unique indexes are `BenefitTrackingPreference_standard_key (userId, creditCardId, predefinedBenefitId)` and `BenefitTrackingPreference_custom_key (userId, benefitId)`; both are usable as PostgreSQL `ON CONFLICT` targets. Existing preference rows may be TRACK, AUTO_CLAIM, or IGNORE, so a backfill must upsert and force mode to IGNORE rather than blindly insert.

Recommended data mapping (inside one migration transaction):

```sql
-- Standard / bridge rows: global identity wins over retained legacy benefitId.
INSERT INTO "BenefitTrackingPreference"
  ("id", "userId", "creditCardId", "predefinedBenefitId", "benefitId", "mode", "createdAt", "updatedAt")
SELECT
  md5('legacy-not-usable:standard:' || s."userId" || ':' || s."creditCardId" || ':' || s."predefinedBenefitId"),
  s."userId", s."creditCardId", s."predefinedBenefitId", NULL, 'IGNORE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "userId", "creditCardId", "predefinedBenefitId"
  FROM "BenefitStatus"
  WHERE "isNotUsable" = true
    AND "creditCardId" IS NOT NULL
    AND "predefinedBenefitId" IS NOT NULL
) s
ON CONFLICT ("userId", "creditCardId", "predefinedBenefitId") DO UPDATE
SET "mode" = 'IGNORE', "updatedAt" = CURRENT_TIMESTAMP;

-- Custom/legacy rows (no global identity).
INSERT INTO "BenefitTrackingPreference"
  ("id", "userId", "creditCardId", "predefinedBenefitId", "benefitId", "mode", "createdAt", "updatedAt")
SELECT
  md5('legacy-not-usable:custom:' || s."userId" || ':' || s."benefitId"),
  s."userId", NULL, NULL, s."benefitId", 'IGNORE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "userId", "benefitId"
  FROM "BenefitStatus"
  WHERE "isNotUsable" = true
    AND "predefinedBenefitId" IS NULL
    AND "benefitId" IS NOT NULL
) s
ON CONFLICT ("userId", "benefitId") DO UPDATE
SET "mode" = 'IGNORE', "updatedAt" = CURRENT_TIMESTAMP;

-- Clear the cycle-local flag after preferences are materialized. Keep all
-- completion/amount/cycle/timestamp fields unchanged.
UPDATE "BenefitStatus" SET "isNotUsable" = false WHERE "isNotUsable" = true;
```

`md5` is built into PostgreSQL and avoids assuming `pgcrypto`; preference IDs are opaque text (the Prisma `cuid()` default is not a database constraint). If the project requires CUID-format IDs, use an explicitly authorized Prisma data-migration/operator instead; do not silently add a database extension. Invalid source-less rows, or rows with only `predefinedBenefitId` and no `creditCardId`, cannot satisfy the preference target check and should be skipped/reported rather than assigned a guessed key.

The dashboard already has a canonical IGNORE path: `buildBenefitDashboardProjection` calls `excludeIgnoredBenefits` before partitioning (`src/lib/benefit-dashboard.ts:295-301`), and `fetchTrackedBenefitStatuses` also filters IGNORE for read surfaces (`src/lib/benefit-tracking-preferences.ts:95-116`). Once the backfill sets preferences, historical not-usable rows disappear from all user-facing projections. Clearing `isNotUsable` additionally prevents `fetchDashboardBenefitStatuses` (`src/lib/benefit-dashboard.ts:352-357`) from retaining closed historical rows via its `status.isNotUsable` inclusion branch.

The current projection/client still exposes `notUsableBenefits`, `totalNotUsableValue`, a Not Usable tab/card, and partitioning logic (`src/lib/benefit-dashboard.ts:39-45, 187-196`; `src/components/BenefitsDisplayClient.tsx:17-45, 647-740`). Fully adopting IGNORE means removing those UI/projection fields and tests, while keeping IGNORE preferences and settings reset as the only restoration path. The `BenefitStatus.isNotUsable` column is still read by AMEX sync/audit/reconciliation and repair tooling (`src/lib/amex-sync/*`, `src/lib/global-benefit-category-repair*`); dropping the column/schema now would be a broad migration and risks those contracts. Prefer retaining the column as compatibility/audit state, but stop exposing it in dashboard reads and remove its mutation/UI action.

`setBenefitTrackingModeAction` already updates an existing preference or creates one and scopes standard/custom keys (`src/app/benefits/actions.ts:833-880`), so the backfill should match those exact identities. The action currently clears `isNotUsable` only for AUTO_CLAIM (`src/app/benefits/actions.ts:883-893`); after migration, IGNORE rows should simply have the flag false and be filtered by preference.

## Caveats / Not Found

- No existing checked-in data-migration script/backfill targets `BenefitTrackingPreference`; prior migrations use raw SQL updates but do not establish a reusable CUID generator.
- Prisma's composite uniqueness with nullable columns is safe here because the target-shape CHECK constraint forces one non-null key shape; malformed legacy statuses must not be migrated by inference.
- The migration changes only `isNotUsable`; preserve `isCompleted`, `usedAmount`, cycle coordinates, completion timestamps, and status IDs. Updating `BenefitStatus.updatedAt` is optional and would alter historical timestamps; omit it unless the product explicitly wants that audit signal.
- Existing IGNORE preferences remain IGNORE; existing AUTO_CLAIM/TRACK preferences for a not-usable target are intentionally overridden to IGNORE to satisfy the requested deprecation semantics.
