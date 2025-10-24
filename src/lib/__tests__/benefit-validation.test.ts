import { 
  validateQuarterlyBenefit, 
  validateBenefitCycle
} from '../benefit-validation';
import { calculateBenefitCycle } from '../benefit-cycle';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';

describe('Benefit Validation - Minimal Strategy', () => {
  
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
    
    test('Non-quarterly benefits should pass', () => {
      const benefit = {
        description: '$15 Monthly Uber Cash ($35 in December)',
        fixedCycleStartMonth: null,
        fixedCycleDurationMonths: null
      };
      
      const cycle = {
        cycleStartDate: new Date('2025-10-01T00:00:00Z'),
        cycleEndDate: new Date('2025-10-31T23:59:59Z')
      };
      
      const result = validateQuarterlyBenefit(benefit, cycle);
      expect(result.isValid).toBe(true); // No false positives!
    });
    
  });
  
  describe('validateBenefitCycle (main function)', () => {
    test('should delegate to quarterly validation', () => {
      const benefit = {
        description: '$100 Quarterly Resy Dining Credit (Q2: Apr-Jun)',
        fixedCycleStartMonth: 4,
        fixedCycleDurationMonths: 3
      };
      
      const cycle = {
        cycleStartDate: new Date('2025-04-01T00:00:00Z'),
        cycleEndDate: new Date('2025-06-30T23:59:59Z')
      };
      
      const result = validateBenefitCycle(benefit, cycle);
      expect(result.isValid).toBe(true);
    });
    
    test('should pass non-quarterly benefits (no false positives)', () => {
      const benefit = {
        description: '$15 Monthly Uber Cash ($35 in December)',
        fixedCycleStartMonth: null,
        fixedCycleDurationMonths: null
      };
      
      const cycle = {
        cycleStartDate: new Date('2025-10-01T00:00:00Z'),
        cycleEndDate: new Date('2025-10-31T23:59:59Z')
      };
      
      const result = validateBenefitCycle(benefit, cycle);
      expect(result.isValid).toBe(true); // This was the false positive that caused Oct 2025 outage!
    });
    
    test('should catch quarterly mismatches', () => {
      const benefit = {
        description: '$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)',
        fixedCycleStartMonth: 7,
        fixedCycleDurationMonths: 3
      };
      
      const cycle = {
        cycleStartDate: new Date('2025-01-01T00:00:00Z'), // Wrong! Should be July
        cycleEndDate: new Date('2025-03-31T23:59:59Z')
      };
      
      const result = validateBenefitCycle(benefit, cycle);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Q3 benefit');
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
    });
    
  });
  
});
