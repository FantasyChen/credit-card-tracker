// Load environment variables
require('dotenv').config();

const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function testAnnualFeeROI() {
  console.log('🧮 Testing Annual Fee ROI Calculations\n');
  
  try {
    // Get a sample user
    const sampleUser = await prisma.user.findFirst({
      include: {
        creditCards: {
          include: {
            benefits: true
          }
        }
      }
    });

    if (!sampleUser) {
      console.log('❌ No users found');
      return;
    }

    console.log(`👤 Testing with user: ${sampleUser.email}`);
    console.log(`💳 User has ${sampleUser.creditCards.length} cards`);

    // Calculate annual fees for user's cards
    const userCardNames = sampleUser.creditCards.map(card => card.name);
    const predefinedCards = await prisma.predefinedCard.findMany({
      where: {
        name: { in: userCardNames }
      }
    });

    const totalAnnualFees = predefinedCards.reduce((total, card) => {
      return total + card.annualFee;
    }, 0);

    console.log('\n💰 Annual Fee Breakdown:');
    console.log('─'.repeat(40));
    predefinedCards.forEach(card => {
      const userCardCount = sampleUser.creditCards.filter(uc => uc.name === card.name).length;
      const totalFeeForCard = card.annualFee * userCardCount;
      console.log(`${card.name}: $${card.annualFee} × ${userCardCount} = $${totalFeeForCard}`);
    });
    console.log(`Total Annual Fees: $${totalAnnualFees}`);

    // Calculate claimed benefits value
    const claimedBenefits = await prisma.benefitStatus.findMany({
      where: {
        userId: sampleUser.id,
        isCompleted: true
      },
      include: {
        benefit: {
          include: {
            creditCard: true
          }
        }
      }
    });

    const totalClaimedValue = claimedBenefits.reduce((total, status) => {
      return total + (status.benefit.maxAmount || 0);
    }, 0);

    console.log('\n🎁 Claimed Benefits Breakdown:');
    console.log('─'.repeat(40));
    console.log(`Total claimed benefits: ${claimedBenefits.length}`);
    console.log(`Total claimed value: $${totalClaimedValue}`);

    // Sample of claimed benefits
    console.log('\nSample claimed benefits:');
    claimedBenefits.slice(0, 5).forEach((status, index) => {
      console.log(`  ${index + 1}. ${status.benefit.description} - $${status.benefit.maxAmount || 0} (${status.benefit.creditCard.name})`);
    });

    // Calculate ROI
    const roi = totalClaimedValue - totalAnnualFees;
    const roiPercentage = totalAnnualFees > 0 ? ((totalClaimedValue / totalAnnualFees) * 100) : 0;

    console.log('\n📊 ROI Analysis:');
    console.log('─'.repeat(40));
    console.log(`Annual Fees: $${totalAnnualFees.toFixed(2)}`);
    console.log(`Benefits Claimed: $${totalClaimedValue.toFixed(2)}`);
    console.log(`Net ROI: $${roi.toFixed(2)}`);
    console.log(`ROI Percentage: ${roiPercentage.toFixed(1)}%`);

    if (roi >= 0) {
      console.log('✅ PROFITABLE: You\'ve earned back your annual fees!');
    } else {
      console.log('⚠️  UNPROFITABLE: You need to claim more benefits');
    }

    // Check upcoming benefits potential
    const upcomingBenefits = await prisma.benefitStatus.findMany({
      where: {
        userId: sampleUser.id,
        isCompleted: false,
        cycleEndDate: { gte: new Date() }
      },
      include: {
        benefit: true
      }
    });

    const potentialValue = upcomingBenefits.reduce((total, status) => {
      return total + (status.benefit.maxAmount || 0);
    }, 0);

    console.log('\n🔮 Potential Analysis:');
    console.log('─'.repeat(40));
    console.log(`Upcoming benefits: ${upcomingBenefits.length}`);
    console.log(`Potential additional value: $${potentialValue.toFixed(2)}`);
    console.log(`Total potential ROI: $${(totalClaimedValue + potentialValue - totalAnnualFees).toFixed(2)}`);

    if (totalClaimedValue + potentialValue >= totalAnnualFees) {
      console.log('🎯 You can achieve profitability by claiming remaining benefits!');
    }

    console.log('\n✅ Annual Fee ROI Feature Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAnnualFeeROI(); 