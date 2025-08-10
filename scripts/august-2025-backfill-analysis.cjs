// Load environment variables
require('dotenv').config();

const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

// Simplified benefit cycle calculation function (ported from TypeScript)
function calculateBenefitCycle(frequency, referenceDate, cardOpenedDate, cycleAlignment, fixedCycleStartMonth, fixedCycleDurationMonths) {
  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth(); // 0-indexed

  let cycleStartDate, cycleEndDate;

  if (
    cycleAlignment === 'CALENDAR_FIXED' &&
    fixedCycleStartMonth &&
    fixedCycleDurationMonths &&
    fixedCycleStartMonth >= 1 && fixedCycleStartMonth <= 12 &&
    fixedCycleDurationMonths > 0
  ) {
    // CALENDAR_FIXED Logic
    const currentYearCycleStartDate = new Date(Date.UTC(refYear, fixedCycleStartMonth - 1, 1, 0, 0, 0, 0));
    const currentYearCycleEndDate = new Date(currentYearCycleStartDate.getTime());
    currentYearCycleEndDate.setUTCMonth(currentYearCycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
    currentYearCycleEndDate.setUTCMilliseconds(currentYearCycleEndDate.getUTCMilliseconds() - 1);

    if (referenceDate <= currentYearCycleEndDate) {
      cycleStartDate = currentYearCycleStartDate;
      cycleEndDate = currentYearCycleEndDate;
    } else {
      const nextYear = refYear + 1;
      cycleStartDate = new Date(Date.UTC(nextYear, fixedCycleStartMonth - 1, 1, 0, 0, 0, 0));
      cycleEndDate = new Date(cycleStartDate.getTime());
      cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
      cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
    }
  } else {
    // CARD_ANNIVERSARY or Default Logic
    let cycleStartYear, cycleStartMonth, cycleEndYear, cycleEndMonth;

    switch (frequency) {
      case 'MONTHLY':
        cycleStartYear = refYear;
        cycleStartMonth = refMonth;
        cycleEndYear = refYear;
        cycleEndMonth = refMonth;
        break;

      case 'QUARTERLY':
        const currentQuarter = Math.floor(refMonth / 3);
        cycleStartYear = refYear;
        cycleStartMonth = currentQuarter * 3;
        cycleEndYear = refYear;
        cycleEndMonth = cycleStartMonth + 2;
        break;

      case 'YEARLY':
        if (cardOpenedDate) {
          const openedMonth = cardOpenedDate.getUTCMonth();
          if (refMonth >= openedMonth) {
            cycleStartYear = refYear;
          } else {
            cycleStartYear = refYear - 1;
          }
          cycleStartMonth = openedMonth;
          cycleEndYear = cycleStartYear + 1;
          cycleEndMonth = cycleStartMonth;
        } else {
          cycleStartYear = refYear;
          cycleStartMonth = 0; // January
          cycleEndYear = refYear;
          cycleEndMonth = 11; // December
        }
        break;

      default:
        throw new Error(`Unsupported frequency for recurring benefit cycle calculation: ${frequency}`);
    }

    if (frequency === 'YEARLY' && cardOpenedDate) {
      cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
      cycleEndDate = new Date(Date.UTC(cycleEndYear, cycleEndMonth, 1, 0, 0, 0, 0));
      cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
    } else {
      cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
      cycleEndDate = new Date(Date.UTC(cycleEndYear, cycleEndMonth + 1, 1, 0, 0, 0, 0));
      cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
    }
  }

  // Validation
  if (isNaN(cycleStartDate.getTime()) || isNaN(cycleEndDate.getTime())) {
    throw new Error("Could not calculate valid benefit cycle dates.");
  }
  if (cycleEndDate <= cycleStartDate) {
    throw new Error("Calculated cycle end date is not after cycle start date.");
  }

  return { cycleStartDate, cycleEndDate };
}

// August 2025 date range
const AUGUST_2025_START = new Date('2025-08-01T00:00:00.000Z');
const AUGUST_2025_END = new Date('2025-08-31T23:59:59.999Z');

async function analyzeAllUserBenefitStatuses() {
  console.log('🔍 Analyzing August 2025 benefit status backfill requirements for ALL USERS...\n');
  
  try {
    // Find all users with credit cards that have recurring benefits
    const users = await prisma.user.findMany({
      where: {
        creditCards: {
          some: {
            benefits: {
              some: {
                frequency: {
                  in: ['MONTHLY', 'QUARTERLY', 'YEARLY']
                }
              }
            }
          }
        }
      },
      include: {
        creditCards: {
          include: {
            benefits: {
              where: {
                frequency: {
                  in: ['MONTHLY', 'QUARTERLY', 'YEARLY']
                }
              }
            }
          }
        },
        benefitStatuses: {
          where: {
            cycleStartDate: {
              gte: AUGUST_2025_START,
              lt: new Date('2025-09-01T00:00:00.000Z')
            }
          },
          include: {
            benefit: true
          }
        }
      }
    });

    if (users.length === 0) {
      console.log('❌ No users found with recurring benefits');
      return;
    }

    console.log(`✅ Found ${users.length} users with recurring benefits:\n`);

    const analysisResults = [];
    let totalUsersProcessed = 0;
    let totalMissingGlobal = 0;

    for (const user of users) {
      totalUsersProcessed++;
      
      // Show progress for large datasets
      if (totalUsersProcessed % 25 === 0 || totalUsersProcessed <= 10) {
        console.log(`📊 Processing user ${totalUsersProcessed}/${users.length}: ${user.email}`);
      }

      const userAnalysis = {
        userId: user.id,
        email: user.email,
        cards: user.creditCards.length,
        existingAugustStatuses: user.benefitStatuses.length,
        missingBenefitStatuses: []
      };

      // Analyze each card and its benefits
      for (const card of user.creditCards) {
        // Check each benefit for missing August 2025 statuses
        for (const benefit of card.benefits) {
          try {
            // Calculate what the August 2025 cycle should be for this benefit
            const augustReferenceDate = new Date('2025-08-15T12:00:00.000Z'); // Mid-August for calculation
            const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
              benefit.frequency,
              augustReferenceDate,
              card.openedDate,
              benefit.cycleAlignment,
              benefit.fixedCycleStartMonth,
              benefit.fixedCycleDurationMonths
            );

            // Check if this cycle overlaps with August 2025
            const cycleOverlapsAugust = (
              cycleStartDate <= AUGUST_2025_END && 
              cycleEndDate >= AUGUST_2025_START
            );

            if (cycleOverlapsAugust) {
              // Check for missing benefit statuses for each occurrence
              for (let occurrenceIndex = 0; occurrenceIndex < benefit.occurrencesInCycle; occurrenceIndex++) {
                const existingStatus = user.benefitStatuses.find(bs => 
                  bs.benefitId === benefit.id && 
                  bs.cycleStartDate.getTime() === cycleStartDate.getTime() && 
                  bs.occurrenceIndex === occurrenceIndex
                );

                if (!existingStatus) {
                  const missingStatus = {
                    benefitId: benefit.id,
                    userId: user.id,
                    cycleStartDate,
                    cycleEndDate,
                    occurrenceIndex,
                    benefitDescription: benefit.description
                  };
                  userAnalysis.missingBenefitStatuses.push(missingStatus);
                }
              }
            }
          } catch (error) {
            console.log(`⚠️  Error calculating cycle for benefit ${benefit.id} (user: ${user.email}): ${error.message}`);
          }
        }
      }

      if (userAnalysis.missingBenefitStatuses.length > 0) {
        analysisResults.push(userAnalysis);
        totalMissingGlobal += userAnalysis.missingBenefitStatuses.length;
      }
    }

    // Overall summary
    console.log(`\n🎯 COMPREHENSIVE ANALYSIS RESULTS:`);
    console.log(`   Total users with recurring benefits: ${users.length}`);
    console.log(`   Users needing backfill: ${analysisResults.length}`);
    console.log(`   Total missing August 2025 benefit statuses: ${totalMissingGlobal}`);
    
    // Detailed breakdown of top users needing backfill
    if (analysisResults.length > 0) {
      console.log(`\n📊 Top 10 users needing backfill:`);
      const sortedResults = analysisResults
        .sort((a, b) => b.missingBenefitStatuses.length - a.missingBenefitStatuses.length)
        .slice(0, 10);
      
      sortedResults.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email}: ${user.missingBenefitStatuses.length} missing statuses`);
      });

      console.log(`\n✅ Ready to proceed with comprehensive backfill for ${totalMissingGlobal} missing benefit statuses`);
    } else {
      console.log(`\n🎉 No missing benefit statuses found - backfill not needed`);
    }

    return analysisResults;

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run analysis if called directly
if (require.main === module) {
  analyzeAllUserBenefitStatuses().catch(console.error);
}

module.exports = { analyzeAllUserBenefitStatuses, AUGUST_2025_START, AUGUST_2025_END }; 