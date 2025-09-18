# Predefined Card Update Guide

## 🚨 CRITICAL: Two-Step Process for Card Benefit Changes

When updating existing card benefits (not adding new cards), you MUST complete **both steps** or users will see inconsistent data.

### Step 1: Update Predefined Card Templates (Affects New Users)
1. **Edit** `prisma/seed.ts` with the new benefit structure
2. **Test** changes: `npm run build` to verify TypeScript compilation
3. **Apply** to database: `npx prisma db seed`
4. **Verify** templates updated: `node scripts/list-available-cards.cjs`

### Step 2: Migrate Existing User Cards (Affects Current Users)
1. **Check** for existing users: `node scripts/update-[card]-benefits.js --dry-run --force`
2. **Review** migration preview carefully
3. **Execute** migration: `node scripts/update-[card]-benefits.js --force`
4. **Verify** migration: Check that users now see updated benefits

## 📋 Complete Workflow Example

### Updating Chase Sapphire Reserve Benefits

```bash
# 1. Update seed file (already done in code)
# Edit prisma/seed.ts with new benefit structure

# 2. Verify changes compile
npm run build

# 3. Update predefined card templates (affects new users)
npx prisma db seed

# 4. Check if existing users need migration
node scripts/update-csr-2025-benefits.js --dry-run --force

# 5. If users found, run migration (affects existing users)
node scripts/update-csr-2025-benefits.js --force

# 6. Verify both steps worked
node scripts/list-available-cards.cjs | grep -A 10 "Chase Sapphire Reserve"
```

## 🔍 Database Environment Safety

### Before ANY Database Operation:

1. **Check which database you're targeting:**
   ```bash
   node scripts/check-database-connection.js
   ```

2. **Environment Variable Priority:**
   ```bash
   # Shell variable overrides .env file
   echo $DATABASE_URL                    # If set, this takes priority
   cat .env | grep DATABASE_URL          # Otherwise, this is used
   ```

3. **Clear environment overrides if needed:**
   ```bash
   unset DATABASE_URL                    # Clear shell override
   node scripts/check-database-connection.js  # Should now use .env
   ```

## ⚠️ Common Issues & Solutions

### Issue: "I updated the seed but users still see old benefits"
**Problem**: Only completed Step 1, existing user cards not migrated
**Solution**: Complete Step 2 - run the migration script

### Issue: "I seeded the wrong database"
**Problem**: Environment variable override pointed to wrong database
**Solution**: 
```bash
unset DATABASE_URL
node scripts/check-database-connection.js  # Verify correct database
npx prisma db seed  # Re-seed correct database
```

### Issue: "Migration script says no cards found but users exist"
**Problem**: Connected to development branch instead of production
**Solution**: Check database connection and clear environment overrides

## 🛡️ Safety Checklist

Before modifying card benefits in production:

- [ ] Changes tested and compile successfully (`npm run build`)
- [ ] Database connection verified (`node scripts/check-database-connection.js`)
- [ ] Predefined templates updated (`npx prisma db seed`)
- [ ] Migration dry-run reviewed (`--dry-run --force`)
- [ ] Both new and existing users considered
- [ ] Migration executed if existing users found
- [ ] Changes verified in production

## 📊 Verification Commands

```bash
# Check which database you're connected to
node scripts/check-database-connection.js

# Verify predefined card templates updated
node scripts/list-available-cards.cjs | grep -A 10 "Card Name"

# Check for existing user cards that need migration
node scripts/update-[card]-benefits.js --dry-run --force

# Test that migration script has correct cycle alignment fields
grep -A 5 "cycleAlignment.*benefitData" scripts/update-*-benefits.js
```

## 🔄 Safe Database Operations Reference

### ✅ SAFE Operations (Non-Destructive)
- `npx prisma db seed` - Updates predefined card catalog
- `npx prisma migrate deploy` - Applies committed migrations
- Migration scripts with `--dry-run` - Preview changes only

### ⚠️ REQUIRES CAUTION
- Migration scripts without `--dry-run` - Modifies user data
- `npx prisma migrate dev` - Safe on development branch only

### ❌ NEVER RUN (Destructive)
- `npx prisma migrate reset` - Wipes ALL data
- `npx prisma db push --force-reset` - Force resets schema
- Any command with `--force-reset` flag

## 📝 Documentation Updates

When making card benefit changes:

1. **Update AGENT.md examples** if the change affects documented patterns
2. **Update migration script help text** to reflect new benefit structure
3. **Create or update card-specific migration scripts** if needed
4. **Document breaking changes** in commit messages

---

*This guide was created based on lessons learned from the CSR hotel credit fix. Keep it updated as the process evolves.*
