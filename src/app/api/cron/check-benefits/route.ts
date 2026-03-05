import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';
import { normalizeCycleDate } from '@/lib/dateUtils';
import { validateBenefitCycle } from '@/lib/benefit-validation';
import { randomUUID } from 'crypto';

export const maxDuration = 10;

interface UpsertRow {
  id: string;
  benefitId: string;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
}

async function runCheckBenefitsLogic(dryRun = false) {
  const now = new Date();
  const startMs = Date.now();
  console.log(`🚀 check-benefits started at: ${now.toISOString()}${dryRun ? ' [DRY RUN]' : ''}`);

  try {
    // Phase 1: Fetch all data in parallel (2 queries instead of sequential)
    const [allCards, standaloneBenefits] = await Promise.all([
      prisma.creditCard.findMany({
        include: {
          benefits: {
            where: { frequency: { not: BenefitFrequency.ONE_TIME } },
            select: {
              id: true,
              frequency: true,
              cycleAlignment: true,
              fixedCycleStartMonth: true,
              fixedCycleDurationMonths: true,
              occurrencesInCycle: true,
            }
          },
          user: { select: { id: true } }
        },
      }),
      prisma.benefit.findMany({
        where: {
          creditCardId: null,
          userId: { not: null },
          frequency: { not: BenefitFrequency.ONE_TIME },
        },
        select: {
          id: true,
          userId: true,
          frequency: true,
          startDate: true,
          cycleAlignment: true,
          fixedCycleStartMonth: true,
          fixedCycleDurationMonths: true,
          occurrencesInCycle: true,
        }
      })
    ]);

    const fetchMs = Date.now() - startMs;
    console.log(`📊 Fetched ${allCards.length} cards + ${standaloneBenefits.length} standalone in ${fetchMs}ms`);

    // Phase 2: Calculate all cycles in memory (CPU only, no DB calls)
    const rows: UpsertRow[] = [];
    let skipped = 0;
    let calcErrors = 0;
    let validationWarnings = 0;

    for (const card of allCards) {
      if (!card.user?.id) { skipped++; continue; }
      const userId = card.user.id;

      for (const benefit of card.benefits) {
        if (
          benefit.cycleAlignment !== BenefitCycleAlignment.CALENDAR_FIXED &&
          benefit.frequency === BenefitFrequency.YEARLY &&
          !card.openedDate
        ) { skipped++; continue; }

        try {
          const { cycleStartDate: raw, cycleEndDate } = calculateBenefitCycle(
            benefit.frequency,
            now,
            card.openedDate,
            benefit.cycleAlignment,
            benefit.fixedCycleStartMonth,
            benefit.fixedCycleDurationMonths
          );
          const cycleStartDate = normalizeCycleDate(raw);

          const validation = validateBenefitCycle(
            {
              description: `Benefit ${benefit.id}`,
              fixedCycleStartMonth: benefit.fixedCycleStartMonth,
              fixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
            },
            { cycleStartDate, cycleEndDate }
          );
          if (!validation.isValid) {
            validationWarnings++;
            console.error(`❌ Validation: benefit ${benefit.id}: ${validation.error}`);
          }

          const occurrences = benefit.occurrencesInCycle || 1;
          for (let i = 0; i < occurrences; i++) {
            rows.push({
              id: randomUUID(),
              benefitId: benefit.id,
              userId,
              cycleStartDate,
              cycleEndDate,
              occurrenceIndex: i,
            });
          }
        } catch (e) {
          calcErrors++;
          console.error(`Cycle error benefit ${benefit.id}:`, e instanceof Error ? e.message : e);
        }
      }
    }

    for (const benefit of standaloneBenefits) {
      if (!benefit.userId) { skipped++; continue; }
      try {
        const { cycleStartDate: raw, cycleEndDate } = calculateStandaloneCycle(
          benefit.frequency, now, new Date(benefit.startDate)
        );
        const cycleStartDate = normalizeCycleDate(raw);
        const occurrences = benefit.occurrencesInCycle || 1;
        for (let i = 0; i < occurrences; i++) {
          rows.push({
            id: randomUUID(),
            benefitId: benefit.id,
            userId: benefit.userId,
            cycleStartDate,
            cycleEndDate,
            occurrenceIndex: i,
          });
        }
      } catch (e) {
        calcErrors++;
        console.error(`Standalone cycle error ${benefit.id}:`, e instanceof Error ? e.message : e);
      }
    }

    const calcMs = Date.now() - startMs - fetchMs;
    console.log(`📊 Calculated ${rows.length} rows in ${calcMs}ms (${skipped} skipped, ${calcErrors} errors)`);

    // Phase 3: Bulk upsert via raw SQL (1-3 queries instead of ~11,000 individual upserts)
    let totalUpserted = 0;

    if (dryRun) {
      console.log(`🔍 [DRY RUN] Would upsert ${rows.length} rows — skipping DB write`);
      totalUpserted = rows.length;
    } else {
      const BATCH_SIZE = 5000;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const count = await bulkUpsertBenefitStatuses(batch);
        totalUpserted += count;
        console.log(`📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${count} rows upserted`);
      }
    }

    const totalMs = Date.now() - startMs;
    console.log(`✅ Done in ${totalMs}ms: ${totalUpserted} upserted from ${rows.length} calculated`);

    return NextResponse.json({
      message: dryRun ? 'Cron job dry run completed.' : 'Cron job executed successfully.',
      dryRun,
      rowsCalculated: rows.length,
      rowsUpserted: totalUpserted,
      cardsProcessed: allCards.length,
      standaloneBenefitsProcessed: standaloneBenefits.length,
      skipped,
      calcErrors,
      validationWarnings,
      durationMs: totalMs,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    const totalMs = Date.now() - startMs;
    console.error(`💥 Failed after ${totalMs}ms:`, error instanceof Error ? error.message : error);
    if (error instanceof Error) console.error('Stack:', error.stack);
    return NextResponse.json({
      message: 'Cron job failed.',
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: totalMs,
      timestamp: now.toISOString(),
    }, { status: 500 });
  }
}

function calculateStandaloneCycle(
  frequency: BenefitFrequency,
  now: Date,
  startDate: Date
): { cycleStartDate: Date; cycleEndDate: Date } {
  const nowTime = now.getTime();
  const startTime = startDate.getTime();

  let cycleDurationMs: number;
  switch (frequency) {
    case BenefitFrequency.WEEKLY:
      cycleDurationMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case BenefitFrequency.MONTHLY:
      cycleDurationMs = 30 * 24 * 60 * 60 * 1000;
      break;
    case BenefitFrequency.QUARTERLY:
      cycleDurationMs = 91 * 24 * 60 * 60 * 1000;
      break;
    case BenefitFrequency.YEARLY:
      cycleDurationMs = 365 * 24 * 60 * 60 * 1000;
      break;
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }

  const cyclesPassed = Math.floor((nowTime - startTime) / cycleDurationMs);
  let cycleStartDate: Date;
  let cycleEndDate: Date;

  if (frequency === BenefitFrequency.WEEKLY) {
    cycleStartDate = new Date(startTime + cyclesPassed * cycleDurationMs);
    cycleEndDate = new Date(cycleStartDate.getTime() + cycleDurationMs - 1);
  } else if (frequency === BenefitFrequency.MONTHLY) {
    cycleStartDate = new Date(startDate);
    cycleStartDate.setUTCMonth(cycleStartDate.getUTCMonth() + cyclesPassed);
    cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + 1);
    cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
  } else if (frequency === BenefitFrequency.QUARTERLY) {
    cycleStartDate = new Date(startDate);
    cycleStartDate.setUTCMonth(cycleStartDate.getUTCMonth() + cyclesPassed * 3);
    cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + 3);
    cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
  } else {
    cycleStartDate = new Date(startDate);
    cycleStartDate.setUTCFullYear(cycleStartDate.getUTCFullYear() + cyclesPassed);
    cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setUTCFullYear(cycleEndDate.getUTCFullYear() + 1);
    cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
  }

  return { cycleStartDate, cycleEndDate };
}

async function bulkUpsertBenefitStatuses(rows: UpsertRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const params: (string | Date | number)[] = [];
  const valueClauses: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const o = i * 6;
    valueClauses.push(
      `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}::timestamptz, $${o + 5}::timestamptz, $${o + 6}, false, 0, false, NOW(), NOW())`
    );
    params.push(
      rows[i].id, rows[i].benefitId, rows[i].userId,
      rows[i].cycleStartDate, rows[i].cycleEndDate, rows[i].occurrenceIndex
    );
  }

  const sql = `
    INSERT INTO "BenefitStatus" ("id", "benefitId", "userId", "cycleStartDate", "cycleEndDate", "occurrenceIndex", "isCompleted", "usedAmount", "isNotUsable", "createdAt", "updatedAt")
    VALUES ${valueClauses.join(', ')}
    ON CONFLICT ("benefitId", "userId", "cycleStartDate", "occurrenceIndex")
    DO UPDATE SET "cycleEndDate" = EXCLUDED."cycleEndDate", "updatedAt" = NOW()
  `;

  return prisma.$executeRawUnsafe(sql, ...params);
}

function parseDryRun(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  return searchParams.get('dryRun') === 'true';
}

export async function GET(request: Request) {
  const authorizationHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron attempt for check-benefits.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return await runCheckBenefitsLogic(parseDryRun(request));
}

export async function POST(request: Request) {
  const authorizationHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron attempt for check-benefits.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return await runCheckBenefitsLogic(parseDryRun(request));
}
