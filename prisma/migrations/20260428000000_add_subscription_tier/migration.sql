-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "isBetaUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "betaEnrolledAt" TIMESTAMP(3),
ADD COLUMN     "emailAlertsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailAlertsResetAt" TIMESTAMP(3);

-- Mark all existing users as beta users
UPDATE "User" SET "isBetaUser" = true, "betaEnrolledAt" = NOW();
