import {
  applyBenefitDashboardFilters,
  calculateBenefitGroupSummary,
  isFreeNightOrCertificateBenefit,
  type BenefitDashboardFilters,
  type BenefitDashboardStatus,
} from '../benefit-dashboard';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

function status(
  id: string,
  overrides: Omit<Partial<BenefitDashboardStatus>, 'benefit'> & {
    benefit?: Partial<BenefitDashboardStatus['benefit']>;
  } = {}
): BenefitDashboardStatus {
  const benefitOverrides = overrides.benefit ?? {};
  return {
    id,
    cycleEndDate: date('2026-05-15'),
    isCompleted: false,
    usedAmount: 0,
    ...overrides,
    benefit: {
      description: benefitOverrides.description ?? 'Monthly dining credit',
      category: benefitOverrides.category ?? 'Dining',
      frequency: benefitOverrides.frequency ?? 'MONTHLY',
      maxAmount: benefitOverrides.maxAmount ?? 25,
    },
  };
}

describe('isFreeNightOrCertificateBenefit', () => {
  it('identifies free night and certificate-like benefits', () => {
    expect(isFreeNightOrCertificateBenefit(status('free-night', {
      benefit: { description: 'Annual Free Night Award' },
    }))).toBe(true);
    expect(isFreeNightOrCertificateBenefit(status('cert', {
      benefit: { description: 'Companion certificate' },
    }))).toBe(true);
    expect(isFreeNightOrCertificateBenefit(status('regular', {
      benefit: { description: 'Monthly Uber credit' },
    }))).toBe(false);
  });
});

describe('applyBenefitDashboardFilters', () => {
  const benefits = [
    status('monthly', { benefit: { description: 'Monthly dining credit', frequency: 'MONTHLY' } }),
    status('quarterly', { benefit: { description: 'Quarterly Hilton credit', frequency: 'QUARTERLY' } }),
    status('yearly-fn', { benefit: { description: 'Annual Free Night Award', frequency: 'YEARLY' } }),
  ];

  it('filters benefits by frequency', () => {
    const filters: BenefitDashboardFilters = { frequency: 'QUARTERLY', freeNightOnly: false };

    expect(applyBenefitDashboardFilters(benefits, filters).map((item) => item.id)).toEqual(['quarterly']);
  });

  it('filters benefits to free-night and certificate-like items', () => {
    const filters: BenefitDashboardFilters = { frequency: 'ALL', freeNightOnly: true };

    expect(applyBenefitDashboardFilters(benefits, filters).map((item) => item.id)).toEqual(['yearly-fn']);
  });

  it('combines frequency and free-night filters', () => {
    const filters: BenefitDashboardFilters = { frequency: 'YEARLY', freeNightOnly: true };

    expect(applyBenefitDashboardFilters(benefits, filters).map((item) => item.id)).toEqual(['yearly-fn']);
  });
});

describe('calculateBenefitGroupSummary', () => {
  it('summarizes remaining, claimed, partial count, and soonest due date', () => {
    const benefits = [
      status('partial', {
        cycleEndDate: date('2026-05-20'),
        usedAmount: 10,
        benefit: { maxAmount: 25 },
      }),
      status('completed-legacy', {
        cycleEndDate: date('2026-05-10'),
        isCompleted: true,
        usedAmount: 0,
        benefit: { maxAmount: 50 },
      }),
      status('open', {
        cycleEndDate: date('2026-05-15'),
        usedAmount: 0,
        benefit: { maxAmount: 100 },
      }),
    ];

    expect(calculateBenefitGroupSummary(benefits)).toEqual({
      remainingValue: 115,
      claimedValue: 60,
      partialCount: 1,
      soonestDueDate: date('2026-05-10'),
    });
  });
});
