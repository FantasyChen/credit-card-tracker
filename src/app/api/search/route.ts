import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchCardsOptimized, hybridSearch, getSearchSuggestionsOptimized } from '@/lib/search/optimizedSearch';

// Enable caching for search results
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'hybrid'; // 'hybrid' or 'optimized'
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'relevance';
    const minScore = parseInt(searchParams.get('minScore') || '10');

    if (type === 'suggestions') {
      const suggestions = await getSearchSuggestionsOptimized();
      return NextResponse.json({ suggestions });
    }

    const searchFunction = type === 'optimized' ? searchCardsOptimized : hybridSearch;
    
    const results = await searchFunction(query, {
      limit: Math.min(limit, 100), // Cap at 100 results
      includeBenefits: true,
      sortBy: sortBy as 'relevance' | 'name' | 'issuer' | 'annualFee',
      minScore,
    });

    // Add metadata for debugging/analytics
    const response = {
      results,
      metadata: {
        query,
        type,
        totalResults: results.length,
        searchTime: Date.now(),
      },
    };

    // Set cache headers for successful searches
    if (results.length > 0) {
      const responseObj = NextResponse.json(response);
      responseObj.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return responseObj;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

// POST endpoint for more complex search queries
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      query, 
      filters = {}, 
      options = {} 
    } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Apply filters (e.g., issuer, annual fee range, benefit categories)
    const searchOptions = {
      limit: options.limit || 20,
      includeBenefits: options.includeBenefits !== false,
      sortBy: options.sortBy || 'relevance',
      minScore: options.minScore || 10,
      ...filters,
    };

    const results = await hybridSearch(query, searchOptions);

    return NextResponse.json({
      results,
      metadata: {
        query,
        filters,
        options: searchOptions,
        totalResults: results.length,
        searchTime: Date.now(),
      },
    });
  } catch (error) {
    console.error('Search POST API error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
