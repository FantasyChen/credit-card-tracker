import { prisma } from '@/lib/prisma';
import { calculateBenefitCycle, calculateOneTimeBenefitLifetime } from '@/lib/benefit-cycle';
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
  lastFourDigits?: string | null
): Promise<CreateCardResult> {
  console.log('--- Running createCardForUser ---');
  console.log('User ID:', userId);
  console.log('Predefined Card ID:', predefinedCardId);
  console.log('Opened Date Input:', openedDateInput);

  // Default openedDate if none provided (used for benefit cycle calculation)
  let openedDate: Date;
  if (openedDateInput) {
    openedDate = openedDateInput;
  } else {
    const currentYear = new Date().getUTCFullYear();
    openedDate = new Date(Date.UTC(currentYear, 0, 1)); // Default to Jan 1st of current year
    console.log('Defaulted openedDate to:', openedDate.toISOString());
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
          }
        }
      },
    });

    if (!predefinedCard) {
      console.error('createCardForUser: Predefined card not found for ID:', predefinedCardId);
      return { success: false, message: 'Predefined card not found.' };
    }
    console.log('createCardForUser: Fetched Predefined Card:', predefinedCard.name);

    // 2. Create the credit card
    const newCreditCard = await prisma.creditCard.create({
      data: {
        name: predefinedCard.name,
        issuer: predefinedCard.issuer,
        userId: userId,
        openedDate: openedDate, // Use the determined openedDate
        lastFourDigits: lastFourDigits || null, // Include last 4 digits if provided
      },
    });
    console.log('createCardForUser: Created CreditCard ID:', newCreditCard.id);

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
          startDate: now, // Set start date to now
        }
      });

      // Calculate and create initial BenefitStatus
      let cycleInfo: { cycleStartDate: Date; cycleEndDate: Date };
      if (newBenefit.frequency === BenefitFrequency.ONE_TIME) {
        cycleInfo = calculateOneTimeBenefitLifetime(newBenefit.startDate);
      } else {
        cycleInfo = calculateBenefitCycle(
          newBenefit.frequency,
          now, // Reference date is now
          openedDate, // Use the determined openedDate for cycle calculation
          newBenefit.cycleAlignment,
          newBenefit.fixedCycleStartMonth,
          newBenefit.fixedCycleDurationMonths
        );
      }

      await prisma.benefitStatus.create({
        data: {
          benefitId: newBenefit.id,
          userId: userId,
          cycleStartDate: cycleInfo.cycleStartDate,
          cycleEndDate: cycleInfo.cycleEndDate,
          isCompleted: false,
        }
      });
    }

    console.log('createCardForUser: Successfully created card and benefits.');
    return { success: true, cardId: newCreditCard.id };

  } catch (error) {
    console.error('--- ERROR in createCardForUser ---');
    console.error('Error details:', error);
    let message = 'Failed to create the card.';
    if (error instanceof Error) {
        message = error.message;
    }
    // Check for specific Prisma errors if needed
    if (error && typeof error === 'object' && 'code' in error) {
      console.error(`Prisma Error Code: ${error.code}`);
      if ('meta' in error) {
        console.error('Meta:', error.meta);
      }
    }
    return { success: false, message: message };
  }
} 