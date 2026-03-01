'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useMemo, useEffect } from 'react';
import { Bars3Icon, XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import ThemeToggle from '@/components/ui/ThemeToggle';

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
  { name: 'Contact', href: '/contact' },
];

const loyaltyNavigation: NavItem[] = [
  { name: 'Loyalty Programs', href: '/loyalty' },
  { name: 'Settings', href: '/settings' },
  { name: 'Contact', href: '/contact' },
];

/** Build the URL to switch between main and loyalty contexts. */
function getSwitchUrl(isLoyaltyContext: boolean): string {
  if (!isLoyaltyContext) {
    // Main → Loyalty: use same-origin /loyalty path (works on localhost and production)
    return '/loyalty';
  }
  // Loyalty → Main: need to go back to main domain (since middleware rewrites / on loyalty subdomain)
  if (typeof window === 'undefined') return '/';
  const host = window.location.hostname;
  const port = window.location.port;
  const proto = window.location.protocol;
  const isLocalhost = host.includes('localhost');
  return isLocalhost
    ? `${proto}//${host.replace(/^loyalty\./, '')}${port ? `:${port}` : ''}`
    : 'https://www.coupon-cycle.site';
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

  return (
    <header role="banner">
    <nav className="bg-white shadow-sm dark:bg-gray-800" role="navigation" aria-label="Main navigation">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center text-xl font-bold text-gray-900 dark:text-white">
                <Image 
                  src="/favicon.png"
                  alt="CouponCycle Logo" 
                  width={32}
                  height={32}
                  className="mr-2"
                />
                CouponCycle
              </Link>
            </div>
            {/* Desktop navigation links */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                    pathname === item.href
                      ? 'border-indigo-500 text-gray-900 dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:text-gray-100'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)} // Close mobile menu on desktop nav click (good practice)
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            {/* Site switcher - link to other product */}
            <div className="hidden sm:block">
              <a
                href={switchHref}
                className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
              >
                {switchLabel}
                <ArrowRightIcon className="ml-1 h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            {/* Theme Toggle - visible on all screen sizes */}
            <div className="hidden sm:block sm:ml-2">
              <ThemeToggle />
            </div>
            {/* Desktop Sign in/out button */}
            <div className="hidden sm:ml-2 sm:block">
              {session ? (
                <button
                  onClick={() => signOut()}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-600"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/auth/signin"
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                  Sign in
                </Link>
              )}
            </div>
            {/* Mobile menu button & Theme Toggle */}
            <div className="ml-2 flex items-center sm:hidden">
              <ThemeToggle />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="ml-2 inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:ring-indigo-400"
                aria-expanded={isMobileMenuOpen}
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state. */}
      {isMobileMenuOpen && (
        <div className="sm:hidden" id="mobile-menu" role="menu" aria-label="Mobile navigation menu">
          <div className="space-y-1 px-2 pb-3 pt-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-base font-medium ${
                  pathname === item.href
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-gray-900 dark:text-indigo-400'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                }`}
                aria-current={pathname === item.href ? 'page' : undefined}
                onClick={() => setIsMobileMenuOpen(false)} // Close menu on item click
                role="menuitem"
              >
                {item.name}
              </Link>
            ))}
            {/* Site switcher for mobile */}
            <a
              href={switchHref}
              className="block rounded-md px-3 py-2 text-base font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
              onClick={() => setIsMobileMenuOpen(false)}
              role="menuitem"
            >
              {switchLabel} →
            </a>
          </div>
           {/* Sign in/out button now part of the header for mobile too */}
           <div className="border-t border-gray-200 px-2 pt-3 pb-3 dark:border-gray-700">
            {session ? (
                <button
                  onClick={() => { signOut(); setIsMobileMenuOpen(false); }}
                  className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/auth/signin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full rounded-md bg-indigo-600 px-3 py-2 text-center text-base font-medium text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
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