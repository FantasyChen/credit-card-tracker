import type { EffectiveBenefitStatus } from '../effective-benefit';
import {
  fetchEffectiveBenefitStatuses,
  fetchEffectiveCardTerms,
} from '../effective-benefit';
import {
  loadBenefitDashboard,
  loadHomeDashboardSummary,
} from '../benefit-dashboard';

jest.mock('../effective-benefit', () => ({
  fetchEffectiveBenefitStatuses: jest.fn(),
  fetchEffectiveCardTerms: jest.fn(),
}));

const fetchStatuses = fetchEffectiveBenefitStatuses as jest.MockedFunction<typeof fetchEffectiveBenefitStatuses>;
const fetchCardTerms = fetchEffectiveCardTerms as jest.MockedFunction<typeof fetchEffectiveCardTerms>;

function effectiveStatus(input: {
  id: string;
  start: string;
  end: string;
  usedAmount?: number | null;
  maxAmount?: number;
  completed?: boolean;
  notUsable?: boolean;
  sourceKind?: 'standard' | 'bridge' | 'custom' | 'legacy';
}): EffectiveBenefitStatus {
  const sourceKind = input.sourceKind ?? 'custom';
  const creditCardId = sourceKind === 'custom' || sourceKind === 'legacy' ? null : 'card-1';
  const predefinedBenefitId = sourceKind === 'standard' || sourceKind === 'bridge'
    ? `predefined-${input.id}`
    : null;
  const source = sourceKind === 'standard'
    ? { kind: 'standard' as const, predefinedBenefitId: predefinedBenefitId!, creditCardId: creditCardId! }
    : sourceKind === 'bridge'
      ? { kind: 'bridge' as const, predefinedBenefitId: predefinedBenefitId!, creditCardId: creditCardId!, legacyBenefitId: `benefit-${input.id}` }
      : sourceKind === 'legacy'
        ? { kind: 'legacy' as const, benefitId: `benefit-${input.id}`, creditCardId: null }
        : { kind: 'custom' as const, benefitId: `benefit-${input.id}`, creditCardId: null };
  return {
    id: input.id,
    benefitId: `benefit-${input.id}`,
    creditCardId,
    predefinedBenefitId,
    userId: 'user-1',
    cycleStartDate: new Date(input.start),
    cycleEndDate: new Date(input.end),
    occurrenceIndex: 0,
    usedAmount: input.usedAmount ?? 0,
    isCompleted: input.completed ?? false,
    completedAt: input.completed ? new Date(input.end) : null,
    isNotUsable: input.notUsable ?? false,
    orderIndex: null,
    source,
    isCustomBenefit: sourceKind === 'custom',
    canMutateDefinition: sourceKind === 'custom',
    createdAt: new Date(input.start),
    updatedAt: new Date(input.end),
    usageWaySlug: null,
    benefit: {
      id: `benefit-${input.id}`,
      category: 'Dining',
      description: `Benefit ${input.id}`,
      percentage: 0,
      maxAmount: input.maxAmount ?? 50,
      startDate: new Date(input.start),
      endDate: new Date(input.end),
      frequency: 'YEARLY',
      creditCardId: null,
      userId: 'user-1',
      createdAt: new Date(input.start),
      updatedAt: new Date(input.end),
      cycleAlignment: 'CALENDAR_FIXED',
      fixedCycleStartMonth: 1,
      fixedCycleDurationMonths: 12,
      occurrencesInCycle: 1,
      productKey: null,
      creditFamilyKey: null,
      periodKey: null,
      creditCard: null,
    },
  } as unknown as EffectiveBenefitStatus;
}

describe('deep Benefit Dashboard loading interface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads a render-ready dashboard projection through one interface', async () => {
    const database = {
      creditCard: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'card-1', name: 'Stored name', issuer: 'Stored issuer', annualFeeAmount: null },
        ]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          notifyBenefitExpiration: true,
          notifyExpirationDays: 14,
        }),
      },
      benefitUsageWay: { findMany: jest.fn() },
      benefitTrackingPreference: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn(),
    };
    fetchCardTerms.mockResolvedValue([
      { creditCardId: 'card-1', name: 'Canonical card', issuer: 'Issuer', annualFee: 95, imageUrl: null },
    ]);
    fetchStatuses.mockResolvedValue([]);

    const dashboard = await loadBenefitDashboard(database as never, {
      userId: 'user-1',
      now: new Date('2026-08-07T12:00:00.000Z'),
    });

    expect(dashboard).toMatchObject({
      cardCount: 1,
      totalAnnualFees: 95,
      notifyBenefitExpiration: true,
      notifyExpirationDays: 14,
    });
    expect(dashboard.upcomingBenefits).toEqual([]);
    expect(database.benefitUsageWay.findMany).not.toHaveBeenCalled();
  });

  it('uses current-calendar-year effective statuses for home claimed value', async () => {
    const now = new Date('2026-08-07T12:00:00.000Z');
    const currentYearStatuses = [
      effectiveStatus({ id: 'complete', start: '2026-01-01T00:00:00.000Z', end: '2026-12-31T23:59:59.999Z', completed: true, maxAmount: 50, sourceKind: 'standard' }),
      effectiveStatus({ id: 'partial', start: '2026-04-01T00:00:00.000Z', end: '2026-09-30T23:59:59.999Z', usedAmount: 20, maxAmount: 40, sourceKind: 'bridge' }),
      effectiveStatus({ id: 'custom-not-usable', start: '2026-01-01T00:00:00.000Z', end: '2026-12-31T23:59:59.999Z', usedAmount: 30, notUsable: true, sourceKind: 'custom' }),
      effectiveStatus({ id: 'legacy', start: '2026-01-01T00:00:00.000Z', end: '2026-12-31T23:59:59.999Z', usedAmount: 10, sourceKind: 'legacy' }),
      effectiveStatus({ id: 'prior-year', start: '2025-01-01T00:00:00.000Z', end: '2025-12-31T23:59:59.999Z', usedAmount: 999, sourceKind: 'legacy' }),
    ];
    const activeStatuses = [
      effectiveStatus({ id: 'soon', start: '2026-08-01T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z' }),
      effectiveStatus({ id: 'later', start: '2026-08-01T00:00:00.000Z', end: '2026-08-20T00:00:00.000Z' }),
    ];
    fetchCardTerms.mockResolvedValue([
      { creditCardId: 'card-1', name: 'Card one', issuer: 'Issuer', annualFee: 95, imageUrl: null },
      { creditCardId: 'card-2', name: 'Card two', issuer: 'Issuer', annualFee: 250, imageUrl: null },
    ]);
    fetchStatuses
      .mockResolvedValueOnce(currentYearStatuses)
      .mockResolvedValueOnce(activeStatuses);

    const summary = await loadHomeDashboardSummary({
      $queryRaw: jest.fn(),
      benefitTrackingPreference: { findMany: jest.fn().mockResolvedValue([]) },
    } as never, {
      userId: 'user-1',
      now,
    });

    expect(fetchStatuses).toHaveBeenNthCalledWith(1, expect.anything(), {
      userId: 'user-1',
      cycleStartOnOrBefore: new Date('2026-12-31T23:59:59.999Z'),
      cycleEndOnOrAfter: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(summary).toMatchObject({
      cardCount: 2,
      totalAnnualFees: 345,
      totalClaimedValue: 80,
    });
    expect(summary.expiringSoonBenefits.map((status) => status.id)).toEqual(['soon']);
    expect(summary.upcomingBenefits.map((status) => status.id)).toEqual(['later']);
  });
});
