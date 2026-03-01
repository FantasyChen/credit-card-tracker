import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Temporary debug route to verify loyalty programs in DB. Remove after debugging. */
export async function GET() {
  try {
    const programs = await prisma.loyaltyProgram.findMany({
      select: { id: true, name: true, displayName: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({
      count: programs.length,
      programs: programs.map((p) => ({ id: p.id, name: p.name, displayName: p.displayName })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
