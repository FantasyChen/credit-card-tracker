import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Force dynamic rendering to ensure fresh data and session check
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userCards = await prisma.creditCard.findMany({
      where: { userId: session.user.id },
      include: {
        benefits: true, // Include benefits associated with the card
      },
      orderBy: {
        createdAt: 'desc', // Show newest cards first
      },
    });
    return NextResponse.json(userCards);
  } catch (error) {
    console.error("Error fetching user cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch user cards" },
      { status: 500 }
    );
  }
} 