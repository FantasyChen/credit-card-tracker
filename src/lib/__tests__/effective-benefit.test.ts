import { BenefitFrequency } from '@/generated/prisma';
import {
  fetchEffectiveBenefitStatuses,
  fetchEffectiveCardTerms,
  projectEffectiveBenefitRow,
  resolveAuthoritativeDefinition,
} from '../effective-benefit';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

function row(overrides: Record<string, unknown> = {}) {
  return {
    statusId: 'status-1',
    benefitId: null,
    statusCreditCardId: 'card-1',
    predefinedBenefitId: 'global-1',
    userId: 'user-1',
    cycleStartDate: date('2026-07-01'),
    cycleEndDate: date('2026-07-31'),
    isCompleted: true,
    completedAt: date('2026-07-10'),
    isNotUsable: false,
    usedAmount: 25,
    statusCreatedAt: date('2026-07-01'),
    statusUpdatedAt: date('2026-07-10'),
    orderIndex: 3,
    occurrenceIndex: 0,

    legacyId: null,
    legacyCategory: null,
    legacyDescription: null,
    legacyPercentage: null,
    legacyMaxAmount: null,
    legacyStartDate: null,
    legacyEndDate: null,
    legacyFrequency: null,
    legacyCreditCardId: null,
    legacyUserId: null,
    legacyCreatedAt: null,
    legacyUpdatedAt: null,
    legacyCycleAlignment: null,
    legacyFixedCycleStartMonth: null,
    legacyFixedCycleDurationMonths: null,
    legacyOccurrencesInCycle: null,
    legacyProductKey: null,
    legacyCreditFamilyKey: null,
    legacyPeriodKey: null,

    globalId: 'global-1',
    globalPredefinedCardId: 'global-card-1',
    globalCategory: 'Current global category',
    globalDescription: 'Current global description',
    globalPercentage: 0,
    globalMaxAmount: 100,
    globalFrequency: BenefitFrequency.MONTHLY,
    globalCreatedAt: date('2025-01-01'),
    globalUpdatedAt: date('2026-07-20'),
    globalCycleAlignment: null,
    globalFixedCycleStartMonth: null,
    globalFixedCycleDurationMonths: null,
    globalOccurrencesInCycle: 1,
    globalProductKey: 'global-product-key',
    globalCreditFamilyKey: 'travel-credit',
    globalPeriodKey: 'monthly',
    globalUsageWaySlug: 'current-global-guide',
    migrationClassification: null,

    cardId: 'card-1',
    cardName: 'Global Card',
    cardIssuer: 'Issuer',
    cardNumber: null,
    cardExpiryDate: null,
    cardOpenedDate: date('2025-01-15'),
    cardUserId: 'user-1',
    cardCreatedAt: date('2025-01-15'),
    cardUpdatedAt: date('2026-01-01'),
    cardLastFourDigits: '1234',
    cardNickname: null,
    cardLifecycleStatus: 'ACTIVE',
    cardClosedDate: null,
    cardAnnualFeeAmount: 95,
    cardAnnualFeeDueDate: date('2027-01-15'),
    cardSignupBonusDeadline: null,
    cardSpendDeadline: null,
    cardProductChangedFrom: null,
    cardProductChangedTo: null,
    cardLifecycleNotes: null,
    cardProductKey: 'global-product-key',
    cardPredefinedCardId: 'global-card-1',
    ...overrides,
  };
}

function legacyFields(overrides: Record<string, unknown> = {}) {
  return {
    legacyId: 'legacy-1',
    legacyCategory: 'Legacy category',
    legacyDescription: 'Legacy description',
    legacyPercentage: 5,
    legacyMaxAmount: 10,
    legacyStartDate: date('2024-01-01'),
    legacyEndDate: null,
    legacyFrequency: BenefitFrequency.YEARLY,
    legacyCreditCardId: 'card-1',
    legacyUserId: null,
    legacyCreatedAt: date('2024-01-01'),
    legacyUpdatedAt: date('2024-01-02'),
    legacyCycleAlignment: null,
    legacyFixedCycleStartMonth: null,
    legacyFixedCycleDurationMonths: null,
    legacyOccurrencesInCycle: 1,
    legacyProductKey: 'legacy-product-key',
    legacyCreditFamilyKey: 'legacy-family',
    legacyPeriodKey: 'yearly',
    ...overrides,
  };
}

function withoutGlobal(overrides: Record<string, unknown> = {}) {
  return {
    predefinedBenefitId: null,
    globalId: null,
    globalPredefinedCardId: null,
    globalCategory: null,
    globalDescription: null,
    globalPercentage: null,
    globalMaxAmount: null,
    globalFrequency: null,
    globalCreatedAt: null,
    globalUpdatedAt: null,
    globalCycleAlignment: null,
    globalFixedCycleStartMonth: null,
    globalFixedCycleDurationMonths: null,
    globalOccurrencesInCycle: null,
    globalProductKey: null,
    globalCreditFamilyKey: null,
    globalPeriodKey: null,
    globalUsageWaySlug: null,
    ...overrides,
  };
}

describe('projectEffectiveBenefitRow', () => {
  it('projects a global-only standard status with immutable definition capabilities', () => {
    const result = projectEffectiveBenefitRow(row() as never);

    expect(result).toMatchObject({
      id: 'status-1',
      benefitId: 'standard:global-1',
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-1',
      isCompleted: true,
      usedAmount: 25,
      source: {
        kind: 'standard',
        predefinedBenefitId: 'global-1',
        creditCardId: 'card-1',
      },
      usageWaySlug: 'current-global-guide',
      isCustomBenefit: false,
      canMutateDefinition: false,
      benefit: {
        id: 'global-1',
        description: 'Current global description',
        maxAmount: 100,
        startDate: date('2025-01-15'),
      },
    });
  });

  it('uses current global terms and direct guide linkage for a bridge status', () => {
    const result = projectEffectiveBenefitRow(row({
      benefitId: 'legacy-1',
      ...legacyFields(),
    }) as never);

    expect(result.source).toEqual({
      kind: 'bridge',
      predefinedBenefitId: 'global-1',
      creditCardId: 'card-1',
      legacyBenefitId: 'legacy-1',
    });
    expect(result.benefit).toMatchObject({
      id: 'global-1',
      category: 'Current global category',
      description: 'Current global description',
      maxAmount: 100,
    });
    expect(result.usageWaySlug).toBe('current-global-guide');
    expect(result.canMutateDefinition).toBe(false);
  });

  it('projects standalone and card-linked user definitions as custom', () => {
    const standalone = projectEffectiveBenefitRow(row({
      benefitId: 'custom-1',
      statusCreditCardId: null,
      cardId: null,
      ...withoutGlobal(),
      ...legacyFields({
        legacyId: 'custom-1',
        legacyCreditCardId: null,
        legacyUserId: 'user-1',
      }),
    }) as never);
    const cardLinked = projectEffectiveBenefitRow(row({
      benefitId: 'custom-2',
      ...withoutGlobal(),
      ...legacyFields({
        legacyId: 'custom-2',
        legacyCreditCardId: 'card-1',
        legacyUserId: 'user-1',
      }),
    }) as never);

    expect(standalone.source).toEqual({
      kind: 'custom',
      benefitId: 'custom-1',
      creditCardId: null,
    });
    expect(standalone.benefit.creditCard).toBeNull();
    expect(standalone.canMutateDefinition).toBe(true);
    expect(cardLinked.source).toEqual({
      kind: 'custom',
      benefitId: 'custom-2',
      creditCardId: 'card-1',
    });
    expect(cardLinked.benefit.creditCard?.id).toBe('card-1');
  });

  it('keeps an ownerless copied definition as read-only legacy fallback', () => {
    const result = projectEffectiveBenefitRow(row({
      benefitId: 'legacy-1',
      ...withoutGlobal(),
      ...legacyFields(),
    }) as never);

    expect(result.source).toEqual({
      kind: 'legacy',
      benefitId: 'legacy-1',
      creditCardId: 'card-1',
    });
    expect(result.isCustomBenefit).toBe(false);
    expect(result.canMutateDefinition).toBe(false);
    expect(result.benefit.description).toBe('Legacy description');
  });

  it('projects a classifier-proven ownerless card definition as custom', () => {
    const result = projectEffectiveBenefitRow(row({
      benefitId: 'legacy-custom-1',
      migrationClassification: 'CUSTOM',
      ...withoutGlobal(),
      ...legacyFields({
        legacyId: 'legacy-custom-1',
        legacyUserId: null,
      }),
    }) as never);

    expect(result.source).toEqual({
      kind: 'custom',
      benefitId: 'legacy-custom-1',
      creditCardId: 'card-1',
    });
    expect(result.isCustomBenefit).toBe(true);
    expect(result.canMutateDefinition).toBe(true);
  });

  it('keeps a classifier-proven standard read-only before bridge metadata is attached', () => {
    const result = projectEffectiveBenefitRow(row({
      benefitId: 'legacy-standard-1',
      migrationClassification: 'STANDARD',
      ...withoutGlobal(),
      ...legacyFields({
        legacyId: 'legacy-standard-1',
        legacyUserId: 'user-1',
      }),
    }) as never);

    expect(result.source).toEqual({
      kind: 'legacy',
      benefitId: 'legacy-standard-1',
      creditCardId: 'card-1',
    });
    expect(result.isCustomBenefit).toBe(false);
    expect(result.canMutateDefinition).toBe(false);
  });

  it('rejects inconsistent ownership and malformed standard links', () => {
    expect(() => projectEffectiveBenefitRow(row({
      benefitId: 'custom-1',
      ...withoutGlobal(),
      ...legacyFields({ legacyId: 'custom-1', legacyUserId: 'another-user' }),
    }) as never)).toThrow('inconsistent ownership');

    expect(() => projectEffectiveBenefitRow(row({ cardPredefinedCardId: null }) as never))
      .toThrow('without a global product');
    expect(() => projectEffectiveBenefitRow(row({
      globalPredefinedCardId: 'another-global-card',
    }) as never)).toThrow('different global products');
  });
});

describe('effective benefit lookup contracts', () => {
  it('prefers a global relation over a retained legacy relation', () => {
    expect(resolveAuthoritativeDefinition({
      benefit: { description: 'legacy' },
      predefinedBenefit: { description: 'global' },
    })).toEqual({ description: 'global' });
  });

  it('requires an explicit ownership scope and short-circuits an empty user list', async () => {
    const database = { $queryRaw: jest.fn() };

    await expect(fetchEffectiveBenefitStatuses(database as never, {}))
      .rejects.toThrow('An owned userId or userIds filter is required.');
    await expect(fetchEffectiveBenefitStatuses(database as never, { userIds: [] }))
      .resolves.toEqual([]);
    expect(database.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects ambiguous single-user and multi-user filters', async () => {
    const database = { $queryRaw: jest.fn() };

    await expect(fetchEffectiveBenefitStatuses(database as never, {
      userId: 'user-1',
      userIds: ['user-1'],
    })).rejects.toThrow('Specify either userId or userIds, not both.');
  });

  it('loads latest global card terms through an owned physical-card query', async () => {
    const database = { $queryRaw: jest.fn().mockResolvedValue([]) };

    await fetchEffectiveCardTerms(database as never, 'user-1');

    const query = database.$queryRaw.mock.calls[0][0] as { strings: readonly string[] };
    const sql = query.strings.join('');
    expect(sql).toContain('COALESCE(pc."name", fallback."name", c."name")');
    expect(sql).toContain('c."userId" =');
    await expect(fetchEffectiveCardTerms(database as never, ''))
      .rejects.toThrow('An owned userId is required.');
  });
});
