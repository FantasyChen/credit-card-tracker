'use client';

import React from 'react';
import Link from 'next/link';
import { TIER_LIMITS } from '@/lib/subscription-limits';

const features = [
  { name: 'Card tracking', free: `Up to ${TIER_LIMITS.FREE.maxCards} cards`, pro: 'Unlimited', icon: '💳' },
  { name: 'Benefits tracking', free: true, pro: true, icon: '📋' },
  { name: 'ROI analysis', free: true, pro: true, icon: '📊' },
  { name: 'Drag & drop reordering', free: true, pro: true, icon: '↕️' },
  { name: 'Loyalty program tracking', free: true, pro: true, icon: '✈️' },
  { name: 'Data import/export', free: true, pro: true, icon: '💾' },
  { name: 'Email alerts', free: `${TIER_LIMITS.FREE.maxEmailAlertsPerMonth}/month`, pro: 'Unlimited', icon: '📧', highlight: true },
  { name: 'Expiration warning window', free: '7 days (fixed)', pro: 'Custom (1–30 days)', icon: '⏰', highlight: true },
  { name: 'Priority support', free: false, pro: true, icon: '🎧' },
  { name: 'Early access to new features', free: false, pro: true, icon: '🚀' },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>;
  }
  if (value) {
    return (
      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-gray-50 dark:bg-gray-800">
      <div className="container mx-auto max-w-screen-xl px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Start free. Upgrade when you&apos;re ready.
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Core tracking is always free. Go Pro for unlimited alerts and full customization.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Free</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Everything you need to start tracking
              </p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">$0</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">/forever</span>
            </div>
            <Link
              href="/auth/signup"
              className="block w-full text-center rounded-xl border-2 border-gray-300 dark:border-gray-600 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="relative rounded-2xl border-2 border-indigo-500 dark:border-indigo-400 bg-white dark:bg-gray-900 p-8 shadow-lg shadow-indigo-500/10">
            {/* Beta badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Free During Beta
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Pro</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Unlimited alerts & full customization
              </p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-bold text-gray-900 dark:text-white line-through opacity-40">$5</span>
              <span className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 ml-2">$0</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">/mo during beta</span>
            </div>
            <Link
              href="/auth/signup"
              className="block w-full text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200"
            >
              Sign Up — Get Pro Free
            </Link>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-white mb-8">
            Compare plans
          </h3>
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            {/* Table header */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Feature</div>
              <div className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">Free</div>
              <div className="text-center text-sm font-medium text-indigo-600 dark:text-indigo-400">Pro</div>
            </div>
            {/* Feature rows */}
            {features.map((feature, index) => (
              <div
                key={feature.name}
                className={`grid grid-cols-3 gap-4 px-6 py-3.5 items-center ${
                  index < features.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                } ${feature.highlight ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{feature.icon}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{feature.name}</span>
                </div>
                <div className="flex justify-center">
                  <FeatureValue value={feature.free} />
                </div>
                <div className="flex justify-center">
                  <FeatureValue value={feature.pro} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
