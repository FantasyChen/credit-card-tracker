/**
 * Benefit Migration Engine
 * 
 * Automated, safe migration system for credit card benefit updates
 */

import { prisma } from '@/lib/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';
import { validateBenefitCycle } from '@/lib/benefit-validation';
import { normalizeCycleDate } from '@/lib/dateUtils';
import { BenefitFrequency } from '@/generated/prisma';
import type {
  MigrationPlan,
  MigrationResult,
  MigrationOptions,
  MigrationError,
  PreMigrationCheck,
  UserMigrationContext,
  UserMigrationPlan,
  BenefitMigrationStep,
  CardUpdateDefinition
} from './types';

export class BenefitMigrationEngine {
  private options: MigrationOptions;
  private errors: MigrationError[] = [];
  private warnings: string[] = [];

  constructor(options: Partial<MigrationOptions> = {}) {
    this.options = {
      dryRun: true,
      force: false,
      batchSize: 10,
      stopOnFirstError: false,
      preserveUserActions: true,
      validateCycles: true,
      backupUserData: false,
      ...options
    };
  }

  /**
   * Execute a complete migration plan
   */
  async executeMigration(plan: MigrationPlan): Promise<MigrationResult> {
    console.log(`🚀 ${this.options.dryRun ? 'DRY RUN' : 'LIVE'} Migration: ${plan.title}`);
    console.log(`📋 Version: ${plan.version}`);
    console.log(`📅 Created: ${plan.createdAt.toISOString()}`);
    
    this.errors = [];
    this.warnings = [];
    
    try {
      // Step 1: Pre-migration checks
      console.log('\n🔍 Running pre-migration checks...');
      const preChecks = await this.runPreMigrationChecks(plan);
      const failedChecks = preChecks.filter(check => check.status === 'fail');
      
      if (failedChecks.length > 0 && !this.options.force) {
        // Convert failed checks to migration errors
        for (const check of failedChecks) {
          this.errors.push({
            type: check.checkType === 'benefit_validation' ? 'validation' : 'database',
            message: check.message,
            details: check.details
          });
        }
        throw new Error(`Pre-migration checks failed: ${failedChecks.map(c => c.message).join(', ')}`);
      }

      // Step 2: Update predefined card templates
      console.log('\n📝 Updating predefined card templates...');
      await this.updatePredefinedCards(plan.cardUpdates);

      // Step 3: Find and migrate existing user cards
      console.log('\n👥 Finding existing user cards...');
      let totalAffectedUsers = 0;
      let totalAffectedCards = 0;
      let totalBenefitsCreated = 0;
      let totalBenefitsDeleted = 0;

      for (const cardUpdate of plan.cardUpdates) {
        const result = await this.migrateUsersForCard(cardUpdate);
        totalAffectedUsers += result.affectedUsers;
        totalAffectedCards += result.affectedCards;
        totalBenefitsCreated += result.benefitsCreated;
        totalBenefitsDeleted += result.benefitsDeleted;
      }

      const result: MigrationResult = {
        success: this.errors.length === 0,
        affectedUsers: totalAffectedUsers,
        affectedCards: totalAffectedCards,
        benefitsCreated: totalBenefitsCreated,
        benefitsDeleted: totalBenefitsDeleted,
        errors: this.errors,
        warnings: this.warnings,
        summary: this.generateSummary(totalAffectedUsers, totalAffectedCards, totalBenefitsCreated, totalBenefitsDeleted)
      };

      console.log('\n📊 Migration Summary:');
      console.log(result.summary);

      if (result.errors.length > 0) {
        console.log(`\n❌ Errors: ${result.errors.length}`);
        result.errors.slice(0, 5).forEach(error => {
          console.log(`   - ${error.type}: ${error.message}`);
        });
      }

      if (result.warnings.length > 0) {
        console.log(`\n⚠️  Warnings: ${result.warnings.length}`);
        result.warnings.slice(0, 5).forEach(warning => {
          console.log(`   - ${warning}`);
        });
      }

      return result;

    } catch (error) {
      this.errors.push({
        type: 'database',
        message: error instanceof Error ? error.message : 'Unknown error during migration',
        details: { error }
      });

      return {
        success: false,
        affectedUsers: 0,
        affectedCards: 0,
        benefitsCreated: 0,
        benefitsDeleted: 0,
        errors: this.errors,
        warnings: this.warnings,
        summary: 'Migration failed due to errors'
      };
    }
  }

  /**
   * Run comprehensive pre-migration checks
   */
  private async runPreMigrationChecks(plan: MigrationPlan): Promise<PreMigrationCheck[]> {
    const checks: PreMigrationCheck[] = [];

    // Check 1: Count affected users
    for (const cardUpdate of plan.cardUpdates) {
      const userCount = await this.countAffectedUsers(cardUpdate.cardName);
      checks.push({
        checkType: 'user_count',
        status: 'pass',
        message: `Found ${userCount} users with "${cardUpdate.cardName}" cards`,
        details: { cardName: cardUpdate.cardName, userCount }
      });
    }

    // Check 2: Validate all benefit definitions
    for (const cardUpdate of plan.cardUpdates) {
      for (const benefit of cardUpdate.benefits) {
        try {
          // Test cycle calculation with mock data
          const mockCardOpenDate = new Date('2024-01-15'); // Use a reasonable test date
          const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
            benefit.frequency,
            new Date(),
            benefit.frequency === BenefitFrequency.YEARLY ? mockCardOpenDate : null,
            benefit.cycleAlignment,
            benefit.fixedCycleStartMonth,
            benefit.fixedCycleDurationMonths
          );

          const validation = validateBenefitCycle(
            {
              description: benefit.description,
              fixedCycleStartMonth: benefit.fixedCycleStartMonth,
              fixedCycleDurationMonths: benefit.fixedCycleDurationMonths
            },
            { cycleStartDate, cycleEndDate }
          );

          if (!validation.isValid) {
            checks.push({
              checkType: 'benefit_validation',
              status: 'fail',
              message: `Benefit validation failed: ${validation.error}`,
              details: { benefit, validation }
            });
          } else {
            checks.push({
              checkType: 'benefit_validation',
              status: 'pass',
              message: `Benefit "${benefit.description}" validation passed`,
              details: { benefit, cycleStartDate, cycleEndDate }
            });
          }

        } catch (error) {
          checks.push({
            checkType: 'cycle_calculation',
            status: 'fail',
            message: `Cycle calculation failed for benefit: ${benefit.description}`,
            details: { benefit, error: error instanceof Error ? error.message : error }
          });
        }
      }
    }

    return checks;
  }

  /**
   * Update predefined card templates (affects new users)
   */
  private async updatePredefinedCards(cardUpdates: CardUpdateDefinition[]): Promise<void> {
    if (this.options.dryRun) {
      console.log('   🔍 DRY RUN: Would update predefined cards');
      return;
    }

    for (const cardUpdate of cardUpdates) {
      try {
        // Find existing predefined card
        const existingCard = await prisma.predefinedCard.findUnique({
          where: { name: cardUpdate.cardName },
          include: { benefits: true }
        });

        if (!existingCard) {
          this.warnings.push(`Predefined card "${cardUpdate.cardName}" not found - creating new one`);
          
          // Create new predefined card
          await prisma.predefinedCard.create({
            data: {
              name: cardUpdate.cardName,
              issuer: cardUpdate.issuer,
              annualFee: cardUpdate.newAnnualFee || 0,
              benefits: {
                create: cardUpdate.benefits.map(benefit => ({
                  category: benefit.category,
                  description: benefit.description,
                  percentage: benefit.percentage,
                  maxAmount: benefit.maxAmount,
                  frequency: benefit.frequency,
                  cycleAlignment: benefit.cycleAlignment,
                  fixedCycleStartMonth: benefit.fixedCycleStartMonth,
                  fixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
                  occurrencesInCycle: benefit.occurrencesInCycle || 1
                }))
              }
            }
          });
        } else {
          // Update existing predefined card
          await prisma.predefinedCard.update({
            where: { id: existingCard.id },
            data: {
              annualFee: cardUpdate.newAnnualFee || existingCard.annualFee,
              updatedAt: new Date(),
              benefits: {
                deleteMany: {},
                create: cardUpdate.benefits.map(benefit => ({
                  category: benefit.category,
                  description: benefit.description,
                  percentage: benefit.percentage,
                  maxAmount: benefit.maxAmount,
                  frequency: benefit.frequency,
                  cycleAlignment: benefit.cycleAlignment,
                  fixedCycleStartMonth: benefit.fixedCycleStartMonth,
                  fixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
                  occurrencesInCycle: benefit.occurrencesInCycle || 1
                }))
              }
            }
          });
        }

        console.log(`   ✅ Updated predefined card: ${cardUpdate.cardName}`);
      } catch (error) {
        this.errors.push({
          type: 'database',
          message: `Failed to update predefined card: ${cardUpdate.cardName}`,
          details: { cardUpdate, error: error instanceof Error ? error.message : error }
        });
      }
    }
  }

  /**
   * Migrate existing user cards for a specific card type
   */
  private async migrateUsersForCard(cardUpdate: CardUpdateDefinition): Promise<{
    affectedUsers: number;
    affectedCards: number;
    benefitsCreated: number;
    benefitsDeleted: number;
  }> {
    const existingCards = await prisma.creditCard.findMany({
      where: {
        name: cardUpdate.cardName
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
        benefits: {
          include: {
            benefitStatuses: true
          }
        }
      }
    });

    console.log(`   Found ${existingCards.length} existing "${cardUpdate.cardName}" cards to migrate`);

    if (existingCards.length === 0) {
      return { affectedUsers: 0, affectedCards: 0, benefitsCreated: 0, benefitsDeleted: 0 };
    }

    let affectedUsers = 0;
    let affectedCards = 0;
    let benefitsCreated = 0;
    let benefitsDeleted = 0;

    // Process cards in batches using Promise.allSettled for fault tolerance
    for (let i = 0; i < existingCards.length; i += this.options.batchSize) {
      const batch = existingCards.slice(i, i + this.options.batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(card => this.migrateUserCard(card, cardUpdate))
      );

      batchResults.forEach((result, index) => {
        const card = batch[index];
        if (result.status === 'fulfilled') {
          const { created, deleted } = result.value;
          affectedUsers++;
          affectedCards++;
          benefitsCreated += created;
          benefitsDeleted += deleted;
          console.log(`   ✅ Migrated card for ${card.user.email} (${created} created, ${deleted} deleted)`);
        } else {
          this.errors.push({
            type: 'user_data',
            message: `Failed to migrate card for user ${card.user.email}`,
            cardId: card.id,
            userId: card.user.id,
            userEmail: card.user.email,
            details: { error: result.reason instanceof Error ? result.reason.message : result.reason }
          });
          console.log(`   ❌ Failed to migrate card for ${card.user.email}: ${result.reason}`);
        }
      });

      // Stop on first error if requested
      if (this.options.stopOnFirstError && this.errors.length > 0) {
        break;
      }
    }

    return { affectedUsers, affectedCards, benefitsCreated, benefitsDeleted };
  }

  /**
   * Build UserMigrationContext from a card for backup purposes
   */
  private buildUserMigrationContext(card: any): UserMigrationContext {
    const benefitStatuses = (card.benefits || []).flatMap((benefit: any) =>
      (benefit.benefitStatuses || []).map((s: any) => ({
        id: s.id,
        benefitId: benefit.id,
        isCompleted: s.isCompleted,
        isNotUsable: s.isNotUsable,
        completedAt: s.completedAt,
        cycleStartDate: s.cycleStartDate,
        cycleEndDate: s.cycleEndDate,
        occurrenceIndex: s.occurrenceIndex,
      }))
    );
    return {
      userId: card.user?.id ?? '',
      userEmail: card.user?.email ?? '',
      cardId: card.id,
      cardName: card.name,
      openedDate: card.openedDate,
      currentBenefits: (card.benefits || []).map((b: any) => ({
        id: b.id,
        category: b.category,
        description: b.description,
        percentage: b.percentage,
        maxAmount: b.maxAmount,
        frequency: b.frequency,
        cycleAlignment: b.cycleAlignment,
        fixedCycleStartMonth: b.fixedCycleStartMonth,
        fixedCycleDurationMonths: b.fixedCycleDurationMonths,
        occurrencesInCycle: b.occurrencesInCycle ?? 1,
      })),
      benefitStatuses,
    };
  }

  /**
   * Migrate a single user's card
   */
  private async migrateUserCard(
    card: any,
    cardUpdate: CardUpdateDefinition
  ): Promise<{ created: number; deleted: number }> {
    
    if (this.options.dryRun) {
      // For dry run, just calculate what would happen
      return { created: cardUpdate.benefits.length, deleted: card.benefits.length };
    }

    // Backup current state before modifying (when backup is requested)
    if (this.options.backupUserData && this.options.backupWriter) {
      const context = this.buildUserMigrationContext(card);
      await this.options.backupWriter(context);
    }

    let benefitsCreated = 0;
    let benefitsDeleted = 0;

    await prisma.$transaction(async (tx) => {
      // Step 1: Delete old benefits and their statuses (if preserveUserActions is false)
      // or only delete benefits that don't have completed/not-usable statuses
      if (this.options.preserveUserActions) {
        // Only delete benefits that have no completed or not-usable statuses
        const deletableBenefitIds = card.benefits
          .filter((benefit: any) => 
            !benefit.benefitStatuses.some((status: any) => 
              status.isCompleted || status.isNotUsable
            )
          )
          .map((benefit: any) => benefit.id);

        if (deletableBenefitIds.length > 0) {
          // Delete benefit statuses for deletable benefits
          await tx.benefitStatus.deleteMany({
            where: { benefitId: { in: deletableBenefitIds } }
          });

          // Delete the benefits themselves
          await tx.benefit.deleteMany({
            where: { id: { in: deletableBenefitIds } }
          });

          benefitsDeleted = deletableBenefitIds.length;
        }
      } else {
        // Delete all existing benefits and their statuses
        await tx.benefitStatus.deleteMany({
          where: { benefitId: { in: card.benefits.map((b: any) => b.id) } }
        });
        
        await tx.benefit.deleteMany({
          where: { creditCardId: card.id }
        });

        benefitsDeleted = card.benefits.length;
      }

      // Step 2: Update card metadata if needed
      // Note: CreditCard model doesn't have annualFee field
      // The annual fee is managed at the PredefinedCard level
      await tx.creditCard.update({
        where: { id: card.id },
        data: { 
          updatedAt: new Date()
        }
      });

      // Step 3: Create new benefits with proper validation
      const now = new Date();
      for (const benefitData of cardUpdate.benefits) {
        // Create the benefit
        const newBenefit = await tx.benefit.create({
          data: {
            creditCardId: card.id,
            category: benefitData.category,
            description: benefitData.description,
            percentage: benefitData.percentage,
            maxAmount: benefitData.maxAmount,
            frequency: benefitData.frequency,
            cycleAlignment: benefitData.cycleAlignment,
            fixedCycleStartMonth: benefitData.fixedCycleStartMonth,
            fixedCycleDurationMonths: benefitData.fixedCycleDurationMonths,
            occurrencesInCycle: benefitData.occurrencesInCycle || 1,
            startDate: cardUpdate.effectiveDate || now,
            endDate: null
          }
        });

        // Calculate and validate cycle
        let cycleInfo: { cycleStartDate: Date; cycleEndDate: Date };
        
        if (benefitData.frequency === BenefitFrequency.ONE_TIME) {
          // For ONE_TIME benefits, create a simple cycle from start date
          cycleInfo = {
            cycleStartDate: normalizeCycleDate(cardUpdate.effectiveDate || now),
            cycleEndDate: new Date(cardUpdate.effectiveDate?.getTime() || now.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year from start
          };
        } else {
          const rawCycleInfo = calculateBenefitCycle(
            benefitData.frequency,
            now,
            card.openedDate,
            benefitData.cycleAlignment,
            benefitData.fixedCycleStartMonth,
            benefitData.fixedCycleDurationMonths
          );
          
          // CRITICAL: Normalize cycleStartDate to midnight UTC to prevent duplicate records
          cycleInfo = {
            cycleStartDate: normalizeCycleDate(rawCycleInfo.cycleStartDate),
            cycleEndDate: rawCycleInfo.cycleEndDate
          };

          // Validate the cycle if requested
          if (this.options.validateCycles) {
            const validation = validateBenefitCycle(
              {
                description: benefitData.description,
                fixedCycleStartMonth: benefitData.fixedCycleStartMonth,
                fixedCycleDurationMonths: benefitData.fixedCycleDurationMonths
              },
              cycleInfo
            );

            if (!validation.isValid) {
              throw new Error(`Benefit validation failed: ${validation.error}`);
            }
          }
        }

        // Create benefit status records
        const occurrences = benefitData.occurrencesInCycle || 1;
        for (let occurrenceIndex = 0; occurrenceIndex < occurrences; occurrenceIndex++) {
          await tx.benefitStatus.create({
            data: {
              benefitId: newBenefit.id,
              userId: card.user.id,
              cycleStartDate: cycleInfo.cycleStartDate,
              cycleEndDate: cycleInfo.cycleEndDate,
              occurrenceIndex: occurrenceIndex,
              isCompleted: false
            }
          });
        }

        benefitsCreated++;
      }
    });

    return { created: benefitsCreated, deleted: benefitsDeleted };
  }

  /**
   * Count how many users would be affected by a card migration
   */
  private async countAffectedUsers(cardName: string): Promise<number> {
    return await prisma.creditCard.count({
      where: { name: cardName }
    });
  }

  /**
   * Generate a human-readable migration summary
   */
  private generateSummary(users: number, cards: number, created: number, deleted: number): string {
    const mode = this.options.dryRun ? 'DRY RUN - ' : '';
    return `${mode}Affected ${users} users across ${cards} cards. Created ${created} benefits, deleted ${deleted} benefits.`;
  }
}
