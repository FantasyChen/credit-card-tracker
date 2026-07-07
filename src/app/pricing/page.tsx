import type { Metadata } from 'next';
import PricingSection from '@/components/PricingSection';
import FAQ from '@/components/FAQ';
import { buildFaqJsonLd } from '@/lib/faq-data';

export const metadata: Metadata = {
  title: 'Pricing | Perks Reminder',
  description: 'Perks Reminder is completely free with unlimited cards, reminders, loyalty tracking, and data export.',
  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />
      <PricingSection headingLevel="h1" />
      <FAQ />
    </main>
  );
}
