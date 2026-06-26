import { PrismaClient, LoyaltyProgramType } from '../src/generated/prisma';
import { inferBenefitUsageWaySlug } from '../src/lib/benefit-usage-matching';
import { benefitUsageWays, predefinedCardsData, type StaticPredefinedBenefit } from '../src/lib/static-catalog';

const prisma = new PrismaClient();


async function main() {
  console.log(`Start seeding ...`);



  // --- Upsert Logic (ensure benefits are deleted/recreated or updated properly) ---
  console.log('Starting upsert process...');
  for (const cardData of predefinedCardsData) {
    const benefits = cardData.benefits as readonly StaticPredefinedBenefit[];
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

        console.log(`Creating ${benefits.length} new benefits for ${cardData.name}`);
        if (benefits.length > 0) {
          await prisma.predefinedBenefit.createMany({
              data: benefits.map(benefit => ({
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
                  occurrencesInCycle: benefit.occurrencesInCycle,
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
                create: benefits.map(benefit => ({
                  // Ensure all fields are explicitly mapped here too for consistency
                  category: benefit.category,
                  description: benefit.description,
                  percentage: benefit.percentage,
                  maxAmount: benefit.maxAmount,
                  frequency: benefit.frequency,
                  cycleAlignment: benefit.cycleAlignment,
                  fixedCycleStartMonth: benefit.fixedCycleStartMonth,
                  fixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
                  occurrencesInCycle: benefit.occurrencesInCycle,
                })),
              },
            },
        });
    }
     console.log(`Finished processing card: ${cardData.name}`);
  }
  console.log('Upsert process finished.');

  // === Seed Benefit Usage Ways ===
  console.log('Seeding benefit usage ways...');



  for (const way of benefitUsageWays) {
    const wayData = { ...way, tips: [...way.tips] };
    await prisma.benefitUsageWay.upsert({
      where: { slug: way.slug },
      update: wayData,
      create: wayData,
    });
  }

  console.log(`✅ Seeded ${benefitUsageWays.length} benefit usage ways.`);

  console.log('Linking predefined benefits to usage ways...');
  const usageWayRecords = await prisma.benefitUsageWay.findMany({
    select: { id: true, slug: true },
  });
  const usageWayIdBySlug = new Map(usageWayRecords.map((way) => [way.slug, way.id]));
  const predefinedBenefits = await prisma.predefinedBenefit.findMany({
    select: {
      id: true,
      category: true,
      description: true,
      predefinedCard: {
        select: { name: true },
      },
    },
  });

  let linkedUsageWays = 0;
  for (const benefit of predefinedBenefits) {
    const slug = inferBenefitUsageWaySlug({
      category: benefit.category,
      description: benefit.description,
      cardName: benefit.predefinedCard.name,
    });
    const usageWayId = usageWayIdBySlug.get(slug);
    if (!usageWayId) {
      throw new Error(`Missing BenefitUsageWay seed for slug "${slug}"`);
    }

    await prisma.predefinedBenefit.update({
      where: { id: benefit.id },
      data: { usageWayId },
    });
    linkedUsageWays += 1;
  }
  console.log(`✅ Linked ${linkedUsageWays} predefined benefits to usage ways.`);

  // --- Seed Loyalty Programs (with and without expiration) ---
  console.log('Seeding loyalty programs...');

  // Ensure expirationBasis column exists (migration 20260228000000 adds it; handles dev/prod drift)
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "expirationBasis" TEXT DEFAULT 'ACTIVITY'`
    );
  } catch {
    // Ignore if column already exists or migration handles it
  }

  const loyaltyPrograms = [
    // Airlines (with expiration)
    {
      name: 'american_aadvantage',
      displayName: 'American Airlines AAdvantage',
      type: LoyaltyProgramType.AIRLINE,
      company: 'American Airlines',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.aa.com/aadvantage',
      description: 'Points expire 24 months after earning or redeeming activity'
    },
    {
      name: 'alaska_mileage_plan',
      displayName: 'Alaska Mileage Plan',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Alaska Airlines',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.alaskaair.com/mileageplan',
      description: 'Miles expire 24 months after earning or redeeming activity'
    },
    {
      name: 'jal_mileage_bank',
      displayName: 'JAL Mileage Bank',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Japan Airlines',
      expirationMonths: 36,
      hasExpiration: true,
      expirationBasis: 'EARNING',
      website: 'https://www.jal.co.jp/jp/en/jmb/',
      description: 'Fixed expiry: miles expire 36 months after earning. Use the date of your oldest unredeemed mile batch—new activity does not extend older miles.'
    },
    {
      name: 'cathay_asia_miles',
      displayName: 'Cathay Pacific Asia Miles',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Cathay Pacific',
      expirationMonths: 18,
      hasExpiration: true,
      website: 'https://www.cathaypacific.com/asia-miles',
      description: 'Regular members: 18 months inactivity. Marco Polo Club: 36 months. Flying, partner activity, or redemptions reset the clock.'
    },
    {
      name: 'singapore_krisflyer',
      displayName: 'Singapore Airlines KrisFlyer',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Singapore Airlines',
      expirationMonths: 36,
      hasExpiration: true,
      expirationBasis: 'EARNING',
      website: 'https://www.singaporeair.com/krisflyer',
      description: 'Fixed expiry: miles expire 36 months after crediting. Use oldest earning date—new activity does not extend older batches.'
    },
    {
      name: 'british_airways_avios',
      displayName: 'British Airways Avios',
      type: LoyaltyProgramType.AIRLINE,
      company: 'British Airways',
      expirationMonths: 36,
      hasExpiration: true,
      website: 'https://www.britishairways.com/executive-club',
      description: 'Avios expire 36 months after last earning or redemption activity'
    },
    {
      name: 'emirates_skywards',
      displayName: 'Emirates Skywards',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Emirates',
      expirationMonths: 36,
      hasExpiration: true,
      website: 'https://www.emirates.com/skywards',
      description: 'Miles expire 36 months after last account activity'
    },
    {
      name: 'virgin_atlantic_flying_club',
      displayName: 'Virgin Atlantic Flying Club',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Virgin Atlantic',
      expirationMonths: 36,
      hasExpiration: true,
      website: 'https://www.virginatlantic.com/flying-club',
      description: 'Virgin Points expire 36 months after last earning or redemption activity'
    },
    {
      name: 'qatar_privilege_club',
      displayName: 'Qatar Airways Privilege Club',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Qatar Airways',
      expirationMonths: 36,
      hasExpiration: true,
      website: 'https://www.qatarairways.com/PrivilegeClub',
      description: 'Qmiles expire 36 months after last earning or redemption activity'
    },
    {
      name: 'southwest_rapid_rewards',
      displayName: 'Southwest Rapid Rewards',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Southwest Airlines',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.southwest.com/rapidrewards',
      description: 'Points expire 24 months after last activity (Basic fare: 6 months; Choice fares: 12 months)'
    },
    {
      name: 'air_canada_aeroplan',
      displayName: 'Air Canada Aeroplan',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Air Canada',
      expirationMonths: 18,
      hasExpiration: true,
      website: 'https://www.aircanada.com/aeroplan',
      description: 'Points expire 18 months after last activity (expiration currently paused until Nov 2025)'
    },

    // Airlines (never expire)
    {
      name: 'united_mileageplus',
      displayName: 'United MileagePlus',
      type: LoyaltyProgramType.AIRLINE,
      company: 'United Airlines',
      expirationMonths: null,
      hasExpiration: false,
      website: 'https://www.united.com/mileageplus',
      description: 'Miles never expire. Keep account active to avoid forfeiture.'
    },
    {
      name: 'delta_skymiles',
      displayName: 'Delta SkyMiles',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Delta Air Lines',
      expirationMonths: null,
      hasExpiration: false,
      website: 'https://www.delta.com/skymiles',
      description: 'Miles never expire due to inactivity.'
    },
    {
      name: 'jetblue_trueblue',
      displayName: 'JetBlue TrueBlue',
      type: LoyaltyProgramType.AIRLINE,
      company: 'JetBlue',
      expirationMonths: null,
      hasExpiration: false,
      website: 'https://www.jetblue.com/trueblue',
      description: 'Points never expire as long as your account remains open.'
    },

    // Hotels (with expiration)
    {
      name: 'marriott_bonvoy',
      displayName: 'Marriott Bonvoy',
      type: LoyaltyProgramType.HOTEL,
      company: 'Marriott International',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.marriott.com/bonvoy',
      description: 'Points expire 24 months after last qualifying activity'
    },
    {
      name: 'hilton_honors',
      displayName: 'Hilton Honors',
      type: LoyaltyProgramType.HOTEL,
      company: 'Hilton Worldwide',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.hilton.com/honors',
      description: 'Points expire 24 months after last earning or redemption activity'
    },
    {
      name: 'ihg_rewards',
      displayName: 'IHG One Rewards',
      type: LoyaltyProgramType.HOTEL,
      company: 'InterContinental Hotels Group',
      expirationMonths: 12,
      hasExpiration: true,
      website: 'https://www.ihg.com/rewardsclub',
      description: 'Points expire 12 months after last qualifying activity'
    },
    {
      name: 'hyatt_world',
      displayName: 'World of Hyatt',
      type: LoyaltyProgramType.HOTEL,
      company: 'Hyatt Hotels Corporation',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.hyatt.com/world-of-hyatt',
      description: 'Points expire 24 months after last qualifying activity'
    },
    {
      name: 'choice_privileges',
      displayName: 'Choice Privileges',
      type: LoyaltyProgramType.HOTEL,
      company: 'Choice Hotels',
      expirationMonths: 18,
      hasExpiration: true,
      website: 'https://www.choicehotels.com/choice-privileges',
      description: 'Points expire 18 months after last qualifying activity'
    },
    {
      name: 'accor_live_limitless',
      displayName: 'Accor Live Limitless (ALL)',
      type: LoyaltyProgramType.HOTEL,
      company: 'Accor',
      expirationMonths: 12,
      hasExpiration: true,
      website: 'https://all.accor.com',
      description: 'Points expire 12 months after last earning activity'
    },

    // Rental Cars (with expiration)
    {
      name: 'hertz_gold_plus_rewards',
      displayName: 'Hertz Gold Plus Rewards',
      type: LoyaltyProgramType.RENTAL_CAR,
      company: 'Hertz',
      expirationMonths: 12,
      hasExpiration: true,
      website: 'https://www.hertz.com/goldplusrewards',
      description: 'Points expire 12 months after last earning activity'
    },
    {
      name: 'enterprise_plus',
      displayName: 'Enterprise Plus',
      type: LoyaltyProgramType.RENTAL_CAR,
      company: 'Enterprise Rent-A-Car',
      expirationMonths: 36,
      hasExpiration: true,
      website: 'https://www.enterprise.com/plus',
      description: 'Points expire 36 months after last earning activity'
    },
    {
      name: 'avis_preferred',
      displayName: 'Avis Preferred',
      type: LoyaltyProgramType.RENTAL_CAR,
      company: 'Avis',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.avis.com/avispreferred',
      description: 'Points expire 24 months after last earning activity'
    },

    // Credit Cards (with expiration)
    {
      name: 'bank_of_america_rewards',
      displayName: 'Bank of America Travel Rewards',
      type: LoyaltyProgramType.CREDIT_CARD,
      company: 'Bank of America',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.bankofamerica.com/credit-cards/rewards/',
      description: 'Points expire 24 months after earning'
    }
  ];

  for (const program of loyaltyPrograms) {
    await prisma.loyaltyProgram.upsert({
      where: { name: program.name },
      update: program,
      create: program,
    });
  }

  console.log(`✅ Seeded ${loyaltyPrograms.length} loyalty programs`);
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
