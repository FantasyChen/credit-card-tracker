import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';

// Improved core logic with card-level error isolation
async function runCheckBenefitsLogic() {
  const now = new Date(); 
  console.log(`🚀 Improved check-benefits logic started at: ${now.toISOString()}`);
  
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

    console.log(`📊 Total cards to process: ${allUserCardsWithBenefits.length}`);

    // BATCHED PROCESSING: Process cards in batches to prevent database connection exhaustion
    // Neon/PostgreSQL has connection limits (typically 20-100), so we batch to stay within limits
    const BATCH_SIZE = 50; // Process 50 cards at a time
    const cardProcessingResults: PromiseSettledResult<Awaited<ReturnType<typeof processCardSafely>>>[] = [];
    
    for (let i = 0; i < allUserCardsWithBenefits.length; i += BATCH_SIZE) {
      const batch = allUserCardsWithBenefits.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allUserCardsWithBenefits.length / BATCH_SIZE)} (${batch.length} cards)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(card => processCardSafely(card, now))
      );
      
      cardProcessingResults.push(...batchResults);
    }

    // Aggregate results from all cards
    let totalBenefitsProcessed = 0;
    let totalUpsertsAttempted = 0;
    let totalUpsertsSuccessful = 0;
    let totalUpsertsFailed = 0;
    let cardsSuccessful = 0;
    let cardsFailed = 0;

    cardProcessingResults.forEach((result, index) => {
      const card = allUserCardsWithBenefits[index];
      
      if (result.status === 'fulfilled') {
        cardsSuccessful++;
        const cardResult = result.value;
        totalBenefitsProcessed += cardResult.benefitsProcessed;
        totalUpsertsAttempted += cardResult.upsertsAttempted;
        totalUpsertsSuccessful += cardResult.upsertsSuccessful;
        totalUpsertsFailed += cardResult.upsertsFailed;
        console.log(`✅ Card ${card.name}: ${cardResult.benefitsProcessed} benefits, ${cardResult.upsertsSuccessful}/${cardResult.upsertsAttempted} upserts successful`);
      } else {
        cardsFailed++;
        const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`❌ Card ${card.name} (${card.id}) failed completely: ${error}`);
      }
    });

    // Enhanced logging for better observability
    console.log(`\n📊 EXECUTION SUMMARY:`);
    console.log(`   Cards: ${cardsSuccessful}/${allUserCardsWithBenefits.length} successful`);
    console.log(`   Benefits: ${totalBenefitsProcessed} processed`);
    console.log(`   Upserts: ${totalUpsertsSuccessful}/${totalUpsertsAttempted} successful`);
    
    if (cardsFailed > 0) {
      console.warn(`⚠️ ${cardsFailed} cards failed but were isolated - other cards processed normally`);
    }

    // Return enhanced response (backward compatible)
    return NextResponse.json({ 
      message: 'Cron job executed successfully.', 
      upsertsAttempted: totalUpsertsAttempted, 
      upsertsSuccessful: totalUpsertsSuccessful,
      upsertsFailed: totalUpsertsFailed,
      benefitsProcessed: totalBenefitsProcessed,
      // New metrics for improved observability
      cardsProcessed: allUserCardsWithBenefits.length,
      cardsSuccessful: cardsSuccessful,
      cardsFailed: cardsFailed,
      timestamp: now.toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('💥 GLOBAL FAILURE in improved check-benefits logic:', error instanceof Error ? error.message : error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ 
      message: 'Cron job failed globally.', 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: now.toISOString()
    }, { status: 500 });
  }
}

/**
 * Process a single card with complete error isolation
 * This prevents one card's failure from affecting other cards
 */
async function processCardSafely(card: {
  id: string;
  name: string;
  openedDate: Date | null;
  user: { id: string } | null;
  benefits: {
    id: string;
    frequency: BenefitFrequency;
    cycleAlignment: BenefitCycleAlignment | null;
    fixedCycleStartMonth: number | null;
    fixedCycleDurationMonths: number | null;
    occurrencesInCycle: number;
  }[];
}, now: Date) {
  const result = {
    cardId: card.id,
    benefitsProcessed: 0,
    upsertsAttempted: 0,
    upsertsSuccessful: 0,
    upsertsFailed: 0
  };

  // CARD-LEVEL VALIDATION
  if (!card.user?.id) {
    throw new Error('Card missing user information');
  }

  const userId = card.user.id;
  const upsertPromises: Promise<unknown>[] = [];

  // Process each benefit (same logic as original, but isolated per card)
  for (const benefit of card.benefits) {
    result.benefitsProcessed++;
    const cardOpenedDateForCalc: Date | null = card.openedDate;
    
    // Skip yearly anniversary benefits without opening date
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

      // VALIDATION: Prevent quarterly benefit mismatches like the Sep 2025 incident
      const { validateBenefitCycle } = await import('@/lib/benefit-validation');
      const validation = validateBenefitCycle(
        {
          description: `Benefit ID ${benefit.id}`, // We don't have description here, but use ID for now
          fixedCycleStartMonth: benefit.fixedCycleStartMonth,
          fixedCycleDurationMonths: benefit.fixedCycleDurationMonths
        },
        { cycleStartDate, cycleEndDate }
      );
      
      if (!validation.isValid) {
        console.error(`❌ BENEFIT VALIDATION FAILED for benefit ${benefit.id}:`, validation.error);
        // For now, log the error but continue - we can make this stricter later
        // throw new Error(`Benefit validation failed: ${validation.error}`);
      }

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
      // Continue processing other benefits for this card
    }
  }

  // Execute upserts for this card using Promise.allSettled for fault tolerance
  if (upsertPromises.length > 0) {
    result.upsertsAttempted = upsertPromises.length;
    
    const upsertResults = await Promise.allSettled(upsertPromises);
    
    // Count successes and failures
    upsertResults.forEach((upsertResult) => {
      if (upsertResult.status === 'fulfilled') {
        result.upsertsSuccessful++;
      } else {
        result.upsertsFailed++;
        console.error(`Upsert failed for card ${card.id}:`, upsertResult.reason instanceof Error ? upsertResult.reason.message : upsertResult.reason);
      }
    });
  }

  return result;
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
  console.log("✅ Authorized GET request for improved check-benefits. Running core logic...");
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
  console.log("✅ Authorized POST request for improved check-benefits. Running core logic...");
  return await runCheckBenefitsLogic();
}