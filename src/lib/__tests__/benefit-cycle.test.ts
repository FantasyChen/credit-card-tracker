import { calculateBenefitCycle } from '../benefit-cycle';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { calculateOneTimeBenefitLifetime } from '../benefit-cycle';

describe('calculateBenefitCycle', () => {
  // Helper to create UTC dates for consistency in tests
  const utcDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

  // Mock console.log and console.error to avoid cluttering test output
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('MONTHLY frequency', () => {
    it('should return the correct monthly cycle', () => {
      const refDate = utcDate(2023, 7, 15); // July 15, 2023
      const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(BenefitFrequency.MONTHLY, refDate, null);
      expect(cycleStartDate).toEqual(utcDate(2023, 7, 1));
      // End date is last millisecond of July 31, 2023
      const expectedEndDate = utcDate(2023, 8, 1);
      expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1);
      expect(cycleEndDate).toEqual(expectedEndDate);
    });
  });

  describe('QUARTERLY frequency', () => {
    it('should return the correct quarterly cycle for Q1', () => {
      const refDate = utcDate(2023, 2, 10); // Feb 10, 2023
      const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(BenefitFrequency.QUARTERLY, refDate, null);
      expect(cycleStartDate).toEqual(utcDate(2023, 1, 1)); // Jan 1
      const expectedEndDate = utcDate(2023, 4, 1); // Apr 1
      expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1); // Mar 31 end
      expect(cycleEndDate).toEqual(expectedEndDate);
    });

    it('should return the correct quarterly cycle for Q3', () => {
      const refDate = utcDate(2023, 8, 20); // Aug 20, 2023
      const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(BenefitFrequency.QUARTERLY, refDate, null);
      expect(cycleStartDate).toEqual(utcDate(2023, 7, 1)); // July 1
      const expectedEndDate = utcDate(2023, 10, 1); // Oct 1
      expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1); // Sep 30 end
      expect(cycleEndDate).toEqual(expectedEndDate);
    });
  });

  describe('YEARLY frequency', () => {
    describe('without cardOpenedDate (calendar year)', () => {
      it('should return the current calendar year', () => {
        const refDate = utcDate(2023, 7, 15); // July 15, 2023
        const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(BenefitFrequency.YEARLY, refDate, null);
        expect(cycleStartDate).toEqual(utcDate(2023, 1, 1)); // Jan 1, 2023
        const expectedEndDate = utcDate(2024, 1, 1); // Jan 1, 2024
        expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1); // Dec 31, 2023 end
        expect(cycleEndDate).toEqual(expectedEndDate);
      });
    });

    describe('with cardOpenedDate (anniversary year)', () => {
      it('should return the current anniversary year if refDate is ON or AFTER anniversary month', () => {
        const cardOpened = utcDate(2022, 4, 10); // April 10, 2022
        const refDate = utcDate(2023, 5, 15);    // May 15, 2023
        const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(BenefitFrequency.YEARLY, refDate, cardOpened);
        expect(cycleStartDate).toEqual(utcDate(2023, 4, 1)); // April 1, 2023
        const expectedEndDate = utcDate(2024, 4, 1); // April 1, 2024
        expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1); // March 31, 2024 end (careful with month indexing)
        expect(cycleEndDate).toEqual(expectedEndDate);
      });

      it('should return the previous anniversary year if refDate is BEFORE anniversary month', () => {
        const cardOpened = utcDate(2022, 11, 20); // Nov 20, 2022
        const refDate = utcDate(2023, 7, 15);     // July 15, 2023
        const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(BenefitFrequency.YEARLY, refDate, cardOpened);
        expect(cycleStartDate).toEqual(utcDate(2022, 11, 1)); // Nov 1, 2022
        const expectedEndDate = utcDate(2023, 11, 1); // Nov 1, 2023
        expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1); // Oct 31, 2023 end
        expect(cycleEndDate).toEqual(expectedEndDate);
      });

       it('should handle anniversary in December correctly when refDate is in Jan of next year', () => {
        const cardOpened = utcDate(2022, 12, 15); // Dec 15, 2022
        const refDate = utcDate(2024, 1, 10);    // Jan 10, 2024 (after anniversary of Dec 15, 2023)
        const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(BenefitFrequency.YEARLY, refDate, cardOpened);
        expect(cycleStartDate).toEqual(utcDate(2023, 12, 1)); // Dec 1, 2023
        const expectedEndDate = utcDate(2024, 12, 1); // Dec 1, 2024
        expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1); // Nov 30, 2024 end
        expect(cycleEndDate).toEqual(expectedEndDate);
      });
    });
  });

  describe('CALENDAR_FIXED alignment', () => {
    it('should use fixed start month and duration if referenceDate is within the current fixed cycle', () => {
      const refDate = utcDate(2023, 8, 15); // Aug 15, 2023
      const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
        BenefitFrequency.YEARLY, // Frequency is less relevant here if fixed is used
        refDate,
        null,
        BenefitCycleAlignment.CALENDAR_FIXED,
        7, // July
        3  // 3 months duration (July, Aug, Sep)
      );
      expect(cycleStartDate).toEqual(utcDate(2023, 7, 1)); // July 1, 2023
      const expectedEndDate = utcDate(2023, 10, 1); // Oct 1, 2023
      expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1); // Sep 30, 2023 end
      expect(cycleEndDate).toEqual(expectedEndDate);
    });

    it('should use next year if referenceDate is after the current fixed cycle', () => {
      const refDate = utcDate(2023, 11, 1); // Nov 1, 2023
      const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
        BenefitFrequency.MONTHLY, // Frequency is less relevant here
        refDate,
        null,
        BenefitCycleAlignment.CALENDAR_FIXED,
        1, // January
        6  // 6 months duration (Jan-June)
      );
      // Current year fixed cycle (Jan-June 2023) has passed.
      // So, it should calculate for Jan-June 2024.
      expect(cycleStartDate).toEqual(utcDate(2024, 1, 1)); // Jan 1, 2024
      const expectedEndDate = utcDate(2024, 7, 1); // July 1, 2024
      expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1); // June 30, 2024 end
      expect(cycleEndDate).toEqual(expectedEndDate);
    });

    it('should handle fixed cycle spanning year end', () => {
        const refDate = utcDate(2023, 12, 15); // Dec 15, 2023
        const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(
            BenefitFrequency.QUARTERLY,
            refDate,
            null,
            BenefitCycleAlignment.CALENDAR_FIXED,
            11, // November
            3   // 3 months (Nov, Dec, Jan)
        );
        // Ref date is Dec 15, 2023. Current cycle is Nov 1, 2023 - Jan 31, 2024
        expect(cycleStartDate).toEqual(utcDate(2023, 11, 1)); // Nov 1, 2023
        const expectedEndDate = new Date(Date.UTC(2023, 11 - 1 + 3, 1)); // Nov 1 + 3 months = Feb 1
        expectedEndDate.setUTCMilliseconds(expectedEndDate.getUTCMilliseconds() - 1); // Jan 31, 2024 end
        expect(cycleEndDate).toEqual(expectedEndDate); // Expected: 2024-01-31T23:59:59.999Z
    });


    it('should default to non-fixed logic if fixed parameters are incomplete or invalid', () => {
      const refDate = utcDate(2023, 7, 15); // July 15, 2023
      // Test with missing fixedCycleStartMonth
      let result = calculateBenefitCycle(
        BenefitFrequency.MONTHLY,
        refDate,
        null,
        BenefitCycleAlignment.CALENDAR_FIXED,
        null, // Missing start month
        3
      );
      expect(result.cycleStartDate).toEqual(utcDate(2023, 7, 1)); // Should fall back to July monthly

      // Test with invalid fixedCycleDurationMonths
      result = calculateBenefitCycle(
        BenefitFrequency.QUARTERLY,
        refDate,
        null,
        BenefitCycleAlignment.CALENDAR_FIXED,
        1,
        0 // Invalid duration
      );
      // Q3 for July 15
      expect(result.cycleStartDate).toEqual(utcDate(2023, 7, 1)); // Should fall back to Q3 start
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should throw error for ONE_TIME frequency', () => {
      const refDate = utcDate(2023, 1, 1);
      expect(() => {
        calculateBenefitCycle(BenefitFrequency.ONE_TIME, refDate, null);
      }).toThrow('Unsupported frequency for recurring benefit cycle calculation: ONE_TIME');
    });

    // The function itself has internal checks for invalid dates and logs errors.
    // Here we ensure it doesn't produce an end date before start date.
    // (Specific internal error conditions leading to NaN are hard to trigger from outside
    // without malforming Date objects directly, which isn't the goal of this test)

    it('should produce valid end date after start date for all standard cases', () => {
        const scenarios = [
            { freq: BenefitFrequency.MONTHLY, ref: utcDate(2023, 1, 15), open: null },
            { freq: BenefitFrequency.QUARTERLY, ref: utcDate(2023, 4, 10), open: null },
            { freq: BenefitFrequency.YEARLY, ref: utcDate(2023, 8, 1), open: null },
            { freq: BenefitFrequency.YEARLY, ref: utcDate(2023, 2, 5), open: utcDate(2022, 3, 1) }, // Anniversary March
        ];
        for (const s of scenarios) {
            const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(s.freq, s.ref, s.open);
            expect(cycleEndDate.getTime()).toBeGreaterThan(cycleStartDate.getTime());
        }
    });

    it('should produce valid end date after start date for CALENDAR_FIXED cases', () => {
        const scenarios = [
            { ref: utcDate(2023, 2, 15), align: BenefitCycleAlignment.CALENDAR_FIXED, startMo: 1, durMo: 3 }, // Jan-Mar
            { ref: utcDate(2023, 12, 1), align: BenefitCycleAlignment.CALENDAR_FIXED, startMo: 11, durMo: 3 }, // Nov-Jan (spans year)
        ];
        for (const s of scenarios) {
            const { cycleStartDate, cycleEndDate } = calculateBenefitCycle(BenefitFrequency.YEARLY, s.ref, null, s.align, s.startMo, s.durMo);
            expect(cycleEndDate.getTime()).toBeGreaterThan(cycleStartDate.getTime());
        }
    });
  });
});

describe('calculateOneTimeBenefitLifetime', () => {
  const utcDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

  // Mock console.error to avoid cluttering test output
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // consoleLogSpy is not needed for this describe block
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should return a start date equal to the benefitStartDate', () => {
    const startDate = utcDate(2023, 5, 10); // May 10, 2023
    const { cycleStartDate } = calculateOneTimeBenefitLifetime(startDate);
    expect(cycleStartDate).toEqual(startDate);
  });

  it('should return an end date 10 years after the benefitStartDate, preserving month and day', () => {
    const startDate = utcDate(2023, 5, 10); // May 10, 2023
    const { cycleEndDate } = calculateOneTimeBenefitLifetime(startDate);
    
    const expectedEndDate = utcDate(2033, 5, 10); // May 10, 2033
    // The function sets time to end of day for cycleEndDate
    expectedEndDate.setUTCHours(23, 59, 59, 999);

    expect(cycleEndDate.getUTCFullYear()).toBe(2033);
    expect(cycleEndDate.getUTCMonth()).toBe(startDate.getUTCMonth()); // Month should be the same (0-indexed)
    expect(cycleEndDate.getUTCDate()).toBe(startDate.getUTCDate()); // Day should be the same
    expect(cycleEndDate.getUTCHours()).toBe(23);
    expect(cycleEndDate.getUTCMinutes()).toBe(59);
    expect(cycleEndDate.getUTCSeconds()).toBe(59);
    expect(cycleEndDate.getUTCMilliseconds()).toBe(999);
  });

  it('should handle dates at the end of a month correctly, e.g., leap year Feb 29', () => {
    const startDate = utcDate(2024, 2, 29); // Feb 29, 2024 (leap year)
    const { cycleStartDate, cycleEndDate } = calculateOneTimeBenefitLifetime(startDate);
    expect(cycleStartDate).toEqual(startDate);

    // const expectedEndDate = utcDate(2034, 2, 29); // Unused variable
                                                  // The implementation actually preserves day, so this would be Feb 29, 2034 if new Date() handles it.
                                                  // Let's check the actual behavior based on the implementation.
                                                  // Implementation uses: Date.UTC(year + 10, month, day, 23, 59, 59, 999)
                                                  // Date.UTC handles month overflow, but not really day overflow if month is valid.
                                                  // For Feb 29, 2034, it becomes March 1, 2034 in JS Date if not careful.
                                                  // The current implementation passes the original day directly.
    
    // const checkDate = new Date(Date.UTC(2034, 1, 29)); // Unused variable. This becomes March 1, 2034, month is 0-indexed (1 = Feb)
    // So, if startDate is Feb 29, expectedEndDate will be March 1, 2034, 23:59:59.999
    // This is because Date.UTC(2034, 1 (Feb), 29) results in March 1st for a non-leap year.

    expect(cycleEndDate.getUTCFullYear()).toBe(2034);
    // Due to Date.UTC behavior for non-existent dates like Feb 29 in a non-leap year:
    expect(cycleEndDate.getUTCMonth()).toBe(2); // March (0-indexed)
    expect(cycleEndDate.getUTCDate()).toBe(1);   // 1st
  });

   it('should handle Dec 31 correctly', () => {
    const startDate = utcDate(2023, 12, 31); // Dec 31, 2023
    const { cycleStartDate, cycleEndDate } = calculateOneTimeBenefitLifetime(startDate);
    expect(cycleStartDate).toEqual(startDate);

    expect(cycleEndDate.getUTCFullYear()).toBe(2033);
    expect(cycleEndDate.getUTCMonth()).toBe(11); // December
    expect(cycleEndDate.getUTCDate()).toBe(31); // 31st
  });

}); 