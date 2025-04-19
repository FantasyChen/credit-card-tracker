'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { BenefitFrequency } from '@/generated/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';
import { revalidatePath } from 'next/cache';

/**
 * Ensures that BenefitStatus records exist for the current cycle
 * of all active, recurring benefits for the logged-in user.
 * This should be triggered periodically or on user load.
 */
export async function ensureCurrentBenefitStatuses() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.log('ensureCurrentBenefitStatuses: No session found.');
    return; // Not logged in
  }
  const userId = session.user.id;
  const now = new Date(); // Use a consistent 'now' for all calculations

  console.log(`ensureCurrentBenefitStatuses: Running for user ${userId} at ${now.toISOString()}`);

  try {
    // Fetch all user cards with their benefits
    const userCardsWithBenefits = await prisma.creditCard.findMany({
      where: { userId: userId },
      include: {
        benefits: true,
      },
    });

    const upsertPromises: Promise<any>[] = [];

    // Iterate through cards and their benefits
    userCardsWithBenefits.forEach(card => {
      card.benefits.forEach(benefit => {
        // Skip ONE_TIME benefits as they don't have recurring cycles
        if (benefit.frequency === BenefitFrequency.ONE_TIME) return;

        // Yearly benefits require an openedDate for anniversary calculation.
        // Monthly/Quarterly can use calendar periods even without openedDate.
        let cardOpenedDateForCalc: Date | null = card.openedDate;
        if (benefit.frequency === BenefitFrequency.YEARLY && !card.openedDate) {
             console.warn(`Skipping YEARLY benefit cycle generation for benefit ${benefit.id} as card ${card.id} has no openedDate.`);
             return; // Cannot calculate anniversary year without opened date
        }

        // Calculate the expected dates for the *current* cycle based on 'now'
        try {
          const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
            benefit.frequency,
            now, // Reference date is now
            cardOpenedDateForCalc
          );

          // Optional: Add a check to avoid creating statuses for cycles that ended long ago?
          // const bufferDays = 30; // e.g., don't create if cycle ended more than 30 days ago
          // const cutoffDate = new Date(now.getTime() - bufferDays * 24 * 60 * 60 * 1000);
          // if (cycleEndDate < cutoffDate) {
          //   return;
          // }

          // Upsert the status: Create if not exists for this cycle start date
          upsertPromises.push(
            prisma.benefitStatus.upsert({
              where: {
                benefitId_userId_cycleStartDate: {
                  benefitId: benefit.id,
                  userId: userId,
                  cycleStartDate: cycleStartDate,
                }
              },
              update: {
                // Ensure end date is updated if calculation logic changes between runs
                cycleEndDate: cycleEndDate,
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
        } catch (error) { // Explicitly type error if possible, otherwise use unknown or any
            // Add type check for error if necessary, e.g., if (error instanceof Error)
            console.error(`Error calculating cycle for benefit ${benefit.id}:`, error instanceof Error ? error.message : error);
            // Continue with other benefits
        }

      });
    });

    // Execute all upsert operations
    if (upsertPromises.length > 0) {
        console.log(`ensureCurrentBenefitStatuses: Attempting ${upsertPromises.length} upserts.`);
        await Promise.all(upsertPromises);
        console.log('ensureCurrentBenefitStatuses: Upserts completed.');
        // Revalidate paths that display benefit info after potential updates
        revalidatePath('/benefits');
        // Potentially revalidate other paths like dashboard if it shows benefit summaries
        // revalidatePath('/');
    } else {
        console.log('ensureCurrentBenefitStatuses: No benefit statuses needed upserting.');
    }

  } catch (error) {
    console.error('ensureCurrentBenefitStatuses: Failed to ensure benefit statuses:', error instanceof Error ? error.message : error);
    // Decide if this error should be surfaced to the user or just logged
  }
}