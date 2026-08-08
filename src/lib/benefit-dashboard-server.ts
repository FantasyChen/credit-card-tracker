import { loadHomeDashboardSummary } from '@/lib/benefit-dashboard';
import { prisma } from '@/lib/prisma';

/**
 * Authenticated database adapter kept out of the anonymous home-page module.
 */
export function loadHomeDashboardSummaryForUser(userId: string, now = new Date()) {
  return loadHomeDashboardSummary(prisma, { userId, now });
}
