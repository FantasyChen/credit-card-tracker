import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the CouponCycle team. Send us your feedback, feature requests, or questions about tracking your credit card benefits.",
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8 dark:text-white">Contact Us</h1>
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md dark:bg-gray-800 dark:shadow-lg dark:shadow-indigo-500/20">
        <p className="text-lg text-gray-700 mb-4 dark:text-gray-300">
          Have questions, feedback, or a feature request? We&apos;d love to hear from you!
        </p>
        <p className="text-lg text-gray-700 mb-4 dark:text-gray-300">
          If you have a specific credit card you&apos;d like to see added to our predefined list, please let us know the card name and issuer.
        </p>
        <p className="text-lg text-gray-700 mb-6 dark:text-gray-300">
          You can reach out to us via email: <a href="mailto:coupon.cycle@gmail.com" className="text-blue-600 hover:text-blue-800 underline dark:text-blue-400 dark:hover:text-blue-300">coupon.cycle@gmail.com</a>.
        </p>
        
        {/* Support Section */}
        <div className="border-t pt-6 mt-6 border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Support the Developer</h2>
          <p className="text-gray-700 mb-4 dark:text-gray-300">
            Hi! I&apos;m the developer behind CouponCycle. If you find this app helpful for tracking your credit card benefits, consider buying me a coffee to support continued development and new features!
          </p>
          <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
            Your support helps me maintain the app, add new cards, and implement user-requested features. Every contribution is greatly appreciated! ☕
          </p>
          <div className="text-center">
            <a
              href="https://coff.ee/fantasy_c"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-.766-1.618a4.85 4.85 0 0 0-1.364-1.119C17.156 2.583 16.352 2.25 15.5 2.25c-1.209 0-2.344.568-3.077 1.539C11.69 2.817 10.555 2.25 9.346 2.25c-.852 0-1.656.333-2.454.762a4.85 4.85 0 0 0-1.364 1.119c-.378.455-.647 1.02-.766 1.618L4.63 6.415a6.2 6.2 0 0 0-.132.666c-.119.598-.119 1.209 0 1.807l.747 3.735c.186.93.776 1.704 1.618 2.115.842.41 1.807.41 2.649 0 .842-.41 1.432-1.185 1.618-2.115l.373-1.868.373 1.868c.186.93.776 1.704 1.618 2.115.842.41 1.807.41 2.649 0 .842-.41 1.432-1.185 1.618-2.115l.747-3.735c.119-.598.119-1.209 0-1.807zM12 21.75c-5.385 0-9.75-4.365-9.75-9.75S6.615 2.25 12 2.25s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/>
              </svg>
              Buy me a coffee
            </a>
          </div>
        </div>
        
        <p className="text-lg text-gray-700 text-center font-medium mt-6 dark:text-gray-300">
          Let&apos;s make CouponCycle even better, together!
        </p>
      </div>
    </div>
  );
} 