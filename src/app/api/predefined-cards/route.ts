import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Force dynamic rendering, disable caching for this route
export const dynamic = 'force-dynamic';

// GET handler to fetch all predefined cards
export async function GET() {
  try {
    const cards = await prisma.predefinedCard.findMany({
      orderBy: { name: 'asc' }, // Optional: order alphabetically
    });
    return NextResponse.json(cards);
  } catch (error) {
    console.error("Error fetching predefined cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch predefined cards" },
      { status: 500 }
    );
  }
} 