import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Force dynamic rendering, disable caching for this route
export const dynamic = 'force-dynamic';

// GET handler to fetch all predefined cards with their benefits
export async function GET() {
  try {
    const cards = await prisma.predefinedCard.findMany({
      include: {
        benefits: {
          orderBy: { maxAmount: 'desc' }, // Show highest value benefits first
        },
      },
      orderBy: [
        { issuer: 'asc' },
        { name: 'asc' }
      ],
    });
    return NextResponse.json(cards);
  } catch (error) {
    console.error("Error fetching predefined cards with benefits:", error);
    return NextResponse.json(
      { error: "Failed to fetch predefined cards with benefits" },
      { status: 500 }
    );
  }
} 