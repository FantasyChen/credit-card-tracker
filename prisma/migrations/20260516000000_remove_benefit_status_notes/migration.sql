-- Remove freeform notes from benefit cycles.
-- Official benefit guidance now lives in BenefitUsageWay guides.
ALTER TABLE "BenefitStatus" DROP COLUMN IF EXISTS "notes";
