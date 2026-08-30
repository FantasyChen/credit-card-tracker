-- Cycle-independent tracking choices for a benefit the user does not want to
-- re-confirm every Benefit Cycle. Purely additive: no existing row changes and
-- an absent preference row keeps the original TRACK behaviour.
CREATE TYPE "BenefitTrackingMode" AS ENUM ('TRACK', 'AUTO_CLAIM', 'IGNORE');

CREATE TABLE "BenefitTrackingPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "creditCardId" TEXT,
  "predefinedBenefitId" TEXT,
  "benefitId" TEXT,
  "mode" "BenefitTrackingMode" NOT NULL DEFAULT 'TRACK',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BenefitTrackingPreference_pkey" PRIMARY KEY ("id")
);

-- Standard benefits are addressed by the same (card, predefined benefit) pair
-- BenefitStatus uses; custom benefits are addressed by benefitId.
CREATE UNIQUE INDEX "BenefitTrackingPreference_standard_key"
  ON "BenefitTrackingPreference"("userId", "creditCardId", "predefinedBenefitId");
CREATE UNIQUE INDEX "BenefitTrackingPreference_custom_key"
  ON "BenefitTrackingPreference"("userId", "benefitId");
CREATE INDEX "BenefitTrackingPreference_userId_mode_idx"
  ON "BenefitTrackingPreference"("userId", "mode");

ALTER TABLE "BenefitTrackingPreference"
  ADD CONSTRAINT "BenefitTrackingPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BenefitTrackingPreference"
  ADD CONSTRAINT "BenefitTrackingPreference_creditCardId_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Catalog rows are never deleted out from under a user preference.
ALTER TABLE "BenefitTrackingPreference"
  ADD CONSTRAINT "BenefitTrackingPreference_predefinedBenefitId_fkey"
  FOREIGN KEY ("predefinedBenefitId") REFERENCES "PredefinedBenefit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BenefitTrackingPreference"
  ADD CONSTRAINT "BenefitTrackingPreference_benefitId_fkey"
  FOREIGN KEY ("benefitId") REFERENCES "Benefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one target shape per preference: a standard benefit is addressed by
-- the (card, predefined benefit) pair, a custom benefit by benefitId alone.
ALTER TABLE "BenefitTrackingPreference"
  ADD CONSTRAINT "BenefitTrackingPreference_target_shape_check"
  CHECK (
    ("creditCardId" IS NOT NULL AND "predefinedBenefitId" IS NOT NULL AND "benefitId" IS NULL)
    OR ("creditCardId" IS NULL AND "predefinedBenefitId" IS NULL AND "benefitId" IS NOT NULL)
  );

-- Claim provenance: AUTO rows were claimed by the tracking feature and are the
-- only rows a mode change may reopen. USER rows carry manual or user-confirmed
-- state and are immutable to mode changes. NULL rows are untouched since
-- materialization.
CREATE TYPE "BenefitStatusClaimSource" AS ENUM ('AUTO', 'USER');

ALTER TABLE "BenefitStatus"
  ADD COLUMN "claimSource" "BenefitStatusClaimSource";
