/**
 * Fix Duplicate BenefitStatus Records
 * 
 * This script identifies and removes duplicate BenefitStatus records that were
 * created due to different cycleStartDate times (e.g., 07:00, 08:00, 23:00 vs 00:00 UTC).
 * 
 * The issue: Old code created records with local timezone times, while new code
 * uses proper UTC midnight. The unique constraint uses exact DateTime, so both
 * are allowed, creating duplicates.
 * 
 * Strategy:
 * 1. Group records by (benefitId, userId, DATE(cycleStartDate), occurrenceIndex)
 * 2. For each duplicate group, keep the "best" record:
 *    - Prefer completed records (preserve user's work)
 *    - Then prefer records with correct UTC midnight time
 *    - Then prefer most recently updated
 * 3. Delete duplicates
 * 4. Normalize kept record's cycleStartDate to midnight UTC
 * 
 * Usage:
 *   node scripts/fix-duplicate-benefit-statuses.cjs --dry-run   # Preview changes
 *   node scripts/fix-duplicate-benefit-statuses.cjs --force     # Execute changes
 */

require('dotenv').config();

const { PrismaClient } = require('../src/generated/prisma');
const prisma = new PrismaClient();

/**
 * Normalize a date to midnight UTC
 */
function normalizeCycleDate(date) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
}

/**
 * Check if a date is at midnight UTC
 */
function isMidnightUTC(date) {
  return date.getUTCHours() === 0 &&
         date.getUTCMinutes() === 0 &&
         date.getUTCSeconds() === 0 &&
         date.getUTCMilliseconds() === 0;
}

/**
 * Choose the best record to keep from a group of duplicates
 */
function chooseBestRecord(records) {
  // Sort by preference:
  // 1. Completed records first (preserve user's work)
  // 2. Records with correct midnight UTC time
  // 3. Most recently updated
  return records.sort((a, b) => {
    // Prefer completed
    if (a.isCompleted && !b.isCompleted) return -1;
    if (!a.isCompleted && b.isCompleted) return 1;
    
    // Prefer midnight UTC
    const aIsMidnight = isMidnightUTC(a.cycleStartDate);
    const bIsMidnight = isMidnightUTC(b.cycleStartDate);
    if (aIsMidnight && !bIsMidnight) return -1;
    if (!aIsMidnight && bIsMidnight) return 1;
    
    // Prefer most recently updated
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0];
}

async function fixDuplicateBenefitStatuses(dryRun = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Fix Duplicate BenefitStatus Records`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : '⚠️  LIVE MODE (changes will be applied)'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Step 1: Fetch all benefit statuses
  console.log('📊 Fetching all BenefitStatus records...');
  const allStatuses = await prisma.benefitStatus.findMany({
    select: {
      id: true,
      benefitId: true,
      userId: true,
      cycleStartDate: true,
      cycleEndDate: true,
      occurrenceIndex: true,
      isCompleted: true,
      completedAt: true,
      isNotUsable: true,
      orderIndex: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [
      { benefitId: 'asc' },
      { userId: 'asc' },
      { cycleStartDate: 'asc' }
    ]
  });

  console.log(`   Total records: ${allStatuses.length}`);

  // Step 2: Group by (benefitId, userId, DATE(cycleStartDate), occurrenceIndex)
  console.log('\n🔍 Identifying duplicate groups...');
  const groups = {};
  for (const status of allStatuses) {
    const dateOnly = status.cycleStartDate.toISOString().split('T')[0];
    const key = `${status.benefitId}|${status.userId}|${dateOnly}|${status.occurrenceIndex}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(status);
  }

  // Find duplicates
  const duplicateGroups = Object.entries(groups).filter(([_, records]) => records.length > 1);
  const totalDuplicates = duplicateGroups.reduce((sum, [_, records]) => sum + records.length - 1, 0);
  
  console.log(`   Duplicate groups: ${duplicateGroups.length}`);
  console.log(`   Records to delete: ${totalDuplicates}`);

  if (duplicateGroups.length === 0) {
    console.log('\n✅ No duplicates found. Database is clean!');
    return { deleted: 0, normalized: 0 };
  }

  // Step 3: Process each duplicate group
  console.log('\n🔧 Processing duplicate groups...\n');
  
  const toDelete = [];
  const toNormalize = [];
  
  let completedPreserved = 0;
  let midnightPreferred = 0;
  let recentPreferred = 0;

  for (const [key, records] of duplicateGroups) {
    const bestRecord = chooseBestRecord(records);
    const duplicates = records.filter(r => r.id !== bestRecord.id);
    
    // Track why we chose this record
    if (bestRecord.isCompleted) completedPreserved++;
    else if (isMidnightUTC(bestRecord.cycleStartDate)) midnightPreferred++;
    else recentPreferred++;
    
    // Queue duplicates for deletion
    toDelete.push(...duplicates.map(d => d.id));
    
    // Queue best record for normalization if needed
    if (!isMidnightUTC(bestRecord.cycleStartDate)) {
      toNormalize.push({
        id: bestRecord.id,
        currentTime: bestRecord.cycleStartDate.toISOString(),
        normalizedDate: normalizeCycleDate(bestRecord.cycleStartDate)
      });
    }
  }

  console.log('📈 Selection statistics:');
  console.log(`   Kept because completed: ${completedPreserved}`);
  console.log(`   Kept because midnight UTC: ${midnightPreferred}`);
  console.log(`   Kept because most recent: ${recentPreferred}`);
  console.log(`\n   Records to delete: ${toDelete.length}`);
  console.log(`   Records to normalize: ${toNormalize.length}`);

  // Step 4: Also find non-duplicate records that need normalization
  console.log('\n🔍 Finding non-duplicate records needing normalization...');
  const singletonGroups = Object.entries(groups).filter(([_, records]) => records.length === 1);
  const singletonsToNormalize = [];
  
  for (const [_, records] of singletonGroups) {
    const record = records[0];
    if (!isMidnightUTC(record.cycleStartDate)) {
      singletonsToNormalize.push({
        id: record.id,
        currentTime: record.cycleStartDate.toISOString(),
        normalizedDate: normalizeCycleDate(record.cycleStartDate)
      });
    }
  }
  
  console.log(`   Non-duplicate records needing normalization: ${singletonsToNormalize.length}`);
  
  const allToNormalize = [...toNormalize, ...singletonsToNormalize];
  console.log(`   Total records to normalize: ${allToNormalize.length}`);

  // Step 5: Show sample changes
  if (toDelete.length > 0) {
    console.log('\n📋 Sample deletions (first 5):');
    for (const [key, records] of duplicateGroups.slice(0, 5)) {
      const [benefitId, userId, dateOnly, occurrence] = key.split('|');
      const bestRecord = chooseBestRecord(records);
      const duplicates = records.filter(r => r.id !== bestRecord.id);
      
      console.log(`\n   Group: ${dateOnly} (${records.length} records)`);
      console.log(`   ✅ Keeping: ${bestRecord.id}`);
      console.log(`      Time: ${bestRecord.cycleStartDate.toISOString()}`);
      console.log(`      Completed: ${bestRecord.isCompleted}`);
      for (const dup of duplicates) {
        console.log(`   ❌ Deleting: ${dup.id}`);
        console.log(`      Time: ${dup.cycleStartDate.toISOString()}`);
        console.log(`      Completed: ${dup.isCompleted}`);
      }
    }
  }

  if (allToNormalize.length > 0) {
    console.log('\n📋 Sample normalizations (first 5):');
    for (const norm of allToNormalize.slice(0, 5)) {
      console.log(`   ${norm.id}: ${norm.currentTime} → ${norm.normalizedDate.toISOString()}`);
    }
  }

  // Step 6: Execute changes (if not dry run)
  if (dryRun) {
    console.log('\n' + '='.repeat(60));
    console.log('DRY RUN COMPLETE - No changes were made');
    console.log('='.repeat(60));
    console.log('\nTo apply these changes, run:');
    console.log('  node scripts/fix-duplicate-benefit-statuses.cjs --force\n');
    return { deleted: 0, normalized: 0, wouldDelete: toDelete.length, wouldNormalize: allToNormalize.length };
  }

  // Execute in batches with transaction
  console.log('\n⚠️  EXECUTING CHANGES...\n');
  
  const BATCH_SIZE = 100;
  let deletedCount = 0;
  let normalizedCount = 0;

  // Delete duplicates in batches
  console.log('🗑️  Deleting duplicates...');
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const result = await prisma.benefitStatus.deleteMany({
      where: { id: { in: batch } }
    });
    deletedCount += result.count;
    process.stdout.write(`   Deleted: ${deletedCount}/${toDelete.length}\r`);
  }
  console.log(`\n   ✅ Deleted ${deletedCount} duplicate records`);

  // Normalize cycleStartDate in batches
  console.log('\n🔧 Normalizing cycleStartDate values...');
  for (let i = 0; i < allToNormalize.length; i += BATCH_SIZE) {
    const batch = allToNormalize.slice(i, i + BATCH_SIZE);
    
    // Update each record individually (Prisma doesn't support batch updates with different values)
    for (const norm of batch) {
      await prisma.benefitStatus.update({
        where: { id: norm.id },
        data: { cycleStartDate: norm.normalizedDate }
      });
      normalizedCount++;
    }
    process.stdout.write(`   Normalized: ${normalizedCount}/${allToNormalize.length}\r`);
  }
  console.log(`\n   ✅ Normalized ${normalizedCount} records`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`   Duplicates deleted: ${deletedCount}`);
  console.log(`   Records normalized: ${normalizedCount}`);
  console.log('');

  return { deleted: deletedCount, normalized: normalizedCount };
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--force');
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Fix Duplicate BenefitStatus Records

Usage:
  node scripts/fix-duplicate-benefit-statuses.cjs [options]

Options:
  --dry-run   Preview changes without making them (default)
  --force     Execute the cleanup
  --help, -h  Show this help message

Examples:
  node scripts/fix-duplicate-benefit-statuses.cjs --dry-run
  node scripts/fix-duplicate-benefit-statuses.cjs --force
`);
    process.exit(0);
  }

  fixDuplicateBenefitStatuses(dryRun)
    .then(result => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { fixDuplicateBenefitStatuses, normalizeCycleDate, isMidnightUTC };

