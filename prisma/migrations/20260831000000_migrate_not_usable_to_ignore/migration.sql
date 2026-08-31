-- The cycle-level isNotUsable flag is deprecated. Preserve the user's intent
-- as a cycle-independent IGNORE preference, then clear the legacy flag so the
-- same benefit is represented by one tracking model going forward.

-- Refuse to guess if a legacy row does not carry a valid target identity. The
-- migration is transactional, so this keeps the source flag intact for an
-- operator to repair before retrying rather than silently dropping intent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BenefitStatus"
    WHERE "isNotUsable" = true
      AND NOT (
        ("predefinedBenefitId" IS NOT NULL AND "creditCardId" IS NOT NULL)
        OR ("predefinedBenefitId" IS NULL AND "benefitId" IS NOT NULL)
      )
  ) THEN
    RAISE EXCEPTION 'Cannot migrate not-usable status with no valid tracking target';
  END IF;
END $$;

-- Do not manufacture a preference for a row whose related physical card is
-- owned by another user (or missing). The effective-benefit reader rejects
-- that relationship, so guessing here would either strand the preference or
-- hide a malformed status instead of failing closed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BenefitStatus" status
    LEFT JOIN "CreditCard" card ON card."id" = status."creditCardId"
    WHERE status."isNotUsable" = true
      AND status."predefinedBenefitId" IS NOT NULL
      AND (card."id" IS NULL OR card."userId" <> status."userId")
  ) THEN
    RAISE EXCEPTION 'Cannot migrate not-usable status with cross-owner or missing standard card';
  END IF;
END $$;

-- Custom rows may carry a card through either the status or its legacy
-- definition. Reject a cross-owner/missing card, while retaining support for
-- standalone legacy definitions whose Benefit.userId is intentionally NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BenefitStatus" status
    JOIN "Benefit" benefit ON benefit."id" = status."benefitId"
    LEFT JOIN "CreditCard" card
      ON card."id" = COALESCE(status."creditCardId", benefit."creditCardId")
    WHERE status."isNotUsable" = true
      AND status."predefinedBenefitId" IS NULL
      AND status."benefitId" IS NOT NULL
      AND (
        (benefit."userId" IS NOT NULL AND benefit."userId" <> status."userId")
        OR (COALESCE(status."creditCardId", benefit."creditCardId") IS NOT NULL
          AND (card."id" IS NULL OR card."userId" <> status."userId"))
      )
  ) THEN
    RAISE EXCEPTION 'Cannot migrate not-usable status with cross-owner or missing custom benefit owner';
  END IF;
END $$;

-- Existing preferences win only on identity; the requested migration adopts
-- IGNORE for every target that has a legacy not-usable status.
UPDATE "BenefitTrackingPreference" preference
SET "mode" = 'IGNORE'::"BenefitTrackingMode",
    "updatedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM "BenefitStatus" status
  WHERE status."isNotUsable" = true
    AND status."userId" = preference."userId"
    AND (
      (
        status."predefinedBenefitId" IS NOT NULL
        AND status."creditCardId" IS NOT NULL
        AND preference."creditCardId" = status."creditCardId"
        AND preference."predefinedBenefitId" = status."predefinedBenefitId"
        AND preference."benefitId" IS NULL
      )
      OR (
        status."predefinedBenefitId" IS NULL
        AND status."benefitId" IS NOT NULL
        AND preference."creditCardId" IS NULL
        AND preference."predefinedBenefitId" IS NULL
        AND preference."benefitId" = status."benefitId"
      )
    )
);

-- Standard benefits are keyed by physical card plus global benefit. DISTINCT
-- ON prevents multiple historical cycles from violating the preference key.
INSERT INTO "BenefitTrackingPreference" (
  "id", "userId", "creditCardId", "predefinedBenefitId", "benefitId",
  "mode", "createdAt", "updatedAt"
)
SELECT
  md5('legacy-ignore:standard:' || status."userId" || ':' || status."creditCardId" || ':' || status."predefinedBenefitId"),
  status."userId",
  status."creditCardId",
  status."predefinedBenefitId",
  NULL,
  'IGNORE'::"BenefitTrackingMode",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("userId", "creditCardId", "predefinedBenefitId")
    "userId", "creditCardId", "predefinedBenefitId"
  FROM "BenefitStatus"
  WHERE "isNotUsable" = true
    AND "creditCardId" IS NOT NULL
    AND "predefinedBenefitId" IS NOT NULL
  ORDER BY "userId", "creditCardId", "predefinedBenefitId", "id"
) status
WHERE NOT EXISTS (
  SELECT 1
  FROM "BenefitTrackingPreference" preference
  WHERE preference."userId" = status."userId"
    AND preference."creditCardId" = status."creditCardId"
    AND preference."predefinedBenefitId" = status."predefinedBenefitId"
    AND preference."benefitId" IS NULL
);

-- Custom/legacy benefits are keyed by their owned Benefit id.
INSERT INTO "BenefitTrackingPreference" (
  "id", "userId", "creditCardId", "predefinedBenefitId", "benefitId",
  "mode", "createdAt", "updatedAt"
)
SELECT
  md5('legacy-ignore:custom:' || status."userId" || ':' || status."benefitId"),
  status."userId",
  NULL,
  NULL,
  status."benefitId",
  'IGNORE'::"BenefitTrackingMode",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("userId", "benefitId")
    "userId", "benefitId"
  FROM "BenefitStatus"
  WHERE "isNotUsable" = true
    AND "predefinedBenefitId" IS NULL
    AND "benefitId" IS NOT NULL
  ORDER BY "userId", "benefitId", "id"
) status
WHERE NOT EXISTS (
  SELECT 1
  FROM "BenefitTrackingPreference" preference
  WHERE preference."userId" = status."userId"
    AND preference."benefitId" = status."benefitId"
    AND preference."creditCardId" IS NULL
    AND preference."predefinedBenefitId" IS NULL
);

UPDATE "BenefitStatus"
SET "isNotUsable" = false
WHERE "isNotUsable" = true;
