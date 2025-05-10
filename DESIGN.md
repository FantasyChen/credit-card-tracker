# CouponCycle - Design Document

## 1. Overview

This document outlines the design and development plan for the CouponCycle web application. The primary goal is to help users track their credit card benefits (coupons, credits, etc.), understand their usage cycles (monthly, quarterly, yearly), mark them as completed, and receive timely notifications about upcoming or expiring benefits.

## 2. Current State (as of 2025-05-10)

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
*   **Database Schema:** Prisma schema defines the core models and their relationships, including fields for advanced benefit cycle alignment (`cycleAlignment`, `fixedCycleStartMonth`, `fixedCycleDurationMonths`).
*   **Benefit Cycle Logic:** Core logic in `calculateBenefitCycle` handles various frequencies and alignments (card anniversary, calendar-fixed).
*   **Card Management:** Users can add cards based on predefined templates; benefits and initial statuses are created.
*   **Benefit Dashboard:** Displays active and completed benefits for the user. UI filtering improved to show only currently active cycles in the main list.
*   **Automated Benefit Cycle Refresh:** A daily cron job (`/api/cron/check-benefits`), configured via `vercel.json` and secured with `CRON_SECRET`, proactively updates `BenefitStatus` records for all users and their recurring benefits. This ensures data is current for upcoming notifications and general display.
*   **Notification Settings UI:** A page (`/settings/notifications`) allows users to configure preferences for receiving notifications about new benefit cycles and upcoming expirations (`src/app/settings/notifications/page.tsx`). The backend action (`updateNotificationSettingsAction`) to save these settings is also implemented.
*   **Stable Build Process:** Resolved initial linting, type, and build errors. `npm run build` completes successfully.
*   **Vercel Deployment Configuration:**
    *   Prisma query engine compatibility for Vercel (Linux/OpenSSL) addressed by updating `binaryTargets` and `engineType` in `prisma.schema`.
    *   ESLint configured to ignore `src/generated/**`.
    *   NextAuth.js session and JWT types augmented to include user ID correctly.
    *   Suspense boundary added for `useSearchParams` on client-side pages (e.g., sign-in page).

## 3. Next Steps & Action Plan

For detailed next steps, implementation priorities, and the ongoing action plan, please refer to the dedicated [PLAN.md](./PLAN.md) file.

## 4. Future Considerations

*   Allowing users to add custom cards/benefits not in the predefined list.
*   More sophisticated tracking (e.g., tracking partial usage of a benefit amount).
*   Visualizations and reporting.
*   Admin interface for managing predefined cards/benefits. 
*  Organize the seed data. 
