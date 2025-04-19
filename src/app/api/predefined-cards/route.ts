import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const predefinedCards = await prisma.predefinedCard.findMany({
      include: {
        benefits: true,
      },
    });

    return NextResponse.json(predefinedCards);
  } catch (error) {
    console.error('Error fetching predefined cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predefined cards' },
      { status: 500 }
    );
  }
} 