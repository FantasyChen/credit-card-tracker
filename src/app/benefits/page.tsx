import React from 'react'; // useTransition will be in the client component
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BenefitStatus, Benefit, CreditCard as PrismaCreditCard } from '@/generated/prisma';
import BenefitsDisplayClient from '@/components/BenefitsDisplayClient'; // Import the new client component
import { createCardDisplayNameMap } from '@/lib/cardDisplayUtils';
import { Metadata } from 'next';
// We will create a new client component for the list and cards
// import BenefitListClient from '@/components/BenefitListClient';

export const metadata: Metadata = {
  title: "Benefits Dashboard - Track All Your Credit Card Benefits",
  description: "Track and manage all your credit card benefits in one place. Monitor upcoming credits, expiring benefits, and maximize your annual fee ROI.",
  keywords: [
    'credit card benefits dashboard',
    'track credit card benefits',
    'benefits tracker',
    'credit card perks',
    'annual fee ROI'
  ],
  alternates: {
    canonical: '/benefits',
  },
}; 

// Type for CreditCard that includes its displayName (can be null for standalone benefits)
interface CreditCardWithDisplayName extends PrismaCreditCard {
  displayName: string;
}

// Type for standalone (custom) benefits without a card
interface StandaloneBenefitDisplay {
  displayName: string;
  isCustomBenefit: true;
}

// Updated Type combining BenefitStatus with Benefit and Card details (with displayName) for display
// creditCard can be null for standalone/custom benefits
export interface DisplayBenefitStatus extends BenefitStatus { // Export for use in client component
  benefit: Benefit & { 
    creditCard: CreditCardWithDisplayName | null;
  };
  usageWaySlug?: string | null; // Add optional usage way slug
  isCustomBenefit?: boolean; // Flag to indicate this is a custom/standalone benefit
}

export default async function BenefitsDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/benefits');
  }
  const userId = session.user.id;
  const now = new Date(); // Revert to actual system time

  // 1. Fetch all user's cards to determine display names
  const userCards = await prisma.creditCard.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      issuer: true,
      lastFourDigits: true, // Include lastFourDigits for display name generation
      nickname: true, // Include nickname for display name generation
      createdAt: true,
      updatedAt: true,
      userId: true,
      cardNumber: true,
      expiryDate: true,
      openedDate: true,
    },
  });

  // 2. Fetch all usage ways to match with benefits
  const usageWays = await prisma.benefitUsageWay.findMany({
    include: {
      predefinedBenefits: {
        select: {
          category: true,
          description: true,
        },
      },
    },
  });

  // Create a map from benefit description/category to usage way slug
  const usageWayMap = new Map<string, string>();
  usageWays.forEach((way) => {
    way.predefinedBenefits.forEach((benefit) => {
      const key = `${benefit.category}:${benefit.description}`;
      usageWayMap.set(key, way.slug);
    });
  });

  // 3. Calculate displayNames for each card using the utility function
  const cardDisplayNameMap = createCardDisplayNameMap(userCards);

  // Fetch All Relevant Benefit Statuses for Display
  const allStatusesRaw = await prisma.benefitStatus.findMany({
    where: {
      userId: userId,
    },
    include: {
      benefit: {
        include: {
          creditCard: true, 
        },
      },
    },
    orderBy: [
      {
        orderIndex: 'asc', // Primary sort by user's preferred order
      },
      {
        cycleEndDate: 'asc', // Secondary sort by cycle end date
      },
    ],
  });

  // Calculate total annual fees for user's cards (same logic as dashboard)
  const userCardsForFees = await prisma.creditCard.findMany({
    where: { userId },
    select: { name: true }
  });

  // Count the quantity of each card type for annual fee calculation
  const cardCountsForFees = userCardsForFees.reduce((acc, card) => {
    acc[card.name] = (acc[card.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalAnnualFees = await prisma.predefinedCard.findMany({
      where: {
        name: {
        in: Object.keys(cardCountsForFees)
        }
      }
    }).then(predefinedCards => {
    return predefinedCards.reduce((total, card) => {
      const quantity = cardCountsForFees[card.name] || 1;
      return total + (card.annualFee * quantity);
    }, 0);
  });

  // 4. Augment statuses with card displayName and usage way slug
  const allStatusesAugmented: DisplayBenefitStatus[] = allStatusesRaw.map(status => {
    const cardOriginal = status.benefit.creditCard;
    const isCustomBenefit = cardOriginal === null;
    
    // Look up usage way for this benefit
    const benefitKey = `${status.benefit.category}:${status.benefit.description}`;
    const usageWaySlug = usageWayMap.get(benefitKey) || null;
    
    if (isCustomBenefit) {
      // Standalone/custom benefit - no credit card associated
      return {
        ...status,
        benefit: {
          ...status.benefit,
          creditCard: null,
        },
        usageWaySlug,
        isCustomBenefit: true,
      };
    }
    
    // Regular card-based benefit
    const resolvedDisplayName = cardDisplayNameMap.get(cardOriginal.id) || cardOriginal.name;
    
    return {
      ...status,
      benefit: {
        ...status.benefit,
        creditCard: {
          ...cardOriginal,
          displayName: resolvedDisplayName,
        },
      },
      usageWaySlug,
      isCustomBenefit: false,
    };
  });

  // 5. Deduplicate benefit statuses (defense against duplicate records from timezone issues)
  // Group by (benefitId, DATE(cycleStartDate), occurrenceIndex) and keep the best record
  const deduplicatedStatuses = (() => {
    const groups = new Map<string, DisplayBenefitStatus[]>();
    
    for (const status of allStatusesAugmented) {
      // Create key using date only (not time) to catch timezone-related duplicates
      const dateOnly = new Date(status.cycleStartDate).toISOString().split('T')[0];
      const key = `${status.benefitId}|${dateOnly}|${status.occurrenceIndex}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(status);
    }
    
    // For each group, keep the "best" record
    const result: DisplayBenefitStatus[] = [];
    for (const [, statuses] of groups) {
      if (statuses.length === 1) {
        result.push(statuses[0]);
      } else {
        // Multiple records for same benefit/date/occurrence - keep the best one
        // Priority: completed > not usable > most recently updated
        const best = statuses.sort((a, b) => {
          // Prefer completed
          if (a.isCompleted && !b.isCompleted) return -1;
          if (!a.isCompleted && b.isCompleted) return 1;
          // Prefer not usable over upcoming
          if (a.isNotUsable && !b.isNotUsable) return -1;
          if (!a.isNotUsable && b.isNotUsable) return 1;
          // Prefer most recently updated
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })[0];
        result.push(best);
      }
    }
    
    return result;
  })();

  // Filter for statuses whose cycle has actually started
  const activeOrPastCycleStatuses = deduplicatedStatuses.filter(status => {
    // Ensure cycleStartDate is treated as a Date object for comparison
    const cycleStartDate = new Date(status.cycleStartDate);
    return cycleStartDate <= now;
  });

  // Filter for scheduled (future) benefits - cycle hasn't started yet
  const scheduledBenefits = deduplicatedStatuses.filter(status => {
    const cycleStartDate = new Date(status.cycleStartDate);
    return cycleStartDate > now;
  });

  // Separate benefits into categories
  const upcomingBenefits = activeOrPastCycleStatuses.filter(status => {
    const cycleStartDate = new Date(status.cycleStartDate);
    const cycleEndDate = new Date(status.cycleEndDate);
    return !status.isCompleted && !status.isNotUsable && cycleStartDate <= now && now <= cycleEndDate;
  });

  const completedBenefits = activeOrPastCycleStatuses.filter(status => status.isCompleted);

  const notUsableBenefits = activeOrPastCycleStatuses.filter(status => status.isNotUsable);

  // Calculate total values based on filtered, active/past cycle statuses
  // Use usedAmount for partial completion tracking
  const totalUnusedValue = upcomingBenefits.reduce((sum, status) => {
    // Remaining value = maxAmount - usedAmount (for partial completions)
    const maxAmount = status.benefit.maxAmount || 0;
    const usedAmount = status.usedAmount ?? 0;
    return sum + Math.max(0, maxAmount - usedAmount);
  }, 0);

  // Total used value counts usedAmount from ALL non-notUsable benefits (includes partial completions)
  const totalUsedValue = [...upcomingBenefits, ...completedBenefits].reduce((sum, status) => {
    return sum + (status.usedAmount ?? 0);
  }, 0);

  const totalNotUsableValue = notUsableBenefits.reduce((sum, status) => {
    return sum + (status.benefit.maxAmount || 0);
  }, 0);

  // --- Render Component --- 
  return (
    <BenefitsDisplayClient
      upcomingBenefits={upcomingBenefits}
      completedBenefits={completedBenefits}
      notUsableBenefits={notUsableBenefits}
      scheduledBenefits={scheduledBenefits}
      totalUnusedValue={totalUnusedValue}
      totalUsedValue={totalUsedValue}
      totalNotUsableValue={totalNotUsableValue}
      totalAnnualFees={totalAnnualFees}
    />
  );
}

// --- BenefitCard will be moved to BenefitCardClient.tsx --- 