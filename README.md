# CouponCycle 💳

**Tired of losing hundreds of dollars in credit card benefits each year? So was I.** That's why I built this free, open-source tool to help you track your credit card perks and maximize your rewards.

[![CouponCycle Hero Image](public/hero-image.jpg)](https://www.coupon-cycle.site/)

*Stop letting your benefits expire. Start tracking them like a pro.*

## ✨ Why Use CouponCycle?

This isn't just another expense tracker. It's a smart benefits management system designed for anyone who wants to get the most out of their credit cards.
Note on naming: The public-facing app is called "CouponCycle", and the repository is named `credit-card-tracker`.


- **Never Miss a Deadline:** Get automated reminders before your benefits expire.
- **See Your Real ROI:** Instantly know if your card's annual fee is paying for itself.
- **All Your Cards in One Place:** A central dashboard for all your credit cards and their unique perks.
- **Track Your Loyalty Points:** Keep an eye on your points and miles so they don't disappear.
- **It's Free & Private:** No ads, no selling your data. Just a powerful tool for your benefit.

## 🚀 Live App & Installation

You can use the live application right now at **[www.coupon-cycle.site](https://www.coupon-cycle.site/)**.

### For Your Mobile Device (Recommended)

This is a Progressive Web App (PWA), which means you can install it on your phone for a native app-like experience.

- **iPhone/iPad:** Open the site in Safari, tap the 'Share' button, and select "Add to Home Screen".
- **Android:** Open the site in Chrome, tap the three-dot menu, and select "Install app".

## 🔄 Updating Card Information (Community Contributions Welcome!)

Credit card benefits and annual fees change frequently. Help keep our data current!

### Quick Guide for Card Information Updates:

1. **Find outdated information**: Compare our data with official sources
2. **Verify with reliable sources**: Use [US Credit Card Guide](https://www.uscreditcardguide.com/) or official bank websites
3. **Update the seed file**: Edit `prisma/seed.ts` with new information
4. **Submit a pull request**: We'll review and merge quickly

**What to Update:**
- Annual fees that have changed
- Benefits that have been added, removed, or modified
- New credit cards from major issuers
- Corrections to benefit amounts or frequencies

**Quick Example:**
```typescript
// In prisma/seed.ts, find the card and update:
{
  name: 'Chase Sapphire Preferred',
  issuer: 'Chase',
  annualFee: 95, // ← Update this if changed
  benefits: [
    {
      description: '$50 Annual Hotel Credit', // ← Update amounts/descriptions
      maxAmount: 50, // ← Update this value
      // ... rest of benefit
    }
  ]
}
```

See our [detailed contribution guide](CONTRIBUTING.md#updating-credit-card-information) for step-by-step instructions.

## 🛠️ For Developers: Quick Start & Contribution

<details>
<summary><strong>Click here for development setup and contribution guide</strong></summary>

### Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL (production), SQLite (development)
- **Authentication:** NextAuth.js with Google OAuth
- **Email:** Resend API for notifications
- **Deployment:** Vercel with automated cron jobs

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL (for production) or SQLite (for development)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/fantasy-cc/credit-card-tracker.git
    cd credit-card-tracker
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Set up environment variables**
    ```bash
    # Create your env file from the template and fill in values
    cp .env.example .env
    # Then edit .env with your secrets
    ```

4.  **Set up the database**
    ```bash
    # Generate Prisma client
    npx prisma generate

    # Run migrations
    npx prisma migrate dev

    # Seed the database with predefined cards
    npx prisma db seed
    ```

5.  **Start development server**
    ```bash
    npm run dev
    ```

6.  **Open your browser**
    Navigate to [http://localhost:3000](http://localhost:3000)

### Required Environment Variables

- `DATABASE_URL` - Your database connection string (production or local)
- `DATABASE_URL_DEV` - Development database branch/instance for safe local work
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for development)
- `NEXTAUTH_SECRET` - Random secret for NextAuth.js
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `CRON_SECRET` - Secret for securing cron job endpoints
- `RESEND_API_KEY` - Resend API key for email notifications
- `SERPAPI_API_KEY` - API key used by card image download script

See `.env.example` for a complete template.

### Cron Jobs: Configure & Test

The project runs two daily cron jobs (configured in `vercel.json`). Both require an Authorization header with your `CRON_SECRET`.

- Endpoint: `/api/cron/check-benefits`
- Endpoint: `/api/cron/send-notifications`

Example manual trigger (local or remote):

```bash
# Replace <url> with http://localhost:3000 or your deployed URL
curl -i -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  <url>/api/cron/check-benefits

# Notifications cron supports an optional mockDate (non-production only)
curl -i -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "<url>/api/cron/send-notifications?mockDate=2025-08-15"
```

For safety guidance around cron and database operations, see `docs/safe-migration-guide.md` and `CURSOR.md` → Deployment & Operations.

#### Vercel Cron configuration

The repository includes `vercel.json` with daily schedules. Example:

```json
{
  "crons": [
    { "path": "/api/cron/check-benefits", "schedule": "0 5 * * *" },
    { "path": "/api/cron/send-notifications", "schedule": "15 5 * * *" }
  ]
}
```

### Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.

### Database Recovery with Neon CLI

Since this project uses **Neon Database**, you have powerful recovery and investigation capabilities through the Neon CLI. This is essential for data loss incidents or database investigations.

#### Installation & Setup

```bash
# Install Neon CLI globally
npm install -g neonctl

# Authenticate with your Neon account
neonctl auth
# Follow the prompts to log in via browser
```

#### Key Commands for Database Recovery

**List Projects and Branches:**
```bash
# List all your projects
neonctl projects list

# List branches in a specific project
neonctl branches list --project-id your-project-id
```

**Point-in-Time Recovery:**
```bash
# Create a recovery branch from a specific timestamp
neonctl branches create \
  --project-id your-project-id \
  --name recovery-branch-name \
  --parent production \
  --timestamp "2025-07-19T20:30:00Z"

# The connection string will be provided in the output
```

**Investigation Workflow:**
1. **Identify the incident time** (when data loss occurred)
2. **Create branches** at different timestamps around the incident
3. **Compare data** across branches using the provided connection strings
4. **Test with your application** by temporarily switching DATABASE_URL
5. **Recover data** by restoring from the working branch

#### Example Recovery Investigation

```bash
# Create branches for investigation
neonctl branches create --project-id abc123 --name before-incident --parent production --timestamp "2025-07-19T19:00:00Z"
neonctl branches create --project-id abc123 --name during-incident --parent production --timestamp "2025-07-19T20:30:00Z"
neonctl branches create --project-id abc123 --name after-incident --parent production --timestamp "2025-07-19T21:00:00Z"

# Each branch gives you a unique connection string to test against
# Use these in temporary scripts or update your .env temporarily
```

#### Best Practices for Data Recovery

- **Act quickly**: Neon's PITR typically covers 7-30 days
- **Create branches liberally**: They're free and instant due to copy-on-write
- **Test thoroughly**: Always verify data integrity before final recovery
- **Document timestamps**: Keep detailed records of when incidents occurred
- **Use SQL queries**: Test specific user data with direct database queries
- **Clean up**: Delete investigation branches after recovery to stay organized

#### Emergency Recovery Steps

1. **Stop the application** to prevent further data corruption
2. **Identify the last known good timestamp**
3. **Create a recovery branch** from that timestamp
4. **Verify data integrity** in the recovery branch
5. **Switch production** to point to the recovery branch
6. **Update your main branch** with the recovered data
7. **Resume application** with verified data

**⚠️ Important**: Always test recovery branches thoroughly before switching production traffic.

</details>

## 💖 A Note from the Creator

Hi, I'm fantasy_c. I'm an indie developer passionate about creating free tools that help people improve their lives. This project was born out of my own frustration with managing credit card benefits, and I'm sharing it with the world in the hopes that it helps you too.

My goal is to build things that are genuinely useful, without ads or hidden costs. If you find this tool valuable, consider [supporting my work](https://coff.ee/fantasy_c).

## 🗺️ Roadmap

We're just getting started! Here's what's planned:

- [x] Loyalty program tracking and notifications
- [x] Progressive Web App support
- [ ] Custom card and benefit creation
- [x] Data export/import functionality (see `Settings → Data`)
- [ ] Advanced analytics and reporting
- [ ] Bank account integration
- [ ] Multi-user households

Have an idea? [Open an issue](https://github.com/fantasy-cc/credit-card-tracker/issues) and let's talk about it!

## 🧰 Helpful scripts

Common scripts to aid development and verification:

```bash
# List all predefined cards currently available
node scripts/list-available-cards.cjs

# Download a card image into public/images/cards/
node scripts/download-card-image.js --name "Chase Sapphire Preferred"

# Check DB connectivity and which database you are pointing at
node scripts/check-database-connection.js

# Validate benefit ordering and ROI logic
node scripts/test-drag-drop.cjs
node scripts/test-annual-fee-roi.cjs

# Test email sending (requires RESEND_API_KEY)
node scripts/test-email.cjs
```

Backfill utilities (for maintainers): see `scripts/august-2025-backfill-analysis.cjs` and `scripts/august-2025-backfill-executor.cjs` and `BACKFILL_REQUEST.md`.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 

Also see:
- [PRIVACY.md](PRIVACY.md)
- [TERMS.md](TERMS.md)