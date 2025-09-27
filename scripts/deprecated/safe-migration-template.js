#!/usr/bin/env node

/**
 * SAFE MIGRATION TEMPLATE
 * 
 * This template shows how future migrations should work to prevent 
 * the September 2025 quarterly benefit issue from happening again.
 * 
 * Key Principles:
 * 1. Create Benefit AND BenefitStatus records in the same transaction
 * 2. Validate all quarterly/monthly alignments before committing
 * 3. Never rely on separate cron jobs for critical data consistency
 */

import { PrismaClient } from '../src/generated/prisma/index.js';
import { validateBenefitCycle } from '../src/lib/benefit-validation.js';
import { calculateBenefitCycle } from '../src/lib/benefit-cycle.js';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function safeMigrationExample() {
  console.log('🔒 SAFE MIGRATION TEMPLATE');
  console.log('=========================');
  console.log('This shows how to prevent the Q3→Q1 date assignment bug\n');

  const isDryRun = process.argv.includes('--dry-run');
  
  try {
    // Example: Migrating a single user's benefits
    const userCard = await prisma.creditCard.findFirst({
      where: { id: 'example-card-id' },
      include: { user: true }
    });

    if (!userCard) {
      console.log('No example card found for demo');
      return;
    }

    console.log(`📋 Migrating benefits for: ${userCard.user.email}`);
    
    // Example new benefits to add
    const newBenefitsToAdd = [
      {
        category: 'Travel',
        description: '$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)',
        percentage: 0,
        maxAmount: 100,
        frequency: 'YEARLY',
        cycleAlignment: 'CALENDAR_FIXED',
        fixedCycleStartMonth: 7,  // July 
        fixedCycleDurationMonths: 3, // 3 months (Jul-Sep)
        occurrencesInCycle: 1
      },
      {
        category: 'Transportation', 
        description: '$20 Additional Uber Cash (December)',
        percentage: 0,
        maxAmount: 20,
        frequency: 'YEARLY',
        cycleAlignment: 'CALENDAR_FIXED', 
        fixedCycleStartMonth: 12, // December
        fixedCycleDurationMonths: 1,  // 1 month  
        occurrencesInCycle: 1
      }
    ];

    if (isDryRun) {
      console.log('\n🔍 DRY RUN - Validating benefit cycles:');
      console.log('=====================================');
    }

    const now = new Date();
    const results = [];

    for (const benefitData of newBenefitsToAdd) {
      console.log(`\n📊 Processing: ${benefitData.description}`);
      
      // Step 1: Calculate the cycle for this benefit
      const cycleInfo = calculateBenefitCycle(
        benefitData.frequency,
        now,
        userCard.openedDate,
        benefitData.cycleAlignment,
        benefitData.fixedCycleStartMonth,
        benefitData.fixedCycleDurationMonths
      );

      console.log(`   📅 Calculated cycle: ${cycleInfo.cycleStartDate.toISOString().split('T')[0]} → ${cycleInfo.cycleEndDate.toISOString().split('T')[0]}`);

      // Step 2: VALIDATE before creating (this prevents the bug!)
      const validation = validateBenefitCycle(benefitData, cycleInfo);
      
      if (!validation.isValid) {
        console.log(`   ❌ VALIDATION FAILED: ${validation.error}`);
        throw new Error(`Migration aborted: ${validation.error}`);
      } else {
        console.log(`   ✅ Validation passed`);
      }

      // Step 3: Additional specific validation for current date
      if (benefitData.description.includes('Q3: Jul-Sep')) {
        const isActiveNow = now >= cycleInfo.cycleStartDate && now <= cycleInfo.cycleEndDate;
        if (now.getMonth() >= 6 && now.getMonth() <= 8 && !isActiveNow) {
          throw new Error(`Q3 benefit should be active in September but isn't: ${cycleInfo.cycleStartDate} - ${cycleInfo.cycleEndDate}`);
        }
        console.log(`   ✅ Q3 benefit correctly ${isActiveNow ? 'ACTIVE' : 'INACTIVE'} for current date`);
      }

      results.push({
        benefitData,
        cycleInfo,
        validation
      });
    }

    if (isDryRun) {
      console.log('\n✅ DRY RUN COMPLETED - All validations passed!');
      console.log('Migration would be safe to execute with --force');
      return;
    }

    // Step 4: Execute the migration in a single transaction
    console.log('\n🚀 Executing migration with validation...');
    
    await prisma.$transaction(async (tx) => {
      for (const result of results) {
        console.log(`   Creating: ${result.benefitData.description}`);
        
        // Create the benefit
        const newBenefit = await tx.benefit.create({
          data: {
            creditCardId: userCard.id,
            category: result.benefitData.category,
            description: result.benefitData.description,
            percentage: result.benefitData.percentage,
            maxAmount: result.benefitData.maxAmount,
            frequency: result.benefitData.frequency,
            cycleAlignment: result.benefitData.cycleAlignment,
            fixedCycleStartMonth: result.benefitData.fixedCycleStartMonth,
            fixedCycleDurationMonths: result.benefitData.fixedCycleDurationMonths,
            occurrencesInCycle: result.benefitData.occurrencesInCycle,
            startDate: now
          }
        });

        // Create BenefitStatus records IMMEDIATELY (no gap for bugs!)
        const occurrences = result.benefitData.occurrencesInCycle || 1;
        for (let i = 0; i < occurrences; i++) {
          await tx.benefitStatus.create({
            data: {
              benefitId: newBenefit.id,
              userId: userCard.userId,
              cycleStartDate: result.cycleInfo.cycleStartDate,
              cycleEndDate: result.cycleInfo.cycleEndDate,
              occurrenceIndex: i,
              isCompleted: false
            }
          });
        }
        
        console.log(`   ✅ Created benefit + ${occurrences} status record(s)`);
      }
    });

    console.log('\n🎉 SAFE MIGRATION COMPLETED!');
    console.log('✅ All benefits and statuses created with validation');
    console.log('✅ No vulnerability gap - no reliance on cron jobs');
    console.log('✅ Quarterly alignments verified before commit');

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error('✅ This is good - validation prevented bad data!');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  safeMigrationExample().catch(console.error);
}
