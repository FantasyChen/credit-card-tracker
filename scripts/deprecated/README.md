# Deprecated Migration Scripts

**⚠️ These scripts are deprecated and should not be used.**

## What Happened?

These scripts were replaced by the new **Benefit Migration Framework** which provides:
- ✅ Automated two-step process (no more manual steps)
- ✅ Comprehensive validation to prevent errors
- ✅ Fault-tolerant processing with Promise.allSettled
- ✅ Built-in safety features and user data protection
- ✅ Standardized, reusable approach for all benefit updates

## Deprecated Scripts

### `migrate-amex-2025-benefits.js`
- **Replaced by**: `scripts/migrate-benefits.js --migration-id=amex-plat-2025`
- **Issues**: Manual script, no validation, Promise.all failures
- **Status**: Use new framework instead

### `update-csr-2025-benefits.js`
- **Replaced by**: `scripts/migrate-benefits.js --migration-id=csr-2025`
- **Issues**: Custom logic, manual error handling, hard to test
- **Status**: Use new framework instead

### `migrate-chase-sapphire-reserve.js`
- **Replaced by**: `scripts/migrate-benefits.js --migration-id=csr-2025`
- **Issues**: Duplicate of CSR script, inconsistent approach
- **Status**: Use new framework instead

### `safe-migration-template.js`
- **Replaced by**: Benefit Migration Framework with built-in safety
- **Issues**: Still required manual script creation for each migration
- **Status**: Framework provides all safety features automatically

## Migration Guide

### Old Approach (Error-Prone)
```bash
# Step 1: Update seed file manually
vim prisma/seed.ts
npx prisma db seed

# Step 2: Find and run custom script
node scripts/update-csr-2025-benefits.js --dry-run --force
node scripts/update-csr-2025-benefits.js --force

# Issues:
# - Easy to forget Step 2
# - Each change needs custom script
# - No standardized validation
# - Manual error handling
```

### New Approach (Automated & Safe)
```bash
# Single command handles everything:
# 1. Updates predefined cards (templates for new users)  
# 2. Migrates existing user cards
# 3. Comprehensive validation
# 4. Fault-tolerant processing
# 5. User data protection

node scripts/migrate-benefits.js --migration-id=card-name-2025 --force
```

## Creating New Migrations

### Old Way (Manual Script Creation)
1. Copy existing migration script
2. Manually modify benefit definitions
3. Update user finding logic  
4. Handle errors manually
5. Test extensively
6. Pray it works correctly

### New Way (Framework-Based)
```javascript
// Add to scripts/migrate-benefits.js MIGRATION_REGISTRY
function createMyCard2025Migration() {
  return MigrationPlanBuilder.fromConfig({
    id: 'my-card-2025',
    title: 'My Card 2025 Benefits Update',
    description: 'Updated benefits for 2025',
    cards: [{
      name: 'My Card Name',
      issuer: 'My Issuer', 
      annualFee: 695,
      benefits: [
        // Define benefits here - framework handles everything else
      ]
    }]
  });
}
```

## Documentation Updates

All documentation has been updated to reference the new framework:
- ✅ `docs/safe-migration-guide.md` - Updated workflow
- ✅ `docs/predefined-card-update-guide.md` - New single-step process
- ✅ `docs/benefit-migration-framework.md` - Comprehensive guide
- ✅ `AGENT.md` - Updated examples

## Support

If you need to understand what an old script was doing:
1. Check the git history for the specific changes made
2. Look at the benefit definitions in the deprecated scripts
3. Convert to the new framework format using the examples in `docs/benefit-migration-framework.md`

**For all new benefit updates, use the Migration Framework.**
