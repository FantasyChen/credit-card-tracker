# Safe Database Migration Guide

## 🚨 CRITICAL WARNING - READ FIRST 🚨

**NEVER RUN THESE COMMANDS:**
- `npx prisma migrate reset` - Wipes ALL data including production
- `npx prisma migrate reset --force` - Force wipes ALL data 
- `npx prisma db push --force-reset` - Force resets database schema
- `DROP DATABASE` or similar SQL commands
- Any command with `--force-reset` flag

**INCIDENT REPORT: 2024-12-19**
During feature development, `npx prisma db push --force-reset` was accidentally run, which **completely wiped all user data** from the database. This happened despite having clear workspace rules against such commands.

**Before ANY database operation:**
1. ✅ Check DATABASE_URL environment variable
2. ✅ Confirm you're NOT connected to production database
3. ✅ Ask users to export their data if this affects production
4. ✅ Use migration files instead of reset commands
5. ✅ Always backup production data before schema changes

## What Happened

The recent addition of the `isNotUsable` field to the `BenefitStatus` model required a database migration. Unfortunately, due to a database drift issue, we ran `npx prisma db push --force-reset` which completely wiped all user data.

**The migration itself was safe** - it only added a nullable column. The data loss was caused by the reset command.

## For Users: Data Recovery Options

### Option 1: Restore from Export (If Available)
If you previously exported your data:

1. Sign in to the application
2. Go to `/settings/data`
3. Use the "Import Data" section to upload your previously exported JSON file
4. Your cards and their opening dates will be restored
5. The cron job will automatically regenerate benefit statuses within 24 hours

### Option 2: Manual Re-entry
If no export is available, you'll need to manually re-add your credit cards:

1. Go to `/cards/new`
2. Add each of your credit cards with their correct opening dates
3. Benefits will be automatically created and tracked

## For Developers: Safe Migration Practices

### 📚 Key Documentation

- **`docs/predefined-card-update-guide.md`** - Complete workflow for updating card benefits
- **Database Environment Management** - Use `node scripts/check-database-connection.js` to verify target
- **Two-Step Process** - Always update both predefined templates AND migrate existing users

### 🔄 Predefined Card Updates vs User Migrations

**Issue**: Updated seed file but users still see old benefits
**Cause**: Only updated predefined card templates, existing user cards not migrated
**Solution**: Complete both steps:
1. Update templates: `npx prisma db seed`
2. Migrate existing users: Run migration script with `--force`

### 🌟 Recommended: Use Development Branch First

**We now use Neon database branches for safe development.** Always test schema changes on your development branch before touching production.

#### Environment Setup

Your `.env` file should contain:

```bash
# Production Database (main branch) - DO NOT use for development
DATABASE_URL="postgresql://REDACTED"

# Development Database (development branch) - USE THIS for development
DATABASE_URL_DEV="postgresql://REDACTED"
```

#### Safe Development Workflow

```bash
# 1. ALWAYS switch to development branch first
export DATABASE_URL=$DATABASE_URL_DEV

# 2. Verify you're on development branch
echo "Using database: $DATABASE_URL"
npx prisma migrate status

# 3. Make your schema changes in prisma/schema.prisma

# 4. Create and test migration on development branch
npx prisma migrate dev --name your_descriptive_migration_name

# 5. Test your application thoroughly
npm run dev
npm test

# 6. When ready for production: commit migrations and push
git add prisma/migrations/
git commit -m "Add migration: your_descriptive_migration_name"
git push origin main

# 7. Vercel automatically applies migrations to production using DATABASE_URL
```

#### Why This Approach is Safe

- ✅ **Development branch is isolated** from production data
- ✅ **Easy to reset** if something goes wrong (`npx prisma migrate reset` is safe on dev branch)
- ✅ **Production data stays untouched** during development and testing
- ✅ **Vercel handles production deployment** automatically
- ✅ **Can test with realistic data** (dev branch can have copy of production data)

#### Emergency: Reset Development Branch

If your development branch gets corrupted or you need to start over:

```bash
# Switch to development branch
export DATABASE_URL=$DATABASE_URL_DEV

# Reset the development branch (SAFE - only affects development)
npx prisma migrate reset

# Re-seed with test data
npx prisma db seed
```

This will **NOT** affect your production database.

#### Quick Check: Which Database Am I Connected To?

Always verify which database you're connected to before running migrations:

```bash
# Check current DATABASE_URL
echo "Current database: $DATABASE_URL"

# Quick check if you're on development branch
if [[ $DATABASE_URL == *"$DATABASE_URL_DEV"* ]]; then
  echo "✅ Connected to DEVELOPMENT branch - safe to migrate"
else
  echo "⚠️  Connected to PRODUCTION or unknown database - DO NOT MIGRATE"
  echo "Switch to development: export DATABASE_URL=$DATABASE_URL_DEV"
fi

# Check migration status
npx prisma migrate status

# Or use our helper script
node scripts/check-database-connection.js
```

### MANDATORY Pre-Migration Checklist

Before running ANY database command, you MUST:

- [ ] **Use development branch first**: `export DATABASE_URL=$DATABASE_URL_DEV`
- [ ] **Verify you're on development branch**: Check DATABASE_URL doesn't contain production endpoint
- [ ] **Never run migrations directly on production DATABASE_URL**
- [ ] **Test thoroughly on development branch** before committing migrations
- [ ] **Use `npx prisma migrate dev`** instead of `db push` for schema changes
- [ ] **Commit migration files** and let Vercel handle production deployment

### Before Running Migrations

1. **Always backup production data first:**
   ```bash
   # For production, create a database backup
   # This depends on your database provider (Vercel Postgres, Neon, etc.)
   ```

2. **Check migration drift without resetting:**
   ```bash
   npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma
   ```

3. **Use migrate deploy for production:**
   ```bash
   npx prisma migrate deploy
   ```

### Safe Migration Commands

```bash
# ✅ SAFE: Switch to development branch first
export DATABASE_URL=$DATABASE_URL_DEV

# ✅ SAFE: Create and apply new migration on development branch
npx prisma migrate dev --name descriptive_migration_name

# ✅ SAFE: Check what would change without applying
npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma

# ✅ SAFE: Reset development branch if needed (does NOT affect production)
npx prisma migrate reset --force  # Only safe when DATABASE_URL=$DATABASE_URL_DEV

# ✅ SAFE: Production deployment (handled automatically by Vercel)
git push origin main  # Vercel runs: npx prisma migrate deploy

# ❌ DANGEROUS: Direct production migration (don't do this manually)
# export DATABASE_URL="production-url" && npx prisma migrate deploy

# ❌ EXTREMELY DESTRUCTIVE: NEVER USE THIS ON ANY ENVIRONMENT
npx prisma db push --force-reset
```

### Handling Drift

When you encounter drift (schema doesn't match migrations), **always handle this on your development branch first:**

```bash
# 1. Switch to development branch
export DATABASE_URL=$DATABASE_URL_DEV

# 2. Try to resolve without reset
npx prisma migrate resolve --applied 20250525063552_add_benefit_order_index

# 3. If that doesn't work, create a new migration
npx prisma migrate dev --name fix_drift_issue

# 4. Only reset as last resort (SAFE on development branch)
npx prisma migrate reset --force  # This only affects development branch

# 5. Re-seed development data if needed
npx prisma db seed

# 6. Test your fixes, then commit for production deployment
git add prisma/migrations/
git commit -m "Fix drift issue"
git push origin main
```

**Important:** Never try to fix drift directly on production. Always use your development branch first.

## Prevention Measures

### 1. Automated Backups
Consider implementing automated daily exports for all users:

```typescript
// Example: Daily backup cron job
export async function createDailyBackups() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true }
  });
  
  for (const user of users) {
    // Generate and store backup for each user
    const backup = await generateUserBackup(user.id);
    await storeBackup(user.email, backup);
  }
}
```

### 2. Migration Testing
Always test migrations on a copy of production data:

1. Create a staging database with production data copy
2. Run migrations on staging first
3. Verify data integrity
4. Then apply to production

### 3. User Notifications
Before major migrations, notify users to export their data:

```typescript
// Add to notification system
const migrationNotice = {
  type: 'warning',
  message: 'Scheduled maintenance on [date]. Please export your data as a precaution.',
  actionUrl: '/settings/data'
};
```

## Recovery Script

Here's a script to help users who need to re-add their cards:

```bash
# Run this to see what predefined cards are available
node scripts/list-available-cards.cjs
```

## Lessons Learned

1. **Never use `migrate reset` on production or with user data**
2. **Always backup before migrations**
3. **Test migrations on staging first**
4. **Communicate with users before major changes**
5. **The export/import system saved us - make sure users know about it**

## Current Status

- ✅ Drag-and-drop functionality is working
- ✅ Database schema is correct
- ✅ Export/import system is available for data recovery
- ❌ Previous user data was lost (can be restored from exports)
- ✅ New users can add cards normally
- ✅ Cron jobs will generate benefit statuses automatically 