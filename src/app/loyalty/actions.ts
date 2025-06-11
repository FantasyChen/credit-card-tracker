'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

function calculateExpirationDate(lastActivityDate: Date, expirationMonths: number | null): Date | null {
  if (!expirationMonths) return null;
  
  const expiration = new Date(lastActivityDate);
  expiration.setMonth(expiration.getMonth() + expirationMonths);
  return expiration;
}

export async function addLoyaltyAccountAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const loyaltyProgramId = formData.get('loyaltyProgramId') as string;
  const accountNumber = formData.get('accountNumber') as string;
  const lastActivityDateString = formData.get('lastActivityDate') as string;
  const notes = formData.get('notes') as string;

  if (!loyaltyProgramId || !lastActivityDateString) {
    throw new Error('Missing required fields.');
  }

  const lastActivityDate = new Date(lastActivityDateString);
  
  try {
    // Get the loyalty program to calculate expiration
    const loyaltyProgram = await prisma.loyaltyProgram.findUnique({
      where: { id: loyaltyProgramId },
      select: { expirationMonths: true, hasExpiration: true }
    });

    if (!loyaltyProgram) {
      throw new Error('Loyalty program not found.');
    }

    const expirationDate = loyaltyProgram.hasExpiration 
      ? calculateExpirationDate(lastActivityDate, loyaltyProgram.expirationMonths)
      : null;

    await prisma.loyaltyAccount.create({
      data: {
        userId: session.user.id,
        loyaltyProgramId,
        accountNumber: accountNumber || null,
        lastActivityDate,
        expirationDate,
        notes: notes || null,
        isActive: true,
      },
    });

    revalidatePath('/loyalty');
  } catch (error) {
    console.error('Error adding loyalty account:', error);
    throw new Error('Failed to add loyalty account.');
  }
}

export async function updateLoyaltyAccountAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const accountId = formData.get('accountId') as string;
  const accountNumber = formData.get('accountNumber') as string;
  const lastActivityDateString = formData.get('lastActivityDate') as string;
  const notes = formData.get('notes') as string;

  if (!accountId || !lastActivityDateString) {
    throw new Error('Missing required fields.');
  }

  const lastActivityDate = new Date(lastActivityDateString);

  try {
    // Get the account with its loyalty program to recalculate expiration
    const account = await prisma.loyaltyAccount.findUnique({
      where: { id: accountId },
      include: {
        loyaltyProgram: {
          select: { expirationMonths: true, hasExpiration: true }
        }
      }
    });

    if (!account || account.userId !== session.user.id) {
      throw new Error('Account not found or unauthorized.');
    }

    const expirationDate = account.loyaltyProgram.hasExpiration 
      ? calculateExpirationDate(lastActivityDate, account.loyaltyProgram.expirationMonths)
      : null;

    await prisma.loyaltyAccount.update({
      where: { id: accountId },
      data: {
        accountNumber: accountNumber || null,
        lastActivityDate,
        expirationDate,
        notes: notes || null,
      },
    });

    revalidatePath('/loyalty');
  } catch (error) {
    console.error('Error updating loyalty account:', error);
    throw new Error('Failed to update loyalty account.');
  }
}

export async function deleteLoyaltyAccountAction(accountId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  try {
    // Verify the account belongs to the user before deleting
    const account = await prisma.loyaltyAccount.findUnique({
      where: { id: accountId },
      select: { userId: true }
    });

    if (!account || account.userId !== session.user.id) {
      throw new Error('Account not found or unauthorized.');
    }

    await prisma.loyaltyAccount.delete({
      where: { id: accountId },
    });

    revalidatePath('/loyalty');
  } catch (error) {
    console.error('Error deleting loyalty account:', error);
    throw new Error('Failed to delete loyalty account.');
  }
} 