'use client';

import React, { useState, useMemo } from 'react';
import BenefitCardClient from '@/components/BenefitCardClient';
import CategoryBenefitsGroup from '@/components/CategoryBenefitsGroup';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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
}: BenefitsDisplayProps) {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCard, setFilterCard] = useState('');
  const [filterFrequency, setFilterFrequency] = useState<BenefitDashboardFrequency>('ALL');
  const [freeNightOnly, setFreeNightOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showRoiBreakdown, setShowRoiBreakdown] = useState(false);

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
    for (const status of [...localUpcomingBenefits, ...localCompletedBenefits]) {
      const key = status.benefit.creditCard?.name ?? CUSTOM_BENEFITS_CARD_NAME;
      const used = resolveBenefitClaimedValue(status);
      claimedByCard.set(key, (claimedByCard.get(key) ?? 0) + used);
    }
    return cardLevelRoi
      .map((row) => {
        const claimedValue = claimedByCard.get(row.cardName) ?? 0;
        const netRoi = claimedValue - row.annualFee;
        return { ...row, claimedValue, netRoi };
      })
      .sort((a, b) => b.netRoi - a.netRoi || b.claimedValue - a.claimedValue);
  }, [cardLevelRoi, localUpcomingBenefits, localCompletedBenefits]);

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
        status.benefit.category.toLowerCase().includes(searchQuery.toLowerCase());
      const categoryMatch = !filterCategory || status.benefit.category === filterCategory;
      const cardName = status.benefit.creditCard?.name ?? CUSTOM_BENEFITS_CARD_NAME;
      const cardMatch = !filterCard || cardName === filterCard;
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
  const uniqueCards = useMemo(
    () =>
      Array.from(new Set(allBenefitsForTab.map((b) => b.benefit.creditCard?.name ?? CUSTOM_BENEFITS_CARD_NAME))).sort((a, b) => {
        if (a === CUSTOM_BENEFITS_CARD_NAME) return -1;
        if (b === CUSTOM_BENEFITS_CARD_NAME) return 1;
        return a.localeCompare(b);
      }),
    [allBenefitsForTab]
  );

  const hasActiveFilters = searchQuery.trim() || filterCategory || filterCard || filterFrequency !== 'ALL' || freeNightOnly;
  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterCard('');
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

  // Group benefits by credit card (handles null creditCard for custom benefits)
  const groupBenefitsByCard = (benefits: DisplayBenefitStatus[]) => {
    const grouped = benefits.reduce((acc, benefit) => {
      // Use "Custom Benefits" as the group name for standalone benefits
      const cardName = benefit.benefit.creditCard?.name || CUSTOM_BENEFITS_CARD_NAME;
      if (!acc[cardName]) {
        acc[cardName] = [];
      }
      acc[cardName].push(benefit);
      return acc;
    }, {} as Record<string, DisplayBenefitStatus[]>);

    // Sort cards by total value (descending), but always put "Custom Benefits" first
    return Object.entries(grouped).sort(([keyA, a], [keyB, b]) => {
      // Put custom benefits first
      if (keyA === CUSTOM_BENEFITS_CARD_NAME) return -1;
      if (keyB === CUSTOM_BENEFITS_CARD_NAME) return 1;
      
      const aTotal = a.reduce((sum, benefit) => sum + (benefit.benefit.maxAmount || 0), 0);
      const bTotal = b.reduce((sum, benefit) => sum + (benefit.benefit.maxAmount || 0), 0);
      return bTotal - aTotal;
    });
  };

  const renderScheduledBenefitsList = (benefits: DisplayBenefitStatus[]) => {
    if (benefits.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No scheduled benefits.</p>
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
        upcoming: {
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
        upcoming: {
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
        {cardGroupedBenefits.map(([cardName, cardBenefits]) => (
          <CategoryBenefitsGroup
            key={cardName}
            category={cardName}
            benefits={cardBenefits}
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
      <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-gray-800 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-3xl">Benefits Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Prioritize what expires soon, record claimed value, and keep annual fees honest.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {/* Add Custom Benefit Button */}
          <Link
            href="/benefits/custom"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <svg className="h-4 w-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Custom
          </Link>
          <button
            onClick={setCategoryView}
            className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'category' 
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200'
            }`}
          >
            <svg className="h-4 w-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H3m16 14H5" />
            </svg>
            Group by Category
          </button>
          <button
            onClick={setCardView}
            className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'card' 
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200'
            }`}
          >
            <svg className="h-4 w-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Group by Card
          </button>
        </div>
      </div>

      {/* Summary Widgets */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Upcoming Benefits Widget */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 sm:ml-5 flex-1 min-w-0">
                <dl>
                  <dt className="text-sm font-medium text-blue-600 dark:text-blue-300">Upcoming Benefits</dt>
                  <dd>
                    <div className="text-xl font-semibold tabular-nums text-gray-950 dark:text-white sm:text-2xl">${localTotalUnusedValue.toFixed(2)}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Claimed Benefits Widget */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-2 bg-green-500 rounded-lg">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 sm:ml-5 flex-1 min-w-0">
                <dl>
                  <dt className="text-sm font-medium text-green-600 dark:text-green-300">Claimed Benefits</dt>
                  <dd>
                    <div className="text-xl font-semibold tabular-nums text-gray-950 dark:text-white sm:text-2xl">${localTotalUsedValue.toFixed(2)}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Not Usable Benefits Widget */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-2 bg-gray-500 rounded-lg">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 sm:ml-5 flex-1 min-w-0">
                <dl>
                  <dt className="text-sm font-medium text-gray-600 dark:text-gray-300">Not Usable</dt>
                  <dd>
                    <div className="text-xl font-semibold tabular-nums text-gray-950 dark:text-gray-100 sm:text-2xl">${localTotalNotUsableValue.toFixed(2)}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Annual Fee ROI Widget */}
        <div className={`overflow-hidden rounded-lg border shadow-sm ${
          localTotalUsedValue >= totalAnnualFees 
            ? 'bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-700'
            : 'bg-white dark:bg-gray-800 border-orange-200 dark:border-orange-700'
        }`}>
          <div className="p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`p-2 rounded-lg ${
                  localTotalUsedValue >= totalAnnualFees 
                    ? 'bg-emerald-500' 
                    : 'bg-orange-500'
                }`}>
                  {localTotalUsedValue >= totalAnnualFees ? (
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="ml-4 sm:ml-5 flex-1 min-w-0">
                <dl>
                  <dt className={`text-sm font-medium ${
                    localTotalUsedValue >= totalAnnualFees 
                      ? 'text-emerald-600 dark:text-emerald-300' 
                      : 'text-orange-600 dark:text-orange-300'
                  }`}>
                    Annual Fee ROI
                  </dt>
                  <dd>
                    <div className="space-y-1">
                      <div className={`text-xl sm:text-2xl font-bold ${
                        localTotalUsedValue >= totalAnnualFees 
                          ? 'text-emerald-900 dark:text-emerald-100' 
                          : 'text-orange-900 dark:text-orange-100'
                      }`}>
                        ${(localTotalUsedValue - totalAnnualFees).toFixed(2)}
                      </div>
                      <div className={`text-xs ${
                        localTotalUsedValue >= totalAnnualFees 
                          ? 'text-emerald-600 dark:text-emerald-300' 
                          : 'text-orange-600 dark:text-orange-300'
                      }`}>
                        ${localTotalUsedValue.toFixed(2)} claimed vs ${totalAnnualFees.toFixed(2)} fees
                      </div>
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card-level ROI breakdown (collapsible) */}
      {cardLevelRoiLive.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setShowRoiBreakdown(prev => !prev)}
            className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 active:bg-gray-200 dark:active:bg-gray-700 transition-colors cursor-pointer touch-manipulation"
            aria-expanded={showRoiBreakdown}
            aria-controls="roi-by-card-list"
          >
            <div className="text-left">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">ROI by card</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Claimed value vs annual fee per card</p>
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
                    <span className="text-gray-500 dark:text-gray-400">
                      ${row.claimedValue.toFixed(2)} claimed
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
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
      <div className="mb-4 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm 
              ${activeTab === 'upcoming' 
                ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}
            `}
          >
            <span className="hidden sm:inline">Upcoming ({localUpcomingBenefits.length})</span>
            <span className="sm:hidden">Upcoming ({localUpcomingBenefits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm 
              ${activeTab === 'completed' 
                ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}
            `}
          >
            <span className="hidden sm:inline">Claimed ({localCompletedBenefits.length})</span>
            <span className="sm:hidden">Claimed ({localCompletedBenefits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('not-usable')}
            className={`flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm 
              ${activeTab === 'not-usable' 
                ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}
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
                  ? 'border-purple-500 text-purple-600 dark:border-purple-400 dark:text-purple-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}
              `}
            >
              <span className="hidden sm:inline">Scheduled ({localScheduledBenefits.length})</span>
              <span className="sm:hidden">Scheduled ({localScheduledBenefits.length})</span>
            </button>
          )}
        </nav>
      </div>

      {/* Search & Filters */}
      <div className="mb-5 space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search benefits, cards, categories..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <label htmlFor="sort-benefits" className="sr-only">Sort benefits</label>
            <select
              id="sort-benefits"
              aria-label="Sort benefits"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
              className="min-h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
              className="min-h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
                  ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
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
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <FunnelIcon className="h-5 w-5 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500 text-white">
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
              <label htmlFor="filter-category" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
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
              <label htmlFor="filter-card" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Card
              </label>
              <select
                id="filter-card"
                value={filterCard}
                onChange={(e) => setFilterCard(e.target.value)}
                className="block w-full sm:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
              >
                <option value="">All cards</option>
                {uniqueCards.map((card) => (
                  <option key={card} value={card}>
                    {card}
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
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-purple-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  These benefits are scheduled to start in the future. They will appear in &quot;Upcoming&quot; once their start date arrives.
                </p>
              </div>
            </div>
            {renderScheduledBenefitsList(sortBenefits(applyPowerUserFilters(filterBenefits(localScheduledBenefits))))}
          </section>
        )}
      </div>
    </div>
  );
}
