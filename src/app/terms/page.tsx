import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - CouponCycle',
  description: 'Terms of use for CouponCycle. Use the app responsibly; we provide it as-is for tracking credit card benefits.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Terms of Service
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Last updated: February 2025
      </p>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Acceptance of Terms
          </h2>
          <p>
            By using CouponCycle, you agree to these terms. If you do not agree, please do not use the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Description of Service
          </h2>
          <p>
            CouponCycle is a free web app that helps you track credit card benefits, cycles, and loyalty programs. We do not provide financial, tax, or legal advice. Benefit details are for reference; always confirm with your card issuer.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Acceptable Use
          </h2>
          <p>
            You agree to use the service only for lawful purposes and in a way that does not harm the service or other users. Do not attempt to gain unauthorized access to systems or data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Disclaimer of Warranties
          </h2>
          <p>
            The service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind. We do not guarantee accuracy of benefit information or uninterrupted availability.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, CouponCycle and its maintainers are not liable for any indirect, incidental, or consequential damages arising from your use of the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Changes
          </h2>
          <p>
            We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Contact
          </h2>
          <p>
            Questions? <Link href="/contact" className="text-indigo-600 dark:text-indigo-400 hover:underline">Contact us</Link>.
          </p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Link
          href="/"
          className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
