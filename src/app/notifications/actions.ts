'use server';

import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function updateNotificationSettingsAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const notifyNewBenefit = formData.get('notifyNewBenefit') === 'on';
  const notifyBenefitExpiration = formData.get('notifyBenefitExpiration') === 'on';
  const notifyExpirationDaysString = formData.get('notifyExpirationDays') as string;

  let notifyExpirationDays = parseInt(notifyExpirationDaysString, 10);
  if (isNaN(notifyExpirationDays) || notifyExpirationDays < 1) {
    console.warn('Invalid expiration days provided, defaulting to 7.');
    notifyExpirationDays = 7;
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notifyNewBenefit,
        notifyBenefitExpiration,
        notifyExpirationDays,
      },
    });

    console.log('Notification settings updated for user:', session.user.id);

  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw new Error('Failed to update settings.');
  }

  redirect('/notifications?status=success');
} 