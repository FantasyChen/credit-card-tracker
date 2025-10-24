/**
 * Benefit Validation Utilities
 * 
 * Minimal validation to prevent documented bugs:
 * - Q3 quarterly benefits getting Q1 cycle dates (Sept 2025 incident)
 * 
 * Philosophy: Validate only known issues, never block operations
 */

export interface BenefitValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validates that quarterly benefits (Q1, Q2, Q3, Q4) get correct cycle dates
 * 
 * Prevents regression of Sept 2025 bug where Q3 benefits got Q1 dates.
 * Only validates benefits with explicit quarter markers (Q1:, Q2:, Q3:, Q4:)
 */
export function validateQuarterlyBenefit(
  benefit: { 
    description: string; 
    fixedCycleStartMonth?: number | null;
    fixedCycleDurationMonths?: number | null;
  },
  calculatedCycle: { 
    cycleStartDate: Date; 
    cycleEndDate: Date;
  }
): BenefitValidationResult {
  
  // Extract quarter information from benefit description (e.g., "Q3: Jul-Sep")
  const quarterMatch = benefit.description.match(/Q(\d): (\w+)-(\w+)/);
  if (!quarterMatch) {
    return { isValid: true }; // Not a quarterly benefit, skip validation
  }
  
  const [, quarter] = quarterMatch;
  
  // Map quarters to expected start months: Q1→Jan(1), Q2→Apr(4), Q3→Jul(7), Q4→Oct(10)
  const quarterMap: Record<string, { start: number; months: string }> = {
    '1': { start: 1, months: 'Jan-Mar' },
    '2': { start: 4, months: 'Apr-Jun' }, 
    '3': { start: 7, months: 'Jul-Sep' },
    '4': { start: 10, months: 'Oct-Dec' }
  };
  
  const expected = quarterMap[quarter];
  if (!expected) {
    return {
      isValid: false,
      error: `Unknown quarter "${quarter}" in benefit description`
    };
  }
  
  // Consistency check: Quarterly benefits should have 3-month duration
  if (benefit.fixedCycleDurationMonths !== null && benefit.fixedCycleDurationMonths !== 3) {
    return {
      isValid: false,
      error: `Q${quarter} benefit should have fixedCycleDurationMonths=3, got ${benefit.fixedCycleDurationMonths}`
    };
  }
  
  // Verify calculated cycle starts in the expected month
  const actualStartMonth = calculatedCycle.cycleStartDate.getUTCMonth() + 1; // Convert to 1-indexed
  
  if (actualStartMonth !== expected.start) {
    return {
      isValid: false,
      error: `Q${quarter} benefit "${benefit.description}" has wrong cycle start month. Expected: ${expected.start} (${expected.months}), Got: ${actualStartMonth}. This indicates a cycle calculation bug.`
    };
  }
  
  return { isValid: true };
}

/**
 * Main validation function - currently only validates quarterly benefits
 * 
 * This is intentionally minimal to avoid false positives and blocking operations.
 * Only validates documented bugs that have occurred in production.
 */
export function validateBenefitCycle(
  benefit: { 
    description: string; 
    fixedCycleStartMonth?: number | null;
    fixedCycleDurationMonths?: number | null;
  },
  calculatedCycle: { 
    cycleStartDate: Date; 
    cycleEndDate: Date;
  }
): BenefitValidationResult {
  
  // Only validate quarterly benefits (Q1, Q2, Q3, Q4)
  return validateQuarterlyBenefit(benefit, calculatedCycle);
}
