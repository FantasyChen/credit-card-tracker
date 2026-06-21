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
        nickname: true,
        lastFourDigits: true,
        lifecycleStatus: true,
        closedDate: true,
        annualFeeAmount: true,
        annualFeeDueDate: true,
        signupBonusDeadline: true,
        spendDeadline: true,
        productChangedFrom: true,
        productChangedTo: true,
        lifecycleNotes: true,
        events: {
          orderBy: { eventDate: 'asc' },
          select: {
            eventType: true,
            eventDate: true,
            description: true,
            metadata: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const exportData = {
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      userCards: userCardsData.map(card => ({
        predefinedCardName: card.name,
        predefinedCardIssuer: card.issuer,
        openedDate: card.openedDate ? card.openedDate.toISOString().split('T')[0] : null,
        nickname: card.nickname,
        lastFourDigits: card.lastFourDigits,
        lifecycleStatus: card.lifecycleStatus,
        closedDate: card.closedDate ? card.closedDate.toISOString().split('T')[0] : null,
        annualFeeAmount: card.annualFeeAmount,
        annualFeeDueDate: card.annualFeeDueDate ? card.annualFeeDueDate.toISOString().split('T')[0] : null,
        signupBonusDeadline: card.signupBonusDeadline ? card.signupBonusDeadline.toISOString().split('T')[0] : null,
        spendDeadline: card.spendDeadline ? card.spendDeadline.toISOString().split('T')[0] : null,
        productChangedFrom: card.productChangedFrom,
        productChangedTo: card.productChangedTo,
        lifecycleNotes: card.lifecycleNotes,
        events: card.events.map(event => ({
          eventType: event.eventType,
          eventDate: event.eventDate.toISOString().split('T')[0],
          description: event.description,
          metadata: event.metadata,
        })),
      })),
    };

    const filename = `perks_reminder_data_${new Date().toISOString().split('T')[0]}.json`;

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
