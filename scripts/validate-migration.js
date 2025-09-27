#!/usr/bin/env node

/**
 * Migration Validation Tool
 * 
 * Validates migration plans before execution to catch issues early
 * 
 * USAGE:
 *   node scripts/validate-migration.js --migration-id=amex-plat-2025
 *   node scripts/validate-migration.js --migration-id=csr-2025 --verbose
 */

const path = require('path');

// Add TypeScript support for this script
require('ts-node/register');

// Import validation tools and migration registry
const { MigrationValidator } = require('../src/lib/benefit-migration/validation-tools');
const { MIGRATION_REGISTRY } = require('./migrate-benefits');

/**
 * Main validation function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Show help if no arguments
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    displayHelp();
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

  const verbose = args.includes('--verbose');

  try {
    // Create migration plan
    console.log(`🔍 Validating migration: ${migrationId}`);
    const plan = migrationFactory();
    
    // Run validation
    const validator = new MigrationValidator();
    const report = await validator.validateMigration(plan);

    // Display results
    console.log(MigrationValidator.formatValidationReport(report));

    // Exit with appropriate code
    if (!report.isValid) {
      console.log('❌ Validation failed - fix issues before running migration\n');
      process.exit(1);
    } else {
      const hasWarnings = report.checks.some(check => check.status === 'warning');
      if (hasWarnings) {
        console.log('⚠️  Validation passed with warnings - review before proceeding\n');
      } else {
        console.log('✅ Validation passed - migration is ready to run\n');
      }
      
      console.log('Next steps:');
      console.log(`   # Preview changes (dry run)`);
      console.log(`   node scripts/migrate-benefits.js --migration-id=${migrationId} --dry-run`);
      console.log(`   `);
      console.log(`   # Execute migration`);
      console.log(`   node scripts/migrate-benefits.js --migration-id=${migrationId} --force`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
🔍 Migration Validation Tool

USAGE:
  node scripts/validate-migration.js --migration-id=MIGRATION_ID [OPTIONS]

OPTIONS:
  --migration-id=ID      Required. ID of the migration to validate
  --verbose              Show detailed validation information
  --help, -h             Show this help message

EXAMPLES:
  # Validate Amex Platinum 2025 migration
  node scripts/validate-migration.js --migration-id=amex-plat-2025

  # Validate with verbose output
  node scripts/validate-migration.js --migration-id=csr-2025 --verbose

VALIDATION CHECKS:
  ✅ Data Integrity       - Verify referenced cards exist
  ✅ Benefit Validation   - Test benefit cycle calculations
  ✅ User Impact         - Assess impact on existing users
  ✅ Schema Compatibility - Verify field types and values

This tool helps catch issues before migration execution, preventing:
  - Invalid benefit cycle dates (like Q3 benefits getting Q1 dates)
  - Missing predefined cards
  - Schema validation errors
  - Unexpected user impact
  `);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Validation interrupted by user');
  process.exit(1);
});

// Run the validation
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}
