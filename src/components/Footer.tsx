import React from 'react';
import Link from 'next/link';

const Footer = () => {
  const currentYear = new Date().getFullYear();

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
      { name: 'GitHub', href: 'https://github.com/FantasyChen/credit-card-tracker', external: true },
      { name: 'Report an Issue', href: 'https://github.com/FantasyChen/credit-card-tracker/issues', external: true },
      { name: 'Contact', href: '/contact' },
    ],
  };

  return (
    <footer className="bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800" role="contentinfo" aria-label="Site footer">
      <div className="container mx-auto px-4 py-12">
        {/* Main footer content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
              Product
            </h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
              Settings
            </h3>
            <ul className="space-y-3">
              {footerLinks.settings.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
              Legal
            </h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
              Community
            </h3>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.name}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
                    >
                      {link.name}
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo and copyright */}
            <div className="flex items-center gap-2">
              <span className="text-xl">💳</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                &copy; {currentYear} CouponCycle. All rights reserved.
              </span>
            </div>

            {/* Support button */}
            <a
              href="https://coff.ee/fantasy_c"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21V19C2 17.8954 2.89543 17 4 17H8C9.10457 17 10 17.8954 10 19V21M6 13C4.34315 13 3 11.6569 3 10C3 8.34315 4.34315 7 6 7C7.65685 7 9 8.34315 9 10C9 11.6569 7.65685 13 6 13ZM18 21V18.5C18 16.0147 15.9853 14 13.5 14H13M18 8L20 6L18 4M22 8L20 6L22 4M16 21V18.5C16 17.6716 16.6716 17 17.5 17H20.5C21.3284 17 22 17.6716 22 18.5V21"/>
              </svg>
              Support the Project
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 