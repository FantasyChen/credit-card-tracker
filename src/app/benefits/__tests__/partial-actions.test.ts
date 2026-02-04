import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Session } from 'next-auth';

// Mock the cache functions - Prisma is mocked globally in jest.setup.ts
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import {
  addPartialCompletionAction,
  markFullCompletionAction,
  resetBenefitCompletionAction,
  updateUsedAmountAction,
} from '../actions';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { revalidatePath } from 'next/cache';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetServerSession = jest.mocked(getServerSession);
const mockRevalidatePath = jest.mocked(revalidatePath);

// Helper to create FormData
function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  return formData;
}

// Mock session for authenticated user
const mockSession: Session = {
  user: { id: 'test-user-id' },
  expires: '2024-12-31',
};

// Mock benefit status with benefit
const mockBenefitStatus = {
  id: 'status-1',
  benefitId: 'benefit-1',
  userId: 'test-user-id',
  cycleStartDate: new Date('2024-01-01'),
  cycleEndDate: new Date('2024-01-31'),
  isCompleted: false,
  completedAt: null,
  usedAmount: 0,
  isNotUsable: false,
  orderIndex: null,
  occurrenceIndex: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  benefit: {
    id: 'benefit-1',
    category: 'Travel',
    description: 'Test benefit',
    percentage: 0,
    maxAmount: 100,
    startDate: new Date('2024-01-01'),
    endDate: null,
    frequency: 'MONTHLY',
    creditCardId: 'card-1',
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cycleAlignment: 'CARD_ANNIVERSARY',
    fixedCycleDurationMonths: null,
    fixedCycleStartMonth: null,
    occurrencesInCycle: 1,
  },
};

describe('addPartialCompletionAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds partial amount to existing usedAmount', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 30,
    });
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 50,
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
      amount: '20',
    });

    const result = await addPartialCompletionAction(formData);

    expect(result.success).toBe(true);
    expect(result.newUsedAmount).toBe(50);
    expect(result.isComplete).toBe(false);
    expect(mockPrisma.benefitStatus.update).toHaveBeenCalledWith({
      where: { id: 'status-1' },
      data: {
        usedAmount: 50,
        isCompleted: false,
        completedAt: null,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');
  });

  it('keeps isCompleted false for partial completion', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 0,
    });
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 50,
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
      amount: '50',
    });

    const result = await addPartialCompletionAction(formData);

    expect(result.isComplete).toBe(false);
    expect(mockPrisma.benefitStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCompleted: false,
        }),
      })
    );
  });

  it('auto-completes when partial amount reaches maxAmount', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 80,
    });
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 100,
      isCompleted: true,
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
      amount: '20',
    });

    const result = await addPartialCompletionAction(formData);

    expect(result.success).toBe(true);
    expect(result.newUsedAmount).toBe(100);
    expect(result.isComplete).toBe(true);
    expect(mockPrisma.benefitStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCompleted: true,
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it('caps usedAmount at maxAmount when exceeding', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 80,
    });
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 100,
      isCompleted: true,
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
      amount: '50', // Would exceed max of 100
    });

    const result = await addPartialCompletionAction(formData);

    expect(result.newUsedAmount).toBe(100); // Capped at maxAmount
    expect(result.isComplete).toBe(true);
  });

  it('requires authentication', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const formData = createFormData({
      benefitStatusId: 'status-1',
      amount: '20',
    });

    await expect(addPartialCompletionAction(formData)).rejects.toThrow(
      'User not authenticated.'
    );

    expect(mockPrisma.benefitStatus.findFirst).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('validates user owns the benefit status', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue(null);

    const formData = createFormData({
      benefitStatusId: 'status-not-owned',
      amount: '20',
    });

    // The action throws a generic error in the catch block after the null check
    await expect(addPartialCompletionAction(formData)).rejects.toThrow(
      'Failed to add partial completion.'
    );
  });

  it('rejects negative amounts', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);

    const formData = createFormData({
      benefitStatusId: 'status-1',
      amount: '-10',
    });

    await expect(addPartialCompletionAction(formData)).rejects.toThrow(
      'Amount must be a positive number.'
    );
  });

  it('rejects zero amounts', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);

    const formData = createFormData({
      benefitStatusId: 'status-1',
      amount: '0',
    });

    await expect(addPartialCompletionAction(formData)).rejects.toThrow(
      'Amount must be a positive number.'
    );
  });
});

describe('markFullCompletionAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets usedAmount to maxAmount on full completion', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue(mockBenefitStatus);
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 100,
      isCompleted: true,
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
    });

    const result = await markFullCompletionAction(formData);

    expect(result.success).toBe(true);
    expect(result.usedAmount).toBe(100);
    expect(mockPrisma.benefitStatus.update).toHaveBeenCalledWith({
      where: { id: 'status-1' },
      data: {
        usedAmount: 100,
        isCompleted: true,
        completedAt: expect.any(Date),
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');
  });

  it('sets isCompleted to true on full completion', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue(mockBenefitStatus);
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      isCompleted: true,
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
    });

    await markFullCompletionAction(formData);

    expect(mockPrisma.benefitStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCompleted: true,
        }),
      })
    );
  });

  it('sets completedAt timestamp on full completion', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue(mockBenefitStatus);
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      completedAt: new Date(),
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
    });

    await markFullCompletionAction(formData);

    expect(mockPrisma.benefitStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it('requires authentication', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const formData = createFormData({
      benefitStatusId: 'status-1',
    });

    await expect(markFullCompletionAction(formData)).rejects.toThrow(
      'User not authenticated.'
    );
  });
});

describe('resetBenefitCompletionAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets usedAmount to 0 when resetting', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.updateMany.mockResolvedValue({ count: 1 });

    const formData = createFormData({
      benefitStatusId: 'status-1',
    });

    const result = await resetBenefitCompletionAction(formData);

    expect(result.success).toBe(true);
    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'status-1',
        userId: 'test-user-id',
      },
      data: {
        usedAmount: 0,
        isCompleted: false,
        completedAt: null,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');
  });

  it('sets isCompleted to false when resetting', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.updateMany.mockResolvedValue({ count: 1 });

    const formData = createFormData({
      benefitStatusId: 'status-1',
    });

    await resetBenefitCompletionAction(formData);

    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCompleted: false,
        }),
      })
    );
  });

  it('clears completedAt when resetting', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.updateMany.mockResolvedValue({ count: 1 });

    const formData = createFormData({
      benefitStatusId: 'status-1',
    });

    await resetBenefitCompletionAction(formData);

    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          completedAt: null,
        }),
      })
    );
  });

  it('requires authentication', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const formData = createFormData({
      benefitStatusId: 'status-1',
    });

    await expect(resetBenefitCompletionAction(formData)).rejects.toThrow(
      'User not authenticated.'
    );
  });

  it('validates user owns the benefit status', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.updateMany.mockResolvedValue({ count: 0 });

    const formData = createFormData({
      benefitStatusId: 'status-not-owned',
    });

    // The action throws a generic error in the catch block
    await expect(resetBenefitCompletionAction(formData)).rejects.toThrow(
      'Failed to reset benefit completion.'
    );
  });
});

describe('updateUsedAmountAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows reducing usedAmount', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 80,
      isCompleted: false,
    });
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 50,
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
      newAmount: '50',
    });

    const result = await updateUsedAmountAction(formData);

    expect(result.success).toBe(true);
    expect(result.usedAmount).toBe(50);
    expect(result.isComplete).toBe(false);
  });

  it('sets isCompleted to false when reducing from full', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 100,
      isCompleted: true,
      completedAt: new Date(),
    });
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 50,
      isCompleted: false,
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
      newAmount: '50',
    });

    const result = await updateUsedAmountAction(formData);

    expect(result.isComplete).toBe(false);
    expect(mockPrisma.benefitStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCompleted: false,
          completedAt: null,
        }),
      })
    );
  });

  it('caps amount at maxAmount', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue(mockBenefitStatus);
    mockPrisma.benefitStatus.update.mockResolvedValue({
      ...mockBenefitStatus,
      usedAmount: 100,
      isCompleted: true,
    });

    const formData = createFormData({
      benefitStatusId: 'status-1',
      newAmount: '150', // Exceeds max of 100
    });

    const result = await updateUsedAmountAction(formData);

    expect(result.usedAmount).toBe(100); // Capped
    expect(result.isComplete).toBe(true);
  });

  it('rejects negative amounts', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);

    const formData = createFormData({
      benefitStatusId: 'status-1',
      newAmount: '-10',
    });

    await expect(updateUsedAmountAction(formData)).rejects.toThrow(
      'Amount must be a non-negative number.'
    );
  });

  it('requires authentication', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const formData = createFormData({
      benefitStatusId: 'status-1',
      newAmount: '50',
    });

    await expect(updateUsedAmountAction(formData)).rejects.toThrow(
      'User not authenticated.'
    );
  });

  it('validates user owns the benefit status', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.benefitStatus.findFirst.mockResolvedValue(null);

    const formData = createFormData({
      benefitStatusId: 'status-not-owned',
      newAmount: '50',
    });

    // The action throws a generic error in the catch block after the null check
    await expect(updateUsedAmountAction(formData)).rejects.toThrow(
      'Failed to update used amount.'
    );
  });
});
