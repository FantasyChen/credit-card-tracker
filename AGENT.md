# CouponCycle - Complete Project Documentation for AI Agents

## 🎯 Project Overview

**CouponCycle** is a free, open-source Progressive Web App that helps users maximize their credit card benefits by tracking recurring perks, managing loyalty programs, and ensuring no valuable benefits expire unused. 

**Problem it Solves:** Credit card users lose hundreds of dollars annually by forgetting to use benefits like annual credits, free nights, and other perks that reset on monthly, quarterly, or yearly cycles.

**Core Mission:** Help users track every credit card benefit cycle, receive timely notifications, and maximize their annual fee ROI.

---

## 🏗️ Current System Architecture

### Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes + Server Actions  
- **Database:** PostgreSQL (production via Neon), SQLite (development)
- **ORM:** Prisma with generated client
- **Authentication:** NextAuth.js with Google OAuth
- **Email:** Resend API for notifications
- **Deployment:** Vercel with automated cron jobs
- **Testing:** Jest with Testing Library
- **UI Components:** Custom components + Headless UI, Heroicons
- **Drag & Drop:** @dnd-kit libraries
- **PWA:** Manifest + service worker support

### Project Structure

```
credit-card-tracker/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   ├── benefits/      # Benefit CRUD operations
│   │   │   ├── user-cards/    # Card management + import/export
│   │   │   ├── predefined-cards/ # Card templates
│   │   │   └── cron/          # Automated jobs
│   │   │       ├── check-benefits/    # Daily benefit status updates
│   │   │       └── send-notifications/ # Email notifications
│   │   ├── benefits/          # Benefits dashboard page
│   │   ├── cards/            # Card management pages
│   │   ├── loyalty/          # Loyalty program tracking
│   │   ├── settings/         # User preferences
│   │   └── contact/          # Contact page
│   ├── components/           # Reusable React components
│   │   ├── ui/              # Base UI components
│   │   ├── BenefitsDisplayClient.tsx  # Main benefits interface
│   │   ├── DraggableBenefitCard.tsx  # Drag-and-drop functionality
│   │   ├── Navbar.tsx       # Navigation component
│   │   └── Footer.tsx       # Site footer
│   ├── lib/                 # Core business logic
│   │   ├── actions/         # Server actions
│   │   ├── benefit-cycle.ts # Benefit cycle calculations
│   │   ├── auth.ts          # Authentication config
│   │   ├── prisma.ts        # Database client
│   │   └── email.ts         # Email service
│   └── types/               # TypeScript definitions
├── prisma/                  # Database schema & migrations
│   ├── schema.prisma        # Data models
│   ├── migrations/          # Database migrations
│   └── seed.ts             # Predefined card data
├── public/                  # Static assets
│   ├── images/cards/        # Credit card images
│   └── manifest.json        # PWA manifest
├── docs/                    # Project documentation
└── scripts/                 # Utility scripts
```

---

## 🗄️ Database Schema & Core Models

### User Management
- **User**: Authentication, notification preferences, and settings
- **Account/Session**: NextAuth.js models for OAuth

### Card & Benefit System
- **CreditCard**: User's cards with opening dates and card details
- **Benefit**: Individual benefits tied to cards (recurring cycles)
- **BenefitStatus**: Tracks completion status for each benefit cycle
- **PredefinedCard**: Template cards with issuer info and annual fees
- **PredefinedBenefit**: Template benefits linked to predefined cards

### Loyalty Program System
- **LoyaltyProgram**: Airline/hotel programs with expiration rules
- **LoyaltyAccount**: User's individual loyalty accounts with activity tracking

### Key Enums
- **BenefitFrequency**: `MONTHLY`, `QUARTERLY`, `YEARLY`, `ONE_TIME`
- **BenefitCycleAlignment**: `CARD_ANNIVERSARY`, `CALENDAR_FIXED`
- **LoyaltyProgramType**: `AIRLINE`, `HOTEL`, `RENTAL_CAR`, `CREDIT_CARD`

---

## 🔄 Core Business Logic

### Benefit Cycle Calculation System

The heart of the application is the `calculateBenefitCycle()` function in `src/lib/benefit-cycle.ts`:

**Purpose:** Determines the current active cycle dates for any benefit based on:
- Frequency (monthly/quarterly/yearly)
- Card opening date (for anniversary-based cycles)
- Calendar alignment (fixed dates like Jan-Mar for Q1)
- Reference date (typically "now")

**Two Alignment Types:**
1. **CARD_ANNIVERSARY**: Cycles based on when the card was opened
2. **CALENDAR_FIXED**: Cycles based on fixed calendar dates

**Examples:**
- Monthly Uber credit: Resets 1st of each month
- Quarterly travel credit: Resets every 3 months from card anniversary
- Semi-annual hotel credit: Resets every 6 months on calendar dates (Jan-Jun, Jul-Dec)

### Automated Benefit Status Management

**Daily Cron Job** (`/api/cron/check-benefits`):
- Runs daily via Vercel cron
- Updates `BenefitStatus` records for all users
- Creates new cycles, maintains current cycles
- Secured with `CRON_SECRET` header

**Process:**
1. Fetch all user cards with benefits
2. Calculate current cycle dates for each benefit
3. Upsert `BenefitStatus` records (create if new, update if changed)
4. Maintain completion status across cycles

---

## 🎨 Key Features & Implementation

### 1. Benefits Dashboard (`/benefits`)
- **Tabbed Interface**: "Upcoming" and "Claimed" benefits
- **ROI Tracking**: Annual fee vs. claimed benefits analysis
- **Drag & Drop Reordering**: Custom benefit order with persistence
- **Visual Indicators**: Progress bars, completion status, cycle dates
- **Real-time Updates**: Server actions for marking benefits complete

### 2. Card Management (`/cards`)
- **Add New Cards**: From predefined templates with custom opening dates
- **Card Images**: Automated download system using SerpApi
- **Edit/Delete**: Full CRUD operations
- **Benefit Auto-Creation**: Benefits automatically created from templates

### 3. Loyalty Program Tracking (`/loyalty`)
- **Expiration Monitoring**: Track when points/miles expire
- **Activity Tracking**: Record last activity dates
- **Automated Notifications**: Email alerts for expiring points
- **Multiple Programs**: Airlines, hotels, rental cars

### 4. Progressive Web App (PWA)
- **Installable**: Add to home screen on mobile devices
- **Offline Capable**: Service worker for basic offline functionality
- **Native Feel**: Standalone mode, optimized viewport

### 5. Email Notification System
- **Daily Digest**: New benefit cycles, expiring benefits
- **Loyalty Alerts**: Points expiration warnings
- **User Preferences**: Configurable notification settings
- **Resend Integration**: Professional email delivery

### 6. Data Import/Export (`/settings/data`)
- **JSON Export**: Complete user data backup
- **Import System**: Restore from previous exports
- **Data Recovery**: Essential for database migrations

---

## 🔧 Development Guidelines

### Environment Setup

**Local Development:**
- The project includes a fully configured `.env` file for local development
- All required environment variables are already set up
- No additional configuration needed for local development

**Required Environment Variables for Production:**
```bash
# Database
DATABASE_URL="postgresql://..." # Production
DATABASE_URL_DEV="postgresql://..." # Development branch

# Authentication  
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_URL="http://localhost:3000" # or production URL
NEXTAUTH_SECRET="your-nextauth-secret"

# Services
RESEND_API_KEY="your-resend-api-key"
CRON_SECRET="your-cron-secret"
SERPAPI_API_KEY="your-serpapi-key" # For card image downloads
```

> **Note for Cursor:** The `.env` file already exists in this repository and is fully configured. The Cursor agent cannot access it directly due to environment isolation, but local commands and the app will still read from `.env`. Refer to `.env.example` if you need a reference of keys.

### Database Safety Rules ⚠️

**CRITICAL - NEVER RUN:**
- `npx prisma migrate reset` (wipes ALL data)
- `npx prisma db push --force-reset`
- Any command with `--force-reset` on production

**Safe Development Workflow:**
1. Always use development database branch first
2. Test schema changes on dev branch: `export DATABASE_URL=$DATABASE_URL_DEV`
3. Use `npx prisma migrate dev` for schema changes
4. Let Vercel handle production deployments automatically

**Explicit user-approved production changes:**
- If and only if the human user explicitly requests it, it is acceptable to run non-destructive operations against the production database after verifying `DATABASE_URL` points to production.
- Allowed non-destructive ops include:
  - Seeding/upserting predefined catalog data: `npx prisma db seed`
  - Applying already-generated migrations: `npx prisma migrate deploy`
- Still forbidden on production: destructive resets (`migrate reset`, `db push --force-reset`, manual `DROP` statements), or anything that erases/modifies user data outside of intended migrations.
- Always:
  - Echo/print `DATABASE_URL` (mask credentials) and confirm the target.
  - Prefer read-only or upsert-style scripts for catalog updates.
  - Document the action in commit messages or ops notes.

**Database Environment Priority**: Shell variables override `.env` file. Use `unset DATABASE_URL` to clear overrides and use `.env` configuration. Always verify target with `node scripts/check-database-connection.js`.

### Adding New Credit Cards

1. **Research Card**: Verify benefits at [US Credit Card Guide](https://www.uscreditcardguide.com/)
2. **Download Image**: `node scripts/download-card-image.js --name "Card Name"`
3. **Update Seed**: Add card and benefits to `prisma/seed.ts`
4. **Re-seed**: `npx prisma db seed`

### Updating Existing Card Benefits

⚠️ **CRITICAL**: Updating existing card benefits requires a **two-step process**:

1. **Update Templates** (affects new users): Edit `prisma/seed.ts` → `npx prisma db seed`
2. **Migrate Existing Users**: Run appropriate migration script with `--force`

**See `docs/predefined-card-update-guide.md` for complete workflow.**

**Common Issue**: If you only update templates, existing users will still see old benefits until migrated.

**Benefit Inclusion Criteria:**
- Must have cyclical value (credits, points, free nights)
- Must reset on trackable cycles (monthly/quarterly/yearly)
- Exclude always-on perks (multipliers, insurance, status, memberships)
- Verify with reliable sources

**Specific Exclusions:**
- Priority Pass memberships (always-on access, no cyclical reset)
- Lounge memberships (Admirals Club, Centurion Lounge access)
- Insurance benefits (travel insurance, purchase protection)
- Earning rate multipliers (3x points on dining, etc.)
- Elite status benefits (hotel/airline status)
- One-time signup bonuses

### Testing

**Available Tests:**
```bash
npm test                                    # Run all tests
node scripts/test-drag-drop.cjs            # Test reordering functionality
node scripts/test-annual-fee-roi.cjs       # Test ROI calculations
node scripts/check-database-connection.js  # Verify database connection
```

---

## 🚀 Deployment & Operations

### Vercel Configuration

**Automatic GitHub Deployment:**
- **Push to main branch** → Automatic production deployment
- **No manual deployment needed** - Vercel handles everything
- Environment variables configured in Vercel dashboard
- Build command: `prisma generate && next build`
- Database migrations run automatically via `npx prisma migrate deploy`

**Cron Jobs** (configured in `vercel.json`):
- Daily benefit status updates: `/api/cron/check-benefits`
- Daily email notifications: `/api/cron/send-notifications`
- Both require the header `Authorization: Bearer <CRON_SECRET>`

Manual trigger examples:

```bash
# Replace <url> with http://localhost:3000 or the deployed URL
curl -i -X GET -H "Authorization: Bearer $CRON_SECRET" <url>/api/cron/check-benefits

# Notifications cron supports an optional mockDate (non-production only)
curl -i -X GET -H "Authorization: Bearer $CRON_SECRET" "<url>/api/cron/send-notifications?mockDate=2025-08-15"
```

### Database Management

**Production Database**: Neon PostgreSQL with branching
- Main branch: Production data
- Development branch: Safe testing environment
- Point-in-time recovery available for data incidents

**Migration Process:**
1. Test on development branch (optional)
2. Commit migration files to main branch
3. Push to GitHub → Vercel automatically runs `npx prisma migrate deploy`
4. No manual deployment steps required

**Production changes on request (non-destructive):**
- When the user asks to update production data (e.g., add or refresh predefined cards/benefits):
  1. Verify target: `node scripts/check-database-connection.js` (ensure it reports production/Neon main)
  2. Run non-destructive seed: `DATABASE_URL="<prod>" npx prisma db seed`
  3. For schema already migrated in code, apply to prod: `DATABASE_URL="<prod>" npx prisma migrate deploy`
  4. Never use reset/force-reset commands on production

### Monitoring & Analytics

- **Vercel Analytics**: Built-in performance monitoring
- **Error Tracking**: Console logging with structured error handling
- **User Activity**: Email notification delivery tracking
- **Cron Observability**: Cron routes log attempt time, authorization presence (never log the secret), counts of processed records, and success/failure totals

### Runbooks

- Cron failures: Re-run manually using the commands above; inspect logs for upserts attempted/succeeded/failed; verify `CRON_SECRET` configured in env and Vercel
- Database incident recovery: Follow the Neon CLI workflow in README (“Database Recovery with Neon CLI”) to branch by timestamp, verify, and switch
- Notification testing: Use `send-notifications?mockDate=YYYY-MM-DD` locally with `Authorization: Bearer $CRON_SECRET` (mockDate ignored in production)

---

## 📱 User Experience & Marketing

### Target Audience
- **Primary**: Tech-savvy credit card enthusiasts, travel hackers, churners
- **Secondary**: Anyone with multiple credit cards wanting better organization
- **Demographics**: High-income professionals, frequent travelers, financial optimizers

### Value Propositions
1. **Never Miss Benefits**: Automated tracking prevents expired perks
2. **ROI Transparency**: Clear annual fee vs. benefits analysis
3. **Centralized Management**: All cards and benefits in one place
4. **Free & Private**: No ads, no data selling, open source
5. **Mobile-First**: PWA for native app experience

### Marketing Channels
- **Reddit Communities**: r/churning, r/personalfinance, r/CreditCards
- **Content Marketing**: Blog posts about maximizing specific card benefits
- **SEO**: Target keywords like "credit card benefit tracker"
- **Word of Mouth**: High-quality tool encourages organic sharing

---

## 🔮 Future Roadmap

### Short Term (Next 3 months)
- [x] **COMPLETED**: Automated benefit migration framework (Sep 2025)
- [ ] Custom card/benefit creation for non-predefined cards  
- [ ] Enhanced mobile app experience
- [ ] Better data visualization and reporting
- [ ] User feedback and rating system

### Medium Term (3-6 months)  
- [ ] Bank account integration for automatic spend tracking
- [ ] Multi-user household management
- [ ] Advanced analytics dashboard
- [ ] API for third-party integrations

### Long Term (6+ months)
- [ ] Machine learning for benefit usage predictions
- [ ] Integration with popular budgeting apps
- [ ] Enterprise features for financial advisors
- [ ] Mobile native apps (iOS/Android)

---

## 🐛 Common Issues & Solutions

### Development Issues

**Database Connection Problems:**
```bash
# Check which database you're connected to
echo $DATABASE_URL
node scripts/check-database-connection.js
```

**Migration Drift:**
```bash
# Switch to dev branch first
export DATABASE_URL=$DATABASE_URL_DEV
npx prisma migrate dev --name fix_drift
```

**Credit Card Benefit Updates (NEW Framework):**
```bash
# Validate migration plan
node scripts/validate-migration.js --migration-id=card-update-2025

# Preview changes (dry run)
node scripts/migrate-benefits.js --migration-id=card-update-2025 --dry-run

# Execute migration safely
node scripts/migrate-benefits.js --migration-id=card-update-2025 --force
```

**Build Failures:**
```bash
# Regenerate Prisma client
npx prisma generate
npm run build
```

### Production Issues

**User Data Loss Prevention:**
- Regular export reminders to users
- Automated backup system considerations
- Point-in-time recovery via Neon CLI
- Automated migration framework preserves completed benefits by default

**Deprecated Migration Approach:**
- Old manual scripts moved to `scripts/deprecated/`
- Use new automated framework in `scripts/migrate-benefits.js`
- See `docs/benefit-migration-framework.md` for complete guide

**Performance Optimization:**
- Database query optimization
- Image loading optimization
- PWA caching strategies

---

## 🤝 Contributing Guidelines

### Types of Contributions Welcome
- 🐛 Bug fixes and issue reports
- 📊 Credit card data updates (most valuable)
- ✨ New feature implementations
- 📚 Documentation improvements
- 🧪 Test coverage expansion

### Code Standards
- **TypeScript**: Strict typing required
- **ESLint**: Follow configured rules
- **Testing**: Add tests for new features
- **Accessibility**: Follow WCAG guidelines
- **Performance**: Optimize for mobile-first

### Pull Request Process
1. Fork repository and create feature branch
2. Follow coding standards and add tests
3. Update documentation if needed
4. Submit PR with clear description
5. Respond to review feedback promptly

---

## 📞 Support & Community

### Getting Help
- **Issues**: GitHub Issues for bugs and feature requests
- **Discussions**: GitHub Discussions for general questions
- **Email**: Contact form on website for sensitive issues

### Community Resources
- **Live App**: [www.coupon-cycle.site](https://www.coupon-cycle.site/)
- **Repository**: [GitHub](https://github.com/FantasyChen/credit-card-tracker)
- **Documentation**: This file and `/docs` folder
- **Support Creator**: [Buy me a coffee](https://coff.ee/fantasy_c)

---

## 📄 License & Legal

- **License**: MIT License - free for personal and commercial use
- **Data Privacy**: No user data collection beyond necessary functionality
- **Open Source**: Fully transparent codebase
- **No Warranty**: Provided as-is for community benefit

---

## 📝 Recent Updates

### September 2025: AMEX Platinum 2025 Benefits Update
**Date**: September 18, 2025  
**Implementation Status**: ✅ Complete

**Changes Implemented**:
- **Annual Fee Update**: Both cards increased from $695 → $895
- **American Express Platinum Card**: Updated with 12 new benefits including quarterly Resy dining credit ($100), quarterly Lululemon credit ($75), enhanced hotel credits ($600 total), and more
- **American Express Business Platinum Card**: Updated with 7 new benefits including enhanced hotel credits ($600), Dell Technologies credit ($1,150), Adobe credit ($250), and high-spender benefits

**Technical Implementation**:
1. ✅ **Seed Data Updated**: Modified `prisma/seed.ts` with new benefit structures and annual fees
2. ✅ **Production Templates Updated**: Non-destructive seed operation applied to production database  
3. ✅ **Migration Script Created**: `scripts/migrate-amex-2025-benefits.js` for existing user cards (280+ cards found)
4. ✅ **Testing Completed**: Dry-run testing successful on all user cards

**Migration Instructions**:
```bash
# Dry run to see what would change
node scripts/migrate-amex-2025-benefits.js --dry-run

# Apply changes to existing user cards
node scripts/migrate-amex-2025-benefits.js --force
```

**User Impact**: Existing AMEX Platinum cardholders will receive updated benefits in their next benefit cycle after running the migration script.

---

*Last Updated: September 2025*
*Version: 0.1.1*
*Created by: fantasy_c*

---

> **Note for AI Agents**: This document provides complete context for the CouponCycle project. Use this information to understand the system architecture, business logic, and development practices when assisting with code changes, feature additions, or debugging. Always follow the database safety rules and maintain the high code quality standards established in this project. 