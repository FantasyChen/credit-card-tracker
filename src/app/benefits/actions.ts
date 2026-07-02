'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { materializeBenefitStatusRows } from '@/lib/benefit-cycle-materialization';
import {
  transitionAddPartialCompletion,
  transitionFullCompletion,
  transitionResetCompletion,
  transitionSetUsedAmount,
  transitionToggleCompletion,
  transitionToggleNotUsable,
} from '@/lib/benefit-status-transitions';
import { z } from 'zod';
import { redirect } from 'next/navigation';

// Validation schema for custom benefit creation
const customBenefitSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  category: z.enum(['Travel', 'Dining', 'Shopping', 'Entertainment', 'Transportation', 'Other']),
  maxAmount: z.number().min(0, 'Value must be 0 or greater'),
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
    // Fetch the status with its benefit to get maxAmount
    const existingStatus = await prisma.benefitStatus.findFirst({
      where: {
        id: benefitStatusId,
        userId: session.user.id,
      },
      include: {
        benefit: true,
      },
    });

    if (!existingStatus) {
      throw new Error('Benefit status not found or permission denied.');
    }

    const transition = transitionToggleCompletion(existingStatus);

    const updatedStatus = await prisma.benefitStatus.updateMany({
      where: {
        id: benefitStatusId,
        userId: session.user.id, // Ensure user owns this status record
      },
      data: {
        isCompleted: transition.isCompleted,
        completedAt: transition.completedAt,
        usedAmount: transition.usedAmount,
      },
    });

    if (updatedStatus.count === 0) {
      // This means either the ID was wrong or the user didn't own it
      throw new Error('Benefit status not found or permission denied.');
    }

    console.log(`Benefit status ${benefitStatusId} toggled to ${newIsCompleted} with usedAmount ${transition.usedAmount}`);

    // Revalidate the benefits page and dashboard to show the change
    revalidatePath('/benefits');
    revalidatePath('/');

  } catch (error) {
    console.error('Error toggling benefit status:', error);
    // Consider returning a more user-friendly error
    throw new Error('Failed to update benefit status.');
  }

  // No redirect needed, revalidation handles the UI update
}

/**
 * Add a partial amount to a benefit's usedAmount.
 * If the total reaches maxAmount, the benefit is automatically marked complete.
 */
export async function addPartialCompletionAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const benefitStatusId = formData.get('benefitStatusId') as string;
  const amountStr = formData.get('amount') as string;

  if (!benefitStatusId) {
    throw new Error('Benefit Status ID is missing.');
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number.');
  }

  try {
    // Fetch the existing status with benefit details
    const existingStatus = await prisma.benefitStatus.findFirst({
      where: {
        id: benefitStatusId,
        userId: session.user.id,
      },
      include: {
        benefit: true,
      },
    });

    if (!existingStatus) {
      throw new Error('Benefit status not found or permission denied.');
    }

    const transition = transitionAddPartialCompletion(existingStatus, amount);

    await prisma.benefitStatus.update({
      where: { id: benefitStatusId },
      data: {
        usedAmount: transition.usedAmount,
        isCompleted: transition.isCompleted,
        completedAt: transition.completedAt,
      },
    });

    console.log(`Added partial completion: ${amount} to benefit ${benefitStatusId}. Total: ${transition.usedAmount}/${existingStatus.benefit.maxAmount ?? 0}. Complete: ${transition.isCompleted}`);

    revalidatePath('/benefits');
    revalidatePath('/');

    return { 
      success: true, 
      newUsedAmount: transition.usedAmount,
      isComplete: transition.isCompleted,
      maxAmount: existingStatus.benefit.maxAmount ?? 0,
    };

  } catch (error) {
    console.error('Error adding partial completion:', error);
    throw new Error('Failed to add partial completion.');
  }
}

/**
 * Mark a benefit as fully complete (sets usedAmount to maxAmount).
 */
export async function markFullCompletionAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const benefitStatusId = formData.get('benefitStatusId') as string;

  if (!benefitStatusId) {
    throw new Error('Benefit Status ID is missing.');
  }

  try {
    // Fetch the status with benefit to get maxAmount
    const existingStatus = await prisma.benefitStatus.findFirst({
      where: {
        id: benefitStatusId,
        userId: session.user.id,
      },
      include: {
        benefit: true,
      },
    });

    if (!existingStatus) {
      throw new Error('Benefit status not found or permission denied.');
    }

    const transition = transitionFullCompletion(existingStatus);

    await prisma.benefitStatus.update({
      where: { id: benefitStatusId },
      data: {
        usedAmount: transition.usedAmount,
        isCompleted: transition.isCompleted,
        completedAt: transition.completedAt,
      },
    });

    console.log(`Marked full completion for benefit ${benefitStatusId}. usedAmount set to ${transition.usedAmount}`);

    revalidatePath('/benefits');
    revalidatePath('/');

    return { success: true, usedAmount: transition.usedAmount };

  } catch (error) {
    console.error('Error marking full completion:', error);
    return {
      success: false,
      error: 'Failed to mark benefit as complete.',
    };
  }
}

/**
 * Reset a benefit's completion status (sets usedAmount to 0, isCompleted to false).
 */
export async function resetBenefitCompletionAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const benefitStatusId = formData.get('benefitStatusId') as string;

  if (!benefitStatusId) {
    throw new Error('Benefit Status ID is missing.');
  }

  try {
    const transition = transitionResetCompletion();
    const updatedStatus = await prisma.benefitStatus.updateMany({
      where: {
        id: benefitStatusId,
        userId: session.user.id,
      },
      data: {
        usedAmount: transition.usedAmount,
        isCompleted: transition.isCompleted,
        completedAt: transition.completedAt,
      },
    });

    if (updatedStatus.count === 0) {
      throw new Error('Benefit status not found or permission denied.');
    }

    console.log(`Reset completion for benefit ${benefitStatusId}`);

    revalidatePath('/benefits');

    return { success: true };

  } catch (error) {
    console.error('Error resetting benefit completion:', error);
    throw new Error('Failed to reset benefit completion.');
  }
}

/**
 * Update the used amount for a benefit directly (can increase or decrease).
 */
export async function updateUsedAmountAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const benefitStatusId = formData.get('benefitStatusId') as string;
  const newAmountStr = formData.get('newAmount') as string;

  if (!benefitStatusId) {
    throw new Error('Benefit Status ID is missing.');
  }

  const newAmount = parseFloat(newAmountStr);
  if (isNaN(newAmount) || newAmount < 0) {
    throw new Error('Amount must be a non-negative number.');
  }

  try {
    // Fetch the status with benefit to get maxAmount
    const existingStatus = await prisma.benefitStatus.findFirst({
      where: {
        id: benefitStatusId,
        userId: session.user.id,
      },
      include: {
        benefit: true,
      },
    });

    if (!existingStatus) {
      throw new Error('Benefit status not found or permission denied.');
    }

    const transition = transitionSetUsedAmount(existingStatus, newAmount);

    await prisma.benefitStatus.update({
      where: { id: benefitStatusId },
      data: {
        usedAmount: transition.usedAmount,
        isCompleted: transition.isCompleted,
        completedAt: transition.completedAt,
      },
    });

    console.log(`Updated used amount for benefit ${benefitStatusId} to ${transition.usedAmount}. Complete: ${transition.isCompleted}`);

    revalidatePath('/benefits');

    return { 
      success: true, 
      usedAmount: transition.usedAmount,
      isComplete: transition.isCompleted,
    };

  } catch (error) {
    console.error('Error updating used amount:', error);
    throw new Error('Failed to update used amount.');
  }
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
    const existingStatus = await prisma.benefitStatus.findFirst({
      where: {
        id: benefitStatusId,
        userId: session.user.id,
      },
      include: {
        benefit: true,
      },
    });

    if (!existingStatus) {
      throw new Error('Benefit status not found or permission denied.');
    }

    const transition = transitionToggleNotUsable(existingStatus);

    const updatedStatus = await prisma.benefitStatus.updateMany({
      where: {
        id: benefitStatusId,
        userId: session.user.id, // Ensure user owns this status record
      },
      data: {
        isNotUsable: transition.isNotUsable,
        isCompleted: transition.isCompleted,
        completedAt: transition.completedAt,
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
    
    // First, fetch all the benefit statuses with their benefits to get maxAmount values
    const statusesToComplete = await prisma.benefitStatus.findMany({
      where: {
        id: { in: benefitStatusIds },
        userId: session.user.id,
        isCompleted: false,
        isNotUsable: false,
        benefit: {
          category: category,
        },
      },
      include: {
        benefit: true,
      },
    });

    // Update each status with its specific maxAmount
    const updatePromises = statusesToComplete.map((status) => {
      const maxAmount = status.benefit.maxAmount ?? 0;
      // Calculate new usedAmount: remaining amount to reach max
      const currentUsed = status.usedAmount ?? 0;
      const newUsedAmount = maxAmount > 0 ? maxAmount : currentUsed;
      
      return prisma.benefitStatus.update({
        where: { id: status.id },
        data: {
          isCompleted: true,
          completedAt: now,
          usedAmount: newUsedAmount,
        },
      });
    });

    await Promise.all(updatePromises);

    console.log(`Batch completed ${statusesToComplete.length} benefits in category: ${category}`);

    // Revalidate the benefits page to show the changes
    revalidatePath('/benefits');

    return { success: true, updatedCount: statusesToComplete.length };

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

    const materialized = materializeBenefitStatusRows(
      {
        id: benefit.id,
        userId,
        frequency: frequency as BenefitFrequency,
        startDate,
        description: desc,
        cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
        occurrencesInCycle: 1,
      },
      {
        referenceDate: startDate,
      }
    );
    const initialStatus = materialized.rows[0];

    // Create the initial benefit status
    await prisma.benefitStatus.create({
      data: {
        benefitId: initialStatus.benefitId,
        userId: initialStatus.userId,
        cycleStartDate: initialStatus.cycleStartDate,
        cycleEndDate: initialStatus.cycleEndDate,
        isCompleted: false,
        usedAmount: 0,
        occurrenceIndex: initialStatus.occurrenceIndex,
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
