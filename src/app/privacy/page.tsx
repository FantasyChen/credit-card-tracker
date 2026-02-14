import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - CouponCycle',
  description: 'How CouponCycle collects, uses, and protects your data. We store only what is needed to run the app and never sell your information.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Privacy Policy
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Last updated: February 2025
      </p>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Overview
          </h2>
          <p>
            CouponCycle is a free, open-source app that helps you track credit card benefits.
            We take your privacy seriously. This policy describes what data we collect and how we use it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Data We Collect
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Account data:</strong> When you sign in with Google, GitHub, or Facebook, we receive your email and display name from the provider. We do not receive or store passwords.
            </li>
            <li>
              <strong>Your cards and benefits:</strong> Card names, opening dates, benefit details, and completion status you enter are stored to provide the tracking features.
            </li>
            <li>
              <strong>Notification preferences:</strong> Email notification settings you choose in Settings.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            How We Use Your Data
          </h2>
          <p>
            Your data is used only to run the app: to show your benefits dashboard, send optional email reminders, and support import/export. We do not sell, rent, or share your data with third parties for marketing or advertising.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Data Storage and Security
          </h2>
          <p>
            Data is stored on secure infrastructure (Vercel, Neon). We use industry-standard practices to keep the service and database secure. You can export or delete your data at any time from Settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Your Rights
          </h2>
          <p>
            You can export your data from Settings → Import & Export Data. To stop using the app, you may sign out and discontinue use; contact us if you want your account and data removed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
            Contact
          </h2>
          <p>
            Questions about this policy? <Link href="/contact" className="text-indigo-600 dark:text-indigo-400 hover:underline">Contact us</Link>.
          </p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Link
          href="/settings"
          className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium"
        >
          ← Back to Settings
        </Link>
      </div>
    </div>
  );
}
