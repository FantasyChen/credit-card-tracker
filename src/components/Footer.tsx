import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-100 py-8 text-center dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          &copy; {currentYear} CouponCycle. All rights reserved.
        </p>
        {/* You can add more links here later if needed, e.g., Privacy Policy, Terms of Service */}
      </div>
    </footer>
  );
};

export default Footer; 