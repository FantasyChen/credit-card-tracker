---
name: add-new-credit-card
description: Add a new credit card to the CouponCycle application with its image and benefits. Use when the user asks to add a new card, create a card template, download a card image, or mentions adding cards like "Amex", "Chase", "Citi" to the system.
---

# Add New Credit Card to CouponCycle

This skill guides you through adding a new credit card to the application's predefined card catalog.

## When to Use

- User asks to add a new credit card to the system
- User wants to create a card template with benefits
- User needs to download a card image
- Adding support for a new card type

## Workflow

### Step 1: Gather Card Information

Before adding a card, collect this information:

1. **Card Name** (exact official name)
2. **Issuer** (American Express, Chase, Citi, Capital One, etc.)
3. **Annual Fee**
4. **Cyclical Benefits** (monthly/quarterly/yearly credits)

**Tip**: Research benefits at [US Credit Card Guide](https://www.uscreditcardguide.com/)

### Step 2: Download Card Image

Run the image download script:

```bash
# Search Google Images for the card
node scripts/download-card-image.js --name "Card Name" --list

# Download from best result
node scripts/download-card-image.js --name "Card Name"

# Or use UseYourCredits.com as source (if available)
node scripts/download-card-image.js --name "Card Name" --source useyourcredits

# Or download from a specific URL
node scripts/download-card-image.js --name "Card Name" --url "https://..."
```

**Image Location**: `public/images/cards/{slugified-card-name}.png`

### Step 3: Update Seed File

Edit `prisma/seed.ts` and add the card to the `predefinedCardsData` array:

```typescript
{
  name: 'Card Name',
  issuer: 'Issuer Name',
  annualFee: 595,
  benefits: [
    // Monthly benefit example
    {
      description: '$15 Monthly Credit (Service Name)',
      category: 'Travel',
      maxAmount: 15,
      frequency: BenefitFrequency.MONTHLY,
      percentage: 0,
      cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
      occurrencesInCycle: 1,
    },
    // Quarterly benefit example
    {
      description: '$100 Quarterly Travel Credit',
      category: 'Travel',
      maxAmount: 100,
      frequency: BenefitFrequency.QUARTERLY,
      percentage: 0,
      cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
      occurrencesInCycle: 1,
    },
    // Semi-annual benefit (Jan-Jun)
    {
      description: '$250 Hotel Credit (Jan-Jun)',
      category: 'Travel',
      maxAmount: 250,
      frequency: BenefitFrequency.YEARLY,
      percentage: 0,
      cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
      fixedCycleStartMonth: 1,
      fixedCycleDurationMonths: 6,
      occurrencesInCycle: 1,
    },
    // Semi-annual benefit (Jul-Dec)
    {
      description: '$250 Hotel Credit (Jul-Dec)',
      category: 'Travel',
      maxAmount: 250,
      frequency: BenefitFrequency.YEARLY,
      percentage: 0,
      cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
      fixedCycleStartMonth: 7,
      fixedCycleDurationMonths: 6,
      occurrencesInCycle: 1,
    },
    // Yearly benefit
    {
      description: '$200 Airline Fee Credit',
      category: 'Travel',
      maxAmount: 200,
      frequency: BenefitFrequency.YEARLY,
      percentage: 0,
      cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
      fixedCycleStartMonth: 1,
      fixedCycleDurationMonths: 12,
      occurrencesInCycle: 1,
    },
  ],
}
```

### Step 4: Apply the Seed

```bash
npx prisma db seed
```

### Step 5: Verify

```bash
# List all available cards to verify
node scripts/list-available-cards.cjs
```

## Benefit Categories

Use these standard categories:
- `Travel` - Airlines, hotels, TSA PreCheck, Uber, Lyft
- `Dining` - Restaurants, food delivery
- `Entertainment` - Streaming, events, concerts
- `Electronics` - Dell, Apple, Best Buy
- `Wellness` - Equinox, fitness memberships
- `Software` - Adobe, subscriptions
- `Business Services` - Professional services

## Benefit Inclusion Criteria

**Include:**
- Credits that reset on cycles (monthly/quarterly/yearly)
- Free nights, statement credits, points multipliers with caps

**Exclude:**
- Lounge memberships (Priority Pass, Centurion)
- Insurance benefits
- Earning rate multipliers without caps
- One-time signup bonuses
- Elite status benefits

## Common Patterns

### Calendar-Fixed Monthly
Credits that reset on the 1st of each month:
```typescript
cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
frequency: BenefitFrequency.MONTHLY,
```

### Card Anniversary Quarterly
Credits that reset every 3 months from card opening:
```typescript
cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
frequency: BenefitFrequency.QUARTERLY,
```

### Semi-Annual (Split Year)
Two separate benefits, one for each half of the year:
```typescript
// First half: Jan-Jun
fixedCycleStartMonth: 1,
fixedCycleDurationMonths: 6,

// Second half: Jul-Dec
fixedCycleStartMonth: 7,
fixedCycleDurationMonths: 6,
```

## Image Download Troubleshooting

If the automatic download fails:

1. **Try UseYourCredits source**: `--source useyourcredits`
2. **Manual URL**: Find the image manually and use `--url`
3. **Check slug mapping**: Update `USEYOURCREDITS_SLUGS` in the script
