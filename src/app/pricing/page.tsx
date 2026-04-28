import type { Metadata } from 'next';
import PricingSection from '@/components/PricingSection';
import FAQ from '@/components/FAQ';

export const metadata: Metadata = {
  title: 'Pricing | Perks Reminder',
  description: 'Compare Perks Reminder Free and Pro plans.',
};

export default function PricingPage() {
  return (
    <main>
      <PricingSection />
      <FAQ />
    </main>
  );
}
