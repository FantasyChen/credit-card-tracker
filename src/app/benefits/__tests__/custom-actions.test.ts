import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  deleteCustomBenefitAction,
  updateCustomBenefitAction,
} from '../actions';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockGetServerSession = jest.mocked(getServerSession);
const mockRevalidatePath = jest.mocked(revalidatePath);
const mockExecuteRaw = prisma.$executeRaw as jest.Mock;
const session: Session = { user: { id: 'user-1' }, expires: '2026-12-31' };
const benefitId = 'clxx1234567890123456789012';

function updateForm(overrides: Record<string, string> = {}) {
  const values = {
    benefitId,
    description: 'My updated travel credit',
    category: 'Travel',
    maxAmount: '125',
    frequency: 'MONTHLY',
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

function deleteForm(id = benefitId) {
  const formData = new FormData();
  formData.set('benefitId', id);
  return formData;
}

function executedSql(): string {
  const query = mockExecuteRaw.mock.calls[0][0] as { strings: readonly string[] };
  return query.strings.join('');
}

describe('custom benefit definition actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(session);
    mockExecuteRaw.mockResolvedValue(1);
  });

  it('rejects unauthenticated updates before validation or persistence', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(updateCustomBenefitAction(updateForm())).rejects.toThrow(
      'User not authenticated.'
    );
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('rejects malformed update input before persistence', async () => {
    await expect(
      updateCustomBenefitAction(updateForm({ maxAmount: '', frequency: 'INVALID' }))
    ).rejects.toThrow('Invalid custom benefit input.');

    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('updates only an owned definition with no standard classification or bridge', async () => {
    await expect(updateCustomBenefitAction(updateForm())).resolves.toEqual({ success: true });

    const sql = executedSql();
    expect(sql).toContain('b."userId" =');
    expect(sql).toContain('owner_card."userId" =');
    expect(sql).toContain('custom_ledger."classification" = \'CUSTOM\'');
    expect(sql).toContain('bs."predefinedBenefitId" IS NOT NULL');
    expect(sql).toContain('ledger."classification" = \'STANDARD\'');
    expect(sql).toContain('FROM "GlobalBenefitCategoryRepair" repair');
    expect(sql).toContain('repair."phase" = \'APPLIED\'');
    expect(sql).toContain('"updatedAt" = NOW()');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits/custom');
  });

  it('does not report success or revalidate when the capability-scoped update matches no row', async () => {
    mockExecuteRaw.mockResolvedValue(0);

    await expect(updateCustomBenefitAction(updateForm())).rejects.toThrow(
      'Failed to update custom benefit.'
    );
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('deletes only an owned definition with no standard classification or bridge', async () => {
    await expect(deleteCustomBenefitAction(deleteForm())).resolves.toEqual({ success: true });

    const sql = executedSql();
    expect(sql).toContain('DELETE FROM "Benefit" AS b');
    expect(sql).toContain('b."userId" =');
    expect(sql).toContain('owner_card."userId" =');
    expect(sql).toContain('custom_ledger."classification" = \'CUSTOM\'');
    expect(sql).toContain('bs."predefinedBenefitId" IS NOT NULL');
    expect(sql).toContain('ledger."classification" = \'STANDARD\'');
    expect(sql).toContain('FROM "GlobalBenefitCategoryRepair" repair');
    expect(sql).toContain('repair."phase" = \'APPLIED\'');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/benefits/custom');
  });

  it('rejects an invalid delete ID before persistence', async () => {
    await expect(deleteCustomBenefitAction(deleteForm('not-a-cuid'))).rejects.toThrow(
      'Invalid custom benefit ID.'
    );
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('does not report success or revalidate when persistence fails', async () => {
    mockExecuteRaw.mockRejectedValue(new Error('Database error'));

    await expect(deleteCustomBenefitAction(deleteForm())).rejects.toThrow(
      'Failed to delete custom benefit.'
    );
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
