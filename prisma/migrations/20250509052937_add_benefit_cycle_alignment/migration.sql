-- CreateEnum
CREATE TYPE "BenefitCycleAlignment" AS ENUM ('CARD_ANNIVERSARY', 'CALENDAR_FIXED');

-- AlterTable
ALTER TABLE "Benefit" ADD COLUMN     "cycleAlignment" "BenefitCycleAlignment" DEFAULT 'CARD_ANNIVERSARY',
ADD COLUMN     "fixedCycleDurationMonths" INTEGER,
ADD COLUMN     "fixedCycleStartMonth" INTEGER;

-- AlterTable
ALTER TABLE "PredefinedBenefit" ADD COLUMN     "cycleAlignment" "BenefitCycleAlignment" DEFAULT 'CARD_ANNIVERSARY',
ADD COLUMN     "fixedCycleDurationMonths" INTEGER,
ADD COLUMN     "fixedCycleStartMonth" INTEGER;
