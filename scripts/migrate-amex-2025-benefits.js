#!/usr/bin/env node

/**
 * AMEX Platinum 2025 Benefits Migration Script
 * 
 * This script migrates existing users who have AMEX Platinum or Business Platinum cards
 * to the new 2025 benefit structure announced on September 18, 2025.
 * 
 * COMPLETED: September 18, 2025 - Successfully migrated 280 cards across all users
 * 
 * Changes:
 * - Annual fee: $695 → $895
 * - New benefits added (Resy dining, Lululemon, enhanced hotel credits, etc.)
 * - Some old benefits updated or replaced
 * 
 * Usage: node scripts/migrate-amex-2025-benefits.js [--dry-run] [--force] [--user-email=email]
 */

import { PrismaClient } from '../src/generated/prisma/index.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Command line arguments
const isDryRun = process.argv.includes('--dry-run');
const isForce = process.argv.includes('--force');
const userEmailArg = process.argv.find(arg => arg.startsWith('--user-email='));
const filterUserEmail = userEmailArg ? userEmailArg.split('=')[1] : null;

console.log('🚀 AMEX 2025 Benefits Migration Script');
console.log('=====================================');
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
console.log(`Force mode: ${isForce ? 'ON' : 'OFF'}`);
console.log(`User filter: ${filterUserEmail || 'ALL USERS'}\n`);

async function main() {
  try {
    // Safety check
    if (!isDryRun && !isForce) {
      console.log('⚠️  This will modify production data. Use --force to proceed or --dry-run to preview.');
      process.exit(1);
    }

    console.log('🔍 Checking database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully\n');

    // Get predefined benefits for both AMEX cards
    console.log('📋 Loading predefined AMEX benefits...');
    const predefinedCards = await prisma.predefinedCard.findMany({
      where: {
        name: {
          in: [
            'American Express Platinum Card',
            'American Express Business Platinum Card'
          ]
        }
      },
      include: {
        benefits: true
      }
    });

    // Create mapping of card name to benefits
    const predefinedBenefitsMap = {};
    predefinedCards.forEach(card => {
      predefinedBenefitsMap[card.name] = card.benefits;
    });

    console.log('✅ Predefined benefits loaded:\n');
    Object.keys(predefinedBenefitsMap).forEach(cardName => {
      console.log(`   ${cardName}: ${predefinedBenefitsMap[cardName].length} benefits`);
    });

    // Find all users with AMEX Platinum cards (by name matching)
    console.log(`\n🔎 Finding users with AMEX Platinum cards${filterUserEmail ? ` (filtered by: ${filterUserEmail})` : ''}...`);
    
    const whereClause = {
      AND: [
        {
          issuer: 'American Express'
        },
        {
          name: {
            in: [
              'American Express Platinum Card',
              'American Express Business Platinum Card'
            ]
          }
        }
      ]
    };

    // Add user email filter if specified
    if (filterUserEmail) {
      whereClause.AND.push({
        user: {
          email: filterUserEmail
        }
      });
    }

    const amexPlatinumCards = await prisma.creditCard.findMany({
      where: whereClause,
      include: {
        benefits: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    console.log(`Found ${amexPlatinumCards.length} AMEX Platinum cards belonging to users:\n`);

    // Group by card type for reporting
    const cardStats = {};
    amexPlatinumCards.forEach(card => {
      const cardName = card.name; // Use the card's name field directly
      if (!cardStats[cardName]) {
        cardStats[cardName] = { count: 0, users: [] };
      }
      cardStats[cardName].count++;
      cardStats[cardName].users.push(card.user.email);
    });

    Object.keys(cardStats).forEach(cardName => {
      console.log(`📊 ${cardName}:`);
      console.log(`   - ${cardStats[cardName].count} cards`);
      console.log(`   - Users: ${cardStats[cardName].users.join(', ')}\n`);
    });

    if (amexPlatinumCards.length === 0) {
      console.log('ℹ️  No AMEX Platinum cards found. Nothing to migrate.');
      return;
    }

    if (isDryRun) {
      console.log('🔍 DRY RUN - Preview of changes:');
      for (const userCard of amexPlatinumCards) {
        const cardName = userCard.name; // Use the card's name field directly
        const newBenefits = predefinedBenefitsMap[cardName];
        
        console.log(`\n🔄 Would process: ${cardName} for ${userCard.user.email}`);
        console.log(`   Card ID: ${userCard.id}`);
        console.log(`   Current benefits: ${userCard.benefits.length}`);
        console.log(`   New benefits: ${newBenefits ? newBenefits.length : 'N/A'}`);
      }
      console.log('\n✅ Dry run completed. Use --force to apply changes.');
      return;
    }

    // Apply migrations
    console.log('🚀 Starting migration process...\n');
    
    let successCount = 0;
    let failureCount = 0;

    for (const userCard of amexPlatinumCards) {
      const cardName = userCard.name; // Use the card's name field directly
      const newBenefits = predefinedBenefitsMap[cardName];
      
      console.log(`\n🔄 Processing: ${cardName} for ${userCard.user.email}`);
      console.log(`   Card ID: ${userCard.id}`);
      console.log(`   Current benefits: ${userCard.benefits.length}`);
      console.log(`   New benefits: ${newBenefits ? newBenefits.length : 'N/A'}`);

      if (!newBenefits || newBenefits.length === 0) {
        console.log('   ❌ No predefined benefits found for this card type');
        failureCount++;
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          // First, update the annual fee to $895
          await tx.creditCard.update({
            where: { id: userCard.id },
            data: { annualFee: 895 }
          });

          // Delete existing benefits and their benefit statuses
          await tx.benefit.deleteMany({
            where: { creditCardId: userCard.id }
          });

          // Create new benefits based on updated predefined benefits
          const benefitsToCreate = newBenefits.map(predefinedBenefit => ({
            creditCardId: userCard.id,
            category: predefinedBenefit.category,
            description: predefinedBenefit.description,
            percentage: predefinedBenefit.percentage,
            maxAmount: predefinedBenefit.maxAmount,
            frequency: predefinedBenefit.frequency,
            cycleAlignment: predefinedBenefit.cycleAlignment || 'CARD_ANNIVERSARY',
            fixedCycleStartMonth: predefinedBenefit.fixedCycleStartMonth,
            fixedCycleDurationMonths: predefinedBenefit.fixedCycleDurationMonths,
            occurrencesInCycle: predefinedBenefit.occurrencesInCycle || 1,
            startDate: userCard.openedDate || new Date(), // Required field - use card opening date or current date
          }));

          await tx.benefit.createMany({
            data: benefitsToCreate
          });
        });

        console.log(`   ✅ Migrated ${newBenefits.length} benefits`);
        successCount++;

      } catch (error) {
        console.log(`   ❌ Migration failed: ${error.message}`);
        failureCount++;
      }
    }

    // Summary
    console.log('\n📊 Migration Summary');
    console.log('===================');
    console.log(`Cards processed: ${amexPlatinumCards.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Skipped/Failed: ${failureCount}`);

    if (failureCount === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. The daily cron job will generate new BenefitStatus records');
      console.log('2. Users will see updated benefits in their dashboard');
      console.log('3. Monitor for any issues in the next 24 hours');
    } else {
      console.log('\n⚠️  Migration completed with some failures. Review the logs above.');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

