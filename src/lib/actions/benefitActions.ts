'use server';

/**
 * Benefit-cycle creation is centralized in the authenticated check-benefits
 * cron. Keeping this compatibility export avoids hidden per-request writes and
 * prevents older callers from updating already-persisted cycle boundaries.
 */
export async function ensureCurrentBenefitStatuses(): Promise<void> {
  return;
}
