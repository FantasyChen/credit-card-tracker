-- CreateTable
CREATE TABLE IF NOT EXISTS "BenefitUsageWay" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "tips" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenefitUsageWay_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PredefinedBenefit" ADD COLUMN IF NOT EXISTS "usageWayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BenefitUsageWay_slug_key" ON "BenefitUsageWay"("slug");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PredefinedBenefit_usageWayId_fkey'
  ) THEN
    ALTER TABLE "PredefinedBenefit"
      ADD CONSTRAINT "PredefinedBenefit_usageWayId_fkey"
      FOREIGN KEY ("usageWayId")
      REFERENCES "BenefitUsageWay"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

