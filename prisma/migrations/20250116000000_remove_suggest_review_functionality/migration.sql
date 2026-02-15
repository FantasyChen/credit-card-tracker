-- Remove suggest/review functionality from the database
-- This migration safely removes all catalog suggestion related tables and enums

-- Drop foreign key constraints first (safe even if table does not exist)
ALTER TABLE IF EXISTS "CatalogSuggestion" DROP CONSTRAINT IF EXISTS "CatalogSuggestion_createdById_fkey";
ALTER TABLE IF EXISTS "CatalogSuggestion" DROP CONSTRAINT IF EXISTS "CatalogSuggestion_reviewedById_fkey";

-- Drop the CatalogSuggestion table
DROP TABLE IF EXISTS "CatalogSuggestion";

-- Drop the enums
DROP TYPE IF EXISTS "SuggestionType";
DROP TYPE IF EXISTS "SuggestionStatus";
