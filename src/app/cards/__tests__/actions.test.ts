/**
 * Cards server actions tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { deleteCardAction } from '../actions';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { revalidatePath } from 'next/cache';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetServerSession = jest.mocked(getServerSession);
const mockRevalidatePath = jest.mocked(revalidatePath);

describe('deleteCardAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns error when user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const formData = new FormData();
    formData.append('cardId', 'clxx1234567890123456789012');

    const result = await deleteCardAction(formData);

    expect(result).toEqual({ success: false, error: 'Authentication required.' });
    expect(mockPrisma.creditCard.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.creditCard.delete).not.toHaveBeenCalled();
  });

  it('returns error for invalid card ID', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2025-12-31' });

    const formData = new FormData();
    formData.append('cardId', 'invalid');

    const result = await deleteCardAction(formData);

    expect(result).toEqual({ success: false, error: 'Invalid card ID.' });
    expect(mockPrisma.creditCard.findUnique).not.toHaveBeenCalled();
  });

  it('returns error when card not found or not owned by user', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2025-12-31' });
    mockPrisma.creditCard.findUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.append('cardId', 'clxx1234567890123456789012');

    const result = await deleteCardAction(formData);

    expect(result).toEqual({
      success: false,
      error: 'Card not found or you do not have permission to delete it.',
    });
    expect(mockPrisma.creditCard.delete).not.toHaveBeenCalled();
  });

  it('deletes card and revalidates when user owns the card', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2025-12-31' });
    mockPrisma.creditCard.findUnique.mockResolvedValue({
      id: 'clxx1234567890123456789012',
      userId: 'user-1',
      name: 'Test Card',
      issuer: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockPrisma.benefitStatus.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.creditCard.deleteMany.mockResolvedValue({ count: 1 });

    const formData = new FormData();
    formData.append('cardId', 'clxx1234567890123456789012');

    const result = await deleteCardAction(formData);

    expect(result).toEqual({ success: true });
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    const ledgerSql = (mockPrisma.$executeRaw as jest.Mock).mock.calls[0][0] as {
      strings: readonly string[];
      values: unknown[];
    };
    expect(ledgerSql.strings.join('')).toContain('SET "creditCardId" = NULL');
    expect(ledgerSql.values).toEqual([
      'clxx1234567890123456789012',
      'user-1',
    ]);
    expect(mockPrisma.benefitStatus.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        OR: [
          { creditCardId: 'clxx1234567890123456789012' },
          { benefit: { creditCardId: 'clxx1234567890123456789012' } },
        ],
      },
    });
    expect(mockPrisma.creditCard.deleteMany).toHaveBeenCalledWith({
      where: { id: 'clxx1234567890123456789012', userId: 'user-1' },
    });
    expect(mockRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/',
      '/cards',
      '/cards/calendar',
      '/benefits',
    ]);
  });

  it('blocks card deletion before writes when active category-repair evidence exists', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2025-12-31' });
    mockPrisma.creditCard.findUnique.mockResolvedValue({
      id: 'clxx1234567890123456789012',
      userId: 'user-1',
    } as any);
    (mockPrisma.$queryRaw as unknown as { mockResolvedValueOnce(value: unknown): void })
      .mockResolvedValueOnce([{ exists: true }]);

    const formData = new FormData();
    formData.append('cardId', 'clxx1234567890123456789012');

    await expect(deleteCardAction(formData)).resolves.toEqual({
      success: false,
      error: 'Failed to delete card.',
    });
    const repairGuardSql = (mockPrisma.$queryRaw as jest.Mock).mock.calls[0][0] as {
      strings: readonly string[];
      values: unknown[];
    };
    expect(repairGuardSql.strings.join('')).not.toContain('repair."userId"');
    expect(repairGuardSql.values).toEqual(['clxx1234567890123456789012']);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    expect(mockPrisma.benefitStatus.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.creditCard.deleteMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns error when delete throws', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2025-12-31' });
    mockPrisma.creditCard.findUnique.mockResolvedValue({
      id: 'clxx1234567890123456789012',
      userId: 'user-1',
    } as any);
    mockPrisma.benefitStatus.deleteMany.mockRejectedValue(new Error('DB error'));

    const formData = new FormData();
    formData.append('cardId', 'clxx1234567890123456789012');

    const result = await deleteCardAction(formData);

    expect(result).toEqual({ success: false, error: 'Failed to delete card.' });
  });
});
