// Load environment variables
require('dotenv').config();

const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function listAvailableCards() {
  console.log('📋 Available Credit Cards for Adding\n');
  
  try {
    const predefinedCards = await prisma.predefinedCard.findMany({
      include: {
        benefits: true
      },
      orderBy: [
        { issuer: 'asc' },
        { name: 'asc' }
      ]
    });

    if (predefinedCards.length === 0) {
      console.log('❌ No predefined cards found in the database.');
      return;
    }

    console.log(`Found ${predefinedCards.length} available credit cards:\n`);

    let currentIssuer = '';
    predefinedCards.forEach((card, index) => {
      if (card.issuer !== currentIssuer) {
        if (currentIssuer !== '') console.log(''); // Add spacing between issuers
        console.log(`🏦 ${card.issuer.toUpperCase()}`);
        console.log('─'.repeat(card.issuer.length + 4));
        currentIssuer = card.issuer;
      }

      console.log(`  ${index + 1}. ${card.name}`);
      console.log(`     Annual Fee: $${card.annualFee}`);
      console.log(`     Benefits: ${card.benefits.length} cyclical benefits`);
      
      if (card.benefits.length > 0) {
        console.log('     Key Benefits:');
        card.benefits.slice(0, 3).forEach(benefit => {
          const amount = benefit.maxAmount > 0 ? `$${benefit.maxAmount}` : '';
          const frequency = benefit.frequency.toLowerCase().replace('_', ' ');
          console.log(`       • ${benefit.description} (${frequency}${amount ? ', ' + amount : ''})`);
        });
        if (card.benefits.length > 3) {
          console.log(`       • ...and ${card.benefits.length - 3} more benefits`);
        }
      }
      console.log('');
    });

    console.log('\n📝 To add any of these cards:');
    console.log('   1. Visit https://www.perks-reminder.com/cards/new');
    console.log('   2. Select the card you want to add');
    console.log('   3. Optionally enter the month/year you opened the card');
    console.log('   4. Benefits will be automatically created and tracked');
    
    console.log('\n💡 Pro tip: If you remember when you opened your cards, adding the opening date');
    console.log('   helps with accurate benefit cycle calculations, especially for anniversary-based benefits.');

  } catch (error) {
    console.error('❌ Error fetching cards:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAvailableCards(); 