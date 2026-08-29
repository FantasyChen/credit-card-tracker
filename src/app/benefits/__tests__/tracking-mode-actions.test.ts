import type { Session } from 'next-auth';

// Prisma is mocked globally in jest.setup.ts.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/effective-benefit', () => ({
  findEffectiveBenefitStatus: jest.fn(),
  fetchEffectiveBenefitStatuses: jest.fn(),
}));

import {
  setBenefitTrackingModeAction,
  resetBenefitTrackingPreferenceAction,
} from '../actions';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { findEffectiveBenefitStatus } from '@/lib/effective-benefit';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetServerSession = jest.mocked(getServerSession);
const mockFindStatus = findEffectiveBenefitStatus as jest.Mock;
const preference = mockPrisma.benefitTrackingPreference as unknown as {
  findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock;
};
const statusUpdateMany = mockPrisma.benefitStatus.updateMany as unknown as jest.Mock;

const SESSION: Session = { user: { id: 'user-1' }, expires: '2030-01-01' };

function standardStatus(overrides: Record<string, unknown> = {}) {
  return {
    id: 'status-1',
    userId: 'user-1',
    benefitId: 'bridge-benefit-1',
    creditCardId: 'card-1',
    predefinedBenefitId: 'pb-1',
    isCompleted: false,
    benefit: { maxAmount: 15, category: 'Travel' },
    ...overrides,
  };
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetServerSession.mockResolvedValue(SESSION);
  preference.findFirst.mockResolvedValue(null);
  statusUpdateMany.mockResolvedValue({ count: 1 });
});

describe('setBenefitTrackingModeAction', () => {
  it('creates a preference and claims the open cycle when switching to AUTO_CLAIM', async () => {
    mockFindStatus.mockResolvedValue(standardStatus());

    const result = await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'AUTO_CLAIM' })
    );

    expect(result).toEqual({ success: true, mode: 'AUTO_CLAIM' });
    expect(preference.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        creditCardId: 'card-1',
        predefinedBenefitId: 'pb-1',
        benefitId: null,
        mode: 'AUTO_CLAIM',
      },
    });
    // The open cycle is claimed at the benefit maximum, not left for next cycle.
    expect(statusUpdateMany).toHaveBeenCalledWith({
      where: { id: 'status-1', userId: 'user-1' },
      data: { isCompleted: true, completedAt: expect.any(Date), usedAmount: 15 },
    });
  });

  it('addresses a custom benefit by benefitId rather than the card pair', async () => {
    mockFindStatus.mockResolvedValue(
      standardStatus({ predefinedBenefitId: null, creditCardId: null, benefitId: 'custom-1' })
    );

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'IGNORE' })
    );

    expect(preference.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        creditCardId: null,
        predefinedBenefitId: null,
        benefitId: 'custom-1',
        mode: 'IGNORE',
      },
    });
  });

  it('does not claim the open cycle when switching to IGNORE', async () => {
    mockFindStatus.mockResolvedValue(standardStatus());

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'IGNORE' })
    );

    expect(statusUpdateMany).not.toHaveBeenCalled();
  });

  it('updates an existing preference instead of creating a second row', async () => {
    preference.findFirst.mockResolvedValue({ id: 'pref-1', mode: 'IGNORE' });
    mockFindStatus.mockResolvedValue(standardStatus());

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'AUTO_CLAIM' })
    );

    expect(preference.update).toHaveBeenCalledWith({
      where: { id: 'pref-1' },
      data: { mode: 'AUTO_CLAIM' },
    });
    expect(preference.create).not.toHaveBeenCalled();
  });

  it('stores no row when returning to the TRACK default from no preference', async () => {
    mockFindStatus.mockResolvedValue(standardStatus());

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'TRACK' })
    );

    expect(preference.create).not.toHaveBeenCalled();
    expect(preference.update).not.toHaveBeenCalled();
  });

  it('reopens a cycle this feature auto-claimed when leaving AUTO_CLAIM', async () => {
    preference.findFirst.mockResolvedValue({ id: 'pref-1', mode: 'AUTO_CLAIM' });
    mockFindStatus.mockResolvedValue(standardStatus({ isCompleted: true }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'TRACK' })
    );

    expect(statusUpdateMany).toHaveBeenCalledWith({
      where: { id: 'status-1', userId: 'user-1' },
      data: { isCompleted: false, completedAt: null, usedAmount: 0 },
    });
  });

  it('leaves a cycle the user claimed themselves untouched', async () => {
    // No stored preference means the completion was the user's own action.
    preference.findFirst.mockResolvedValue(null);
    mockFindStatus.mockResolvedValue(standardStatus({ isCompleted: true }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'IGNORE' })
    );

    expect(statusUpdateMany).not.toHaveBeenCalled();
  });

  it('claims zero rather than inventing value when the benefit has no maximum', async () => {
    mockFindStatus.mockResolvedValue(standardStatus({ benefit: { maxAmount: null, category: 'Travel' } }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'AUTO_CLAIM' })
    );

    expect(statusUpdateMany).toHaveBeenCalledWith({
      where: { id: 'status-1', userId: 'user-1' },
      data: { isCompleted: true, completedAt: expect.any(Date), usedAmount: 0 },
    });
  });

  it('refuses an unauthenticated caller before reading anything', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(
      setBenefitTrackingModeAction(form({ benefitStatusId: 'status-1', trackingMode: 'IGNORE' }))
    ).rejects.toThrow('User not authenticated.');
    expect(mockFindStatus).not.toHaveBeenCalled();
  });

  it('refuses a status the session user does not own', async () => {
    // The effective reader is scoped by userId, so a foreign id resolves to null.
    mockFindStatus.mockResolvedValue(null);

    await expect(
      setBenefitTrackingModeAction(form({ benefitStatusId: 'someone-elses', trackingMode: 'IGNORE' }))
    ).rejects.toThrow('Benefit status not found or permission denied.');
    expect(preference.create).not.toHaveBeenCalled();
    expect(statusUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects a mode value that is not one of the three supported modes', async () => {
    await expect(
      setBenefitTrackingModeAction(form({ benefitStatusId: 'status-1', trackingMode: 'DROP_TABLE' }))
    ).rejects.toThrow('Unknown benefit tracking mode.');
    expect(mockFindStatus).not.toHaveBeenCalled();
  });

  it('rejects a missing benefit status id', async () => {
    await expect(
      setBenefitTrackingModeAction(form({ trackingMode: 'IGNORE' }))
    ).rejects.toThrow('Benefit Status ID is missing.');
  });
});

describe('resetBenefitTrackingPreferenceAction', () => {
  it('deletes the preference and reopens the auto-claimed open cycle', async () => {
    preference.findFirst.mockResolvedValue({
      id: 'pref-1',
      mode: 'AUTO_CLAIM',
      creditCardId: 'card-1',
      predefinedBenefitId: 'pb-1',
      benefitId: null,
    });

    const result = await resetBenefitTrackingPreferenceAction(form({ preferenceId: 'pref-1' }));

    expect(result).toEqual({ success: true });
    expect(statusUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: 'user-1',
        isCompleted: true,
        creditCardId: 'card-1',
        predefinedBenefitId: 'pb-1',
      }),
      data: { isCompleted: false, completedAt: null, usedAmount: 0 },
    });
    expect(preference.delete).toHaveBeenCalledWith({ where: { id: 'pref-1' } });
  });

  it('deletes an IGNORE preference without touching any status row', async () => {
    preference.findFirst.mockResolvedValue({
      id: 'pref-2',
      mode: 'IGNORE',
      creditCardId: null,
      predefinedBenefitId: null,
      benefitId: 'custom-1',
    });

    await resetBenefitTrackingPreferenceAction(form({ preferenceId: 'pref-2' }));

    expect(statusUpdateMany).not.toHaveBeenCalled();
    expect(preference.delete).toHaveBeenCalledWith({ where: { id: 'pref-2' } });
  });

  it('scopes the lookup to the session user so a foreign preference is not deletable', async () => {
    preference.findFirst.mockResolvedValue(null);

    await expect(
      resetBenefitTrackingPreferenceAction(form({ preferenceId: 'someone-elses' }))
    ).rejects.toThrow('Failed to reset benefit tracking preference.');

    expect(preference.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'someone-elses', userId: 'user-1' } })
    );
    expect(preference.delete).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated caller', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(
      resetBenefitTrackingPreferenceAction(form({ preferenceId: 'pref-1' }))
    ).rejects.toThrow('User not authenticated.');
    expect(preference.delete).not.toHaveBeenCalled();
  });

  it('rejects a missing preference id', async () => {
    await expect(
      resetBenefitTrackingPreferenceAction(form({}))
    ).rejects.toThrow('Preference ID is missing.');
  });
});
