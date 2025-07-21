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

    // Fetch the corresponding predefined cards to get image URLs
    const cardNames = userCards.map(card => card.name);
    const predefinedCards = await prisma.predefinedCard.findMany({
      where: {
        name: { in: cardNames }
      },
      select: {
        name: true,
        issuer: true,
        imageUrl: true,
      }
    });

    // Create a map for quick lookup of image URLs
    const imageUrlMap = new Map(
      predefinedCards.map(card => [`${card.name}-${card.issuer}`, card.imageUrl])
    );

    // Add imageUrl to user cards
    const userCardsWithImages = userCards.map(card => ({
      ...card,
      imageUrl: imageUrlMap.get(`${card.name}-${card.issuer}`) || null
    }));

    return NextResponse.json(userCardsWithImages);
  } catch (error) {
    console.error("Error fetching user cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch user cards" },
      { status: 500 }
    );
  }
} 