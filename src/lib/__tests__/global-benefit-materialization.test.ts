import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import { planBenefitStatusMaterialization } from '../global-benefit-materialization';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

function standard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global-benefit-1',
    userId: 'user-1',
    creditCardId: 'card-1',
    cardOpenedDate: date('2025-01-15'),
    description: 'Monthly global credit',
    frequency: BenefitFrequency.MONTHLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: null,
    fixedCycleDurationMonths: null,
    occurrencesInCycle: 1,
    ...overrides,
  };
}

function custom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'custom-benefit-1',
    userId: 'user-1',
    cardOpenedDate: null,
    startDate: date('2026-01-10'),
    description: 'Custom quarterly credit',
    frequency: BenefitFrequency.QUARTERLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: null,
    fixedCycleDurationMonths: null,
    occurrencesInCycle: 1,
    ...overrides,
  };
}

describe('planBenefitStatusMaterialization', () => {
  it('binds source-neutral cycle coordinates to standard and custom identities', () => {
    const plan = planBenefitStatusMaterialization(
      [standard()],
      [custom()],
      date('2026-07-15')
    );

    expect(plan.warnings).toEqual([]);
    expect(plan.rows).toEqual([
      {
        benefitId: null,
        creditCardId: 'card-1',
        predefinedBenefitId: 'global-benefit-1',
        userId: 'user-1',
        cycleStartDate: date('2026-07-01'),
        cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
        occurrenceIndex: 0,
      },
      {
        benefitId: 'custom-benefit-1',
        creditCardId: null,
        predefinedBenefitId: null,
        userId: 'user-1',
        cycleStartDate: date('2026-07-10'),
        cycleEndDate: new Date('2026-10-09T23:59:59.999Z'),
        occurrenceIndex: 0,
      },
    ]);
  });

  it('keeps duplicate physical cards separate while sharing one global definition', () => {
    const plan = planBenefitStatusMaterialization(
      [standard(), standard({ creditCardId: 'card-2' })],
      [],
      date('2026-07-15')
    );

    expect(plan.rows).toHaveLength(2);
    expect(plan.rows.map((row) => row.creditCardId)).toEqual(['card-1', 'card-2']);
    expect(plan.rows.map((row) => row.predefinedBenefitId)).toEqual([
      'global-benefit-1',
      'global-benefit-1',
    ]);
  });

  it('uses the physical card opening date as the stable source for one-time standard rows', () => {
    const definition = standard({
      frequency: BenefitFrequency.ONE_TIME,
      cycleAlignment: null,
    });

    const firstPlan = planBenefitStatusMaterialization(
      [definition],
      [],
      date('2026-07-15')
    );
    const laterPlan = planBenefitStatusMaterialization(
      [definition],
      [],
      date('2026-08-15')
    );

    expect(firstPlan.rows).toEqual(laterPlan.rows);
    expect(firstPlan.rows[0]).toMatchObject({
      cycleStartDate: date('2025-01-15'),
      cycleEndDate: new Date('2035-01-15T23:59:59.999Z'),
    });
  });

  it('preserves occurrence indexes for repeated credits in one cycle', () => {
    const plan = planBenefitStatusMaterialization(
      [standard({ occurrencesInCycle: 3 })],
      [],
      date('2026-07-15')
    );

    expect(plan.rows.map((row) => row.occurrenceIndex)).toEqual([0, 1, 2]);
  });

  it('fails closed on an occurrence count that would make a run unbounded', () => {
    expect(() => planBenefitStatusMaterialization(
      [standard({ occurrencesInCycle: 13 })],
      [],
      date('2026-07-15')
    )).toThrow('expected an integer from 1 to 12');
  });
});
