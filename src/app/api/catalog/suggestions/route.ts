import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const suggestions = await prisma.catalogSuggestion.findMany({
      orderBy: { createdAt: 'desc' },
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

    const created = await prisma.catalogSuggestion.create({
      data: {
        type: type as any,
        payloadJson,
        sources: (sources && Array.isArray(sources)) ? sources : [],
        createdById: session.user.id,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 });
  }
}
