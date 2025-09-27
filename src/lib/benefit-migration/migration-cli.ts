/**
 * Migration CLI Interface
 * 
 * Command-line interface for running benefit migrations safely
 */

import { BenefitMigrationEngine } from './migration-engine';
import type { MigrationPlan, MigrationOptions } from './types';

export interface CLIOptions {
  dryRun?: boolean;
  force?: boolean;
  batchSize?: number;
  stopOnFirstError?: boolean;
  preserveUserActions?: boolean;
  validateCycles?: boolean;
  verbose?: boolean;
}

export class MigrationCLI {
  private engine: BenefitMigrationEngine;
  private verbose: boolean = false;

  constructor(options: CLIOptions = {}) {
    const migrationOptions: MigrationOptions = {
      dryRun: options.dryRun ?? true, // Default to dry run for safety
      force: options.force ?? false,
      batchSize: options.batchSize ?? 10,
      stopOnFirstError: options.stopOnFirstError ?? false,
      preserveUserActions: options.preserveUserActions ?? true,
      validateCycles: options.validateCycles ?? true,
      backupUserData: false // TODO: Implement backup functionality
    };

    this.engine = new BenefitMigrationEngine(migrationOptions);
    this.verbose = options.verbose ?? false;
  }

  /**
   * Execute a migration with CLI-style output and safety checks
   */
  async executeMigration(plan: MigrationPlan): Promise<void> {
    // Display banner
    this.displayBanner(plan);

    // Safety confirmation for live runs
    if (!plan.dryRunOnly && !this.engine['options'].dryRun && !this.engine['options'].force) {
      throw new Error(`
❌ SAFETY CHECK FAILED

This migration is configured to modify production data, but neither --dry-run nor --force was specified.

To proceed:
  --dry-run    : Preview changes without modifying data
  --force      : Execute the migration (MODIFIES PRODUCTION DATA)

Example:
  node scripts/migrate-benefits.js --migration-id=${plan.id} --force
      `);
    }

    // Execute migration
    const result = await this.engine.executeMigration(plan);

    // Display results
    this.displayResults(result);

    // Exit with error code if migration failed
    if (!result.success) {
      process.exit(1);
    }
  }

  /**
   * Display migration banner with key information
   */
  private displayBanner(plan: MigrationPlan): void {
    const isDryRun = this.engine['options'].dryRun;
    const borderChar = '=';
    const border = borderChar.repeat(60);

    console.log(`\n${border}`);
    console.log(`${isDryRun ? '🔍 DRY RUN' : '🚀 LIVE MIGRATION'}: ${plan.title}`);
    console.log(`${border}`);
    console.log(`📋 Description: ${plan.description}`);
    console.log(`🏷️  Version: ${plan.version}`);
    console.log(`📅 Created: ${plan.createdAt.toISOString()}`);
    console.log(`🃏 Cards affected: ${plan.cardUpdates.length}`);
    
    plan.cardUpdates.forEach((card, index) => {
      console.log(`   ${index + 1}. ${card.cardName} (${card.benefits.length} benefits)`);
    });

    console.log(`\n⚙️  Options:`);
    console.log(`   Batch size: ${this.engine['options'].batchSize}`);
    console.log(`   Preserve user actions: ${this.engine['options'].preserveUserActions}`);
    console.log(`   Validate cycles: ${this.engine['options'].validateCycles}`);
    console.log(`   Stop on first error: ${this.engine['options'].stopOnFirstError}`);

    if (isDryRun) {
      console.log(`\n🔍 DRY RUN MODE: No data will be modified`);
    } else {
      console.log(`\n⚠️  LIVE MODE: This will modify production data!`);
      if (this.engine['options'].preserveUserActions) {
        console.log(`🛡️  User actions will be preserved (completed/not-usable benefits)`);
      } else {
        console.log(`❗ All existing benefits will be replaced`);
      }
    }

    console.log(`${border}\n`);
  }

  /**
   * Display migration results
   */
  private displayResults(result: any): void {
    const borderChar = result.success ? '=' : '!';
    const border = borderChar.repeat(60);
    const emoji = result.success ? '✅' : '❌';

    console.log(`\n${border}`);
    console.log(`${emoji} MIGRATION ${result.success ? 'COMPLETED' : 'FAILED'}`);
    console.log(`${border}`);
    console.log(result.summary);

    if (result.affectedUsers > 0) {
      console.log(`\n📊 Details:`);
      console.log(`   👥 Users affected: ${result.affectedUsers}`);
      console.log(`   🃏 Cards affected: ${result.affectedCards}`);
      console.log(`   ➕ Benefits created: ${result.benefitsCreated}`);
      console.log(`   ➖ Benefits deleted: ${result.benefitsDeleted}`);
    }

    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.slice(0, 10).forEach((warning: string) => {
        console.log(`   - ${warning}`);
      });
      if (result.warnings.length > 10) {
        console.log(`   ... and ${result.warnings.length - 10} more`);
      }
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach((error: any) => {
        console.log(`   - ${error.type}: ${error.message}`);
        if (error.userEmail) {
          console.log(`     User: ${error.userEmail}`);
        }
      });
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more`);
      }
    }

    console.log(`${border}\n`);

    // Next steps guidance
    if (this.engine['options'].dryRun && result.success) {
      console.log(`🎯 Next Steps:`);
      console.log(`   Review the changes above, then run with --force to execute:`);
      console.log(`   node scripts/migrate-benefits.js --migration-id=${result.migrationId || 'YOUR_MIGRATION_ID'} --force\n`);
    } else if (result.success) {
      console.log(`🎉 Migration completed successfully!`);
      console.log(`   Users will now see the updated benefits.\n`);
    } else {
      console.log(`💡 Troubleshooting:`);
      console.log(`   1. Review the errors above`);
      console.log(`   2. Fix any data issues or migration configuration`);
      console.log(`   3. Run with --dry-run to test fixes`);
      console.log(`   4. Use --stop-on-first-error for easier debugging\n`);
    }
  }

  /**
   * Parse command line arguments
   */
  static parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {};

    args.forEach(arg => {
      switch (arg) {
        case '--dry-run':
          options.dryRun = true;
          break;
        case '--force':
          options.force = true;
          options.dryRun = false; // Force overrides dry-run
          break;
        case '--stop-on-error':
          options.stopOnFirstError = true;
          break;
        case '--no-preserve-user-actions':
          options.preserveUserActions = false;
          break;
        case '--no-validate-cycles':
          options.validateCycles = false;
          break;
        case '--verbose':
          options.verbose = true;
          break;
        default:
          if (arg.startsWith('--batch-size=')) {
            options.batchSize = parseInt(arg.split('=')[1]);
          }
          break;
      }
    });

    return options;
  }

  /**
   * Display help information
   */
  static displayHelp(): void {
    console.log(`
🛠️  Benefit Migration CLI

USAGE:
  node scripts/migrate-benefits.js [OPTIONS]

OPTIONS:
  --dry-run                   Preview changes without modifying data (DEFAULT)
  --force                     Execute migration (modifies production data)
  --batch-size=N             Process N cards at a time (default: 10)
  --stop-on-error            Stop on first error (default: continue)
  --no-preserve-user-actions  Replace all benefits (default: preserve completed/not-usable)
  --no-validate-cycles       Skip benefit cycle validation (default: validate)
  --skip-validation          Skip pre-migration validation (not recommended)
  --verbose                  Show detailed progress information

SAFETY FEATURES:
  ✅ Dry run by default - you must explicitly use --force to modify data
  ✅ Preserves user actions (completed/not-usable benefits) by default
  ✅ Comprehensive validation before migration
  ✅ Fault-tolerant processing with Promise.allSettled
  ✅ Transaction safety - all operations for a user succeed or fail together

EXAMPLES:
  # Preview changes (safe)
  node scripts/migrate-benefits.js --migration-id=amex-plat-2025

  # Execute migration (modifies data)
  node scripts/migrate-benefits.js --migration-id=amex-plat-2025 --force

  # Process in smaller batches with verbose output
  node scripts/migrate-benefits.js --migration-id=amex-plat-2025 --force --batch-size=5 --verbose

  # Replace all benefits (not recommended)
  node scripts/migrate-benefits.js --migration-id=amex-plat-2025 --force --no-preserve-user-actions
    `);
  }
}
