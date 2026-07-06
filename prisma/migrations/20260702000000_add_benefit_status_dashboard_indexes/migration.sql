-- Add indexes for the Benefits dashboard's user-scoped status queries.
-- These names intentionally differ from older raw performance-index migrations so
-- databases with partial migration history can apply this migration safely.

CREATE INDEX IF NOT EXISTS "BenefitStatus_dashboard_user_order_end_idx"
  ON "BenefitStatus" ("userId", "orderIndex", "cycleEndDate");

CREATE INDEX IF NOT EXISTS "BenefitStatus_dashboard_user_end_idx"
  ON "BenefitStatus" ("userId", "cycleEndDate");

CREATE INDEX IF NOT EXISTS "BenefitStatus_dashboard_user_state_end_idx"
  ON "BenefitStatus" ("userId", "isCompleted", "isNotUsable", "cycleEndDate");
