/**
 * GET /api/user-cards route tests
 */

import { GET } from '../route';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status ?? 200,
    })),
  },
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    creditCard: {
      findMany: jest.fn(),
    },
    predefinedCard: {
      findMany: jest.fn(),
    },
  },
}));

const mockGetServerSession = jest.mocked(getServerSession);
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GET /api/user-cards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(mockPrisma.creditCard.findMany).not.toHaveBeenCalled();
  });

  it('returns 200 and user cards when authenticated', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockPrisma.creditCard.findMany.mockResolvedValue([
      {
        id: 'card-1',
        name: 'Test Card',
        issuer: 'Test',
        userId: 'user-1',
        benefits: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockPrisma.predefinedCard.findMany.mockResolvedValue([
      { name: 'Test Card', issuer: 'Test', imageUrl: 'https://example.com/img.png' },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: 'card-1',
      name: 'Test Card',
      userId: 'user-1',
      imageUrl: 'https://example.com/img.png',
    });
    expect(mockPrisma.creditCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        include: { benefits: true },
      })
    );
  });

  it('returns 200 and empty array when user has no cards', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockPrisma.creditCard.findMany.mockResolvedValue([]);
    mockPrisma.predefinedCard.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('returns 500 when database throws', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockPrisma.creditCard.findMany.mockRejectedValue(new Error('DB error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to fetch user cards' });
  });
});
