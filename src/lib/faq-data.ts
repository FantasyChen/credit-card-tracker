export const faqs = [
  {
    question: 'Is it really free?',
    answer: 'Yes. Perks Reminder is completely free: unlimited cards, benefit tracking, ROI analysis, loyalty tracking, data export, and email reminders are included.',
  },
  {
    question: 'Do you access my bank accounts?',
    answer: 'Absolutely not. We never ask for banking credentials, account numbers, or financial login information. You simply tell us which cards you have and we track the publicly-known benefits for those cards.',
  },
  {
    question: 'How do notifications work?',
    answer: 'We send a daily email digest when you have benefits starting a new cycle or expiring soon. You control which notification types you receive and how far ahead reminders should arrive in your settings.',
  },
  {
    question: 'Is there a paid Pro plan?',
    answer: 'No. The old Pro plan is deprecated. Current product features are free for every account.',
  },
  {
    question: 'What cards are supported?',
    answer: "We support a growing catalog of premium cards from major issuers including American Express, Chase, Capital One, Citi, Bank of America, US Bank, and more. We're constantly adding new cards based on user requests.",
  },
  {
    question: 'Can I track loyalty points too?',
    answer: 'Yes! Our Loyalty Program tracker monitors your airline miles, hotel points, and other rewards programs. Get alerts before your points expire due to inactivity.',
  },
  {
    question: 'Is my data safe?',
    answer: "Your data is stored securely on encrypted databases. We don't sell your data or share it with third parties. You can export or delete your data anytime from the Settings page.",
  },
] as const;

export function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
