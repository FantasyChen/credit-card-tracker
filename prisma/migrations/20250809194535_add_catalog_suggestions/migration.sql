-- Create enums for catalog suggestions
CREATE TYPE "SuggestionType" AS ENUM (
  'ADD_CARD',
  'EDIT_CARD',
  'ADD_BENEFIT',
  'EDIT_BENEFIT',
  'DEPRECATE_CARD',
  'DEPRECATE_BENEFIT',
  'IMAGE_UPDATE'
);

CREATE TYPE "SuggestionStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

-- Create UserRole enum if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'UserRole'
  ) THEN
    CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
  END IF;
END $$;

-- Add missing columns based on current Prisma schema
-- CreditCard: add lastFourDigits
ALTER TABLE "CreditCard" ADD COLUMN IF NOT EXISTS "lastFourDigits" TEXT;

-- Benefit and PredefinedBenefit: occurrencesInCycle (default 1)
ALTER TABLE "Benefit" ADD COLUMN IF NOT EXISTS "occurrencesInCycle" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PredefinedBenefit" ADD COLUMN IF NOT EXISTS "occurrencesInCycle" INTEGER NOT NULL DEFAULT 1;

-- BenefitStatus: isNotUsable (default false) and occurrenceIndex (default 0)
ALTER TABLE "BenefitStatus" ADD COLUMN IF NOT EXISTS "isNotUsable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BenefitStatus" ADD COLUMN IF NOT EXISTS "occurrenceIndex" INTEGER NOT NULL DEFAULT 0;

-- Update unique index on BenefitStatus to include occurrenceIndex
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = ANY (current_schemas(false))
      AND indexname = 'BenefitStatus_benefitId_userId_cycleStartDate_key'
  ) THEN
    DROP INDEX "BenefitStatus_benefitId_userId_cycleStartDate_key";
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "BenefitStatus_benefitId_userId_cycleStartDate_occurrenceIndex_key"
  ON "BenefitStatus"("benefitId", "userId", "cycleStartDate", "occurrenceIndex");

-- LoyaltyProgram: qualifyingActivities
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "qualifyingActivities" TEXT;

-- User: role with default USER
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Create CatalogSuggestion table
CREATE TABLE IF NOT EXISTS "CatalogSuggestion" (
  "id" TEXT NOT NULL,
  "type" "SuggestionType" NOT NULL,
  "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "payloadJson" JSONB NOT NULL,
  "sources" TEXT[] NOT NULL,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "reviewedById" TEXT,

  CONSTRAINT "CatalogSuggestion_pkey" PRIMARY KEY ("id")
);

-- Foreign keys for CatalogSuggestion
ALTER TABLE "CatalogSuggestion"
  ADD CONSTRAINT "CatalogSuggestion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogSuggestion"
  ADD CONSTRAINT "CatalogSuggestion_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

