jest.mock('@/lib/effective-benefit', () => ({
  fetchEffectiveBenefitStatuses: jest.fn(),
}));

import {
  applyTrackingModesToPlannedRows,
  fetchTrackedBenefitStatuses,
  loadBenefitTrackingModes,
  loadBenefitTrackingModesByUser,
} from '@/lib/benefit-tracking-preferences';
import { fetchEffectiveBenefitStatuses } from '@/lib/effective-benefit';

const mockFetchStatuses = fetchEffectiveBenefitStatuses as jest.Mock;

function database(preferences: unknown[] = [], amounts: {
  predefined?: Array<{ id: string; maxAmount: number | null }>;
  custom?: Array<{ id: string; maxAmount: number | null }>;
} = {}) {
  return {
    benefitTrackingPreference: { findMany: jest.fn().mockResolvedValue(preferences) },
    predefinedBenefit: { findMany: jest.fn().mockResolvedValue(amounts.predefined ?? []) },
    benefit: { findMany: jest.fn().mockResolvedValue(amounts.custom ?? []) },
    $queryRaw: jest.fn(),
  } as never;
}

const standardPreference = (overrides = {}) => ({
  userId: 'user-1',
  creditCardId: 'card-1',
  predefinedBenefitId: 'pb-1',
  benefitId: null,
  mode: 'IGNORE',
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('loadBenefitTrackingModes', () => {
  it('queries only the owning user and only non-default rows', async () => {
    const db = database([standardPreference()]);
    const modes = await loadBenefitTrackingModes(db, 'user-1');

    expect(modes.get('standard:card-1:pb-1')).toBe('IGNORE');
    expect((db as never as { benefitTrackingPreference: { findMany: jest.Mock } })
      .benefitTrackingPreference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', mode: { not: 'TRACK' } } })
      );
  });

  it('returns an empty map for a user with no preferences', async () => {
    const modes = await loadBenefitTrackingModes(database([]), 'user-1');
    expect(modes.size).toBe(0);
  });
});

describe('loadBenefitTrackingModesByUser', () => {
  it('keeps each user preferences in their own map', async () => {
    const db = database([
      standardPreference({ userId: 'user-1', mode: 'IGNORE' }),
      standardPreference({ userId: 'user-2', mode: 'AUTO_CLAIM' }),
    ]);

    const byUser = await loadBenefitTrackingModesByUser(db, ['user-1', 'user-2']);

    expect(byUser.get('user-1')!.get('standard:card-1:pb-1')).toBe('IGNORE');
    expect(byUser.get('user-2')!.get('standard:card-1:pb-1')).toBe('AUTO_CLAIM');
  });

  it('does not query at all for an empty user list', async () => {
    const db = database([]);
    const byUser = await loadBenefitTrackingModesByUser(db, []);

    expect(byUser.size).toBe(0);
    expect((db as never as { benefitTrackingPreference: { findMany: jest.Mock } })
      .benefitTrackingPreference.findMany).not.toHaveBeenCalled();
  });
});

describe('fetchTrackedBenefitStatuses', () => {
  const status = (overrides = {}) => ({
    id: 'status-1',
    userId: 'user-1',
    benefitId: 'bridge-1',
    creditCardId: 'card-1',
    predefinedBenefitId: 'pb-1',
    ...overrides,
  });

  it('removes ignored benefits for a single-user read', async () => {
    mockFetchStatuses.mockResolvedValue([
      status({ id: 'ignored' }),
      status({ id: 'kept', predefinedBenefitId: 'pb-2' }),
    ]);

    const result = await fetchTrackedBenefitStatuses(
      database([standardPreference({ mode: 'IGNORE' })]),
      { userId: 'user-1' }
    );

    expect(result.map((row) => row.id)).toEqual(['kept']);
  });

  it('keeps auto-claimed benefits, which are silenced but still counted', async () => {
    mockFetchStatuses.mockResolvedValue([status({ id: 'auto' })]);

    const result = await fetchTrackedBenefitStatuses(
      database([standardPreference({ mode: 'AUTO_CLAIM' })]),
      { userId: 'user-1' }
    );

    expect(result.map((row) => row.id)).toEqual(['auto']);
  });

  it('resolves each row against its own owner on a multi-user read', async () => {
    // Same benefit on both users; only user-1 ignores it.
    mockFetchStatuses.mockResolvedValue([
      status({ id: 'user-1-row', userId: 'user-1' }),
      status({ id: 'user-2-row', userId: 'user-2' }),
    ]);

    const result = await fetchTrackedBenefitStatuses(
      database([standardPreference({ userId: 'user-1', mode: 'IGNORE' })]),
      { userIds: ['user-1', 'user-2'] }
    );

    expect(result.map((row) => row.id)).toEqual(['user-2-row']);
  });

  it('skips the preference query entirely when there are no statuses', async () => {
    mockFetchStatuses.mockResolvedValue([]);
    const db = database([standardPreference()]);

    await fetchTrackedBenefitStatuses(db, { userId: 'user-1' });

    expect((db as never as { benefitTrackingPreference: { findMany: jest.Mock } })
      .benefitTrackingPreference.findMany).not.toHaveBeenCalled();
  });
});

describe('applyTrackingModesToPlannedRows', () => {
  const plannedStandard = (overrides = {}) => ({
    userId: 'user-1',
    creditCardId: 'card-1',
    predefinedBenefitId: 'pb-1',
    benefitId: null,
    ...overrides,
  });

  it('opens an auto-claimed row at the benefit maximum', async () => {
    const db = database(
      [standardPreference({ mode: 'AUTO_CLAIM' })],
      { predefined: [{ id: 'pb-1', maxAmount: 15 }] }
    );

    const [row] = await applyTrackingModesToPlannedRows(db, [plannedStandard()]);

    expect(row).toEqual({ isCompleted: true, completedAt: expect.any(Date), usedAmount: 15 });
  });

  it('opens tracked and ignored rows unclaimed', async () => {
    const db = database([standardPreference({ mode: 'IGNORE' })]);

    const [ignored, tracked] = await applyTrackingModesToPlannedRows(db, [
      plannedStandard(),
      plannedStandard({ predefinedBenefitId: 'pb-2' }),
    ]);

    expect(ignored).toEqual({ isCompleted: false, completedAt: null, usedAmount: 0 });
    expect(tracked).toEqual({ isCompleted: false, completedAt: null, usedAmount: 0 });
  });

  it('applies one user auto-claim without touching another user identical benefit', async () => {
    const db = database(
      [standardPreference({ userId: 'user-1', mode: 'AUTO_CLAIM' })],
      { predefined: [{ id: 'pb-1', maxAmount: 15 }] }
    );

    const [first, second] = await applyTrackingModesToPlannedRows(db, [
      plannedStandard({ userId: 'user-1' }),
      plannedStandard({ userId: 'user-2' }),
    ]);

    expect(first.isCompleted).toBe(true);
    expect(second.isCompleted).toBe(false);
  });

  it('resolves a custom benefit maximum through benefitId', async () => {
    const db = database(
      [standardPreference({ creditCardId: null, predefinedBenefitId: null, benefitId: 'custom-1', mode: 'AUTO_CLAIM' })],
      { custom: [{ id: 'custom-1', maxAmount: 40 }] }
    );

    const [row] = await applyTrackingModesToPlannedRows(db, [
      plannedStandard({ creditCardId: null, predefinedBenefitId: null, benefitId: 'custom-1' }),
    ]);

    expect(row).toEqual({ isCompleted: true, completedAt: expect.any(Date), usedAmount: 40 });
  });

  it('claims zero when the auto-claimed benefit has no stored maximum', async () => {
    const db = database(
      [standardPreference({ mode: 'AUTO_CLAIM' })],
      { predefined: [{ id: 'pb-1', maxAmount: null }] }
    );

    const [row] = await applyTrackingModesToPlannedRows(db, [plannedStandard()]);

    expect(row).toEqual({ isCompleted: true, completedAt: expect.any(Date), usedAmount: 0 });
  });

  it('skips the amount lookup when nothing is auto-claimed', async () => {
    const db = database([standardPreference({ mode: 'IGNORE' })]);

    await applyTrackingModesToPlannedRows(db, [plannedStandard()]);

    expect((db as never as { predefinedBenefit: { findMany: jest.Mock } })
      .predefinedBenefit.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty result and issues no query for an empty batch', async () => {
    const db = database([standardPreference()]);

    expect(await applyTrackingModesToPlannedRows(db, [])).toEqual([]);
    expect((db as never as { benefitTrackingPreference: { findMany: jest.Mock } })
      .benefitTrackingPreference.findMany).not.toHaveBeenCalled();
  });

  it('preserves input order so callers can zip defaults back onto rows', async () => {
    const db = database(
      [standardPreference({ predefinedBenefitId: 'pb-2', mode: 'AUTO_CLAIM' })],
      { predefined: [{ id: 'pb-2', maxAmount: 5 }] }
    );

    const defaults = await applyTrackingModesToPlannedRows(db, [
      plannedStandard({ predefinedBenefitId: 'pb-1' }),
      plannedStandard({ predefinedBenefitId: 'pb-2' }),
      plannedStandard({ predefinedBenefitId: 'pb-3' }),
    ]);

    expect(defaults.map((row) => row.isCompleted)).toEqual([false, true, false]);
  });
});
