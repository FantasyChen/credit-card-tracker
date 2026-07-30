import type { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import {
  materializeBenefitStatusRows,
  materializeStandardBenefitStatusRows,
} from '@/lib/benefit-cycle-materialization';

export interface StandardMaterializationDefinition {
  id: string;
  userId: string;
  creditCardId: string;
  cardOpenedDate: Date | null;
  description: string;
  frequency: BenefitFrequency;
  cycleAlignment: BenefitCycleAlignment | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number | null;
}

export interface CustomMaterializationDefinition {
  id: string;
  userId: string;
  cardOpenedDate: Date | null;
  startDate: Date;
  description: string;
  frequency: BenefitFrequency;
  cycleAlignment: BenefitCycleAlignment | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number | null;
}

export interface PlannedBenefitStatusInsert {
  benefitId: string | null;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
}

export interface BenefitMaterializationPlan {
  rows: PlannedBenefitStatusInsert[];
  warnings: string[];
}

/**
 * Produces source-neutral occurrence inserts. Persistence must use insert-only
 * conflict handling; materialization is never allowed to update an existing row.
 */
export function planBenefitStatusMaterialization(
  standardDefinitions: StandardMaterializationDefinition[],
  customDefinitions: CustomMaterializationDefinition[],
  referenceDate: Date
): BenefitMaterializationPlan {
  const rows: PlannedBenefitStatusInsert[] = [];
  const warnings: string[] = [];

  for (const definition of standardDefinitions) {
    const materialized = materializeStandardBenefitStatusRows(
      {
        ...definition,
        startDate: definition.cardOpenedDate ?? undefined,
      },
      {
        userId: definition.userId,
        creditCardId: definition.creditCardId,
      },
      {
        referenceDate,
        cardOpenedDate: definition.cardOpenedDate,
        validateCycles: true,
      }
    );
    warnings.push(...materialized.warnings);
    rows.push(...materialized.rows.map((row) => ({
      ...row,
      benefitId: null,
    })));
  }

  for (const definition of customDefinitions) {
    const materialized = materializeBenefitStatusRows(
      definition,
      {
        referenceDate,
        cardOpenedDate: definition.cardOpenedDate,
        validateCycles: true,
      }
    );
    warnings.push(...materialized.warnings);
    rows.push(...materialized.rows.map((row) => ({
      ...row,
      creditCardId: null,
      predefinedBenefitId: null,
    })));
  }

  return { rows, warnings };
}
