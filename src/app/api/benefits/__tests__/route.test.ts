import { BenefitFrequency } from '@/generated/prisma';
import { materializeBenefitStatusRows } from '@/lib/benefit-cycle-materialization';
import { fetchEffectiveBenefitStatuses } from '@/lib/effective-benefit';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET, POST } from '../route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/effective-benefit', () => ({
  fetchEffectiveBenefitStatuses: jest.fn(),
}));

jest.mock('@/lib/benefit-cycle-materialization', () => ({
  materializeBenefitStatusRows: jest.fn(),
}));

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private body: unknown;

    constructor(body?: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }

    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }

    async json() {
      if (typeof this.body === 'string') {
        try {
          return JSON.parse(this.body);
        } catch {
          return this.body;
        }
      }
      return this.body;
    }
  }

  return { NextResponse: MockNextResponse };
});

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCreditCardFindFirst = prisma.creditCard.findFirst as jest.Mock;
const mockBenefitCreate = prisma.benefit.create as jest.Mock;
const mockBenefitStatusCreateMany = prisma.benefitStatus.createMany as jest.Mock;
const mockGetServerSession = jest.mocked(getServerSession);
const mockFetchEffectiveStatuses = jest.mocked(fetchEffectiveBenefitStatuses);
const mockMaterialize = jest.mocked(materializeBenefitStatusRows);
const cardId = 'clxx1234567890123456789012';
const startDate = new Date('2026-07-01T00:00:00.000Z');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/benefits', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    category: 'Travel',
    description: 'My card-linked travel credit',
    percentage: 0,
    maxAmount: 75,
    startDate: startDate.toISOString(),
    endDate: null,
    creditCardId: cardId,
    frequency: BenefitFrequency.MONTHLY,
    ...overrides,
  };
}

describe('/api/benefits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockFetchEffectiveStatuses.mockResolvedValue([]);
    mockCreditCardFindFirst.mockResolvedValue({ openedDate: startDate } as never);
    mockBenefitCreate.mockResolvedValue({
      id: 'custom-benefit-1',
      userId: 'user-1',
      creditCardId: cardId,
      category: 'Travel',
      description: 'My card-linked travel credit',
      percentage: 0,
      maxAmount: 75,
      startDate,
      endDate: null,
      frequency: BenefitFrequency.MONTHLY,
    } as never);
    mockMaterialize.mockReturnValue({
      rows: [{
        benefitId: 'custom-benefit-1',
        userId: 'user-1',
        cycleStartDate: startDate,
        cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
        occurrenceIndex: 0,
      }],
      warnings: [],
    });
    mockBenefitStatusCreateMany.mockResolvedValue({ count: 1 });
  });

  it('requires authentication before reading definitions', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockFetchEffectiveStatuses).not.toHaveBeenCalled();
  });

  it('returns card-linked effective definitions with the existing array shape', async () => {
    const globalDefinition = {
      id: 'global-benefit-1',
      description: 'Current global credit',
      creditCard: { id: cardId },
    };
    mockFetchEffectiveStatuses.mockResolvedValue([
      { benefit: globalDefinition },
      { benefit: globalDefinition },
      { benefit: { id: 'standalone', creditCard: null } },
    ] as never);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual([globalDefinition]);
    expect(mockFetchEffectiveStatuses).toHaveBeenCalledWith(prisma, { userId: 'user-1' });
  });

  it('requires authentication before validating or writing a custom definition', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(postRequest(validInput()));

    expect(response.status).toBe(401);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid input before persistence', async () => {
    const response = await POST(postRequest(validInput({ creditCardId: 'not-a-cuid' })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid benefit input.' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 404 and writes nothing for a missing or wrong-owner physical card', async () => {
    mockCreditCardFindFirst.mockResolvedValue(null);

    const response = await POST(postRequest(validInput()));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Card not found or permission denied.' });
    expect(mockPrisma.creditCard.findFirst).toHaveBeenCalledWith({
      where: { id: cardId, userId: 'user-1' },
      select: { openedDate: true },
    });
    expect(mockPrisma.benefit.create).not.toHaveBeenCalled();
    expect(mockPrisma.benefitStatus.createMany).not.toHaveBeenCalled();
  });

  it('creates a user-owned card-linked custom definition and initial statuses atomically', async () => {
    const response = await POST(postRequest(validInput()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: 'custom-benefit-1', userId: 'user-1', creditCardId: cardId });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.benefit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        creditCardId: cardId,
        category: 'Travel',
        description: 'My card-linked travel credit',
        maxAmount: 75,
      }),
    });
    expect(mockPrisma.benefitStatus.createMany).toHaveBeenCalledWith({
      data: [{
        benefitId: 'custom-benefit-1',
        userId: 'user-1',
        cycleStartDate: startDate,
        cycleEndDate: new Date('2026-07-31T23:59:59.999Z'),
        occurrenceIndex: 0,
        isCompleted: false,
        completedAt: null,
        claimSource: null,
        usedAmount: 0,
      }],
    });
  });

  it('returns 500 when initial status persistence aborts the transaction', async () => {
    mockBenefitStatusCreateMany.mockRejectedValue(new Error('Status insert failed'));

    const response = await POST(postRequest(validInput()));

    expect(response.status).toBe(500);
    expect(mockPrisma.benefit.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.benefitStatus.createMany).toHaveBeenCalledTimes(1);
  });
});
