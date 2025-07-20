import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';

/**
 * Calculates the start and end dates for a specific benefit cycle.
 * Uses UTC for all calculations.
 *
 * @param frequency How often the benefit resets.
 * @param referenceDate The date for which to determine the cycle.
 * @param cardOpenedDate Optional: Card opened date for YEARLY anniversary calculations.
 * @param cycleAlignment Optional: How the cycle aligns (CARD_ANNIVERSARY or CALENDAR_FIXED).
 * @param fixedCycleStartMonth Optional: 1-12, month the fixed cycle starts, if CALENDAR_FIXED.
 * @param fixedCycleDurationMonths Optional: Duration in months for CALENDAR_FIXED cycles.
 * @returns An object with cycleStartDate and cycleEndDate (UTC).
 */
export function calculateBenefitCycle(
  frequency: BenefitFrequency,
  referenceDate: Date,
  cardOpenedDate: Date | null,
  cycleAlignment?: BenefitCycleAlignment | null,
  fixedCycleStartMonth?: number | null,
  fixedCycleDurationMonths?: number | null
): { cycleStartDate: Date; cycleEndDate: Date } {
  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth(); // 0-indexed

  let cycleStartDate: Date;
  let cycleEndDate: Date;

  if (
    cycleAlignment === BenefitCycleAlignment.CALENDAR_FIXED &&
    fixedCycleStartMonth &&
    fixedCycleDurationMonths &&
    fixedCycleStartMonth >= 1 && fixedCycleStartMonth <= 12 &&
    fixedCycleDurationMonths > 0
  ) {
    // --- CALENDAR_FIXED Logic --- 
    // All calculations in UTC
    const currentYearCycleStartDate = new Date(Date.UTC(refYear, fixedCycleStartMonth - 1, 1, 0, 0, 0, 0));
    const currentYearCycleEndDate = new Date(currentYearCycleStartDate.getTime());
    currentYearCycleEndDate.setUTCMonth(currentYearCycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
    currentYearCycleEndDate.setUTCMilliseconds(currentYearCycleEndDate.getUTCMilliseconds() - 1);

    if (referenceDate <= currentYearCycleEndDate) {
      // The current year's cycle is either ongoing or still upcoming in the current year.
      // Or, the reference date is within the current year's cycle.
      cycleStartDate = currentYearCycleStartDate;
      cycleEndDate = currentYearCycleEndDate;
    } else {
      // The current year's fixed cycle has entirely passed for the referenceDate.
      // So, the next relevant cycle will be in the next year.
      const nextYear = refYear + 1;
      cycleStartDate = new Date(Date.UTC(nextYear, fixedCycleStartMonth - 1, 1, 0, 0, 0, 0));
      cycleEndDate = new Date(cycleStartDate.getTime());
      cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
      cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
    }
  } else {
    // --- CARD_ANNIVERSARY or Default Logic (existing logic) ---
    let cycleStartYear: number;
    let cycleStartMonth: number; // 0-indexed
    let cycleEndYear: number;
    let cycleEndMonth: number; // 0-indexed

    switch (frequency) {
      case BenefitFrequency.MONTHLY:
        cycleStartYear = refYear;
        cycleStartMonth = refMonth;
        cycleEndYear = refYear;
        cycleEndMonth = refMonth;
        break;

      case BenefitFrequency.QUARTERLY:
        const currentQuarter = Math.floor(refMonth / 3);
        cycleStartYear = refYear;
        cycleStartMonth = currentQuarter * 3;
        cycleEndYear = refYear;
        cycleEndMonth = cycleStartMonth + 2;
        break;

      case BenefitFrequency.YEARLY:
        if (cardOpenedDate) {
          const openedMonth = cardOpenedDate.getUTCMonth();
          if (refMonth >= openedMonth) {
            cycleStartYear = refYear;
          } else {
            cycleStartYear = refYear - 1;
          }
          cycleStartMonth = openedMonth;
          cycleEndYear = cycleStartYear + 1;
          cycleEndMonth = cycleStartMonth; 
        } else {
          cycleStartYear = refYear;
          cycleStartMonth = 0; // January
          cycleEndYear = refYear;
          cycleEndMonth = 11; // December
        }
        break;

      case BenefitFrequency.ONE_TIME:
      default:
        console.error("calculateBenefitCycle called with unsupported frequency for recurring benefits:", frequency);
        throw new Error(`Unsupported frequency for recurring benefit cycle calculation: ${frequency}`);
    }

    if (frequency === BenefitFrequency.YEARLY && cardOpenedDate) {
        cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
        cycleEndDate = new Date(Date.UTC(cycleEndYear, cycleEndMonth, 1, 0, 0, 0, 0));
        cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
    } else {
       cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
       cycleEndDate = new Date(Date.UTC(cycleEndYear, cycleEndMonth + 1, 1, 0, 0, 0, 0));
       cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
    }
  }

  // Validation (common for both branches)
  if (isNaN(cycleStartDate.getTime()) || isNaN(cycleEndDate.getTime())) {
    console.error("Calculated invalid date for benefit cycle", { frequency, referenceDate, cardOpenedDate, cycleAlignment, fixedCycleStartMonth, fixedCycleDurationMonths, cycleStartDate, cycleEndDate });
    throw new Error("Could not calculate valid benefit cycle dates.");
  }
  if (cycleEndDate <= cycleStartDate) {
    console.error("Calculated cycle end date is not after cycle start date", { frequency, referenceDate, cardOpenedDate, cycleAlignment, fixedCycleStartMonth, fixedCycleDurationMonths, cycleStartDate, cycleEndDate });
    throw new Error("Calculated cycle end date is not after cycle start date.");
  }

  // Log cycle calculation in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('calculateBenefitCycle:', {
      frequency,
      cycleStartDate: cycleStartDate.toISOString(),
      cycleEndDate: cycleEndDate.toISOString()
    });
  }

  return { cycleStartDate, cycleEndDate };
}

/**
 * Calculates the start and end dates for the *initial* cycle of a ONE_TIME benefit.
 * This is separate because ONE_TIME benefits don't have recurring cycles.
 *
 * @param benefitStartDate The date the benefit becomes active.
 * @returns An object with cycleStartDate and cycleEndDate (UTC).
 */
export function calculateOneTimeBenefitLifetime(
    benefitStartDate: Date
): { cycleStartDate: Date; cycleEndDate: Date } {
    const cycleStartDate = new Date(benefitStartDate.getTime()); // Use the provided start date
    // Set an arbitrary long lifetime, e.g., 10 years, for the 'cycle' end
    const cycleEndDate = new Date(Date.UTC(
        benefitStartDate.getUTCFullYear() + 10,
        benefitStartDate.getUTCMonth(),
        benefitStartDate.getUTCDate(),
        23, 59, 59, 999
    ));

    if (isNaN(cycleStartDate.getTime()) || isNaN(cycleEndDate.getTime())) {
        console.error("Calculated invalid date for one-time benefit lifetime", { benefitStartDate });
        throw new Error("Could not calculate valid one-time benefit lifetime dates.");
    }

    return { cycleStartDate, cycleEndDate };
} 