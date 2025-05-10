import { PrismaClient, BenefitFrequency, CreditCard as PrismaCreditCard, PredefinedCard as PrismaPredefinedCard, BenefitCycleAlignment } from '../src/generated/prisma'; // Adjust path if necessary

const prisma = new PrismaClient();

// Define the structure for benefit objects in the seed data
interface BenefitInput {
  category: string;
  description: string;
  percentage: number;
  maxAmount: number;
  frequency: BenefitFrequency;
  cycleAlignment?: BenefitCycleAlignment; // Optional
  fixedCycleStartMonth?: number;          // Optional, 1-12
  fixedCycleDurationMonths?: number;     // Optional
}

async function main() {
  console.log(`Start seeding ...`);

  const predefinedCardsData: Array<Omit<PrismaPredefinedCard, 'id' | 'createdAt' | 'updatedAt'> & { benefits: BenefitInput[] }> = [
    {
      name: 'Chase Sapphire Preferred',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/chase-sapphire-preferred.png',
      benefits: [
        {
          description: '$50 Annual Hotel Credit (Booked through Chase Travel)',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          // cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY (default)
        },
      ],
    },
    {
      name: 'American Express Gold Card',
      issuer: 'American Express',
      annualFee: 250,
      imageUrl: '/images/cards/american-express-gold-card.png',
      benefits: [
        {
          description: '$10 Monthly Uber Cash',
          category: 'Travel',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Dining Credit (e.g., Grubhub, Cheesecake Factory)',
          category: 'Dining',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$7 Monthly Dunkin Credit',
          category: 'Dining',
          maxAmount: 7,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$50 Resy Credit (Jan-Jun)',
          category: 'Dining',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, // This specific credit occurs once a year in this window
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$50 Resy Credit (Jul-Dec)',
          category: 'Dining',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, // This specific credit occurs once a year in this window
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
      ],
    },
    {
      name: 'Capital One Venture X',
      issuer: 'Capital One',
      annualFee: 395,
      imageUrl: '/images/cards/capital-one-venture-x.png',
      benefits: [
        {
          description: '$300 Annual Travel Credit (via Capital One Travel)',
          category: 'Travel',
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '10,000 Anniversary Bonus Miles',
          category: 'Bonus',
          maxAmount: 0, 
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase Sapphire Reserve',
      issuer: 'Chase',
      annualFee: 550,
      imageUrl: '/images/cards/chase-sapphire-reserve.jpg',
      benefits: [
        {
          description: '$300 Annual Travel Credit',
          category: 'Travel',
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$5 Monthly DoorDash Credit',
          category: 'Food Delivery',
          maxAmount: 5,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase Ink Business Preferred',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/chase-ink-business-preferred.png',
      benefits: [],
    },
    {
      name: 'American Express Platinum Card',
      issuer: 'American Express',
      annualFee: 695,
      imageUrl: '/images/cards/american-express-platinum-card.png',
      benefits: [
        {
          description: '$200 Airline Fee Credit (Incidental Fees, select one airline)',
          category: 'Travel',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$15 Monthly Uber Cash ($35 in December)', 
          category: 'Travel',
          maxAmount: 15, 
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$20 Additional Uber Cash (December)', 
          category: 'Travel',
          maxAmount: 20,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED, // Specific to December
          fixedCycleStartMonth: 12, // December
          fixedCycleDurationMonths: 1, // For the month of December
        },
        {
          description: '$50 Saks Fifth Avenue Credit (Jan-Jun)',
          category: 'Shopping',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$50 Saks Fifth Avenue Credit (Jul-Dec)',
          category: 'Shopping',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$20 Monthly Digital Entertainment Credit',
          category: 'Entertainment',
          maxAmount: 20,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$300 Equinox Credit (Annual or $25/month option)',
          category: 'Wellness',
          maxAmount: 300, 
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$13 Monthly Walmart+ Credit (Covers monthly membership cost)',
          category: 'Membership',
          maxAmount: 13, 
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$200 Annual Hotel Credit (FHR/THC prepaid bookings)',
          category: 'Travel',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$189 CLEAR Plus Credit (Annual Statement Credit)',
          category: 'Travel',
          maxAmount: 189,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'American Express Business Platinum Card',
      issuer: 'American Express',
      annualFee: 695,
      imageUrl: '/images/cards/american-express-business-platinum-card.png',
      benefits: [
        {
          description: '$200 Airline Fee Credit',
          category: 'Travel',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$200 Dell Credit (Jan-Jun)',
          category: 'Electronics',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$200 Dell Credit (Jul-Dec)',
          category: 'Electronics',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$10 Monthly Wireless Credit',
          category: 'Utilities',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$90 Quarterly Indeed Credit',
          category: 'Business Services',
          maxAmount: 90,
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
        },
        {
          description: '$150 Annual Adobe Credit (select products)',
          category: 'Software',
          maxAmount: 150,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$189 CLEAR Plus Credit',
          category: 'Travel',
          maxAmount: 189,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'American Express Business Gold Card',
      issuer: 'American Express',
      annualFee: 375,
      imageUrl: '/images/cards/american-express-business-gold-card.png',
      benefits: [
        {
          description: '$20 Monthly Flexible Business Credit (FedEx, Grubhub, Office Supply)',
          category: 'Business',
          maxAmount: 20,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$155 Annual Walmart+ Membership Credit (Covers annual membership cost)',
          category: 'Membership',
          maxAmount: 155,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'Hilton Honors American Express Aspire Card',
      issuer: 'American Express',
      annualFee: 550,
      imageUrl: '/images/cards/hilton-honors-american-express-aspire-card.png',
      benefits: [
        {
          description: 'Annual Free Night Reward',
          category: 'Travel',
          maxAmount: 0,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$50 Quarterly Flight Credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
        },
        {
          description: '$200 Semi-Annual Hilton Resort Credit (Jan-Jun)',
          category: 'Travel',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$200 Semi-Annual Hilton Resort Credit (Jul-Dec)',
          category: 'Travel',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$189 CLEAR Plus Credit',
          category: 'Travel',
          maxAmount: 189,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'Hilton Honors American Express Surpass Card',
      issuer: 'American Express',
      annualFee: 150,
      imageUrl: '/images/cards/hilton-honors-american-express-surpass-card.png',
      benefits: [
        {
          description: '$50 Quarterly Hilton Credit ($200 annual)',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'IHG One Rewards Premier Credit Card',
      issuer: 'Chase',
      annualFee: 99,
      imageUrl: '/images/cards/ihg-one-rewards-premier-credit-card.jpg',
      benefits: [
        {
          description: 'Annual Anniversary Free Night (up to 40k points)',
          category: 'Travel',
          maxAmount: 0, 
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'IHG One Rewards Premier Business Credit Card',
      issuer: 'Chase',
      annualFee: 99,
      imageUrl: '/images/cards/ihg-one-rewards-premier-business-credit-card.jpg',
      benefits: [
        {
          description: 'Annual Anniversary Free Night (up to 40k points)',
          category: 'Travel',
          maxAmount: 0, 
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'Marriott Bonvoy Brilliant American Express Card',
      issuer: 'American Express',
      annualFee: 650,
      imageUrl: '/images/cards/marriott-bonvoy-brilliant-american-express-card.png',
      benefits: [
        {
          description: 'Annual Free Night Award (up to 85k points)',
          category: 'Travel',
          maxAmount: 0, 
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$25 Monthly Dining Credit',
          category: 'Dining',
          maxAmount: 25,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'Marriott Bonvoy Boundless Credit Card',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/marriott-bonvoy-boundless-credit-card.png',
      benefits: [
        {
          description: 'Annual Free Night Award (up to 35k points)',
          category: 'Travel',
          maxAmount: 0, 
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'Alaska Airlines Visa Signature® credit card',
      issuer: 'Bank of America',
      annualFee: 95,
      imageUrl: '/images/cards/alaska-airlines-visa-signature-credit-card.jpeg',
      benefits: [
        {
          description: "Alaska\'s Famous Companion Fare™ (from $122)",
          category: 'Travel',
          maxAmount: 0, 
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
  ];

  // --- Upsert Logic (ensure benefits are deleted/recreated or updated properly) ---
  console.log('Starting upsert process...');
  for (const cardData of predefinedCardsData) {
    console.log(`Processing card: ${cardData.name}`);
    const existingCard = await prisma.predefinedCard.findUnique({
        where: { name: cardData.name },
        include: { benefits: true },
    });

    if (existingCard) {
        console.log(`Updating existing card: ${cardData.name}`);
        // Update card details
        await prisma.predefinedCard.update({
            where: { id: existingCard.id },
            data: {
                issuer: cardData.issuer,
                annualFee: cardData.annualFee,
                imageUrl: cardData.imageUrl,
            },
        });

        // Simple approach: Delete existing benefits and recreate them
        console.log(`Deleting ${existingCard.benefits.length} old benefits for ${cardData.name}`);
        await prisma.predefinedBenefit.deleteMany({
            where: { predefinedCardId: existingCard.id },
        });

        console.log(`Creating ${cardData.benefits.length} new benefits for ${cardData.name}`);
        if (cardData.benefits.length > 0) {
          await prisma.predefinedBenefit.createMany({
              data: cardData.benefits.map(benefit => ({
                  // Explicitly map all fields for PredefinedBenefit
                  predefinedCardId: existingCard.id,
                  category: benefit.category,
                  description: benefit.description,
                  percentage: benefit.percentage,
                  maxAmount: benefit.maxAmount,
                  frequency: benefit.frequency,
                  cycleAlignment: benefit.cycleAlignment, // Explicitly map
                  fixedCycleStartMonth: benefit.fixedCycleStartMonth, // Explicitly map
                  fixedCycleDurationMonths: benefit.fixedCycleDurationMonths, // Explicitly map
              })),
          });
        }
    } else {
        console.log(`Creating new card: ${cardData.name}`);
        // Create card and benefits together
        await prisma.predefinedCard.create({
            data: {
              name: cardData.name,
              issuer: cardData.issuer,
              annualFee: cardData.annualFee,
              imageUrl: cardData.imageUrl,
              benefits: {
                create: cardData.benefits.map(benefit => ({
                  // Ensure all fields are explicitly mapped here too for consistency
                  category: benefit.category,
                  description: benefit.description,
                  percentage: benefit.percentage,
                  maxAmount: benefit.maxAmount,
                  frequency: benefit.frequency,
                  cycleAlignment: benefit.cycleAlignment,
                  fixedCycleStartMonth: benefit.fixedCycleStartMonth,
                  fixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
                })),
              },
            },
        });
    }
     console.log(`Finished processing card: ${cardData.name}`);
  }
  console.log('Upsert process finished.');

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 