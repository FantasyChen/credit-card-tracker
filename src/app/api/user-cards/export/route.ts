import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const userCardsData = await prisma.creditCard.findMany({
      where: { userId: session.user.id },
      select: {
        name: true,
        issuer: true,
        openedDate: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userCards: userCardsData.map(card => ({
        predefinedCardName: card.name,
        predefinedCardIssuer: card.issuer,
        openedDate: card.openedDate ? card.openedDate.toISOString().split('T')[0] : null,
      })),
    };

    const filename = `couponcycle_data_${new Date().toISOString().split('T')[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ message: 'Error exporting data' }, { status: 500 });
  }
} 