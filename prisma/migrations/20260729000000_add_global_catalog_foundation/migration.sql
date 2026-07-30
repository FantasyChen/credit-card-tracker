-- Additive global catalog identity and retirement metadata.
ALTER TABLE "PredefinedCard"
  ADD COLUMN "catalogKey" TEXT,
  ADD COLUMN "retiredAt" TIMESTAMP(3);

ALTER TABLE "PredefinedBenefit"
  ADD COLUMN "catalogKey" TEXT,
  ADD COLUMN "retiredAt" TIMESTAMP(3);

-- Physical cards can link to one canonical global product.
ALTER TABLE "CreditCard"
  ADD COLUMN "predefinedCardId" TEXT;

-- Bridge-compatible status references. Existing custom/legacy rows retain benefitId.
ALTER TABLE "BenefitStatus"
  ALTER COLUMN "benefitId" DROP NOT NULL,
  ADD COLUMN "creditCardId" TEXT,
  ADD COLUMN "predefinedBenefitId" TEXT;

-- AMEX audit rows can bind the canonical destination and its proposal fingerprint.
ALTER TABLE "AmexSyncRowAudit"
  ADD COLUMN "destinationPredefinedBenefitId" TEXT,
  ADD COLUMN "destinationDefinitionFingerprint" TEXT;

CREATE TYPE "CatalogMigrationClassification" AS ENUM ('STANDARD', 'CUSTOM');
CREATE TYPE "CatalogMigrationPhase" AS ENUM ('CLASSIFIED', 'BRIDGED', 'CLEANED', 'ROLLED_BACK');

CREATE TABLE "CatalogMigrationLedger" (
  "id" TEXT NOT NULL,
  "legacyBenefitId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "creditCardId" TEXT,
  "predefinedCardId" TEXT,
  "predefinedBenefitId" TEXT,
  "classification" "CatalogMigrationClassification" NOT NULL,
  "phase" "CatalogMigrationPhase" NOT NULL DEFAULT 'CLASSIFIED',
  "sourceFingerprint" TEXT NOT NULL,
  "destinationFingerprint" TEXT,
  "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bridgedAt" TIMESTAMP(3),
  "cleanedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CatalogMigrationLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PredefinedCard_catalogKey_key"
  ON "PredefinedCard"("catalogKey");
CREATE UNIQUE INDEX "PredefinedBenefit_catalogKey_key"
  ON "PredefinedBenefit"("catalogKey");
CREATE INDEX "PredefinedBenefit_predefinedCardId_retiredAt_idx"
  ON "PredefinedBenefit"("predefinedCardId", "retiredAt");
CREATE INDEX "PredefinedBenefit_productKey_creditFamilyKey_periodKey_idx"
  ON "PredefinedBenefit"("productKey", "creditFamilyKey", "periodKey");
CREATE INDEX "CreditCard_predefinedCardId_idx"
  ON "CreditCard"("predefinedCardId");
CREATE INDEX "BenefitStatus_standard_occurrence_lookup_idx"
  ON "BenefitStatus"("creditCardId", "predefinedBenefitId", "userId", "cycleStartDate", "occurrenceIndex");
CREATE INDEX "AmexSyncRowAudit_destinationPredefinedBenefitId_idx"
  ON "AmexSyncRowAudit"("destinationPredefinedBenefitId");
CREATE UNIQUE INDEX "CatalogMigrationLedger_legacyBenefitId_key"
  ON "CatalogMigrationLedger"("legacyBenefitId");
CREATE INDEX "CatalogMigrationLedger_userId_phase_idx"
  ON "CatalogMigrationLedger"("userId", "phase");
CREATE INDEX "CatalogMigrationLedger_creditCardId_idx"
  ON "CatalogMigrationLedger"("creditCardId");
CREATE INDEX "CatalogMigrationLedger_predefinedBenefitId_idx"
  ON "CatalogMigrationLedger"("predefinedBenefitId");

-- Retain the Prisma-visible legacy custom key for bridge compatibility and add
-- explicit partial custom/standard keys for the two source models.
ALTER INDEX "BenefitStatus_benefitId_userId_cycleStartDate_occurrenceIndex_key"
  RENAME TO "BenefitStatus_custom_occurrence_key";
CREATE UNIQUE INDEX "BenefitStatus_custom_occurrence_partial_key"
  ON "BenefitStatus"("benefitId", "userId", "cycleStartDate", "occurrenceIndex")
  WHERE "benefitId" IS NOT NULL;
CREATE UNIQUE INDEX "BenefitStatus_standard_occurrence_key"
  ON "BenefitStatus"("creditCardId", "predefinedBenefitId", "userId", "cycleStartDate", "occurrenceIndex")
  WHERE "creditCardId" IS NOT NULL AND "predefinedBenefitId" IS NOT NULL;

ALTER TABLE "CreditCard"
  ADD CONSTRAINT "CreditCard_predefinedCardId_fkey"
  FOREIGN KEY ("predefinedCardId") REFERENCES "PredefinedCard"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BenefitStatus"
  ADD CONSTRAINT "BenefitStatus_creditCardId_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "BenefitStatus_predefinedBenefitId_fkey"
  FOREIGN KEY ("predefinedBenefitId") REFERENCES "PredefinedBenefit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AmexSyncRowAudit"
  ADD CONSTRAINT "AmexSyncRowAudit_destinationPredefinedBenefitId_fkey"
  FOREIGN KEY ("destinationPredefinedBenefitId") REFERENCES "PredefinedBenefit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CatalogMigrationLedger"
  ADD CONSTRAINT "CatalogMigrationLedger_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CatalogMigrationLedger_creditCardId_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CatalogMigrationLedger_predefinedCardId_fkey"
  FOREIGN KEY ("predefinedCardId") REFERENCES "PredefinedCard"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CatalogMigrationLedger_predefinedBenefitId_fkey"
  FOREIGN KEY ("predefinedBenefitId") REFERENCES "PredefinedBenefit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
