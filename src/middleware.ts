import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOYALTY_SUBDOMAINS = ['loyalty'];
const OLD_DOMAIN = 'coupon-cycle.site';
const NEW_DOMAIN = 'perks-reminder.com';

function splitHostAndPort(hostname: string): { host: string; port: string } {
  const [host, port = ''] = hostname.split(':');
  return { host, port };
}

function getSubdomain(hostname: string): string | null {
  const { host } = splitHostAndPort(hostname);
  const parts = host.split('.');
  // localhost:3000 → no subdomain
  if (parts.length <= 2 && !host.includes('localhost')) return null;
  // loyalty.perks-reminder.com → "loyalty"
  if (parts.length >= 3) return parts[0];
  // loyalty.localhost → "loyalty" (dev)
  if (host.includes('localhost') && parts.length >= 2 && parts[0] !== 'localhost') {
    return parts[0];
  }
  return null;
}

function getMainAuthHost(hostname: string, subdomain: string): { host: string; port: string } {
  const { host, port } = splitHostAndPort(hostname);
  const rootHost = host.replace(new RegExp(`^${subdomain}\\.`), '');

  if (rootHost.includes('localhost')) {
    return { host: rootHost, port };
  }

  return {
    host: rootHost.startsWith('www.') ? rootHost : `www.${rootHost}`,
    port: '',
  };
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = getSubdomain(hostname);
  const { pathname } = request.nextUrl;
  const { host: hostnameWithoutPort } = splitHostAndPort(hostname);

  if (hostnameWithoutPort === OLD_DOMAIN || hostnameWithoutPort === `www.${OLD_DOMAIN}`) {
    const url = request.nextUrl.clone();
    url.protocol = 'https';
    url.hostname = `www.${NEW_DOMAIN}`;
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  if (hostnameWithoutPort === `loyalty.${OLD_DOMAIN}`) {
    const url = request.nextUrl.clone();
    url.protocol = 'https';
    url.hostname = `loyalty.${NEW_DOMAIN}`;
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  if (subdomain && LOYALTY_SUBDOMAINS.includes(subdomain)) {
    // Redirect auth pages to main domain so OAuth uses registered callback URLs
    if (pathname.startsWith('/auth/')) {
      const mainAuthHost = getMainAuthHost(hostname, subdomain);
      const protocol = hostname.includes('localhost') ? 'http' : 'https';
      const url = request.nextUrl.clone();
      url.hostname = mainAuthHost.host;
      url.port = mainAuthHost.port;
      url.protocol = protocol;
      if (!url.searchParams.has('callbackUrl')) {
        url.searchParams.set('callbackUrl', `${protocol}://${hostname}/loyalty`);
      }
      return NextResponse.redirect(url);
    }

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
