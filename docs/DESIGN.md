# CouponCycle - Design Document

## 1. Overview

This document outlines the design and development plan for the CouponCycle web application. The primary goal is to help users track their credit card benefits (coupons, credits, etc.), understand their usage cycles (monthly, quarterly, yearly), mark them as completed, and receive timely notifications about upcoming or expiring benefits.

Note: For the most up-to-date architecture, roadmap, and operational runbooks, see the canonical `CURSOR.md` at the repository root. This file is a historical snapshot (last fully reviewed 2025-01-11).

## 2. Current State (as of 2025-01-11)

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
*   `LoyaltyProgram`: Stores predefined loyalty programs with expiration policies and qualifying activities.
*   `LoyaltyAccount`: User's individual loyalty program accounts with last activity dates and calculated expiration dates.

### 2.3. Implemented Features

*   **User Authentication:** Solid NextAuth.js setup with Google provider and correctly typed session/JWT including user ID.
*   **Database & Schema:** Robust Prisma schema with advanced benefit cycle alignment fields (`cycleAlignment`, `fixedCycleStartMonth`, `fixedCycleDurationMonths`). Seed data (`prisma/seed.ts`) significantly overhauled for accuracy.
*   **Core Benefit Cycle Logic:** `calculateBenefitCycle` in `lib/benefit-cycle.ts` accurately handles various frequencies and `CALENDAR_FIXED` / card anniversary alignments.
*   **Card Management:** Users can add cards from predefined templates; benefits and initial statuses are created. UI includes indexed card names.
*   **Benefit Dashboard (`/benefits`):** Displays active and completed benefits. Features total unused/used value widgets, a tabbed layout ("Upcoming", "Claimed") via `BenefitsDisplayClient.tsx`, and improved UI responsiveness.
*   **Benefit Reordering:** Drag-and-drop functionality allows users to customize benefit display order. Uses `@dnd-kit` libraries for accessibility, with `orderIndex` field in `BenefitStatus` model for persistence. Includes visual drag indicators and automatic saving.
*   **Annual Fee ROI Tracking:** Automatically calculates and displays Return on Investment for credit card annual fees. Shows total annual fees vs. claimed benefits value on both the main dashboard and benefits page. Uses color-coded widgets (green for profitable, orange for unprofitable) with detailed breakdowns.
*   **Automated Cron Jobs (Vercel):**
    *   **Benefit Cycle Refresh (`/api/cron/check-benefits`):** Daily cron job proactively updates `BenefitStatus` for all users. Secured via `x-vercel-cron-authorization` header and `CRON_SECRET`.
    *   **Email Notifications (`/api/cron/send-notifications`):** Daily cron job sends summary emails for new benefit cycles, upcoming benefit expirations, and loyalty program point expirations using Resend (`lib/email.ts`). Also secured via `authorization` header and includes `mockDate` support for testing.
*   **Loyalty Program Management (`/loyalty`):** Complete system for tracking loyalty program accounts with expiration monitoring. Features dashboard with status widgets, add/edit/delete modals, and automatic expiration date calculation based on program rules.
*   **Notification Settings UI (`/settings/notifications`):** Users can configure email notification preferences including loyalty program point expiration alerts. "Save Settings" functionality is implemented.
*   **UI/UX Enhancements:**
    *   Significant improvements to UI responsiveness (e.g., `useTransition`, client components).
    *   Redesigned logged-out homepage with hero section, image, and clear CTAs.
    *   Mobile-responsive Navbar with hamburger menu.
    *   Site-wide Footer.
    *   Improved iconography (favicon, dashboard icons).
    *   Theme (light/dark) automatically matches system preference via Tailwind CSS (`darkMode: 'media'`).
    *   User-friendly "Sign In" prompts for protected content.
    *   "Contact" page added.
*   **Stable Build Process:** `npm run build` completes successfully, incorporating ESLint fixes and Prisma client generation.
*   **Vercel Deployment Configuration:**
    *   Prisma query engine (`rhel-openssl-3.0.x`) and `engineType` correctly configured in `schema.prisma`.
    *   `@prisma/nextjs-monorepo-workaround-plugin` added to `next.config.ts`.
    *   `vercel.json` configured for cron jobs (defaulting to `GET` method, secured via headers in API routes).
    *   ESLint configured to ignore `src/generated/**`.
    *   Suspense boundary for `useSearchParams` on client pages.
*   **Progressive Web App (PWA) Support:**
    *   Web app manifest (`/manifest.json`) for native app installation on mobile devices.
    *   iOS Safari and Android Chrome compatibility for "Add to Home Screen" functionality.
    *   Standalone mode with app-like experience when installed.
    *   Optimized viewport and theme color configuration.

## 3. Next Steps & Action Plan

The future roadmap and development priorities are documented in the main CURSOR.md file under the "🔮 Future Roadmap" section.

## 4. Future Considerations

*   Allowing users to add custom cards/benefits not in the predefined list.
*   More sophisticated tracking (e.g., tracking partial usage of a benefit amount).
*   Visualizations and reporting.
*   Admin interface for managing predefined cards/benefits. 
*  Organize the seed data. 
