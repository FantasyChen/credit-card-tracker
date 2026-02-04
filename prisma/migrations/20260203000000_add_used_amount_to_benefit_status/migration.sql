-- AlterTable: Add usedAmount column to BenefitStatus for partial completion tracking
ALTER TABLE "BenefitStatus" ADD COLUMN "usedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Set usedAmount to maxAmount for already completed benefits
UPDATE "BenefitStatus" bs
SET "usedAmount" = COALESCE(b."maxAmount", 0)
FROM "Benefit" b
WHERE bs."benefitId" = b."id"
AND bs."isCompleted" = true;
