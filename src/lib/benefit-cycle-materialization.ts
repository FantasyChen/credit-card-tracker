import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import { calculateBenefitCycle, calculateOneTimeBenefitLifetime } from '@/lib/benefit-cycle';
import { normalizeCycleDate } from '@/lib/dateUtils';
import { validateBenefitCycle } from '@/lib/benefit-validation';

export interface BenefitCycleMaterializationInput {
  id: string;
  userId: string;
  frequency: BenefitFrequency;
  startDate?: Date | null;
  description?: string;
  cycleAlignment?: BenefitCycleAlignment | null;
  fixedCycleStartMonth?: number | null;
  fixedCycleDurationMonths?: number | null;
  occurrencesInCycle?: number | null;
}

export interface BenefitStatusMaterializationOptions {
  referenceDate?: Date;
  cardOpenedDate?: Date | null;
  validateCycles?: boolean;
}

export interface MaterializedBenefitStatusRow {
  benefitId: string;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
}

export interface BenefitStatusMaterializationResult {
  rows: MaterializedBenefitStatusRow[];
  warnings: string[];
}

export function materializeBenefitStatusRows(
  benefit: BenefitCycleMaterializationInput,
  options: BenefitStatusMaterializationOptions = {}
): BenefitStatusMaterializationResult {
  const referenceDate = options.referenceDate ?? new Date();
  const occurrences = Math.max(1, benefit.occurrencesInCycle ?? 1);
  const warnings: string[] = [];

  if (
    benefit.frequency === BenefitFrequency.YEARLY &&
    benefit.cycleAlignment !== BenefitCycleAlignment.CALENDAR_FIXED &&
    !options.cardOpenedDate &&
    !benefit.startDate
  ) {
    warnings.push(`Skipping yearly anniversary benefit ${benefit.id}: no card opened date or start date.`);
    return { rows: [], warnings };
  }

  const cycleInfo = calculateMaterializedCycle(benefit, referenceDate, options.cardOpenedDate ?? null);

  if (options.validateCycles && benefit.frequency !== BenefitFrequency.ONE_TIME) {
    const validation = validateBenefitCycle(
      {
        description: benefit.description ?? `Benefit ${benefit.id}`,
        fixedCycleStartMonth: benefit.fixedCycleStartMonth,
        fixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
      },
      cycleInfo
    );

    if (!validation.isValid) {
      warnings.push(validation.error ?? `Benefit ${benefit.id} failed cycle validation.`);
    }
  }

  const rows: MaterializedBenefitStatusRow[] = [];
  for (let occurrenceIndex = 0; occurrenceIndex < occurrences; occurrenceIndex++) {
    rows.push({
      benefitId: benefit.id,
      userId: benefit.userId,
      cycleStartDate: cycleInfo.cycleStartDate,
      cycleEndDate: cycleInfo.cycleEndDate,
      occurrenceIndex,
    });
  }

  return { rows, warnings };
}

export function calculateMaterializedCycle(
  benefit: BenefitCycleMaterializationInput,
  referenceDate: Date,
  cardOpenedDate: Date | null
): { cycleStartDate: Date; cycleEndDate: Date } {
  if (benefit.frequency === BenefitFrequency.ONE_TIME) {
    const startDate = benefit.startDate ?? referenceDate;
    const cycle = calculateOneTimeBenefitLifetime(startDate);
    return {
      cycleStartDate: normalizeCycleDate(cycle.cycleStartDate),
      cycleEndDate: cycle.cycleEndDate,
    };
  }

  if (!cardOpenedDate && benefit.startDate) {
    const cycle = calculateStandaloneBenefitCycle(benefit.frequency, referenceDate, benefit.startDate);
    return {
      cycleStartDate: normalizeCycleDate(cycle.cycleStartDate),
      cycleEndDate: cycle.cycleEndDate,
    };
  }

  const cycle = calculateBenefitCycle(
    benefit.frequency,
    referenceDate,
    cardOpenedDate,
    benefit.cycleAlignment,
    benefit.fixedCycleStartMonth,
    benefit.fixedCycleDurationMonths
  );

  return {
    cycleStartDate: normalizeCycleDate(cycle.cycleStartDate),
    cycleEndDate: cycle.cycleEndDate,
  };
}

export function calculateStandaloneBenefitCycle(
  frequency: BenefitFrequency,
  referenceDate: Date,
  startDate: Date
): { cycleStartDate: Date; cycleEndDate: Date } {
  if (frequency === BenefitFrequency.ONE_TIME) {
    return calculateOneTimeBenefitLifetime(startDate);
  }

  if (frequency === BenefitFrequency.WEEKLY) {
    const durationMs = 7 * 24 * 60 * 60 * 1000;
    const cyclesPassed = Math.max(0, Math.floor((referenceDate.getTime() - startDate.getTime()) / durationMs));
    const cycleStartDate = new Date(startDate.getTime() + cyclesPassed * durationMs);
    const cycleEndDate = new Date(cycleStartDate.getTime() + durationMs - 1);
    return { cycleStartDate, cycleEndDate };
  }

  const monthsPerCycle = monthsForFrequency(frequency);
  let cycleStartDate = new Date(startDate);

  if (referenceDate >= startDate) {
    const monthDelta =
      (referenceDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
      (referenceDate.getUTCMonth() - startDate.getUTCMonth());
    const initialCycles = Math.max(0, Math.floor(monthDelta / monthsPerCycle) - 1);
    cycleStartDate = addUtcMonths(startDate, initialCycles * monthsPerCycle);
  }

  let cycleEndDate = endDateForUtcMonthCycle(cycleStartDate, monthsPerCycle);
  while (cycleEndDate < referenceDate) {
    cycleStartDate = addUtcMonths(cycleStartDate, monthsPerCycle);
    cycleEndDate = endDateForUtcMonthCycle(cycleStartDate, monthsPerCycle);
  }

  return { cycleStartDate, cycleEndDate };
}

function monthsForFrequency(frequency: BenefitFrequency): number {
  switch (frequency) {
    case BenefitFrequency.MONTHLY:
      return 1;
    case BenefitFrequency.QUARTERLY:
      return 3;
    case BenefitFrequency.YEARLY:
      return 12;
    default:
      throw new Error(`Unsupported standalone benefit frequency: ${frequency}`);
  }
}

function addUtcMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function endDateForUtcMonthCycle(cycleStartDate: Date, months: number): Date {
  const cycleEndDate = addUtcMonths(cycleStartDate, months);
  cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
  return cycleEndDate;
}
