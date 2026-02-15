-- Add WEEKLY to BenefitFrequency enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'BenefitFrequency' AND e.enumlabel = 'WEEKLY'
  ) THEN
    ALTER TYPE "BenefitFrequency" ADD VALUE 'WEEKLY';
  END IF;
END $$;

-- Make creditCardId optional on Benefit table (allow standalone benefits)
ALTER TABLE "Benefit" ALTER COLUMN "creditCardId" DROP NOT NULL;

-- Add userId column for standalone benefits
ALTER TABLE "Benefit" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Add foreign key constraint for userId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Benefit_userId_fkey'
  ) THEN
    ALTER TABLE "Benefit"
      ADD CONSTRAINT "Benefit_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add index for userId to improve query performance
CREATE INDEX IF NOT EXISTS "Benefit_userId_idx" ON "Benefit"("userId");

