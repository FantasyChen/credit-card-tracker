# Credit Card Tracker - Design Document

## 1. Overview

This document outlines the design and development plan for the Credit Card Tracker web application. The primary goal is to help users track their credit card benefits, understand their usage cycles (monthly, quarterly, yearly), mark them as completed, and receive timely notifications about upcoming or expiring benefits.

## 2. Current State (as of 2025-04-19)

### 2.1. Technology Stack

*   **Frontend:** Next.js (App Router), React, Tailwind CSS
*   **Backend:** Next.js (API Routes / Server Actions)
*   **Database:** Prisma ORM with SQLite (for development)
*   **Authentication:** NextAuth.js

### 2.2. Core Data Models (`prisma/schema.prisma`)

*   `User`: Stores user information, authentication details, and notification preferences.
*   `Account`, `Session`: Standard NextAuth.js models for authentication.
*   `CreditCard`: Represents credit cards added by the user, linked to a `User`. Includes optional `openedDate`.
*   `Benefit`: Represents a specific benefit instance associated with a user's `CreditCard`. Includes details like category, description, amount/percentage, frequency, and dates.
*   `BenefitStatus`: Tracks the status of *each cycle* of a recurring `Benefit` for a specific `User`. Links to `Benefit` and `User`, includes cycle start/end dates, and a completion flag (`isCompleted`).
*   `PredefinedCard`: Stores template information for common credit cards (name, issuer, annual fee, image).
*   `PredefinedBenefit`: Stores template benefit information linked to a `PredefinedCard`.

### 2.3. Implemented Features

*   **User Authentication:** Basic setup using NextAuth.js is in place.
*   **Database Schema:** Prisma schema defines the core models and their relationships.
*   **Notification Settings UI:** A page (`/settings/notifications`) allows users to configure preferences for receiving notifications about new benefit cycles and upcoming expirations (`src/app/settings/notifications/page.tsx`). The backend action (`updateNotificationSettingsAction`) to save these settings is also implemented.

## 3. Planned Features & Next Steps

### 3.1. Core User Flow

1.  **Add Credit Card:**
    *   User selects a card from a predefined list (`PredefinedCard`).
    *   User *optionally* provides the month and year the card was opened.
    *   System creates a `CreditCard` entry for the user.
    *   System automatically creates corresponding `Benefit` entries for the user based on the `PredefinedBenefit`s of the selected `PredefinedCard`.
    *   System creates the initial `BenefitStatus` entries for each new `Benefit`, calculating the first cycle's start/end dates based on the benefit's frequency and the card's `openedDate` (or a default if not provided).
2.  **Benefit Dashboard:**
    *   Display all active `BenefitStatus` entries for the user.
    *   Group/sort by card and expiration date.
    *   Clearly indicate benefits nearing expiration or newly started cycles.
    *   Allow users to mark a `BenefitStatus` cycle as "completed".
3.  **Notifications:**
    *   Send email notifications based on user preferences stored in the `User` model:
        *   When a new `BenefitStatus` cycle starts (if `notifyNewBenefit` is true).
        *   When a `BenefitStatus` cycle is nearing its `cycleEndDate` (if `notifyBenefitExpiration` is true, respecting `notifyExpirationDays`).

### 3.2. Implementation Steps

1.  **Seed Database:** Populate `PredefinedCard` and `PredefinedBenefit` tables with initial data.
2.  **Add Card UI/Logic:**
    *   Create a UI component/page for selecting predefined cards.
    *   Implement the server action/API route to:
        *   Create the `CreditCard` record.
        *   Create associated `Benefit` records.
        *   Calculate and create initial `BenefitStatus` records.
3.  **Benefit Dashboard UI:**
    *   Create the dashboard page/component.
    *   Fetch and display `BenefitStatus` data for the logged-in user.
    *   Implement the "Mark as Completed" functionality (updating `BenefitStatus.isCompleted`).
4.  **Benefit Cycle Management:**
    *   Implement a mechanism (e.g., a cron job, scheduled task, or logic triggered on user login/dashboard view) to periodically check for benefits whose next cycle should start.
    *   This mechanism will create new `BenefitStatus` records for the upcoming cycles based on the `Benefit.frequency` and the previous cycle's end date.
5.  **Notification Service:**
    *   Integrate an email sending service (e.g., Resend, SendGrid).
    *   Implement logic (likely within the cycle management task) to query users based on their notification preferences and send relevant emails.

## 4. Future Considerations

*   Allowing users to add custom cards/benefits not in the predefined list.
*   More sophisticated tracking (e.g., tracking partial usage of a benefit amount).
*   Adding spending categories and linking transactions (more complex).
*   Visualizations and reporting.
*   Admin interface for managing predefined cards/benefits. 