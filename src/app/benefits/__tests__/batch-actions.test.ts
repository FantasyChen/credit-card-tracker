import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Session } from 'next-auth';

// Mock the dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    benefitStatus: {
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

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
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

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

    // Mock successful database update
    mockPrisma.benefitStatus.updateMany.mockResolvedValue({ count: 3 });

    const category = 'Travel';
    const benefitStatusIds = ['benefit-1', 'benefit-2', 'benefit-3'];

    const result = await batchCompleteBenefitsByCategoryAction(category, benefitStatusIds);

    // Verify the database update was called with correct parameters
    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: benefitStatusIds },
        userId: 'test-user-id',
        isCompleted: false,
        isNotUsable: false,
        benefit: {
          category: category,
        },
      },
      data: {
        isCompleted: true,
        completedAt: expect.any(Date),
      },
    });

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

    mockPrisma.benefitStatus.updateMany.mockRejectedValue(new Error('Database error'));

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

    mockPrisma.benefitStatus.updateMany.mockResolvedValue({ count: 2 });

    const category = 'Dining';
    const benefitStatusIds = ['benefit-1', 'benefit-2', 'benefit-3'];

    await batchCompleteBenefitsByCategoryAction(category, benefitStatusIds);

    // Verify the where clause includes filters for uncompleted and usable benefits
    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: benefitStatusIds },
        userId: 'test-user-id',
        isCompleted: false, // Only uncompleted benefits
        isNotUsable: false, // Only usable benefits
        benefit: {
          category: category,
        },
      },
      data: {
        isCompleted: true,
        completedAt: expect.any(Date),
      },
    });
  });
}); 