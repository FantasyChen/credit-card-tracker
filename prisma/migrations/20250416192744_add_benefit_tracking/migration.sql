/*
  Warnings:

  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Notification";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "BenefitStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benefitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleStartDate" DATETIME NOT NULL,
    "cycleEndDate" DATETIME NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BenefitStatus_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "Benefit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BenefitStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Benefit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "percentage" REAL NOT NULL,
    "maxAmount" REAL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "frequency" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "creditCardId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Benefit_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Benefit" ("category", "createdAt", "creditCardId", "description", "endDate", "id", "maxAmount", "percentage", "startDate", "updatedAt") SELECT "category", "createdAt", "creditCardId", "description", "endDate", "id", "maxAmount", "percentage", "startDate", "updatedAt" FROM "Benefit";
DROP TABLE "Benefit";
ALTER TABLE "new_Benefit" RENAME TO "Benefit";
CREATE TABLE "new_PredefinedBenefit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "percentage" REAL NOT NULL,
    "maxAmount" REAL,
    "frequency" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "predefinedCardId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PredefinedBenefit_predefinedCardId_fkey" FOREIGN KEY ("predefinedCardId") REFERENCES "PredefinedCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PredefinedBenefit" ("category", "createdAt", "description", "id", "maxAmount", "percentage", "predefinedCardId", "updatedAt") SELECT "category", "createdAt", "description", "id", "maxAmount", "percentage", "predefinedCardId", "updatedAt" FROM "PredefinedBenefit";
DROP TABLE "PredefinedBenefit";
ALTER TABLE "new_PredefinedBenefit" RENAME TO "PredefinedBenefit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BenefitStatus_benefitId_userId_cycleStartDate_key" ON "BenefitStatus"("benefitId", "userId", "cycleStartDate");
