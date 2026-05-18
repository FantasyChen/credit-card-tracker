/**
 * Loyalty account server action tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { addLoyaltyAccountAction, updateLoyaltyAccountAction } from '../actions';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetServerSession = jest.mocked(getServerSession);

function baseFormData() {
  const formData = new FormData();
  formData.append('loyaltyProgramId', 'program-1');
  formData.append('accountNumber', 'ABC123');
  formData.append('lastActivityDate', '2026-01-15');
  formData.append('notes', 'Primary account');
  return formData;
}

describe('loyalty account actions', () => {
  let tx: {
    loyaltyAccount: {
      create: jest.Mock;
      update: jest.Mock;
    };
    loyaltyCertificate: {
      createMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2026-12-31' });

    tx = {
      loyaltyAccount: {
        create: jest.fn(async () => ({ id: 'account-1' })),
        update: jest.fn(async () => ({ id: 'account-1' })),
      },
      loyaltyCertificate: {
        createMany: jest.fn(async () => ({ count: 1 })),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));
  });

  it('adds a hotel loyalty account with balance and certificates', async () => {
    mockPrisma.loyaltyProgram.findUnique.mockResolvedValue({
      id: 'program-1',
      expirationMonths: 24,
      hasExpiration: true,
      type: 'HOTEL',
    } as any);

    const formData = baseFormData();
    formData.append('pointsBalance', '125000');
    formData.append('certificates', JSON.stringify([
      {
        label: 'Anniversary free night',
        quantity: '2',
        expirationDate: '2026-07-01',
        notes: 'Use at category 1-4',
      },
    ]));

    await addLoyaltyAccountAction(formData);

    expect(tx.loyaltyAccount.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        loyaltyProgramId: 'program-1',
        pointsBalance: 125000,
        lastActivityDate: new Date('2026-01-15T00:00:00.000Z'),
        expirationDate: new Date('2028-01-15T00:00:00.000Z'),
      }),
    }));
    expect(tx.loyaltyCertificate.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'user-1',
          loyaltyAccountId: 'account-1',
          label: 'Anniversary free night',
          quantity: 2,
          expirationDate: new Date('2026-07-01T00:00:00.000Z'),
          notes: 'Use at category 1-4',
        }),
      ],
    });
  });

  it('rejects invalid points balances before writing', async () => {
    const formData = baseFormData();
    formData.append('pointsBalance', '-1');

    await expect(addLoyaltyAccountAction(formData)).rejects.toThrow('Points/miles balance');
    expect(mockPrisma.loyaltyProgram.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates a hotel account and replaces certificates', async () => {
    mockPrisma.loyaltyAccount.findUnique.mockResolvedValue({
      id: 'account-1',
      userId: 'user-1',
      loyaltyProgram: {
        expirationMonths: 12,
        hasExpiration: true,
        type: 'HOTEL',
      },
    } as any);

    const formData = new FormData();
    formData.append('accountId', 'account-1');
    formData.append('accountNumber', 'ABC123');
    formData.append('pointsBalance', '50000');
    formData.append('lastActivityDate', '2026-02-01');
    formData.append('certificates', JSON.stringify([
      {
        label: 'Updated free night',
        quantity: '1',
        expirationDate: '2026-08-15',
        notes: '',
      },
    ]));

    await updateLoyaltyAccountAction(formData);

    expect(tx.loyaltyAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'account-1' },
      data: expect.objectContaining({
        pointsBalance: 50000,
        lastActivityDate: new Date('2026-02-01T00:00:00.000Z'),
        expirationDate: new Date('2027-02-01T00:00:00.000Z'),
      }),
    }));
    expect(tx.loyaltyCertificate.deleteMany).toHaveBeenCalledWith({
      where: {
        loyaltyAccountId: 'account-1',
        userId: 'user-1',
      },
    });
    expect(tx.loyaltyCertificate.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          label: 'Updated free night',
          quantity: 1,
          expirationDate: new Date('2026-08-15T00:00:00.000Z'),
        }),
      ],
    });
  });

  it('deletes certificates when the submitted hotel certificate list is empty', async () => {
    mockPrisma.loyaltyAccount.findUnique.mockResolvedValue({
      id: 'account-1',
      userId: 'user-1',
      loyaltyProgram: {
        expirationMonths: 12,
        hasExpiration: true,
        type: 'HOTEL',
      },
    } as any);

    const formData = new FormData();
    formData.append('accountId', 'account-1');
    formData.append('lastActivityDate', '2026-02-01');
    formData.append('certificates', JSON.stringify([]));

    await updateLoyaltyAccountAction(formData);

    expect(tx.loyaltyCertificate.deleteMany).toHaveBeenCalledWith({
      where: {
        loyaltyAccountId: 'account-1',
        userId: 'user-1',
      },
    });
    expect(tx.loyaltyCertificate.createMany).not.toHaveBeenCalled();
  });

  it('rejects updates for another user account', async () => {
    mockPrisma.loyaltyAccount.findUnique.mockResolvedValue({
      id: 'account-1',
      userId: 'other-user',
      loyaltyProgram: {
        expirationMonths: 12,
        hasExpiration: true,
        type: 'HOTEL',
      },
    } as any);

    const formData = new FormData();
    formData.append('accountId', 'account-1');
    formData.append('lastActivityDate', '2026-02-01');

    await expect(updateLoyaltyAccountAction(formData)).rejects.toThrow('Failed to update loyalty account.');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
