// Script to repair Platinum cards that only have 2 benefits
// Adds missing benefits without deleting the card
const { PrismaClient, BenefitFrequency, BenefitCycleAlignment } = require('../src/generated/prisma');

const prisma = new PrismaClient();

// Import calculateBenefitCycle logic inline since we can't import TS modules
function calculateBenefitCycle(
  frequency,
  referenceDate,
  cardOpenedDate,
  cycleAlignment = 'CARD_ANNIVERSARY',
  fixedCycleStartMonth = null,
  fixedCycleDurationMonths = null
) {
  const refDate = new Date(referenceDate);
  const openedDate = new Date(cardOpenedDate);

  if (cycleAlignment === 'CALENDAR_FIXED' && fixedCycleStartMonth !== null && fixedCycleDurationMonths !== null) {
    const currentYear = refDate.getUTCFullYear();
    const currentMonth = refDate.getUTCMonth() + 1;
    
    let cycleStartYear = currentYear;
    if (currentMonth < fixedCycleStartMonth) {
      cycleStartYear = currentYear - 1;
    }
    
    const cycleStartDate = new Date(Date.UTC(cycleStartYear, fixedCycleStartMonth - 1, 1));
    const cycleEndMonth = (fixedCycleStartMonth - 1 + fixedCycleDurationMonths) % 12;
    const cycleEndYear = cycleStartYear + Math.floor((fixedCycleStartMonth - 1 + fixedCycleDurationMonths) / 12);
    const cycleEndDate = new Date(Date.UTC(cycleEndYear, cycleEndMonth, 0, 23, 59, 59, 999));
    
    if (refDate > cycleEndDate) {
      const nextCycleStartYear = cycleStartYear + 1;
      const nextCycleStartDate = new Date(Date.UTC(nextCycleStartYear, fixedCycleStartMonth - 1, 1));
      const nextCycleEndMonth = (fixedCycleStartMonth - 1 + fixedCycleDurationMonths) % 12;
      const nextCycleEndYear = nextCycleStartYear + Math.floor((fixedCycleStartMonth - 1 + fixedCycleDurationMonths) / 12);
      const nextCycleEndDate = new Date(Date.UTC(nextCycleEndYear, nextCycleEndMonth, 0, 23, 59, 59, 999));
      return { cycleStartDate: nextCycleStartDate, cycleEndDate: nextCycleEndDate };
    }
    
    return { cycleStartDate, cycleEndDate };
  }

  // CARD_ANNIVERSARY logic
  const openedDay = openedDate.getUTCDate();
  const openedMonth = openedDate.getUTCMonth();
  const openedYear = openedDate.getUTCFullYear();

  if (frequency === 'MONTHLY') {
    const currentMonth = refDate.getUTCMonth();
    const currentYear = refDate.getUTCFullYear();
    const cycleStartDate = new Date(Date.UTC(currentYear, currentMonth, openedDay));
    if (cycleStartDate > refDate) {
      cycleStartDate.setUTCMonth(cycleStartDate.getUTCMonth() - 1);
    }
    const cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + 1);
    cycleEndDate.setUTCDate(cycleEndDate.getUTCDate() - 1);
    cycleEndDate.setUTCHours(23, 59, 59, 999);
    return { cycleStartDate, cycleEndDate };
  }

  if (frequency === 'YEARLY') {
    let cycleStartYear = refDate.getUTCFullYear();
    const thisYearAnniversary = new Date(Date.UTC(cycleStartYear, openedMonth, openedDay));
    if (refDate < thisYearAnniversary) {
      cycleStartYear--;
    }
    const cycleStartDate = new Date(Date.UTC(cycleStartYear, openedMonth, openedDay));
    const cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setUTCFullYear(cycleEndDate.getUTCFullYear() + 1);
    cycleEndDate.setUTCDate(cycleEndDate.getUTCDate() - 1);
    cycleEndDate.setUTCHours(23, 59, 59, 999);
    return { cycleStartDate, cycleEndDate };
  }

  if (frequency === 'QUARTERLY') {
    const monthsSinceOpened = (refDate.getUTCFullYear() - openedYear) * 12 + (refDate.getUTCMonth() - openedMonth);
    const quartersSinceOpened = Math.floor(monthsSinceOpened / 3);
    const cycleStartDate = new Date(Date.UTC(openedYear, openedMonth + quartersSinceOpened * 3, openedDay));
    if (cycleStartDate > refDate) {
      cycleStartDate.setUTCMonth(cycleStartDate.getUTCMonth() - 3);
    }
    const cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + 3);
    cycleEndDate.setUTCDate(cycleEndDate.getUTCDate() - 1);
    cycleEndDate.setUTCHours(23, 59, 59, 999);
    return { cycleStartDate, cycleEndDate };
  }

  throw new Error(`Unsupported frequency: ${frequency}`);
}

async function repairIncompletePlatinumCards(dryRun = true) {
  try {
    console.log(`🔧 ${dryRun ? '[DRY RUN]' : '[EXECUTING]'} Repairing incomplete Platinum cards...\n`);

    // Find Platinum cards created after Oct 19 with less than expected benefits
    const incompleteCards = await prisma.creditCard.findMany({
      where: {
        name: {
          in: [
            'American Express Platinum Card',
            'American Express Business Platinum Card'
          ]
        },
        createdAt: {
          gte: new Date('2025-10-19T00:00:00Z')
        }
      },
      include: {
        benefits: {
          select: {
            id: true,
            description: true,
            category: true,
            frequency: true,
            maxAmount: true
          }
        },
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    const cardsToFix = incompleteCards.filter(card => {
      if (card.name === 'American Express Platinum Card' && card.benefits.length < 19) return true;
      if (card.name === 'American Express Business Platinum Card' && card.benefits.length < 10) return true;
      return false;
    });
    
    if (cardsToFix.length === 0) {
      console.log('✅ No incomplete cards found!');
      return;
    }

    console.log(`Found ${cardsToFix.length} incomplete cards to fix\n`);

    let totalFixed = 0;
    let totalBenefitsAdded = 0;

    for (const card of cardsToFix) {
      console.log(`\n📇 Processing: ${card.name}`);
      console.log(`   User: ${card.user?.email || 'unknown'}`);
      console.log(`   Current benefits: ${card.benefits.length}`);

      // Get the predefined card template
      const predefinedCard = await prisma.predefinedCard.findFirst({
        where: { name: card.name },
        include: {
          benefits: true
        }
      });

      if (!predefinedCard) {
        console.error(`   ❌ Predefined card template not found!`);
        continue;
      }

      // Find missing benefits by comparing descriptions
      const existingDescriptions = new Set(card.benefits.map(b => b.description));
      const missingBenefits = predefinedCard.benefits.filter(
        b => !existingDescriptions.has(b.description)
      );

      console.log(`   Missing benefits: ${missingBenefits.length}`);

      if (missingBenefits.length === 0) {
        console.log(`   ✅ No missing benefits`);
        continue;
      }

      // Add missing benefits
      const now = new Date();
      const openedDate = card.openedDate || new Date(Date.UTC(2024, 0, 1));

      for (const predefBenefit of missingBenefits) {
        console.log(`   + Adding: ${predefBenefit.description.substring(0, 60)}...`);

        if (!dryRun) {
          try {
            // Create the benefit
            const newBenefit = await prisma.benefit.create({
              data: {
                creditCardId: card.id,
                category: predefBenefit.category,
                description: predefBenefit.description,
                percentage: predefBenefit.percentage,
                maxAmount: predefBenefit.maxAmount,
                frequency: predefBenefit.frequency,
                cycleAlignment: predefBenefit.cycleAlignment,
                fixedCycleStartMonth: predefBenefit.fixedCycleStartMonth,
                fixedCycleDurationMonths: predefBenefit.fixedCycleDurationMonths,
                occurrencesInCycle: predefBenefit.occurrencesInCycle,
                startDate: now,
              }
            });

            // Calculate cycle and create initial benefit status
            const cycleInfo = calculateBenefitCycle(
              newBenefit.frequency,
              now,
              openedDate,
              newBenefit.cycleAlignment,
              newBenefit.fixedCycleStartMonth,
              newBenefit.fixedCycleDurationMonths
            );

            const occurrences = newBenefit.occurrencesInCycle || 1;
            for (let occurrenceIndex = 0; occurrenceIndex < occurrences; occurrenceIndex++) {
              await prisma.benefitStatus.create({
                data: {
                  benefitId: newBenefit.id,
                  userId: card.userId,
                  cycleStartDate: cycleInfo.cycleStartDate,
                  cycleEndDate: cycleInfo.cycleEndDate,
                  occurrenceIndex: occurrenceIndex,
                  isCompleted: false,
                }
              });
            }

            totalBenefitsAdded++;
          } catch (error) {
            console.error(`      ❌ Failed to add benefit: ${error.message}`);
          }
        }
      }

      totalFixed++;
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Cards processed: ${totalFixed}`);
    if (!dryRun) {
      console.log(`   Benefits added: ${totalBenefitsAdded}`);
      console.log(`   ✅ Repair complete!`);
    } else {
      console.log(`   Benefits would be added: ${totalBenefitsAdded}`);
      console.log(`\n💡 Run with --force to execute the repair`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check command line arguments
const dryRun = !process.argv.includes('--force');
repairIncompletePlatinumCards(dryRun);

