/**
 * Benefit Migration Framework
 * 
 * Comprehensive framework for safe, automated benefit migrations
 */

export { BenefitMigrationEngine } from './migration-engine';
export { MigrationPlanBuilder, CardUpdateBuilder } from './plan-builder';
export { MigrationCLI } from './migration-cli';

export type {
  MigrationPlan,
  MigrationResult,
  MigrationOptions,
  MigrationError,
  PreMigrationCheck,
  BenefitDefinition,
  CardUpdateDefinition,
  UserMigrationContext,
  UserMigrationPlan,
  BenefitMigrationStep
} from './types';

// Re-export commonly used Prisma enums for convenience
export { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
