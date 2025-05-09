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
5.  **Benefit Cycle Management (`ensureCurrentBenefitStatuses`):**
    *   The server action `ensureCurrentBenefitStatuses` is implemented to create/update `BenefitStatus` records.
    *   **Next:** Determine and implement the trigger mechanism for this action (e.g., cron job via Vercel Cron Jobs, on user login, or when viewing the benefits dashboard).
6.  **Notifications:**
    *   Integrate an email sending service (e.g., Resend, SendGrid).
    *   Implement logic (likely triggered alongside benefit cycle management) to query users based on their notification preferences and send relevant emails:
        *   When a new `BenefitStatus` cycle starts.
        *   When a `BenefitStatus` cycle is nearing its `cycleEndDate`.

### 1.2. Implementation Steps (Consolidated & Prioritized)

1.  **Verify Production Deployment & Core Functionality:** Complete all checks in section 1.1.1.
2.  **Seed Production Database:** Run `npx prisma db seed` against the production DB after verifying migrations.
3.  **Complete "Add Card" Feature:** Fully implement the server-side logic for adding a user's card (based on predefined cards) and linking benefits. Ensure UI at `/cards/new` correctly uses this logic.
4.  **Enhance Benefit Dashboard (`/benefits`):** Ensure `ensureCurrentBenefitStatuses` is called appropriately. Display fetched `BenefitStatus` data with proper grouping/sorting and UI for completion status.
5.  **Implement Benefit Cycle Automation:** Set up a Vercel Cron Job or other mechanism to run `ensureCurrentBenefitStatuses` periodically.
6.  **Develop Notification Service:** Integrate email sending and implement notification logic. 