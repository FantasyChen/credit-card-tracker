'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { BenefitFrequency, BenefitCycleAlignment, Prisma } from '@/generated/prisma';
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
import { findEffectiveBenefitStatus } from '@/lib/effective-benefit';
import {
  initialStatusFieldsForTrackingMode,
  isBenefitTrackingMode,
} from '@/lib/benefit-tracking-modes';

interface StatusTransitionRecord {
  id: string;
  userId: string;
  isCompleted: boolean;
  isNotUsable: boolean;
  completedAt: Date | null;
  usedAmount: number | null;
  benefit: { maxAmount: number | null; category: string };
}

async function loadOwnedStatusForTransition(
  userId: string,
  benefitStatusId: string
): Promise<StatusTransitionRecord | null> {
  const status = await findEffectiveBenefitStatus(prisma, userId, benefitStatusId);
  if (!status) return null;

  return {
    id: status.id,
    userId: status.userId,
    isCompleted: status.isCompleted,
    isNotUsable: status.isNotUsable,
    completedAt: status.completedAt,
    usedAmount: status.usedAmount,
    benefit: {
      category: status.benefit.category,
      maxAmount: status.benefit.maxAmount,
    },
  };
}

// Validation schema for custom benefit creation
const benefitCategorySchema = z.enum([
  'Travel',
  'Dining',
  'Shopping',
  'Entertainment',
  'Transportation',
  'Other',
]);
const benefitFrequencySchema = z.nativeEnum(BenefitFrequency);

const customBenefitSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  category: benefitCategorySchema,
  maxAmount: z.number().finite().min(0, 'Value must be 0 or greater'),
  frequency: benefitFrequencySchema,
  startDate: z.date(),
  creditCardId: z.string().cuid().nullable().optional(),
});

const updateCustomBenefitSchema = z.object({
  benefitId: z.string().cuid(),
  description: z.string().min(1).max(200),
  category: benefitCategorySchema,
  maxAmount: z.number().finite().min(0),
  frequency: benefitFrequencySchema,
});

const deleteCustomBenefitSchema = z.object({
  benefitId: z.string().cuid(),
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
    const existingStatus = await loadOwnedStatusForTransition(
      session.user.id,
      benefitStatusId
    );

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
    const existingStatus = await loadOwnedStatusForTransition(
      session.user.id,
      benefitStatusId
    );

    if (!existingStatus) {
      throw new Error('Benefit status not found or permission denied.');
    }

    const transition = transitionAddPartialCompletion(existingStatus, amount);

    const updatedStatus = await prisma.benefitStatus.updateMany({
      where: { id: benefitStatusId, userId: session.user.id },
      data: {
        usedAmount: transition.usedAmount,
        isCompleted: transition.isCompleted,
        completedAt: transition.completedAt,
      },
    });
    if (updatedStatus.count === 0) {
      throw new Error('Benefit status not found or permission denied.');
    }

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
    const existingStatus = await loadOwnedStatusForTransition(
      session.user.id,
      benefitStatusId
    );

    if (!existingStatus) {
      throw new Error('Benefit status not found or permission denied.');
    }

    const transition = transitionFullCompletion(existingStatus);

    const updatedStatus = await prisma.benefitStatus.updateMany({
      where: { id: benefitStatusId, userId: session.user.id },
      data: {
        usedAmount: transition.usedAmount,
        isCompleted: transition.isCompleted,
        completedAt: transition.completedAt,
      },
    });
    if (updatedStatus.count === 0) {
      throw new Error('Benefit status not found or permission denied.');
    }

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
    const existingStatus = await loadOwnedStatusForTransition(
      session.user.id,
      benefitStatusId
    );

    if (!existingStatus) {
      throw new Error('Benefit status not found or permission denied.');
    }

    const transition = transitionSetUsedAmount(existingStatus, newAmount);

    const updatedStatus = await prisma.benefitStatus.updateMany({
      where: { id: benefitStatusId, userId: session.user.id },
      data: {
        usedAmount: transition.usedAmount,
        isCompleted: transition.isCompleted,
        completedAt: transition.completedAt,
      },
    });
    if (updatedStatus.count === 0) {
      throw new Error('Benefit status not found or permission denied.');
    }

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
    const existingStatus = await loadOwnedStatusForTransition(
      session.user.id,
      benefitStatusId
    );

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
    const loadedStatuses = await Promise.all(
      benefitStatusIds.map((id) => loadOwnedStatusForTransition(session.user.id, id))
    );
    const eligibleStatuses = loadedStatuses.filter((status): status is StatusTransitionRecord =>
      status !== null &&
      !status.isCompleted &&
      !status.isNotUsable &&
      status.benefit.category === category
    );
    const updatePromises = eligibleStatuses.map((status) => {
      const maxAmount = status.benefit.maxAmount ?? 0;
      const currentUsed = status.usedAmount ?? 0;
      return prisma.benefitStatus.updateMany({
        where: { id: status.id, userId: session.user.id },
        data: {
          isCompleted: true,
          completedAt: now,
          usedAmount: maxAmount > 0 ? maxAmount : currentUsed,
        },
      });
    });

    const updates = await Promise.all(updatePromises);
    if (updates.some((update) => update.count === 0)) {
      throw new Error('One or more benefit statuses were not found or permission denied.');
    }

    console.log(`Batch completed ${eligibleStatuses.length} benefits in category: ${category}`);

    // Revalidate the benefits page to show the changes
    revalidatePath('/benefits');

    return { success: true, updatedCount: eligibleStatuses.length };

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
  const creditCardIdValue = formData.get('creditCardId');

  // Validate input
  const parseResult = customBenefitSchema.safeParse({
    description,
    category,
    maxAmount: parseFloat(maxAmountStr),
    frequency: frequencyStr,
    startDate: startDateStr ? new Date(startDateStr) : new Date(),
    creditCardId: typeof creditCardIdValue === 'string' && creditCardIdValue
      ? creditCardIdValue
      : null,
  });

  if (!parseResult.success) {
    console.error('Validation error:', parseResult.error);
    throw new Error(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const { description: desc, category: cat, maxAmount, frequency, startDate, creditCardId } = parseResult.data;

  try {
    await prisma.$transaction(async (transaction) => {
      let cardOpenedDate: Date | null = null;
      if (creditCardId) {
        const ownedCard = await transaction.creditCard.findFirst({
          where: { id: creditCardId, userId },
          select: { openedDate: true },
        });
        if (!ownedCard) {
          throw new Error('Credit card not found or permission denied.');
        }
        cardOpenedDate = ownedCard.openedDate;
      }

      // userId marks both standalone and card-linked rows as custom by construction.
      const benefit = await transaction.benefit.create({
        data: {
          description: desc,
          category: cat,
          maxAmount,
          percentage: 0,
          frequency: frequency as BenefitFrequency,
          startDate,
          userId,
          creditCardId: creditCardId ?? null,
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
          cardOpenedDate,
        }
      );

      if (materialized.rows.length > 0) {
        await transaction.benefitStatus.createMany({
          data: materialized.rows.map((row) => ({
            ...row,
            isCompleted: false,
            usedAmount: 0,
          })),
        });
      }
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

  const maxAmountValue = formData.get('maxAmount');
  const parsed = updateCustomBenefitSchema.safeParse({
    benefitId: formData.get('benefitId'),
    description: formData.get('description'),
    category: formData.get('category'),
    maxAmount:
      typeof maxAmountValue === 'string' && maxAmountValue.trim() !== ''
        ? Number(maxAmountValue)
        : Number.NaN,
    frequency: formData.get('frequency'),
  });
  if (!parsed.success) {
    throw new Error('Invalid custom benefit input.');
  }
  const { benefitId, description, category, maxAmount, frequency } = parsed.data;

  try {
    // Keep the capability check in the write predicate. A user-owned legacy row
    // classified or bridged as standard is never mutable through this endpoint.
    const updatedCount = await prisma.$executeRaw(Prisma.sql`
      UPDATE "Benefit" AS b
      SET
        "description" = ${description},
        "category" = ${category},
        "maxAmount" = ${maxAmount},
        "frequency" = ${frequency}::"BenefitFrequency",
        "updatedAt" = NOW()
      WHERE b."id" = ${benefitId}
        AND (
          b."userId" = ${session.user.id}
          OR (
            b."userId" IS NULL
            AND EXISTS (
              SELECT 1 FROM "CreditCard" owner_card
              WHERE owner_card."id" = b."creditCardId"
                AND owner_card."userId" = ${session.user.id}
            )
            AND EXISTS (
              SELECT 1 FROM "CatalogMigrationLedger" custom_ledger
              WHERE custom_ledger."legacyBenefitId" = b."id"
                AND custom_ledger."userId" = ${session.user.id}
                AND custom_ledger."classification" = 'CUSTOM'
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "BenefitStatus" bs
          WHERE bs."benefitId" = b."id"
            AND bs."predefinedBenefitId" IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "CatalogMigrationLedger" ledger
          WHERE ledger."legacyBenefitId" = b."id"
            AND ledger."classification" = 'STANDARD'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "GlobalBenefitCategoryRepair" repair
          WHERE repair."legacyBenefitId" = b."id"
            AND repair."phase" = 'APPLIED'
        )
    `);
    if (updatedCount === 0) {
      throw new Error('Custom benefit not found or permission denied.');
    }

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

  const parsed = deleteCustomBenefitSchema.safeParse({
    benefitId: formData.get('benefitId'),
  });
  if (!parsed.success) {
    throw new Error('Invalid custom benefit ID.');
  }
  const { benefitId } = parsed.data;

  try {
    // Delete only a definition that remains custom at the instant of the write.
    // Custom statuses retain their existing ON DELETE CASCADE behavior.
    const deletedCount = await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "Benefit" AS b
      WHERE b."id" = ${benefitId}
        AND (
          b."userId" = ${session.user.id}
          OR (
            b."userId" IS NULL
            AND EXISTS (
              SELECT 1 FROM "CreditCard" owner_card
              WHERE owner_card."id" = b."creditCardId"
                AND owner_card."userId" = ${session.user.id}
            )
            AND EXISTS (
              SELECT 1 FROM "CatalogMigrationLedger" custom_ledger
              WHERE custom_ledger."legacyBenefitId" = b."id"
                AND custom_ledger."userId" = ${session.user.id}
                AND custom_ledger."classification" = 'CUSTOM'
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "BenefitStatus" bs
          WHERE bs."benefitId" = b."id"
            AND bs."predefinedBenefitId" IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "CatalogMigrationLedger" ledger
          WHERE ledger."legacyBenefitId" = b."id"
            AND ledger."classification" = 'STANDARD'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "GlobalBenefitCategoryRepair" repair
          WHERE repair."legacyBenefitId" = b."id"
            AND repair."phase" = 'APPLIED'
        )
    `);
    if (deletedCount === 0) {
      throw new Error('Custom benefit not found or permission denied.');
    }

    console.log(`Deleted custom benefit: ${benefitId}`);

    revalidatePath('/benefits');
    revalidatePath('/benefits/custom');

    return { success: true };

  } catch (error) {
    console.error('Error deleting custom benefit:', error);
    throw new Error('Failed to delete custom benefit.');
  }
} 

/**
 * Sets the cycle-independent tracking mode for the benefit behind one status
 * row, then brings the currently open cycle in line with the new choice.
 *
 * Writing the preference alone would only take effect from the next cycle, so
 * AUTO_CLAIM also claims the open cycle immediately and returning to TRACK
 * reopens a cycle that this feature had auto-claimed.
 */
export async function setBenefitTrackingModeAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }
  const userId = session.user.id;

  const benefitStatusId = formData.get('benefitStatusId') as string;
  const requestedMode = formData.get('trackingMode');
  if (!benefitStatusId) {
    throw new Error('Benefit Status ID is missing.');
  }
  if (!isBenefitTrackingMode(requestedMode)) {
    throw new Error('Unknown benefit tracking mode.');
  }

  // Ownership is enforced by loading the status through the effective-benefit
  // reader before anything is written.
  const status = await findEffectiveBenefitStatus(prisma, userId, benefitStatusId);
  if (!status) {
    throw new Error('Benefit status not found or permission denied.');
  }

  const target = status.predefinedBenefitId
    ? {
        creditCardId: status.creditCardId,
        predefinedBenefitId: status.predefinedBenefitId,
        benefitId: null,
      }
    : { creditCardId: null, predefinedBenefitId: null, benefitId: status.benefitId };

  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.benefitTrackingPreference.findFirst({
        where: { userId, ...target },
        select: { id: true, mode: true },
      });
      const previousMode = existing?.mode ?? 'TRACK';

      if (existing) {
        await transaction.benefitTrackingPreference.update({
          where: { id: existing.id },
          data: { mode: requestedMode },
        });
      } else if (requestedMode !== 'TRACK') {
        await transaction.benefitTrackingPreference.create({
          data: { userId, ...target, mode: requestedMode },
        });
      }

      if (requestedMode === 'AUTO_CLAIM' && !status.isCompleted) {
        await transaction.benefitStatus.updateMany({
          where: { id: benefitStatusId, userId },
          data: initialStatusFieldsForTrackingMode(
            'AUTO_CLAIM',
            status.benefit.maxAmount,
            new Date()
          ),
        });
      }

      // Leaving AUTO_CLAIM reopens a cycle this feature had claimed on the
      // user's behalf. A cycle claimed while the benefit was tracked normally
      // was claimed by the user, so it is left alone.
      if (previousMode === 'AUTO_CLAIM' && requestedMode !== 'AUTO_CLAIM' && status.isCompleted) {
        await transaction.benefitStatus.updateMany({
          where: { id: benefitStatusId, userId },
          data: { isCompleted: false, completedAt: null, usedAmount: 0 },
        });
      }
    });

    revalidatePath('/benefits');
    revalidatePath('/');

    return { success: true, mode: requestedMode };
  } catch (error) {
    console.error('Error setting benefit tracking mode:', error);
    throw new Error('Failed to update benefit tracking mode.');
  }
}

/**
 * Clears one tracking preference from the settings screen, returning the
 * benefit to the normal per-cycle workflow.
 *
 * This is the only way back for an IGNORE'd benefit, which by definition no
 * longer appears on the dashboard. A cycle that was auto-claimed on the user's
 * behalf is reopened so the benefit does not sit there falsely marked claimed.
 */
export async function resetBenefitTrackingPreferenceAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('User not authenticated.');
  }
  const userId = session.user.id;

  const preferenceId = formData.get('preferenceId') as string;
  if (!preferenceId) {
    throw new Error('Preference ID is missing.');
  }

  try {
    await prisma.$transaction(async (transaction) => {
      // Scoping the read to the session user is what enforces ownership.
      const preference = await transaction.benefitTrackingPreference.findFirst({
        where: { id: preferenceId, userId },
        select: {
          id: true,
          mode: true,
          creditCardId: true,
          predefinedBenefitId: true,
          benefitId: true,
        },
      });
      if (!preference) {
        throw new Error('Tracking preference not found or permission denied.');
      }

      if (preference.mode === 'AUTO_CLAIM') {
        const now = new Date();
        await transaction.benefitStatus.updateMany({
          where: {
            userId,
            isCompleted: true,
            cycleStartDate: { lte: now },
            cycleEndDate: { gte: now },
            ...(preference.predefinedBenefitId
              ? {
                  creditCardId: preference.creditCardId,
                  predefinedBenefitId: preference.predefinedBenefitId,
                }
              : { benefitId: preference.benefitId }),
          },
          data: { isCompleted: false, completedAt: null, usedAmount: 0 },
        });
      }

      await transaction.benefitTrackingPreference.delete({ where: { id: preference.id } });
    });

    revalidatePath('/benefits');
    revalidatePath('/settings/benefit-tracking');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Error resetting benefit tracking preference:', error);
    throw new Error('Failed to reset benefit tracking preference.');
  }
}
