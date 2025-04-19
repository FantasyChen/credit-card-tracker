/*
  Warnings:

  - You are about to drop the column `openedMonth` on the `CreditCard` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CreditCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "cardNumber" TEXT,
    "expiryDate" DATETIME,
    "openedDate" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CreditCard" ("cardNumber", "createdAt", "expiryDate", "id", "issuer", "name", "updatedAt", "userId") SELECT "cardNumber", "createdAt", "expiryDate", "id", "issuer", "name", "updatedAt", "userId" FROM "CreditCard";
DROP TABLE "CreditCard";
ALTER TABLE "new_CreditCard" RENAME TO "CreditCard";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
