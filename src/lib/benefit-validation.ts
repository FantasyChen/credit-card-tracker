/**
 * Benefit Validation Utilities
 * 
 * Prevents issues like Q3 benefits getting Q1 cycle dates
 */

export interface BenefitValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validates that quarterly benefits get correct quarterly cycle dates
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
  
  // Extract quarter information from benefit description
  const quarterMatch = benefit.description.match(/Q(\d): (\w+)-(\w+)/);
  if (!quarterMatch) {
    return { isValid: true }; // Not a quarterly benefit, no validation needed
  }
  
  const [, quarter, startMonthName, endMonthName] = quarterMatch;
  
  // Map quarters to expected months and names
  const quarterMap: Record<string, { start: number; end: number; months: string }> = {
    '1': { start: 1, end: 3, months: 'Jan-Mar' },
    '2': { start: 4, end: 6, months: 'Apr-Jun' }, 
    '3': { start: 7, end: 9, months: 'Jul-Sep' },
    '4': { start: 10, end: 12, months: 'Oct-Dec' }
  };
  
  const expected = quarterMap[quarter];
  if (!expected) {
    return {
      isValid: false,
      error: `Unknown quarter "${quarter}" in benefit description`
    };
  }
  
  // Check if calculated cycle start month matches expected quarter
  const actualStartMonth = calculatedCycle.cycleStartDate.getUTCMonth() + 1; // Convert to 1-indexed
  const actualEndMonth = calculatedCycle.cycleEndDate.getUTCMonth() + 1;
  
  if (actualStartMonth !== expected.start) {
    return {
      isValid: false,
      error: `Q${quarter} benefit "${benefit.description}" has wrong cycle start month. Expected: ${expected.start} (${expected.months}), Got: ${actualStartMonth}`
    };
  }
  
  // Additional validation: check end month is reasonable
  const expectedEndMonth = expected.end;
  const actualEndMonthNormalized = actualEndMonth === 12 ? 12 : actualEndMonth; // Handle December wrap-around
  
  // Allow some flexibility for end months (quarterly cycles can end differently due to month lengths)
  if (Math.abs(actualEndMonthNormalized - expectedEndMonth) > 1) {
    return {
      isValid: false,
      error: `Q${quarter} benefit has wrong cycle end month. Expected around: ${expectedEndMonth}, Got: ${actualEndMonth}`
    };
  }
  
  return { isValid: true };
}

/**
 * Validates that December-specific benefits get December dates
 */
export function validateDecemberBenefit(
  benefit: { description: string },
  calculatedCycle: { cycleStartDate: Date; cycleEndDate: Date }
): BenefitValidationResult {
  
  if (!benefit.description.toLowerCase().includes('december')) {
    return { isValid: true }; // Not a December benefit
  }
  
  const startMonth = calculatedCycle.cycleStartDate.getUTCMonth() + 1;
  const endMonth = calculatedCycle.cycleEndDate.getUTCMonth() + 1;
  
  if (startMonth !== 12) {
    return {
      isValid: false,
      error: `December benefit "${benefit.description}" has wrong start month: ${startMonth} (should be 12)`
    };
  }
  
  if (endMonth !== 12) {
    return {
      isValid: false,
      error: `December benefit "${benefit.description}" has wrong end month: ${endMonth} (should be 12)`
    };
  }
  
  return { isValid: true };
}

/**
 * Comprehensive benefit cycle validation
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
  
  // Run all relevant validations
  const validations = [
    validateQuarterlyBenefit(benefit, calculatedCycle),
    validateDecemberBenefit(benefit, calculatedCycle)
  ];
  
  // Return first error found
  for (const validation of validations) {
    if (!validation.isValid) {
      return validation;
    }
  }
  
  // All validations passed
  return { isValid: true };
}

/**
 * Validation specifically for the current date scenario (Sep 26, 2025)
 */
export function validateCurrentlyActiveBenefits(
  benefit: { description: string },
  calculatedCycle: { cycleStartDate: Date; cycleEndDate: Date },
  referenceDate: Date = new Date()
): BenefitValidationResult {
  
  // Q3 benefits should be active in September
  if (benefit.description.includes('Q3: Jul-Sep')) {
    const isActive = referenceDate >= calculatedCycle.cycleStartDate && referenceDate <= calculatedCycle.cycleEndDate;
    
    if (!isActive && referenceDate.getMonth() >= 6 && referenceDate.getMonth() <= 8) { // July-September
      return {
        isValid: false,
        error: `Q3 benefit "${benefit.description}" should be active in ${referenceDate.toISOString().split('T')[0]} but cycle is ${calculatedCycle.cycleStartDate.toISOString().split('T')[0]} → ${calculatedCycle.cycleEndDate.toISOString().split('T')[0]}`
      };
    }
  }
  
  return { isValid: true };
}
