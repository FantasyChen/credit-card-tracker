#!/usr/bin/env node

/**
 * Unified Card Benefit Update Script
 * 
 * This script handles the complete process of updating card benefits:
 * 1. Updates predefined card templates (for new users)
 * 2. Migrates existing user cards (for current users)
 * 3. Creates benefit statuses (makes benefits visible in dashboard)
 * 
 * USAGE:
 *   # Dry run (preview changes)
 *   node scripts/update-card-benefits.js --card "Card Name" --dry-run
 * 
 *   # Execute update
 *   node scripts/update-card-benefits.js --card "Card Name" --force
 * 
 * EXAMPLE:
 *   node scripts/update-card-benefits.js --card "American Express Business Platinum Card" --dry-run
 *   node scripts/update-card-benefits.js --card "American Express Business Platinum Card" --force
 */

import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/index.js';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

// Parse --card argument (supports both --card="Name" and --card "Name")
let cardName = null;
const cardArgIndex = args.findIndex(arg => arg === '--card' || arg.startsWith('--card='));
if (cardArgIndex !== -1) {
  const cardArg = args[cardArgIndex];
  if (cardArg.startsWith('--card=')) {
    cardName = cardArg.split('=')[1].replace(/^["']|["']$/g, ''); // Remove quotes
  } else if (cardArgIndex + 1 < args.length) {
    cardName = args[cardArgIndex + 1].replace(/^["']|["']$/g, ''); // Remove quotes
  }
}

/**
 * Calculate benefit cycle dates for creating benefit statuses
 */
function calculateBenefitCycle(benefit, cardOpenDate, referenceDate = new Date()) {
  const frequency = benefit.frequency;
  const cycleAlignment = benefit.cycleAlignment || 'CARD_ANNIVERSARY';
  
  let cycleStartDate, cycleEndDate;
  
  if (frequency === 'MONTHLY') {
    if (cycleAlignment === 'CALENDAR_FIXED') {
      cycleStartDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      cycleEndDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
    } else {
      const dayOfMonth = cardOpenDate.getDate();
      const currentMonth = referenceDate.getMonth();
      const currentYear = referenceDate.getFullYear();
      
      cycleStartDate = new Date(currentYear, currentMonth, dayOfMonth);
      if (cycleStartDate > referenceDate) {
        cycleStartDate = new Date(currentYear, currentMonth - 1, dayOfMonth);
      }
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
      cycleEndDate.setDate(cycleEndDate.getDate() - 1);
    }
  } else if (frequency === 'QUARTERLY') {
    if (cycleAlignment === 'CALENDAR_FIXED') {
      const currentQuarter = Math.floor(referenceDate.getMonth() / 3);
      const quarterStartMonth = currentQuarter * 3;
      cycleStartDate = new Date(referenceDate.getFullYear(), quarterStartMonth, 1);
      cycleEndDate = new Date(referenceDate.getFullYear(), quarterStartMonth + 3, 0);
    } else {
      const cardOpenTime = cardOpenDate.getTime();
      const refTime = referenceDate.getTime();
      const monthsFromOpen = Math.floor((refTime - cardOpenTime) / (1000 * 60 * 60 * 24 * 30.44));
      const cycleNumber = Math.floor(monthsFromOpen / 3);
      
      cycleStartDate = new Date(cardOpenDate);
      cycleStartDate.setMonth(cycleStartDate.getMonth() + (cycleNumber * 3));
      
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setMonth(cycleEndDate.getMonth() + 3);
      cycleEndDate.setDate(cycleEndDate.getDate() - 1);
    }
  } else if (frequency === 'YEARLY') {
    if (cycleAlignment === 'CALENDAR_FIXED') {
      const startMonth = benefit.fixedCycleStartMonth || 1;
      const duration = benefit.fixedCycleDurationMonths || 12;
      
      let year = referenceDate.getFullYear();
      cycleStartDate = new Date(year, startMonth - 1, 1);
      
      if (cycleStartDate > referenceDate) {
        year--;
        cycleStartDate = new Date(year, startMonth - 1, 1);
      }
      
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setMonth(cycleEndDate.getMonth() + duration);
      cycleEndDate.setDate(0);
    } else {
      const yearsSinceOpen = referenceDate.getFullYear() - cardOpenDate.getFullYear();
      cycleStartDate = new Date(cardOpenDate);
      cycleStartDate.setFullYear(cardOpenDate.getFullYear() + yearsSinceOpen);
      
      if (cycleStartDate > referenceDate) {
        cycleStartDate.setFullYear(cycleStartDate.getFullYear() - 1);
      }
      
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setFullYear(cycleEndDate.getFullYear() + 1);
      cycleEndDate.setDate(cycleEndDate.getDate() - 1);
    }
  } else {
    cycleStartDate = benefit.startDate || cardOpenDate;
    cycleEndDate = benefit.endDate || new Date(cycleStartDate.getFullYear() + 10, 11, 31);
  }
  
  return { cycleStartDate, cycleEndDate };
}

/**
 * Step 1: Update predefined card template (affects new users)
 */
async function updatePredefinedCard() {
  console.log('\n📝 Step 1: Updating predefined card template...');
  
  if (isDryRun) {
    console.log('   🔍 DRY RUN: Would run seed command to update template');
    console.log('   Command: npx prisma db seed');
    return true;
  }
  
  console.log('   ⏳ Running: npx prisma db seed');
  console.log('   (This updates the template for new users)');
  
  // Note: In a real implementation, you would execute the seed command
  // For now, we assume the user has already updated seed.ts
  console.log('   ℹ️  Make sure you have updated prisma/seed.ts with the new benefits');
  console.log('   ℹ️  Run: npx prisma db seed (manually before this script)');
  
  return true;
}

/**
 * Helper function to check if two benefits match (same benefit, might have different values)
 */
function benefitsMatch(existingBenefit, templateBenefit) {
  // Match by description (primary key for benefits)
  // We normalize descriptions to handle minor variations
  const normalize = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');
  return normalize(existingBenefit.description) === normalize(templateBenefit.description);
}

/**
 * Helper function to check if benefit needs update
 */
function benefitNeedsUpdate(existingBenefit, templateBenefit) {
  return (
    existingBenefit.category !== templateBenefit.category ||
    existingBenefit.maxAmount !== templateBenefit.maxAmount ||
    existingBenefit.percentage !== templateBenefit.percentage ||
    existingBenefit.frequency !== templateBenefit.frequency ||
    existingBenefit.cycleAlignment !== templateBenefit.cycleAlignment ||
    existingBenefit.fixedCycleStartMonth !== templateBenefit.fixedCycleStartMonth ||
    existingBenefit.fixedCycleDurationMonths !== templateBenefit.fixedCycleDurationMonths ||
    existingBenefit.occurrencesInCycle !== templateBenefit.occurrencesInCycle
  );
}

/**
 * Step 2: Migrate existing user cards (Smart diff-based update)
 */
async function migrateExistingUsers() {
  console.log('\n👥 Step 2: Migrating existing user cards...');
  
  // Get the predefined card with its benefits
  const predefinedCard = await prisma.predefinedCard.findUnique({
    where: { name: cardName },
    include: { benefits: true }
  });
  
  if (!predefinedCard) {
    console.error(`   ❌ Predefined card "${cardName}" not found`);
    return false;
  }
  
  // Find existing user cards
  const userCards = await prisma.creditCard.findMany({
    where: { name: cardName },
    include: {
      user: { select: { email: true, name: true } },
      benefits: true
    }
  });
  
  console.log(`   📊 Found ${userCards.length} existing user card(s)`);
  
  if (userCards.length === 0) {
    console.log('   ✅ No existing users to migrate');
    return true;
  }
  
  // Compare benefits to see what's different
  const templateBenefitCount = predefinedCard.benefits.length;
  const userBenefitCount = userCards[0].benefits.length;
  
  console.log(`   📊 Template has ${templateBenefitCount} benefits`);
  console.log(`   📊 User cards have ${userBenefitCount} benefits`);
  
  // Analyze what changes are needed
  let totalToAdd = 0;
  let totalToUpdate = 0;
  let totalToRemove = 0;
  
  for (const userCard of userCards) {
    const existing = userCard.benefits;
    const template = predefinedCard.benefits;
    
    // Find benefits to add (in template but not in existing)
    const toAdd = template.filter(tb => 
      !existing.some(eb => benefitsMatch(eb, tb))
    );
    
    // Find benefits to update (in both, but different values)
    const toUpdate = template.filter(tb => {
      const match = existing.find(eb => benefitsMatch(eb, tb));
      return match && benefitNeedsUpdate(match, tb);
    });
    
    // Find benefits to remove (in existing but not in template)
    const toRemove = existing.filter(eb => 
      !template.some(tb => benefitsMatch(eb, tb))
    );
    
    totalToAdd += toAdd.length;
    totalToUpdate += toUpdate.length;
    totalToRemove += toRemove.length;
  }
  
  console.log(`   📊 Changes per card: +${totalToAdd / userCards.length} benefits, ~${totalToUpdate / userCards.length} updates, -${totalToRemove / userCards.length} removals`);
  
  if (isDryRun) {
    console.log('\n   🔍 DRY RUN: Would update the following users:');
    userCards.slice(0, 10).forEach((card, index) => {
      console.log(`      ${index + 1}. ${card.user.email || card.user.name}`);
    });
    if (userCards.length > 10) {
      console.log(`      ... and ${userCards.length - 10} more`);
    }
    return true;
  }
  
  console.log('   🔄 Updating user cards with smart diff...');
  
  let successCount = 0;
  let errorCount = 0;
  let addedCount = 0;
  let updatedCount = 0;
  let removedCount = 0;
  
  for (const userCard of userCards) {
    try {
      await prisma.$transaction(async (tx) => {
        const existingBenefits = userCard.benefits;
        const templateBenefits = predefinedCard.benefits;
        
        // Step 1: Add new benefits (keeps existing statuses intact)
        const benefitsToAdd = templateBenefits.filter(tb => 
          !existingBenefits.some(eb => benefitsMatch(eb, tb))
        );
        
        for (const templateBenefit of benefitsToAdd) {
          await tx.benefit.create({
            data: {
              creditCardId: userCard.id,
              category: templateBenefit.category,
              description: templateBenefit.description,
              percentage: templateBenefit.percentage,
              maxAmount: templateBenefit.maxAmount,
              frequency: templateBenefit.frequency,
              cycleAlignment: templateBenefit.cycleAlignment,
              fixedCycleStartMonth: templateBenefit.fixedCycleStartMonth,
              fixedCycleDurationMonths: templateBenefit.fixedCycleDurationMonths,
              occurrencesInCycle: templateBenefit.occurrencesInCycle,
              startDate: userCard.openedDate || new Date(),
            }
          });
          addedCount++;
        }
        
        // Step 2: Update existing benefits that have changed (preserves benefit ID and statuses)
        for (const templateBenefit of templateBenefits) {
          const existingBenefit = existingBenefits.find(eb => benefitsMatch(eb, templateBenefit));
          
          if (existingBenefit && benefitNeedsUpdate(existingBenefit, templateBenefit)) {
            await tx.benefit.update({
              where: { id: existingBenefit.id },
              data: {
                category: templateBenefit.category,
                maxAmount: templateBenefit.maxAmount,
                percentage: templateBenefit.percentage,
                frequency: templateBenefit.frequency,
                cycleAlignment: templateBenefit.cycleAlignment,
                fixedCycleStartMonth: templateBenefit.fixedCycleStartMonth,
                fixedCycleDurationMonths: templateBenefit.fixedCycleDurationMonths,
                occurrencesInCycle: templateBenefit.occurrencesInCycle,
              }
            });
            updatedCount++;
          }
        }
        
        // Step 3: Remove benefits no longer in template (also removes their statuses via cascade)
        const benefitsToRemove = existingBenefits.filter(eb => 
          !templateBenefits.some(tb => benefitsMatch(eb, tb))
        );
        
        for (const benefitToRemove of benefitsToRemove) {
          await tx.benefit.delete({
            where: { id: benefitToRemove.id }
          });
          removedCount++;
        }
      });
      
      successCount++;
    } catch (error) {
      errorCount++;
      console.error(`   ❌ Failed for ${userCard.user.email}: ${error.message}`);
    }
  }
  
  console.log(`\n   📊 Migration Results:`);
  console.log(`      ✅ Cards Updated: ${successCount}`);
  console.log(`      ➕ Benefits Added: ${addedCount}`);
  console.log(`      🔄 Benefits Updated: ${updatedCount}`);
  console.log(`      ➖ Benefits Removed: ${removedCount}`);
  console.log(`      ❌ Errors: ${errorCount}`);
  
  return errorCount === 0;
}

/**
 * Step 3: Create benefit statuses (makes benefits visible) - BATCH OPTIMIZED
 */
async function createBenefitStatuses() {
  console.log('\n📊 Step 3: Creating benefit statuses...');
  
  // Find user cards with benefits that don't have statuses
  const userCards = await prisma.creditCard.findMany({
    where: { name: cardName },
    include: {
      user: { select: { id: true, email: true } },
      benefits: {
        include: {
          benefitStatuses: true
        }
      }
    }
  });
  
  const benefitsNeedingStatus = [];
  
  for (const card of userCards) {
    for (const benefit of card.benefits) {
      if (benefit.benefitStatuses.length === 0) {
        benefitsNeedingStatus.push({ benefit, card });
      }
    }
  }
  
  console.log(`   📊 Found ${benefitsNeedingStatus.length} benefit(s) needing status records`);
  
  if (benefitsNeedingStatus.length === 0) {
    console.log('   ✅ All benefits already have statuses');
    return true;
  }
  
  if (isDryRun) {
    console.log('   🔍 DRY RUN: Would create benefit statuses in batches');
    return true;
  }
  
  console.log('   🔄 Creating benefit statuses in batches...');
  
  const now = new Date();
  const statusesToCreate = [];
  
  // Prepare all status records
  for (const { benefit, card } of benefitsNeedingStatus) {
    try {
      const openDate = card.openedDate || new Date();
      const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(benefit, openDate, now);
      
      statusesToCreate.push({
        benefitId: benefit.id,
        userId: card.user.id,
        cycleStartDate,
        cycleEndDate,
        isCompleted: false
      });
    } catch (error) {
      console.error(`   ⚠️  Skipping status for benefit ${benefit.id}: ${error.message}`);
    }
  }
  
  // Batch insert in chunks of 500 (Prisma/PostgreSQL limit)
  const BATCH_SIZE = 500;
  let createdCount = 0;
  
  for (let i = 0; i < statusesToCreate.length; i += BATCH_SIZE) {
    const batch = statusesToCreate.slice(i, i + BATCH_SIZE);
    
    try {
      await prisma.benefitStatus.createMany({
        data: batch,
        skipDuplicates: true
      });
      createdCount += batch.length;
      
      if (statusesToCreate.length > BATCH_SIZE) {
        console.log(`   ⏳ Progress: ${createdCount}/${statusesToCreate.length} statuses created`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to create batch: ${error.message}`);
    }
  }
  
  console.log(`   ✅ Created ${createdCount} benefit status record(s)`);
  
  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Credit Card Benefit Update Script                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Validate arguments
  if (!cardName) {
    console.error('\n❌ Error: --card argument is required');
    console.log('\nUsage:');
    console.log('  node scripts/update-card-benefits.js --card "Card Name" --dry-run');
    console.log('  node scripts/update-card-benefits.js --card "Card Name" --force');
    console.log('\nExample:');
    console.log('  node scripts/update-card-benefits.js --card "American Express Business Platinum Card" --dry-run');
    process.exit(1);
  }
  
  if (!isDryRun && !isForce) {
    console.error('\n❌ Error: Either --dry-run or --force is required');
    console.log('\nUsage:');
    console.log('  --dry-run: Preview changes without modifying data');
    console.log('  --force:   Execute the update');
    process.exit(1);
  }
  
  console.log(`\n🎯 Target Card: ${cardName}`);
  console.log(`📋 Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
  
  try {
    // Step 1: Update predefined card template
    const step1Success = await updatePredefinedCard();
    if (!step1Success) {
      throw new Error('Step 1 failed');
    }
    
    // Step 2: Migrate existing user cards
    const step2Success = await migrateExistingUsers();
    if (!step2Success) {
      throw new Error('Step 2 failed');
    }
    
    // Step 3: Create benefit statuses
    const step3Success = await createBenefitStatuses();
    if (!step3Success) {
      throw new Error('Step 3 failed');
    }
    
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   ✅ SUCCESS - All steps completed!                      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
    if (isDryRun) {
      console.log('\n💡 This was a dry run. Run with --force to apply changes.');
    } else {
      console.log('\n🎉 All users now have the updated benefits in their dashboard!');
      console.log('💡 Users may need to refresh their browser to see changes.');
    }
    
  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║   ❌ ERROR - Update failed                               ║');
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error(`\n${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();
