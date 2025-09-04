import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// Import the actual card creation logic
import { createCardForUser } from '@/lib/actions/cardUtils';
import { validateCardDigits } from '@/lib/cardDisplayUtils';
import { revalidatePath } from 'next/cache';

// Define the expected structure of the imported JSON
interface ImportCardEntry {
  predefinedCardName: string;
  predefinedCardIssuer: string;
  openedDate: string | null; // Expecting YYYY-MM-DD format
  lastFourDigits?: string | null; // Optional last 4 digits
}

interface ImportData {
  version: string;
  userCards: ImportCardEntry[];
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
      if (!importData || importData.version !== '1.0.0' || !Array.isArray(importData.userCards)) {
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
        const { predefinedCardName, predefinedCardIssuer, openedDate, lastFourDigits } = cardEntry;

        // Validate date format (YYYY-MM-DD) if provided
        let parsedOpenedDate: Date | null = null;
        if (openedDate) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(openedDate)) {
             throw new Error(`Invalid openedDate format for card \"${predefinedCardName}\": Expected YYYY-MM-DD`);
          }
          // Parse the date string. Ensure it's treated consistently (e.g., as UTC)
          parsedOpenedDate = new Date(openedDate + 'T00:00:00Z');
          if (isNaN(parsedOpenedDate.getTime())) {
            throw new Error(`Invalid date value for card \"${predefinedCardName}\"`);
          }
        }

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
          processedLastFourDigits // Pass the last 4 digits
        );

        if (!addResult.success) {
          // Throw error with message from the helper function
          throw new Error(addResult.message || `Failed to import card \"${predefinedCardName}\"`);
        }
        // --- End Add Card Logic ---

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