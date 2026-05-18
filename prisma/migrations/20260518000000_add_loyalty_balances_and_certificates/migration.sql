-- Add optional balance tracking to loyalty accounts.
ALTER TABLE "LoyaltyAccount"
ADD COLUMN IF NOT EXISTS "pointsBalance" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyAccount_pointsBalance_nonnegative_check'
  ) THEN
    ALTER TABLE "LoyaltyAccount"
    ADD CONSTRAINT "LoyaltyAccount_pointsBalance_nonnegative_check"
    CHECK ("pointsBalance" IS NULL OR "pointsBalance" >= 0);
  END IF;
END $$;

-- Track free-night and certificate-like loyalty awards as individual expiring records.
CREATE TABLE IF NOT EXISTS "LoyaltyCertificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loyaltyAccountId" TEXT NOT NULL,
    "label" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyCertificate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoyaltyCertificate_userId_expirationDate_idx"
ON "LoyaltyCertificate"("userId", "expirationDate");

CREATE INDEX IF NOT EXISTS "LoyaltyCertificate_loyaltyAccountId_expirationDate_idx"
ON "LoyaltyCertificate"("loyaltyAccountId", "expirationDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyCertificate_quantity_positive_check'
  ) THEN
    ALTER TABLE "LoyaltyCertificate"
    ADD CONSTRAINT "LoyaltyCertificate_quantity_positive_check"
    CHECK ("quantity" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyCertificate_userId_fkey'
  ) THEN
    ALTER TABLE "LoyaltyCertificate"
    ADD CONSTRAINT "LoyaltyCertificate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyCertificate_loyaltyAccountId_fkey'
  ) THEN
    ALTER TABLE "LoyaltyCertificate"
    ADD CONSTRAINT "LoyaltyCertificate_loyaltyAccountId_fkey"
    FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
