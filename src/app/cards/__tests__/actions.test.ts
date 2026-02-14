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
    mockPrisma.creditCard.delete.mockResolvedValue({} as any);

    const formData = new FormData();
    formData.append('cardId', 'clxx1234567890123456789012');

    const result = await deleteCardAction(formData);

    expect(result).toEqual({ success: true });
    expect(mockPrisma.creditCard.delete).toHaveBeenCalledWith({
      where: { id: 'clxx1234567890123456789012' },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/cards');
  });

  it('returns error when delete throws', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2025-12-31' });
    mockPrisma.creditCard.findUnique.mockResolvedValue({
      id: 'clxx1234567890123456789012',
      userId: 'user-1',
    } as any);
    mockPrisma.creditCard.delete.mockRejectedValue(new Error('DB error'));

    const formData = new FormData();
    formData.append('cardId', 'clxx1234567890123456789012');

    const result = await deleteCardAction(formData);

    expect(result).toEqual({ success: false, error: 'Failed to delete card.' });
  });
});
