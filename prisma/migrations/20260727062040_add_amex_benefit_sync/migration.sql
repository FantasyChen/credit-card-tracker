-- CreateEnum
CREATE TYPE "ExternalSyncSource" AS ENUM ('AMEX');

-- CreateEnum
CREATE TYPE "ExternalCardMappingKind" AS ENUM ('MANUAL_CONFIRMED');

-- CreateEnum
CREATE TYPE "AmexSyncAttemptMode" AS ENUM ('WRITE');

-- CreateEnum
CREATE TYPE "AmexSyncAttemptState" AS ENUM ('PROCESSING', 'COMPLETED', 'PARTIAL_FAILED');

-- CreateEnum
CREATE TYPE "AmexSyncDisposition" AS ENUM ('UPDATED', 'UNCHANGED', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "Benefit" ADD COLUMN     "creditFamilyKey" TEXT,
ADD COLUMN     "periodKey" TEXT,
ADD COLUMN     "productKey" TEXT;

-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN     "productKey" TEXT;

-- AlterTable
ALTER TABLE "PredefinedBenefit" ADD COLUMN     "creditFamilyKey" TEXT,
ADD COLUMN     "periodKey" TEXT,
ADD COLUMN     "productKey" TEXT;

-- AlterTable
ALTER TABLE "PredefinedCard" ADD COLUMN     "productKey" TEXT;

-- CreateTable
CREATE TABLE "ExternalCardMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ExternalSyncSource" NOT NULL,
    "sourceLocalCardId" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "sourceProductKey" TEXT NOT NULL,
    "endingSnapshot" TEXT,
    "kind" "ExternalCardMappingKind" NOT NULL DEFAULT 'MANUAL_CONFIRMED',
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCardMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmexSyncAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "envelopeDigest" TEXT NOT NULL,
    "mode" "AmexSyncAttemptMode" NOT NULL,
    "state" "AmexSyncAttemptState" NOT NULL DEFAULT 'PROCESSING',
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmexSyncAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitStatusSourceProvenance" (
    "id" TEXT NOT NULL,
    "benefitStatusId" TEXT NOT NULL,
    "source" "ExternalSyncSource" NOT NULL,
    "sourceObservationIdentity" TEXT NOT NULL,
    "sourceObservationDigest" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "creditFamilyKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptId" TEXT,

    CONSTRAINT "BenefitStatusSourceProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmexSyncRowAudit" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "sourceRowIdentity" TEXT NOT NULL,
    "sourceObservationIdentity" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "disposition" "AmexSyncDisposition" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "destinationCardId" TEXT,
    "destinationBenefitId" TEXT,
    "destinationStatusId" TEXT,
    "beforeUsedAmount" DOUBLE PRECISION,
    "afterUsedAmount" DOUBLE PRECISION,
    "beforeIsCompleted" BOOLEAN,
    "afterIsCompleted" BOOLEAN,
    "beforeCompletedAt" TIMESTAMP(3),
    "afterCompletedAt" TIMESTAMP(3),
    "beforeIsNotUsable" BOOLEAN,
    "afterIsNotUsable" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmexSyncRowAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalCardMapping_creditCardId_idx" ON "ExternalCardMapping"("creditCardId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCardMapping_userId_source_sourceLocalCardId_key" ON "ExternalCardMapping"("userId", "source", "sourceLocalCardId");

-- CreateIndex
CREATE INDEX "AmexSyncAttempt_createdAt_idx" ON "AmexSyncAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AmexSyncAttempt_userId_idempotencyKey_key" ON "AmexSyncAttempt"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "BenefitStatusSourceProvenance_attemptId_idx" ON "BenefitStatusSourceProvenance"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "BenefitStatusSourceProvenance_benefitStatusId_source_key" ON "BenefitStatusSourceProvenance"("benefitStatusId", "source");

-- CreateIndex
CREATE INDEX "AmexSyncRowAudit_createdAt_idx" ON "AmexSyncRowAudit"("createdAt");

-- CreateIndex
CREATE INDEX "AmexSyncRowAudit_destinationStatusId_idx" ON "AmexSyncRowAudit"("destinationStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "AmexSyncRowAudit_attemptId_sourceRowIdentity_key" ON "AmexSyncRowAudit"("attemptId", "sourceRowIdentity");

-- CreateIndex
CREATE INDEX "Benefit_creditCardId_productKey_creditFamilyKey_periodKey_idx" ON "Benefit"("creditCardId", "productKey", "creditFamilyKey", "periodKey");

-- CreateIndex
CREATE INDEX "CreditCard_userId_productKey_lastFourDigits_idx" ON "CreditCard"("userId", "productKey", "lastFourDigits");

-- CreateIndex
CREATE UNIQUE INDEX "PredefinedCard_productKey_key" ON "PredefinedCard"("productKey");

-- AddForeignKey
ALTER TABLE "ExternalCardMapping" ADD CONSTRAINT "ExternalCardMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCardMapping" ADD CONSTRAINT "ExternalCardMapping_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmexSyncAttempt" ADD CONSTRAINT "AmexSyncAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitStatusSourceProvenance" ADD CONSTRAINT "BenefitStatusSourceProvenance_benefitStatusId_fkey" FOREIGN KEY ("benefitStatusId") REFERENCES "BenefitStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitStatusSourceProvenance" ADD CONSTRAINT "BenefitStatusSourceProvenance_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AmexSyncAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmexSyncRowAudit" ADD CONSTRAINT "AmexSyncRowAudit_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AmexSyncAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmexSyncRowAudit" ADD CONSTRAINT "AmexSyncRowAudit_destinationCardId_fkey" FOREIGN KEY ("destinationCardId") REFERENCES "CreditCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmexSyncRowAudit" ADD CONSTRAINT "AmexSyncRowAudit_destinationBenefitId_fkey" FOREIGN KEY ("destinationBenefitId") REFERENCES "Benefit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmexSyncRowAudit" ADD CONSTRAINT "AmexSyncRowAudit_destinationStatusId_fkey" FOREIGN KEY ("destinationStatusId") REFERENCES "BenefitStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
