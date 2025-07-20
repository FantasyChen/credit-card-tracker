# CouponCycle - Action Plan

This document outlines the key next steps and implementation priorities for the CouponCycle application. For a broader overview of the project design and current state, please see `DESIGN.md`.

## 1. Planned Features & Next Steps

### 1.1. Core User Flow (Updated Priorities)

1.  **Verify Production Setup (Vercel):**
    *   Ensure Google OAuth is fully functional on the deployed Vercel application (`https://www.coupon-cycle.site/`).
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
    *   **DONE (Partially):** UI significantly enhanced with tabs, value widgets (`BenefitsDisplayClient.tsx`). Data fetching relies on cron job population.
5.  **Benefit Cycle Management (`ensureCurrentBenefitStatuses`):
    *   **DONE:** A Vercel Cron Job (`/api/cron/check-benefits`) has been implemented to run daily. This job iterates through all users and their recurring benefits, calculating the current cycle dates and using `prisma.benefitStatus.upsert` to create or update the status. This replaces the need for `ensureCurrentBenefitStatuses` to be called on user load for cycle creation.
6.  **Notifications:**
    *   **DONE:** Integrated Resend for email sending (`lib/email.ts`).
    *   **DONE:** Implemented a Vercel Cron Job (`/api/cron/send-notifications`) to query users and statuses, and send summary emails for new cycles and expirations. Secured and includes mock date testing.

### 1.2. Implementation Steps (Consolidated & Prioritized)

1.  **Verify Production Deployment & Core Functionality:** Complete all checks in section 1.1.1.
2.  **Seed Production Database:** Run `npx prisma db seed` against the production DB after verifying migrations.
3.  **Complete "Add Card" Feature:** Fully implement the server-side logic for adding a user's card (based on predefined cards) and linking benefits. Ensure UI at `/cards/new` correctly uses this logic.
4.  **Enhance Benefit Dashboard (`/benefits`):** **DONE (Largely):** Page displays fetched `BenefitStatus` data, reflecting data maintained by the cron job. Further refinements for grouping/sorting could be future work.
5.  **~~Implement Benefit Cycle Automation: Set up a Vercel Cron Job or other mechanism to run `ensureCurrentBenefitStatuses` periodically.~~** (This is now DONE, see 1.1.5)
6.  **~~Develop Notification Service: Integrate email sending and implement notification logic.~~** **DONE** (see 1.1.6)

## 2. Implementation Details

### 2.1. Vercel Cron Job for Benefit Cycle Management (and Notifications)

Both Vercel Cron Jobs (`/api/cron/check-benefits` and `/api/cron/send-notifications`) are implemented as Next.js API routes. Key details:

1.  **Invocation:** Vercel Cron jobs are configured in `vercel.json` to call these API routes. Vercel defaults to using the `GET` HTTP method.
2.  **Handlers:** Each route (`route.ts`) implements an `async function GET(request: Request)` to handle invocations from Vercel Cron.
    *   A corresponding `async function POST(request: Request)` is also implemented in each route for manual triggering (e.g., via `curl` for testing) or potential future use by other services.
3.  **Security:**
    *   Both `GET` and `POST` handlers are secured by checking the `x-vercel-cron-authorization` request header.
    *   The value of this header must be `Bearer ${process.env.CRON_SECRET}`.
    *   If the header is missing or invalid, the route returns a 401 Unauthorized response.
    *   `CRON_SECRET` must be set as an environment variable in Vercel.
4.  **Core Logic:** The actual work (checking benefits, sending notifications) is encapsulated in shared internal functions within each route file, called by both `GET` and `POST` handlers after successful authorization.
5.  **Error Handling:** Each cron job includes `try...catch` blocks to handle errors during processing and returns appropriate JSON responses (200 for success, 500 for internal errors).
6.  **Testing (`send-notifications`):** The `send-notifications` cron includes a `mockDate` query parameter in its core logic that can be used (in non-production environments) via the `request.url` to simulate different dates for testing notification triggers.

*(The previous detailed code example for the cron job handler is now outdated due to the GET handler implementation and security model. Refer to the actual `route.ts` files in `src/app/api/cron/*` for the current implementation.)*

## 3. Future Considerations & Next Agent Onboarding

With the core functionality of benefit tracking, automated cycle updates, and email notifications now in place and robustly deployed on Vercel, the application has a solid foundation. The next developer can focus on the following:

*   **Production Hardening & Monitoring:**
    *   Review and refine production logging. Consider a structured logging service.
    *   Set up monitoring/alerting for cron job failures or high error rates on Vercel.
    *   Thoroughly test all user flows on the production deployment with the actual production database.
*   **UI/UX Refinements:**
    *   Address the `<img>` vs `next/image` warning on the homepage for LCP optimization.
    *   Continue to iterate on dark theme consistency if any minor gaps are found.
    *   Consider more advanced sorting/filtering options on the Benefits Dashboard.
    *   Gather user feedback on the overall UX and make adjustments.
*   **Feature Enhancements (from original `DESIGN.MD` future considerations):**
    *   ~~Annual Fee ROI Dashboard~~ **COMPLETED:** Added ROI tracking widgets to both main dashboard and benefits page showing annual fees vs. claimed benefits with color-coded profitability indicators.
    *   Allowing users to add custom cards/benefits not in the predefined list.
    *   More sophisticated tracking (e.g., tracking partial usage of a benefit amount).
    *   Visualizations and reporting.
    *   Admin interface for managing predefined cards/benefits.
*   **Code Quality & Maintenance:**
    *   Periodically review and refactor code for clarity and efficiency.
    *   Keep dependencies updated.
    *   Ensure `prisma/seed.ts` remains current with popular card benefits.

The primary focus initially should be on ensuring the existing features are completely stable and well-monitored in production. After that, UI refinements and new feature development can proceed based on priority.

The Vercel cron job setup (`vercel.json` and the API route handlers in `src/app/api/cron/`) is a critical piece of infrastructure to understand. The security model relies on the `x-vercel-cron-authorization` header and the `CRON_SECRET` environment variable.



### TODO
1. Publish the website (domain)
2. Increase server capability
3. Buy coffee?