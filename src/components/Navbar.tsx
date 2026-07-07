'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useMemo, useEffect } from 'react';
import { Bars3Icon, XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  authRequired?: boolean;
}

const mainNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/' },
  { name: 'Cards', href: '/cards' },
  { name: 'Benefits', href: '/benefits' },
  { name: 'Notifications', href: '/settings/notifications', authRequired: true },
  { name: 'Account', href: '/settings', authRequired: true },
];

const loyaltyNavigation: NavItem[] = [
  { name: 'Loyalty Programs', href: '/loyalty' },
  { name: 'Settings', href: '/settings' },
  { name: 'Contact', href: '/contact' },
];

function getSwitchUrl(isLoyaltyContext: boolean): string {
  if (!isLoyaltyContext) {
    return '/loyalty';
  }
  if (typeof window === 'undefined') return '/';
  const host = window.location.hostname;
  const port = window.location.port;
  const proto = window.location.protocol;
  const isLocalhost = host.includes('localhost');
  return isLocalhost
    ? `${proto}//${host.replace(/^loyalty\./, '')}${port ? `:${port}` : ''}`
    : `${proto}//${host.replace(/^loyalty\./, 'www.')}`;
}

function getSignOutCallbackUrl(isLoyaltyContext: boolean): string {
  if (!isLoyaltyContext || typeof window === 'undefined') return '/';

  const host = window.location.hostname;
  if (host.includes('loyalty.')) {
    return `${window.location.protocol}//${window.location.host}/`;
  }

  return '/loyalty-landing';
}

function getSignOutHref(isLoyaltyContext: boolean): string {
  return `/api/force-signout?callbackUrl=${encodeURIComponent(
    getSignOutCallbackUrl(isLoyaltyContext)
  )}`;
}

const Navbar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoyaltyContext, setIsLoyaltyContext] = useState<boolean | null>(null);

  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const loyaltyPath = pathname.startsWith('/loyalty');
    const loyaltyHost = host.includes('loyalty.');
    setIsLoyaltyContext(loyaltyPath || loyaltyHost);
  }, [pathname]);

  const baseNavigation = isLoyaltyContext ? loyaltyNavigation : mainNavigation;

  const navigation = useMemo(() => {
    return baseNavigation.filter(item => {
      if (item.authRequired && !session) return false;
      return true;
    });
  }, [session, baseNavigation]);

  const switchLabel = isLoyaltyContext ? 'Credit Card Benefits' : 'Loyalty Points';
  const switchHref = getSwitchUrl(isLoyaltyContext ?? false);
  const signOutHref = getSignOutHref(isLoyaltyContext ?? false);

  return (
    <header role="banner" className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <nav role="navigation" aria-label="Main navigation">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-5">
              <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                <Image
                  src="/favicon.png"
                  alt="Perks Reminder Logo"
                  width={30}
                  height={30}
                  className="rounded-lg"
                />
                <span className="truncate text-base">Perks Reminder</span>
              </Link>

              <div className="hidden lg:flex lg:items-center lg:gap-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={switchHref}
                className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent lg:inline-flex"
              >
                {switchLabel}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </a>

              <div className="hidden lg:block">
                <ThemeToggle />
              </div>

              <div className="hidden lg:flex lg:items-center">
                {session ? (
                  <a
                    href={signOutHref}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent"
                  >
                    Sign out
                  </a>
                ) : (
                  <Link
                    href="/auth/signin"
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90"
                  >
                    Sign in
                  </Link>
                )}
              </div>

              <div className="flex items-center lg:hidden">
                <ThemeToggle />
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="ml-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="mobile-menu"
                >
                  <span className="sr-only">Open main menu</span>
                  {isMobileMenuOpen ? (
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="border-t border-border bg-background lg:hidden" id="mobile-menu" role="menu" aria-label="Mobile navigation menu">
            <div className="space-y-1 px-4 py-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'block rounded-lg px-3 py-2 text-base font-medium transition-colors',
                      isActive
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setIsMobileMenuOpen(false)}
                    role="menuitem"
                  >
                    {item.name}
                  </Link>
                );
              })}

              <a
                href={switchHref}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-base font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setIsMobileMenuOpen(false)}
                role="menuitem"
              >
                {switchLabel}
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="border-t border-border px-4 py-3">
              {session ? (
                <a
                  href={signOutHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Sign out
                </a>
              ) : (
                <Link
                  href="/auth/signin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full rounded-lg bg-primary px-3 py-2 text-center text-base font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
