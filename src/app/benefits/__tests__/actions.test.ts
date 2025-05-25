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

import { updateBenefitOrderAction } from '../actions';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { revalidatePath } from 'next/cache';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

describe('updateBenefitOrderAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update benefit order successfully', async () => {
    // Mock authenticated user
    const mockSession: Session = {
      user: { id: 'test-user-id' },
      expires: '2024-12-31',
    };
    mockGetServerSession.mockResolvedValue(mockSession);

    // Mock successful database updates
    mockPrisma.benefitStatus.updateMany.mockResolvedValue({ count: 1 });

    const benefitStatusIds = ['benefit-1', 'benefit-2', 'benefit-3'];

    await updateBenefitOrderAction(benefitStatusIds);

    // Verify that updateMany was called for each benefit with correct orderIndex
    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenCalledTimes(3);
    
    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'benefit-1', userId: 'test-user-id' },
      data: { orderIndex: 0 },
    });
    
    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'benefit-2', userId: 'test-user-id' },
      data: { orderIndex: 1 },
    });
    
    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenNthCalledWith(3, {
      where: { id: 'benefit-3', userId: 'test-user-id' },
      data: { orderIndex: 2 },
    });

    // Verify revalidation was called
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');
  });

  it('should throw error when user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(updateBenefitOrderAction(['benefit-1'])).rejects.toThrow(
      'User not authenticated.'
    );

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

    await expect(updateBenefitOrderAction(['benefit-1'])).rejects.toThrow(
      'Failed to update benefit order.'
    );

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('should handle empty array gracefully', async () => {
    const mockSession: Session = {
      user: { id: 'test-user-id' },
      expires: '2024-12-31',
    };
    mockGetServerSession.mockResolvedValue(mockSession);

    await updateBenefitOrderAction([]);

    expect(mockPrisma.benefitStatus.updateMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');
  });
}); 