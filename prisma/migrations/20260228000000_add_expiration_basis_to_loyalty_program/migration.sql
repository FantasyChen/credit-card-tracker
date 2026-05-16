-- AlterTable
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "expirationBasis" TEXT DEFAULT 'ACTIVITY';
