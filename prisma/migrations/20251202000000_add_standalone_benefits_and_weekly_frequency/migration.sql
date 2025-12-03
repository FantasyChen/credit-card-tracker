-- Add WEEKLY to BenefitFrequency enum
ALTER TYPE "BenefitFrequency" ADD VALUE 'WEEKLY';

-- Make creditCardId optional on Benefit table (allow standalone benefits)
ALTER TABLE "Benefit" ALTER COLUMN "creditCardId" DROP NOT NULL;

-- Add userId column for standalone benefits
ALTER TABLE "Benefit" ADD COLUMN "userId" TEXT;

-- Add foreign key constraint for userId
ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index for userId to improve query performance
CREATE INDEX "Benefit_userId_idx" ON "Benefit"("userId");

