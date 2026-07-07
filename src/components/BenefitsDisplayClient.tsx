'use client';

import React, { useState, useMemo } from 'react';
import BenefitCardClient from '@/components/BenefitCardClient';
import CategoryBenefitsGroup from '@/components/CategoryBenefitsGroup';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Link from 'next/link';
import { BellAlertIcon, MagnifyingGlassIcon, FunnelIcon, XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  applyBenefitDashboardFilters,
  CUSTOM_BENEFITS_CARD_NAME,
  resolveBenefitClaimedValue,
  type CardLevelRoi,
  type BenefitDashboardFrequency,
  type DisplayBenefitStatus,
} from '@/lib/benefit-dashboard';

interface BenefitsDisplayProps {
  upcomingBenefits: DisplayBenefitStatus[];
  completedBenefits: DisplayBenefitStatus[];
  notUsableBenefits: DisplayBenefitStatus[];
  scheduledBenefits: DisplayBenefitStatus[];
  totalUnusedValue: number;
  totalUsedValue: number;
  totalNotUsableValue: number;
  totalAnnualFees: number;
  cardLevelRoi?: CardLevelRoi[];
  cardCount?: number;
  notifyBenefitExpiration?: boolean;
  notifyExpirationDays?: number;
}

export default function BenefitsDisplayClient({
  upcomingBenefits,
  completedBenefits,
  notUsableBenefits,
  scheduledBenefits,
  totalUnusedValue,
  totalUsedValue,
  totalNotUsableValue,
  totalAnnualFees,
  cardLevelRoi = [],
  cardCount = 0,
  notifyBenefitExpiration = false,
  notifyExpirationDays = 7,
}: BenefitsDisplayProps) {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCardId, setFilterCardId] = useState('');
  const [filterFrequency, setFilterFrequency] = useState<BenefitDashboardFrequency>('ALL');
  const [freeNightOnly, setFreeNightOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showRoiBreakdown, setShowRoiBreakdown] = useState(false);
  const [isReminderPromptDismissed, setIsReminderPromptDismissed] = useState(false);

  const [viewMode, setViewMode] = useState<'category' | 'card'>('card');
  const [sortMode, setSortMode] = useState<'expires' | 'value' | 'card'>('expires');
  const [localUpcomingBenefits, setLocalUpcomingBenefits] = useState(upcomingBenefits);
  const [localCompletedBenefits, setLocalCompletedBenefits] = useState(completedBenefits);
  const [localNotUsableBenefits, setLocalNotUsableBenefits] = useState(notUsableBenefits);
  const [localScheduledBenefits] = useState(scheduledBenefits);
  const [localTotalUnusedValue, setLocalTotalUnusedValue] = useState(totalUnusedValue);
  const [localTotalUsedValue, setLocalTotalUsedValue] = useState(totalUsedValue);
  const [localTotalNotUsableValue, setLocalTotalNotUsableValue] = useState(totalNotUsableValue);

  // Recompute per-card claimed value from local benefits so ROI breakdown updates when user marks complete
  const cardLevelRoiLive = useMemo(() => {
    if (cardLevelRoi.length === 0) return [];
    const claimedByCard = new Map<string, number>();
    let customClaimed = 0;
    for (const status of [...localUpcomingBenefits, ...localCompletedBenefits]) {
      const used = resolveBenefitClaimedValue(status);
      const cardId = status.benefit.creditCard?.id;
      if (!cardId) {
        customClaimed += used;
        continue;
      }
      claimedByCard.set(cardId, (claimedByCard.get(cardId) ?? 0) + used);
    }
    return cardLevelRoi
      .map((row) => {
        const claimedValue = row.cardId ? (claimedByCard.get(row.cardId) ?? 0) : customClaimed;
        const netRoi = claimedValue - row.annualFee;
        return { ...row, claimedValue, netRoi };
      })
      .sort((a, b) => b.netRoi - a.netRoi || b.claimedValue - a.claimedValue);
  }, [cardLevelRoi, localUpcomingBenefits, localCompletedBenefits]);

  const reminderWindowDays = Math.max(1, notifyExpirationDays || 7);
  const reminderWindowEnd = Date.now() + reminderWindowDays * 24 * 60 * 60 * 1000;
  const expiringReminderBenefitCount = localUpcomingBenefits.filter((status) => {
    const endTime = new Date(status.cycleEndDate).getTime();
    return Number.isFinite(endTime) && endTime >= Date.now() && endTime <= reminderWindowEnd;
  }).length;
  const shouldShowReminderPrompt = cardCount > 0 && !notifyBenefitExpiration && expiringReminderBenefitCount > 0 && !isReminderPromptDismissed;

  const handleStatusChange = (statusId: string, newIsCompleted: boolean, newUsedAmount?: number) => {
    if (newIsCompleted) {
      // Moving from upcoming to completed
      const benefitToMove = localUpcomingBenefits.find(b => b.id === statusId);
      if (benefitToMove) {
        const maxAmount = benefitToMove.benefit.maxAmount || 0;
        const previousUsedAmount = benefitToMove.usedAmount ?? 0;
        const finalUsedAmount = newUsedAmount ?? maxAmount; // Default to full completion
        
        const updatedBenefit = { 
          ...benefitToMove, 
          isCompleted: true, 
          completedAt: new Date(),
          usedAmount: finalUsedAmount,
        };
        setLocalUpcomingBenefits(prev => prev.filter(b => b.id !== statusId));
        setLocalCompletedBenefits(prev => [...prev, updatedBenefit]);
        
        // Update totals: add the difference in usedAmount to totalUsedValue
        const addedValue = finalUsedAmount - previousUsedAmount;
        // Upcoming loses the remaining value, Used gains the added value
        setLocalTotalUnusedValue(prev => prev - (maxAmount - previousUsedAmount));
        setLocalTotalUsedValue(prev => prev + addedValue);
      }
    } else {
      // Moving from completed to upcoming (reset)
      const benefitToMove = localCompletedBenefits.find(b => b.id === statusId);
      if (benefitToMove) {
        const maxAmount = benefitToMove.benefit.maxAmount || 0;
        const previousUsedAmount = benefitToMove.usedAmount ?? maxAmount;
        
        const updatedBenefit = { 
          ...benefitToMove, 
          isCompleted: false, 
          completedAt: null,
          usedAmount: 0, // Reset to 0 when uncompleting
        };
        setLocalCompletedBenefits(prev => prev.filter(b => b.id !== statusId));
        setLocalUpcomingBenefits(prev => [...prev, updatedBenefit]);
        
        // Update totals
        setLocalTotalUsedValue(prev => prev - previousUsedAmount);
        setLocalTotalUnusedValue(prev => prev + maxAmount); // Full amount is now unused
      }
    }
  };

  // Handler for partial completion updates (doesn't move between tabs)
  const handlePartialCompletionChange = (statusId: string, newUsedAmount: number, isNowComplete: boolean) => {
    if (isNowComplete) {
      // Move to completed if now fully complete
      handleStatusChange(statusId, true, newUsedAmount);
    } else {
      // Stay in upcoming but update usedAmount
      setLocalUpcomingBenefits(prev => prev.map(b => {
        if (b.id === statusId) {
          const previousUsedAmount = b.usedAmount ?? 0;
          const addedValue = newUsedAmount - previousUsedAmount;
          
          // Update totals
          setLocalTotalUsedValue(v => v + addedValue);
          setLocalTotalUnusedValue(v => v - addedValue);
          
          return { ...b, usedAmount: newUsedAmount };
        }
        return b;
      }));
    }
  };

  const handleNotUsableChange = (statusId: string, newIsNotUsable: boolean) => {
    if (newIsNotUsable) {
      // Moving from upcoming to not usable
      const benefitToMove = localUpcomingBenefits.find(b => b.id === statusId);
      if (benefitToMove) {
        const updatedBenefit = { ...benefitToMove, isNotUsable: true, isCompleted: false, completedAt: null };
        setLocalUpcomingBenefits(prev => prev.filter(b => b.id !== statusId));
        setLocalNotUsableBenefits(prev => [...prev, updatedBenefit]);
        
        // Update totals
        const benefitValue = benefitToMove.benefit.maxAmount || 0;
        setLocalTotalUnusedValue(prev => prev - benefitValue);
        setLocalTotalNotUsableValue(prev => prev + benefitValue);
      }
    } else {
      // Moving from not usable back to upcoming
      const benefitToMove = localNotUsableBenefits.find(b => b.id === statusId);
      if (benefitToMove) {
        const updatedBenefit = { ...benefitToMove, isNotUsable: false };
        setLocalNotUsableBenefits(prev => prev.filter(b => b.id !== statusId));
        setLocalUpcomingBenefits(prev => [...prev, updatedBenefit]);
        
        // Update totals
        const benefitValue = benefitToMove.benefit.maxAmount || 0;
        setLocalTotalNotUsableValue(prev => prev - benefitValue);
        setLocalTotalUnusedValue(prev => prev + benefitValue);
      }
    }
  };

  const handleDeleteBenefit = (benefitId: string) => {
    // Remove from all lists based on benefit ID
    const findAndRemove = (list: DisplayBenefitStatus[]) => 
      list.filter(b => b.benefit.id !== benefitId);
    
    // Find the benefit to get its value for updating totals
    const allBenefits = [...localUpcomingBenefits, ...localCompletedBenefits, ...localNotUsableBenefits];
    const deletedBenefit = allBenefits.find(b => b.benefit.id === benefitId);
    
    if (deletedBenefit) {
      const maxAmount = deletedBenefit.benefit.maxAmount || 0;
      const usedAmount = deletedBenefit.usedAmount ?? 0;
      
      if (localUpcomingBenefits.some(b => b.benefit.id === benefitId)) {
        setLocalUpcomingBenefits(findAndRemove);
        // For upcoming: remove remaining unused value and any partial used value
        setLocalTotalUnusedValue(prev => prev - (maxAmount - usedAmount));
        setLocalTotalUsedValue(prev => prev - usedAmount);
      } else if (localCompletedBenefits.some(b => b.benefit.id === benefitId)) {
        setLocalCompletedBenefits(findAndRemove);
        // For completed: remove the used amount
        setLocalTotalUsedValue(prev => prev - usedAmount);
      } else if (localNotUsableBenefits.some(b => b.benefit.id === benefitId)) {
        setLocalNotUsableBenefits(findAndRemove);
        setLocalTotalNotUsableValue(prev => prev - maxAmount);
      }
    }
  };



  const setCategoryView = () => setViewMode('category');
  const setCardView = () => setViewMode('card');

  // Filter benefits by search and filters
  const filterBenefits = (benefits: DisplayBenefitStatus[]): DisplayBenefitStatus[] => {
    return benefits.filter((status) => {
      const descMatch =
        !searchQuery.trim() ||
        status.benefit.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (status.benefit.creditCard?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (status.benefit.creditCard?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (status.benefit.creditCard?.lastFourDigits?.includes(searchQuery.trim()) ?? false) ||
        status.benefit.category.toLowerCase().includes(searchQuery.toLowerCase());
      const categoryMatch = !filterCategory || status.benefit.category === filterCategory;
      const cardKey = status.benefit.creditCard?.id ?? CUSTOM_BENEFITS_CARD_NAME;
      const cardMatch = !filterCardId || cardKey === filterCardId;
      return descMatch && categoryMatch && cardMatch;
    });
  };

  const sortBenefits = (benefits: DisplayBenefitStatus[]): DisplayBenefitStatus[] => {
    return [...benefits].sort((a, b) => {
      if (sortMode === 'value') {
        return (b.benefit.maxAmount || 0) - (a.benefit.maxAmount || 0)
          || new Date(a.cycleEndDate).getTime() - new Date(b.cycleEndDate).getTime();
      }

      if (sortMode === 'card') {
        const aCard = a.benefit.creditCard?.displayName ?? 'Custom Benefits';
        const bCard = b.benefit.creditCard?.displayName ?? 'Custom Benefits';
        return aCard.localeCompare(bCard)
          || new Date(a.cycleEndDate).getTime() - new Date(b.cycleEndDate).getTime();
      }

      return new Date(a.cycleEndDate).getTime() - new Date(b.cycleEndDate).getTime()
        || (b.benefit.maxAmount || 0) - (a.benefit.maxAmount || 0);
    });
  };

  // Get unique categories and cards from all benefits for filter dropdowns
  const allBenefitsForTab = useMemo(() => {
    switch (activeTab) {
      case 'upcoming':
        return localUpcomingBenefits;
      case 'completed':
        return localCompletedBenefits;
      case 'not-usable':
        return localNotUsableBenefits;
      case 'scheduled':
        return localScheduledBenefits;
      default:
        return [];
    }
  }, [activeTab, localUpcomingBenefits, localCompletedBenefits, localNotUsableBenefits, localScheduledBenefits]);

  const uniqueCategories = useMemo(
    () => Array.from(new Set(allBenefitsForTab.map((b) => b.benefit.category))).sort(),
    [allBenefitsForTab]
  );
  const uniqueCards = useMemo(() => {
    const cards = new Map<string, string>();
    for (const benefit of allBenefitsForTab) {
      const card = benefit.benefit.creditCard;
      if (!card) {
        cards.set(CUSTOM_BENEFITS_CARD_NAME, CUSTOM_BENEFITS_CARD_NAME);
        continue;
      }
      cards.set(card.id, card.displayName);
    }

    return Array.from(cards.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => {
        if (a.id === CUSTOM_BENEFITS_CARD_NAME) return -1;
        if (b.id === CUSTOM_BENEFITS_CARD_NAME) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [allBenefitsForTab]);

  const hasActiveFilters = searchQuery.trim() || filterCategory || filterCardId || filterFrequency !== 'ALL' || freeNightOnly;
  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterCardId('');
    setFilterFrequency('ALL');
    setFreeNightOnly(false);
  };

  const applyPowerUserFilters = (benefits: DisplayBenefitStatus[]): DisplayBenefitStatus[] => {
    return applyBenefitDashboardFilters(benefits, {
      frequency: filterFrequency,
      freeNightOnly,
    });
  };

  // Group benefits by category
  const groupBenefitsByCategory = (benefits: DisplayBenefitStatus[]) => {
    const grouped = benefits.reduce((acc, benefit) => {
      const category = benefit.benefit.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(benefit);
      return acc;
    }, {} as Record<string, DisplayBenefitStatus[]>);

    // Sort categories by total value (descending)
    return Object.entries(grouped).sort(([, a], [, b]) => {
      const aTotal = a.reduce((sum, benefit) => sum + (benefit.benefit.maxAmount || 0), 0);
      const bTotal = b.reduce((sum, benefit) => sum + (benefit.benefit.maxAmount || 0), 0);
      return bTotal - aTotal;
    });
  };

  // Group benefits by credit card (handles null creditCard for custom benefits).
  // Use card IDs as group keys so multiple copies of the same card stay distinct even
  // if they share the same card name or nickname.
  const groupBenefitsByCard = (benefits: DisplayBenefitStatus[]) => {
    const grouped = benefits.reduce((acc, benefit) => {
      const card = benefit.benefit.creditCard;
      const cardGroupKey = card?.id ?? CUSTOM_BENEFITS_CARD_NAME;
      const cardGroupLabel = card?.displayName || CUSTOM_BENEFITS_CARD_NAME;
      if (!acc[cardGroupKey]) {
        acc[cardGroupKey] = { label: cardGroupLabel, benefits: [] };
      }
      acc[cardGroupKey].benefits.push(benefit);
      return acc;
    }, {} as Record<string, { label: string; benefits: DisplayBenefitStatus[] }>);

    // Sort cards by total value (descending), but always put "Custom Benefits" first
    return Object.entries(grouped).sort(([keyA, a], [keyB, b]) => {
      // Put custom benefits first
      if (keyA === CUSTOM_BENEFITS_CARD_NAME) return -1;
      if (keyB === CUSTOM_BENEFITS_CARD_NAME) return 1;

      const aTotal = a.benefits.reduce((sum, benefit) => sum + (benefit.benefit.maxAmount || 0), 0);
      const bTotal = b.benefits.reduce((sum, benefit) => sum + (benefit.benefit.maxAmount || 0), 0);
      return bTotal - aTotal || a.label.localeCompare(b.label) || keyA.localeCompare(keyB);
    });
  };

  const renderScheduledBenefitsList = (benefits: DisplayBenefitStatus[]) => {
    if (benefits.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No scheduled benefits.</p>
        </div>
      );
    }

    // Sort by start date (soonest first)
    const sortedBenefits = [...benefits].sort((a, b) => 
      new Date(a.cycleStartDate).getTime() - new Date(b.cycleStartDate).getTime()
    );

    return (
      <div className="space-y-4">
        {sortedBenefits.map(status => (
          <BenefitCardClient 
            key={status.id} 
            status={status} 
            onStatusChange={handleStatusChange} 
            onNotUsableChange={handleNotUsableChange}
            onDelete={handleDeleteBenefit}
            onPartialCompletionChange={handlePartialCompletionChange}
            isScheduled={true}
          />
        ))}
      </div>
    );
  };

  const renderCategoryView = (benefits: DisplayBenefitStatus[]) => {
    if (benefits.length === 0) {
      const emptyStateProps = {
        upcoming: cardCount === 0 ? {
          icon: 'credit-card' as const,
          title: 'Add your first card',
          description: 'Choose a card to create your benefit checklist. Recurring credits, reset windows, and reminders will appear here.',
          actionLabel: 'Add your first card',
          actionHref: '/cards/new',
          secondaryActionLabel: 'Browse supported cards',
          secondaryActionHref: '/cards/browse',
        } : {
          icon: 'clock' as const,
          title: 'No upcoming benefits',
          description: 'Add credit cards with benefits to start tracking your rewards and credits.',
          actionLabel: 'Add Your First Card',
          actionHref: '/cards/new',
        },
        completed: {
          icon: 'check' as const,
          title: 'No completed benefits yet',
          description: 'Mark benefits as complete when you use them to track your ROI.',
        },
        'not-usable': {
          icon: 'x-circle' as const,
          title: 'No not usable benefits',
          description: 'Benefits marked as not usable will appear here.',
        },
      };
      const props = emptyStateProps[activeTab as keyof typeof emptyStateProps] || emptyStateProps.upcoming;
      return <EmptyState {...props} />;
    }

    const categorizedBenefits = groupBenefitsByCategory(benefits);
    
    return (
      <div className="space-y-6">
        {categorizedBenefits.map(([category, categoryBenefits]) => (
          <CategoryBenefitsGroup
            key={category}
            category={category}
            benefits={categoryBenefits}
            onStatusChange={handleStatusChange}
            onNotUsableChange={handleNotUsableChange}
            onDelete={handleDeleteBenefit}
            onPartialCompletionChange={handlePartialCompletionChange}
          />
        ))}
      </div>
    );
  };

  const renderCardView = (benefits: DisplayBenefitStatus[]) => {
    if (benefits.length === 0) {
      const emptyStateProps = {
        upcoming: cardCount === 0 ? {
          icon: 'credit-card' as const,
          title: 'Add your first card',
          description: 'Choose a card to create your benefit checklist. Recurring credits, reset windows, and reminders will appear here.',
          actionLabel: 'Add your first card',
          actionHref: '/cards/new',
          secondaryActionLabel: 'Browse supported cards',
          secondaryActionHref: '/cards/browse',
        } : {
          icon: 'credit-card' as const,
          title: 'No Benefits Available',
          description: "You don't have any upcoming benefits. Add some credit cards to get started!",
          actionLabel: 'Add Credit Card',
          actionHref: '/cards/new',
        },
        completed: {
          icon: 'check' as const,
          title: 'No Benefits Available',
          description: 'No completed benefits yet. Start using your credit card benefits!',
        },
        'not-usable': {
          icon: 'x-circle' as const,
          title: 'No Benefits Available',
          description: 'No unusable benefits found.',
        },
      };
      const props = emptyStateProps[activeTab as keyof typeof emptyStateProps] || emptyStateProps.upcoming;
      return <EmptyState {...props} />;
    }

    const cardGroupedBenefits = groupBenefitsByCard(benefits);
    
    return (
      <div className="space-y-6">
        {cardGroupedBenefits.map(([cardKey, group]) => (
          <CategoryBenefitsGroup
            key={cardKey}
            category={group.label}
            benefits={group.benefits}
            onStatusChange={handleStatusChange}
            onNotUsableChange={handleNotUsableChange}
            onDelete={handleDeleteBenefit}
            onPartialCompletionChange={handlePartialCompletionChange}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Benefits Dashboard"
        description="Prioritize what expires soon, record claimed value, and keep annual fees honest."
      >
        <Link
          href="/benefits/how-to-use"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/[0.03] transition-colors hover:bg-accent"
        >
          How-to guides
        </Link>
        <Link
          href="/benefits/custom"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90"
        >
          Add custom
        </Link>
        <button
          type="button"
          onClick={setCategoryView}
          className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            viewMode === 'category'
              ? 'bg-foreground text-background'
              : 'border border-border bg-card text-foreground shadow-sm shadow-black/[0.03] hover:bg-accent'
          }`}
        >
          Group by Category
        </button>
        <button
          type="button"
          onClick={setCardView}
          className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            viewMode === 'card'
              ? 'bg-foreground text-background'
              : 'border border-border bg-card text-foreground shadow-sm shadow-black/[0.03] hover:bg-accent'
          }`}
        >
          Group by Card
        </button>
      </PageHeader>

      {shouldShowReminderPrompt && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm shadow-black/[0.03] dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <BellAlertIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                Turn on benefit expiration reminders
              </h2>
              <p className="mt-1 text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">
                You have {expiringReminderBenefitCount} benefit{expiringReminderBenefitCount === 1 ? '' : 's'} expiring in the next {reminderWindowDays} day{reminderWindowDays === 1 ? '' : 's'}. Enable reminder emails so they do not slip by.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href="/settings/notifications#notifyBenefitExpiration"
                  className="inline-flex min-h-9 items-center justify-center rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-800 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
                >
                  Enable reminders
                </Link>
                <button
                  type="button"
                  onClick={() => setIsReminderPromptDismissed(true)}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-300 bg-transparent px-3 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/40"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsReminderPromptDismissed(true)}
              className="rounded-lg p-1 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/40 dark:hover:text-amber-100"
              aria-label="Dismiss reminder prompt"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Upcoming Benefits', `$${localTotalUnusedValue.toFixed(2)}`, 'Still available this cycle'],
          ['Claimed Benefits', `$${localTotalUsedValue.toFixed(2)}`, 'Recorded as used'],
          ['Not Usable', `$${localTotalNotUsableValue.toFixed(2)}`, 'Excluded from ROI'],
          ['Annual Fee ROI', `$${(localTotalUsedValue - totalAnnualFees).toFixed(2)}`, `$${localTotalUsedValue.toFixed(2)} claimed vs $${totalAnnualFees.toFixed(2)} fees`],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/[0.03]">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>

      {/* Card-level ROI breakdown (collapsible) */}
      {cardLevelRoiLive.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-black/[0.03]">
          <button
            type="button"
            onClick={() => setShowRoiBreakdown(prev => !prev)}
            className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 active:bg-gray-200 dark:active:bg-gray-700 transition-colors cursor-pointer touch-manipulation"
            aria-expanded={showRoiBreakdown}
            aria-controls="roi-by-card-list"
          >
            <div className="text-left">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">ROI by card</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Claimed value vs annual fee per card</p>
            </div>
            <ChevronRightIcon
              className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${showRoiBreakdown ? 'rotate-90' : ''}`}
            />
          </button>
          {showRoiBreakdown && (
            <ul id="roi-by-card-list" className="divide-y divide-gray-200 dark:divide-gray-700" role="region" aria-label="ROI by card breakdown">
              {cardLevelRoiLive.map((row) => (
                <li key={row.cardName} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate">{row.cardDisplayName}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      ${row.claimedValue.toFixed(2)} claimed
                    </span>
                    <span className="text-muted-foreground">
                      ${row.annualFee.toFixed(2)} fee
                    </span>
                    <span
                      className={`font-semibold ${
                        row.netRoi >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {row.netRoi >= 0 ? '+' : ''}${row.netRoi.toFixed(2)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 overflow-x-auto border-b border-border">
        <nav className="-mb-px flex min-w-max gap-4 sm:gap-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'upcoming'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}
            `}
          >
            <span className="hidden sm:inline">Upcoming ({localUpcomingBenefits.length})</span>
            <span className="sm:hidden">Upcoming ({localUpcomingBenefits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'completed'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}
            `}
          >
            <span className="hidden sm:inline">Claimed ({localCompletedBenefits.length})</span>
            <span className="sm:hidden">Claimed ({localCompletedBenefits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('not-usable')}
            className={`flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'not-usable'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}
            `}
          >
            <span className="hidden sm:inline">Not Usable ({localNotUsableBenefits.length})</span>
            <span className="sm:hidden">Not Usable ({localNotUsableBenefits.length})</span>
          </button>
          {localScheduledBenefits.length > 0 && (
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'scheduled'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}
              `}
            >
              <span className="hidden sm:inline">Scheduled ({localScheduledBenefits.length})</span>
              <span className="sm:hidden">Scheduled ({localScheduledBenefits.length})</span>
            </button>
          )}
        </nav>
      </div>

      {/* Search & Filters */}
      <div className="mb-5 space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm shadow-black/[0.03]">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search benefits, cards, categories..."
              className="w-full rounded-lg border border-input bg-card py-2 pl-10 pr-4 text-sm text-foreground shadow-sm shadow-black/[0.02] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <label htmlFor="sort-benefits" className="sr-only">Sort benefits</label>
            <select
              id="sort-benefits"
              aria-label="Sort benefits"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
              className="min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm shadow-black/[0.02] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="expires">Expires soon</option>
              <option value="value">Highest value</option>
              <option value="card">Card name</option>
            </select>
            <label htmlFor="filter-frequency" className="sr-only">Filter by frequency</label>
            <select
              id="filter-frequency"
              aria-label="Filter by frequency"
              value={filterFrequency}
              onChange={(e) => setFilterFrequency(e.target.value as BenefitDashboardFrequency)}
              className="min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm shadow-black/[0.02] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="ALL">All cycles</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
              <option value="ONE_TIME">One-time</option>
            </select>
            <button
              type="button"
              onClick={() => setFreeNightOnly((value) => !value)}
              className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                freeNightOnly
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              }`}
              aria-pressed={freeNightOnly}
            >
              Free Night / Cert
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              <FunnelIcon className="h-5 w-5 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-background px-2 py-0.5 text-xs font-medium text-foreground">
                  on
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                title="Clear filters"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        {showFilters && (
          <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 sm:grid-cols-2">
            <div>
              <label htmlFor="filter-category" className="block text-xs font-medium text-muted-foreground mb-1">
                Category
              </label>
              <select
                id="filter-category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="block w-full sm:w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
              >
                <option value="">All categories</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-card" className="block text-xs font-medium text-muted-foreground mb-1">
                Card
              </label>
              <select
                id="filter-card"
                value={filterCardId}
                onChange={(e) => setFilterCardId(e.target.value)}
                className="block w-full sm:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
              >
                <option value="">All cards</option>
                {uniqueCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'upcoming' && (
          <section>
            {viewMode === 'category' ? renderCategoryView(sortBenefits(applyPowerUserFilters(filterBenefits(localUpcomingBenefits)))) : renderCardView(sortBenefits(applyPowerUserFilters(filterBenefits(localUpcomingBenefits))))}
          </section>
        )}
        {activeTab === 'completed' && (
          <section>
            {viewMode === 'category' ? renderCategoryView(sortBenefits(applyPowerUserFilters(filterBenefits(localCompletedBenefits)))) : renderCardView(sortBenefits(applyPowerUserFilters(filterBenefits(localCompletedBenefits))))}
          </section>
        )}
        {activeTab === 'not-usable' && (
          <section>
            {viewMode === 'category' ? renderCategoryView(sortBenefits(applyPowerUserFilters(filterBenefits(localNotUsableBenefits)))) : renderCardView(sortBenefits(applyPowerUserFilters(filterBenefits(localNotUsableBenefits))))}
          </section>
        )}
        {activeTab === 'scheduled' && (
          <section>
            <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/[0.03]">
              <p className="text-sm text-muted-foreground">
                These benefits are scheduled to start in the future. They will appear in &quot;Upcoming&quot; once their start date arrives.
              </p>
            </div>
            {renderScheduledBenefitsList(sortBenefits(applyPowerUserFilters(filterBenefits(localScheduledBenefits))))}
          </section>
        )}
      </div>
    </div>
  );
}
