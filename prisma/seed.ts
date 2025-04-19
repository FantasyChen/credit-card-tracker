import { PrismaClient, BenefitFrequency } from '../src/generated/prisma'; // Adjust path if necessary

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const cards = [
    {
      name: 'Chase Sapphire Preferred',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/chase-sapphire-preferred.png', // Example path, adjust as needed
      benefits: [
        {
          category: 'Travel',
          description: '$50 Annual Hotel Credit',
          percentage: 0, // Not percentage based
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
        },
        {
          category: 'Dining',
          description: 'DoorDash DashPass Subscription',
          percentage: 0, // Value based, not percentage
          maxAmount: 0, // Or represent value differently
          frequency: BenefitFrequency.YEARLY, // Assuming it needs annual renewal/activation
        },
      ],
    },
    {
      name: 'American Express Gold Card',
      issuer: 'American Express',
      annualFee: 250,
      imageUrl: '/images/cards/amex-gold.png', // Example path
      benefits: [
        {
          category: 'Dining',
          description: '$10 Monthly Uber Cash',
          percentage: 0,
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
        },
        {
          category: 'Dining',
          description: '$10 Monthly Dining Credit (Grubhub, etc.)',
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
        imageUrl: '/images/cards/capital-one-venture-x.png', // Example path
        benefits: [
            {
              category: 'Travel',
              description: '$300 Annual Travel Credit (via Capital One Travel)',
              percentage: 0,
              maxAmount: 300,
              frequency: BenefitFrequency.YEARLY,
            },
            {
              category: 'Travel',
              description: '10,000 Anniversary Miles',
              percentage: 0,
              maxAmount: 10000, // Representing miles count
              frequency: BenefitFrequency.YEARLY,
            }
        ]
    }
  ];

  for (const cardData of cards) {
    const card = await prisma.predefinedCard.upsert({
      where: { name: cardData.name }, // Use name as a unique identifier for upsert
      update: {}, // No specific updates needed if found
      create: {
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
    console.log(`Created/updated card: ${card.name}`);
  }

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