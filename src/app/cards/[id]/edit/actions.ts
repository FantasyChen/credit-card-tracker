'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define schema for input validation
const updateCardSchema = z.object({
  cardId: z.string().cuid(),
  lastFourDigits: z.string().optional(),
  openedMonth: z.string().optional(),
  openedYear: z.string().optional(),
});

export async function updateCardAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required.' };
  }

  const parseResult = updateCardSchema.safeParse({
    cardId: formData.get('cardId'),
    lastFourDigits: formData.get('lastFourDigits') || undefined,
    openedMonth: formData.get('openedMonth') || undefined,
    openedYear: formData.get('openedYear') || undefined,
  });

  if (!parseResult.success) {
    console.error("Invalid input for updateCardAction:", parseResult.error);
    return { success: false, error: 'Invalid input data.' };
  }

  const { cardId, lastFourDigits, openedMonth, openedYear } = parseResult.data;

  try {
    // Verify the card belongs to the current user
    const existingCard = await prisma.creditCard.findUnique({
      where: {
        id: cardId,
        userId: session.user.id, // Ensure user owns the card
      },
    });

    if (!existingCard) {
      return { success: false, error: 'Card not found or you do not have permission to edit it.' };
    }

    // Validate last 4 digits if provided
    let processedLastFourDigits: string | null = null;
    if (lastFourDigits && lastFourDigits.trim()) {
      const trimmed = lastFourDigits.trim();
      if (trimmed.length !== 4 || !/^\d{4}$/.test(trimmed)) {
        return { success: false, error: 'Last 4 digits must be exactly 4 numeric digits.' };
      }
      processedLastFourDigits = trimmed;
    }

    // Process opened date
    let processedOpenedDate: Date | null = existingCard.openedDate;
    if (openedMonth && openedYear) {
      const month = parseInt(openedMonth, 10);
      const year = parseInt(openedYear, 10);
      if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(year)) {
        processedOpenedDate = new Date(Date.UTC(year, month - 1, 1));
      } else {
        return { success: false, error: 'Invalid month or year provided.' };
      }
    } else if (openedMonth || openedYear) {
      return { success: false, error: 'Please provide both month and year or leave both blank.' };
    } else if (!openedMonth && !openedYear) {
      // If both are empty, clear the opened date
      processedOpenedDate = null;
    }

    // Update the card
    await prisma.creditCard.update({
      where: { id: cardId },
      data: {
        lastFourDigits: processedLastFourDigits,
        openedDate: processedOpenedDate,
      },
    });

    // Revalidate relevant paths
    revalidatePath('/cards');
    revalidatePath('/');
    revalidatePath('/benefits');

    return { success: true };

  } catch (error) {
    console.error("Error updating card:", error);
    return { success: false, error: 'Failed to update card.' };
  }
} 