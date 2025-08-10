// Load environment variables
require('dotenv').config();

const { PrismaClient } = require('../src/generated/prisma');
const { analyzeAllUserBenefitStatuses } = require('./august-2025-backfill-analysis.cjs');

const prisma = new PrismaClient();

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_EXECUTE = process.argv.includes('--force');

console.log(`🔧 August 2025 Benefit Status Backfill Script - ALL USERS`);
console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'EXECUTION MODE'}`);
console.log(`👥 Target: ALL USERS with missing August 2025 benefit statuses`);
console.log(`⏰ Started at: ${new Date().toISOString()}\n`);

async function executeBenefitStatusBackfillAllUsers() {
  try {
    // Step 1: Run analysis to get missing benefit statuses for all users
    console.log('🔍 Step 1: Analyzing missing benefit statuses for all users...');
    const analysisResults = await analyzeAllUserBenefitStatuses();
    
    if (!analysisResults || analysisResults.length === 0) {
      console.log('❌ No analysis results found. Exiting.');
      return;
    }

    // Step 2: Collect all missing benefit statuses
    const allMissingStatuses = [];
    analysisResults.forEach(userAnalysis => {
      userAnalysis.missingBenefitStatuses.forEach(missing => {
        allMissingStatuses.push({
          ...missing,
          userEmail: userAnalysis.email
        });
      });
    });

    console.log(`\n📊 Pre-execution Summary:`);
    console.log(`   Users to process: ${analysisResults.length}`);
    console.log(`   Total missing benefit statuses: ${allMissingStatuses.length}`);
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE EXECUTION'}`);

    if (allMissingStatuses.length === 0) {
      console.log('\n🎉 No missing benefit statuses found. Backfill not needed.');
      return;
    }

    // Step 3: Safety confirmation for live execution
    if (!DRY_RUN && !FORCE_EXECUTE) {
      console.log('\n⚠️  WARNING: This will create benefit statuses in the database for ALL USERS.');
      console.log(`   This operation will affect ${analysisResults.length} users and create up to ${allMissingStatuses.length} benefit statuses.`);
      console.log('   To proceed with actual execution, run with --force flag.');
      console.log('   To see what would be done without changes, run with --dry-run flag.');
      return;
    }

    // Step 4: Pre-execution duplicate check (batch processing for performance)
    console.log('\n🔍 Step 2: Double-checking for existing benefit statuses...');
    console.log(`   Checking ${allMissingStatuses.length} potential benefit statuses for duplicates...`);
    
    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;
    const safeToCreate = [];
    const skippedDueToDuplicates = [];
    
    for (let i = 0; i < allMissingStatuses.length; i += BATCH_SIZE) {
      const batch = allMissingStatuses.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allMissingStatuses.length / BATCH_SIZE);
      
      if (totalBatches > 1) {
        console.log(`   Processing batch ${batchNumber}/${totalBatches}...`);
      }
      
      const duplicateCheckPromises = batch.map(async (missing) => {
        const existing = await prisma.benefitStatus.findUnique({
          where: {
            benefitId_userId_cycleStartDate_occurrenceIndex: {
              benefitId: missing.benefitId,
              userId: missing.userId,
              cycleStartDate: missing.cycleStartDate,
              occurrenceIndex: missing.occurrenceIndex,
            }
          }
        });
        
        return {
          missing,
          hasExisting: !!existing,
          existingId: existing?.id
        };
      });

      const duplicateCheckResults = await Promise.allSettled(duplicateCheckPromises);
      
      // Filter results
      duplicateCheckResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.hasExisting) {
            skippedDueToDuplicates.push({
              ...result.value.missing,
              existingId: result.value.existingId
            });
          } else {
            safeToCreate.push(result.value.missing);
          }
        } else {
          console.error(`❌ Error checking duplicate for batch item ${index}:`, result.reason);
          // Skip this one to be safe
        }
      });
    }

    console.log(`\n🛡️  Safety Check Results:`);
    console.log(`   Safe to create: ${safeToCreate.length}`);
    console.log(`   Skipped due to duplicates: ${skippedDueToDuplicates.length}`);
    
    if (safeToCreate.length === 0) {
      console.log('\n🎉 All benefit statuses already exist. No backfill needed.');
      return;
    }

    // Step 5: Execute creation (or dry run) in batches
    console.log(`\n🚀 Step 3: ${DRY_RUN ? 'Simulating' : 'Executing'} benefit status creation...`);
    
    const successful = [];
    const failed = [];
    
    // Process creations in batches
    for (let i = 0; i < safeToCreate.length; i += BATCH_SIZE) {
      const batch = safeToCreate.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(safeToCreate.length / BATCH_SIZE);
      
      console.log(`   ${DRY_RUN ? 'Simulating' : 'Processing'} batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
      
      const creationPromises = batch.map(async (missing) => {
        const createData = {
          benefitId: missing.benefitId,
          userId: missing.userId,
          cycleStartDate: missing.cycleStartDate,
          cycleEndDate: missing.cycleEndDate,
          occurrenceIndex: missing.occurrenceIndex,
          isCompleted: false,
          isNotUsable: false,
        };

        if (DRY_RUN) {
          // Simulate the creation
          return {
            action: 'simulated',
            data: createData,
            benefitDescription: missing.benefitDescription,
            userEmail: missing.userEmail
          };
        } else {
          // Actually create the benefit status
          const created = await prisma.benefitStatus.create({
            data: createData
          });
          
          return {
            action: 'created',
            data: createData,
            createdId: created.id,
            benefitDescription: missing.benefitDescription,
            userEmail: missing.userEmail
          };
        }
      });

      // Use Promise.allSettled for safety (as required in backfill request)
      const creationResults = await Promise.allSettled(creationPromises);
      
      // Process batch results
      creationResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            batchIndex: i + index,
            missing: batch[index],
            error: result.reason
          });
        }
      });
      
      // Progress update
      console.log(`     Batch ${batchNumber}: ${creationResults.filter(r => r.status === 'fulfilled').length} successful, ${creationResults.filter(r => r.status === 'rejected').length} failed`);
    }

    // Step 6: Report results
    console.log(`\n📊 Execution Results:`);
    console.log(`   Successful: ${successful.length}`);
    console.log(`   Failed: ${failed.length}`);
    console.log(`   Skipped (duplicates): ${skippedDueToDuplicates.length}`);
    
    if (failed.length > 0) {
      console.log(`\n❌ Failed ${DRY_RUN ? 'simulations' : 'creations'} (first 10):`);
      failed.slice(0, 10).forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure.missing.benefitDescription}`);
        console.log(`      User: ${failure.missing.userEmail}`);
        console.log(`      Error: ${failure.error instanceof Error ? failure.error.message : failure.error}`);
      });
      if (failed.length > 10) {
        console.log(`   ... and ${failed.length - 10} more failures`);
      }
    }

    // Step 7: Final summary and verification
    console.log(`\n🎯 FINAL SUMMARY:`);
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE EXECUTION'}`);
    console.log(`   Users processed: ${analysisResults.length}`);
    console.log(`   Original missing count: ${allMissingStatuses.length}`);
    console.log(`   Skipped (duplicates): ${skippedDueToDuplicates.length}`);
    console.log(`   ${DRY_RUN ? 'Simulated' : 'Created'}: ${successful.length}`);
    console.log(`   Failed: ${failed.length}`);
    console.log(`   Completed at: ${new Date().toISOString()}`);
    
    if (!DRY_RUN && successful.length > 0) {
      console.log(`\n🔍 Post-execution verification recommended:`);
      console.log(`   Run analysis script again to verify results`);
      console.log(`   All created records have createdAt timestamps for potential rollback if needed`);
    }

    if (DRY_RUN) {
      console.log(`\n🚀 To execute for real, run: node scripts/august-2025-backfill-executor.cjs --force`);
    }

    return {
      usersProcessed: analysisResults.length,
      totalMissing: allMissingStatuses.length,
      skippedDuplicates: skippedDueToDuplicates.length,
      successful: successful.length,
      failed: failed.length,
      isDryRun: DRY_RUN
    };

  } catch (error) {
    console.error('\n❌ Backfill execution failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if called directly
if (require.main === module) {
  executeBenefitStatusBackfillAllUsers()
    .then(result => {
      if (result) {
        process.exit(result.failed > 0 ? 1 : 0);
      }
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { executeBenefitStatusBackfillAllUsers }; 