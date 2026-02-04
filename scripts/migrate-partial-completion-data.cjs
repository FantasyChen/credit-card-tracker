/**
 * Data Migration Script: Set usedAmount for Existing Benefits
 * 
 * This script migrates existing BenefitStatus records to set the usedAmount field:
 * - For completed benefits: usedAmount = maxAmount (already used the full value)
 * - For uncompleted benefits: usedAmount = 0 (default, no action needed)
 * 
 * Usage:
 *   node scripts/migrate-partial-completion-data.cjs --dry-run    # Preview changes
 *   node scripts/migrate-partial-completion-data.cjs --execute    # Apply changes
 * 
 * Safety:
 * - Always run with --dry-run first to preview changes
 * - The script is idempotent - running it multiple times is safe
 * - Backs up data before making changes by logging all affected records
 */

const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isExecute = args.includes('--execute');

  if (!isDryRun && !isExecute) {
    console.log('Usage:');
    console.log('  node scripts/migrate-partial-completion-data.cjs --dry-run    # Preview changes');
    console.log('  node scripts/migrate-partial-completion-data.cjs --execute    # Apply changes');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('  Partial Completion Data Migration');
  console.log('========================================\n');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'EXECUTE (changes will be applied)'}\n`);

  try {
    // 1. Find all completed benefit statuses that need migration
    const completedStatuses = await prisma.benefitStatus.findMany({
      where: {
        isCompleted: true,
      },
      include: {
        benefit: {
          select: {
            id: true,
            description: true,
            maxAmount: true,
          },
        },
      },
    });

    console.log(`Found ${completedStatuses.length} completed benefit statuses\n`);

    // 2. Filter to only those that need updating (usedAmount !== maxAmount)
    const statusesToUpdate = completedStatuses.filter(status => {
      const maxAmount = status.benefit.maxAmount ?? 0;
      const currentUsedAmount = status.usedAmount ?? 0;
      return currentUsedAmount !== maxAmount;
    });

    console.log(`Statuses needing update: ${statusesToUpdate.length}`);
    console.log(`Statuses already correct: ${completedStatuses.length - statusesToUpdate.length}\n`);

    if (statusesToUpdate.length === 0) {
      console.log('✅ No migration needed - all completed benefits already have correct usedAmount');
      return;
    }

    // 3. Show what will be changed
    console.log('Changes to be made:');
    console.log('-------------------');
    
    let totalValueToAdd = 0;
    for (const status of statusesToUpdate) {
      const maxAmount = status.benefit.maxAmount ?? 0;
      const currentUsedAmount = status.usedAmount ?? 0;
      const difference = maxAmount - currentUsedAmount;
      totalValueToAdd += difference;
      
      console.log(`  - ${status.benefit.description.substring(0, 50)}...`);
      console.log(`    ID: ${status.id}`);
      console.log(`    Current usedAmount: ${currentUsedAmount}`);
      console.log(`    New usedAmount: ${maxAmount}`);
      console.log(`    Difference: +${difference}\n`);
    }

    console.log('-------------------');
    console.log(`Summary:`);
    console.log(`  Records to update: ${statusesToUpdate.length}`);
    console.log(`  Total value to add: $${totalValueToAdd.toFixed(2)}\n`);

    // 4. Execute changes if not dry run
    if (isExecute) {
      console.log('Executing migration...\n');

      let successCount = 0;
      let errorCount = 0;

      for (const status of statusesToUpdate) {
        const maxAmount = status.benefit.maxAmount ?? 0;
        
        try {
          await prisma.benefitStatus.update({
            where: { id: status.id },
            data: { usedAmount: maxAmount },
          });
          successCount++;
        } catch (error) {
          console.error(`  ❌ Failed to update status ${status.id}:`, error.message);
          errorCount++;
        }
      }

      console.log('\n========================================');
      console.log('  Migration Complete');
      console.log('========================================');
      console.log(`  ✅ Successfully updated: ${successCount}`);
      console.log(`  ❌ Failed: ${errorCount}`);
      console.log(`  Total: ${statusesToUpdate.length}`);
    } else {
      console.log('========================================');
      console.log('  DRY RUN COMPLETE');
      console.log('========================================');
      console.log('No changes were made. Run with --execute to apply changes.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
