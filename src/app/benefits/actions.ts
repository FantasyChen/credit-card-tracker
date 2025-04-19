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