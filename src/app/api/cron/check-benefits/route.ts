import { NextResponse } from 'next/server';
import { BenefitFrequency, type BenefitCycleAlignment } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import {
  planBenefitStatusMaterialization,
  type CustomMaterializationDefinition,
  type PlannedBenefitStatusInsert,
  type StandardMaterializationDefinition,
} from '@/lib/global-benefit-materialization';
import {
  amexSyncAuditRetentionCutoff,
  deleteExpiredAmexSyncRowAudits,
} from '@/lib/amex-sync/repository';

export const maxDuration = 10;

const INSERT_BATCH_SIZE = 2_000;
const SOURCE_BATCH_SIZE = 500;

interface RawStandardDefinition {
  id: string;
  userId: string;
  creditCardId: string;
  cardOpenedDate: Date | null;
  description: string;
  frequency: BenefitFrequency;
  cycleAlignment: BenefitCycleAlignment | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number | null;
}

interface RawCustomDefinition {
  id: string;
  userId: string;
  cardOpenedDate: Date | null;
  startDate: Date;
  description: string;
  frequency: BenefitFrequency;
  cycleAlignment: BenefitCycleAlignment | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number | null;
}

async function runCheckBenefitsLogic(dryRun = false) {
  const now = new Date();
  const startMs = Date.now();
  console.log(`check-benefits started at ${now.toISOString()}${dryRun ? ' [DRY RUN]' : ''}`);

  try {
    const [standardDefinitions, customAndLegacyDefinitions] = await Promise.all([
      prisma.$queryRaw<RawStandardDefinition[]>`
        SELECT
          pb."id",
          c."userId",
          c."id" AS "creditCardId",
          c."openedDate" AS "cardOpenedDate",
          pb."description",
          pb."frequency",
          pb."cycleAlignment",
          pb."fixedCycleStartMonth",
          pb."fixedCycleDurationMonths",
          pb."occurrencesInCycle"
        FROM "CreditCard" c
        INNER JOIN "PredefinedCard" pc ON pc."id" = c."predefinedCardId"
        INNER JOIN "PredefinedBenefit" pb ON pb."predefinedCardId" = pc."id"
        WHERE c."lifecycleStatus" = 'ACTIVE'
          AND pc."retiredAt" IS NULL
          AND pb."retiredAt" IS NULL
          AND EXISTS (
            SELECT 1
            FROM generate_series(
              0,
              LEAST(GREATEST(COALESCE(pb."occurrencesInCycle", 1), 1), 13) - 1
            ) AS expected("occurrenceIndex")
            WHERE NOT EXISTS (
              SELECT 1
              FROM "BenefitStatus" bs
              WHERE bs."creditCardId" = c."id"
                AND bs."predefinedBenefitId" = pb."id"
                AND bs."userId" = c."userId"
                AND bs."occurrenceIndex" = expected."occurrenceIndex"
                AND (
                  pb."frequency" = ${BenefitFrequency.ONE_TIME}::"BenefitFrequency"
                  OR bs."cycleEndDate" >= ${now}
                )
            )
          )
        ORDER BY c."id", pb."id"
        LIMIT ${SOURCE_BATCH_SIZE}
      `,
      prisma.$queryRaw<RawCustomDefinition[]>`
        SELECT
          b."id",
          COALESCE(b."userId", c."userId") AS "userId",
          c."openedDate" AS "cardOpenedDate",
          b."startDate",
          b."description",
          b."frequency",
          b."cycleAlignment",
          b."fixedCycleStartMonth",
          b."fixedCycleDurationMonths",
          b."occurrencesInCycle"
        FROM "Benefit" b
        LEFT JOIN "CreditCard" c ON c."id" = b."creditCardId"
        WHERE b."frequency" <> ${BenefitFrequency.ONE_TIME}::"BenefitFrequency"
          AND COALESCE(b."userId", c."userId") IS NOT NULL
          AND (b."creditCardId" IS NULL OR c."lifecycleStatus" = 'ACTIVE')
          AND (b."userId" IS NULL OR b."creditCardId" IS NULL OR b."userId" = c."userId")
          AND NOT EXISTS (
            SELECT 1
            FROM "CatalogMigrationLedger" ledger
            WHERE ledger."legacyBenefitId" = b."id"
              AND ledger."classification" = 'STANDARD'
              AND ledger."phase" IN ('CLASSIFIED', 'BRIDGED', 'CLEANED')
          )
          AND EXISTS (
            SELECT 1
            FROM generate_series(
              0,
              LEAST(GREATEST(COALESCE(b."occurrencesInCycle", 1), 1), 13) - 1
            ) AS expected("occurrenceIndex")
            WHERE NOT EXISTS (
              SELECT 1
              FROM "BenefitStatus" bs
              WHERE bs."benefitId" = b."id"
                AND bs."userId" = COALESCE(b."userId", c."userId")
                AND bs."occurrenceIndex" = expected."occurrenceIndex"
                AND bs."cycleEndDate" >= ${now}
            )
          )
        ORDER BY b."id"
        LIMIT ${SOURCE_BATCH_SIZE}
      `,
    ]);

    const fetchMs = Date.now() - startMs;
    const plan = planBenefitStatusMaterialization(
      standardDefinitions as StandardMaterializationDefinition[],
      customAndLegacyDefinitions as CustomMaterializationDefinition[],
      now
    );

    for (const warning of plan.warnings) {
      console.warn(`Benefit cycle validation warning: ${warning}`);
    }

    let rowsInserted = 0;
    if (dryRun) {
      rowsInserted = plan.rows.length;
    } else {
      for (let index = 0; index < plan.rows.length; index += INSERT_BATCH_SIZE) {
        rowsInserted += await insertMissingBenefitStatuses(
          plan.rows.slice(index, index + INSERT_BATCH_SIZE)
        );
      }
    }

    const amexSyncAuditsDeleted = dryRun
      ? 0
      : await deleteExpiredAmexSyncRowAudits(amexSyncAuditRetentionCutoff(now));
    const durationMs = Date.now() - startMs;

    return NextResponse.json({
      message: dryRun ? 'Cron job dry run completed.' : 'Cron job executed successfully.',
      dryRun,
      rowsCalculated: plan.rows.length,
      rowsInserted,
      // Preserve the existing response field while changing semantics to insert-only.
      rowsUpserted: rowsInserted,
      standardDefinitionsProcessed: standardDefinitions.length,
      customAndLegacyDefinitionsProcessed: customAndLegacyDefinitions.length,
      validationWarnings: plan.warnings.length,
      amexSyncAuditsDeleted,
      fetchMs,
      durationMs,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    const durationMs = Date.now() - startMs;
    console.error('check-benefits failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({
      message: 'Cron job failed.',
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs,
      timestamp: now.toISOString(),
    }, { status: 500 });
  }
}

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

function parseDryRun(request: Request): boolean {
  return new URL(request.url).searchParams.get('dryRun') === 'true';
}

async function handleRequest(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error('CRON_SECRET is not set.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron attempt for check-benefits.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return runCheckBenefitsLogic(parseDryRun(request));
}

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}
