#!/usr/bin/env tsx

/**
 * Unified Card Benefit Update Script
 *
 * This script handles the complete process of updating card benefits:
 * 1. Updates predefined card templates (for new users)
 * 2. Migrates existing user cards (for current users)
 * 3. Creates benefit statuses (makes benefits visible in dashboard)
 *
 * USAGE:
 *   node scripts/update-card-benefits.js --card "Card Name" --dry-run
 *   node scripts/update-card-benefits.js --card "Card Name" --force
 */

import dotenv from 'dotenv';
import { PrismaClient, type Benefit, type CreditCard, type PredefinedBenefit } from '../src/generated/prisma';
import { materializeBenefitStatusRows } from '../src/lib/benefit-cycle-materialization';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

let cardName: string | null = null;
const cardArgIndex = args.findIndex((arg) => arg === '--card' || arg.startsWith('--card='));
if (cardArgIndex !== -1) {
  const cardArg = args[cardArgIndex];
  if (cardArg.startsWith('--card=')) {
    cardName = cardArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (cardArgIndex + 1 < args.length) {
    cardName = args[cardArgIndex + 1].replace(/^["']|["']$/g, '');
  }
}

type BenefitComparable = Pick<
  Benefit | PredefinedBenefit,
  | 'category'
  | 'description'
  | 'maxAmount'
  | 'percentage'
  | 'frequency'
  | 'cycleAlignment'
  | 'fixedCycleStartMonth'
  | 'fixedCycleDurationMonths'
  | 'occurrencesInCycle'
>;

function normalizeDescription(description: string): string {
  return description.toLowerCase().trim().replace(/\s+/g, ' ');
}

function benefitsMatch(existingBenefit: BenefitComparable, templateBenefit: BenefitComparable): boolean {
  return normalizeDescription(existingBenefit.description) === normalizeDescription(templateBenefit.description);
}

function benefitNeedsUpdate(existingBenefit: BenefitComparable, templateBenefit: BenefitComparable): boolean {
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

async function updatePredefinedCard(): Promise<boolean> {
  console.log('\nStep 1: Updating predefined card template...');

  if (isDryRun) {
    console.log('   DRY RUN: Would run seed command to update template');
    console.log('   Command: npx prisma db seed');
    return true;
  }

  console.log('   Make sure prisma/seed.ts has already been updated and seeded.');
  console.log('   Command: npx prisma db seed');
  return true;
}

async function migrateExistingUsers(): Promise<boolean> {
  console.log('\nStep 2: Migrating existing user cards...');

  if (!cardName) {
    throw new Error('Card name is required');
  }

  const predefinedCard = await prisma.predefinedCard.findUnique({
    where: { name: cardName },
    include: { benefits: true },
  });

  if (!predefinedCard) {
    console.error(`   Predefined card "${cardName}" not found`);
    return false;
  }

  const userCards = await prisma.creditCard.findMany({
    where: { name: cardName },
    include: {
      user: { select: { id: true } },
      benefits: true,
    },
  });

  console.log(`   Found ${userCards.length} existing user card(s)`);

  if (userCards.length === 0) {
    console.log('   No existing users to migrate');
    return true;
  }

  const templateBenefitCount = predefinedCard.benefits.length;
  const userBenefitCount = userCards[0]?.benefits.length ?? 0;

  console.log(`   Template has ${templateBenefitCount} benefits`);
  console.log(`   User cards have ${userBenefitCount} benefits`);

  let totalToAdd = 0;
  let totalToUpdate = 0;
  let totalToRemove = 0;

  for (const userCard of userCards) {
    const existing = userCard.benefits;
    const template = predefinedCard.benefits;

    const toAdd = template.filter((tb) => !existing.some((eb) => benefitsMatch(eb, tb)));
    const toUpdate = template.filter((tb) => {
      const match = existing.find((eb) => benefitsMatch(eb, tb));
      return match && benefitNeedsUpdate(match, tb);
    });
    const toRemove = existing.filter((eb) => !template.some((tb) => benefitsMatch(eb, tb)));

    totalToAdd += toAdd.length;
    totalToUpdate += toUpdate.length;
    totalToRemove += toRemove.length;
  }

  console.log(
    `   Changes per card: +${totalToAdd / userCards.length} benefits, ~${totalToUpdate / userCards.length} updates, -${totalToRemove / userCards.length} removals`
  );

  if (isDryRun) {
    console.log('\n   DRY RUN: Would update existing user cards without printing user data');
    console.log(`      Cards affected: ${userCards.length}`);
    return true;
  }

  console.log('   Updating user cards with smart diff...');

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

        const benefitsToAdd = templateBenefits.filter((tb) => !existingBenefits.some((eb) => benefitsMatch(eb, tb)));

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
            },
          });
          addedCount++;
        }

        for (const templateBenefit of templateBenefits) {
          const existingBenefit = existingBenefits.find((eb) => benefitsMatch(eb, templateBenefit));

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
              },
            });
            updatedCount++;
          }
        }

        const benefitsToRemove = existingBenefits.filter((eb) => !templateBenefits.some((tb) => benefitsMatch(eb, tb)));

        for (const benefitToRemove of benefitsToRemove) {
          await tx.benefit.delete({
            where: { id: benefitToRemove.id },
          });
          removedCount++;
        }
      });

      successCount++;
    } catch (error) {
      errorCount++;
      console.error(`   Failed for card ${userCard.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n   Migration Results:');
  console.log(`      Cards Updated: ${successCount}`);
  console.log(`      Benefits Added: ${addedCount}`);
  console.log(`      Benefits Updated: ${updatedCount}`);
  console.log(`      Benefits Removed: ${removedCount}`);
  console.log(`      Errors: ${errorCount}`);

  return errorCount === 0;
}

async function createBenefitStatuses(): Promise<boolean> {
  console.log('\nStep 3: Creating benefit statuses...');

  if (!cardName) {
    throw new Error('Card name is required');
  }

  const userCards = await prisma.creditCard.findMany({
    where: { name: cardName },
    include: {
      user: { select: { id: true } },
      benefits: {
        include: {
          benefitStatuses: true,
        },
      },
    },
  });

  const benefitsNeedingStatus: Array<{
    benefit: CreditCardWithBenefits['benefits'][number];
    card: CreditCardWithBenefits;
  }> = [];

  for (const card of userCards) {
    for (const benefit of card.benefits) {
      if (benefit.benefitStatuses.length === 0) {
        benefitsNeedingStatus.push({ benefit, card });
      }
    }
  }

  console.log(`   Found ${benefitsNeedingStatus.length} benefit(s) needing status records`);

  if (benefitsNeedingStatus.length === 0) {
    console.log('   All benefits already have statuses');
    return true;
  }

  const now = new Date();
  const statusesToCreate: Array<{
    benefitId: string;
    userId: string;
    cycleStartDate: Date;
    cycleEndDate: Date;
    occurrenceIndex: number;
    isCompleted: false;
  }> = [];

  for (const { benefit, card } of benefitsNeedingStatus) {
    try {
      const materialized = materializeBenefitStatusRows(
        {
          ...benefit,
          userId: card.user.id,
        },
        {
          referenceDate: now,
          cardOpenedDate: card.openedDate,
          validateCycles: true,
        }
      );

      for (const warning of materialized.warnings) {
        console.warn(`   Validation warning for benefit ${benefit.id}: ${warning}`);
      }

      for (const row of materialized.rows) {
        statusesToCreate.push({
          benefitId: row.benefitId,
          userId: row.userId,
          cycleStartDate: row.cycleStartDate,
          cycleEndDate: row.cycleEndDate,
          occurrenceIndex: row.occurrenceIndex,
          isCompleted: false,
        });
      }
    } catch (error) {
      console.error(`   Skipping status for benefit ${benefit.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (isDryRun) {
    console.log(`   DRY RUN: Would create ${statusesToCreate.length} benefit status record(s)`);
    return true;
  }

  const batchSize = 500;
  let createdCount = 0;

  for (let i = 0; i < statusesToCreate.length; i += batchSize) {
    const batch = statusesToCreate.slice(i, i + batchSize);

    try {
      await prisma.benefitStatus.createMany({
        data: batch,
        skipDuplicates: true,
      });
      createdCount += batch.length;

      if (statusesToCreate.length > batchSize) {
        console.log(`   Progress: ${createdCount}/${statusesToCreate.length} statuses created`);
      }
    } catch (error) {
      console.error(`   Failed to create batch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`   Created ${createdCount} benefit status record(s)`);
  return true;
}

type CreditCardWithBenefits = CreditCard & {
  user: { id: string };
  benefits: Array<
    Benefit & {
      benefitStatuses: Array<{ id: string }>;
    }
  >;
};

async function main(): Promise<void> {
  console.log('Credit Card Benefit Update Script');

  if (!cardName) {
    console.error('\nError: --card argument is required');
    console.log('\nUsage:');
    console.log('  node scripts/update-card-benefits.js --card "Card Name" --dry-run');
    console.log('  node scripts/update-card-benefits.js --card "Card Name" --force');
    process.exit(1);
  }

  if (!isDryRun && !isForce) {
    console.error('\nError: Either --dry-run or --force is required');
    process.exit(1);
  }

  console.log(`\nTarget Card: ${cardName}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);

  try {
    const step1Success = await updatePredefinedCard();
    if (!step1Success) throw new Error('Step 1 failed');

    const step2Success = await migrateExistingUsers();
    if (!step2Success) throw new Error('Step 2 failed');

    const step3Success = await createBenefitStatuses();
    if (!step3Success) throw new Error('Step 3 failed');

    console.log('\nSUCCESS - All steps completed');

    if (isDryRun) {
      console.log('This was a dry run. Run with --force to apply changes.');
    } else {
      console.log('All users now have the updated benefits in their dashboard.');
    }
  } catch (error) {
    console.error('\nERROR - Update failed');
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
