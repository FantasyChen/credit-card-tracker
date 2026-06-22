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

  it('saves custom benefit expiration reminder windows for every user', async () => {
    mockPrisma.user.update.mockResolvedValue({} as any);

    const formData = new FormData();
    formData.append('notifyBenefitExpiration', 'on');
    formData.append('notifyExpirationDays', '30');
    formData.append('pointsExpirationDays', '45');

    await updateNotificationSettingsAction(formData);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        notifyExpirationDays: 30,
        pointsExpirationDays: 45,
      }),
    }));
  });
});
