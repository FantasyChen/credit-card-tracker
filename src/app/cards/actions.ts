'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define schema for input validation
const deleteCardSchema = z.object({
  cardId: z.string().cuid(), // Ensure it's a valid CUID
});

export async function deleteCardAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required.' };
  }

  const parseResult = deleteCardSchema.safeParse({
    cardId: formData.get('cardId'),
  });

  if (!parseResult.success) {
    console.error("Invalid input for deleteCardAction:", parseResult.error);
    return { success: false, error: 'Invalid card ID.' };
  }

  const { cardId } = parseResult.data;

  try {
    // Verify the card belongs to the current user before deleting
    const card = await prisma.creditCard.findUnique({
      where: {
        id: cardId,
        userId: session.user.id, // Ensure user owns the card
      },
    });

    if (!card) {
      return { success: false, error: 'Card not found or you do not have permission to delete it.' };
    }

    // Proceed with deletion (Prisma will handle cascading deletes based on schema)
    await prisma.creditCard.delete({
      where: { id: cardId },
    });

    // Revalidate the path to refresh the card list
    revalidatePath('/cards');

    return { success: true };

  } catch (error) {
    console.error("Error deleting card:", error);
    // Check for specific Prisma errors if needed (e.g., foreign key constraints if cascading isn't set up)
    return { success: false, error: 'Failed to delete card.' };
  }
} 