'use client';

import React from 'react';
import Link from 'next/link';

const features = [
  'Unlimited card tracking',
  'Recurring benefit cycles',
  'Email reminders',
  'Custom reminder windows',
  'Loyalty point expiration tracking',
  'Free night certificate tracking',
  'Annual fee ROI analysis',
  'Data import and export',
];

function CheckIcon() {
  return (
    <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-gray-50 dark:bg-gray-800">
      <div className="container mx-auto max-w-screen-xl px-4">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Completely free
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Perks Reminder has no paid plan, no subscription, and no card or reminder limit.
          </p>
        </div>

        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="grid gap-8 p-8 md:grid-cols-[0.8fr_1.2fr] md:p-10">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Price
              </p>
              <div className="mt-2">
                <span className="text-5xl font-bold text-gray-900 dark:text-white">$0</span>
                <span className="ml-2 text-gray-500 dark:text-gray-400">forever</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-400">
                Built as a free, open-source tracker for people who want reminders without bank-link access or another paid finance app.
              </p>
              <Link
                href="/auth/signup"
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-indigo-700 sm:w-auto"
              >
                Create Free Account
              </Link>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Everything included
              </h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                If the product needs limits for abuse prevention later, they should be operational safeguards, not paid feature gates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
