-- Add exportedAt to CatalogSuggestion (nullable, additive)
ALTER TABLE IF EXISTS "public"."CatalogSuggestion"
ADD COLUMN IF NOT EXISTS "exportedAt" TIMESTAMP NULL;

