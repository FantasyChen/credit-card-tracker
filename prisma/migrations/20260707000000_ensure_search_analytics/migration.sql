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

CREATE INDEX IF NOT EXISTS "SearchAnalytics_query_idx" ON "SearchAnalytics" ("query");
CREATE INDEX IF NOT EXISTS "SearchAnalytics_createdAt_idx" ON "SearchAnalytics" ("createdAt");
CREATE INDEX IF NOT EXISTS "SearchAnalytics_userId_idx" ON "SearchAnalytics" ("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SearchAnalytics_userId_fkey'
  ) THEN
    ALTER TABLE "SearchAnalytics"
      ADD CONSTRAINT "SearchAnalytics_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
