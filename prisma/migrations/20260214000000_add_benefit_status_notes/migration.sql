-- AlterTable: Add optional notes column to BenefitStatus for user notes per benefit cycle
ALTER TABLE "BenefitStatus" ADD COLUMN IF NOT EXISTS "notes" TEXT;
