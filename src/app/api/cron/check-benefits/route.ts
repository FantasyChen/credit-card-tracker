import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';

// Shared core logic for the cron job
async function runCheckBenefitsLogic() {
  const now = new Date(); 
  console.log(`Core check-benefits logic started at: ${now.toISOString()}`);
  try {
    const allUserCardsWithBenefits = await prisma.creditCard.findMany({
      include: {
        benefits: {
          where: {
            frequency: {
              not: BenefitFrequency.ONE_TIME,
            },
          },
          select: {
            id: true,
            frequency: true,
            cycleAlignment: true,
            fixedCycleStartMonth: true,
            fixedCycleDurationMonths: true,
            occurrencesInCycle: true,
          }
        },
        user: {
            select: {
                id: true, 
            }
        }
      },
    });

    const upsertPromises: Promise<unknown>[] = [];
    let benefitsProcessed = 0;

    for (const card of allUserCardsWithBenefits) {
      if (!card.user?.id) { 
        console.warn(`Card ${card.id} is missing user information. Skipping its benefits.`);
        continue;
      }
      const userId = card.user.id;

      for (const benefit of card.benefits) {
        benefitsProcessed++;
        const cardOpenedDateForCalc: Date | null = card.openedDate;
        
        if (
          benefit.cycleAlignment !== BenefitCycleAlignment.CALENDAR_FIXED &&
          benefit.frequency === BenefitFrequency.YEARLY &&
          !card.openedDate 
        ) {
          console.warn(`Skipping YEARLY (anniversary based) benefit cycle for benefit ${benefit.id} on card ${card.id} as card has no openedDate.`);
          continue;
        }

        try {
          const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
            benefit.frequency,
            now, 
            cardOpenedDateForCalc,
            benefit.cycleAlignment,
            benefit.fixedCycleStartMonth,
            benefit.fixedCycleDurationMonths
          );

          // Create multiple BenefitStatus records based on occurrencesInCycle
          const occurrences = benefit.occurrencesInCycle || 1;
          
          for (let occurrenceIndex = 0; occurrenceIndex < occurrences; occurrenceIndex++) {
            upsertPromises.push(
              prisma.benefitStatus.upsert({
                where: {
                  benefitId_userId_cycleStartDate_occurrenceIndex: {
                    benefitId: benefit.id,
                    userId: userId,
                    cycleStartDate: cycleStartDate,
                    occurrenceIndex: occurrenceIndex,
                  },
                },
                update: {
                  cycleEndDate: cycleEndDate,
                },
                create: {
                  benefitId: benefit.id,
                  userId: userId,
                  cycleStartDate: cycleStartDate,
                  cycleEndDate: cycleEndDate,
                  occurrenceIndex: occurrenceIndex,
                  isCompleted: false, 
                },
              })
            );
          }
        } catch (error) {
          console.error(`Error calculating cycle for benefit ${benefit.id} (user: ${userId}, card: ${card.id}):`, error instanceof Error ? error.message : error);
        }
      }
    }

    if (upsertPromises.length > 0) {
      console.log(`Core logic: Attempting ${upsertPromises.length} benefit status upserts out of ${benefitsProcessed} benefits processed.`);
      await Promise.all(upsertPromises);
      console.log(`Core logic: ${upsertPromises.length} benefit status upserts completed.`);
    } else if (benefitsProcessed > 0) {
      console.log(`Core logic: ${benefitsProcessed} benefits processed, but no new benefit statuses needed upserting.`);
    } else {
      console.log('Core logic: No recurring benefits found to process.');
    }

    return NextResponse.json({ message: 'Cron job executed successfully.', upsertsAttempted: upsertPromises.length, benefitsProcessed }, { status: 200 });

  } catch (error) {
    console.error('Core check-benefits logic failed:', error instanceof Error ? error.message : error, error instanceof Error ? error.stack : '');
    return NextResponse.json({ message: 'Cron job failed.', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// GET handler for Vercel Cron (defaults to GET)
export async function GET(request: Request) {
  const authorizationHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  console.log(`check-benefits GET: Received authorization header: "${authorizationHeader}"`);
  console.log(`check-benefits GET: Expected CRON_SECRET from env: "${expectedSecret}"`);

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set for GET handler.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized GET cron job attempt for check-benefits.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  console.log("Authorized GET request for check-benefits. Running core logic...");
  return await runCheckBenefitsLogic();
}

// POST handler for manual trigger or other services
export async function POST(request: Request) {
  const authorizationHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  console.log(`check-benefits POST: Received authorization header: "${authorizationHeader}"`);
  console.log(`check-benefits POST: Expected CRON_SECRET from env: "${expectedSecret}"`);

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set for POST handler.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized POST cron job attempt for check-benefits.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  console.log("Authorized POST request for check-benefits. Running core logic...");
  return await runCheckBenefitsLogic();
} 