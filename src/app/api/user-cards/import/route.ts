import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// Import the actual card creation logic
import { createCardForUser } from '@/lib/actions/cardUtils';
import { validateCardDigits } from '@/lib/cardDisplayUtils';
import { parseIsoDateOnly } from '@/lib/card-lifecycle';
import { revalidatePath } from 'next/cache';

// Define the expected structure of the imported JSON
interface ImportCardEntry {
  predefinedCardName: string;
  predefinedCardIssuer: string;
  openedDate: string | null; // Expecting YYYY-MM-DD format
  lastFourDigits?: string | null; // Optional last 4 digits
  nickname?: string | null;
  lifecycleStatus?: 'ACTIVE' | 'CLOSED' | 'PRODUCT_CHANGED';
  closedDate?: string | null;
  annualFeeAmount?: number | null;
  annualFeeDueDate?: string | null;
  signupBonusDeadline?: string | null;
  spendDeadline?: string | null;
  productChangedFrom?: string | null;
  productChangedTo?: string | null;
  lifecycleNotes?: string | null;
  events?: Array<{
    eventType: 'OPENED' | 'ANNUAL_FEE' | 'RETENTION' | 'PRODUCT_CHANGE' | 'CLOSED' | 'SIGNUP_BONUS' | 'SPEND_DEADLINE' | 'NOTE';
    eventDate: string;
    description: string;
    metadata?: unknown;
  }>;
}

interface ImportData {
  version: string;
  userCards: ImportCardEntry[];
}

const allowedLifecycleStatuses = new Set(['ACTIVE', 'CLOSED', 'PRODUCT_CHANGED']);
const allowedCardEventTypes = new Set(['OPENED', 'ANNUAL_FEE', 'RETENTION', 'PRODUCT_CHANGE', 'CLOSED', 'SIGNUP_BONUS', 'SPEND_DEADLINE', 'NOTE']);

function parseImportDate(dateValue: string | null | undefined, fieldName: string, cardName: string): Date | null {
  if (!dateValue) return null;
  const parsedDate = parseIsoDateOnly(dateValue);
  if (!parsedDate) {
    throw new Error(`Invalid ${fieldName} for card "${cardName}": Expected a real YYYY-MM-DD date`);
  }

  return parsedDate;
}

function parseLifecycleStatus(status: unknown, cardName: string): ImportCardEntry['lifecycleStatus'] {
  if (status == null || status === '') return 'ACTIVE';
  if (typeof status !== 'string' || !allowedLifecycleStatuses.has(status)) {
    throw new Error(`Invalid lifecycleStatus for card "${cardName}"`);
  }

  return status as ImportCardEntry['lifecycleStatus'];
}

function parseAnnualFeeAmount(value: unknown, cardName: string): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid annualFeeAmount for card "${cardName}": Expected a non-negative number`);
  }

  return value;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    if (file.type !== 'application/json') {
      return NextResponse.json({ message: 'Invalid file type. Please upload a JSON file.' }, { status: 400 });
    }

    const text = await file.text();
    let importData: ImportData;

    try {
      importData = JSON.parse(text);
      // Basic validation
      if (!importData || !['1.0.0', '1.1.0'].includes(importData.version) || !Array.isArray(importData.userCards)) {
        throw new Error('Invalid JSON structure or version');
      }
    } catch (parseError) {
      console.error('Import parse error:', parseError);
      return NextResponse.json({ message: 'Invalid JSON file format' }, { status: 400 });
    }

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const cardEntry of importData.userCards) {
      try {
        const { predefinedCardName, predefinedCardIssuer, openedDate, lastFourDigits, nickname } = cardEntry;

        // Validate date format (YYYY-MM-DD) if provided
        const parsedOpenedDate = parseImportDate(openedDate, 'openedDate', predefinedCardName);

        // Find the corresponding PredefinedCard
        const predefinedCard = await prisma.predefinedCard.findUnique({
          where: { name: predefinedCardName }, // Assuming name is unique identifier
        });

        if (!predefinedCard) {
          // Add issuer info to error for clarity
          throw new Error(`Predefined card "${predefinedCardName}" (Issuer: ${predefinedCardIssuer}) not found in database.`);
        }

        // Check if user already has this card (matching name, issuer, and openedDate)
        const existingCard = await prisma.creditCard.findFirst({
          where: {
            userId: userId,
            name: predefinedCard.name, // Name copied from predefined card
            issuer: predefinedCard.issuer, // Issuer copied from predefined card
            openedDate: parsedOpenedDate, // Compare dates (handles null comparison correctly)
            nickname: nickname?.trim() || null,
          },
        });

        if (existingCard) {
          skippedCount++;
          continue; // Skip if already exists
        }

        // Validate last digits if provided (dynamic for AMEX vs other cards)
        let processedLastFourDigits: string | null = null;
        if (lastFourDigits && lastFourDigits.trim()) {
          const validation = validateCardDigits(lastFourDigits, predefinedCard.issuer);
          if (!validation.valid) {
            throw new Error(`Invalid last digits for card "${predefinedCardName}": ${validation.error}`);
          }
          processedLastFourDigits = lastFourDigits.trim();
        }

        // --- Use the actual Add Card Logic ---
        console.log(`Attempting to import card: ${predefinedCard.name} for user ${userId}`);
        const addResult = await createCardForUser(
          userId,
          predefinedCard.id,
          parsedOpenedDate, // Pass the parsed Date object or null
          processedLastFourDigits, // Pass the last digits
          nickname?.trim() || null
        );

        if (!addResult.success) {
          // Throw error with message from the helper function
          throw new Error(addResult.message || `Failed to import card \"${predefinedCardName}\"`);
        }
        // --- End Add Card Logic ---

        if (addResult.cardId && importData.version === '1.1.0') {
          const processedLifecycleStatus = parseLifecycleStatus(cardEntry.lifecycleStatus, predefinedCardName);
          const parsedClosedDate = parseImportDate(cardEntry.closedDate, 'closedDate', predefinedCardName);
          const parsedAnnualFeeDueDate = parseImportDate(cardEntry.annualFeeDueDate, 'annualFeeDueDate', predefinedCardName);
          const parsedSignupBonusDeadline = parseImportDate(cardEntry.signupBonusDeadline, 'signupBonusDeadline', predefinedCardName);
          const parsedSpendDeadline = parseImportDate(cardEntry.spendDeadline, 'spendDeadline', predefinedCardName);
          const processedAnnualFeeAmount = parseAnnualFeeAmount(cardEntry.annualFeeAmount, predefinedCardName);
          const importedEvents = cardEntry.events ?? [];

          if (processedLifecycleStatus === 'CLOSED' && !parsedClosedDate) {
            throw new Error(`Closed card "${predefinedCardName}" requires closedDate`);
          }

          if (!Array.isArray(importedEvents)) {
            throw new Error(`Invalid events for card "${predefinedCardName}": Expected an array`);
          }

          await prisma.creditCard.update({
            where: { id: addResult.cardId },
            data: {
              lifecycleStatus: processedLifecycleStatus,
              closedDate: processedLifecycleStatus === 'CLOSED' ? parsedClosedDate : null,
              annualFeeAmount: processedAnnualFeeAmount,
              annualFeeDueDate: parsedAnnualFeeDueDate,
              signupBonusDeadline: parsedSignupBonusDeadline,
              spendDeadline: parsedSpendDeadline,
              productChangedFrom: cardEntry.productChangedFrom?.trim() || null,
              productChangedTo: cardEntry.productChangedTo?.trim() || null,
              lifecycleNotes: cardEntry.lifecycleNotes?.trim() || null,
            },
          });

          for (const event of importedEvents) {
            if (!allowedCardEventTypes.has(event.eventType)) {
              throw new Error(`Invalid eventType for card "${predefinedCardName}"`);
            }
            if (event.eventType === 'OPENED') continue;
            const eventDate = parseImportDate(event.eventDate, 'eventDate', predefinedCardName);
            if (!eventDate || !event.description?.trim()) continue;

            await prisma.creditCardEvent.create({
              data: {
                creditCardId: addResult.cardId,
                userId,
                eventType: event.eventType,
                eventDate,
                description: event.description.trim(),
                metadata: event.metadata == null ? undefined : event.metadata,
              },
            });
          }
        }

        importedCount++;
      } catch (cardError: unknown) {
        console.error('Error processing card entry:', cardEntry, cardError);
        errorCount++;
        // Type check for error message access
        const message = cardError instanceof Error ? cardError.message : `Unknown error processing card: ${cardEntry.predefinedCardName}`;
        errors.push(message);
      }
    }

    // Revalidate paths if any cards were successfully imported
    if (importedCount > 0) {
        console.log('Import successful, revalidating paths...')
        revalidatePath('/');
        revalidatePath('/cards');
        revalidatePath('/cards/calendar');
        revalidatePath('/benefits');
    }

    return NextResponse.json({
      message: `Import finished. Imported: ${importedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`,
      errors: errors,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('Import endpoint error:', error);
    // Type check for error message access
    const message = error instanceof Error ? error.message : 'Error importing data';
    return NextResponse.json({ message }, { status: 500 });
  }
}
