-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBetaUser" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "betaEnrolledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailAlertsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailAlertsResetAt" TIMESTAMP(3);

-- Mark all existing users as beta users
UPDATE "User" SET "isBetaUser" = true, "betaEnrolledAt" = NOW();
