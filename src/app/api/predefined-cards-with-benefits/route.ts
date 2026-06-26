import { getPublicStaticCards } from '@/lib/static-catalog';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function cachedStaticCatalogResponse() {
  const response = NextResponse.json(getPublicStaticCards());
  response.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  return response;
}

// GET handler to fetch all predefined cards with their benefits
export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('source');

  if (source !== 'db') {
    return cachedStaticCatalogResponse();
  }

  try {
    const [{ prisma }, { authOptions }, { getServerSession }] = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/auth'),
      import('next-auth'),
    ]);
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const response = NextResponse.json(cards);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    console.error("Error fetching predefined cards with benefits:", error);
    return NextResponse.json(
      { error: "Failed to fetch predefined cards with benefits" },
      { status: 500 }
    );
  }
}
