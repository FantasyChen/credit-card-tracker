'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { LoyaltyProgramType } from '@/generated/prisma';

function calculateExpirationDate(lastActivityDate: Date, expirationMonths: number | null): Date | null {
  if (!expirationMonths) return null;
  
  const expiration = new Date(lastActivityDate);
  expiration.setMonth(expiration.getMonth() + expirationMonths);
  return expiration;
}

type ParsedCertificate = {
  label: string | null;
  quantity: number;
  expirationDate: Date;
  notes: string | null;
};

function parseOptionalNonNegativeInteger(value: FormDataEntryValue | null, fieldName: string): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${fieldName} must be a non-negative whole number.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative whole number.`);
  }

  return parsed;
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  const normalized = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${fieldName} must be a positive whole number.`);
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldName} must be a positive whole number.`);
  }

  return parsed;
}

function parseDateOnly(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return parsed;
}

function parseCertificates(formData: FormData): ParsedCertificate[] {
  const raw = formData.get('certificates');
  if (typeof raw !== 'string' || raw.trim() === '') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Free night certificates must be valid JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Free night certificates must be a list.');
  }

  return parsed
    .filter((certificate) => certificate && typeof certificate === 'object')
    .map((certificate, index) => {
      const entry = certificate as Record<string, unknown>;
      const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : null;
      const notes = typeof entry.notes === 'string' && entry.notes.trim() ? entry.notes.trim() : null;
      const quantity = parsePositiveInteger(entry.quantity ?? '1', `Certificate ${index + 1} quantity`);
      const expirationDate = parseDateOnly(entry.expirationDate, `Certificate ${index + 1} expiration date`);

      return { label, quantity, expirationDate, notes };
    });
}

export async function addLoyaltyAccountAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }

  const loyaltyProgramId = formData.get('loyaltyProgramId') as string;
  const accountNumber = formData.get('accountNumber') as string;
  const pointsBalance = parseOptionalNonNegativeInteger(formData.get('pointsBalance'), 'Points/miles balance');
  const lastActivityDateString = formData.get('lastActivityDate') as string;
  const notes = formData.get('notes') as string;
  const certificates = parseCertificates(formData);

  if (!loyaltyProgramId || !lastActivityDateString) {
    throw new Error('Missing required fields.');
  }

  const lastActivityDate = parseDateOnly(lastActivityDateString, 'Last activity date');
  
  try {
    // Get the loyalty program to calculate expiration
    const loyaltyProgram = await prisma.loyaltyProgram.findUnique({
      where: { id: loyaltyProgramId },
      select: { expirationMonths: true, hasExpiration: true, type: true }
    });

    if (!loyaltyProgram) {
      throw new Error('Loyalty program not found.');
    }

    const expirationDate = loyaltyProgram.hasExpiration 
      ? calculateExpirationDate(lastActivityDate, loyaltyProgram.expirationMonths)
      : null;

    await prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.create({
        data: {
          userId: session.user.id,
          loyaltyProgramId,
          accountNumber: accountNumber || null,
          pointsBalance,
          lastActivityDate,
          expirationDate,
          notes: notes || null,
          isActive: true,
        },
      });

      if (loyaltyProgram.type === LoyaltyProgramType.HOTEL && certificates.length > 0) {
        await tx.loyaltyCertificate.createMany({
          data: certificates.map((certificate) => ({
            userId: session.user.id,
            loyaltyAccountId: account.id,
            ...certificate,
          })),
        });
      }
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
  const pointsBalance = parseOptionalNonNegativeInteger(formData.get('pointsBalance'), 'Points/miles balance');
  const lastActivityDateString = formData.get('lastActivityDate') as string;
  const notes = formData.get('notes') as string;
  const certificates = parseCertificates(formData);

  if (!accountId || !lastActivityDateString) {
    throw new Error('Missing required fields.');
  }

  const lastActivityDate = parseDateOnly(lastActivityDateString, 'Last activity date');

  try {
    // Get the account with its loyalty program to recalculate expiration
    const account = await prisma.loyaltyAccount.findUnique({
      where: { id: accountId },
      include: {
        loyaltyProgram: {
          select: { expirationMonths: true, hasExpiration: true, type: true }
        }
      }
    });

    if (!account || account.userId !== session.user.id) {
      throw new Error('Account not found or unauthorized.');
    }

    const expirationDate = account.loyaltyProgram.hasExpiration 
      ? calculateExpirationDate(lastActivityDate, account.loyaltyProgram.expirationMonths)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.loyaltyAccount.update({
        where: { id: accountId },
        data: {
          accountNumber: accountNumber || null,
          pointsBalance,
          lastActivityDate,
          expirationDate,
          notes: notes || null,
        },
      });

      await tx.loyaltyCertificate.deleteMany({
        where: {
          loyaltyAccountId: accountId,
          userId: session.user.id,
        },
      });

      if (account.loyaltyProgram.type === LoyaltyProgramType.HOTEL && certificates.length > 0) {
        await tx.loyaltyCertificate.createMany({
          data: certificates.map((certificate) => ({
            userId: session.user.id,
            loyaltyAccountId: accountId,
            ...certificate,
          })),
        });
      }
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
