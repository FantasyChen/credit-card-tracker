#!/usr/bin/env node

import dotenv from 'dotenv';
import { PrismaClient, BenefitFrequency, BenefitCycleAlignment } from '../src/generated/prisma/index.js';

// Load environment variables
dotenv.config();

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.bold}${colors.blue}🔄 ${msg}${colors.reset}`)
};

// Initialize Prisma client only when needed
let prisma;

console.log(`${colors.bold}${colors.blue}🔄 Chase Sapphire Reserve 2025 Benefits Update Script${colors.reset}\n`);

// Get command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');
const isForce = args.includes('--force') || args.includes('-f');

// New 2025 CSR Benefits Structure
const NEW_CSR_BENEFITS = [
  {
    description: '$300 Annual Dining Credit (Select Restaurants)',
    category: 'Dining',
    maxAmount: 300,
    percentage: 0,
    frequency: BenefitFrequency.YEARLY,
  },
  {
    description: '$250 Hotel Credit (The Edit by Chase Properties - Jan-Jun)',
    category: 'Travel',
    maxAmount: 250,
    percentage: 0,
    frequency: BenefitFrequency.YEARLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: 1,
    fixedCycleDurationMonths: 6,
  },
  {
    description: '$250 Hotel Credit (The Edit by Chase Properties - Jul-Dec)',
    category: 'Travel',
    maxAmount: 250,
    percentage: 0,
    frequency: BenefitFrequency.YEARLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: 7,
    fixedCycleDurationMonths: 6,
  },
  {
    description: '$300 Annual StubHub Credit (Event Tickets)',
    category: 'Entertainment',
    maxAmount: 300,
    percentage: 0,
    frequency: BenefitFrequency.YEARLY,
  },
  {
    description: 'Apple TV+ and Apple Music Subscriptions ($250 Annual Value)',
    category: 'Entertainment',
    maxAmount: 250,
    percentage: 0,
    frequency: BenefitFrequency.YEARLY,
  },
  {
    description: 'Points Boost: Up to 2¢ per point on select Chase Travel bookings',
    category: 'Travel',
    maxAmount: 0, // Value varies based on usage
    percentage: 0,
    frequency: BenefitFrequency.YEARLY,
  },
];

// Safety check: Verify we're not on production
function checkEnvironmentSafety() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    log.error('DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  // Check if we're potentially on production
  const productionIndicators = [
    'prod',
    'production', 
    'live',
    'postgres.com',
    'aws.com',
    'gcp.com',
    'azure.com',
    'supabase.com',
    'planetscale.com',
    'neon.tech'
  ];

  const lowerDbUrl = dbUrl.toLowerCase();
  const hasProductionIndicator = productionIndicators.some(indicator => 
    lowerDbUrl.includes(indicator)
  );

  if (hasProductionIndicator && !isForce) {
    log.error('SAFETY CHECK FAILED: Database URL appears to be production!');
    log.error(`Database URL contains: ${productionIndicators.find(ind => lowerDbUrl.includes(ind))}`);
    log.error('If you are sure this is safe, run with --force flag');
    log.warning('DANGER: This will modify user data permanently!');
    process.exit(1);
  }

  log.info(`Database URL: ${dbUrl.replace(/\/\/.*@/, '//***:***@')}`);
  
  if (hasProductionIndicator && isForce) {
    log.warning('🚨 PRODUCTION DATABASE DETECTED - Proceeding with --force flag');
  }
}

// Find all existing Chase Sapphire Reserve cards
async function findExistingCSRCards() {
  log.step('Finding existing Chase Sapphire Reserve cards...');
  
  const existingCards = await prisma.creditCard.findMany({
    where: {
      OR: [
        { name: 'Chase Sapphire Reserve' },
        { name: { contains: 'Sapphire Reserve' } }
      ],
      issuer: 'Chase'
    },
    include: {
      user: {
        select: {
          id: true,
          email: true
        }
      },
      benefits: {
        include: {
          benefitStatuses: true
        }
      }
    }
  });

  return existingCards;
}

// Display preview of what will be changed
function displayPreview(cards) {
  if (cards.length === 0) {
    log.info('No existing Chase Sapphire Reserve cards found.');
    return;
  }

  console.log(`\n${colors.bold}📋 Migration Preview:${colors.reset}`);
  console.log(`${colors.cyan}Found ${cards.length} user card(s) to update:${colors.reset}\n`);

  cards.forEach((card, index) => {
    console.log(`${colors.bold}${index + 1}. Card ID: ${card.id}${colors.reset}`);
    console.log(`   User: ${card.user.email}`);
    console.log(`   Current Name: "${card.name}"`);
    console.log(`   Current Benefits: ${card.benefits.length} benefit(s)`);
    console.log(`   New Benefits: ${NEW_CSR_BENEFITS.length} benefit(s)`);
    console.log(`   Created: ${card.createdAt.toISOString().split('T')[0]}`);
    
    // Show current benefits
    if (card.benefits.length > 0) {
      console.log(`   ${colors.yellow}Current Benefits:${colors.reset}`);
      card.benefits.forEach((benefit, idx) => {
        console.log(`     ${idx + 1}. ${benefit.description} (${benefit.category})`);
      });
    }
    console.log();
  });

  console.log(`${colors.bold}New Benefits Structure:${colors.reset}`);
  NEW_CSR_BENEFITS.forEach((benefit, idx) => {
    console.log(`  ${idx + 1}. ${benefit.description} (${benefit.category})`);
  });
  console.log();
}

// Perform the actual migration
async function performMigration(cards) {
  if (cards.length === 0) {
    log.success('No cards to migrate. Migration complete!');
    return;
  }

  log.step(`Updating ${cards.length} card(s) with new 2025 CSR benefits...`);

  const results = [];
  
  for (const card of cards) {
    try {
      // Use a transaction to ensure all operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        // Step 1: Delete existing benefits and their statuses
        log.info(`Deleting ${card.benefits.length} old benefits for user ${card.user.email}...`);
        
        // Delete benefit statuses first (due to foreign key constraint)
        for (const benefit of card.benefits) {
          await tx.benefitStatus.deleteMany({
            where: { benefitId: benefit.id }
          });
        }
        
        // Delete the benefits
        await tx.benefit.deleteMany({
          where: { creditCardId: card.id }
        });

        // Step 2: Update card name to indicate it's the new version
        await tx.creditCard.update({
          where: { id: card.id },
          data: { 
            name: 'Chase Sapphire Reserve',
            updatedAt: new Date()
          }
        });

        // Step 3: Create new benefits
        const newBenefits = [];
        for (const benefitData of NEW_CSR_BENEFITS) {
          const newBenefit = await tx.benefit.create({
            data: {
              creditCardId: card.id,
              category: benefitData.category,
              description: benefitData.description,
              percentage: benefitData.percentage,
              maxAmount: benefitData.maxAmount,
              frequency: benefitData.frequency,
              cycleAlignment: benefitData.cycleAlignment || null,
              fixedCycleStartMonth: benefitData.fixedCycleStartMonth || null,
              fixedCycleDurationMonths: benefitData.fixedCycleDurationMonths || null,
              startDate: new Date(), // Start from today
              endDate: null, // Ongoing benefits
            }
          });
          newBenefits.push(newBenefit);
        }

        return { 
          cardId: card.id, 
          userEmail: card.user.email, 
          newBenefitsCount: newBenefits.length 
        };
      });
      
      results.push({ success: true, ...result });
      log.success(`✅ Updated card for ${result.userEmail} with ${result.newBenefitsCount} new benefits`);
      
    } catch (error) {
      results.push({ 
        success: false, 
        cardId: card.id, 
        userEmail: card.user.email, 
        error: error.message 
      });
      log.error(`❌ Failed to update card for ${card.user.email}: ${error.message}`);
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n${colors.bold}📊 Migration Summary:${colors.reset}`);
  log.success(`Successfully updated: ${successful} card(s)`);
  if (failed > 0) {
    log.error(`Failed to update: ${failed} card(s)`);
  }

  return results;
}

// Verification function
async function verifyMigration() {
  log.step('Verifying migration...');
  
  const updatedCards = await prisma.creditCard.findMany({
    where: {
      name: 'Chase Sapphire Reserve',
      issuer: 'Chase'
    },
    include: {
      benefits: true,
      user: {
        select: { email: true }
      }
    }
  });

  console.log(`\n${colors.bold}🔍 Verification Results:${colors.reset}`);
  log.info(`Updated CSR cards: ${updatedCards.length}`);
  
  let totalBenefits = 0;
  updatedCards.forEach(card => {
    totalBenefits += card.benefits.length;
    log.info(`${card.user.email}: ${card.benefits.length} benefits`);
  });

  log.info(`Total new benefits created: ${totalBenefits}`);
  log.info(`Expected benefits per card: ${NEW_CSR_BENEFITS.length}`);

  if (updatedCards.length > 0 && totalBenefits === updatedCards.length * NEW_CSR_BENEFITS.length) {
    log.success('Migration verified successfully!');
  } else if (totalBenefits !== updatedCards.length * NEW_CSR_BENEFITS.length) {
    log.warning(`Benefits count mismatch. Expected: ${updatedCards.length * NEW_CSR_BENEFITS.length}, Actual: ${totalBenefits}`);
  }
}

// Main execution
async function main() {
  try {
    // Initialize Prisma client
    log.step('Initializing database connection...');
    prisma = new PrismaClient();

    // Safety checks
    checkEnvironmentSafety();

    console.log(`${colors.bold}🔧 Mode: ${isDryRun ? 'DRY RUN' : 'LIVE MIGRATION'}${colors.reset}\n`);

    if (isDryRun) {
      log.info('This is a dry run. No data will be modified.');
    } else {
      log.warning('This will modify user data permanently!');
      log.warning('This will DELETE existing benefits and replace them with 2025 benefits!');
    }

    // Find existing cards
    const existingCards = await findExistingCSRCards();
    
    // Display preview
    displayPreview(existingCards);

    if (isDryRun) {
      log.info('\n🔍 Dry run complete. Use without --dry-run to perform actual migration.');
      return;
    }

    // Confirm before proceeding (unless forced)
    if (!isForce && existingCards.length > 0) {
      console.log(`${colors.yellow}⚠️  This will DELETE existing benefits and replace with 2025 benefits for ${existingCards.length} user card(s).${colors.reset}`);
      console.log(`${colors.yellow}   This action is IRREVERSIBLE and will affect user benefit tracking history.${colors.reset}`);
      
      log.warning('Run with --force to proceed without confirmation');
      return;
    }

    // Perform migration
    await performMigration(existingCards);
    
    // Verify results
    await verifyMigration();

    log.success('\n🎉 Migration completed successfully!');
    log.info('Users now have the new 2025 Chase Sapphire Reserve benefits structure.');
    
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  log.warning('\n⚠️  Migration interrupted by user');
  if (prisma) await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.warning('\n⚠️  Migration terminated');
  if (prisma) await prisma.$disconnect();
  process.exit(0);
});

// Display help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colors.bold}Chase Sapphire Reserve 2025 Benefits Update Script${colors.reset}

This script updates existing user "Chase Sapphire Reserve" cards with the new 2025 benefits structure.
⚠️  WARNING: This DELETES existing benefits and replaces them with the new structure.

${colors.bold}Usage:${colors.reset}
  node update-csr-2025-benefits.js [options]

${colors.bold}Options:${colors.reset}
  --dry-run, -d    Preview changes without modifying data
  --force, -f      Skip confirmation and production safety checks  
  --help, -h       Show this help message

${colors.bold}Examples:${colors.reset}
  node update-csr-2025-benefits.js --dry-run    # Preview changes
  node update-csr-2025-benefits.js --force      # Run migration

${colors.bold}New 2025 Benefits:${colors.reset}
  • $300 Annual Dining Credit (Select Restaurants)
  • $250 Hotel Credit (The Edit by Chase Properties - Jan-Jun)
  • $250 Hotel Credit (The Edit by Chase Properties - Jul-Dec)
  • $300 Annual StubHub Credit (Event Tickets)
  • Apple TV+ and Apple Music Subscriptions ($250 Annual Value)
  • Points Boost: Up to 2¢ per point on select Chase Travel bookings
  
${colors.bold}Safety:${colors.reset}
  - Automatically detects potential production databases
  - Requires --force flag for production environments
  - Always run --dry-run first to preview changes
  - Uses database transactions for data integrity
`);
  process.exit(0);
}

// Run the migration
main();
