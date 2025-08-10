import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const { status, reviewNote } = await request.json();
    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await prisma.catalogSuggestion.update({
      where: { id },
      data: {
        status: status as any,
        reviewNote: reviewNote || null,
        reviewedById: session.user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 });
  }
}

