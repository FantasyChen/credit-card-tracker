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

/**
 * Every status mutation must address the benefit identity inside the currently
 * open cycle — never a bare row id. This shape is the regression guard for
 * closed-cycle immutability and for multi-occurrence coverage.
 */
const OPEN_CYCLE_STANDARD_WHERE = {
  userId: 'user-1',
  creditCardId: 'card-1',
  predefinedBenefitId: 'pb-1',
  cycleStartDate: { lte: expect.any(Date) },
  cycleEndDate: { gte: expect.any(Date) },
};

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
    // Every open-cycle occurrence is claimed at the benefit maximum, stamped as
    // a feature-made claim, and isNotUsable is cleared atomically. Closed and
    // future cycles are excluded by the window; siblings are included because
    // the where keys on benefit identity rather than the clicked row id.
    expect(statusUpdateMany).toHaveBeenCalledWith({
      where: { ...OPEN_CYCLE_STANDARD_WHERE, isCompleted: false },
      data: {
        isCompleted: true,
        completedAt: expect.any(Date),
        usedAmount: 15,
        claimSource: 'AUTO',
        isNotUsable: false,
      },
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
    expect(preference.delete).not.toHaveBeenCalled();
  });

  it('deletes the stored row when returning to TRACK, preserving absence-means-default', async () => {
    preference.findFirst.mockResolvedValue({ id: 'pref-1', mode: 'IGNORE' });
    mockFindStatus.mockResolvedValue(standardStatus());

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'TRACK' })
    );

    expect(preference.delete).toHaveBeenCalledWith({ where: { id: 'pref-1' } });
    expect(preference.update).not.toHaveBeenCalled();
  });

  it('reopens a cycle this feature auto-claimed when leaving AUTO_CLAIM', async () => {
    preference.findFirst.mockResolvedValue({ id: 'pref-1', mode: 'AUTO_CLAIM' });
    mockFindStatus.mockResolvedValue(standardStatus({ isCompleted: true }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'TRACK' })
    );

    // Only feature-made claims reopen: the claimSource filter is what protects
    // rows the user claimed or edited, and the window is what protects history.
    expect(statusUpdateMany).toHaveBeenCalledWith({
      where: { ...OPEN_CYCLE_STANDARD_WHERE, isCompleted: true, claimSource: 'AUTO' },
      data: { isCompleted: false, completedAt: null, usedAmount: 0, claimSource: null },
    });
  });

  it('leaves a cycle the user claimed themselves untouched', async () => {
    // With no stored preference there is nothing to reopen: the previous mode
    // was TRACK, so switching to IGNORE writes no status change at all.
    preference.findFirst.mockResolvedValue(null);
    mockFindStatus.mockResolvedValue(standardStatus({ isCompleted: true }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'IGNORE' })
    );

    expect(statusUpdateMany).not.toHaveBeenCalled();
  });

  it('never reopens a manually edited claim when leaving AUTO_CLAIM', async () => {
    // Regression for the auto-claim → manual edit → back-to-TRACK sequence:
    // the reopen query must carry claimSource AUTO, so a row the user edited
    // (stamped USER by every manual action) can never match it.
    preference.findFirst.mockResolvedValue({ id: 'pref-1', mode: 'AUTO_CLAIM' });
    mockFindStatus.mockResolvedValue(standardStatus({ isCompleted: true }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'TRACK' })
    );

    const reopenCall = statusUpdateMany.mock.calls.find(
      ([args]: [{ data: { isCompleted: boolean } }]) => args.data.isCompleted === false
    );
    expect(reopenCall[0].where.claimSource).toBe('AUTO');
  });

  it('confines every status mutation to the currently open cycle', async () => {
    // Regression for closed-cycle immutability: no update may address a bare
    // row id, and each must carry the open-cycle window bounds.
    preference.findFirst.mockResolvedValue({ id: 'pref-1', mode: 'AUTO_CLAIM' });
    mockFindStatus.mockResolvedValue(standardStatus({ isCompleted: true }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'IGNORE' })
    );

    for (const [args] of statusUpdateMany.mock.calls) {
      expect(args.where.id).toBeUndefined();
      expect(args.where.cycleStartDate).toEqual({ lte: expect.any(Date) });
      expect(args.where.cycleEndDate).toEqual({ gte: expect.any(Date) });
    }
  });

  it('clears isNotUsable atomically when auto-claiming', async () => {
    // Regression: a row must never sit in both the claimed and not-usable
    // accounting paths at once.
    mockFindStatus.mockResolvedValue(standardStatus({ isNotUsable: true }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'AUTO_CLAIM' })
    );

    const [args] = statusUpdateMany.mock.calls[0];
    expect(args.data.isNotUsable).toBe(false);
    expect(args.data.isCompleted).toBe(true);
  });

  it('adopts IGNORE for a legacy not-usable row and clears the flag', async () => {
    mockFindStatus.mockResolvedValue(standardStatus({ isNotUsable: true }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'IGNORE' })
    );

    expect(preference.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        creditCardId: 'card-1',
        predefinedBenefitId: 'pb-1',
        benefitId: null,
        mode: 'IGNORE',
      },
    });
    expect(statusUpdateMany).toHaveBeenCalledWith({
      where: { ...OPEN_CYCLE_STANDARD_WHERE, isNotUsable: true },
      data: { isNotUsable: false },
    });
  });

  it('clears the legacy flag when restoring TRACK on an open row', async () => {
    mockFindStatus.mockResolvedValue(standardStatus({ isNotUsable: true }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'TRACK' })
    );

    expect(preference.create).not.toHaveBeenCalled();
    expect(statusUpdateMany).toHaveBeenCalledWith({
      where: { ...OPEN_CYCLE_STANDARD_WHERE, isNotUsable: true },
      data: { isNotUsable: false },
    });
  });

  it('claims zero rather than inventing value when the benefit has no maximum', async () => {
    mockFindStatus.mockResolvedValue(standardStatus({ benefit: { maxAmount: null, category: 'Travel' } }));

    await setBenefitTrackingModeAction(
      form({ benefitStatusId: 'status-1', trackingMode: 'AUTO_CLAIM' })
    );

    expect(statusUpdateMany).toHaveBeenCalledWith({
      where: { ...OPEN_CYCLE_STANDARD_WHERE, isCompleted: false },
      data: {
        isCompleted: true,
        completedAt: expect.any(Date),
        usedAmount: 0,
        claimSource: 'AUTO',
        isNotUsable: false,
      },
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
        claimSource: 'AUTO',
        creditCardId: 'card-1',
        predefinedBenefitId: 'pb-1',
      }),
      data: { isCompleted: false, completedAt: null, usedAmount: 0, claimSource: null },
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
