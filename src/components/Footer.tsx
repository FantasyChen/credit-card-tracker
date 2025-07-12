import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-100 py-8 text-center dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Enjoying CouponCycle? Support the developer:
          </p>
          <a
            href="https://coff.ee/fantasy_c"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 transition-colors duration-200"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-.766-1.618a4.85 4.85 0 0 0-1.364-1.119C17.156 2.583 16.352 2.25 15.5 2.25c-1.209 0-2.344.568-3.077 1.539C11.69 2.817 10.555 2.25 9.346 2.25c-.852 0-1.656.333-2.454.762a4.85 4.85 0 0 0-1.364 1.119c-.378.455-.647 1.02-.766 1.618L4.63 6.415a6.2 6.2 0 0 0-.132.666c-.119.598-.119 1.209 0 1.807l.747 3.735c.186.93.776 1.704 1.618 2.115.842.41 1.807.41 2.649 0 .842-.41 1.432-1.185 1.618-2.115l.373-1.868.373 1.868c.186.93.776 1.704 1.618 2.115.842.41 1.807.41 2.649 0 .842-.41 1.432-1.185 1.618-2.115l.747-3.735c.119-.598.119-1.209 0-1.807zM12 21.75c-5.385 0-9.75-4.365-9.75-9.75S6.615 2.25 12 2.25s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/>
            </svg>
            Buy me a coffee
          </a>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          &copy; {currentYear} CouponCycle. All rights reserved.
        </p>
        {/* You can add more links here later if needed, e.g., Privacy Policy, Terms of Service */}
      </div>
    </footer>
  );
};

export default Footer; 