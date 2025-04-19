'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { calculateBenefitCycle, calculateOneTimeBenefitLifetime } from '@/lib/benefit-cycle';
import { BenefitFrequency } from '@/generated/prisma';

export async function addCardAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }
  const userId = session.user.id;

  const predefinedCardId = formData.get('predefinedCardId') as string;
  const openedMonthString = formData.get('openedMonth') as string | null;
  const openedYearString = formData.get('openedYear') as string | null;

  if (!predefinedCardId) {
    throw new Error('Predefined card ID is missing.');
  }

  let openedDate: Date | null = null;
  if (openedMonthString && openedYearString) {
    const month = parseInt(openedMonthString, 10);
    const year = parseInt(openedYearString, 10);
    if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(year)) {
      openedDate = new Date(Date.UTC(year, month - 1, 1));
    } else {
      throw new Error('Invalid month or year provided.');
    }
  } else if (openedMonthString || openedYearString) {
    throw new Error('Please provide both month and year or leave both blank.');
  }

  console.log('--- Starting Add Card Action ---');
  console.log('User ID:', userId);
  console.log('Predefined Card ID:', predefinedCardId);
  console.log('Opened Date:', openedDate);

  try {
    // Verify user exists before proceeding
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!userExists) {
        console.error(`Add Card Action Error: User with ID ${userId} not found in database.`);
        throw new Error('Authentication error: User not found. Please log out and log back in.');
    }

    // Fetch the predefined card
    const predefinedCard = await prisma.predefinedCard.findUnique({
      where: { id: predefinedCardId },
      include: { benefits: true },
    });

    if (!predefinedCard) {
      console.error('Predefined card not found for ID:', predefinedCardId);
      throw new Error('Predefined card not found.');
    }
    console.log('Fetched Predefined Card:', predefinedCard.name);
    console.log('Benefits count:', predefinedCard.benefits.length);
    
    // Print detailed benefit info for debugging
    predefinedCard.benefits.forEach((benefit, index) => {
      console.log(`Benefit ${index + 1}:`, {
        category: benefit.category,
        description: benefit.description,
        percentage: benefit.percentage,
        maxAmount: benefit.maxAmount,
        frequency: benefit.frequency,
      });
    });

    // Let's use a simpler approach without transactions first
    // 1. Create the credit card
    const creditCardData = {
      name: predefinedCard.name,
      issuer: predefinedCard.issuer,
      userId: userId,
      openedDate: openedDate,
    };
    console.log('Attempting to create CreditCard with data:', creditCardData);
    const newCreditCard = await prisma.creditCard.create({ data: creditCardData });
    console.log('Successfully created CreditCard ID:', newCreditCard.id);

    // 2. Create benefits one by one
    for (const predefBenefit of predefinedCard.benefits) {
      console.log(`Processing benefit: ${predefBenefit.description}`);
      
      const now = new Date();
      // Ensure we have a valid frequency by using the enum directly
      let frequency: BenefitFrequency;
      switch (predefBenefit.frequency) {
        case BenefitFrequency.MONTHLY:
          frequency = BenefitFrequency.MONTHLY;
          break;
        case BenefitFrequency.QUARTERLY:
          frequency = BenefitFrequency.QUARTERLY;
          break;
        case BenefitFrequency.YEARLY:
          frequency = BenefitFrequency.YEARLY;
          break;
        default:
          frequency = BenefitFrequency.ONE_TIME;
      }
      
      // Create the benefit with explicit fields matching the schema
      const newBenefit = await prisma.benefit.create({
        data: {
          creditCardId: newCreditCard.id,
          category: predefBenefit.category,
          description: predefBenefit.description,
          percentage: predefBenefit.percentage,
          maxAmount: predefBenefit.maxAmount,
          frequency: frequency,
          startDate: now,
          // endDate is optional, so we can omit it
        }
      });
      console.log(`Created benefit: ${newBenefit.id}`);

      // 3. Calculate and create initial BenefitStatus using the new functions
      try {
        let cycleInfo: { cycleStartDate: Date; cycleEndDate: Date };

        if (newBenefit.frequency === BenefitFrequency.ONE_TIME) {
          cycleInfo = calculateOneTimeBenefitLifetime(newBenefit.startDate);
        } else {
          // For recurring benefits, calculate the first cycle based on 'now'
          // and the card's openedDate (which might be null)
          cycleInfo = calculateBenefitCycle(
            newBenefit.frequency,
            now, // Reference date for initial calculation is now
            openedDate
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
        console.log(`Created benefit status for benefit: ${newBenefit.id}`);
      } catch (cycleError) {
        console.error('Error with benefit cycle:', cycleError);
        throw cycleError;
      }
    }

    console.log('--- Completed Successfully ---');
    revalidatePath('/');
    revalidatePath('/cards');
    revalidatePath('/dashboard');

  } catch (error) {
    console.error('--- ERROR in Add Card Action ---');
    console.error('Full error:', error);
    // Get specific error details if it's a PrismaClientKnownRequestError
    if (error && typeof error === 'object' && 'code' in error) {
      console.error(`Prisma Error Code: ${error.code}`);
      if ('meta' in error) {
        console.error('Meta:', error.meta);
      }
    }
    throw new Error('Failed to add the card. Please check the details and try again.');
  }

  console.log('--- Redirecting ---');
  redirect('/');
} 