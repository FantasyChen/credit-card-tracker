---
name: update-card-benefits
description: Update, add, or remove benefits from existing credit cards in CouponCycle. Use when the user asks to update card benefits, add a new benefit to a card, remove a benefit, change benefit values, or mentions annual fee updates for cards like Amex Platinum, Chase Sapphire Reserve.
---

# Update Card Benefits in CouponCycle

This skill guides you through updating benefits for existing credit cards. This is a **3-step process** to ensure all users (new and existing) see the changes.

## The Problem

When you update benefits in `prisma/seed.ts`:
- **New users** who add the card will see the changes
- **Existing users** still have the old benefit structure

This skill ensures ALL users get the updates.

## Recommended Workflow

### Step 1: Edit the Seed File

Edit `prisma/seed.ts` to add, remove, or modify benefits:

```typescript
{
  name: 'American Express Platinum Card',
  issuer: 'American Express',
  annualFee: 895, // Update annual fee if changed
  benefits: [
    // Add new benefits
    {
      description: '$100 Quarterly Resy Dining Credit',
      category: 'Dining',
      maxAmount: 100,
      frequency: BenefitFrequency.QUARTERLY,
      percentage: 0,
      cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
      occurrencesInCycle: 1,
    },
    // Keep existing benefits...
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
node scripts/update-card-benefits.js --card "Card Name" --dry-run

# Execute the update (migrates all existing users)
node scripts/update-card-benefits.js --card "Card Name" --force
```

## What the Script Does

The unified script automatically:

1. Verifies the predefined card exists
2. Finds all existing user cards for that card type
3. **Smart diff-based migration:**
   - Adds new benefits (preserves existing statuses)
   - Updates changed benefits (keeps benefit IDs)
   - Removes deprecated benefits
4. Creates benefit status records (makes benefits visible)
5. Uses transactions (rollback on failure)

## Example Commands

```bash
# Update Amex Platinum
node scripts/update-card-benefits.js \
  --card "American Express Platinum Card" \
  --dry-run

# Update Chase Sapphire Reserve
node scripts/update-card-benefits.js \
  --card "Chase Sapphire Reserve" \
  --force

# Update Amex Business Platinum
node scripts/update-card-benefits.js \
  --card "American Express Business Platinum Card" \
  --force
```

## Alternative: Advanced Migration Framework

For complex migrations involving multiple cards or custom logic:

```bash
# 1. Create migration definition in scripts/migrate-benefits.js

# 2. Validate migration
node scripts/validate-migration.js --migration-id=your-migration

# 3. Preview changes
node scripts/migrate-benefits.js --migration-id=your-migration --dry-run

# 4. Execute migration
node scripts/migrate-benefits.js --migration-id=your-migration --force
```

## Common Mistakes to Avoid

### Mistake 1: Only Running Seed
```bash
npx prisma db seed  # Only helps NEW users
```

### Mistake 2: Forgetting to Run Update Script
Without the update script, existing users won't see the changes.

### Correct Process
```bash
npx prisma db seed  # Update template
node scripts/update-card-benefits.js --card "Card Name" --force
```

## Benefit Frequency Reference

| Type | Enum | Description |
|------|------|-------------|
| Monthly | `BenefitFrequency.MONTHLY` | Resets every month |
| Quarterly | `BenefitFrequency.QUARTERLY` | Resets every 3 months |
| Yearly | `BenefitFrequency.YEARLY` | Resets once per year |
| One-time | `BenefitFrequency.ONE_TIME` | Never resets |

## Cycle Alignment Reference

| Type | Enum | Description |
|------|------|-------------|
| Calendar Fixed | `BenefitCycleAlignment.CALENDAR_FIXED` | Fixed dates (Jan 1, Apr 1, etc.) |
| Card Anniversary | `BenefitCycleAlignment.CARD_ANNIVERSARY` | Based on card opening date |

## Semi-Annual Benefits Pattern

For benefits that reset twice a year (Jan-Jun, Jul-Dec), create TWO separate benefits:

```typescript
// First half: January - June
{
  description: '$300 Hotel Credit (Jan-Jun)',
  frequency: BenefitFrequency.YEARLY,
  cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
  fixedCycleStartMonth: 1,
  fixedCycleDurationMonths: 6,
},
// Second half: July - December
{
  description: '$300 Hotel Credit (Jul-Dec)',
  frequency: BenefitFrequency.YEARLY,
  cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
  fixedCycleStartMonth: 7,
  fixedCycleDurationMonths: 6,
},
```

## Troubleshooting

### "Card not found" Error
- Check the exact card name in the database
- Card names are case-sensitive

### Users Not Seeing Benefits
- Ensure benefit statuses were created
- Users may need to refresh their browser

### Migration Failed for Some Users
- Check error messages in output
- Re-run the script to retry failed users
- Individual failures don't affect other users

## Safety Features

- **Dry Run Mode**: Always test with `--dry-run` first
- **Transaction Safety**: Changes rollback on failure
- **Progress Tracking**: See which users were migrated
- **Preserves Completed Status**: Existing completions are kept
