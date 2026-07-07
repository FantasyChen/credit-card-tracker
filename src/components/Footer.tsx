'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRightIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

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

const Footer = () => {
  const pathname = usePathname();
  const [isLoyaltyContext, setIsLoyaltyContext] = useState<boolean | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    setIsLoyaltyContext(pathname.startsWith('/loyalty') || host.includes('loyalty.'));
  }, [pathname]);

  const footerLinks = {
    product: [
      { name: 'Benefits', href: '/benefits' },
      { name: 'Cards', href: '/cards' },
      { name: 'Loyalty Programs', href: '/loyalty' },
      { name: 'How It Works', href: '/guide' },
    ],
    settings: [
      { name: 'Notifications', href: '/settings/notifications' },
      { name: 'Import/Export Data', href: '/settings/data' },
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
    community: [
      { name: 'GitHub', href: 'https://github.com/lifan-builds/perks-reminder', external: true },
      { name: 'Report an Issue', href: 'https://github.com/lifan-builds/perks-reminder/issues', external: true },
      { name: 'Contact', href: '/contact' },
    ],
  };

  return (
    <footer className="border-t border-border bg-background" role="contentinfo" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Image src="/favicon.png" alt="Perks Reminder Logo" width={30} height={30} className="rounded-lg" />
              <span>Perks Reminder</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              Track credits, reset windows, annual fees, and loyalty expirations without connecting bank credentials.
            </p>
            <a
              href="https://coff.ee/fantasy_c"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent"
            >
              Support the project
              <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Product</h3>
            <ul className="space-y-3">
              {isLoyaltyContext !== null && (
                <li>
                  <a
                    href={getSwitchUrl(isLoyaltyContext)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
                  >
                    {isLoyaltyContext ? 'Credit Card Benefits' : 'Loyalty Points'}
                    <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </li>
              )}
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Settings</h3>
            <ul className="space-y-3">
              {footerLinks.settings.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Community</h3>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.name}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.name}
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : (
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} Perks Reminder. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
