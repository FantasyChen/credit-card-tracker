import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';
import { globalDefinitionFingerprint } from '@/lib/global-benefit-migration';
import { prisma } from '@/lib/prisma';
import { insertMissingBenefitStatuses } from '@/lib/cron/check-benefits';
import {
  amexSyncAuditRetentionCutoff,
  deleteExpiredAmexSyncRowAudits,
} from '@/lib/amex-sync/repository';
import { NextResponse } from 'next/server';
import { GET, POST } from '../route';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    benefitStatus: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    benefitTrackingPreference: { findMany: jest.fn() },
    predefinedBenefit: { findMany: jest.fn() },
    benefit: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/benefit-cycle', () => ({
  calculateBenefitCycle: jest.fn(),
  calculateOneTimeBenefitLifetime: jest.fn(),
}));

jest.mock('@/lib/amex-sync/repository', () => ({
  amexSyncAuditRetentionCutoff: jest.fn(),
  deleteExpiredAmexSyncRowAudits: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status ?? 200,
    })),
  },
}));

const mockQueryRaw = prisma.$queryRaw as jest.Mock;
const mockFindMany = prisma.benefitStatus.findMany as jest.Mock;
const mockCreateMany = prisma.benefitStatus.createMany as jest.Mock;
const mockTrackingPreferenceFindMany = prisma.benefitTrackingPreference.findMany as jest.Mock;
const mockPredefinedBenefitFindMany = prisma.predefinedBenefit.findMany as jest.Mock;
const mockBenefitFindMany = prisma.benefit.findMany as jest.Mock;
const mockCalculateBenefitCycle = calculateBenefitCycle as jest.Mock;
const mockDeleteExpiredAudits = deleteExpiredAmexSyncRowAudits as jest.Mock;
const utcDate = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day));

function request(method = 'GET', suffix = '') {
  return new Request(`http://localhost/api/cron/check-benefits${suffix}`, {
    method,
    headers: { authorization: 'Bearer test-secret' },
  });
}

function standardDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global-benefit-1',
    userId: 'user-1',
    creditCardId: 'card-1',
    cardOpenedDate: utcDate(2025, 1, 15),
    description: 'Monthly travel credit',
    frequency: BenefitFrequency.MONTHLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: null,
    fixedCycleDurationMonths: null,
    occurrencesInCycle: 1,
    ...overrides,
  };
}

function customDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: 'custom-benefit-1',
    userId: 'user-1',
    cardOpenedDate: null,
    startDate: utcDate(2025, 1, 1),
    description: 'Custom quarterly credit',
    frequency: BenefitFrequency.QUARTERLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: null,
    fixedCycleDurationMonths: null,
    occurrencesInCycle: 1,
    ...overrides,
  };
}

function categoryRepairParent(overrides: Record<string, unknown> = {}) {
  const benefit = {
    id: 'global-benefit-1',
    catalogKey: 'benefit:global-card-1:credit-1',
    predefinedCardId: 'global-card-1',
    category: 'Dining',
    description: 'Current canonical credit',
    percentage: 100,
    maxAmount: 100,
    frequency: BenefitFrequency.QUARTERLY,
    cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
    fixedCycleStartMonth: null,
    fixedCycleDurationMonths: null,
    occurrencesInCycle: 1,
    productKey: 'product-1',
    creditFamilyKey: 'product-1:credit-1',
    periodKey: 'calendar-quarter',
    retiredAt: null,
  };
  return {
    sourceBenefitId: 'custom-benefit-1',
    ledgerId: 'ledger-1',
    ledgerLegacyBenefitId: 'custom-benefit-1',
    ledgerUserId: 'user-1',
    ledgerCreditCardId: 'card-1',
    ledgerPredefinedCardId: null,
    ledgerPredefinedBenefitId: null,
    ledgerClassification: 'CUSTOM',
    ledgerPhase: 'CLASSIFIED',
    ledgerDestinationFingerprint: null,
    repairId: 'repair-1',
    repairLegacyBenefitId: 'custom-benefit-1',
    repairLedgerId: 'ledger-1',
    repairUserId: 'user-1',
    repairCreditCardId: 'card-1',
    repairPredefinedCardId: 'global-card-1',
    repairPredefinedBenefitId: 'global-benefit-1',
    targetCardCatalogKey: 'card:global-card-1',
    targetBenefitCatalogKey: 'benefit:global-card-1:credit-1',
    definitionFingerprint: globalDefinitionFingerprint(benefit),
    evidenceVersion: 1,
    repairPhase: 'APPLIED',
    repairRolledBackAt: null,
    cardId: 'card-1',
    cardUserId: 'user-1',
    cardPredefinedCardId: 'global-card-1',
    productId: 'global-card-1',
    productCatalogKey: 'card:global-card-1',
    productName: 'Global Card',
    productIssuer: 'Issuer',
    productKey: 'product-1',
    productRetiredAt: null,
    benefitId: benefit.id,
    benefitCatalogKey: benefit.catalogKey,
    benefitPredefinedCardId: benefit.predefinedCardId,
    benefitCategory: benefit.category,
    benefitDescription: benefit.description,
    benefitPercentage: benefit.percentage,
    benefitMaxAmount: benefit.maxAmount,
    benefitFrequency: benefit.frequency,
    benefitCycleAlignment: benefit.cycleAlignment,
    benefitFixedCycleStartMonth: benefit.fixedCycleStartMonth,
    benefitFixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
    benefitOccurrencesInCycle: benefit.occurrencesInCycle,
    benefitProductKey: benefit.productKey,
    benefitCreditFamilyKey: benefit.creditFamilyKey,
    benefitPeriodKey: benefit.periodKey,
    benefitRetiredAt: benefit.retiredAt,
    ...overrides,
  };
}

describe('/api/cron/check-benefits', () => {
  let originalProcessEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalProcessEnv = { ...process.env };
    process.env.CRON_SECRET = 'test-secret';
    mockQueryRaw.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 0 });
    mockTrackingPreferenceFindMany.mockResolvedValue([]);
    mockPredefinedBenefitFindMany.mockResolvedValue([]);
    mockBenefitFindMany.mockResolvedValue([]);
    mockCalculateBenefitCycle.mockReturnValue({
      cycleStartDate: utcDate(2026, 7, 1),
      cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
    });
    (amexSyncAuditRetentionCutoff as jest.Mock).mockReturnValue(utcDate(2026, 4, 1));
    mockDeleteExpiredAudits.mockResolvedValue(0);
  });

  afterEach(() => {
    process.env = originalProcessEnv;
    jest.useRealTimers();
  });

  for (const [method, handler] of [['GET', GET], ['POST', POST]] as const) {
    describe(`${method} authorization`, () => {
      it('rejects when the cron secret is not configured', async () => {
        delete process.env.CRON_SECRET;

        await handler(request(method));

        expect(NextResponse.json).toHaveBeenCalledWith(
          { message: 'Cron secret not configured.' },
          { status: 500 }
        );
        expect(mockQueryRaw).not.toHaveBeenCalled();
      });

      it('rejects an incorrect bearer secret', async () => {
        const unauthorized = new Request('http://localhost/api/cron/check-benefits', {
          method,
          headers: { authorization: 'Bearer wrong-secret' },
        });

        await handler(unauthorized);

        expect(NextResponse.json).toHaveBeenCalledWith(
          { message: 'Unauthorized' },
          { status: 401 }
        );
      });
    });
  }

  it('queries active global definitions and returns zero inserts when no sources exist', async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    const standardSql = (mockQueryRaw.mock.calls[0][0] as readonly string[]).join('');
    const customSql = (mockQueryRaw.mock.calls[1][0] as readonly string[]).join('');
    expect(standardSql).toContain('pc."retiredAt" IS NULL');
    expect(standardSql).toContain('pb."retiredAt" IS NULL');
    expect(standardSql).toContain('c."lifecycleStatus" = \'ACTIVE\'');
    expect(standardSql).toContain('generate_series');
    expect(standardSql).toContain('LIMIT');
    expect(customSql).toContain("'CLASSIFIED', 'BRIDGED', 'CLEANED'");
    expect(customSql).toContain('generate_series');
    expect(customSql).toContain('FROM "GlobalBenefitCategoryRepair" repair_order');
    expect(customSql).toContain('LIMIT');
    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      message: 'Cron job executed successfully.',
      rowsCalculated: 0,
      rowsInserted: 0,
      rowsUpserted: 0,
      standardDefinitionsProcessed: 0,
      customAndLegacyDefinitionsProcessed: 0,
    });
    expect(mockDeleteExpiredAudits).toHaveBeenCalledTimes(1);
  });

  it('plans standard and custom sources and persists them insert-only', async () => {
    jest.useFakeTimers().setSystemTime(utcDate(2026, 7, 15));
    mockQueryRaw
      .mockResolvedValueOnce([standardDefinition()])
      .mockResolvedValueOnce([customDefinition()]);
    mockCreateMany.mockResolvedValueOnce({ count: 2 });

    const response = await GET(request());
    const body = await response.json();

    expect(mockCreateMany).toHaveBeenCalledTimes(1);
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        {
          benefitId: null,
          creditCardId: 'card-1',
          predefinedBenefitId: 'global-benefit-1',
          userId: 'user-1',
          cycleStartDate: utcDate(2026, 7, 1),
          cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
          occurrenceIndex: 0,
          isCompleted: false,
          usedAmount: 0,
          isNotUsable: false,
          orderIndex: null,
        },
        {
          benefitId: 'custom-benefit-1',
          creditCardId: null,
          predefinedBenefitId: null,
          userId: 'user-1',
          cycleStartDate: utcDate(2026, 7, 1),
          cycleEndDate: new Date('2026-09-30T23:59:59.999Z'),
          occurrenceIndex: 0,
          isCompleted: false,
          usedAmount: 0,
          isNotUsable: false,
          orderIndex: null,
        },
      ],
      skipDuplicates: true,
    });
    expect(body).toMatchObject({
      rowsCalculated: 2,
      rowsInserted: 2,
      rowsUpserted: 2,
      standardDefinitionsProcessed: 1,
      customAndLegacyDefinitionsProcessed: 1,
    });
  });

  it('suppresses only a custom source with exact applied category-repair authority', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([customDefinition()])
      .mockResolvedValueOnce([categoryRepairParent()]);

    const response = await GET(request());
    const body = await response.json();
    const categoryRepairSql = (mockQueryRaw.mock.calls[2][0] as readonly string[]).join('');

    expect(categoryRepairSql).toContain('FROM "GlobalBenefitCategoryRepair" r');
    expect(categoryRepairSql).toContain('JOIN "CatalogMigrationLedger" l');
    expect(categoryRepairSql).toContain('AND b."id" IN (');
    expect(body).toMatchObject({
      rowsCalculated: 0,
      customAndLegacyDefinitionsProcessed: 0,
    });
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('keeps a custom source materializable when applied repair evidence is malformed', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([customDefinition()])
      .mockResolvedValueOnce([categoryRepairParent({ definitionFingerprint: 'drifted' })]);
    mockCreateMany.mockResolvedValueOnce({ count: 1 });

    const response = await GET(request());
    const body = await response.json();

    expect(body).toMatchObject({
      rowsCalculated: 1,
      customAndLegacyDefinitionsProcessed: 1,
    });
    expect(mockCreateMany).toHaveBeenCalledTimes(1);
  });

  it('keeps duplicate physical cards as separate standard status candidates', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        standardDefinition(),
        standardDefinition({ creditCardId: 'card-2' }),
      ])
      .mockResolvedValueOnce([]);
    mockCreateMany.mockResolvedValueOnce({ count: 2 });

    const response = await GET(request());
    const body = await response.json();
    const insertedRows = mockCreateMany.mock.calls[0][0].data;

    expect(body.rowsCalculated).toBe(2);
    expect(insertedRows.map((row: { creditCardId: string }) => row.creditCardId))
      .toEqual(['card-1', 'card-2']);
  });

  it('dry-runs without writing statuses or deleting audit rows', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([standardDefinition()])
      .mockResolvedValueOnce([]);

    const response = await GET(request('GET', '?dryRun=true'));
    const body = await response.json();

    expect(body).toMatchObject({
      message: 'Cron job dry run completed.',
      dryRun: true,
      rowsCalculated: 1,
      rowsInserted: 1,
    });
    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(mockDeleteExpiredAudits).not.toHaveBeenCalled();
  });

  it('returns 500 when a source query fails', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('Definition query failed'));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      message: 'Cron job failed.',
      error: 'Definition query failed',
    });
    expect(mockCreateMany).not.toHaveBeenCalled();
  });
});

describe('insertMissingBenefitStatuses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackingPreferenceFindMany.mockResolvedValue([]);
    mockPredefinedBenefitFindMany.mockResolvedValue([]);
    mockBenefitFindMany.mockResolvedValue([]);
  });

  it('does not execute SQL for an empty candidate list', async () => {
    await expect(insertMissingBenefitStatuses([])).resolves.toBe(0);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('leaves an exact existing occurrence byte-for-byte untouched', async () => {
    const row = {
      benefitId: null,
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      userId: 'user-1',
      cycleStartDate: utcDate(2026, 7, 1),
      cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
      occurrenceIndex: 0,
    };
    mockFindMany.mockResolvedValue([{ id: 'existing-status', ...row }]);

    await expect(insertMissingBenefitStatuses([row])).resolves.toBe(0);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('stops instead of inserting or rewriting an overlapping cycle discrepancy', async () => {
    const row = {
      benefitId: null,
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      userId: 'user-1',
      cycleStartDate: utcDate(2026, 7, 1),
      cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
      occurrenceIndex: 0,
    };
    mockFindMany.mockResolvedValue([{
      id: 'conflicting-status',
      ...row,
      cycleStartDate: utcDate(2026, 7, 2),
    }]);

    await expect(insertMissingBenefitStatuses([row]))
      .rejects.toThrow('Benefit status cycle discrepancy detected');
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('opens a new cycle unclaimed when the benefit is tracked normally', async () => {
    const row = {
      benefitId: null,
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      userId: 'user-1',
      cycleStartDate: utcDate(2026, 7, 1),
      cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
      occurrenceIndex: 0,
    };
    mockFindMany.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    await expect(insertMissingBenefitStatuses([row])).resolves.toBe(1);
    expect(mockCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ isCompleted: false, completedAt: null, usedAmount: 0 })],
    }));
  });

  it('opens a new cycle already claimed at full value when the benefit is auto-claimed', async () => {
    const row = {
      benefitId: null,
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      userId: 'user-1',
      cycleStartDate: utcDate(2026, 7, 1),
      cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
      occurrenceIndex: 0,
    };
    mockFindMany.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 1 });
    mockTrackingPreferenceFindMany.mockResolvedValue([{
      userId: 'user-1',
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      benefitId: null,
      mode: 'AUTO_CLAIM',
    }]);
    mockPredefinedBenefitFindMany.mockResolvedValue([
      { id: 'global-benefit-1', maxAmount: 15 },
    ]);

    await expect(insertMissingBenefitStatuses([row])).resolves.toBe(1);
    expect(mockCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        isCompleted: true,
        usedAmount: 15,
        completedAt: expect.any(Date),
      })],
    }));
  });

  it('applies one user auto-claim without touching another user with the same benefit', async () => {
    const base = {
      benefitId: null,
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      cycleStartDate: utcDate(2026, 7, 1),
      cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
      occurrenceIndex: 0,
    };
    mockFindMany.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 2 });
    mockTrackingPreferenceFindMany.mockResolvedValue([{
      userId: 'user-1',
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      benefitId: null,
      mode: 'AUTO_CLAIM',
    }]);
    mockPredefinedBenefitFindMany.mockResolvedValue([
      { id: 'global-benefit-1', maxAmount: 15 },
    ]);

    await insertMissingBenefitStatuses([
      { ...base, userId: 'user-1' },
      { ...base, userId: 'user-2' },
    ]);

    expect(mockCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({ userId: 'user-1', isCompleted: true, usedAmount: 15 }),
        expect.objectContaining({ userId: 'user-2', isCompleted: false, usedAmount: 0 }),
      ],
    }));
  });

  it('leaves a new cycle unclaimed for an ignored benefit, since ignoring only hides it', async () => {
    const row = {
      benefitId: null,
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      userId: 'user-1',
      cycleStartDate: utcDate(2026, 7, 1),
      cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
      occurrenceIndex: 0,
    };
    mockFindMany.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 1 });
    mockTrackingPreferenceFindMany.mockResolvedValue([{
      userId: 'user-1',
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      benefitId: null,
      mode: 'IGNORE',
    }]);

    await insertMissingBenefitStatuses([row]);
    expect(mockCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ isCompleted: false, usedAmount: 0 })],
    }));
  });

  it('rejects an oversized insert batch before persistence', async () => {
    const row = {
      benefitId: null,
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      userId: 'user-1',
      cycleStartDate: utcDate(2026, 7, 1),
      cycleEndDate: utcDate(2026, 7, 31),
      occurrenceIndex: 0,
    };

    await expect(insertMissingBenefitStatuses(Array.from({ length: 2001 }, () => row)))
      .rejects.toThrow('Benefit status insert batch exceeds 2000 rows.');
    expect(mockCreateMany).not.toHaveBeenCalled();
  });
});
