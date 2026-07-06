# 🏗️ Current System Architecture


### Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes + Server Actions  
- **Database:** PostgreSQL via Neon (main/prod branch + dev branch)
- **ORM:** Prisma with generated client
- **Authentication:** NextAuth.js with OAuth (Google, GitHub, Facebook) + custom email/password with verification
- **Email:** Resend API for notifications
- **Deployment:** Vercel with automated cron jobs
- **Testing:** Jest with Testing Library
- **UI Components:** Custom components + Headless UI, Heroicons
- **Drag & Drop:** @dnd-kit libraries
- **PWA:** Manifest + service worker support

### Project Structure

```
perks-reminder/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth + email/password auth endpoints
│   │   │   ├── benefits/      # Benefit CRUD operations
│   │   │   ├── user-cards/    # Card management + import/export
│   │   │   ├── predefined-cards/ # Card templates
│   │   │   └── cron/          # Automated jobs
│   │   │       ├── check-benefits/    # Daily benefit status updates
│   │   │       └── send-notifications/ # Email notifications
│   │   ├── benefits/          # Benefits dashboard page
│   │   ├── cards/            # Card management pages
│   │   ├── auth/             # Auth pages (signin, signup, verify, reset)
│   │   ├── loyalty/          # Loyalty program tracking
│   │   ├── loyalty-landing/  # Dedicated landing page for loyalty subdomain
│   │   ├── settings/         # User preferences
│   │   └── contact/          # Contact page
│   ├── middleware.ts          # Subdomain detection & URL rewriting
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
├── scripts/                 # Utility scripts (see Scripts Reference below)
└── .cursor/
    ├── rules/               # Cursor rules for safety checks
    └── skills/              # AI agent skills for common workflows
```

### Cursor Skills (AI Agent Workflows)

The project includes Cursor skills that guide AI agents through common workflows:

| Skill | Location | Purpose |
|-------|----------|---------|
| `add-new-credit-card` | `.cursor/skills/add-new-credit-card/` | Add new cards with images and benefits |
| `update-card-benefits` | `.cursor/skills/update-card-benefits/` | Update benefits for existing cards |
| `session-recap` | `.cursor/skills/session-recap/` | Post-session self-reflection and documentation updates |

**How to use skills**: AI agents automatically detect when these skills are relevant based on user requests. The skills provide step-by-step guidance for complex multi-step workflows.

### Scripts Reference

| Script | Purpose | Type |
|--------|---------|------|
| `update-card-benefits.js` | Update existing card benefits (3-step process) | Workflow |
| `migrate-benefits.js` | Advanced benefit migration framework | Workflow |
| `validate-migration.js` | Validate migration plans before execution | Workflow |
| `download-card-image.js` | Download card images from Google/UseYourCredits | Workflow |
| `check-database-connection.js` | Verify database connection and environment | Utility |
| `list-available-cards.cjs` | List all predefined cards | Utility |
| `fix-duplicate-benefit-statuses.cjs` | Fix duplicate benefit status records | Maintenance |
| `test-email.cjs` | Test email sending functionality | Testing |
| `test-drag-drop.cjs` | Test drag-and-drop reordering | Testing |
| `test-annual-fee-roi.cjs` | Test ROI calculations | Testing |

---
