import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/ui/PageHeader';
import BenefitTrackingClient, {
  type TrackedBenefitPreference,
} from './BenefitTrackingClient';

export const metadata: Metadata = {
  title: 'Benefit Tracking - Settings',
  description: 'Review the benefits you auto-claim or ignore, and return them to normal tracking.',
  alternates: {
    canonical: '/settings/benefit-tracking',
  },
};

/**
 * The management surface for cycle-independent tracking choices. An ignored
 * benefit is hidden from the dashboard by design, so this page is the only
 * place it can be found and restored.
 */
export default async function BenefitTrackingSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/settings/benefit-tracking');
  }

  const preferences = await prisma.benefitTrackingPreference.findMany({
    where: { userId: session.user.id, mode: { not: 'TRACK' } },
    select: {
      id: true,
      mode: true,
      creditCard: { select: { name: true, nickname: true, lastFourDigits: true } },
      predefinedBenefit: {
        select: {
          description: true,
          category: true,
          predefinedCard: { select: { name: true } },
        },
      },
      benefit: { select: { description: true, category: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const items: TrackedBenefitPreference[] = preferences.map((preference) => {
    const definition = preference.predefinedBenefit ?? preference.benefit;
    const card = preference.creditCard;
    const cardLabel = card
      ? [card.nickname || card.name, card.lastFourDigits ? `••${card.lastFourDigits}` : null]
          .filter(Boolean)
          .join(' ')
      : preference.predefinedBenefit?.predefinedCard?.name ?? 'Custom benefit';

    return {
      id: preference.id,
      mode: preference.mode === 'AUTO_CLAIM' ? 'AUTO_CLAIM' : 'IGNORE',
      description: definition?.description ?? 'Unknown benefit',
      category: definition?.category ?? 'Other',
      cardLabel,
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Benefit Tracking"
        description="Benefits you have set to claim automatically or ignore entirely."
      />
      <BenefitTrackingClient preferences={items} />
    </div>
  );
}
