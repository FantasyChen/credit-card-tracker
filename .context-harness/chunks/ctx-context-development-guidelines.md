# 🔧 Development Guidelines


### Environment Setup

**Local Development:**
- ✅ **FULLY CONFIGURED**: The project includes a complete `.env` file with all required environment variables
- ✅ **READY TO USE**: No additional configuration needed for local development
- ✅ **AGENT NOTE**: AI agents cannot see the `.env` file directly due to security isolation, but the file exists and is fully configured
- All local commands and the application will automatically read from the existing `.env` file

**Required Environment Variables for Production:**
```bash
# Database
DATABASE_URL="postgresql://..." # Production (pooler endpoint)
DIRECT_URL="postgresql://..."   # Production (direct endpoint, for migrations)
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

> **DATABASE_URL vs DIRECT_URL**: Neon provides two endpoints: a **pooler** (`-pooler` in hostname) for application queries and a **direct** (no `-pooler`) for migrations. Prisma `migrate deploy` needs advisory locks which only work over the direct connection. The Prisma schema uses `url` for the pooler and `directUrl` for direct.

> **CRITICAL NOTE FOR AI AGENTS:** The `.env` file already exists in this repository and is fully configured with all required environment variables. AI agents cannot access it directly due to security isolation, but local commands and the app will automatically read from `.env`. Do not attempt to create or modify the `.env` file - it already exists and is properly configured.

### Database Safety Rules ⚠️

**Two-Database Setup + Direct URL:**
- `DATABASE_URL` in `.env` → Production pooler (Neon main: `ep-falling-butterfly-...-pooler`)
- `DIRECT_URL` in `.env` → Production direct (same DB, no pooler — used by `prisma migrate deploy`)
- `DATABASE_URL_DEV` in `.env` → Development (Neon dev: `ep-frosty-snowflake`)

**CRITICAL - NEVER RUN on production:**
- `npx prisma migrate reset` (wipes ALL data)
- `npx prisma db push --force-reset`
- Any command with `--force-reset`

**npm Scripts for Database Operations:**
```bash
npm run db:check          # Check both databases and migration status
npm run db:dev:migrate    # Apply pending migrations to dev DB
npm run db:dev:status     # Show dev DB migration status
npm run db:dev:seed       # Seed dev DB with predefined data
npm run db:dev:reset      # Reset dev DB (safe, dev data only)
npm run db:prod:status    # Show production DB migration status
npm run dev:devdb         # Start dev server against dev DB
```

**Safe Development Workflow (always test on dev first):**
1. `npm run db:check` — verify both databases
2. Make schema changes in `prisma/schema.prisma`
3. Create migration: `node scripts/with-dev-db.js npx prisma migrate dev --name your_migration`
4. Test on dev: `npm run dev:devdb`
5. Commit and push — Vercel applies migration to production automatically via `prisma migrate deploy`

**Explicit user-approved production changes:**
- If and only if the human user explicitly requests it, non-destructive operations are acceptable after running `npm run db:check` to confirm the target.
- Allowed non-destructive ops:
  - Seeding/upserting predefined catalog data: `npx prisma db seed`
  - Applying already-generated migrations: `npx prisma migrate deploy`
- Still forbidden on production: destructive resets, manual `DROP` statements, anything that erases user data outside of migrations.

**Database Environment Priority**: Shell variables override `.env` file. Use `unset DATABASE_URL` to clear overrides. Always verify target with `npm run db:check`.

### Adding New Credit Cards

> **Cursor Skill Available**: See `.cursor/skills/add-new-credit-card/SKILL.md` for detailed guidance.

**Quick Steps:**
1. **Research Card**: Verify benefits at [US Credit Card Guide](https://www.uscreditcardguide.com/)
2. **Download Image**: `node scripts/download-card-image.js --name "Card Name"`
3. **Update Seed**: Add card and benefits to `prisma/seed.ts`
4. **Re-seed**: `npx prisma db seed`
5. **Verify**: `node scripts/list-available-cards.cjs`

### Updating Existing Card Benefits

> **Cursor Skill Available**: See `.cursor/skills/update-card-benefits/SKILL.md` for detailed guidance.

⚠️ **CRITICAL**: Updating card benefits requires a **three-step process** to ensure all users see the changes:

1. **Update Templates** - Affects new users who add the card in the future
2. **Migrate Existing Users** - Updates cards for current users
3. **Create Benefit Statuses** - Makes benefits visible in the dashboard

**The problem we solve**: Simply updating the seed file only helps new users. Existing users won't see changes until their cards are migrated AND benefit statuses are created.

---

#### **Unified Update Script (Recommended)**

**Use this single command for the complete update process:**

```bash
# Step 1: Update prisma/seed.ts with new benefits
# (Edit the file manually to add/remove/change benefits)

# Step 2: Update the predefined template (run seed)
npx prisma db seed

# Step 3: Run unified script to complete the update
# Preview changes (dry run)
node scripts/update-card-benefits.js --card "Card Name" --dry-run

# Execute update
node scripts/update-card-benefits.js --card "Card Name" --force
```

**What the unified script does:**
1. ✅ Updates predefined card templates (for new users)
2. ✅ Migrates all existing user cards (for current users)
3. ✅ Creates benefit statuses (makes benefits visible in dashboard)
4. ✅ Transaction-safe (rollback on failure)
5. ✅ Dry run mode for safety

**Example: Adding a quarterly $50 Hilton credit to Amex Business Platinum**

```bash
# 1. Edit prisma/seed.ts - add the new benefit:
{
  description: '$50 Quarterly Hilton Credit (Hilton properties)',
  category: 'Travel',
  maxAmount: 50,
  frequency: BenefitFrequency.QUARTERLY,
  percentage: 0,
  cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
  occurrencesInCycle: 1,
}

# 2. Update template
npx prisma db seed

# 3. Preview migration
node scripts/update-card-benefits.js \
  --card "American Express Business Platinum Card" \
  --dry-run

# 4. Execute migration
node scripts/update-card-benefits.js \
  --card "American Express Business Platinum Card" \
  --force
```

---

#### **Alternative: Advanced Migration Framework**

For complex migrations involving multiple cards or custom logic, use the advanced framework:

```bash
# 1. Create migration in scripts/migrate-benefits.js
# 2. Validate migration
node scripts/validate-migration.js --migration-id=your-migration

# 3. Preview changes (dry run) 
node scripts/migrate-benefits.js --migration-id=your-migration --dry-run

# 4. Execute migration (optionally with backup)
node scripts/migrate-benefits.js --migration-id=your-migration --force
# With backup: saves affected user/card/benefit data to JSON before applying
node scripts/migrate-benefits.js --migration-id=your-migration --force --backup
node scripts/migrate-benefits.js --migration-id=your-migration --force --backup --backup-dir=./backups

# 5. Create benefit statuses (CRITICAL STEP - often forgotten!)
# Run the cron job or use the unified script
```

**Migration backup (optional):** Use `--backup` with `--force` to write a timestamped JSON file of all affected user cards, benefits, and benefit statuses before applying changes. Files are written to `./migration-backups` by default, or to `--backup-dir=DIR`. Useful for auditing or recovery.

**⚠️ Common Mistake**: The advanced framework doesn't automatically create benefit statuses. Users won't see benefits in their dashboard until statuses are created.

---

#### **Benefit Inclusion Criteria**

**Include:**
- Must have cyclical value (credits, points, free nights)
- Must reset on trackable cycles (monthly/quarterly/yearly)
- Verify with reliable sources ([US Credit Card Guide](https://www.uscreditcardguide.com/))

**Exclude:**
- Priority Pass memberships (always-on access, no cyclical reset)
- Lounge memberships (Admirals Club, Centurion Lounge access)
- Insurance benefits (travel insurance, purchase protection)
- Earning rate multipliers (3x points on dining, etc.)
- Elite status benefits (hotel/airline status)
- One-time signup bonuses

### Adding "How to Use" Guides

The system includes step-by-step guides for maximizing credit card benefits, stored in the `BenefitUsageWay` table.

#### Adding New Usage Guides

1. **Define Guide in Seed**: Add to `prisma/seed.ts` around line 1317:

```typescript
const usageWays = [
  // ... existing guides ...
  {
    title: 'How to Use [Benefit Type]',
    slug: 'benefit-type-slug',  // Must be unique, URL-friendly
    description: 'Short description for preview and SEO',
    category: 'Category Name',  // Travel, Dining, Transportation, Entertainment, General
    content: `## Section Title

Your guide content here. Supports markdown-like formatting:

1. **Numbered lists** - Step-by-step instructions
2. **Make qualifying purchase** with the enrolled card
3. **Credit posts** within 1-2 billing cycles
