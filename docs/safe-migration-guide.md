# Safe Database Migration Guide

## What Happened

The recent addition of the `orderIndex` field to the `BenefitStatus` model required a database migration. Unfortunately, due to a database drift issue, we ran `npx prisma migrate reset --force` which completely wiped all user data.

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
# ✅ SAFE: Create and apply new migration
npx prisma migrate dev --name descriptive_migration_name

# ✅ SAFE: Apply existing migrations to production
npx prisma migrate deploy

# ❌ DESTRUCTIVE: Only use in development with no important data
npx prisma migrate reset --force

# ✅ SAFE: Check what would change without applying
npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma
```

### Handling Drift

When you encounter drift (schema doesn't match migrations):

1. **First, try to resolve without reset:**
   ```bash
   npx prisma migrate resolve --applied 20250525063552_add_benefit_order_index
   ```

2. **If that doesn't work, create a new migration:**
   ```bash
   npx prisma migrate dev --name fix_drift_issue
   ```

3. **Only reset as last resort in development:**
   ```bash
   # Make sure users export their data first!
   npx prisma migrate reset --force
   ```

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