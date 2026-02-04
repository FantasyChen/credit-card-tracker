import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Session } from 'next-auth';

// Mock the cache functions - Prisma is mocked globally in jest.setup.ts
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { batchCompleteBenefitsByCategoryAction } from '../actions';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { revalidatePath } from 'next/cache';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetServerSession = jest.mocked(getServerSession);
const mockRevalidatePath = jest.mocked(revalidatePath);

describe('batchCompleteBenefitsByCategoryAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should batch complete benefits successfully', async () => {
    // Mock authenticated user
    const mockSession: Session = {
      user: { id: 'test-user-id' },
      expires: '2024-12-31',
    };
    mockGetServerSession.mockResolvedValue(mockSession);

    // Mock findMany to return statuses with benefits
    const mockStatuses = [
      { id: 'benefit-1', usedAmount: 0, benefit: { maxAmount: 100 } },
      { id: 'benefit-2', usedAmount: 30, benefit: { maxAmount: 50 } },
      { id: 'benefit-3', usedAmount: 0, benefit: { maxAmount: 75 } },
    ];
    mockPrisma.benefitStatus.findMany.mockResolvedValue(mockStatuses as never);
    mockPrisma.benefitStatus.update.mockResolvedValue({} as never);

    const category = 'Travel';
    const benefitStatusIds = ['benefit-1', 'benefit-2', 'benefit-3'];

    const result = await batchCompleteBenefitsByCategoryAction(category, benefitStatusIds);

    // Verify findMany was called to fetch statuses
    expect(mockPrisma.benefitStatus.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: benefitStatusIds },
        userId: 'test-user-id',
        isCompleted: false,
        isNotUsable: false,
        benefit: {
          category: category,
        },
      },
      include: {
        benefit: true,
      },
    });

    // Verify update was called for each status with usedAmount set to maxAmount
    expect(mockPrisma.benefitStatus.update).toHaveBeenCalledTimes(3);

    // Verify revalidation was called
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');

    // Verify return value
    expect(result).toEqual({ success: true, updatedCount: 3 });
  });

  it('should throw error when user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(
      batchCompleteBenefitsByCategoryAction('Travel', ['benefit-1'])
    ).rejects.toThrow('User not authenticated.');

    expect(mockPrisma.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('should throw error when category is missing', async () => {
    const mockSession: Session = {
      user: { id: 'test-user-id' },
      expires: '2024-12-31',
    };
    mockGetServerSession.mockResolvedValue(mockSession);

    await expect(
      batchCompleteBenefitsByCategoryAction('', ['benefit-1'])
    ).rejects.toThrow('Category and benefit status IDs are required.');

    expect(mockPrisma.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('should throw error when benefit status IDs are empty', async () => {
    const mockSession: Session = {
      user: { id: 'test-user-id' },
      expires: '2024-12-31',
    };
    mockGetServerSession.mockResolvedValue(mockSession);

    await expect(
      batchCompleteBenefitsByCategoryAction('Travel', [])
    ).rejects.toThrow('Category and benefit status IDs are required.');

    expect(mockPrisma.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    const mockSession: Session = {
      user: { id: 'test-user-id' },
      expires: '2024-12-31',
    };
    mockGetServerSession.mockResolvedValue(mockSession);

    // Mock findMany to throw an error
    mockPrisma.benefitStatus.findMany.mockRejectedValue(new Error('Database error'));

    await expect(
      batchCompleteBenefitsByCategoryAction('Travel', ['benefit-1'])
    ).rejects.toThrow('Failed to batch complete benefits.');

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('should only update uncompleted and usable benefits', async () => {
    const mockSession: Session = {
      user: { id: 'test-user-id' },
      expires: '2024-12-31',
    };
    mockGetServerSession.mockResolvedValue(mockSession);

    // Mock findMany to return only 2 eligible statuses (filtering out completed/not usable)
    const mockStatuses = [
      { id: 'benefit-1', usedAmount: 0, benefit: { maxAmount: 100 } },
      { id: 'benefit-2', usedAmount: 20, benefit: { maxAmount: 50 } },
    ];
    mockPrisma.benefitStatus.findMany.mockResolvedValue(mockStatuses as never);
    mockPrisma.benefitStatus.update.mockResolvedValue({} as never);

    const category = 'Dining';
    const benefitStatusIds = ['benefit-1', 'benefit-2', 'benefit-3'];

    await batchCompleteBenefitsByCategoryAction(category, benefitStatusIds);

    // Verify the where clause includes filters for uncompleted and usable benefits
    expect(mockPrisma.benefitStatus.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: benefitStatusIds },
        userId: 'test-user-id',
        isCompleted: false, // Only uncompleted benefits
        isNotUsable: false, // Only usable benefits
        benefit: {
          category: category,
        },
      },
      include: {
        benefit: true,
      },
    });

    // Verify update was called for each eligible status
    expect(mockPrisma.benefitStatus.update).toHaveBeenCalledTimes(2);
  });
}); 