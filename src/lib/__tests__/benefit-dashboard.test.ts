import {
  applyBenefitDashboardFilters,
  buildBenefitDashboardProjection,
  calculateBenefitGroupSummary,
  CUSTOM_BENEFITS_CARD_NAME,
  deduplicateBenefitStatusesForDashboard,
  isFreeNightOrCertificateBenefit,
  type BenefitDashboardFilters,
  type BenefitDashboardStatus,
  type DisplayBenefitStatus,
  type RawDisplayBenefitStatus,
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

describe('deduplicateBenefitStatusesForDashboard', () => {
  it('keeps the completed duplicate when two statuses share a logical cycle', () => {
    const base = status('base') as unknown as DisplayBenefitStatus;
    const duplicateOpen = {
      ...base,
      id: 'open',
      benefitId: 'benefit-1',
      cycleStartDate: new Date('2026-05-01T08:00:00.000Z'),
      occurrenceIndex: 0,
      updatedAt: new Date('2026-05-02T00:00:00.000Z'),
      isCompleted: false,
      isNotUsable: false,
    };
    const duplicateCompleted = {
      ...base,
      id: 'completed',
      benefitId: 'benefit-1',
      cycleStartDate: new Date('2026-05-01T00:00:00.000Z'),
      occurrenceIndex: 0,
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      isCompleted: true,
      isNotUsable: false,
    };

    expect(deduplicateBenefitStatusesForDashboard([duplicateOpen, duplicateCompleted])).toHaveLength(1);
    expect(deduplicateBenefitStatusesForDashboard([duplicateOpen, duplicateCompleted])[0].id).toBe('completed');
  });
});

describe('buildBenefitDashboardProjection', () => {
  const card = {
    id: 'card-1',
    name: 'Test Card',
    issuer: 'Issuer',
    cardNumber: null,
    expiryDate: null,
    openedDate: new Date('2025-01-01T00:00:00.000Z'),
    userId: 'user-1',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    lastFourDigits: '1234',
    nickname: null,
  };

  function rawStatus(
    id: string,
    overrides: Partial<RawDisplayBenefitStatus> = {}
  ): RawDisplayBenefitStatus {
    const benefitOverrides = overrides.benefit ?? {};
    const hasCreditCardOverride = Object.prototype.hasOwnProperty.call(benefitOverrides, 'creditCard');

    return {
      id,
      benefitId: `benefit-${id}`,
      userId: 'user-1',
      cycleStartDate: date('2026-05-01'),
      cycleEndDate: date('2026-05-31'),
      isCompleted: false,
      completedAt: null,
      isNotUsable: false,
      usedAmount: 0,
      notes: null,
      orderIndex: null,
      occurrenceIndex: 0,
      createdAt: date('2026-05-01'),
      updatedAt: date('2026-05-01'),
      ...overrides,
      benefit: {
        id: `benefit-${id}`,
        category: 'Travel',
        description: 'Monthly travel credit',
        percentage: 0,
        maxAmount: 50,
        startDate: date('2026-05-01'),
        endDate: null,
        frequency: 'MONTHLY' as never,
        creditCardId: card.id,
        userId: null,
        createdAt: date('2026-05-01'),
        updatedAt: date('2026-05-01'),
        cycleAlignment: null,
        fixedCycleDurationMonths: null,
        fixedCycleStartMonth: null,
        occurrencesInCycle: 1,
        ...benefitOverrides,
        creditCard: (hasCreditCardOverride ? benefitOverrides.creditCard : card) as never,
      },
    };
  }

  it('projects tabs, totals, ROI, display names, and usage guide slugs', () => {
    const projection = buildBenefitDashboardProjection({
      statuses: [
        rawStatus('upcoming', { usedAmount: 10 }),
        rawStatus('completed', {
          isCompleted: true,
          usedAmount: 0,
          benefit: { maxAmount: 25 } as never,
        }),
        rawStatus('scheduled', {
          cycleStartDate: date('2026-06-01'),
          cycleEndDate: date('2026-06-30'),
        }),
        rawStatus('custom', {
          isCompleted: true,
          usedAmount: 15,
          benefit: {
            creditCard: null,
            creditCardId: null,
            userId: 'user-1',
            maxAmount: 15,
          } as never,
        }),
      ],
      userCards: [card],
      usageWays: [{
        slug: 'monthly-travel-credit',
        predefinedBenefits: [{ category: 'Travel', description: 'Monthly travel credit' }],
      }],
      predefinedCardFees: [{ name: 'Test Card', annualFee: 95 }],
      now: date('2026-05-15'),
    });

    expect(projection.upcomingBenefits.map((item) => item.id)).toEqual(['upcoming']);
    expect(projection.completedBenefits.map((item) => item.id)).toEqual(['completed', 'custom']);
    expect(projection.scheduledBenefits.map((item) => item.id)).toEqual(['scheduled']);
    expect(projection.totalUnusedValue).toBe(40);
    expect(projection.totalUsedValue).toBe(50);
    expect(projection.totalAnnualFees).toBe(95);
    expect(projection.upcomingBenefits[0].benefit.creditCard?.displayName).toBe('Test Card');
    expect(projection.upcomingBenefits[0].usageWaySlug).toBe('monthly-travel-credit');
    expect(projection.cardLevelRoi.map((row) => row.cardName)).toContain(CUSTOM_BENEFITS_CARD_NAME);
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
