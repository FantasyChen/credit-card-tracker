-- Add exportedAt to CatalogSuggestion (nullable, additive)
ALTER TABLE "public"."CatalogSuggestion"
ADD COLUMN IF NOT EXISTS "exportedAt" TIMESTAMP NULL;

