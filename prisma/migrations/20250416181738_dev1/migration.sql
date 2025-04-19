-- CreateTable
CREATE TABLE "PredefinedCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "annualFee" REAL NOT NULL,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PredefinedBenefit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "percentage" REAL NOT NULL,
    "maxAmount" REAL,
    "predefinedCardId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PredefinedBenefit_predefinedCardId_fkey" FOREIGN KEY ("predefinedCardId") REFERENCES "PredefinedCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
