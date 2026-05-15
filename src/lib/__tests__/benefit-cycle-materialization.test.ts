import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import {
  calculateStandaloneBenefitCycle,
  materializeBenefitStatusRows,
} from '../benefit-cycle-materialization';

const utc = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('calculateStandaloneBenefitCycle', () => {
  it('uses calendar month boundaries from the custom benefit start date', () => {
    const cycle = calculateStandaloneBenefitCycle(
      BenefitFrequency.MONTHLY,
      utc('2026-03-20'),
      utc('2026-01-15')
    );

    expect(cycle.cycleStartDate).toEqual(utc('2026-03-15'));
    expect(cycle.cycleEndDate).toEqual(new Date('2026-04-14T23:59:59.999Z'));
  });

  it('returns the first scheduled cycle when the reference date is before the start date', () => {
    const cycle = calculateStandaloneBenefitCycle(
      BenefitFrequency.QUARTERLY,
      utc('2026-01-01'),
      utc('2026-02-10')
    );

    expect(cycle.cycleStartDate).toEqual(utc('2026-02-10'));
    expect(cycle.cycleEndDate).toEqual(new Date('2026-05-09T23:59:59.999Z'));
  });
});

describe('materializeBenefitStatusRows', () => {
  it('normalizes cycle starts and expands occurrences for card benefits', () => {
    const result = materializeBenefitStatusRows(
      {
        id: 'benefit-1',
        userId: 'user-1',
        description: 'Q2: Apr-Jun Credit',
        frequency: BenefitFrequency.QUARTERLY,
        cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
        fixedCycleStartMonth: 4,
        fixedCycleDurationMonths: 3,
        occurrencesInCycle: 2,
      },
      {
        referenceDate: utc('2026-04-15'),
        cardOpenedDate: utc('2025-01-15'),
        validateCycles: true,
      }
    );

    expect(result.warnings).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      benefitId: 'benefit-1',
      userId: 'user-1',
      cycleStartDate: utc('2026-04-01'),
      cycleEndDate: new Date('2026-06-30T23:59:59.999Z'),
      occurrenceIndex: 0,
    });
    expect(result.rows[1].occurrenceIndex).toBe(1);
  });
});
