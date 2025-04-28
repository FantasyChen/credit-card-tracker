import { PrismaClient, BenefitFrequency } from '../src/generated/prisma'; // Adjust path if necessary

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const cards = [
    {
      name: 'Chase Sapphire Preferred',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/chase-sapphire-preferred.png',
      benefits: [
        {
          category: 'Travel',
          description: '$50 Annual Hotel Credit',
          percentage: 0,
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
        },
        {
          category: 'Membership',
          description: 'DoorDash DashPass Subscription',
          percentage: 0,
          maxAmount: 0, // Value is the subscription itself
          frequency: BenefitFrequency.YEARLY,
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
          category: 'Travel',
          description: '$10 Monthly Uber Cash',
          percentage: 0,
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
        },
        {
          category: 'Dining',
          description: '$10 Monthly Dining Credit',
          percentage: 0,
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
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
              category: 'Travel',
              description: '$300 Annual Travel Credit',
              percentage: 0,
              maxAmount: 300,
              frequency: BenefitFrequency.YEARLY,
            },
            {
              category: 'Points',
              description: '10,000 Anniversary Miles',
              percentage: 0,
              maxAmount: 10000,
              frequency: BenefitFrequency.YEARLY,
            }
        ]
    },
    {
        name: 'Chase Sapphire Reserve',
        issuer: 'Chase',
        annualFee: 550,
        imageUrl: '/images/cards/chase-sapphire-reserve.jpg',
        benefits: [
            {
                category: 'Travel',
                description: '$300 Annual Travel Credit',
                percentage: 0,
                maxAmount: 300,
                frequency: BenefitFrequency.YEARLY,
            },
            {
                category: 'Travel',
                description: 'Priority Pass Select Membership',
                percentage: 0,
                maxAmount: 0, // Value is the membership
                frequency: BenefitFrequency.YEARLY,
            },
        ]
    },
    {
        name: 'Chase Ink Business Preferred',
        issuer: 'Chase',
        annualFee: 95,
        imageUrl: '/images/cards/chase-ink-business-preferred.png',
        benefits: [], // No relevant cyclical benefits found
    },
    {
        name: 'American Express Platinum Card',
        issuer: 'American Express',
        annualFee: 695,
        imageUrl: '/images/cards/american-express-platinum-card.png',
        benefits: [
            {
                category: 'Travel',
                description: '$15 Monthly Uber Cash', // $200 Annually = $15/mo ($35 Dec)
                percentage: 0,
                maxAmount: 15,
                frequency: BenefitFrequency.MONTHLY,
            },
            {
                category: 'Entertainment',
                description: '$20 Monthly Digital Entertainment Credit', // $240 Annually
                percentage: 0,
                maxAmount: 20,
                frequency: BenefitFrequency.MONTHLY,
            },
            {
                category: 'Travel',
                description: '$200 Annual Airline Fee Credit',
                percentage: 0,
                maxAmount: 200,
                frequency: BenefitFrequency.YEARLY,
            },
             {
                category: 'Shopping',
                description: '$100 Annual Saks Credit (Distributed $50 semi-annually)',
                percentage: 0,
                maxAmount: 100,
                frequency: BenefitFrequency.YEARLY,
            },
             {
                category: 'Travel',
                description: '$189 CLEAR Plus Credit',
                percentage: 0,
                maxAmount: 189,
                frequency: BenefitFrequency.YEARLY,
            },
             {
                category: 'Wellness',
                description: '$300 Annual Equinox Credit',
                percentage: 0,
                maxAmount: 300,
                frequency: BenefitFrequency.YEARLY,
            },
             {
                category: 'Membership',
                description: '$155 Annual Walmart+ Credit', // Covers monthly membership
                percentage: 0,
                maxAmount: 155,
                frequency: BenefitFrequency.YEARLY,
            },
        ]
    },
    {
        name: 'American Express Business Platinum Card',
        issuer: 'American Express',
        annualFee: 695,
        imageUrl: '/images/cards/american-express-business-platinum-card.png',
        benefits: [
            {
                category: 'Business',
                description: '$400 Dell Credit ($200 semi-annually)',
                percentage: 0,
                maxAmount: 400,
                frequency: BenefitFrequency.YEARLY,
            },
            {
                category: 'Business',
                description: '$90 Indeed Credit ($360 annually)',
                percentage: 0,
                maxAmount: 360,
                frequency: BenefitFrequency.QUARTERLY,
            },
            {
                category: 'Business',
                description: '$150 Adobe Credit',
                percentage: 0,
                maxAmount: 150,
                frequency: BenefitFrequency.YEARLY,
            },
            {
                category: 'Phone',
                description: '$10 Wireless Credit',
                percentage: 0,
                maxAmount: 120,
                frequency: BenefitFrequency.MONTHLY,
            },
            {
                category: 'Travel',
                description: '$200 Annual Airline Fee Credit',
                percentage: 0,
                maxAmount: 200,
                frequency: BenefitFrequency.YEARLY,
            },
            {
                category: 'Travel',
                description: '$50 Quarterly Hilton Credit',
                percentage: 0,
                maxAmount: 200,
                frequency: BenefitFrequency.QUARTERLY,
            },
            {
                category: 'Membership',
                description: '$189 CLEAR Plus Credit',
                percentage: 0,
                maxAmount: 189,
                frequency: BenefitFrequency.YEARLY,
            },
            {
                category: 'Travel',
                description: '$100 Global Entry/TSA PreCheck Credit',
                percentage: 0,
                maxAmount: 100,
                frequency: BenefitFrequency.YEARLY, // Simplification for infrequent credit
            },
        ]
    },
     {
        name: 'American Express Business Gold Card',
        issuer: 'American Express',
        annualFee: 295,
        imageUrl: '/images/cards/american-express-business-gold-card.png',
        benefits: [
            {
                category: 'Business',
                description: '$20 Monthly Flexible Business Credit',
                percentage: 0,
                maxAmount: 240,
                frequency: BenefitFrequency.MONTHLY,
            },
            {
                category: 'Membership',
                description: '$155 Annual Walmart+ Credit',
                percentage: 0,
                maxAmount: 155, // Based on $12.95/month + tax
                frequency: BenefitFrequency.YEARLY,
            },
        ]
    },
    {
        name: 'Hilton Honors American Express Aspire Card',
        issuer: 'American Express',
        annualFee: 550,
        imageUrl: '/images/cards/hilton-honors-american-express-aspire-card.png',
        benefits: [
            {
                category: 'Travel',
                description: 'Annual Weekend Night Reward',
                percentage: 0,
                maxAmount: 0, // Represents the free night
                frequency: BenefitFrequency.YEARLY,
            },
            {
                category: 'Travel',
                description: '$400 Hilton Resort Credit ($200 semi-annually)',
                percentage: 0,
                maxAmount: 400,
                frequency: BenefitFrequency.YEARLY,
            },
             {
                category: 'Travel',
                description: '$50 Flight Credit',
                percentage: 0,
                maxAmount: 200,
                frequency: BenefitFrequency.QUARTERLY,
            },
            {
                category: 'Membership',
                description: '$189 CLEAR Plus Credit',
                percentage: 0,
                maxAmount: 189,
                frequency: BenefitFrequency.YEARLY,
            },
        ]
    },
    {
        name: 'Hilton Honors American Express Surpass Card',
        issuer: 'American Express',
        annualFee: 150,
        imageUrl: '/images/cards/hilton-honors-american-express-surpass-card.png',
        benefits: [ /* No purely cyclical credits */ ]
    },
    {
        name: 'IHG One Rewards Premier Credit Card',
        issuer: 'Chase',
        annualFee: 99,
        imageUrl: '/images/cards/ihg-one-rewards-premier-credit-card.jpg',
        benefits: [
            {
                category: 'Travel',
                description: 'Annual Anniversary Free Night',
                percentage: 0,
                maxAmount: 1,
                frequency: BenefitFrequency.YEARLY,
            },
        ]
    },
    {
        name: 'IHG One Rewards Premier Business Credit Card',
        issuer: 'Chase',
        annualFee: 99,
        imageUrl: '/images/cards/ihg-one-rewards-premier-business-credit-card.jpg',
        benefits: [
             {
                category: 'Travel',
                description: 'Annual Anniversary Free Night',
                percentage: 0,
                maxAmount: 1,
                frequency: BenefitFrequency.YEARLY,
            },
        ]
    },
    {
        name: 'Marriott Bonvoy Brilliant American Express Card',
        issuer: 'American Express',
        annualFee: 650,
        imageUrl: '/images/cards/marriott-bonvoy-brilliant-american-express-card.png',
        benefits: [
            {
                category: 'Travel',
                description: 'Annual Free Night Award (up to 85k points)',
                percentage: 0,
                maxAmount: 0, // Represents the free night
                frequency: BenefitFrequency.YEARLY,
            },
            {
                category: 'Dining',
                description: '$25 Monthly Dining Credit',
                percentage: 0,
                maxAmount: 300,
                frequency: BenefitFrequency.MONTHLY,
            },
        ]
    },
    {
        name: 'Marriott Bonvoy Boundless Credit Card',
        issuer: 'Chase',
        annualFee: 95,
        imageUrl: '/images/cards/marriott-bonvoy-boundless-credit-card.png',
        benefits: [
            {
                category: 'Travel',
                description: 'Annual Free Night Award',
                percentage: 0,
                maxAmount: 1,
                frequency: BenefitFrequency.YEARLY,
            },
        ]
    },
     {
        name: 'Alaska Airlines Visa Signature® credit card',
        issuer: 'Bank of America',
        annualFee: 95,
        imageUrl: '/images/cards/alaska-airlines-visa-signature-credit-card.jpeg',
        benefits: [
            {
                category: 'Travel',
                description: "Alaska's Famous Companion Fare™",
                percentage: 0,
                maxAmount: 1, // Represents the fare benefit
                frequency: BenefitFrequency.YEARLY,
            },
        ]
    },
  ];

  // --- Upsert Logic (ensure benefits are deleted/recreated or updated properly) ---
  console.log('Starting upsert process...');
  for (const cardData of cards) {
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