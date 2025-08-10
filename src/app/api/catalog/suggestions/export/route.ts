import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || 'APPROVED').toUpperCase();
  const format = (url.searchParams.get('format') || 'json').toLowerCase();
  const limitParam = url.searchParams.get('limit');
  const idsParam = url.searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
  let take: number | undefined = undefined;
  if (limitParam) {
    const parsed = Number(limitParam);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 1000) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
    }
    take = parsed;
  }

  if (ids.length === 0 && !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const suggestions = await prisma.catalogSuggestion.findMany({
    where: ids.length > 0 ? { id: { in: ids } } : { status: status as any },
    orderBy: { updatedAt: 'desc' },
    take,
    include: {
      createdBy: { select: { id: true, email: true, name: true } },
      reviewedBy: { select: { id: true, email: true, name: true } },
    },
  });

  const plan = {
    planVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: session.user.email || session.user.id,
    status,
    count: suggestions.length,
    items: suggestions.map(s => ({
      id: s.id,
      type: s.type,
      status: s.status,
      exportedAt: s.exportedAt ? s.exportedAt.toISOString() : undefined,
      payloadJson: s.payloadJson,
      sources: s.sources,
      reviewNote: s.reviewNote || undefined,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      createdBy: s.createdBy?.email || s.createdBy?.id,
      reviewedBy: s.reviewedBy?.email || s.reviewedBy?.id,
    })),
  };

  const filename = `catalog-patch-plan_${status.toLowerCase()}_${new Date().toISOString().slice(0,10)}.json`;

  if (format === 'ndjson') {
    const nd = plan.items.map(i => JSON.stringify(i)).join('\n');
    // Optionally mark exported
    if (ids.length > 0 || status === 'APPROVED') {
      await prisma.catalogSuggestion.updateMany({ where: { id: { in: suggestions.map(s => s.id) } }, data: { exportedAt: new Date() } });
    }
    return new NextResponse(nd, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Content-Disposition': `attachment; filename=${filename.replace('.json', '.ndjson')}`,
      },
    });
  }

  // JSON response
  if (ids.length > 0 || status === 'APPROVED') {
    await prisma.catalogSuggestion.updateMany({ where: { id: { in: suggestions.map(s => s.id) } }, data: { exportedAt: new Date() } });
  }
  return NextResponse.json(plan, {
    headers: {
      'Content-Disposition': `attachment; filename=${filename}`,
    },
  });
}

