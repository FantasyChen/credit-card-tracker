#!/usr/bin/env node

/**
 * Modern Benefit Migration Script
 * 
 * Uses the new automated migration framework for safe, comprehensive benefit updates
 * 
 * USAGE:
 *   node scripts/migrate-benefits.js --migration-id=amex-plat-2025 --dry-run
 *   node scripts/migrate-benefits.js --migration-id=amex-plat-2025 --force
 */

const path = require('path');
const fs = require('fs');

// Add TypeScript support for this script
require('ts-node/register');

// Import our migration framework
const { 
  MigrationCLI, 
  MigrationPlanBuilder, 
  BenefitFrequency, 
  BenefitCycleAlignment 
} = require('../src/lib/benefit-migration');

// Import validation tools
const { MigrationValidator } = require('../src/lib/benefit-migration/validation-tools');

// Migration definitions registry
const MIGRATION_REGISTRY = {
  'amex-plat-2025': createAmexPlatinum2025Migration,
  'csr-2025': createCSR2025Migration,
  'example-migration': createExampleMigration
};

/**
 * Actual Amex Platinum Card Migration (from current seed file)
 * 
 * NOTE: This uses the current benefit structure from the seed file.
 * Modify the benefits array below to create an actual migration.
 */
function createAmexPlatinum2025Migration() {
  return MigrationPlanBuilder.fromConfig({
    id: 'amex-plat-current',
    title: 'American Express Platinum Current Benefits',
    description: 'Current Amex Platinum benefit structure (from seed file)',
    version: '2025.1',
    cards: [{
      name: 'American Express Platinum Card',
      issuer: 'American Express',
      annualFee: 895,
      effectiveDate: new Date('2025-01-01'),
      migrationNotes: 'Current benefits structure from seed file',
      benefits: [
        // Airline Fee Credit
        {
          category: 'Travel',
          description: '$200 Airline Fee Credit (Incidental Fees, select one airline)',
          percentage: 0,
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 12,
          occurrencesInCycle: 1
        },
        // Monthly Uber Cash
        {
          category: 'Travel',
          description: '$15 Monthly Uber Cash ($35 in December)',
          percentage: 0,
          maxAmount: 15,
          frequency: BenefitFrequency.MONTHLY,
          occurrencesInCycle: 1
        },
        // December Uber Cash Bonus
        {
          category: 'Travel',
          description: '$20 Additional Uber Cash (December)',
          percentage: 0,
          maxAmount: 20,
          frequency: BenefitFrequency.YEARLY,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 12,
          fixedCycleDurationMonths: 1,
          occurrencesInCycle: 1
        },
        // Streaming Credit
        {
          category: 'Entertainment',
          description: '$20 Monthly Streaming Credit (Various services)',
          percentage: 0,
          maxAmount: 20,
          frequency: BenefitFrequency.MONTHLY,
          occurrencesInCycle: 1
        },
        // Equinox Credit
        {
          category: 'Wellness',
          description: '$300 Annual Equinox Credit',
          percentage: 0,
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
          occurrencesInCycle: 1
        }
      ]
    }]
  });
}

/**
 * Actual Chase Sapphire Reserve Migration (from current seed file)
 * 
 * NOTE: This uses the current benefit structure from the seed file.
 * Modify the benefits array below to create an actual migration.
 */
function createCSR2025Migration() {
  return MigrationPlanBuilder.fromConfig({
    id: 'csr-current',
    title: 'Chase Sapphire Reserve Current Benefits',
    description: 'Current CSR benefit structure (from seed file)',
    version: '2025.1',
    cards: [{
      name: 'Chase Sapphire Reserve',
      issuer: 'Chase',
      annualFee: 795,
      effectiveDate: new Date('2025-01-01'),
      migrationNotes: 'Current benefits structure from seed file',
      benefits: [
        // Annual Dining Credit
        {
          category: 'Dining',
          description: '$300 Annual Dining Credit (Select Restaurants)',
          percentage: 0,
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          occurrencesInCycle: 1
        },
        // Hotel Credit Jan-Jun
        {
          category: 'Travel',
          description: '$250 Hotel Credit (The Edit by Chase Properties - Jan-Jun)',
          percentage: 0,
          maxAmount: 250,
          frequency: BenefitFrequency.YEARLY,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 6,
          occurrencesInCycle: 1
        },
        // Hotel Credit Jul-Dec
        {
          category: 'Travel',
          description: '$250 Hotel Credit (The Edit by Chase Properties - Jul-Dec)',
          percentage: 0,
          maxAmount: 250,
          frequency: BenefitFrequency.YEARLY,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7,
          fixedCycleDurationMonths: 6,
          occurrencesInCycle: 1
        },
        // StubHub Credit
        {
          category: 'Entertainment',
          description: '$300 Annual StubHub Credit (Event Tickets)',
          percentage: 0,
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          occurrencesInCycle: 1
        },
        // Lyft Credit
        {
          category: 'Travel',
          description: '$180 Annual Lyft Credit ($15/month)',
          percentage: 0,
          maxAmount: 15,
          frequency: BenefitFrequency.MONTHLY,
          occurrencesInCycle: 1
        }
      ]
    }]
  });
}

/**
 * Example migration for testing
 */
function createExampleMigration() {
  const builder = new MigrationPlanBuilder();
  
  return builder
    .setMetadata({
      id: 'example-migration',
      title: 'Example Benefit Migration',
      description: 'Demonstrates all benefit types and patterns',
      dryRunOnly: true // Force dry run for safety
    })
    .addCardUpdate('Test Card', 'Test Issuer')
    .addDiningBenefit({
      description: 'Monthly Dining Credit',
      percentage: 100,
      maxAmount: 25
    })
    .addQuarterlyBenefit({
      quarter: 1,
      category: 'Entertainment',
      description: 'Streaming Services',
      percentage: 100,
      maxAmount: 50
    })
    .addOneTimeBenefit({
      category: 'Welcome',
      description: 'Welcome Bonus',
      percentage: 100,
      maxAmount: 500
    })
    .finishCard()
    .build();
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Show help if no arguments
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    MigrationCLI.displayHelp();
    return;
  }

  // Parse migration ID
  const migrationIdArg = args.find(arg => arg.startsWith('--migration-id='));
  if (!migrationIdArg) {
    console.error('❌ Error: --migration-id is required');
    console.log('\nAvailable migrations:');
    Object.keys(MIGRATION_REGISTRY).forEach(id => {
      console.log(`   ${id}`);
    });
    console.log('\nExample: node scripts/migrate-benefits.js --migration-id=amex-plat-2025 --dry-run');
    process.exit(1);
  }

  const migrationId = migrationIdArg.split('=')[1];
  const migrationFactory = MIGRATION_REGISTRY[migrationId];

  if (!migrationFactory) {
    console.error(`❌ Error: Unknown migration ID "${migrationId}"`);
    console.log('\nAvailable migrations:');
    Object.keys(MIGRATION_REGISTRY).forEach(id => {
      console.log(`   ${id}`);
    });
    process.exit(1);
  }

  try {
    // Create migration plan
    const plan = migrationFactory();
    
    // Parse CLI options
    const cliOptions = MigrationCLI.parseArgs(args);
    
    // Run validation unless explicitly skipped
    const skipValidation = args.includes('--skip-validation');
    if (!skipValidation && !plan.dryRunOnly) {
      console.log('🔍 Running pre-migration validation...\n');
      
      const validator = new MigrationValidator();
      const report = await validator.validateMigration(plan);
      
      if (!report.isValid) {
        console.log(MigrationValidator.formatValidationReport(report));
        console.error('❌ Validation failed - fix issues before proceeding');
        console.log('💡 Use --skip-validation to bypass validation (not recommended)');
        process.exit(1);
      }
      
      const hasWarnings = report.checks.some(check => check.status === 'warning');
      if (hasWarnings && !cliOptions.force) {
        console.log(MigrationValidator.formatValidationReport(report));
        console.log('⚠️  Validation passed with warnings');
        console.log('💡 Use --force to proceed despite warnings, or fix issues first');
        process.exit(1);
      }
      
      if (hasWarnings) {
        console.log('⚠️  Validation passed with warnings - proceeding due to --force flag\n');
      } else {
        console.log('✅ Validation passed\n');
      }
    }
    
    // Create and execute migration
    const cli = new MigrationCLI(cliOptions);
    await cli.executeMigration(plan);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Migration interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the migration
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  MIGRATION_REGISTRY,
  createAmexPlatinum2025Migration,
  createCSR2025Migration,
  createExampleMigration
};
