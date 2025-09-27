import { 
  validateQuarterlyBenefit, 
  validateDecemberBenefit, 
  validateBenefitCycle,
  validateCurrentlyActiveBenefits 
} from '../benefit-validation';
import { calculateBenefitCycle } from '../benefit-cycle';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';

describe('Benefit Validation', () => {
  
  describe('validateQuarterlyBenefit', () => {
    
    test('Q1 benefit should accept Jan-Mar dates', () => {
      const benefit = {
        description: '$100 Quarterly Resy Dining Credit (Q1: Jan-Mar)',
        fixedCycleStartMonth: 1,
        fixedCycleDurationMonths: 3
      };
      
      const cycle = {
        cycleStartDate: new Date('2026-01-01T00:00:00Z'),
        cycleEndDate: new Date('2026-03-31T23:59:59Z')
      };
      
      const result = validateQuarterlyBenefit(benefit, cycle);
      expect(result.isValid).toBe(true);
    });
    
    test('Q1 benefit should reject Jul-Sep dates', () => {
      const benefit = {
        description: '$100 Quarterly Resy Dining Credit (Q1: Jan-Mar)',
        fixedCycleStartMonth: 1,
        fixedCycleDurationMonths: 3
      };
      
      const cycle = {
        cycleStartDate: new Date('2025-07-01T00:00:00Z'),
        cycleEndDate: new Date('2025-09-30T23:59:59Z')
      };
      
      const result = validateQuarterlyBenefit(benefit, cycle);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Q1 benefit');
      expect(result.error).toContain('wrong cycle start month');
    });
    
    test('Q3 benefit should accept Jul-Sep dates', () => {
      const benefit = {
        description: '$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)',
        fixedCycleStartMonth: 7,
        fixedCycleDurationMonths: 3
      };
      
      const cycle = {
        cycleStartDate: new Date('2025-07-01T00:00:00Z'),
        cycleEndDate: new Date('2025-09-30T23:59:59Z')
      };
      
      const result = validateQuarterlyBenefit(benefit, cycle);
      expect(result.isValid).toBe(true);
    });
    
    test('Q3 benefit should reject Jan-Mar dates (the bug we fixed)', () => {
      const benefit = {
        description: '$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)',
        fixedCycleStartMonth: 7,
        fixedCycleDurationMonths: 3
      };
      
      const cycle = {
        cycleStartDate: new Date('2026-01-01T00:00:00Z'),
        cycleEndDate: new Date('2026-03-31T23:59:59Z')
      };
      
      const result = validateQuarterlyBenefit(benefit, cycle);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Q3 benefit');
      expect(result.error).toContain('wrong cycle start month');
      expect(result.error).toContain('Expected: 7');
      expect(result.error).toContain('Got: 1');
    });
    
  });
  
  describe('validateDecemberBenefit', () => {
    
    test('December benefit should accept December dates', () => {
      const benefit = {
        description: '$20 Additional Uber Cash (December)'
      };
      
      const cycle = {
        cycleStartDate: new Date('2025-12-01T00:00:00Z'),
        cycleEndDate: new Date('2025-12-31T23:59:59Z')
      };
      
      const result = validateDecemberBenefit(benefit, cycle);
      expect(result.isValid).toBe(true);
    });
    
    test('December benefit should reject September dates', () => {
      const benefit = {
        description: '$20 Additional Uber Cash (December)'
      };
      
      const cycle = {
        cycleStartDate: new Date('2025-09-01T00:00:00Z'),
        cycleEndDate: new Date('2025-09-30T23:59:59Z')
      };
      
      const result = validateDecemberBenefit(benefit, cycle);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('December benefit');
      expect(result.error).toContain('wrong start month');
    });
    
  });
  
  describe('validateCurrentlyActiveBenefits', () => {
    
    test('Q3 benefit should be active in September 2025', () => {
      const benefit = {
        description: '$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)'
      };
      
      const cycle = {
        cycleStartDate: new Date('2025-07-01T00:00:00Z'),
        cycleEndDate: new Date('2025-09-30T23:59:59Z')
      };
      
      const referenceDate = new Date('2025-09-26T21:00:00Z');
      
      const result = validateCurrentlyActiveBenefits(benefit, cycle, referenceDate);
      expect(result.isValid).toBe(true);
    });
    
    test('Q3 benefit should NOT have Q1 dates in September 2025', () => {
      const benefit = {
        description: '$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)'
      };
      
      const cycle = {
        cycleStartDate: new Date('2026-01-01T00:00:00Z'),
        cycleEndDate: new Date('2026-03-31T23:59:59Z')
      };
      
      const referenceDate = new Date('2025-09-26T21:00:00Z');
      
      const result = validateCurrentlyActiveBenefits(benefit, cycle, referenceDate);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('should be active in 2025-09-26');
    });
    
  });
  
  describe('Integration with calculateBenefitCycle', () => {
    
    test('Real cycle calculation for Q3 benefit should pass validation', () => {
      const benefit = {
        description: '$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)',
        fixedCycleStartMonth: 7,
        fixedCycleDurationMonths: 3
      };
      
      const calculatedCycle = calculateBenefitCycle(
        BenefitFrequency.YEARLY,
        new Date('2025-09-26T21:00:00Z'), // Current date
        null, // No card opened date
        BenefitCycleAlignment.CALENDAR_FIXED,
        7, // July
        3  // 3 months
      );
      
      const validation = validateBenefitCycle(benefit, calculatedCycle);
      expect(validation.isValid).toBe(true);
      
      // Also validate it should be currently active
      const activeValidation = validateCurrentlyActiveBenefits(
        benefit, 
        calculatedCycle,
        new Date('2025-09-26T21:00:00Z')
      );
      expect(activeValidation.isValid).toBe(true);
    });
    
  });
  
});
