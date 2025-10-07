# How to Define Seed Data for "How to Use" Guides

## Overview

The "How to Use" guides are stored in the `BenefitUsageWay` table and are defined in the seed data file: `prisma/seed.ts`. These guides provide step-by-step instructions for users to maximize their credit card benefits.

---

## Database Schema

### BenefitUsageWay Model

```typescript
model BenefitUsageWay {
  id                 String              @id @default(cuid())
  title              String              // Guide title (e.g., "How to Use Airline Fee Credits")
  slug               String              @unique // URL slug (e.g., "airline-fee-credits")
  description        String?             // Short description for preview
  content            String              // Full guide content (markdown-like format)
  category           String?             // Category (e.g., "Travel", "Dining", "Transportation")
  tips               String[]            // Array of quick tips
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  predefinedBenefits PredefinedBenefit[] // Benefits linked to this guide
}
```

### PredefinedBenefit Model (relevant field)

```typescript
model PredefinedBenefit {
  // ... other fields ...
  usageWayId         String?             // Optional link to BenefitUsageWay
  usageWay           BenefitUsageWay?    // Relation to usage guide
}
```

---

## How to Add New Usage Guides

### Step 1: Define the Guide in `prisma/seed.ts`

Location in file: Around **line 1317**

Add a new object to the `usageWays` array:

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

## What Qualifies

- ✈️ Item 1
- 💺 Item 2
- 🍽️ Item 3

## Important Notes

**Bold text for emphasis**
- Regular bullets
- More information

## Pro Tips

💡 Helpful advice here`,
    tips: [
      'Quick tip 1 - short and actionable',
      'Quick tip 2 - avoid using apostrophes without escaping',
      'Quick tip 3 - these appear in a sidebar',
      'Quick tip 4 - limit to 4-6 tips for readability'
    ]
  }
];
```

### Step 2: Link Benefits to Usage Guides (Optional)

Currently, the system uses **automatic matching** based on `category` and `description`:

```typescript
// In src/app/benefits/page.tsx (lines 62-69)
const usageWayMap = new Map<string, string>();
usageWays.forEach((way) => {
  way.predefinedBenefits.forEach((benefit) => {
    const key = `${benefit.category}:${benefit.description}`;
    usageWayMap.set(key, way.slug);
  });
});
```

**To explicitly link a benefit to a guide:**

1. Add the benefit to the `PredefinedBenefit` with `usageWayId` (requires schema update)
2. OR ensure the benefit's `category` and `description` match the usage guide's linked benefits

**Current limitation:** The seed file doesn't explicitly set `usageWayId` when creating benefits. The matching is done at runtime via the category/description mapping.

### Step 3: Run the Seed Command

```bash
# Development database
npx prisma db seed

# Production database (only if user explicitly approves)
DATABASE_URL="<production-url>" npx prisma db seed
```

---

## Content Formatting Guide

### Supported Markdown-Like Syntax

The guide content supports a simplified markdown format that's rendered by `src/app/benefits/how-to-use/[slug]/page.tsx`:

| Syntax | Result |
|--------|--------|
| `## Heading` | Large section heading |
| `**Bold text**` | **Bold text** |
| `- List item` | Bullet point |
| `1. Numbered item` | Numbered list |
| Blank line | Paragraph break |
| `💡 🚗 ✈️` | Emojis for visual interest |

### Best Practices

1. **Use clear section headings** with `##`
2. **Break content into digestible sections**:
   - Getting Started
   - Step-by-Step Instructions
   - What Qualifies / What Doesn't
   - Pro Tips / Common Mistakes
   - Timing/Expiration
3. **Use emojis sparingly** for visual markers
4. **Keep paragraphs short** (2-4 sentences max)
5. **Use lists** for easy scanning
6. **Bold important terms** like **enrollment** or **qualifying purchase**

### Content Template

```markdown
## Getting Started

Brief introduction explaining what this benefit is and how it works.

1. **Step one** - Clear action
2. **Step two** - Another action
3. **Wait for credit** - Timeline expectations

## What Qualifies

Items that qualify for the benefit:
- ✅ Item 1
- ✅ Item 2
- ✅ Item 3

## What Doesn't Qualify

Common mistakes to avoid:
- ❌ Item 1
- ❌ Item 2
- ❌ Item 3

## Important Details

- 💰 Minimum spend requirements
- ⏳ Credit posting timeline
- 📋 Documentation needed
- 🔄 Renewal/reset dates

## Pro Tips

💡 **Maximize value:**
- Strategy 1
- Strategy 2
- Strategy 3

## Common Mistakes to Avoid

⚠️ **Don't:**
- Mistake 1
- Mistake 2
- Mistake 3
```

---

## Category Guidelines

Use these standard categories for consistency:

| Category | Use For |
|----------|---------|
| `Travel` | Airlines, hotels, TSA PreCheck, Global Entry |
| `Transportation` | Uber, Lyft, parking, tolls |
| `Dining` | Restaurants, food delivery (DoorDash, Uber Eats, Grubhub) |
| `Entertainment` | Streaming services, events, concerts |
| `General` | Statement credits, miscellaneous benefits |

---

## Existing Usage Guides

Current guides in the system (as of Oct 2025):

1. **Airline Fee Credits** (`airline-fee-credits`)
   - Category: Travel
   - Covers: Baggage fees, seat upgrades, in-flight purchases

2. **Uber and Lyft Credits** (`rideshare-credits`)
   - Category: Transportation
   - Covers: Ride-sharing, Uber Cash, Uber Eats

3. **Hotel Credits** (`hotel-credits`)
   - Category: Travel
   - Covers: Hotel bookings, qualifying portals, timing

4. **Dining and Restaurant Credits** (`dining-credits`)
   - Category: Dining
   - Covers: Restaurant credits, delivery apps, merchant-specific credits

5. **Statement Credits** (`statement-credits`)
   - Category: General
   - Covers: How automatic reimbursements work, timing, tracking

---

## How the System Works

### 1. Seed Data → Database

```bash
npx prisma db seed
```
↓
Creates `BenefitUsageWay` records in the database

### 2. Runtime Matching

When a user views `/benefits`:
1. System fetches all `BenefitUsageWay` records with their linked `predefinedBenefits`
2. Creates a map: `category:description` → `slug`
3. Matches user's benefit statuses to usage guides
4. Adds `usageWaySlug` to each benefit

### 3. Display on Benefit Card

```typescript
// In BenefitCardClient.tsx (lines 143-159)
{status.usageWaySlug && (
  <Link href={`/benefits/how-to-use/${status.usageWaySlug}`}>
    How to use this benefit
  </Link>
)}
```

### 4. Guide Detail Page

Route: `/benefits/how-to-use/[slug]`
- Fetches the usage guide by slug
- Renders the markdown-like content
- Shows related credit cards
- Displays quick tips in sidebar

---

## Tips for Writing Good Guides

### ✅ DO:
- Start with the most important information (how to activate/use)
- Include specific examples and dollar amounts
- Mention timing expectations (when credits post)
- Explain common pitfalls and how to avoid them
- Link to official card issuer terms when relevant
- Use consistent formatting across all guides

### ❌ DON'T:
- Use complex nested formatting (not supported)
- Include JavaScript or HTML (security risk)
- Make assumptions about user knowledge
- Forget to mention expiration/reset dates
- Use inconsistent terminology across guides

---

## Testing Your Guide

1. **Add the guide** to `prisma/seed.ts`
2. **Run seed command**: `npx prisma db seed`
3. **Start dev server**: `npm run dev`
4. **Navigate to**: http://localhost:3000/benefits/how-to-use/[your-slug]
5. **Verify**:
   - Content renders correctly
   - Links work properly
   - Tips display in sidebar
   - Related cards show up (if linked)
6. **Test on mobile** viewport for responsive design

---

## Troubleshooting

### Guide doesn't appear on benefit cards

**Cause:** No benefits are linked to this usage guide via `category:description` matching

**Fix:** 
1. Check that `predefinedBenefits` exist with matching category and description
2. OR update the benefit's category/description to match the guide
3. Re-run seed: `npx prisma db seed`

### Content formatting looks wrong

**Cause:** Unsupported markdown syntax

**Fix:** Stick to supported syntax:
- `##` for headings
- `**text**` for bold
- `-` for bullets
- `1.` for numbered lists
- Blank lines for paragraphs

### Guide slug conflict

**Cause:** Slug must be unique

**Fix:** Change the slug to something unique (e.g., `airline-credits-v2`)

---

## Example: Adding a New Guide

Let's add a guide for "TSA PreCheck and Global Entry Credits":

```typescript
{
  title: 'How to Use TSA PreCheck and Global Entry Credits',
  slug: 'tsa-precheck-global-entry',
  description: 'Get reimbursed for trusted traveler program enrollment fees',
  category: 'Travel',
  content: `## What Are These Programs?

**TSA PreCheck** and **Global Entry** are trusted traveler programs that expedite airport security:

- **TSA PreCheck**: Domestic flights, $78-85 for 5 years
- **Global Entry**: International + TSA PreCheck, $100 for 5 years
- **Clear**: Alternative program, $189/year

## How to Get Reimbursed

1. **Enroll in the program** - Visit TSA.gov or CBP.gov
2. **Pay the fee** with your enrolled credit card
3. **Credit posts** within 1-2 billing cycles
4. **Reimbursement amount** varies by card ($100-120 typically)

## Enrollment Process

**For TSA PreCheck:**
1. Apply online at TSA.gov
2. Schedule in-person appointment
3. Pay $78-85 application fee
4. Receive Known Traveler Number (KTN)

**For Global Entry:**
1. Apply online at CBP.gov
2. Complete interview at enrollment center
3. Pay $100 application fee
4. Use at airports and border crossings

## Credit Timing

- Credit typically posts within **1-2 billing cycles**
- Some cards reimburse up to **$120** (covers Global Entry + overage)
- Reimbursement is **per person** on some cards
- Check your card's specific terms

## Pro Tips

💡 **Choose Global Entry over TSA PreCheck** - Same price ($100), includes TSA PreCheck
💡 **Use for family members** - Some cards allow multiple reimbursements
💡 **Renew early** - Apply when you have 6 months left for continuous coverage
💡 **Check application status** regularly to avoid missing interview appointments`,
  tips: [
    'Global Entry includes TSA PreCheck at similar price',
    'Credits post 1-2 billing cycles after enrollment fee',
    'Some cards reimburse for multiple family members',
    'Enroll online at TSA.gov (PreCheck) or CBP.gov (Global Entry)',
    'Benefits last 5 years - mark your calendar for renewal',
    'Schedule appointment soon after applying (can take weeks)'
  ]
}
```

Then run:
```bash
npx prisma db seed
```

The guide will be available at: `/benefits/how-to-use/tsa-precheck-global-entry`

---

## Future Enhancements

### Planned Improvements:

1. **Explicit Linking**: Update seed process to directly set `usageWayId` on `PredefinedBenefit` records
2. **Rich Media**: Support for images, videos, and external links
3. **User Contributions**: Allow users to suggest improvements to guides
4. **Versioning**: Track guide updates and notify users of changes
5. **Search**: Full-text search across all usage guides

---

## Related Files

- **Seed File**: `prisma/seed.ts` (lines 1315-1627)
- **Schema**: `prisma/schema.prisma` (lines 125-136)
- **Index Page**: `src/app/benefits/how-to-use/page.tsx`
- **Detail Page**: `src/app/benefits/how-to-use/[slug]/page.tsx`
- **Benefit Card**: `src/components/BenefitCardClient.tsx` (lines 143-159)
- **Benefits Page**: `src/app/benefits/page.tsx` (lines 50-69)

---

**Last Updated:** October 2, 2025  
**Version:** 1.0

