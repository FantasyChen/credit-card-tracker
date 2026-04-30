'use client';

import React, { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const faqs = [
  {
    question: 'Is it really free?',
    answer: 'Yes! The Free plan gives you benefit tracking for up to 5 cards, ROI analysis, and 2 email alerts per month — completely free, forever. During our beta period, all registered users also get Pro features at no cost.',
  },
  {
    question: 'Do you access my bank accounts?',
    answer: 'Absolutely not. We never ask for banking credentials, account numbers, or financial login information. You simply tell us which cards you have and we track the publicly-known benefits for those cards.',
  },
  {
    question: 'How do notifications work?',
    answer: 'We send a daily email digest when you have benefits starting a new cycle or expiring soon. You control which notification types you receive in your settings. Pro users get unlimited alerts; Free users get 2 per month.',
  },
  {
    question: 'What happens after beta?',
    answer: 'During beta, every registered user gets Pro features for free. When beta ends, you\'ll keep your Free plan (which is always free). If you want to keep Pro features like unlimited email alerts and custom expiration windows, you can upgrade at that point.',
  },
  {
    question: 'What cards are supported?',
    answer: 'We support a growing catalog of premium cards from major issuers including American Express, Chase, Capital One, Citi, Bank of America, US Bank, and more. We\'re constantly adding new cards based on user requests.',
  },
  {
    question: 'Can I track loyalty points too?',
    answer: 'Yes! Our Loyalty Program tracker monitors your airline miles, hotel points, and other rewards programs. Get alerts before your points expire due to inactivity.',
  },
  {
    question: 'Is my data safe?',
    answer: 'Your data is stored securely on encrypted databases. We don\'t sell your data or share it with third parties. You can export or delete your data anytime from the Settings page.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 bg-white dark:bg-gray-900">
      <div className="container mx-auto max-w-screen-xl px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            FAQ
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Common questions
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Everything you need to know about Perks Reminder.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="max-w-3xl mx-auto divide-y divide-gray-200 dark:divide-gray-700">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="py-1">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between py-5 text-left transition-colors duration-150 hover:text-indigo-600 dark:hover:text-indigo-400"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-medium text-gray-900 dark:text-white pr-8">
                    {faq.question}
                  </span>
                  <ChevronDownIcon
                    className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-96 opacity-100 pb-5' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed pr-12">
                    {faq.answer}
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
