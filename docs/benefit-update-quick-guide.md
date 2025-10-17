# Quick Guide: Updating Credit Card Benefits

This guide shows you how to add, change, or remove benefits from existing credit cards.

## 🎯 The Problem

When you update benefits in `prisma/seed.ts`, **only new users who add the card will see the changes**. Existing users still have the old benefit structure until you migrate them.

## ✅ The Solution: 3-Step Process

1. **Update Templates** - Edit seed file (affects future users)
2. **Migrate Existing Users** - Update current user cards
3. **Create Benefit Statuses** - Make benefits visible in dashboard

## 🚀 Quick Start (Recommended Method)

### Step 1: Edit the Seed File

Edit `prisma/seed.ts` and add/remove/change the benefits:

```typescript
{
  name: 'American Express Business Platinum Card',
  issuer: 'American Express',
  annualFee: 895,
  benefits: [
    // ... existing benefits ...
    
    // NEW BENEFIT: Add this
    {
      description: '$50 Quarterly Hilton Credit (Hilton properties)',
      category: 'Travel',
      maxAmount: 50,
      frequency: BenefitFrequency.QUARTERLY,
      percentage: 0,
      cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
      occurrencesInCycle: 1,
    },
  ],
}
```

### Step 2: Update the Template

```bash
npx prisma db seed
```

This updates the predefined card template for new users.

### Step 3: Run the Unified Update Script

```bash
# Preview changes (safe - no data modified)
node scripts/update-card-benefits.js \
  --card "American Express Business Platinum Card" \
  --dry-run

# Execute the update (migrates all existing users)
node scripts/update-card-benefits.js \
  --card "American Express Business Platinum Card" \
  --force
```

**That's it!** All users (new and existing) now have the updated benefits.

## 📊 What the Script Does

The unified script automatically:

1. ✅ **Verifies** the predefined card exists
2. ✅ **Finds** all existing user cards for that card type
3. ✅ **Migrates** each user's card with the new benefit structure
4. ✅ **Creates** benefit status records (makes benefits visible)
5. ✅ **Uses transactions** (rollback on failure)
6. ✅ **Shows progress** for each user

## 🔍 Example Output

```
╔═══════════════════════════════════════════════════════════╗
║   Credit Card Benefit Update Script                      ║
╚═══════════════════════════════════════════════════════════╝

🎯 Target Card: American Express Business Platinum Card
📋 Mode: LIVE UPDATE

📝 Step 1: Updating predefined card template...
   ✅ Template updated

👥 Step 2: Migrating existing user cards...
   📊 Found 75 existing user card(s)
   📊 Template has 8 benefits
   📊 User cards have 7 benefits
   🔄 Updating user cards...
   
   📊 Migration Results:
      ✅ Success: 75
      ❌ Errors: 0

📊 Step 3: Creating benefit statuses...
   📊 Found 75 benefit(s) needing status records
   ✅ Created 75 benefit status record(s)

╔═══════════════════════════════════════════════════════════╗
║   ✅ SUCCESS - All steps completed!                      ║
╚═══════════════════════════════════════════════════════════╝

🎉 All users now have the updated benefits in their dashboard!
```

## ⚠️ Common Mistakes to Avoid

### ❌ Mistake 1: Only Running Seed
```bash
# This only helps NEW users!
npx prisma db seed  # ❌ Existing users won't see changes
```

### ❌ Mistake 2: Forgetting Benefit Statuses
Without benefit statuses, users won't see benefits in their dashboard even though the benefits exist in the database.

### ✅ Correct: Use the Unified Script
```bash
npx prisma db seed  # Update template
node scripts/update-card-benefits.js --card "Card Name" --force  # Complete migration
```

## 🛡️ Safety Features

- **Dry Run Mode**: Always test with `--dry-run` first
- **Transaction Safety**: Changes rollback if any step fails
- **Progress Tracking**: See exactly which users were migrated
- **Error Handling**: Individual user failures don't stop the entire migration

## 📝 Use Cases

### Adding a New Benefit
1. Add benefit to `prisma/seed.ts`
2. Run seed: `npx prisma db seed`
3. Run migration: `node scripts/update-card-benefits.js --card "Card Name" --force`

### Removing a Benefit
1. Remove benefit from `prisma/seed.ts`
2. Run seed: `npx prisma db seed`
3. Run migration: `node scripts/update-card-benefits.js --card "Card Name" --force`

### Changing a Benefit
1. Edit benefit in `prisma/seed.ts`
2. Run seed: `npx prisma db seed`
3. Run migration: `node scripts/update-card-benefits.js --card "Card Name" --force`

## 🔧 Troubleshooting

### "Card not found" error
- Check the exact card name in the database
- Card names must match exactly (case-sensitive)

### Users not seeing benefits
- Check if benefit statuses were created
- Users may need to refresh their browser
- Check the console for any errors

### Migration failed for some users
- Check the error message
- Individual failures don't affect other users
- You can re-run the script to retry failed users

## 📚 For More Information

See `AGENTS.md` section "Updating Existing Card Benefits" for detailed documentation and advanced usage.

---

**Last Updated**: October 2025  
**Script Location**: `/scripts/update-card-benefits.js`  
**Full Documentation**: `/AGENTS.md`
