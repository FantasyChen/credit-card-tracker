/**
 * Migration Plan Builder
 * 
 * Fluent interface for creating safe benefit migration plans
 */

import type { 
  MigrationPlan, 
  CardUpdateDefinition, 
  BenefitDefinition 
} from './types';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';

export class MigrationPlanBuilder {
  private plan: Partial<MigrationPlan> = {
    cardUpdates: [],
    version: '1.0.0',
    createdAt: new Date(),
    dryRunOnly: false
  };

  /**
   * Set migration metadata
   */
  setMetadata(options: {
    id: string;
    title: string;
    description: string;
    version?: string;
    dryRunOnly?: boolean;
  }): this {
    this.plan.id = options.id;
    this.plan.title = options.title;
    this.plan.description = options.description;
    this.plan.version = options.version || '1.0.0';
    this.plan.dryRunOnly = options.dryRunOnly || false;
    return this;
  }

  /**
   * Add a card update to the migration plan
   */
  addCardUpdate(cardName: string, issuer: string): CardUpdateBuilder {
    const cardUpdate: CardUpdateDefinition = {
      cardName,
      issuer,
      benefits: [],
      effectiveDate: new Date()
    };

    this.plan.cardUpdates!.push(cardUpdate);
    return new CardUpdateBuilder(cardUpdate, this);
  }

  /**
   * Build the final migration plan
   */
  build(): MigrationPlan {
    if (!this.plan.id || !this.plan.title || !this.plan.description) {
      throw new Error('Migration plan requires id, title, and description');
    }

    if (this.plan.cardUpdates!.length === 0) {
      throw new Error('Migration plan must include at least one card update');
    }

    return this.plan as MigrationPlan;
  }

  /**
   * Create a migration plan from a simple configuration object
   */
  static fromConfig(config: {
    id: string;
    title: string;
    description: string;
    version?: string;
    cards: Array<{
      name: string;
      issuer: string;
      annualFee?: number;
      effectiveDate?: Date;
      migrationNotes?: string;
      benefits: Array<{
        category: string;
        description: string;
        percentage: number;
        maxAmount?: number;
        frequency: BenefitFrequency;
        cycleAlignment?: BenefitCycleAlignment;
        fixedCycleStartMonth?: number;
        fixedCycleDurationMonths?: number;
        occurrencesInCycle?: number;
      }>;
    }>;
  }): MigrationPlan {
    const builder = new MigrationPlanBuilder();
    
    builder.setMetadata({
      id: config.id,
      title: config.title,
      description: config.description,
      version: config.version || '1.0.0'
    });

    config.cards.forEach(card => {
      const cardBuilder = builder.addCardUpdate(card.name, card.issuer);
      
      if (card.annualFee !== undefined) {
        cardBuilder.setAnnualFee(card.annualFee);
      }
      
      if (card.effectiveDate) {
        cardBuilder.setEffectiveDate(card.effectiveDate);
      }
      
      if (card.migrationNotes) {
        cardBuilder.setMigrationNotes(card.migrationNotes);
      }

      card.benefits.forEach(benefit => {
        cardBuilder.addBenefit(benefit);
      });

      cardBuilder.finishCard();
    });

    return builder.build();
  }
}

export class CardUpdateBuilder {
  constructor(
    private cardUpdate: CardUpdateDefinition,
    private planBuilder: MigrationPlanBuilder
  ) {}

  /**
   * Set the new annual fee for this card
   */
  setAnnualFee(annualFee: number): this {
    this.cardUpdate.newAnnualFee = annualFee;
    return this;
  }

  /**
   * Set when the new benefits become effective
   */
  setEffectiveDate(effectiveDate: Date): this {
    this.cardUpdate.effectiveDate = effectiveDate;
    return this;
  }

  /**
   * Add migration notes
   */
  setMigrationNotes(notes: string): this {
    this.cardUpdate.migrationNotes = notes;
    return this;
  }

  /**
   * Add a benefit to this card update
   */
  addBenefit(benefit: BenefitDefinition): this {
    this.cardUpdate.benefits.push(benefit);
    return this;
  }

  /**
   * Add a dining benefit (common pattern)
   */
  addDiningBenefit(options: {
    description: string;
    percentage: number;
    maxAmount?: number;
    frequency?: BenefitFrequency;
  }): this {
    const frequency = options.frequency || BenefitFrequency.MONTHLY;
    return this.addBenefit({
      category: 'Dining',
      description: options.description,
      percentage: options.percentage,
      maxAmount: options.maxAmount,
      frequency,
      cycleAlignment: frequency === BenefitFrequency.MONTHLY 
        ? BenefitCycleAlignment.CALENDAR_FIXED 
        : undefined,
      fixedCycleStartMonth: frequency === BenefitFrequency.MONTHLY ? 1 : undefined,
      fixedCycleDurationMonths: frequency === BenefitFrequency.MONTHLY ? 1 : undefined,
      occurrencesInCycle: 1
    });
  }

  /**
   * Add a travel benefit (common pattern)
   */
  addTravelBenefit(options: {
    description: string;
    percentage: number;
    maxAmount?: number;
    frequency?: BenefitFrequency;
  }): this {
    const frequency = options.frequency || BenefitFrequency.MONTHLY;
    return this.addBenefit({
      category: 'Travel',
      description: options.description,
      percentage: options.percentage,
      maxAmount: options.maxAmount,
      frequency,
      cycleAlignment: frequency === BenefitFrequency.MONTHLY 
        ? BenefitCycleAlignment.CALENDAR_FIXED 
        : undefined,
      fixedCycleStartMonth: frequency === BenefitFrequency.MONTHLY ? 1 : undefined,
      fixedCycleDurationMonths: frequency === BenefitFrequency.MONTHLY ? 1 : undefined,
      occurrencesInCycle: 1
    });
  }

  /**
   * Add a quarterly benefit with proper alignment
   */
  addQuarterlyBenefit(options: {
    quarter: 1 | 2 | 3 | 4;
    category: string;
    description: string;
    percentage: number;
    maxAmount?: number;
    occurrencesInCycle?: number;
  }): this {
    const quarterMonths = {
      1: { start: 1, name: 'Jan-Mar' },
      2: { start: 4, name: 'Apr-Jun' },
      3: { start: 7, name: 'Jul-Sep' },
      4: { start: 10, name: 'Oct-Dec' }
    };

    const quarterInfo = quarterMonths[options.quarter];
    
    return this.addBenefit({
      category: options.category,
      description: `Q${options.quarter}: ${quarterInfo.name} - ${options.description}`,
      percentage: options.percentage,
      maxAmount: options.maxAmount,
      frequency: BenefitFrequency.QUARTERLY,
      cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
      fixedCycleStartMonth: quarterInfo.start,
      fixedCycleDurationMonths: 3,
      occurrencesInCycle: options.occurrencesInCycle || 1
    });
  }

  /**
   * Add a yearly benefit with card anniversary alignment
   */
  addAnnualBenefit(options: {
    category: string;
    description: string;
    percentage: number;
    maxAmount?: number;
    occurrencesInCycle?: number;
  }): this {
    return this.addBenefit({
      category: options.category,
      description: options.description,
      percentage: options.percentage,
      maxAmount: options.maxAmount,
      frequency: BenefitFrequency.YEARLY,
      cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
      occurrencesInCycle: options.occurrencesInCycle || 1
    });
  }

  /**
   * Add a one-time benefit
   */
  addOneTimeBenefit(options: {
    category: string;
    description: string;
    percentage: number;
    maxAmount?: number;
  }): this {
    return this.addBenefit({
      category: options.category,
      description: options.description,
      percentage: options.percentage,
      maxAmount: options.maxAmount,
      frequency: BenefitFrequency.ONE_TIME,
      occurrencesInCycle: 1
    });
  }

  /**
   * Finish configuring this card and return to the plan builder
   */
  finishCard(): MigrationPlanBuilder {
    return this.planBuilder;
  }
}
