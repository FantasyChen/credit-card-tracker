# Predefined Card Update Guide

## 🎉 NEW: Automated Single-Step Process

**As of September 2025, the error-prone two-step process has been replaced with an automated migration framework.**

### ✅ New Approach: Single Automated Command

```bash
# 1. Validate migration
node scripts/validate-migration.js --migration-id=your-card-2025

# 2. Preview changes (dry run)
node scripts/migrate-benefits.js --migration-id=your-card-2025 --dry-run

# 3. Execute migration
node scripts/migrate-benefits.js --migration-id=your-card-2025 --force
```

**This single command automatically:**
- ✅ Updates predefined card templates (for new users)
- ✅ Migrates existing user cards (for current users) 
- ✅ Validates all benefit cycles to prevent errors
- ✅ Preserves user completed benefits
- ✅ Handles errors gracefully with fault tolerance

### ❌ Old Two-Step Process (Deprecated)

The manual process below is **deprecated** and has been moved to `scripts/deprecated/`:

~~Step 1: Update Predefined Card Templates~~  
~~Step 2: Migrate Existing User Cards~~

**Problems with old approach:**
- Easy to forget Step 2 (users see old benefits)
- Custom script needed for each change
- No standardized validation 
- Promise.all cascade failures
- Q3→Q1 cycle assignment bugs

## 📋 Complete Workflow Example

### Creating a Card Benefit Update

#### 1. Define Migration
Add your migration to `scripts/migrate-benefits.js`:

```javascript
// Add to MIGRATION_REGISTRY
const MIGRATION_REGISTRY = {
  'csr-2025-update': createCSR2025Update,
  // ... other migrations
};

function createCSR2025Update() {
  return MigrationPlanBuilder.fromConfig({
    id: 'csr-2025-update',
    title: 'Chase Sapphire Reserve 2025 Benefits Update',
    description: 'Updated CSR with enhanced travel benefits',
    cards: [{
      name: 'Chase Sapphire Reserve',
      issuer: 'Chase',
      annualFee: 795, // Updated if needed
      benefits: [
        {
          category: 'Travel',
          description: '$300 Annual Travel Credit',
          percentage: 0,
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY
        },
        // ... more benefits
      ]
    }]
  });
}
```

#### 2. Execute Migration
```bash
# Validate migration definition
node scripts/validate-migration.js --migration-id=csr-2025-update

# Preview changes
node scripts/migrate-benefits.js --migration-id=csr-2025-update --dry-run

# Execute migration
node scripts/migrate-benefits.js --migration-id=csr-2025-update --force
```

**That's it!** No manual two-step process, no custom scripts, no risk of forgetting to migrate users.

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

## ⚠️ Common Issues & Solutions (New Framework)

### Issue: "Validation failed with benefit cycle errors"
**Problem**: Quarterly benefits have wrong cycle alignment
**Solution**: 
```bash
# Review validation report
node scripts/validate-migration.js --migration-id=your-migration

# Fix benefit definitions in migration
# Example: Q3 benefits should have fixedCycleStartMonth: 7
```

### Issue: "Migration says no cards found"
**Problem**: Card name doesn't match database
**Solution**: 
```bash
# Check available cards
node scripts/list-available-cards.cjs | grep "Your Card Name"

# Verify exact card name in migration definition
```

### Issue: "Some users weren't migrated"
**Problem**: Individual user errors in batch processing
**Solution**: 
```bash
# Check error logs in migration output
# Use smaller batch size for problematic users
node scripts/migrate-benefits.js --migration-id=your-migration --batch-size=1 --force
```

### Issue: "I need to rollback a migration"
**Problem**: Migration created incorrect benefits
**Solution**: 
```bash
# Create a rollback migration with previous benefit structure
# The framework doesn't have automatic rollback, but you can create
# a new migration that restores the previous benefits
```

## 🛡️ Safety Checklist (New Framework)

Before executing benefit migrations:

- [ ] Migration definition added to `scripts/migrate-benefits.js`
- [ ] Migration validated (`node scripts/validate-migration.js --migration-id=...`)
- [ ] Database connection verified (`node scripts/check-database-connection.js`) 
- [ ] Dry run executed and reviewed (`--dry-run`)
- [ ] All validation checks passed
- [ ] Migration executed with `--force` flag
- [ ] Results verified in production

**The framework automatically handles:**
- ✅ Predefined template updates
- ✅ Existing user migrations  
- ✅ Benefit cycle validation
- ✅ User data preservation
- ✅ Error handling and reporting

## 📊 Verification Commands (New Framework)

```bash
# Check which database you're connected to
node scripts/check-database-connection.js

# List available migrations
node scripts/migrate-benefits.js --help

# Validate specific migration  
node scripts/validate-migration.js --migration-id=your-migration

# Preview migration changes
node scripts/migrate-benefits.js --migration-id=your-migration --dry-run

# Verify predefined cards after migration
node scripts/list-available-cards.cjs | grep -A 10 "Card Name"

# Check migration execution logs
# Look for success/error counts in script output
```

## 🔄 Safe Database Operations Reference

### ✅ SAFE Operations (New Framework)
- `node scripts/validate-migration.js` - Validates migration definitions
- `node scripts/migrate-benefits.js --dry-run` - Preview changes only
- `node scripts/migrate-benefits.js --force` - Execute validated migration
- `node scripts/list-available-cards.cjs` - View current card catalog

### ✅ SAFE Operations (Schema Changes)
- `npx prisma migrate deploy` - Applies committed migrations  
- `npx prisma migrate dev` - Safe on development branch only

### ⚠️ REQUIRES CAUTION
- Migration scripts without `--dry-run` - Modifies user data (but safely)
- Manual database operations outside the framework

### ❌ NEVER RUN (Destructive)
- `npx prisma migrate reset` - Wipes ALL data
- `npx prisma db push --force-reset` - Force resets schema
- Any command with `--force-reset` flag
- Old deprecated scripts in `scripts/deprecated/`

## 📝 Documentation Updates

When adding new migrations:

1. **Add migration to MIGRATION_REGISTRY** in `scripts/migrate-benefits.js`
2. **Update AGENT.md examples** if the change affects documented patterns  
3. **Document breaking changes** in commit messages
4. **Test migration thoroughly** with validation and dry-run modes

## 🚀 Benefits of New Framework

**Compared to old manual process:**
- ✅ **Eliminates Step 2 forgetting** - Automatic two-step process
- ✅ **Prevents cycle bugs** - Built-in Q3→Q1 validation  
- ✅ **Handles errors gracefully** - Promise.allSettled fault tolerance
- ✅ **Protects user data** - Preserves completed benefits by default
- ✅ **Standardizes process** - No more custom scripts for each change
- ✅ **Comprehensive testing** - Validation tools catch issues early
- ✅ **Safe by default** - Dry run mode prevents accidental changes

**Migration Evolution:**
- **Phase 1 (Deprecated)**: Manual seed + custom scripts → Error-prone
- **Phase 2 (Current)**: Automated framework → Safe, comprehensive, standardized

---

*This guide was updated September 2025 to reflect the new automated migration framework. Old manual approaches are deprecated and moved to `scripts/deprecated/`.*
