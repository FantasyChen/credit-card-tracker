import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    const type = url.searchParams.get('type');
    const hideExported = url.searchParams.get('hideExported') === 'true';
    const aggregate = url.searchParams.get('aggregate');
    const limitParam = url.searchParams.get('limit');

    let take = 50;
    if (limitParam) {
      const parsed = Number(limitParam);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 200) {
        return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
      }
      take = parsed;
    }

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (hideExported) where.exportedAt = null;

    if (aggregate === 'count') {
      const count = await prisma.catalogSuggestion.count({ where });
      return NextResponse.json({ count });
    }

    const suggestions = await prisma.catalogSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, payloadJson, sources } = body as { type: string; payloadJson: unknown; sources?: string[] };

    if (!type || !payloadJson) {
      return NextResponse.json({ error: 'type and payloadJson are required' }, { status: 400 });
    }

    const allowedTypes = new Set([
      'ADD_CARD',
      'EDIT_CARD',
      'ADD_BENEFIT',
      'EDIT_BENEFIT',
      'DEPRECATE_CARD',
      'DEPRECATE_BENEFIT',
      'IMAGE_UPDATE',
    ]);
    if (!allowedTypes.has(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Basic payload size limit (~100KB)
    try {
      const size = JSON.stringify(payloadJson).length;
      if (size > 100_000) {
        return NextResponse.json({ error: 'payloadJson too large' }, { status: 413 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid payloadJson' }, { status: 400 });
    }

    let sourceList: string[] = [];
    if (sources && Array.isArray(sources)) {
      if (sources.length > 10) {
        return NextResponse.json({ error: 'Too many sources (max 10)' }, { status: 400 });
      }
      // Validate URLs and normalize
      const unique = new Set<string>();
      for (const s of sources) {
        const trimmed = String(s).trim();
        if (!trimmed) continue;
        try {
          // Throws if invalid
          const u = new URL(trimmed);
          unique.add(u.toString());
        } catch {
          return NextResponse.json({ error: `Invalid source URL: ${trimmed}` }, { status: 400 });
        }
      }
      sourceList = Array.from(unique);
    }

    const created = await prisma.catalogSuggestion.create({
      data: {
        type: type as any,
        payloadJson,
        sources: sourceList,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 });
  }
}
