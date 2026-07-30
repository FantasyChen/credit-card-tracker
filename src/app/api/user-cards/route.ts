import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import {
  fetchEffectiveBenefitStatuses,
  fetchEffectiveCardTerms,
} from '@/lib/effective-benefit';

// Force dynamic rendering to ensure fresh data and session check
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [userCards, effectiveStatuses, cardTerms] = await Promise.all([
      prisma.creditCard.findMany({
        where: { userId: session.user.id },
        include: {
          events: {
            orderBy: { eventDate: 'desc' },
            take: 1,
            select: {
              id: true,
              eventType: true,
              eventDate: true,
              description: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      fetchEffectiveBenefitStatuses(prisma, { userId: session.user.id }),
      fetchEffectiveCardTerms(prisma, session.user.id),
    ]);

    const definitionsByCard = new Map<string, Map<string, (typeof effectiveStatuses)[number]['benefit']>>();
    for (const status of effectiveStatuses) {
      const cardId = status.benefit.creditCard?.id;
      if (!cardId) continue;
      const definitions = definitionsByCard.get(cardId) ?? new Map();
      definitions.set(status.benefit.id, status.benefit);
      definitionsByCard.set(cardId, definitions);
    }

    const termsByCardId = new Map(cardTerms.map((card) => [card.creditCardId, card]));
    const userCardsWithImages = userCards.map((card) => {
      const terms = termsByCardId.get(card.id);
      return {
        ...card,
        name: terms?.name ?? card.name,
        issuer: terms?.issuer ?? card.issuer,
        benefits: Array.from(definitionsByCard.get(card.id)?.values() ?? []),
        imageUrl: terms?.imageUrl ?? null,
      };
    });

    return NextResponse.json(userCardsWithImages);
  } catch (error) {
    console.error("Error fetching user cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch user cards" },
      { status: 500 }
    );
  }
}
