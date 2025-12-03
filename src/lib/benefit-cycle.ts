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

  // Initialize variables to satisfy TypeScript flow analysis
  let cycleStartDate: Date = new Date();
  let cycleEndDate: Date = new Date();

  if (
    cycleAlignment === BenefitCycleAlignment.CALENDAR_FIXED &&
    fixedCycleStartMonth &&
    fixedCycleDurationMonths &&
    fixedCycleStartMonth >= 1 && fixedCycleStartMonth <= 12 &&
    fixedCycleDurationMonths > 0
  ) {
    // --- CALENDAR_FIXED Logic --- 
    // Enhanced to handle recurring cycles (monthly, quarterly, etc.) within a year
    // All calculations in UTC
    
    // Calculate how many cycles occur per year
    const cyclesPerYear = Math.floor(12 / fixedCycleDurationMonths);
    
    if (cyclesPerYear === 1) {
      // Annual cycle - use original logic
      const currentYearCycleStartDate = new Date(Date.UTC(refYear, fixedCycleStartMonth - 1, 1, 0, 0, 0, 0));
      const currentYearCycleEndDate = new Date(currentYearCycleStartDate.getTime());
      currentYearCycleEndDate.setUTCMonth(currentYearCycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
      currentYearCycleEndDate.setUTCMilliseconds(currentYearCycleEndDate.getUTCMilliseconds() - 1);

      if (referenceDate <= currentYearCycleEndDate) {
        cycleStartDate = currentYearCycleStartDate;
        cycleEndDate = currentYearCycleEndDate;
      } else {
        // Jump to next year for annual cycles
        const nextYear = refYear + 1;
        cycleStartDate = new Date(Date.UTC(nextYear, fixedCycleStartMonth - 1, 1, 0, 0, 0, 0));
        cycleEndDate = new Date(cycleStartDate.getTime());
        cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
        cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
      }
    } else {
      // Multiple cycles per year (monthly, quarterly, etc.)
      // FIXED: Each benefit represents only its OWN cycle pattern, not all possible cycles
      // For example, Jan-Jun benefit only calculates Jan-Jun cycles, not Jul-Dec cycles
      
      // Current year cycle for this specific benefit
      const currentYearCycleStartDate = new Date(Date.UTC(refYear, fixedCycleStartMonth - 1, 1, 0, 0, 0, 0));
      const currentYearCycleEndDate = new Date(currentYearCycleStartDate.getTime());
      currentYearCycleEndDate.setUTCMonth(currentYearCycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
      currentYearCycleEndDate.setUTCMilliseconds(currentYearCycleEndDate.getUTCMilliseconds() - 1);
      
      // Check if reference date falls within the current year's cycle for this benefit
      if (referenceDate >= currentYearCycleStartDate && referenceDate <= currentYearCycleEndDate) {
        // Current cycle is active
        cycleStartDate = currentYearCycleStartDate;
        cycleEndDate = currentYearCycleEndDate;
      } else if (referenceDate < currentYearCycleStartDate) {
        // Reference date is before this year's cycle, use current year cycle
        cycleStartDate = currentYearCycleStartDate;
        cycleEndDate = currentYearCycleEndDate;
      } else {
        // Reference date is after this year's cycle, use next year's cycle
        const nextYear = refYear + 1;
        cycleStartDate = new Date(Date.UTC(nextYear, fixedCycleStartMonth - 1, 1, 0, 0, 0, 0));
        cycleEndDate = new Date(cycleStartDate.getTime());
        cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + fixedCycleDurationMonths);
        cycleEndDate.setUTCMilliseconds(cycleEndDate.getUTCMilliseconds() - 1);
      }
    }
  } else {
    // --- CARD_ANNIVERSARY or Default Logic (existing logic) ---
    let cycleStartYear: number;
    let cycleStartMonth: number; // 0-indexed
    let cycleEndYear: number;
    let cycleEndMonth: number; // 0-indexed

    switch (frequency) {
      case BenefitFrequency.WEEKLY: {
        // WEEKLY: 7-day cycles
        // Calculate the most recent cycle start based on the reference date
        // Each week starts on the same day of week as the benefit start date (or Sunday if no card date)
        const refTime = referenceDate.getTime();
        const dayOfWeek = referenceDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
        
        // Find the most recent Sunday (start of week) or use benefit-specific start day
        const daysFromWeekStart = dayOfWeek;
        const weekStartTime = refTime - (daysFromWeekStart * 24 * 60 * 60 * 1000);
        const weekStart = new Date(weekStartTime);
        
        // Normalize to midnight UTC
        cycleStartDate = new Date(Date.UTC(
          weekStart.getUTCFullYear(),
          weekStart.getUTCMonth(),
          weekStart.getUTCDate(),
          0, 0, 0, 0
        ));
        
        // End date is 7 days later minus 1ms
        cycleEndDate = new Date(cycleStartDate.getTime() + (7 * 24 * 60 * 60 * 1000) - 1);
        
        return { cycleStartDate, cycleEndDate };
      }

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

    // Assign the calculated cycle dates
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