import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOYALTY_SUBDOMAINS = ['loyalty'];

function getSubdomain(hostname: string): string | null {
  const parts = hostname.split('.');
  // localhost:3000 → no subdomain
  if (parts.length <= 2 && !hostname.includes('localhost')) return null;
  // loyalty.coupon-cycle.site → "loyalty"
  if (parts.length >= 3) return parts[0];
  // loyalty.localhost → "loyalty" (dev)
  if (hostname.includes('localhost') && parts.length >= 2 && parts[0] !== 'localhost') {
    return parts[0];
  }
  return null;
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = getSubdomain(hostname);
  const { pathname } = request.nextUrl;

  if (subdomain && LOYALTY_SUBDOMAINS.includes(subdomain)) {
    // On loyalty subdomain, rewrite root to the loyalty landing page
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/loyalty-landing';
      return NextResponse.rewrite(url);
    }
    // Set a header so pages can detect loyalty context
    const response = NextResponse.next();
    response.headers.set('x-subdomain', 'loyalty');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files, api routes, and Next.js internals
    '/((?!_next/static|_next/image|favicon\\.png|manifest\\.json|images/|api/).*)',
  ],
};
