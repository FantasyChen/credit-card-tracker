/**
 * Benefit Migration Framework Types
 * 
 * Comprehensive type definitions for safe, automated benefit migrations
 */

import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';

export interface BenefitDefinition {
  category: string;
  description: string;
  percentage: number;
  maxAmount?: number | null;
  frequency: BenefitFrequency;
  cycleAlignment?: BenefitCycleAlignment | null;
  fixedCycleStartMonth?: number | null;
  fixedCycleDurationMonths?: number | null;
  occurrencesInCycle?: number;
}

export interface CardUpdateDefinition {
  cardName: string;
  issuer: string;
  newAnnualFee?: number;
  benefits: BenefitDefinition[];
  effectiveDate: Date;
  migrationNotes?: string;
}

export interface MigrationPlan {
  id: string;
  title: string;
  description: string;
  cardUpdates: CardUpdateDefinition[];
  version: string;
  createdAt: Date;
  dryRunOnly?: boolean;
}

export interface MigrationResult {
  success: boolean;
  affectedUsers: number;
  affectedCards: number;
  benefitsCreated: number;
  benefitsDeleted: number;
  errors: MigrationError[];
  warnings: string[];
  summary: string;
}

export interface MigrationError {
  type: 'validation' | 'database' | 'cycle_calculation' | 'user_data';
  message: string;
  cardId?: string;
  userId?: string;
  userEmail?: string;
  benefitId?: string;
  details?: Record<string, any>;
}

export interface PreMigrationCheck {
  checkType: 'user_count' | 'data_integrity' | 'benefit_validation' | 'cycle_calculation';
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, any>;
}

export interface MigrationOptions {
  dryRun: boolean;
  force: boolean;
  batchSize: number;
  stopOnFirstError: boolean;
  preserveUserActions: boolean; // Don't touch completed/not-usable benefits
  validateCycles: boolean;
  backupUserData: boolean;
  /** When backupUserData is true, called before modifying each user's card. Used by CLI to write JSON backups. */
  backupWriter?: (context: UserMigrationContext) => Promise<void>;
}

export interface UserMigrationContext {
  userId: string;
  userEmail: string;
  cardId: string;
  cardName: string;
  openedDate: Date | null;
  currentBenefits: Array<{
    id: string;
    category: string;
    description: string;
    percentage: number;
    maxAmount?: number | null;
    frequency: BenefitFrequency;
    cycleAlignment?: BenefitCycleAlignment | null;
    fixedCycleStartMonth?: number | null;
    fixedCycleDurationMonths?: number | null;
    occurrencesInCycle: number;
  }>;
  benefitStatuses: Array<{
    id: string;
    benefitId: string;
    isCompleted: boolean;
    isNotUsable: boolean;
    completedAt: Date | null;
    cycleStartDate: Date;
    cycleEndDate: Date;
    occurrenceIndex: number;
  }>;
}

export interface BenefitMigrationStep {
  action: 'delete' | 'create' | 'preserve';
  benefitData?: BenefitDefinition;
  reason: string;
  validation?: {
    isValid: boolean;
    error?: string;
    warning?: string;
  };
}

export interface UserMigrationPlan {
  context: UserMigrationContext;
  steps: BenefitMigrationStep[];
  estimatedCycleInfo: Array<{
    cycleStartDate: Date;
    cycleEndDate: Date;
    benefitDescription: string;
    occurrenceIndex: number;
  }>;
  warnings: string[];
  canProceed: boolean;
}
