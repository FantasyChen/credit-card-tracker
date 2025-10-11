'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useMemo } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface NavItem {
  name: string;
  href: string;
  authRequired?: boolean; // Optional: true if link requires authentication
}

// Define baseNavigation outside the component to avoid re-creating it
const baseNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/' },
  { name: 'Cards', href: '/cards' },
  { name: 'Benefits', href: '/benefits' },
  { name: 'Notifications', href: '/settings/notifications', authRequired: true },
  { name: 'Contact', href: '/contact' },
];

const Navbar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Filter navigation items based on authentication status
  const navigation = useMemo(() => {
    return baseNavigation.filter(item => {
      if (item.authRequired && !session) {
        return false; // Don't show auth-required links if not logged in
      }
      return true;
    });
  }, [session]);

  return (
    <nav className="bg-white shadow-sm dark:bg-gray-800">
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
            {/* Desktop Sign in/out button */}
            <div className="hidden sm:ml-4 sm:block">
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
        <div className="sm:hidden" id="mobile-menu">
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
              >
                {item.name}
              </Link>
            ))}
            {/* Mobile Sign in/out button and Theme Toggle are now outside the main nav items, in the mobile header*/}
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
  );
};

export default Navbar; 