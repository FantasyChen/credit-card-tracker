import { prisma } from '@/lib/prisma';
import type { PlannedBenefitStatusInsert } from '@/lib/global-benefit-materialization';
import {
  benefitTrackingKey,
  buildBenefitTrackingModeMap,
  initialStatusFieldsForTrackingMode,
  resolveBenefitTrackingMode,
  type BenefitTrackingModeMap,
  type BenefitTrackingPreferenceRecord,
} from '@/lib/benefit-tracking-modes';

export const INSERT_BATCH_SIZE = 2_000;

/** Insert-only by design: existing cycle boundaries and user state are immutable. */
export async function insertMissingBenefitStatuses(
  rows: PlannedBenefitStatusInsert[]
): Promise<number> {
  if (rows.length === 0) return 0;
  if (rows.length > INSERT_BATCH_SIZE) {
    throw new Error(`Benefit status insert batch exceeds ${INSERT_BATCH_SIZE} rows.`);
  }

  const overlapping = await prisma.benefitStatus.findMany({
    where: {
      OR: rows.map((row) => ({
        userId: row.userId,
        occurrenceIndex: row.occurrenceIndex,
        cycleEndDate: { gte: row.cycleStartDate },
        ...(row.benefitId
          ? { benefitId: row.benefitId }
          : {
              creditCardId: row.creditCardId,
              predefinedBenefitId: row.predefinedBenefitId,
            }),
      })),
    },
    select: {
      id: true,
      benefitId: true,
      creditCardId: true,
      predefinedBenefitId: true,
      userId: true,
      cycleStartDate: true,
      cycleEndDate: true,
      occurrenceIndex: true,
    },
  } as never) as unknown as Array<PlannedBenefitStatusInsert & { id: string }>;

  const rowsToInsert = rows.filter((row) => {
    const existing = overlapping.filter((candidate) => sameOccurrenceSource(candidate, row));
    const exact = existing.some((candidate) =>
      candidate.cycleStartDate.getTime() === row.cycleStartDate.getTime() &&
      candidate.cycleEndDate.getTime() === row.cycleEndDate.getTime()
    );
    if (exact) return false;
    if (existing.length > 0) {
      throw new Error(
        `Benefit status cycle discrepancy detected for ${row.predefinedBenefitId ?? row.benefitId}.`
      );
    }
    return true;
  });

  if (rowsToInsert.length === 0) return 0;

  // A benefit the user set to AUTO_CLAIM opens each new cycle already claimed,
  // so it never reappears on the to-do list while still counting toward
  // claimed value and ROI.
  const trackingModes = await loadTrackingModesForUsers(
    Array.from(new Set(rowsToInsert.map((row) => row.userId)))
  );
  const autoClaimRows = rowsToInsert.filter(
    (row) => resolveBenefitTrackingMode(trackingModes.get(row.userId), row) === 'AUTO_CLAIM'
  );
  const claimAmounts = await loadClaimableAmounts(autoClaimRows);
  const now = new Date();

  // Prisma emits parameterized INSERT ... ON CONFLICT DO NOTHING for
  // skipDuplicates. Keeping Date values on the normal Prisma boundary avoids
  // session-time-zone conversion from hand-written timestamptz casts.
  const result = await prisma.benefitStatus.createMany({
    data: rowsToInsert.map((row) => ({
      ...row,
      ...initialStatusFieldsForTrackingMode(
        resolveBenefitTrackingMode(trackingModes.get(row.userId), row),
        claimAmounts.get(benefitTrackingKey(row) ?? ''),
        now
      ),
      isNotUsable: false,
      orderIndex: null,
    })),
    skipDuplicates: true,
  } as never);
  return result.count;
}

/** One tracking-mode map per user, so a batch spanning users stays correct. */
async function loadTrackingModesForUsers(
  userIds: string[]
): Promise<Map<string, BenefitTrackingModeMap>> {
  const byUser = new Map<string, BenefitTrackingModeMap>();
  if (userIds.length === 0) return byUser;

  const preferences = await prisma.benefitTrackingPreference.findMany({
    where: { userId: { in: userIds }, mode: { not: 'TRACK' } },
    select: {
      userId: true,
      creditCardId: true,
      predefinedBenefitId: true,
      benefitId: true,
      mode: true,
    },
  } as never) as unknown as Array<BenefitTrackingPreferenceRecord & { userId: string }>;

  const grouped = new Map<string, BenefitTrackingPreferenceRecord[]>();
  for (const preference of preferences) {
    const existing = grouped.get(preference.userId);
    if (existing) existing.push(preference);
    else grouped.set(preference.userId, [preference]);
  }
  for (const [userId, userPreferences] of grouped) {
    byUser.set(userId, buildBenefitTrackingModeMap(userPreferences));
  }
  return byUser;
}

/**
 * Resolves the full value of each auto-claimed benefit, keyed the same way the
 * tracking preferences are. A benefit with no stored maximum claims 0.
 */
async function loadClaimableAmounts(
  rows: PlannedBenefitStatusInsert[]
): Promise<Map<string, number | null>> {
  const amounts = new Map<string, number | null>();
  if (rows.length === 0) return amounts;

  const predefinedBenefitIds = Array.from(
    new Set(rows.map((row) => row.predefinedBenefitId).filter((id): id is string => Boolean(id)))
  );
  const benefitIds = Array.from(
    new Set(
      rows
        .filter((row) => !row.predefinedBenefitId)
        .map((row) => row.benefitId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const [predefinedBenefits, benefits] = await Promise.all([
    predefinedBenefitIds.length > 0
      ? prisma.predefinedBenefit.findMany({
          where: { id: { in: predefinedBenefitIds } },
          select: { id: true, maxAmount: true },
        })
      : Promise.resolve([]),
    benefitIds.length > 0
      ? prisma.benefit.findMany({
          where: { id: { in: benefitIds } },
          select: { id: true, maxAmount: true },
        })
      : Promise.resolve([]),
  ]);

  const predefinedAmounts = new Map(predefinedBenefits.map((row) => [row.id, row.maxAmount]));
  const customAmounts = new Map(benefits.map((row) => [row.id, row.maxAmount]));
  for (const row of rows) {
    const key = benefitTrackingKey(row);
    if (key === null) continue;
    amounts.set(
      key,
      row.predefinedBenefitId
        ? predefinedAmounts.get(row.predefinedBenefitId) ?? null
        : customAmounts.get(row.benefitId ?? '') ?? null
    );
  }
  return amounts;
}

function sameOccurrenceSource(
  left: PlannedBenefitStatusInsert,
  right: PlannedBenefitStatusInsert
): boolean {
  return (
    left.userId === right.userId &&
    left.benefitId === right.benefitId &&
    left.creditCardId === right.creditCardId &&
    left.predefinedBenefitId === right.predefinedBenefitId &&
    left.occurrenceIndex === right.occurrenceIndex
  );
}
