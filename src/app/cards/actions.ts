'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma';

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

    await prisma.$transaction(async (transaction) => {
      const activeRepairs = await transaction.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM "GlobalBenefitCategoryRepair" repair
          WHERE repair."creditCardId" = ${cardId}
            AND repair."phase" = 'APPLIED'
        ) AS "exists"
      `);
      if (activeRepairs[0]?.exists) {
        throw new Error('Active category-repair evidence blocks card deletion.');
      }

      // Preserve migration audit rows while releasing their optional restrictive
      // physical-card reference. The legacy definition ID remains in the ledger.
      await transaction.$executeRaw(Prisma.sql`
        UPDATE "CatalogMigrationLedger"
        SET "creditCardId" = NULL, "updatedAt" = NOW()
        WHERE "creditCardId" = ${cardId}
          AND "userId" = ${session.user.id}
      `);

      // Global statuses restrict card deletion, so remove only this user's card
      // occurrences first. Custom definitions remain covered by card cascade.
      await transaction.benefitStatus.deleteMany({
        where: {
          userId: session.user.id,
          OR: [
            { creditCardId: cardId },
            { benefit: { creditCardId: cardId } },
          ],
        },
      } as never);
      const deleted = await transaction.creditCard.deleteMany({
        where: { id: cardId, userId: session.user.id },
      });
      if (deleted.count === 0) {
        throw new Error('Card not found or permission denied.');
      }
    });

    revalidatePath('/');
    revalidatePath('/cards');
    revalidatePath('/cards/calendar');
    revalidatePath('/benefits');

    return { success: true };

  } catch (error) {
    console.error("Error deleting card:", error);
    // Check for specific Prisma errors if needed (e.g., foreign key constraints if cascading isn't set up)
    return { success: false, error: 'Failed to delete card.' };
  }
} 