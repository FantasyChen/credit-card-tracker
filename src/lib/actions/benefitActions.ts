'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { materializeBenefitStatusRows } from '@/lib/benefit-cycle-materialization';

/**
 * Ensures that BenefitStatus records exist for the current cycle
 * of all active, recurring benefits for the logged-in user.
 * This should be triggered periodically or on user load.
 */
export async function ensureCurrentBenefitStatuses() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
      return; // Not logged in
  }
  const userId = session.user.id;
  const now = new Date(); // Use a consistent 'now' for all calculations



  try {
    // Fetch all user cards with their benefits
    const userCardsWithBenefits = await prisma.creditCard.findMany({
      where: { userId: userId },
      include: {
        benefits: {
          select: {
            id: true,
            description: true,
            frequency: true,
            cycleAlignment: true,
            fixedCycleStartMonth: true,
            fixedCycleDurationMonths: true,
            occurrencesInCycle: true,
          }
        },
      },
    });

    const upsertPromises: Promise<unknown>[] = [];

    // Iterate through cards and their benefits
    userCardsWithBenefits.forEach(card => {
      card.benefits.forEach(benefit => {
        // Skip ONE_TIME benefits as they don't have recurring cycles
        if (benefit.frequency === BenefitFrequency.ONE_TIME) return;

        // For CARD_ANNIVERSARY alignment, YEARLY benefits require an openedDate.
        // CALENDAR_FIXED benefits do not strictly need it for their cycle calculation but it's good to be aware.
        const cardOpenedDateForCalc: Date | null = card.openedDate;
        if (
          benefit.cycleAlignment !== BenefitCycleAlignment.CALENDAR_FIXED && // only check for non-fixed alignment
          benefit.frequency === BenefitFrequency.YEARLY && 
          !card.openedDate
        ) {
             console.warn(`Skipping YEARLY (anniversary based) benefit cycle for ${benefit.id} as card ${card.id} has no openedDate.`);
             return; 
        }

        try {
          const materialized = materializeBenefitStatusRows(
            {
              ...benefit,
              userId,
            },
            {
              referenceDate: now,
              cardOpenedDate: cardOpenedDateForCalc,
            }
          );

          for (const row of materialized.rows) {
            // Upsert the status: Create if not exists for this cycle start date and occurrence
            upsertPromises.push(
              prisma.benefitStatus.upsert({
                where: {
                  benefitId_userId_cycleStartDate_occurrenceIndex: {
                    benefitId: row.benefitId,
                    userId: row.userId,
                    cycleStartDate: row.cycleStartDate,
                    occurrenceIndex: row.occurrenceIndex,
                  }
                },
                update: {
                  // Ensure end date is updated if calculation logic changes between runs
                  cycleEndDate: row.cycleEndDate,
                },
                create: {
                  benefitId: row.benefitId,
                  userId: row.userId,
                  cycleStartDate: row.cycleStartDate,
                  cycleEndDate: row.cycleEndDate,
                  occurrenceIndex: row.occurrenceIndex,
                  isCompleted: false, // New cycles start as not completed
                },
              })
            );
          }
        } catch (error) { // Explicitly type error if possible, otherwise use unknown or any
          // Add type check for error if necessary, e.g., if (error instanceof Error)
          console.error(`Error calculating cycle for benefit ${benefit.id}:`, error instanceof Error ? error.message : error);
          // Continue with other benefits
        }

      });
    });

    // Execute all upsert operations
    if (upsertPromises.length > 0) {
          await Promise.all(upsertPromises);
        // Remove revalidation from here - it should happen in actions that *trigger* changes
        // revalidatePath('/benefits'); 
    } else {
    
    }

  } catch (error) {
    console.error('ensureCurrentBenefitStatuses: Failed to ensure benefit statuses:', error instanceof Error ? error.message : error);
    // Decide if this error should be surfaced to the user or just logged
  }
}
