import { BenefitFrequency } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { materializeStandardBenefitStatusRows } from '@/lib/benefit-cycle-materialization';
import { createCardForUser } from '../cardUtils';

jest.mock('@/lib/benefit-cycle-materialization', () => ({
  materializeStandardBenefitStatusRows: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockQueryRaw = prisma.$queryRaw as jest.Mock;
const mockCreditCardCreate = prisma.creditCard.create as jest.Mock;
const mockCreditCardEventCreate = prisma.creditCardEvent.create as jest.Mock;
const mockBenefitStatusCreateMany = prisma.benefitStatus.createMany as jest.Mock;
const mockMaterializeStandard = jest.mocked(materializeStandardBenefitStatusRows);
const openedDate = new Date('2026-01-15T00:00:00.000Z');

function globalCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global-card-1',
    name: 'Global Travel Card',
    issuer: 'Issuer',
    annualFee: 95,
    productKey: 'global-travel-card',
    retiredAt: null,
    benefits: [{
      id: 'global-benefit-1',
      description: 'Monthly travel credit',
      frequency: BenefitFrequency.MONTHLY,
      cycleAlignment: null,
      fixedCycleStartMonth: null,
      fixedCycleDurationMonths: null,
      occurrencesInCycle: 1,
    }],
    ...overrides,
  };
}

describe('createCardForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw
      .mockResolvedValueOnce([globalCard()])
      .mockResolvedValueOnce(globalCard().benefits);
    mockCreditCardCreate.mockResolvedValue({ id: 'physical-card-1' } as never);
    mockCreditCardEventCreate.mockResolvedValue({ id: 'event-1' } as never);
    mockBenefitStatusCreateMany.mockResolvedValue({ count: 1 });
    mockMaterializeStandard.mockReturnValue({
      rows: [{
        creditCardId: 'physical-card-1',
        predefinedBenefitId: 'global-benefit-1',
        userId: 'user-1',
        cycleStartDate: new Date('2026-01-01T00:00:00.000Z'),
        cycleEndDate: new Date('2026-01-31T23:59:59.999Z'),
        occurrenceIndex: 0,
      }],
      warnings: [],
    });
  });

  it('atomically creates a physical card, opening event, and global status without copying a Benefit', async () => {
    const result = await createCardForUser(
      'user-1',
      'global-card-1',
      openedDate,
      '1234',
      'Travel'
    );

    expect(result).toEqual({ success: true, cardId: 'physical-card-1' });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    const cardQuery = (mockQueryRaw.mock.calls[0][0] as readonly string[]).join('');
    const benefitQuery = (mockQueryRaw.mock.calls[1][0] as readonly string[]).join('');
    expect(cardQuery).toContain('"retiredAt" IS NULL');
    expect(benefitQuery).toContain('"retiredAt" IS NULL');
    expect(benefitQuery).toContain('"predefinedCardId" =');
    expect(mockPrisma.creditCard.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        predefinedCardId: 'global-card-1',
        openedDate,
        lastFourDigits: '1234',
        nickname: 'Travel',
        annualFeeAmount: 95,
        productKey: 'global-travel-card',
      }),
    });
    expect(mockPrisma.creditCardEvent.create).toHaveBeenCalledWith({
      data: {
        creditCardId: 'physical-card-1',
        userId: 'user-1',
        eventType: 'OPENED',
        eventDate: openedDate,
        description: 'Opened Global Travel Card',
      },
    });
    expect(mockPrisma.benefitStatus.createMany).toHaveBeenCalledWith({
      data: [{
        creditCardId: 'physical-card-1',
        predefinedBenefitId: 'global-benefit-1',
        userId: 'user-1',
        cycleStartDate: new Date('2026-01-01T00:00:00.000Z'),
        cycleEndDate: new Date('2026-01-31T23:59:59.999Z'),
        occurrenceIndex: 0,
        isCompleted: false,
        completedAt: null,
        usedAmount: 0,
      }],
    });
    expect(mockPrisma.benefit.create).not.toHaveBeenCalled();
  });

  it('rejects a retired global product before creating user-owned rows', async () => {
    mockQueryRaw.mockReset().mockResolvedValueOnce([]);

    const result = await createCardForUser('user-1', 'global-card-1', openedDate);

    expect(result).toEqual({
      success: false,
      message: 'Predefined card not found or no longer active.',
    });
    expect(mockPrisma.creditCard.create).not.toHaveBeenCalled();
    expect(mockPrisma.creditCardEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.benefitStatus.createMany).not.toHaveBeenCalled();
  });

  it('returns failure when status creation aborts the card transaction', async () => {
    mockBenefitStatusCreateMany.mockRejectedValue(new Error('Status insert failed'));

    const result = await createCardForUser('user-1', 'global-card-1', openedDate);

    expect(result).toEqual({ success: false, message: 'Failed to create the card.' });
    expect(mockPrisma.creditCard.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.creditCardEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.benefitStatus.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.benefit.create).not.toHaveBeenCalled();
  });

  it('does not create a status batch when the active global product has no active benefits', async () => {
    mockQueryRaw
      .mockReset()
      .mockResolvedValueOnce([globalCard()])
      .mockResolvedValueOnce([]);

    const result = await createCardForUser('user-1', 'global-card-1', openedDate);

    expect(result).toEqual({ success: true, cardId: 'physical-card-1' });
    expect(mockPrisma.benefitStatus.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.benefit.create).not.toHaveBeenCalled();
  });
});
