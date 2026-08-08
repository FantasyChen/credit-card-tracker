import { prisma } from '@/lib/prisma';
import type { PlannedBenefitStatusInsert } from '@/lib/global-benefit-materialization';

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

  // Prisma emits parameterized INSERT ... ON CONFLICT DO NOTHING for
  // skipDuplicates. Keeping Date values on the normal Prisma boundary avoids
  // session-time-zone conversion from hand-written timestamptz casts.
  const result = await prisma.benefitStatus.createMany({
    data: rowsToInsert.map((row) => ({
      ...row,
      isCompleted: false,
      usedAmount: 0,
      isNotUsable: false,
      orderIndex: null,
    })),
    skipDuplicates: true,
  } as never);
  return result.count;
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
