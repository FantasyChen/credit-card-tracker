#!/usr/bin/env node

import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/index.js';

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

console.log(`${colors.bold}${colors.blue}🔄 Chase Sapphire Reserve Migration Script${colors.reset}\n`);

// Get command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');
const isForce = args.includes('--force') || args.includes('-f');

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
async function findExistingCards() {
  log.step('Finding existing Chase Sapphire Reserve cards...');
  
  const existingCards = await prisma.creditCard.findMany({
    where: {
      name: 'Chase Sapphire Reserve',
      issuer: 'Chase'
    },
    include: {
      user: {
        select: {
          email: true
        }
      },
      benefits: {
        select: {
          id: true,
          description: true,
          maxAmount: true
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
    console.log(`   New Name: "${card.name} (Old)"`);
    console.log(`   Benefits: ${card.benefits.length} benefit(s)`);
    console.log(`   Created: ${card.createdAt.toISOString().split('T')[0]}`);
    console.log();
  });
}

// Perform the actual migration
async function performMigration(cards) {
  if (cards.length === 0) {
    log.success('No cards to migrate. Migration complete!');
    return;
  }

  log.step(`Updating ${cards.length} card(s)...`);

  const results = [];
  
  for (const card of cards) {
    try {
      const updatedCard = await prisma.creditCard.update({
        where: { id: card.id },
        data: { 
          name: 'Chase Sapphire Reserve (Old)',
          updatedAt: new Date()
        }
      });
      
      results.push({ success: true, cardId: card.id, userEmail: card.user.email });
      log.success(`✅ Updated card for ${card.user.email}`);
      
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
  
  const oldCards = await prisma.creditCard.count({
    where: {
      name: 'Chase Sapphire Reserve',
      issuer: 'Chase'
    }
  });

  const newOldCards = await prisma.creditCard.count({
    where: {
      name: 'Chase Sapphire Reserve (Old)', 
      issuer: 'Chase'
    }
  });

  console.log(`\n${colors.bold}🔍 Verification Results:${colors.reset}`);
  log.info(`Cards still named "Chase Sapphire Reserve": ${oldCards}`);
  log.info(`Cards now named "Chase Sapphire Reserve (Old)": ${newOldCards}`);

  if (oldCards === 0 && newOldCards > 0) {
    log.success('Migration verified successfully!');
  } else if (oldCards > 0) {
    log.warning(`${oldCards} card(s) still need migration`);
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
    }

    // Find existing cards
    const existingCards = await findExistingCards();
    
    // Display preview
    displayPreview(existingCards);

    if (isDryRun) {
      log.info('\n🔍 Dry run complete. Use without --dry-run to perform actual migration.');
      return;
    }

    // Confirm before proceeding (unless forced)
    if (!isForce && existingCards.length > 0) {
      console.log(`${colors.yellow}⚠️  This will rename ${existingCards.length} user card(s) permanently.${colors.reset}`);
      console.log(`${colors.yellow}   Users will need to add the new Chase Sapphire Reserve if they want updated benefits.${colors.reset}`);
      
      // In a real implementation, you might want to add readline for confirmation
      log.warning('Run with --force to proceed without confirmation');
      return;
    }

    // Perform migration
    await performMigration(existingCards);
    
    // Verify results
    await verifyMigration();

    log.success('\n🎉 Migration completed successfully!');
    
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
${colors.bold}Chase Sapphire Reserve Migration Script${colors.reset}

This script updates existing user "Chase Sapphire Reserve" cards to "Chase Sapphire Reserve (Old)"
so users can add the new version with updated benefits if they choose.

${colors.bold}Usage:${colors.reset}
  node migrate-chase-sapphire-reserve.js [options]

${colors.bold}Options:${colors.reset}
  --dry-run, -d    Preview changes without modifying data
  --force, -f      Skip confirmation and production safety checks  
  --help, -h       Show this help message

${colors.bold}Examples:${colors.reset}
  node migrate-chase-sapphire-reserve.js --dry-run    # Preview changes
  node migrate-chase-sapphire-reserve.js --force      # Run migration
  
${colors.bold}Safety:${colors.reset}
  - Automatically detects potential production databases
  - Requires --force flag for production environments
  - Always run --dry-run first to preview changes
  - Creates backup-friendly naming convention
`);
  process.exit(0);
}

// Run the migration
main(); 