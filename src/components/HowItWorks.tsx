'use client';

import React from 'react';

const steps = [
  {
    number: '01',
    title: 'Add Your Cards',
    description: 'Pick from 50+ supported premium cards from Chase, Amex, Capital One, Citi, and more. Just select your card and opening date.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    color: 'indigo',
  },
  {
    number: '02',
    title: 'We Track Every Cycle',
    description: 'Benefits reset monthly, quarterly, or yearly — we calculate every cycle automatically based on your card anniversary or calendar dates.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    color: 'emerald',
  },
  {
    number: '03',
    title: 'Get Reminded Before Expiry',
    description: 'Email alerts warn you before credits expire — so you never leave money on the table. Pro users get unlimited alerts.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    color: 'amber',
  },
  {
    number: '04',
    title: 'See Your ROI',
    description: 'Know exactly whether your annual fees are paying off. Track claimed value vs. fees paid with real-time ROI analysis.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: 'rose',
  },
];

const colorMap: Record<string, { bg: string; text: string; ring: string; line: string }> = {
  indigo: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    ring: 'ring-indigo-500/20',
    line: 'from-indigo-500',
  },
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-500/20',
    line: 'from-emerald-500',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/20',
    line: 'from-amber-500',
  },
  rose: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-600 dark:text-rose-400',
    ring: 'ring-rose-500/20',
    line: 'from-rose-500',
  },
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-white dark:bg-gray-900">
      <div className="container mx-auto max-w-screen-xl px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            How It Works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Start maximizing your benefits in minutes
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            No bank access needed. No complex setup. Just pick your cards and we handle the rest.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {steps.map((step, index) => {
            const colors = colorMap[step.color];
            return (
              <div key={step.number} className="relative group">
                {/* Connector line (hidden on last item and mobile) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px">
                    <div className={`h-full bg-gradient-to-r ${colors.line} to-transparent opacity-30`} />
                  </div>
                )}

                <div className="relative flex flex-col items-center text-center p-6 rounded-2xl transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  {/* Step number */}
                  <span className={`text-xs font-bold uppercase tracking-widest ${colors.text} mb-4`}>
                    Step {step.number}
                  </span>

                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl ${colors.bg} ring-1 ${colors.ring} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <div className={colors.text}>
                      {step.icon}
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
