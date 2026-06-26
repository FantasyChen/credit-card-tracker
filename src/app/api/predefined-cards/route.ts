import { getPublicStaticCards } from '@/lib/static-catalog';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET handler to fetch all predefined cards
export async function GET() {
  try {
    const cards = getPublicStaticCards().map(({ benefits, ...card }) => card);
    const response = NextResponse.json(cards);
    response.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return response;
  } catch (error) {
    console.error("Error fetching predefined cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch predefined cards" },
      { status: 500 }
    );
  }
}
