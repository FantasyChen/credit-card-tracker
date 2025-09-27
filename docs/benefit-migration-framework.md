# Benefit Migration Framework

A comprehensive, automated framework for safely updating credit card benefits while preserving user data and minimizing errors.

## 🎯 Why This Framework?

The previous manual migration process was error-prone and required:
1. Manual two-step process (update templates + migrate users)
2. Writing custom migration scripts for each change
3. Risk of data loss or incorrect benefit cycles
4. Promise.all failures causing missing benefit statuses
5. No standardized testing or validation

This framework solves these problems with automation, validation, and safety features.

## 🏗️ Architecture Overview

```
📁 src/lib/benefit-migration/
├── types.ts              # Type definitions
├── migration-engine.ts   # Core migration logic
├── plan-builder.ts       # Fluent interface for creating plans
├── migration-cli.ts      # Command-line interface
├── validation-tools.ts   # Pre-migration validation
└── __tests__/           # Comprehensive tests

📁 scripts/
├── migrate-benefits.js   # Main migration script
└── validate-migration.js # Validation tool
```

## 🚀 Quick Start

### 1. Validate Your Migration

Always validate before running:

```bash
node scripts/validate-migration.js --migration-id=amex-plat-2025
```

### 2. Preview Changes (Dry Run)

```bash
node scripts/migrate-benefits.js --migration-id=amex-plat-2025 --dry-run
```

### 3. Execute Migration

```bash
node scripts/migrate-benefits.js --migration-id=amex-plat-2025 --force
```

## 📋 Creating Migrations

### Option 1: Using the Plan Builder (Fluent Interface)

```typescript
const plan = new MigrationPlanBuilder()
  .setMetadata({
    id: 'my-migration-2025',
    title: 'My Card 2025 Benefits Update',
    description: 'Updated benefits with new structure'
  })
  .addCardUpdate('My Card Name', 'My Issuer')
  .setAnnualFee(695)
  .setEffectiveDate(new Date('2025-01-01'))
  .addDiningBenefit({
    description: 'Monthly Dining Credit',
    percentage: 100,
    maxAmount: 25
  })
  .addQuarterlyBenefit({
    quarter: 1,
    category: 'Entertainment',
    description: 'Streaming Services',
    percentage: 100,
    maxAmount: 50
  })
  .addAnnualBenefit({
    category: 'Travel',
    description: 'Travel Credit',
    percentage: 100,
    maxAmount: 300
  })
  .finishCard()
  .build();
```

### Option 2: Using Configuration Object

```typescript
const plan = MigrationPlanBuilder.fromConfig({
  id: 'config-migration-2025',
  title: 'Configuration-Based Migration',
  description: 'Example using configuration object',
  cards: [{
    name: 'Example Card',
    issuer: 'Example Bank',
    annualFee: 550,
    benefits: [
      {
        category: 'Dining',
        description: 'Dining Credit',
        percentage: 100,
        maxAmount: 25,
        frequency: BenefitFrequency.MONTHLY,
        cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
        fixedCycleStartMonth: 1,
        fixedCycleDurationMonths: 1
      }
      // ... more benefits
    ]
  }]
});
```

### Option 3: Add to Migration Registry

Edit `scripts/migrate-benefits.js` and add your migration:

```javascript
const MIGRATION_REGISTRY = {
  'my-new-migration': createMyNewMigration,
  // ... existing migrations
};

function createMyNewMigration() {
  return MigrationPlanBuilder.fromConfig({
    // ... your migration config
  });
}
```

## 🔍 Validation System

The validation system runs comprehensive checks before migration:

### Data Integrity Checks
- ✅ Verify predefined cards exist
- ✅ Count affected users
- ✅ Check for data consistency

### Benefit Validation
- ✅ Test benefit cycle calculations
- ✅ Validate quarterly alignments (prevents Q3→Q1 bugs)
- ✅ Check schema compatibility

### User Impact Analysis
- ✅ Identify users with completed benefits
- ✅ Calculate benefit structure changes
- ✅ Assess migration scope

### Schema Compatibility
- ✅ Validate enum values
- ✅ Check required fields
- ✅ Verify data types

## 🛡️ Safety Features

### 1. Dry Run by Default
```bash
# Safe preview - no data modified
node scripts/migrate-benefits.js --migration-id=test

# Must explicitly force for live migration
node scripts/migrate-benefits.js --migration-id=test --force
```

### 2. User Action Preservation
By default, the framework preserves:
- ✅ Completed benefits (`isCompleted: true`)
- ✅ Not-usable benefits (`isNotUsable: true`)  
- ✅ User completion timestamps
- ✅ Custom order indexes

### 3. Promise.allSettled for Fault Tolerance
Uses `Promise.allSettled` instead of `Promise.all` to prevent cascading failures:

```typescript
const results = await Promise.allSettled(
  batch.map(card => this.migrateUserCard(card, cardUpdate))
);
// Individual failures don't stop the entire migration
```

### 4. Transaction Safety
Each user's migration runs in a database transaction - all operations succeed or fail together:

```typescript
await prisma.$transaction(async (tx) => {
  // Delete old benefits
  // Create new benefits  
  // Create benefit statuses
  // All succeed or all rollback
});
```

### 5. Batch Processing
Process users in configurable batches to manage memory and database load:

```bash
node scripts/migrate-benefits.js --migration-id=large-migration --batch-size=5
```

### 6. Comprehensive Validation
Built-in validation prevents common issues:
- ❌ Prevents Q3 benefits getting Q1 dates
- ❌ Catches invalid cycle alignments
- ❌ Validates schema compatibility
- ❌ Checks for missing required fields

## 📊 Example Migration Output

```
============================================================
🚀 LIVE MIGRATION: American Express Platinum 2025 Benefit Update
============================================================
📋 Description: Update Amex Platinum benefits to 2025 structure
🏷️  Version: 2025.1
📅 Created: 2025-09-27T20:30:00.000Z
🃏 Cards affected: 1
   1. American Express Platinum Card (8 benefits)

⚙️  Options:
   Batch size: 10
   Preserve user actions: true
   Validate cycles: true
   Stop on first error: false

⚠️  LIVE MODE: This will modify production data!
🛡️  User actions will be preserved (completed/not-usable benefits)
============================================================

🔍 Running pre-migration validation...

✅ Validation passed

🔍 Running pre-migration checks...
📝 Updating predefined card templates...
   ✅ Updated predefined card: American Express Platinum Card

👥 Finding existing user cards...
   Found 47 existing "American Express Platinum Card" cards to migrate
   ✅ Migrated card for user1@example.com (8 created, 6 deleted)
   ✅ Migrated card for user2@example.com (8 created, 6 deleted)
   ...

============================================================
✅ MIGRATION COMPLETED
============================================================
Affected 47 users across 47 cards. Created 376 benefits, deleted 282 benefits.

📊 Details:
   👥 Users affected: 47
   🃏 Cards affected: 47
   ➕ Benefits created: 376
   ➖ Benefits deleted: 282

🎉 Migration completed successfully!
   Users will now see the updated benefits.
```

## 🧪 Testing

### Unit Tests
```bash
npm test src/lib/benefit-migration
```

### Integration Testing
```bash
# Test with example migration (safe)
node scripts/validate-migration.js --migration-id=example-migration
node scripts/migrate-benefits.js --migration-id=example-migration --dry-run
```

### Testing New Migrations
1. Create your migration definition
2. Add to `MIGRATION_REGISTRY` 
3. Run validation: `node scripts/validate-migration.js --migration-id=your-migration`
4. Test dry run: `node scripts/migrate-benefits.js --migration-id=your-migration --dry-run`
5. Execute: `node scripts/migrate-benefits.js --migration-id=your-migration --force`

## 🔧 Advanced Options

### Batch Size Configuration
```bash
# Process users in smaller batches
node scripts/migrate-benefits.js --migration-id=large-migration --batch-size=3
```

### Error Handling
```bash
# Stop on first error (easier debugging)
node scripts/migrate-benefits.js --migration-id=test --stop-on-error

# Continue through errors (default)
node scripts/migrate-benefits.js --migration-id=test
```

### Disable Safety Features (Not Recommended)
```bash
# Replace ALL benefits (ignores completed/not-usable status)
node scripts/migrate-benefits.js --migration-id=test --no-preserve-user-actions --force

# Skip cycle validation
node scripts/migrate-benefits.js --migration-id=test --no-validate-cycles --force

# Skip pre-migration validation
node scripts/migrate-benefits.js --migration-id=test --skip-validation --force
```

## 🚨 Common Migration Patterns

### Monthly Benefits
```typescript
.addDiningBenefit({
  description: 'Monthly Dining Credit',
  percentage: 100,
  maxAmount: 25,
  frequency: BenefitFrequency.MONTHLY // Auto-configures CALENDAR_FIXED
})
```

### Quarterly Benefits (Properly Aligned)
```typescript
.addQuarterlyBenefit({
  quarter: 3, // Q3: Jul-Sep
  category: 'Entertainment',
  description: 'Streaming Credit',
  percentage: 100,
  maxAmount: 50
})
```

### Annual Anniversary Benefits
```typescript
.addAnnualBenefit({
  category: 'Travel',
  description: 'Annual Travel Credit',
  percentage: 100,
  maxAmount: 300
})
```

### One-time Benefits
```typescript
.addOneTimeBenefit({
  category: 'Welcome',
  description: 'Welcome Bonus',
  percentage: 100,
  maxAmount: 500
})
```

## 🐛 Troubleshooting

### Validation Failures
1. Run `node scripts/validate-migration.js --migration-id=your-migration`
2. Fix reported issues
3. Re-validate until all checks pass

### Migration Errors
1. Check error logs for specific failure reasons
2. Use `--batch-size=1` to isolate problematic users
3. Use `--stop-on-first-error` for easier debugging
4. Check database connection and permissions

### Quarterly Benefit Issues
The framework prevents the Q3→Q1 date assignment bug:
- ✅ Q1 benefits: fixedCycleStartMonth = 1
- ✅ Q2 benefits: fixedCycleStartMonth = 4  
- ✅ Q3 benefits: fixedCycleStartMonth = 7
- ✅ Q4 benefits: fixedCycleStartMonth = 10

## 🔄 Migration Workflow Best Practices

1. **Plan → Validate → Test → Execute**
   ```bash
   # 1. Create migration definition
   # 2. Validate
   node scripts/validate-migration.js --migration-id=new-migration
   
   # 3. Test with dry run
   node scripts/migrate-benefits.js --migration-id=new-migration --dry-run
   
   # 4. Execute
   node scripts/migrate-benefits.js --migration-id=new-migration --force
   ```

2. **Use Development Database First**
   - Test on development branch before production
   - Verify all edge cases work correctly

3. **Monitor During Execution**
   - Watch logs for errors or warnings
   - Check affected user count matches expectations

4. **Verify After Migration**
   - Spot-check user accounts for correct benefits
   - Verify benefit cycles are correctly calculated
   - Confirm completed benefits were preserved

## 🎉 Benefits of the New Framework

✅ **Automated Two-Step Process**: No more forgetting to migrate existing users  
✅ **Comprehensive Validation**: Catches issues before data modification  
✅ **Fault Tolerant**: Individual failures don't break entire migration  
✅ **User Data Protection**: Preserves completed benefits by default  
✅ **Standardized**: Consistent process for all benefit updates  
✅ **Well Tested**: Comprehensive test suite prevents regressions  
✅ **Easy to Use**: Fluent interface makes migration definition simple  
✅ **Safe by Default**: Dry run mode prevents accidental data loss

This framework transforms error-prone manual migrations into safe, automated operations that protect user data while ensuring benefit updates are applied correctly across all users.
