'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function updateNotificationSettingsAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  // Extract data - checkboxes send 'on' when checked, null/undefined otherwise
  const notifyNewBenefit = formData.get('notifyNewBenefit') === 'on';
  const notifyBenefitExpiration = formData.get('notifyBenefitExpiration') === 'on';
  const notifyPointsExpiration = formData.get('notifyPointsExpiration') === 'on';
  const notifyExpirationDaysString = formData.get('notifyExpirationDays') as string;
  const pointsExpirationDaysString = formData.get('pointsExpirationDays') as string;

  // Validate days input
  let notifyExpirationDays = parseInt(notifyExpirationDaysString, 10);
  if (isNaN(notifyExpirationDays) || notifyExpirationDays < 1) {
    console.warn('Invalid benefit expiration days provided, defaulting to 7.');
    notifyExpirationDays = 7;
  }

  let pointsExpirationDays = parseInt(pointsExpirationDaysString, 10);
  if (isNaN(pointsExpirationDays) || pointsExpirationDays < 1) {
    console.warn('Invalid points expiration days provided, defaulting to 30.');
    pointsExpirationDays = 30;
  }

  try {
    // Update user settings
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notifyNewBenefit,
        notifyBenefitExpiration,
        notifyExpirationDays,
        notifyPointsExpiration,
        pointsExpirationDays,
      },
    });

    console.log('Notification settings updated for user:', session.user.id);

    // Revalidate the settings page path
    revalidatePath('/settings/notifications');

    // // Remove return value for standard form action
    // return { success: true, message: 'Settings updated successfully!' };

  } catch (error) {
    console.error('Error updating notification settings:', error);
    // Remove return value, re-throw error to be caught by error boundary
    // return { success: false, message: 'Failed to update settings.' };
    throw new Error('Failed to update settings.');
  }
} 