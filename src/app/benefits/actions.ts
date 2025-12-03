'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { calculateBenefitCycle, calculateOneTimeBenefitLifetime } from '@/lib/benefit-cycle';
import { z } from 'zod';
import { redirect } from 'next/navigation';

// Validation schema for custom benefit creation
const customBenefitSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  category: z.enum(['Travel', 'Dining', 'Shopping', 'Entertainment', 'Transportation', 'Other']),
  maxAmount: z.number().positive('Value must be positive'),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME']),
  startDate: z.date(),
});

export async function toggleBenefitStatusAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Should ideally not happen if page requires login, but good practice
    throw new Error('User not authenticated.');
  }

  const benefitStatusId = formData.get('benefitStatusId') as string;
  const currentIsCompleted = formData.get('isCompleted') === 'true'; // Get current status from form

  if (!benefitStatusId) {
    throw new Error('Benefit Status ID is missing.');
  }

  const newIsCompleted = !currentIsCompleted;

  try {
    // Verify the status belongs to the current user before updating
    const updatedStatus = await prisma.benefitStatus.updateMany({
      where: {
        id: benefitStatusId,
        userId: session.user.id, // Ensure user owns this status record
      },
      data: {
        isCompleted: newIsCompleted,
        completedAt: newIsCompleted ? new Date() : null, // Set/clear completed timestamp
      },
    });

    if (updatedStatus.count === 0) {
      // This means either the ID was wrong or the user didn't own it
      throw new Error('Benefit status not found or permission denied.');
    }

    console.log(`Benefit status ${benefitStatusId} toggled to ${newIsCompleted}`);

    // Revalidate the benefits page to show the change
    revalidatePath('/benefits');

  } catch (error) {
    console.error('Error toggling benefit status:', error);
    // Consider returning a more user-friendly error
    throw new Error('Failed to update benefit status.');
  }

  // No redirect needed, revalidation handles the UI update
}

export async function markBenefitAsNotUsableAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const benefitStatusId = formData.get('benefitStatusId') as string;
  const currentIsNotUsable = formData.get('isNotUsable') === 'true';

  if (!benefitStatusId) {
    throw new Error('Benefit Status ID is missing.');
  }

  const newIsNotUsable = !currentIsNotUsable;

  try {
    // Verify the status belongs to the current user before updating
    const updatedStatus = await prisma.benefitStatus.updateMany({
      where: {
        id: benefitStatusId,
        userId: session.user.id, // Ensure user owns this status record
      },
      data: {
        isNotUsable: newIsNotUsable,
        // If marking as not usable, also ensure it's not marked as completed
        ...(newIsNotUsable && { isCompleted: false, completedAt: null }),
      },
    });

    if (updatedStatus.count === 0) {
      throw new Error('Benefit status not found or permission denied.');
    }

    console.log(`Benefit status ${benefitStatusId} marked as not usable: ${newIsNotUsable}`);

    // Revalidate the benefits page to show the change
    revalidatePath('/benefits');

  } catch (error) {
    console.error('Error marking benefit as not usable:', error);
    throw new Error('Failed to update benefit status.');
  }
}

export async function updateBenefitOrderAction(benefitStatusIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  try {
    // Update the orderIndex for each benefit status
    const updatePromises = benefitStatusIds.map((id, index) =>
      prisma.benefitStatus.updateMany({
        where: {
          id: id,
          userId: session.user.id, // Ensure user owns this status record
        },
        data: {
          orderIndex: index,
        },
      })
    );

    await Promise.all(updatePromises);

    console.log(`Updated order for ${benefitStatusIds.length} benefit statuses`);

    // Revalidate the benefits page to show the change
    revalidatePath('/benefits');

  } catch (error) {
    console.error('Error updating benefit order:', error);
    throw new Error('Failed to update benefit order.');
  }
}

export async function batchCompleteBenefitsByCategoryAction(category: string, benefitStatusIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  if (!category || benefitStatusIds.length === 0) {
    throw new Error('Category and benefit status IDs are required.');
  }

  try {
    const now = new Date();
    
    // Update all the benefit statuses in the specified category
    const updatedStatuses = await prisma.benefitStatus.updateMany({
      where: {
        id: { in: benefitStatusIds },
        userId: session.user.id, // Ensure user owns these status records
        isCompleted: false, // Only update uncompleted benefits
        isNotUsable: false, // Don't update benefits marked as not usable
        benefit: {
          category: category, // Additional validation that these benefits are in the correct category
        },
      },
      data: {
        isCompleted: true,
        completedAt: now,
      },
    });

    console.log(`Batch completed ${updatedStatuses.count} benefits in category: ${category}`);

    // Revalidate the benefits page to show the changes
    revalidatePath('/benefits');

    return { success: true, updatedCount: updatedStatuses.count };

  } catch (error) {
    console.error('Error batch completing benefits by category:', error);
    throw new Error('Failed to batch complete benefits.');
  }
}

// ==================== CUSTOM BENEFIT ACTIONS ====================

/**
 * Create a new standalone custom benefit (not tied to a credit card)
 */
export async function createCustomBenefitAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/benefits/custom');
  }

  const userId = session.user.id;

  // Parse form data
  const description = formData.get('description') as string;
  const category = formData.get('category') as string;
  const maxAmountStr = formData.get('maxAmount') as string;
  const frequencyStr = formData.get('frequency') as string;
  const startDateStr = formData.get('startDate') as string;

  // Validate input
  const parseResult = customBenefitSchema.safeParse({
    description,
    category,
    maxAmount: parseFloat(maxAmountStr),
    frequency: frequencyStr,
    startDate: startDateStr ? new Date(startDateStr) : new Date(),
  });

  if (!parseResult.success) {
    console.error('Validation error:', parseResult.error);
    throw new Error(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const { description: desc, category: cat, maxAmount, frequency, startDate } = parseResult.data;

  try {
    // Create the benefit
    const benefit = await prisma.benefit.create({
      data: {
        description: desc,
        category: cat,
        maxAmount,
        percentage: 0, // Custom benefits don't use percentage
        frequency: frequency as BenefitFrequency,
        startDate,
        userId, // Standalone benefit - tied to user, not card
        creditCardId: null,
        cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
        occurrencesInCycle: 1,
      },
    });

    // Calculate the initial cycle dates
    const now = new Date();
    let cycleStartDate: Date;
    let cycleEndDate: Date;

    if (frequency === 'ONE_TIME') {
      const cycle = calculateOneTimeBenefitLifetime(startDate);
      cycleStartDate = cycle.cycleStartDate;
      cycleEndDate = cycle.cycleEndDate;
    } else {
      const cycle = calculateBenefitCycle(
        frequency as BenefitFrequency,
        now,
        null, // No card opened date for standalone benefits
        null,
        null,
        null
      );
      cycleStartDate = cycle.cycleStartDate;
      cycleEndDate = cycle.cycleEndDate;
    }

    // Create the initial benefit status
    await prisma.benefitStatus.create({
      data: {
        benefitId: benefit.id,
        userId,
        cycleStartDate,
        cycleEndDate,
        isCompleted: false,
        occurrenceIndex: 0,
      },
    });

    console.log(`Created custom benefit: ${desc} for user ${userId}`);

    revalidatePath('/benefits');
    revalidatePath('/benefits/custom');

  } catch (error) {
    console.error('Error creating custom benefit:', error);
    throw new Error('Failed to create custom benefit.');
  }

  redirect('/benefits');
}

/**
 * Update an existing custom benefit
 */
export async function updateCustomBenefitAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const benefitId = formData.get('benefitId') as string;
  const description = formData.get('description') as string;
  const category = formData.get('category') as string;
  const maxAmountStr = formData.get('maxAmount') as string;
  const frequencyStr = formData.get('frequency') as string;

  if (!benefitId) {
    throw new Error('Benefit ID is required.');
  }

  // Validate the benefit belongs to the user and is a custom benefit
  const existingBenefit = await prisma.benefit.findFirst({
    where: {
      id: benefitId,
      userId: session.user.id,
      creditCardId: null, // Must be a standalone benefit
    },
  });

  if (!existingBenefit) {
    throw new Error('Custom benefit not found or you do not have permission to edit it.');
  }

  try {
    await prisma.benefit.update({
      where: { id: benefitId },
      data: {
        description,
        category,
        maxAmount: parseFloat(maxAmountStr),
        frequency: frequencyStr as BenefitFrequency,
      },
    });

    console.log(`Updated custom benefit: ${benefitId}`);

    revalidatePath('/benefits');
    revalidatePath('/benefits/custom');

    return { success: true };

  } catch (error) {
    console.error('Error updating custom benefit:', error);
    throw new Error('Failed to update custom benefit.');
  }
}

/**
 * Delete a custom benefit and all its status records
 */
export async function deleteCustomBenefitAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const benefitId = formData.get('benefitId') as string;

  if (!benefitId) {
    throw new Error('Benefit ID is required.');
  }

  // Validate the benefit belongs to the user and is a custom benefit
  const existingBenefit = await prisma.benefit.findFirst({
    where: {
      id: benefitId,
      userId: session.user.id,
      creditCardId: null, // Must be a standalone benefit
    },
  });

  if (!existingBenefit) {
    throw new Error('Custom benefit not found or you do not have permission to delete it.');
  }

  try {
    // Delete the benefit (cascade will delete related BenefitStatus records)
    await prisma.benefit.delete({
      where: { id: benefitId },
    });

    console.log(`Deleted custom benefit: ${benefitId}`);

    revalidatePath('/benefits');
    revalidatePath('/benefits/custom');

    return { success: true };

  } catch (error) {
    console.error('Error deleting custom benefit:', error);
    throw new Error('Failed to delete custom benefit.');
  }
} 