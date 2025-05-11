import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';

// This function will handle POST requests from the cron job.
// Vercel Cron Jobs can send POST requests.
export async function POST(request: Request) {
  // 1. Verify Cron Secret
  // The secret should be passed in the Authorization header, e.g., "Bearer YOUR_CRON_SECRET"
  // Or as a query parameter if your cron service prefers that.
  // For Vercel Cron, you can set an environment variable and check it.
  const authorizationHeader = request.headers.get('Authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set in environment variables.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron job attempt.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date(); // Revert to actual system time for production
  // const now = new Date('2025-05-10T12:00:00Z'); // Previous test date
  // const now = new Date('2025-07-05T12:00:00Z'); // TESTING: July 05, 2025. Use a consistent 'now' for all calculations in this run
  console.log(`Cron job /api/cron/check-benefits started at: ${now.toISOString()}`);

  try {
    // 2. Fetch all user credit cards with their benefits that are recurring
    const allUserCardsWithBenefits = await prisma.creditCard.findMany({
      include: {
        benefits: {
          where: {
            frequency: {
              not: BenefitFrequency.ONE_TIME,
            },
          },
          // Select necessary fields from Benefit for cycle calculation
          select: {
            id: true,
            frequency: true,
            cycleAlignment: true,
            fixedCycleStartMonth: true,
            fixedCycleDurationMonths: true,
            // We don't need benefit.startDate or endDate here as cycle is based on 'now'
          }
        },
        // Select necessary fields from CreditCard
        user: {
            select: {
                id: true, // We need the userId
            }
        }
      },
    });

    const upsertPromises: Promise<unknown>[] = [];
    let benefitsProcessed = 0;

    for (const card of allUserCardsWithBenefits) {
      if (!card.user?.id) { // Should always have a user, but good to check
        console.warn(`Card ${card.id} is missing user information. Skipping its benefits.`);
        continue;
      }
      const userId = card.user.id;

      for (const benefit of card.benefits) {
        benefitsProcessed++;
        // For CARD_ANNIVERSARY alignment, YEARLY benefits require an openedDate.
        // CALENDAR_FIXED benefits do not strictly need it for their cycle calculation.
        const cardOpenedDateForCalc: Date | null = card.openedDate; // card.openedDate is already included by default on CreditCard
        
        if (
          benefit.cycleAlignment !== BenefitCycleAlignment.CALENDAR_FIXED &&
          benefit.frequency === BenefitFrequency.YEARLY &&
          !card.openedDate // Check the actual card's openedDate
        ) {
          console.warn(`Skipping YEARLY (anniversary based) benefit cycle for benefit ${benefit.id} on card ${card.id} as card has no openedDate.`);
          continue;
        }

        try {
          const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
            benefit.frequency,
            now, // Reference date is now
            cardOpenedDateForCalc,
            benefit.cycleAlignment,
            benefit.fixedCycleStartMonth,
            benefit.fixedCycleDurationMonths
          );

          // Upsert the status: Create if not exists for this cycle start date
          upsertPromises.push(
            prisma.benefitStatus.upsert({
              where: {
                benefitId_userId_cycleStartDate: {
                  benefitId: benefit.id,
                  userId: userId,
                  cycleStartDate: cycleStartDate,
                },
              },
              update: {
                // Ensure end date is updated if calculation logic changes
                cycleEndDate: cycleEndDate,
                // We don't touch isCompleted or completedAt here,
                // new cycles are created as false by default in the 'create' block.
                // If an old status is found, its completion status is preserved.
              },
              create: {
                benefitId: benefit.id,
                userId: userId,
                cycleStartDate: cycleStartDate,
                cycleEndDate: cycleEndDate,
                isCompleted: false, // New cycles start as not completed
              },
            })
          );
        } catch (error) {
          console.error(`Error calculating cycle for benefit ${benefit.id} (user: ${userId}, card: ${card.id}):`, error instanceof Error ? error.message : error);
          // Continue with other benefits even if one fails
        }
      }
    }

    // Execute all upsert operations
    if (upsertPromises.length > 0) {
      console.log(`Cron job: Attempting ${upsertPromises.length} benefit status upserts out of ${benefitsProcessed} benefits processed.`);
      await Promise.all(upsertPromises);
      console.log(`Cron job: ${upsertPromises.length} benefit status upserts completed.`);
    } else if (benefitsProcessed > 0) {
      console.log(`Cron job: ${benefitsProcessed} benefits processed, but no new benefit statuses needed upserting.`);
    } else {
      console.log('Cron job: No recurring benefits found to process.');
    }

    return NextResponse.json({ message: 'Cron job executed successfully.', upsertsAttempted: upsertPromises.length, benefitsProcessed }, { status: 200 });

  } catch (error) {
    console.error('Cron job /api/cron/check-benefits failed:', error instanceof Error ? error.message : error, error instanceof Error ? error.stack : '');
    return NextResponse.json({ message: 'Cron job failed.', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// Optional: Add a GET handler for easy testing via browser if needed,
// but ensure it's also protected or only enabled in development.
// For production, POST with secret is recommended for cron.
export async function GET(request: Request) {
  // Implement similar logic as POST, perhaps without a body but with query param secret
  // OR just call the POST handler internally after auth.
  // This is mainly for convenience during development.
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set in GET handler of check-benefits.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }
  
  if (secret !== expectedSecret) {
    console.warn('Unauthorized cron GET attempt to check-benefits.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  // Simulate a POST request for testing or call a shared internal function
  // This is a simplified example; consider refactoring to a shared function if GET is needed
  console.log("Cron GET request received for check-benefits, calling POST logic internally.");
  const pseudoPostRequest = new Request(request.url, { // Use request.url to preserve original URL info if needed by POST logic
      method: 'POST',
      headers: new Headers({ 'Authorization': `Bearer ${expectedSecret}`}) // Pass the validated secret
      // No body is needed as the POST handler for check-benefits doesn't use it.
  });
  return await POST(pseudoPostRequest);
} 