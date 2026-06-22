import type { Metadata } from 'next';
import PricingSection from '@/components/PricingSection';
import FAQ from '@/components/FAQ';

export const metadata: Metadata = {
  title: 'Pricing | Perks Reminder',
  description: 'Perks Reminder is completely free with unlimited cards, reminders, loyalty tracking, and data export.',
};

export default function PricingPage() {
  return (
    <main>
      <PricingSection />
      <FAQ />
    </main>
  );
}
