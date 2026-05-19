import { NextRequest, NextResponse } from 'next/server';
import { getRootDomain } from '@/lib/site';

const COOKIE_BASE_NAMES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
  'authjs.session-token',
  '__Secure-next-auth.callback-url',
  'next-auth.callback-url',
  'authjs.callback-url',
  '__Host-next-auth.csrf-token',
  '__Secure-next-auth.csrf-token',
  'next-auth.csrf-token',
  'authjs.csrf-token',
];

function getCookieNames(): string[] {
  const names = new Set<string>();

  for (const name of COOKIE_BASE_NAMES) {
    names.add(name);
    for (let index = 0; index < 10; index += 1) {
      names.add(`${name}.${index}`);
    }
  }

  return Array.from(names);
}

function getCookieDomains(host: string): Array<string | undefined> {
  const hostname = host.split(':')[0];
  const rootDomain = getRootDomain(hostname);

  if (!rootDomain) return [undefined];

  return [undefined, `.${rootDomain}`, rootDomain];
}

function getSafeCallbackUrl(request: NextRequest): URL {
  const fallback = new URL('/', request.url);
  const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');

  if (!callbackUrl) return fallback;

  try {
    const url = new URL(callbackUrl, request.url);
    const rootDomain = getRootDomain(url.hostname);
    const requestRootDomain = getRootDomain(request.nextUrl.hostname);
    const isSameOrigin = url.origin === request.nextUrl.origin;
    const isTrustedProductionHost =
      rootDomain === 'perks-reminder.com' && requestRootDomain === 'perks-reminder.com';
    const isTrustedLocalhost =
      url.hostname.includes('localhost') && request.nextUrl.hostname.includes('localhost');

    if (isSameOrigin || isTrustedProductionHost || isTrustedLocalhost) {
      return url;
    }
  } catch {
    // Fall through to the safe fallback.
  }

  return fallback;
}

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(getSafeCallbackUrl(request));
  const domains = getCookieDomains(request.headers.get('host') || request.nextUrl.host);
  const expires = new Date(0);

  for (const name of getCookieNames()) {
    for (const domain of domains) {
      if (name.startsWith('__Host-') && domain) continue;

      response.cookies.set(name, '', {
        domain,
        expires,
        httpOnly: name.includes('session-token'),
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
      });
    }
  }

  return response;
}
