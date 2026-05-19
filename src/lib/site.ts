export const SITE_NAME = 'Perks Reminder';
export const SITE_DESCRIPTION =
  'Track credit card benefits, maximize rewards, and never miss expiring perks again.';
export const ROOT_DOMAIN = 'perks-reminder.com';
export const PRIMARY_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || `https://www.${ROOT_DOMAIN}`;
export const SUPPORT_EMAIL = 'coupon.cycle@gmail.com';

export function getRootDomain(hostname: string): string | null {
  if (!hostname || hostname.includes('localhost')) return null;

  return hostname
    .replace(/:\d+$/, '')
    .replace(/^(www|loyalty)\./, '');
}

export function getSharedCookieDomain(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const hostname = new URL(url).hostname;
    const rootDomain = getRootDomain(hostname);
    return rootDomain ? `.${rootDomain}` : undefined;
  } catch {
    return undefined;
  }
}

export function getCanonicalAuthUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.hostname === ROOT_DOMAIN) {
      parsed.hostname = `www.${ROOT_DOMAIN}`;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}
