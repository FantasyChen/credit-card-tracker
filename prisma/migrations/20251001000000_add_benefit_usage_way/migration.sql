-- CreateTable
CREATE TABLE "BenefitUsageWay" (
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
ALTER TABLE "PredefinedBenefit" ADD COLUMN "usageWayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BenefitUsageWay_slug_key" ON "BenefitUsageWay"("slug");

-- AddForeignKey
ALTER TABLE "PredefinedBenefit" ADD CONSTRAINT "PredefinedBenefit_usageWayId_fkey" FOREIGN KEY ("usageWayId") REFERENCES "BenefitUsageWay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
