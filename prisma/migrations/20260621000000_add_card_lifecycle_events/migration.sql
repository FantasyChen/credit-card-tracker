-- CreateEnum
CREATE TYPE "CardLifecycleStatus" AS ENUM ('ACTIVE', 'CLOSED', 'PRODUCT_CHANGED');

-- CreateEnum
CREATE TYPE "CardEventType" AS ENUM ('OPENED', 'ANNUAL_FEE', 'RETENTION', 'PRODUCT_CHANGE', 'CLOSED', 'SIGNUP_BONUS', 'SPEND_DEADLINE', 'NOTE');

-- AlterTable
ALTER TABLE "CreditCard"
ADD COLUMN     "lifecycleStatus" "CardLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "closedDate" TIMESTAMP(3),
ADD COLUMN     "annualFeeAmount" DOUBLE PRECISION,
ADD COLUMN     "annualFeeDueDate" TIMESTAMP(3),
ADD COLUMN     "signupBonusDeadline" TIMESTAMP(3),
ADD COLUMN     "spendDeadline" TIMESTAMP(3),
ADD COLUMN     "productChangedFrom" TEXT,
ADD COLUMN     "productChangedTo" TEXT,
ADD COLUMN     "lifecycleNotes" TEXT;

-- CreateTable
CREATE TABLE "CreditCardEvent" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "CardEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditCardEvent_creditCardId_eventDate_idx" ON "CreditCardEvent"("creditCardId", "eventDate");

-- CreateIndex
CREATE INDEX "CreditCardEvent_userId_eventDate_idx" ON "CreditCardEvent"("userId", "eventDate");

-- AddForeignKey
ALTER TABLE "CreditCardEvent" ADD CONSTRAINT "CreditCardEvent_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardEvent" ADD CONSTRAINT "CreditCardEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
