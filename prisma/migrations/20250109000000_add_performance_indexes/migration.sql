-- Performance optimization indexes
-- Add indexes for frequently queried fields to improve performance

-- Index for benefit status queries (benefits page)
CREATE INDEX IF NOT EXISTS "BenefitStatus_userId_orderIndex_idx" ON "BenefitStatus"("userId", "orderIndex");
CREATE INDEX IF NOT EXISTS "BenefitStatus_userId_cycleEndDate_idx" ON "BenefitStatus"("userId", "cycleEndDate");
CREATE INDEX IF NOT EXISTS "BenefitStatus_cycleStartDate_cycleEndDate_idx" ON "BenefitStatus"("cycleStartDate", "cycleEndDate");

-- Index for credit card queries
CREATE INDEX IF NOT EXISTS "CreditCard_userId_createdAt_idx" ON "CreditCard"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CreditCard_name_issuer_idx" ON "CreditCard"("name", "issuer");

-- Index for benefit queries (cron jobs)
CREATE INDEX IF NOT EXISTS "Benefit_creditCardId_frequency_idx" ON "Benefit"("creditCardId", "frequency");
CREATE INDEX IF NOT EXISTS "Benefit_frequency_idx" ON "Benefit"("frequency") WHERE "frequency" != 'ONE_TIME';

-- Index for predefined card lookups
CREATE INDEX IF NOT EXISTS "PredefinedCard_name_issuer_idx" ON "PredefinedCard"("name", "issuer");

-- Index for loyalty account expiration queries
CREATE INDEX IF NOT EXISTS "LoyaltyAccount_userId_lastActivityDate_idx" ON "LoyaltyAccount"("userId", "lastActivityDate");
CREATE INDEX IF NOT EXISTS "LoyaltyAccount_userId_pointsExpirationDate_idx" ON "LoyaltyAccount"("userId", "pointsExpirationDate");

-- Index for user notification preferences
CREATE INDEX IF NOT EXISTS "User_notifyNewBenefit_notifyBenefitExpiration_idx" ON "User"("notifyNewBenefit", "notifyBenefitExpiration") WHERE "notifyNewBenefit" = true OR "notifyBenefitExpiration" = true;

-- Composite index for the most common benefit status lookup pattern
CREATE INDEX IF NOT EXISTS "BenefitStatus_composite_lookup_idx" ON "BenefitStatus"("userId", "isCompleted", "isNotUsable", "cycleEndDate");
