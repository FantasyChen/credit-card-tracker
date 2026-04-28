/**
 * Notification settings server action tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { updateNotificationSettingsAction } from '../actions';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetServerSession = jest.mocked(getServerSession);

describe('updateNotificationSettingsAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2026-12-31' });
  });

  it('locks free users to the default benefit expiration reminder window', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      subscriptionTier: 'FREE',
      isBetaUser: false,
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const formData = new FormData();
    formData.append('notifyBenefitExpiration', 'on');
    formData.append('notifyExpirationDays', '30');
    formData.append('pointsExpirationDays', '45');

    await updateNotificationSettingsAction(formData);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        notifyExpirationDays: 7,
        pointsExpirationDays: 45,
      }),
    }));
  });
});
