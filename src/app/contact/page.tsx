import React from 'react';

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8">Contact Us</h1>
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <p className="text-lg text-gray-700 mb-4">
          Have questions, feedback, or a feature request? We&apos;d love to hear from you!
        </p>
        <p className="text-lg text-gray-700 mb-4">
          If you have a specific credit card you&apos;d like to see added to our predefined list, please let us know the card name and issuer.
        </p>
        <p className="text-lg text-gray-700 mb-6">
          You can reach out to us via email: <a href="mailto:coupon.cycle@gmail.com" className="text-blue-600 hover:text-blue-800 underline">coupon.cycle@gmail.com</a>.
        </p>
        <p className="text-lg text-gray-700 text-center font-medium">
          Let&apos;s make CouponCycle even better, together!
        </p>
      </div>
    </div>
  );
} 