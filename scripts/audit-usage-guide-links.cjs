#!/usr/bin/env node

const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

const recurringFrequencies = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];

function isMaterialRecurringCredit(benefit) {
  const description = benefit.description.toLowerCase();
  if (!recurringFrequencies.includes(benefit.frequency)) return false;
  if (benefit.maxAmount == null || benefit.maxAmount <= 0) return false;

  return (
    description.includes('credit') ||
    description.includes('certificate') ||
    description.includes('free night') ||
    description.includes('award') ||
    description.includes('promo') ||
    description.includes('bonus') ||
    description.includes('travelbank')
  );
}

async function main() {
  const benefits = await prisma.predefinedBenefit.findMany({
    include: {
      predefinedCard: {
        select: {
          name: true,
          issuer: true,
        },
      },
      usageWay: {
        select: {
          slug: true,
        },
      },
    },
    orderBy: [
      { predefinedCard: { issuer: 'asc' } },
      { predefinedCard: { name: 'asc' } },
      { description: 'asc' },
    ],
  });

  const materialRecurringCredits = benefits.filter(isMaterialRecurringCredit);
  const missingUsageWays = materialRecurringCredits.filter((benefit) => !benefit.usageWayId);

  console.log(`Audited ${materialRecurringCredits.length} material recurring credits.`);
  console.log(`Linked to usage guides: ${materialRecurringCredits.length - missingUsageWays.length}`);
  console.log(`Missing usage guides: ${missingUsageWays.length}`);

  if (missingUsageWays.length > 0) {
    console.log('\nMissing guide links:');
    for (const benefit of missingUsageWays) {
      console.log(`- ${benefit.predefinedCard.name} (${benefit.predefinedCard.issuer}): ${benefit.description}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('Usage guide audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
