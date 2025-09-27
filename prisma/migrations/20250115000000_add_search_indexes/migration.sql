-- Search optimization indexes
-- Add indexes specifically for search functionality to improve performance

-- Full-text search indexes for predefined cards
CREATE INDEX IF NOT EXISTS "PredefinedCard_name_search_idx" ON "PredefinedCard" USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS "PredefinedCard_issuer_search_idx" ON "PredefinedCard" USING gin(to_tsvector('english', issuer));

-- Case-insensitive search indexes
CREATE INDEX IF NOT EXISTS "PredefinedCard_name_lower_idx" ON "PredefinedCard" (lower(name));
CREATE INDEX IF NOT EXISTS "PredefinedCard_issuer_lower_idx" ON "PredefinedCard" (lower(issuer));

-- Annual fee range search index
CREATE INDEX IF NOT EXISTS "PredefinedCard_annualFee_idx" ON "PredefinedCard" ("annualFee");

-- Benefit search indexes
CREATE INDEX IF NOT EXISTS "PredefinedBenefit_category_search_idx" ON "PredefinedBenefit" USING gin(to_tsvector('english', category));
CREATE INDEX IF NOT EXISTS "PredefinedBenefit_description_search_idx" ON "PredefinedBenefit" USING gin(to_tsvector('english', description));

-- Case-insensitive benefit search indexes
CREATE INDEX IF NOT EXISTS "PredefinedBenefit_category_lower_idx" ON "PredefinedBenefit" (lower(category));
CREATE INDEX IF NOT EXISTS "PredefinedBenefit_description_lower_idx" ON "PredefinedBenefit" (lower(description));

-- Composite index for benefit filtering
CREATE INDEX IF NOT EXISTS "PredefinedBenefit_cardId_category_idx" ON "PredefinedBenefit" ("predefinedCardId", "category");

-- Index for popular benefit categories (for suggestions)
CREATE INDEX IF NOT EXISTS "PredefinedBenefit_category_count_idx" ON "PredefinedBenefit" ("category") WHERE "category" IS NOT NULL;

-- Index for card benefits join optimization
CREATE INDEX IF NOT EXISTS "PredefinedBenefit_predefinedCardId_maxAmount_idx" ON "PredefinedBenefit" ("predefinedCardId", "maxAmount" DESC);

-- Add search metadata table for analytics (optional)
CREATE TABLE IF NOT EXISTS "SearchAnalytics" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "query" TEXT NOT NULL,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "searchTime" INTEGER NOT NULL DEFAULT 0,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT
);

-- Index for search analytics
CREATE INDEX IF NOT EXISTS "SearchAnalytics_query_idx" ON "SearchAnalytics" ("query");
CREATE INDEX IF NOT EXISTS "SearchAnalytics_createdAt_idx" ON "SearchAnalytics" ("createdAt");
CREATE INDEX IF NOT EXISTS "SearchAnalytics_userId_idx" ON "SearchAnalytics" ("userId");
