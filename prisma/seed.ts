import { PrismaClient, BenefitFrequency, CreditCard as PrismaCreditCard, PredefinedCard as PrismaPredefinedCard } from '../src/generated/prisma'; // Adjust path if necessary

const prisma = new PrismaClient();

// Define the structure for benefit objects in the seed data
interface BenefitInput {
  category: string;
  description: string;
  percentage: number;
  maxAmount: number;
  frequency: BenefitFrequency;
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
          description: '$50 Annual Hotel Credit', // Booked through Chase Travel
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Gopuff Credit',
          category: 'Food Delivery',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: 'DoorDash DashPass Subscription', // Free for at least 1 year
          category: 'Membership',
          maxAmount: 0, // Value is the subscription itself
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
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
        // Removed $7 Dunkin, $50 Resy as these are often promotional / opt-in and not as universal as Uber/Dining. Kept it simple for now.
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
          maxAmount: 0, // Value is in miles
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
          description: 'Priority Pass Select Membership',
          category: 'Travel',
          maxAmount: 0, // Value is the membership
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
      benefits: [
        // No purely "coupon-book" style cyclical monetary credits identified.
        // Primary benefits are points earning and travel/purchase protections.
      ],
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
          description: '$15 Monthly Uber Cash ($35 in December)', // Base amount
          category: 'Travel',
          maxAmount: 15, // Monthly base
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$20 Additional Uber Cash (December)', // December Bonus
          category: 'Travel',
          maxAmount: 20,
          frequency: BenefitFrequency.YEARLY, // This specific bonus amount is once a year in Dec
          percentage: 0,
        },
        {
          description: '$50 Saks Fifth Avenue Credit (Jan-Jun)',
          category: 'Shopping',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, // This specific window is once per year
          percentage: 0,
        },
        {
          description: '$50 Saks Fifth Avenue Credit (Jul-Dec)',
          category: 'Shopping',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, // This specific window is once per year
          percentage: 0,
        },
        {
          description: '$20 Monthly Digital Entertainment Credit',
          category: 'Entertainment',
          maxAmount: 20,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$300 Equinox Credit (Annual or $25/month)',
          category: 'Wellness',
          maxAmount: 300, // Representing as annual, user can track monthly usage
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$13 Monthly Walmart+ Credit (covers monthly membership)',
          category: 'Membership',
          maxAmount: 13, // Approx. $12.95 + tax
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
        },
        {
          description: '$200 Dell Credit (Jul-Dec)',
          category: 'Electronics',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
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
      annualFee: 375, // Fee increased from $295
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
          description: 'Hilton Diamond Status',
          category: 'Travel',
          maxAmount: 0, // Status itself
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: 'Annual Free Night Reward',
          category: 'Travel',
          maxAmount: 0, // Represents the free night
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
          description: '$200 Hilton Resort Credit (Statement Credit, 1st Half of Year)',
          category: 'Travel',
          maxAmount: 200, // Value of credit per half
          frequency: BenefitFrequency.YEARLY, // For this specific semi-annual portion
          percentage: 0,
        },
        {
          description: '$200 Hilton Resort Credit (Statement Credit, 2nd Half of Year)',
          category: 'Travel',
          maxAmount: 200, // Value of credit per half
          frequency: BenefitFrequency.YEARLY, // For this specific semi-annual portion
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
        // Free Night Reward after $15k spend is conditional, not a direct cyclical benefit.
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
          maxAmount: 0, // Represents the free night
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
          maxAmount: 0, // Represents the free night
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
          maxAmount: 0, // Represents the free night
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
          maxAmount: 0, // Represents the free night
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
          description: "Alaska's Famous Companion Fare™ (from $122)",
          category: 'Travel',
          maxAmount: 0, // Represents the fare benefit itself, cost varies
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
        // More complex: Diff and update/create/delete individual benefits
        console.log(`Deleting ${existingCard.benefits.length} old benefits for ${cardData.name}`);
        await prisma.predefinedBenefit.deleteMany({
            where: { predefinedCardId: existingCard.id },
        });

        console.log(`Creating ${cardData.benefits.length} new benefits for ${cardData.name}`);
        if (cardData.benefits.length > 0) {
          await prisma.predefinedBenefit.createMany({
              data: cardData.benefits.map(benefit => ({
                  ...benefit,
                  predefinedCardId: existingCard.id,
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
            category: benefit.category,
            description: benefit.description,
            percentage: benefit.percentage,
            maxAmount: benefit.maxAmount,
            frequency: benefit.frequency,
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