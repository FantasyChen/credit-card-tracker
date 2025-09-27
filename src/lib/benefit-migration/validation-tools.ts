/**
 * Migration Validation Tools
 * 
 * Tools for validating migrations before execution
 */

import { prisma } from '@/lib/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';
import { validateBenefitCycle } from '@/lib/benefit-validation';
import { BenefitFrequency } from '@/generated/prisma';
import type { MigrationPlan, BenefitDefinition } from './types';

export interface ValidationReport {
  isValid: boolean;
  summary: string;
  checks: ValidationCheck[];
  recommendations: string[];
}

export interface ValidationCheck {
  category: 'data_integrity' | 'benefit_validation' | 'user_impact' | 'schema_compatibility';
  status: 'pass' | 'fail' | 'warning';
  title: string;
  message: string;
  affectedCount?: number;
  details?: Record<string, any>;
}

export class MigrationValidator {
  
  /**
   * Comprehensive validation of a migration plan
   */
  async validateMigration(plan: MigrationPlan): Promise<ValidationReport> {
    const checks: ValidationCheck[] = [];
    const recommendations: string[] = [];

    // Run all validation checks
    checks.push(...await this.checkDataIntegrity(plan));
    checks.push(...await this.checkBenefitDefinitions(plan));
    checks.push(...await this.checkUserImpact(plan));
    checks.push(...await this.checkSchemaCompatibility(plan));

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(checks, plan));

    const failedChecks = checks.filter(check => check.status === 'fail');
    const warningChecks = checks.filter(check => check.status === 'warning');

    return {
      isValid: failedChecks.length === 0,
      summary: this.generateSummary(checks),
      checks,
      recommendations
    };
  }

  /**
   * Check data integrity - ensure referenced cards exist
   */
  private async checkDataIntegrity(plan: MigrationPlan): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = [];

    for (const cardUpdate of plan.cardUpdates) {
      // Check if predefined card exists
      const predefinedCard = await prisma.predefinedCard.findUnique({
        where: { name: cardUpdate.cardName }
      });

      if (!predefinedCard) {
        checks.push({
          category: 'data_integrity',
          status: 'warning',
          title: 'Predefined Card Not Found',
          message: `Predefined card "${cardUpdate.cardName}" not found - will be created`,
          details: { cardName: cardUpdate.cardName }
        });
      } else {
        checks.push({
          category: 'data_integrity',
          status: 'pass',
          title: 'Predefined Card Exists',
          message: `Found predefined card "${cardUpdate.cardName}"`,
          details: { cardName: cardUpdate.cardName, cardId: predefinedCard.id }
        });
      }

      // Count affected users
      const userCount = await prisma.creditCard.count({
        where: { name: cardUpdate.cardName }
      });

      checks.push({
        category: 'data_integrity',
        status: userCount > 0 ? 'pass' : 'warning',
        title: 'User Cards Found',
        message: userCount > 0 
          ? `Found ${userCount} user cards with name "${cardUpdate.cardName}"`
          : `No user cards found with name "${cardUpdate.cardName}" - only predefined card will be updated`,
        affectedCount: userCount,
        details: { cardName: cardUpdate.cardName, userCount }
      });
    }

    return checks;
  }

  /**
   * Validate benefit definitions
   */
  private async checkBenefitDefinitions(plan: MigrationPlan): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = [];

    for (const cardUpdate of plan.cardUpdates) {
      for (const benefit of cardUpdate.benefits) {
        const benefitCheck = await this.validateBenefitDefinition(benefit, cardUpdate.cardName);
        checks.push(benefitCheck);
      }
    }

    return checks;
  }

  /**
   * Validate a single benefit definition
   */
  private async validateBenefitDefinition(benefit: BenefitDefinition, cardName: string): Promise<ValidationCheck> {
    try {
      // Test cycle calculation with mock data
      const mockCardOpenDate = new Date('2024-01-15');
      const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
        benefit.frequency,
        new Date(),
        benefit.frequency === BenefitFrequency.YEARLY ? mockCardOpenDate : null,
        benefit.cycleAlignment,
        benefit.fixedCycleStartMonth,
        benefit.fixedCycleDurationMonths
      );

      // Validate the calculated cycle
      const validation = validateBenefitCycle(
        {
          description: benefit.description,
          fixedCycleStartMonth: benefit.fixedCycleStartMonth,
          fixedCycleDurationMonths: benefit.fixedCycleDurationMonths
        },
        { cycleStartDate, cycleEndDate }
      );

      if (!validation.isValid) {
        return {
          category: 'benefit_validation',
          status: 'fail',
          title: 'Benefit Cycle Validation Failed',
          message: `${cardName}: "${benefit.description}" - ${validation.error}`,
          details: { benefit, validation, cycleStartDate, cycleEndDate }
        };
      }

      return {
        category: 'benefit_validation',
        status: 'pass',
        title: 'Benefit Definition Valid',
        message: `${cardName}: "${benefit.description}" validation passed`,
        details: { benefit, cycleStartDate, cycleEndDate }
      };

    } catch (error) {
      return {
        category: 'benefit_validation',
        status: 'fail',
        title: 'Benefit Cycle Calculation Failed',
        message: `${cardName}: "${benefit.description}" - ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { benefit, error }
      };
    }
  }

  /**
   * Check user impact
   */
  private async checkUserImpact(plan: MigrationPlan): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = [];

    for (const cardUpdate of plan.cardUpdates) {
      // Find users with existing benefits that might be completed
      const cardsWithCompletedBenefits = await prisma.creditCard.findMany({
        where: { name: cardUpdate.cardName },
        include: {
          user: { select: { email: true } },
          benefits: {
            include: {
              benefitStatuses: {
                where: {
                  OR: [
                    { isCompleted: true },
                    { isNotUsable: true }
                  ]
                }
              }
            }
          }
        }
      });

      const usersWithCompletedBenefits = cardsWithCompletedBenefits.filter(
        card => card.benefits.some(benefit => benefit.benefitStatuses.length > 0)
      );

      if (usersWithCompletedBenefits.length > 0) {
        checks.push({
          category: 'user_impact',
          status: 'warning',
          title: 'Users Have Completed Benefits',
          message: `${usersWithCompletedBenefits.length} users have completed or not-usable benefits that will be preserved`,
          affectedCount: usersWithCompletedBenefits.length,
          details: {
            cardName: cardUpdate.cardName,
            affectedUsers: usersWithCompletedBenefits.map(card => ({
              email: card.user.email,
              completedBenefits: card.benefits.reduce(
                (count, benefit) => count + benefit.benefitStatuses.length, 0
              )
            }))
          }
        });
      }

      // Check for benefits that will be deleted
      const totalExistingBenefits = await prisma.benefit.count({
        where: {
          creditCard: { name: cardUpdate.cardName }
        }
      });

      const newBenefitCount = cardUpdate.benefits.length;
      
      if (totalExistingBenefits > 0) {
        checks.push({
          category: 'user_impact',
          status: 'pass',
          title: 'Benefit Structure Change',
          message: `Will replace ${totalExistingBenefits} existing benefits with ${newBenefitCount} new benefits`,
          details: {
            cardName: cardUpdate.cardName,
            oldBenefitCount: totalExistingBenefits,
            newBenefitCount
          }
        });
      }
    }

    return checks;
  }

  /**
   * Check schema compatibility
   */
  private async checkSchemaCompatibility(plan: MigrationPlan): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = [];

    // Check for required fields and valid enum values
    for (const cardUpdate of plan.cardUpdates) {
      for (const benefit of cardUpdate.benefits) {
        // Validate frequency enum
        if (!Object.values(BenefitFrequency).includes(benefit.frequency)) {
          checks.push({
            category: 'schema_compatibility',
            status: 'fail',
            title: 'Invalid Benefit Frequency',
            message: `Invalid frequency "${benefit.frequency}" for benefit "${benefit.description}"`,
            details: { benefit }
          });
        }

        // Check required fields
        if (!benefit.category || !benefit.description || benefit.percentage == null) {
          checks.push({
            category: 'schema_compatibility',
            status: 'fail',
            title: 'Missing Required Fields',
            message: `Benefit "${benefit.description}" missing required fields (category, description, or percentage)`,
            details: { benefit }
          });
        }

        // Validate percentage range
        if (benefit.percentage < 0 || benefit.percentage > 100) {
          checks.push({
            category: 'schema_compatibility',
            status: 'warning',
            title: 'Unusual Percentage Value',
            message: `Benefit "${benefit.description}" has percentage ${benefit.percentage}% (outside typical 0-100% range)`,
            details: { benefit }
          });
        }

        // Validate occurrences
        if (benefit.occurrencesInCycle && benefit.occurrencesInCycle < 1) {
          checks.push({
            category: 'schema_compatibility',
            status: 'fail',
            title: 'Invalid Occurrences Count',
            message: `Benefit "${benefit.description}" has invalid occurrencesInCycle: ${benefit.occurrencesInCycle}`,
            details: { benefit }
          });
        }
      }
    }

    // If no schema issues found, add a pass check
    if (checks.length === 0) {
      checks.push({
        category: 'schema_compatibility',
        status: 'pass',
        title: 'Schema Compatibility',
        message: 'All benefit definitions are schema-compatible'
      });
    }

    return checks;
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(checks: ValidationCheck[], plan: MigrationPlan): string[] {
    const recommendations: string[] = [];

    const failedChecks = checks.filter(check => check.status === 'fail');
    const warningChecks = checks.filter(check => check.status === 'warning');

    if (failedChecks.length > 0) {
      recommendations.push('❌ CRITICAL: Fix validation failures before proceeding with migration');
      recommendations.push('   Use --dry-run to test fixes without modifying data');
    }

    if (warningChecks.length > 0) {
      recommendations.push('⚠️  Review warnings - these may indicate unexpected behavior');
    }

    // Check if any cards affect many users
    const highImpactCards = checks.filter(
      check => check.category === 'user_impact' && (check.affectedCount || 0) > 50
    );

    if (highImpactCards.length > 0) {
      recommendations.push('🔄 HIGH IMPACT: Consider smaller batch sizes for cards affecting many users');
      recommendations.push('   Use --batch-size=5 to process users more carefully');
    }

    // Check for quarterly benefits
    const hasQuarterlyBenefits = plan.cardUpdates.some(card =>
      card.benefits.some(benefit => benefit.frequency === BenefitFrequency.QUARTERLY)
    );

    if (hasQuarterlyBenefits) {
      recommendations.push('📅 QUARTERLY BENEFITS: Verify quarter alignments are correct');
      recommendations.push('   Historical issues: Q3 benefits getting Q1 dates');
    }

    // General best practices
    recommendations.push('✅ BEST PRACTICES:');
    recommendations.push('   - Run with --dry-run first to preview changes');
    recommendations.push('   - Use --preserve-user-actions to protect completed benefits');
    recommendations.push('   - Monitor logs during execution for any errors');

    return recommendations;
  }

  /**
   * Generate summary of validation results
   */
  private generateSummary(checks: ValidationCheck[]): string {
    const passCount = checks.filter(check => check.status === 'pass').length;
    const failCount = checks.filter(check => check.status === 'fail').length;
    const warningCount = checks.filter(check => check.status === 'warning').length;

    if (failCount > 0) {
      return `❌ VALIDATION FAILED: ${failCount} errors, ${warningCount} warnings, ${passCount} passed`;
    } else if (warningCount > 0) {
      return `⚠️  VALIDATION PASSED WITH WARNINGS: ${warningCount} warnings, ${passCount} passed`;
    } else {
      return `✅ VALIDATION PASSED: All ${passCount} checks successful`;
    }
  }

  /**
   * Generate a human-readable validation report
   */
  static formatValidationReport(report: ValidationReport): string {
    let output = '\n';
    output += '='.repeat(60) + '\n';
    output += `📋 MIGRATION VALIDATION REPORT\n`;
    output += '='.repeat(60) + '\n';
    output += `${report.summary}\n\n`;

    // Group checks by category
    const categories = ['data_integrity', 'benefit_validation', 'user_impact', 'schema_compatibility'] as const;
    
    for (const category of categories) {
      const categoryChecks = report.checks.filter(check => check.category === category);
      if (categoryChecks.length === 0) continue;

      const categoryName = category.replace('_', ' ').toUpperCase();
      output += `📊 ${categoryName}\n`;
      output += '-'.repeat(40) + '\n';

      for (const check of categoryChecks) {
        const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
        output += `${icon} ${check.title}: ${check.message}\n`;
        
        if (check.affectedCount !== undefined) {
          output += `   Affected count: ${check.affectedCount}\n`;
        }
      }
      output += '\n';
    }

    if (report.recommendations.length > 0) {
      output += '💡 RECOMMENDATIONS\n';
      output += '-'.repeat(40) + '\n';
      for (const recommendation of report.recommendations) {
        output += `${recommendation}\n`;
      }
      output += '\n';
    }

    output += '='.repeat(60) + '\n';
    
    return output;
  }
}
