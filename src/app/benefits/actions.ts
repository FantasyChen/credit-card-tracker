'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

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