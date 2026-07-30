import { describe, it, expect, beforeEach } from '@jest/globals';
import type { Session } from 'next-auth';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/effective-benefit', () => ({
  findEffectiveBenefitStatus: jest.fn(),
}));

import { batchCompleteBenefitsByCategoryAction } from '../actions';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { revalidatePath } from 'next/cache';
import { findEffectiveBenefitStatus } from '@/lib/effective-benefit';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockBenefitStatusUpdateMany = prisma.benefitStatus.updateMany as jest.Mock;
const mockGetServerSession = jest.mocked(getServerSession);
const mockRevalidatePath = jest.mocked(revalidatePath);
const mockFindEffectiveBenefitStatus = findEffectiveBenefitStatus as jest.Mock;
const session: Session = { user: { id: 'test-user-id' }, expires: '2026-12-31' };

function status(id: string, category: string, maxAmount: number, usedAmount = 0) {
  return {
    id,
    userId: 'test-user-id',
    isCompleted: false,
    isNotUsable: false,
    completedAt: null,
    usedAmount,
    benefit: { category, maxAmount },
  };
}

describe('batchCompleteBenefitsByCategoryAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(session);
    mockBenefitStatusUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('uses authoritative global definitions and user-scoped writes', async () => {
    mockFindEffectiveBenefitStatus
      .mockResolvedValueOnce(status('status-1', 'Travel', 100) as never)
      .mockResolvedValueOnce(status('status-2', 'Travel', 50, 30) as never)
      .mockResolvedValueOnce(status('status-3', 'Dining', 75) as never);

    const result = await batchCompleteBenefitsByCategoryAction(
      'Travel',
      ['status-1', 'status-2', 'status-3']
    );

    expect(result).toEqual({ success: true, updatedCount: 2 });
    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.benefitStatus.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'status-1', userId: 'test-user-id' },
      data: {
        isCompleted: true,
        completedAt: expect.any(Date),
        usedAmount: 100,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');
  });

  it('performs no read or write without authentication', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(
      batchCompleteBenefitsByCategoryAction('Travel', ['status-1'])
    ).rejects.toThrow('User not authenticated.');

    expect(mockFindEffectiveBenefitStatus).not.toHaveBeenCalled();
    expect(mockPrisma.benefitStatus.updateMany).not.toHaveBeenCalled();
  });

  it('rejects missing category or status IDs before persistence', async () => {
    await expect(batchCompleteBenefitsByCategoryAction('', ['status-1']))
      .rejects.toThrow('Category and benefit status IDs are required.');
    await expect(batchCompleteBenefitsByCategoryAction('Travel', []))
      .rejects.toThrow('Category and benefit status IDs are required.');
    expect(mockFindEffectiveBenefitStatus).not.toHaveBeenCalled();
  });

  it('does not update statuses absent for the authenticated owner', async () => {
    mockFindEffectiveBenefitStatus.mockResolvedValue(null);

    const result = await batchCompleteBenefitsByCategoryAction('Travel', ['other-status']);

    expect(result).toEqual({ success: true, updatedCount: 0 });
    expect(mockPrisma.benefitStatus.updateMany).not.toHaveBeenCalled();
  });

  it('does not revalidate when persistence fails', async () => {
    mockFindEffectiveBenefitStatus.mockResolvedValue(status('status-1', 'Travel', 100) as never);
    mockBenefitStatusUpdateMany.mockRejectedValue(new Error('Database error'));

    await expect(batchCompleteBenefitsByCategoryAction('Travel', ['status-1']))
      .rejects.toThrow('Failed to batch complete benefits.');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
