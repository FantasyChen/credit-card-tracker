-- CreateEnum
CREATE TYPE "LoyaltyProgramType" AS ENUM ('AIRLINE', 'HOTEL', 'RENTAL_CAR', 'CREDIT_CARD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyPointsExpiration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pointsExpirationDays" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "LoyaltyProgramType" NOT NULL,
    "company" TEXT NOT NULL,
    "expirationMonths" INTEGER,
    "hasExpiration" BOOLEAN NOT NULL DEFAULT true,
    "website" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loyaltyProgramId" TEXT NOT NULL,
    "accountNumber" TEXT,
    "lastActivityDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_name_key" ON "LoyaltyProgram"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_userId_loyaltyProgramId_key" ON "LoyaltyAccount"("userId", "loyaltyProgramId");

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
