import { BenefitFrequency } from '@/generated/prisma';

/**
 * Calculates the start and end dates for a specific benefit cycle based on frequency
 * and reference date, prioritizing anniversary dates for YEARLY benefits if available.
 * Uses UTC for all calculations.
 *
 * @param frequency How often the benefit resets (MONTHLY, QUARTERLY, YEARLY).
 * @param referenceDate The date for which to determine the cycle (e.g., `new Date()`).
 * @param cardOpenedDate Optional: The date the card was opened (UTC). Used for YEARLY anniversary calculations.
 * @returns An object with cycleStartDate and cycleEndDate (UTC).
 * @throws Error if frequency is ONE_TIME or calculation fails.
 */
export function calculateBenefitCycle(
  frequency: BenefitFrequency,
  referenceDate: Date,
  cardOpenedDate: Date | null
): { cycleStartDate: Date; cycleEndDate: Date } {
  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth(); // 0-indexed

  let cycleStartYear: number;
  let cycleStartMonth: number; // 0-indexed
  let cycleEndYear: number;
  let cycleEndMonth: number; // 0-indexed

  switch (frequency) {
    case BenefitFrequency.MONTHLY:
      // Cycle is the calendar month of the reference date
      cycleStartYear = refYear;
      cycleStartMonth = refMonth;
      cycleEndYear = refYear;
      cycleEndMonth = refMonth;
      break;

    case BenefitFrequency.QUARTERLY:
      // Cycle is the calendar quarter of the reference date
      const currentQuarter = Math.floor(refMonth / 3); // 0=Q1, 1=Q2, 2=Q3, 3=Q4
      cycleStartYear = refYear;
      cycleStartMonth = currentQuarter * 3; // 0, 3, 6, 9
      cycleEndYear = refYear;
      cycleEndMonth = cycleStartMonth + 2; // 2, 5, 8, 11
      break;

    case BenefitFrequency.YEARLY:
      if (cardOpenedDate) {
        // Anniversary Year Logic
        const openedMonth = cardOpenedDate.getUTCMonth(); // 0-indexed

        // Determine the start year of the current cycle
        if (refMonth >= openedMonth) {
          // If current month is on or after anniversary month, cycle started this year.
          cycleStartYear = refYear;
        } else {
          // If current month is before anniversary month, cycle started last year.
          cycleStartYear = refYear - 1;
        }
        cycleStartMonth = openedMonth; // Cycle starts in the anniversary month

        // Cycle ends one year after it starts, in the month before the anniversary month
        cycleEndYear = cycleStartYear + 1;
        cycleEndMonth = cycleStartMonth; // End date calculation needs the *start* of the next cycle's month

      } else {
        // Calendar Year Logic (Fallback if no openedDate)
        cycleStartYear = refYear;
        cycleStartMonth = 0; // January
        cycleEndYear = refYear;
        cycleEndMonth = 11; // December
      }
      break;

    case BenefitFrequency.ONE_TIME:
    default:
      // This function is designed for recurring cycles.
      // ONE_TIME benefits or unknown frequencies should be handled separately.
      console.error("calculateBenefitCycle called with unsupported frequency:", frequency);
      throw new Error(`Unsupported frequency for cycle calculation: ${frequency}`);
  }

  // Calculate precise start and end dates using UTC
  let cycleStartDate: Date;
  let cycleEndDate: Date;

  if (frequency === BenefitFrequency.YEARLY && cardOpenedDate) {
      // Anniversary cycle runs from start of anniversary month to end of the day *before* the anniversary month starts again next year
      cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
      // End date is the beginning of the start month of the *next* cycle, minus 1 millisecond
      cycleEndDate = new Date(Date.UTC(cycleEndYear, cycleEndMonth, 1, 0, 0, 0, 0));
      cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
  } else {
     // Monthly, Quarterly, Calendar Yearly cycles run from start of the first month to end of the last month
     cycleStartDate = new Date(Date.UTC(cycleStartYear, cycleStartMonth, 1, 0, 0, 0, 0));
     // End date is the beginning of the month *after* the cycle end month, minus 1 millisecond
     cycleEndDate = new Date(Date.UTC(cycleEndYear, cycleEndMonth + 1, 1, 0, 0, 0, 0));
     cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
  }


  // Validation
  if (isNaN(cycleStartDate.getTime()) || isNaN(cycleEndDate.getTime())) {
    console.error("Calculated invalid date for benefit cycle", { frequency, referenceDate, cardOpenedDate, cycleStartDate, cycleEndDate });
    throw new Error("Could not calculate valid benefit cycle dates.");
  }
   if (cycleEndDate <= cycleStartDate) {
     console.error("Calculated cycle end date is not after cycle start date", { frequency, referenceDate, cardOpenedDate, cycleStartDate, cycleEndDate });
     throw new Error("Calculated cycle end date is not after cycle start date.");
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