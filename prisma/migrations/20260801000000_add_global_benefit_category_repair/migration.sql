-- Additive evidence overlay for reviewed category-only global-benefit repairs.
-- Existing catalog, migration-ledger, benefit, and status rows are not rewritten.
CREATE TYPE "GlobalBenefitCategoryRepairPhase" AS ENUM ('APPLIED', 'ROLLED_BACK');
CREATE TYPE "GlobalBenefitCategoryRepairAction" AS ENUM ('PROMOTE_LEGACY_STATUS', 'RETAIN_CANONICAL_STATUS');
CREATE TYPE "GlobalBenefitCategoryRepairStatusSource" AS ENUM ('LEGACY_CUSTOM', 'CANONICAL_STANDARD');

CREATE TABLE "GlobalBenefitCategoryRepair" (
  "id" TEXT NOT NULL,
  "legacyBenefitId" TEXT NOT NULL,
  "catalogMigrationLedgerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "creditCardId" TEXT NOT NULL,
  "predefinedCardId" TEXT NOT NULL,
  "predefinedBenefitId" TEXT NOT NULL,
  "targetPredefinedCardCatalogKey" TEXT NOT NULL,
  "targetPredefinedBenefitCatalogKey" TEXT NOT NULL,
  "definitionFingerprint" TEXT NOT NULL,
  "inventoryFingerprint" TEXT NOT NULL,
  "graphFingerprint" TEXT NOT NULL,
  "reviewedCurrentGraphFingerprint" TEXT NOT NULL,
  "destinationFingerprint" TEXT NOT NULL,
  "manifestFingerprint" TEXT NOT NULL,
  "manifestEntryFingerprint" TEXT NOT NULL,
  "planFingerprint" TEXT NOT NULL,
  "postimageFingerprint" TEXT NOT NULL,
  "evidenceVersion" INTEGER NOT NULL DEFAULT 1,
  "phase" "GlobalBenefitCategoryRepairPhase" NOT NULL DEFAULT 'APPLIED',
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GlobalBenefitCategoryRepair_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GlobalBenefitCategoryRepair_version_check"
    CHECK ("evidenceVersion" > 0),
  CONSTRAINT "GlobalBenefitCategoryRepair_phase_time_check"
    CHECK (
      ("phase" = 'APPLIED' AND "rolledBackAt" IS NULL)
      OR ("phase" = 'ROLLED_BACK' AND "rolledBackAt" IS NOT NULL)
    )
);

CREATE TABLE "GlobalBenefitCategoryRepairOccurrence" (
  "id" TEXT NOT NULL,
  "repairId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "creditCardId" TEXT NOT NULL,
  "predefinedBenefitId" TEXT NOT NULL,
  "targetPredefinedBenefitCatalogKey" TEXT NOT NULL,
  "action" "GlobalBenefitCategoryRepairAction" NOT NULL,
  "keeperSource" "GlobalBenefitCategoryRepairStatusSource" NOT NULL,
  "keeperStatusId" TEXT NOT NULL,
  "cycleStartDate" TIMESTAMP(3) NOT NULL,
  "cycleEndDate" TIMESTAMP(3) NOT NULL,
  "occurrenceIndex" INTEGER NOT NULL,
  "keeperBaselineVersion" INTEGER NOT NULL DEFAULT 1,
  "keeperBaseline" JSONB NOT NULL,
  "removedStatusId" TEXT,
  "removedStatusSource" "GlobalBenefitCategoryRepairStatusSource",
  "removedStatusPreimageVersion" INTEGER,
  "removedStatusPreimage" JSONB,
  "repairAddedAuditMetadataVersion" INTEGER NOT NULL DEFAULT 1,
  "repairAddedAuditMetadata" JSONB NOT NULL,
  "planFingerprint" TEXT NOT NULL,
  "postimageFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GlobalBenefitCategoryRepairOccurrence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GBCategoryRepairOccurrence_versions_check"
    CHECK (
      "keeperBaselineVersion" > 0
      AND "repairAddedAuditMetadataVersion" > 0
      AND ("removedStatusPreimageVersion" IS NULL OR "removedStatusPreimageVersion" > 0)
    ),
  CONSTRAINT "GBCategoryRepairOccurrence_action_source_check"
    CHECK (
      ("action" = 'PROMOTE_LEGACY_STATUS' AND "keeperSource" = 'LEGACY_CUSTOM')
      OR ("action" = 'RETAIN_CANONICAL_STATUS' AND "keeperSource" = 'CANONICAL_STANDARD')
    ),
  CONSTRAINT "GBCategoryRepairOccurrence_removed_snapshot_check"
    CHECK (
      (
        "removedStatusId" IS NULL
        AND "removedStatusSource" IS NULL
        AND "removedStatusPreimageVersion" IS NULL
        AND "removedStatusPreimage" IS NULL
      )
      OR (
        "removedStatusId" IS NOT NULL
        AND "removedStatusSource" IS NOT NULL
        AND "removedStatusPreimageVersion" IS NOT NULL
        AND "removedStatusPreimage" IS NOT NULL
      )
    ),
  CONSTRAINT "GBCategoryRepairOccurrence_removed_source_check"
    CHECK (
      "removedStatusSource" IS NULL
      OR (
        "action" = 'PROMOTE_LEGACY_STATUS'
        AND "removedStatusSource" = 'CANONICAL_STANDARD'
      )
      OR (
        "action" = 'RETAIN_CANONICAL_STATUS'
        AND "removedStatusSource" = 'LEGACY_CUSTOM'
      )
    )
);

CREATE UNIQUE INDEX "GlobalBenefitCategoryRepair_legacyBenefitId_key"
  ON "GlobalBenefitCategoryRepair"("legacyBenefitId");
CREATE UNIQUE INDEX "GBCategoryRepair_ledgerId_key"
  ON "GlobalBenefitCategoryRepair"("catalogMigrationLedgerId");
CREATE INDEX "GBCategoryRepair_user_phase_idx"
  ON "GlobalBenefitCategoryRepair"("userId", "phase");
CREATE INDEX "GBCategoryRepair_card_phase_idx"
  ON "GlobalBenefitCategoryRepair"("creditCardId", "phase");
CREATE INDEX "GBCategoryRepair_benefit_phase_idx"
  ON "GlobalBenefitCategoryRepair"("predefinedBenefitId", "phase");

CREATE UNIQUE INDEX "GBCategoryRepairOccurrence_keeperStatus_key"
  ON "GlobalBenefitCategoryRepairOccurrence"("keeperStatusId");
CREATE UNIQUE INDEX "GBCategoryRepairOccurrence_removedStatus_key"
  ON "GlobalBenefitCategoryRepairOccurrence"("removedStatusId");
CREATE UNIQUE INDEX "GBCategoryRepairOccurrence_tuple_key"
  ON "GlobalBenefitCategoryRepairOccurrence"(
    "repairId",
    "userId",
    "creditCardId",
    "predefinedBenefitId",
    "cycleStartDate",
    "cycleEndDate",
    "occurrenceIndex"
  );
CREATE INDEX "GBCategoryRepairOccurrence_repair_idx"
  ON "GlobalBenefitCategoryRepairOccurrence"("repairId");
CREATE INDEX "GBCategoryRepairOccurrence_owner_card_idx"
  ON "GlobalBenefitCategoryRepairOccurrence"("userId", "creditCardId");
CREATE INDEX "GBCategoryRepairOccurrence_target_cycle_idx"
  ON "GlobalBenefitCategoryRepairOccurrence"("predefinedBenefitId", "cycleStartDate");

-- Owned repair evidence follows ordinary user/card/benefit/status lifecycle.
-- Application mutations reject deletion while repair phase is APPLIED; database
-- cascades prevent ROLLED_BACK historical evidence from blocking deletion forever.
-- Canonical global targets remain restrictive throughout the rollback window.
ALTER TABLE "GlobalBenefitCategoryRepair"
  ADD CONSTRAINT "GBCategoryRepair_legacyBenefit_fkey"
  FOREIGN KEY ("legacyBenefitId") REFERENCES "Benefit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GBCategoryRepair_ledger_fkey"
  FOREIGN KEY ("catalogMigrationLedgerId") REFERENCES "CatalogMigrationLedger"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GBCategoryRepair_user_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GBCategoryRepair_card_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GBCategoryRepair_predefinedCard_fkey"
  FOREIGN KEY ("predefinedCardId") REFERENCES "PredefinedCard"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GBCategoryRepair_predefinedBenefit_fkey"
  FOREIGN KEY ("predefinedBenefitId") REFERENCES "PredefinedBenefit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GlobalBenefitCategoryRepairOccurrence"
  ADD CONSTRAINT "GBCategoryRepairOccurrence_repair_fkey"
  FOREIGN KEY ("repairId") REFERENCES "GlobalBenefitCategoryRepair"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GBCategoryRepairOccurrence_user_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GBCategoryRepairOccurrence_card_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GBCategoryRepairOccurrence_benefit_fkey"
  FOREIGN KEY ("predefinedBenefitId") REFERENCES "PredefinedBenefit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GBCategoryRepairOccurrence_keeperStatus_fkey"
  FOREIGN KEY ("keeperStatusId") REFERENCES "BenefitStatus"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
