import { prisma } from '@/lib/prisma';
import { calculateBenefitCycle, calculateOneTimeBenefitLifetime } from '@/lib/benefit-cycle';
import { normalizeCycleDate } from '@/lib/dateUtils';
import { BenefitFrequency } from '@/generated/prisma';

interface CreateCardResult {
  success: boolean;
  message?: string;
  cardId?: string;
}

/**
 * Core logic to create a CreditCard, its Benefits, and initial BenefitStatuses
 * based on a PredefinedCard for a given user.
 */
export async function createCardForUser(
  userId: string,
  predefinedCardId: string,
  openedDateInput: Date | null,
  lastFourDigits?: string | null,
  nickname?: string | null
): Promise<CreateCardResult> {


  // Default openedDate if none provided (used for benefit cycle calculation)
  let openedDate: Date;
  if (openedDateInput) {
    openedDate = openedDateInput;
  } else {
    const currentYear = new Date().getUTCFullYear();
    openedDate = new Date(Date.UTC(currentYear, 0, 1)); // Default to Jan 1st of current year

  }

  try {
    // 1. Fetch the predefined card and its benefits
    const predefinedCard = await prisma.predefinedCard.findUnique({
      where: { id: predefinedCardId },
      include: {
        benefits: { // Select all needed fields from PredefinedBenefit
          select: {
            id: true,
            category: true,
            description: true,
            percentage: true,
            maxAmount: true,
            frequency: true,
            cycleAlignment: true,
            fixedCycleStartMonth: true,
            fixedCycleDurationMonths: true,
            occurrencesInCycle: true,
          }
        }
      },
    });

    if (!predefinedCard) {
      console.error('createCardForUser: Predefined card not found for ID:', predefinedCardId);
      return { success: false, message: 'Predefined card not found.' };
    }


    // 2. Create the credit card
    const newCreditCard = await prisma.creditCard.create({
      data: {
        name: predefinedCard.name,
        issuer: predefinedCard.issuer,
        userId: userId,
        openedDate: openedDate, // Use the determined openedDate
        lastFourDigits: lastFourDigits || null, // Include last 4 digits if provided
        nickname: nickname || null, // Include nickname if provided
      },
    });


    // 3. Create benefits and initial statuses
    const now = new Date(); // Consistent time for this operation
    for (const predefBenefit of predefinedCard.benefits) {
      // Create the benefit record
      const newBenefit = await prisma.benefit.create({
        data: {
          creditCardId: newCreditCard.id,
          category: predefBenefit.category,
          description: predefBenefit.description,
          percentage: predefBenefit.percentage,
          maxAmount: predefBenefit.maxAmount,
          frequency: predefBenefit.frequency, // Assumes type compatibility
          cycleAlignment: predefBenefit.cycleAlignment,
          fixedCycleStartMonth: predefBenefit.fixedCycleStartMonth,
          fixedCycleDurationMonths: predefBenefit.fixedCycleDurationMonths,
          occurrencesInCycle: predefBenefit.occurrencesInCycle,
          startDate: now, // Set start date to now
        }
      });

      // Calculate and create initial BenefitStatus records (multiple if occurrencesInCycle > 1)
      let cycleInfo: { cycleStartDate: Date; cycleEndDate: Date };
      if (newBenefit.frequency === BenefitFrequency.ONE_TIME) {
        cycleInfo = calculateOneTimeBenefitLifetime(newBenefit.startDate);
      } else {
        const rawCycleInfo = calculateBenefitCycle(
          newBenefit.frequency,
          now, // Reference date is now
          openedDate, // Use the determined openedDate for cycle calculation
          newBenefit.cycleAlignment,
          newBenefit.fixedCycleStartMonth,
          newBenefit.fixedCycleDurationMonths
        );
        
        // CRITICAL: Normalize cycleStartDate to midnight UTC to prevent duplicate records
        cycleInfo = {
          cycleStartDate: normalizeCycleDate(rawCycleInfo.cycleStartDate),
          cycleEndDate: rawCycleInfo.cycleEndDate
        };

        // SOURCE-LEVEL PROTECTION: Validate benefit cycles during card creation
        // Log validation warnings but don't block card creation
        const { validateBenefitCycle } = await import('@/lib/benefit-validation');
        const validation = validateBenefitCycle(
          {
            description: newBenefit.description,
            fixedCycleStartMonth: newBenefit.fixedCycleStartMonth,
            fixedCycleDurationMonths: newBenefit.fixedCycleDurationMonths
          },
          cycleInfo
        );
        
        if (!validation.isValid) {
          // Log warning but continue - don't block card creation
          console.warn(`⚠️ BENEFIT VALIDATION WARNING for "${newBenefit.description}":`, validation.error);
          console.warn(`   Cycle: ${cycleInfo.cycleStartDate.toISOString()} → ${cycleInfo.cycleEndDate.toISOString()}`);
          console.warn(`   Continuing with card creation...`);
        }
      }

      // Create multiple BenefitStatus records based on occurrencesInCycle
      const occurrences = newBenefit.occurrencesInCycle || 1;
      for (let occurrenceIndex = 0; occurrenceIndex < occurrences; occurrenceIndex++) {
        await prisma.benefitStatus.create({
          data: {
            benefitId: newBenefit.id,
            userId: userId,
            cycleStartDate: cycleInfo.cycleStartDate,
            cycleEndDate: cycleInfo.cycleEndDate,
            occurrenceIndex: occurrenceIndex,
            isCompleted: false,
          }
        });
      }
    }


    return { success: true, cardId: newCreditCard.id };

  } catch (error) {
    console.error('createCardForUser error:', error);
    let message = 'Failed to create the card.';
    if (error instanceof Error) {
        message = error.message;
    }
    // Log additional Prisma error details in development
    if (process.env.NODE_ENV === 'development' && error && typeof error === 'object' && 'code' in error) {
      console.error(`Prisma Error Code: ${(error as Record<string, unknown>).code}`);
      if ('meta' in error) {
        console.error('Meta:', (error as Record<string, unknown>).meta);
      }
    }
    return { success: false, message: message };
  }
} 