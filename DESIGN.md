# Credit Card Tracker - Design Document

## 1. Overview

This document outlines the design and development plan for the Credit Card Tracker web application. The primary goal is to help users track their credit card benefits, understand their usage cycles (monthly, quarterly, yearly), mark them as completed, and receive timely notifications about upcoming or expiring benefits.

## 2. Current State (as of 2025-05-08)

### 2.1. Technology Stack

*   **Frontend:** Next.js (App Router), React, Tailwind CSS
*   **Backend:** Next.js (API Routes / Server Actions)
*   **Database:** Prisma ORM with PostgreSQL (for production, SQLite for local development)
*   **Authentication:** NextAuth.js (Google Provider configured)
*   **Linting/Build:** ESLint (flat config), TypeScript. Build process is stable.

### 2.2. Core Data Models (`prisma/schema.prisma`)

*   `User`: Stores user information, authentication details, and notification preferences.
*   `Account`, `Session`: Standard NextAuth.js models for authentication.
*   `CreditCard`: Represents credit cards added by the user, linked to a `User`. Includes optional `openedDate`.
*   `Benefit`: Represents a specific benefit instance associated with a user's `CreditCard`. Includes details like category, description, amount/percentage, frequency, and dates.
*   `BenefitStatus`: Tracks the status of *each cycle* of a recurring `Benefit` for a specific `User`. Links to `Benefit` and `User`, includes cycle start/end dates, and a completion flag (`isCompleted`).
*   `PredefinedCard`: Stores template information for common credit cards (name, issuer, annual fee, image).
*   `PredefinedBenefit`: Stores template benefit information linked to a `PredefinedCard`.

### 2.3. Implemented Features

*   **User Authentication:** Basic setup using NextAuth.js is in place with Google provider.
*   **Database Schema:** Prisma schema defines the core models and their relationships.
*   **Notification Settings UI:** A page (`/settings/notifications`) allows users to configure preferences for receiving notifications about new benefit cycles and upcoming expirations (`src/app/settings/notifications/page.tsx`). The backend action (`updateNotificationSettingsAction`) to save these settings is also implemented.
*   **Stable Build Process:** Resolved initial linting, type, and build errors. `npm run build` completes successfully.
*   **Vercel Deployment Configuration:**
    *   Prisma query engine compatibility for Vercel (Linux/OpenSSL) addressed by updating `binaryTargets` and `engineType` in `prisma.schema`.
    *   ESLint configured to ignore `src/generated/**`.
    *   NextAuth.js session and JWT types augmented to include user ID correctly.
    *   Suspense boundary added for `useSearchParams` on client-side pages (e.g., sign-in page).

## 3. Planned Features & Next Steps

### 3.1. Core User Flow (Updated Priorities)

1.  **Verify Production Setup (Vercel):**
    *   Ensure Google OAuth is fully functional on the deployed Vercel application (`https://credit-card-tracker-tawny.vercel.app/`).
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
5.  **Benefit Cycle Management (`ensureCurrentBenefitStatuses`):**
    *   The server action `ensureCurrentBenefitStatuses` is implemented to create/update `BenefitStatus` records.
    *   **Next:** Determine and implement the trigger mechanism for this action (e.g., cron job via Vercel Cron Jobs, on user login, or when viewing the benefits dashboard).
6.  **Notifications:**
    *   Integrate an email sending service (e.g., Resend, SendGrid).
    *   Implement logic (likely triggered alongside benefit cycle management) to query users based on their notification preferences and send relevant emails:
        *   When a new `BenefitStatus` cycle starts.
        *   When a `BenefitStatus` cycle is nearing its `cycleEndDate`.

### 3.2. Implementation Steps (Consolidated & Prioritized)

1.  **Verify Production Deployment & Core Functionality:** Complete all checks in section 3.1.1.
2.  **Seed Production Database:** Run `npx prisma db seed` against the production DB after verifying migrations.
3.  **Complete "Add Card" Feature:** Fully implement the server-side logic for adding a user's card (based on predefined cards) and linking benefits. Ensure UI at `/cards/new` correctly uses this logic.
4.  **Enhance Benefit Dashboard (`/benefits`):** Ensure `ensureCurrentBenefitStatuses` is called appropriately. Display fetched `BenefitStatus` data with proper grouping/sorting and UI for completion status.
5.  **Implement Benefit Cycle Automation:** Set up a Vercel Cron Job or other mechanism to run `ensureCurrentBenefitStatuses` periodically.
6.  **Develop Notification Service:** Integrate email sending and implement notification logic.

## 4. Future Considerations

*   Allowing users to add custom cards/benefits not in the predefined list.
*   More sophisticated tracking (e.g., tracking partial usage of a benefit amount).
*   Adding spending categories and linking transactions (more complex).
*   Visualizations and reporting.
*   Admin interface for managing predefined cards/benefits. 