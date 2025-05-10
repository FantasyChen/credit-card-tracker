# CouponCycle - Action Plan

This document outlines the key next steps and implementation priorities for the CouponCycle application. For a broader overview of the project design and current state, please see `DESIGN.md`.

## 1. Planned Features & Next Steps

### 1.1. Core User Flow (Updated Priorities)

1.  **Verify Production Setup (Vercel):**
    *   Ensure Google OAuth is fully functional on the deployed Vercel application (`https://coupon-cycle.vercel.app/`).
    *   Confirm the production database is correctly configured, accessible, and migrations have been applied (`npx prisma migrate deploy`).
    *   Thoroughly test the "Add Card" functionality end-to-end on Vercel to ensure it interacts correctly with the production database.
2.  **Seed Database:** Populate `PredefinedCard` and `PredefinedBenefit` tables with initial data using `npx prisma db seed`. This is crucial for the "Add Card" flow.
3.  **Add Credit Card UI/Logic (Enhancements & Testing):**
    *   User selects a card from a predefined list (`PredefinedCard`) - *UI component for this exists at `/cards/new` but needs integration with backend logic for adding a card to the user.*
    *   User *optionally* provides the month and year the card was opened.
    *   System creates a `CreditCard` entry for the user.
    *   System automatically creates corresponding `Benefit` entries for the user based on the `PredefinedBenefit`s of the selected `PredefinedCard`.
    *   System creates the initial `BenefitStatus` entries for each new `Benefit`, calculating the first cycle's start/end dates based on the benefit's frequency and the card's `openedDate` (or a default if not provided).
    *   *Server action for adding a card needs to be fully implemented and tested.*
4.  **Benefit Dashboard UI & Logic:**
    *   Display all active `BenefitStatus` entries for the user (`/benefits` page started, needs to call `ensureCurrentBenefitStatuses` and display data correctly).
    *   Group/sort by card and expiration date.
    *   Clearly indicate benefits nearing expiration or newly started cycles.
    *   Allow users to mark a `BenefitStatus` cycle as "completed" (action `toggleBenefitStatusAction` exists, UI uses it).
5.  **Benefit Cycle Management (`ensureCurrentBenefitStatuses`):
    *   **DONE:** A Vercel Cron Job (`/api/cron/check-benefits`) has been implemented to run daily. This job iterates through all users and their recurring benefits, calculating the current cycle dates and using `prisma.benefitStatus.upsert` to create or update the status. This replaces the need for `ensureCurrentBenefitStatuses` to be called on user load for cycle creation.
6.  **Notifications:**
    *   Integrate an email sending service (e.g., Resend, SendGrid).
    *   Implement logic (likely triggered alongside benefit cycle management or by a separate cron job querying updated statuses) to query users based on their notification preferences and send relevant emails:
        *   When a new `BenefitStatus` cycle starts.
        *   When a `BenefitStatus` cycle is nearing its `cycleEndDate`.

### 1.2. Implementation Steps (Consolidated & Prioritized)

1.  **Verify Production Deployment & Core Functionality:** Complete all checks in section 1.1.1.
2.  **Seed Production Database:** Run `npx prisma db seed` against the production DB after verifying migrations.
3.  **Complete "Add Card" Feature:** Fully implement the server-side logic for adding a user's card (based on predefined cards) and linking benefits. Ensure UI at `/cards/new` correctly uses this logic.
4.  **Enhance Benefit Dashboard (`/benefits`):** Ensure the page correctly displays fetched `BenefitStatus` data with proper grouping/sorting and UI for completion status, reflecting the data maintained by the cron job.
5.  **~~Implement Benefit Cycle Automation: Set up a Vercel Cron Job or other mechanism to run `ensureCurrentBenefitStatuses` periodically.~~** (This is now DONE, see 1.1.5)
6.  **Develop Notification Service:** Integrate email sending and implement notification logic. 

## 2. Implementation Details

### 2.1. Vercel Cron Job for Benefit Cycle Management

The Vercel Cron Job for benefit cycle management is implemented using a Next.js API route. The implementation details are as follows:

1. **Cron Job Handler:**
   * The cron job handler is implemented in the `[...next-cron].ts` file.
   * The handler uses the `@next/server` module to handle POST requests.
   * The handler verifies the cron job secret and then processes the benefit cycle management logic.

2. **Logic:**
   * The handler fetches all user credit cards with their benefits that are recurring.
   * For each card, it calculates the benefit cycle based on the card's frequency and cycle alignment.
   * It then upserts the benefit status for each calculated cycle.

3. **Error Handling:**
   * The handler includes error handling to ensure that the cron job can continue processing even if one benefit cycle calculation fails.
   * If the cron job fails, it returns a 500 status with an error message.

4. **Optional GET Handler:**
   * The handler includes an optional GET handler for easy testing via browser.
   * This is mainly for convenience during development and should be removed or protected in production.

### 2.2. Implementation Code

The implementation code for the Vercel Cron Job is as follows:

```
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';

// This function will handle POST requests from the cron job.
// Vercel Cron Jobs can send POST requests.
export async function POST(request: Request) {
  // 1. Verify Cron Secret
  // The secret should be passed in the Authorization header, e.g., "Bearer YOUR_CRON_SECRET"
  // Or as a query parameter if your cron service prefers that.
  // For Vercel Cron, you can set an environment variable and check it.
  const authorizationHeader = request.headers.get('Authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set in environment variables.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron job attempt.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // const now = new Date(); // Original line
  const now = new Date(); // Revert to actual system time for production
  // const now = new Date('2025-07-05T12:00:00Z'); // Previous test date
  console.log(`Cron job /api/cron/check-benefits started at: ${now.toISOString()}`);

  try {
    // 2. Fetch all user credit cards with their benefits that are recurring
    const allUserCardsWithBenefits = await prisma.creditCard.findMany({
      include: {
        benefits: {
          where: {
            frequency: {
              not: BenefitFrequency.ONE_TIME,
            },
          },
          // Select necessary fields from Benefit for cycle calculation
          select: {
            id: true,
            frequency: true,
            cycleAlignment: true,
            fixedCycleStartMonth: true,
            fixedCycleDurationMonths: true,
            // We don't need benefit.startDate or endDate here as cycle is based on 'now'
          }
        },
        // Select necessary fields from CreditCard
        user: {
            select: {
                id: true, // We need the userId
            }
        }
      },
    });

    const upsertPromises: Promise<unknown>[] = [];
    let benefitsProcessed = 0;

    for (const card of allUserCardsWithBenefits) {
      if (!card.user?.id) { // Should always have a user, but good to check
        console.warn(`Card ${card.id} is missing user information. Skipping its benefits.`);
        continue;
      }
      const userId = card.user.id;

      for (const benefit of card.benefits) {
        benefitsProcessed++;
        // For CARD_ANNIVERSARY alignment, YEARLY benefits require an openedDate.
        // CALENDAR_FIXED benefits do not strictly need it for their cycle calculation.
        const cardOpenedDateForCalc: Date | null = card.openedDate; // card.openedDate is already included by default on CreditCard
        
        if (
          benefit.cycleAlignment !== BenefitCycleAlignment.CALENDAR_FIXED &&
          benefit.frequency === BenefitFrequency.YEARLY &&
          !card.openedDate // Check the actual card's openedDate
        ) {
          console.warn(`Skipping YEARLY (anniversary based) benefit cycle for benefit ${benefit.id} on card ${card.id} as card has no openedDate.`);
          continue;
        }

        try {
          const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
            benefit.frequency,
            now, // Reference date is now
            cardOpenedDateForCalc,
            benefit.cycleAlignment,
            benefit.fixedCycleStartMonth,
            benefit.fixedCycleDurationMonths
          );

          // Upsert the status: Create if not exists for this cycle start date
          upsertPromises.push(
            prisma.benefitStatus.upsert({
              where: {
                benefitId_userId_cycleStartDate: {
                  benefitId: benefit.id,
                  userId: userId,
                  cycleStartDate: cycleStartDate,
                },
              },
              update: {
                // Ensure end date is updated if calculation logic changes
                cycleEndDate: cycleEndDate,
                // We don't touch isCompleted or completedAt here,
                // new cycles are created as false by default in the 'create' block.
                // If an old status is found, its completion status is preserved.
              },
              create: {
                benefitId: benefit.id,
                userId: userId,
                cycleStartDate: cycleStartDate,
                cycleEndDate: cycleEndDate,
                isCompleted: false, // New cycles start as not completed
              },
            })
          );
        } catch (error) {
          console.error(`Error calculating cycle for benefit ${benefit.id} (user: ${userId}, card: ${card.id}):`, error instanceof Error ? error.message : error);
          // Continue with other benefits even if one fails
        }
      }
    }

    // Execute all upsert operations
    if (upsertPromises.length > 0) {
      console.log(`Cron job: Attempting ${upsertPromises.length} benefit status upserts out of ${benefitsProcessed} benefits processed.`);
      await Promise.all(upsertPromises);
      console.log(`Cron job: ${upsertPromises.length} benefit status upserts completed.`);
    } else if (benefitsProcessed > 0) {
      console.log(`Cron job: ${benefitsProcessed} benefits processed, but no new benefit statuses needed upserting.`);
    } else {
      console.log('Cron job: No recurring benefits found to process.');
    }

    return NextResponse.json({ message: 'Cron job executed successfully.', upsertsAttempted: upsertPromises.length, benefitsProcessed }, { status: 200 });

  } catch (error) {
    console.error('Cron job /api/cron/check-benefits failed:', error instanceof Error ? error.message : error, error instanceof Error ? error.stack : '');
    return NextResponse.json({ message: 'Cron job failed.', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// Optional: Add a GET handler for easy testing via browser if needed,
// but ensure it's also protected or only enabled in development.
// For production, POST with secret is recommended for cron.
// export async function GET(request: Request) {
//   // Implement similar logic as POST, perhaps without a body but with query param secret
//   // OR just call the POST handler internally after auth.
//   // This is mainly for convenience during development.
//   const url = new URL(request.url);
//   const secret = url.searchParams.get('secret');
//   const expectedSecret = process.env.CRON_SECRET;

//   if (!expectedSecret || secret !== expectedSecret) {
//     return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
//   }
//   // Simulate a POST request for testing or call a shared internal function
//   // This is a simplified example; consider refactoring to a shared function if GET is needed
//   console.log("Cron GET request received, calling POST logic internally for testing.");
//   const pseudoPostRequest = new Request(request.url, {
//       method: 'POST',
//       headers: new Headers({ 'Authorization': `Bearer ${expectedSecret}`})
//   });
//   return await POST(pseudoPostRequest);
// } 