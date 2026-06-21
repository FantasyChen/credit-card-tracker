'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { validateCardDigits } from '@/lib/cardDisplayUtils';
import { parseDateInput } from '@/lib/card-lifecycle';

// Define schema for input validation
const updateCardSchema = z.object({
  cardId: z.string().cuid(),
  nickname: z.string().optional(),
  lastFourDigits: z.string().optional(),
  openedMonth: z.string().optional(),
  openedYear: z.string().optional(),
  lifecycleStatus: z.enum(['ACTIVE', 'CLOSED', 'PRODUCT_CHANGED']).optional(),
  closedDate: z.string().optional(),
  annualFeeAmount: z.string().optional(),
  annualFeeDueDate: z.string().optional(),
  signupBonusDeadline: z.string().optional(),
  spendDeadline: z.string().optional(),
  productChangedFrom: z.string().optional(),
  productChangedTo: z.string().optional(),
  lifecycleNotes: z.string().optional(),
  eventType: z.enum(['ANNUAL_FEE', 'RETENTION', 'PRODUCT_CHANGE', 'CLOSED', 'SIGNUP_BONUS', 'SPEND_DEADLINE', 'NOTE']).optional(),
  eventDate: z.string().optional(),
  eventDescription: z.string().optional(),
});

function parseOptionalDateField(formData: FormData, fieldName: string, label: string) {
  const rawValue = formData.get(fieldName);
  const parsedDate = parseDateInput(rawValue);
  if (typeof rawValue === 'string' && rawValue.trim() && !parsedDate) {
    return { error: `${label} must use YYYY-MM-DD format.` };
  }

  return { date: parsedDate };
}

export async function updateCardAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required.' };
  }

  const parseResult = updateCardSchema.safeParse({
    cardId: formData.get('cardId'),
    nickname: formData.get('nickname') || undefined,
    lastFourDigits: formData.get('lastFourDigits') || undefined,
    openedMonth: formData.get('openedMonth') || undefined,
    openedYear: formData.get('openedYear') || undefined,
    lifecycleStatus: formData.get('lifecycleStatus') || undefined,
    closedDate: formData.get('closedDate') || undefined,
    annualFeeAmount: formData.get('annualFeeAmount') || undefined,
    annualFeeDueDate: formData.get('annualFeeDueDate') || undefined,
    signupBonusDeadline: formData.get('signupBonusDeadline') || undefined,
    spendDeadline: formData.get('spendDeadline') || undefined,
    productChangedFrom: formData.get('productChangedFrom') || undefined,
    productChangedTo: formData.get('productChangedTo') || undefined,
    lifecycleNotes: formData.get('lifecycleNotes') || undefined,
    eventType: formData.get('eventType') || undefined,
    eventDate: formData.get('eventDate') || undefined,
    eventDescription: formData.get('eventDescription') || undefined,
  });

  if (!parseResult.success) {
    console.error("Invalid input for updateCardAction:", parseResult.error);
    return { success: false, error: 'Invalid input data.' };
  }

  const {
    cardId,
    nickname,
    lastFourDigits,
    openedMonth,
    openedYear,
    lifecycleStatus,
    annualFeeAmount,
    productChangedFrom,
    productChangedTo,
    lifecycleNotes,
    eventType,
    eventDescription,
  } = parseResult.data;
  const processedLifecycleStatus = lifecycleStatus || 'ACTIVE';

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

    // Process nickname
    let processedNickname: string | null = null;
    if (nickname && nickname.trim()) {
      processedNickname = nickname.trim();
    }

    // Validate last digits if provided (dynamic for AMEX vs other cards)
    let processedLastFourDigits: string | null = null;
    if (lastFourDigits && lastFourDigits.trim()) {
      const validation = validateCardDigits(lastFourDigits, existingCard.issuer);
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Invalid card digits.' };
      }
      processedLastFourDigits = lastFourDigits.trim();
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

    const processedAnnualFeeAmount = annualFeeAmount && annualFeeAmount.trim()
      ? Number(annualFeeAmount)
      : null;
    if (processedAnnualFeeAmount !== null && (Number.isNaN(processedAnnualFeeAmount) || processedAnnualFeeAmount < 0)) {
      return { success: false, error: 'Annual fee must be a positive number or blank.' };
    }

    const closedDateResult = parseOptionalDateField(formData, 'closedDate', 'Closed date');
    if ('error' in closedDateResult) return { success: false, error: closedDateResult.error };
    const annualFeeDueDateResult = parseOptionalDateField(formData, 'annualFeeDueDate', 'Annual fee date');
    if ('error' in annualFeeDueDateResult) return { success: false, error: annualFeeDueDateResult.error };
    const signupBonusDeadlineResult = parseOptionalDateField(formData, 'signupBonusDeadline', 'Sign-up bonus deadline');
    if ('error' in signupBonusDeadlineResult) return { success: false, error: signupBonusDeadlineResult.error };
    const spendDeadlineResult = parseOptionalDateField(formData, 'spendDeadline', 'Spend deadline');
    if ('error' in spendDeadlineResult) return { success: false, error: spendDeadlineResult.error };
    const eventDateResult = parseOptionalDateField(formData, 'eventDate', 'Timeline entry date');
    if ('error' in eventDateResult) return { success: false, error: eventDateResult.error };

    const processedClosedDate = processedLifecycleStatus === 'CLOSED' ? closedDateResult.date : null;
    const processedAnnualFeeDueDate = annualFeeDueDateResult.date;
    const processedSignupBonusDeadline = signupBonusDeadlineResult.date;
    const processedSpendDeadline = spendDeadlineResult.date;
    const processedEventDate = eventDateResult.date;
    const processedEventDescription = eventDescription?.trim() || '';

    if (processedLifecycleStatus === 'CLOSED' && !processedClosedDate) {
      return { success: false, error: 'Closed cards need a close date.' };
    }

    if (processedEventDescription && (!eventType || !processedEventDate)) {
      return { success: false, error: 'Timeline entries need a type, date, and description.' };
    }

    const eventCreates = [];
    if (existingCard.lifecycleStatus !== processedLifecycleStatus && processedLifecycleStatus === 'CLOSED' && processedClosedDate) {
      eventCreates.push({
        creditCardId: cardId,
        userId: session.user.id,
        eventType: 'CLOSED' as const,
        eventDate: processedClosedDate,
        description: `Closed ${existingCard.name}`,
      });
    }

    if (existingCard.lifecycleStatus !== processedLifecycleStatus && processedLifecycleStatus === 'PRODUCT_CHANGED') {
      eventCreates.push({
        creditCardId: cardId,
        userId: session.user.id,
        eventType: 'PRODUCT_CHANGE' as const,
        eventDate: new Date(),
        description: `Product changed ${existingCard.name}`,
      });
    }

    if (processedEventDescription && eventType && processedEventDate) {
      eventCreates.push({
        creditCardId: cardId,
        userId: session.user.id,
        eventType,
        eventDate: processedEventDate,
        description: processedEventDescription,
      });
    }

    await prisma.$transaction([
      prisma.creditCard.update({
        where: { id: cardId },
        data: {
          nickname: processedNickname,
          lastFourDigits: processedLastFourDigits,
          openedDate: processedOpenedDate,
          lifecycleStatus: processedLifecycleStatus,
          closedDate: processedClosedDate,
          annualFeeAmount: processedAnnualFeeAmount,
          annualFeeDueDate: processedAnnualFeeDueDate,
          signupBonusDeadline: processedSignupBonusDeadline,
          spendDeadline: processedSpendDeadline,
          productChangedFrom: productChangedFrom?.trim() || null,
          productChangedTo: productChangedTo?.trim() || null,
          lifecycleNotes: lifecycleNotes?.trim() || null,
        },
      }),
      ...eventCreates.map((data) => prisma.creditCardEvent.create({ data })),
    ]);

    // Revalidate relevant paths
    revalidatePath('/cards');
    revalidatePath('/cards/calendar');
    revalidatePath('/');
    revalidatePath('/benefits');

    return { success: true };

  } catch (error) {
    console.error("Error updating card:", error);
    return { success: false, error: 'Failed to update card.' };
  }
}
