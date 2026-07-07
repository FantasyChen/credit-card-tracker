import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  return request.headers.get('x-real-ip');
}

function parseNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const query = typeof body.query === 'string' ? body.query.trim().toLowerCase().slice(0, 200) : '';
    const resultCount = parseNonNegativeInteger(body.resultCount);
    const searchTime = parseNonNegativeInteger(body.searchTime);

    if (!query || resultCount === null || searchTime === null) {
      return NextResponse.json(
        { error: 'Invalid analytics data' },
        { status: 400 }
      );
    }

    await prisma.searchAnalytics.create({
      data: {
        query,
        resultCount,
        searchTime,
        userId: session.user.id,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Search analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to track analytics' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [totalSearches, searchesWithResults, averageSearchTime, popularQueries, recentSearches] = await Promise.all([
      prisma.searchAnalytics.count(),
      prisma.searchAnalytics.count({ where: { resultCount: { gt: 0 } } }),
      prisma.searchAnalytics.aggregate({ _avg: { searchTime: true } }),
      prisma.searchAnalytics.groupBy({
        by: ['query'],
        _count: { query: true },
        orderBy: { _count: { query: 'desc' } },
        take: 10,
      }),
      prisma.searchAnalytics.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          query: true,
          resultCount: true,
          searchTime: true,
          userId: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      totalSearches,
      averageSearchTime: averageSearchTime._avg.searchTime ?? 0,
      popularQueries: popularQueries.map((row) => ({
        query: row.query,
        count: row._count.query,
      })),
      searchSuccessRate: totalSearches === 0 ? 0 : searchesWithResults / totalSearches,
      recentSearches,
    });
  } catch (error) {
    console.error('Search analytics GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
