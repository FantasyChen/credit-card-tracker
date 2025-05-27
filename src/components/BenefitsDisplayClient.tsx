'use client';

import React, { useState, useTransition } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import DraggableBenefitCard from '@/components/DraggableBenefitCard';
import BenefitCardClient from '@/components/BenefitCardClient';
import { updateBenefitOrderAction } from '@/app/benefits/actions';
import type { DisplayBenefitStatus } from '@/app/benefits/page';
import Link from 'next/link';

interface BenefitsDisplayProps {
  upcomingBenefits: DisplayBenefitStatus[];
  completedBenefits: DisplayBenefitStatus[];
  totalUnusedValue: number;
  totalUsedValue: number;
  totalAnnualFees: number;
}

export default function BenefitsDisplayClient({
  upcomingBenefits,
  completedBenefits,
  totalUnusedValue,
  totalUsedValue,
  totalAnnualFees,
}: BenefitsDisplayProps) {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [isDragMode, setIsDragMode] = useState(false);
  const [localUpcomingBenefits, setLocalUpcomingBenefits] = useState(upcomingBenefits);
  const [localCompletedBenefits, setLocalCompletedBenefits] = useState(completedBenefits);
  const [localTotalUnusedValue, setLocalTotalUnusedValue] = useState(totalUnusedValue);
  const [localTotalUsedValue, setLocalTotalUsedValue] = useState(totalUsedValue);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleStatusChange = (statusId: string, newIsCompleted: boolean) => {
    if (newIsCompleted) {
      // Moving from upcoming to completed
      const benefitToMove = localUpcomingBenefits.find(b => b.id === statusId);
      if (benefitToMove) {
        const updatedBenefit = { ...benefitToMove, isCompleted: true, completedAt: new Date() };
        setLocalUpcomingBenefits(prev => prev.filter(b => b.id !== statusId));
        setLocalCompletedBenefits(prev => [...prev, updatedBenefit]);
        
        // Update totals
        const benefitValue = benefitToMove.benefit.maxAmount || 0;
        setLocalTotalUnusedValue(prev => prev - benefitValue);
        setLocalTotalUsedValue(prev => prev + benefitValue);
      }
    } else {
      // Moving from completed to upcoming
      const benefitToMove = localCompletedBenefits.find(b => b.id === statusId);
      if (benefitToMove) {
        const updatedBenefit = { ...benefitToMove, isCompleted: false, completedAt: null };
        setLocalCompletedBenefits(prev => prev.filter(b => b.id !== statusId));
        setLocalUpcomingBenefits(prev => [...prev, updatedBenefit]);
        
        // Update totals
        const benefitValue = benefitToMove.benefit.maxAmount || 0;
        setLocalTotalUsedValue(prev => prev - benefitValue);
        setLocalTotalUnusedValue(prev => prev + benefitValue);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const isUpcomingTab = activeTab === 'upcoming';
    const items = isUpcomingTab ? localUpcomingBenefits : localCompletedBenefits;
    const setItems = isUpcomingTab ? setLocalUpcomingBenefits : setLocalCompletedBenefits;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      // Update the server with the new order
      startTransition(() => {
        updateBenefitOrderAction(newItems.map(item => item.id));
      });
    }
  };

  const toggleDragMode = () => {
    setIsDragMode(!isDragMode);
  };

  const renderBenefitsList = (benefits: DisplayBenefitStatus[]) => {
    if (benefits.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 text-gray-300 dark:text-gray-600 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {activeTab === 'upcoming' ? 'No upcoming benefits' : 'No completed benefits yet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            {activeTab === 'upcoming' 
              ? 'Add credit cards with benefits to start tracking your rewards and credits.'
              : 'Mark benefits as complete when you use them to track your ROI.'
            }
          </p>
          {activeTab === 'upcoming' && (
            <Link
              href="/cards/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Your First Card
            </Link>
          )}
        </div>
      );
    }

    if (isDragMode) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={benefits.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {benefits.map(status => (
                <DraggableBenefitCard
                  key={status.id}
                  status={status}
                  isDragMode={isDragMode}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      );
    }

    return (
      <div className="space-y-4">
        {benefits.map(status => (
          <BenefitCardClient key={status.id} status={status} onStatusChange={handleStatusChange} />
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-white">Benefits Dashboard</h1>
        <button
          onClick={toggleDragMode}
          disabled={isPending}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isDragMode
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isPending ? 'Saving...' : isDragMode ? 'Done Reordering' : 'Reorder Benefits'}
        </button>
      </div>

      {/* Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Upcoming Benefits Widget */}
        <div className="group overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 shadow-lg hover:shadow-xl transition-all duration-300 dark:from-blue-900/20 dark:to-indigo-800/20 border border-blue-200 dark:border-blue-700">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 bg-blue-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-blue-600 dark:text-blue-300">Total Value of Upcoming Benefits</dt>
                  <dd>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">${localTotalUnusedValue.toFixed(2)}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Claimed Benefits Widget */}
        <div className="group overflow-hidden rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 shadow-lg hover:shadow-xl transition-all duration-300 dark:from-green-900/20 dark:to-emerald-800/20 border border-green-200 dark:border-green-700">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 bg-green-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-green-600 dark:text-green-300">Total Value of Claimed Benefits</dt>
                  <dd>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">${localTotalUsedValue.toFixed(2)}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Annual Fee ROI Widget */}
        <div className={`group overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border ${
          localTotalUsedValue >= totalAnnualFees 
            ? 'bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-800/20 border-emerald-200 dark:border-emerald-700' 
            : 'bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-900/20 dark:to-red-800/20 border-orange-200 dark:border-orange-700'
        }`}>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300 ${
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
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className={`truncate text-sm font-medium ${
                    localTotalUsedValue >= totalAnnualFees 
                      ? 'text-emerald-600 dark:text-emerald-300' 
                      : 'text-orange-600 dark:text-orange-300'
                  }`}>
                    Annual Fee ROI
                  </dt>
                  <dd>
                    <div className="space-y-1">
                      <div className={`text-2xl font-bold ${
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
                        ${localTotalUsedValue.toFixed(2)} earned vs ${totalAnnualFees.toFixed(2)} fees
                      </div>
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDragMode && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>Reorder Mode:</strong> Drag and drop benefits to rearrange them. Your order will be saved automatically.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm 
              ${activeTab === 'upcoming' 
                ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}
            `}
          >
            Upcoming / Pending Benefits ({localUpcomingBenefits.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm 
              ${activeTab === 'completed' 
                ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}
            `}
          >
            Claimed Benefits ({localCompletedBenefits.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'upcoming' && (
          <section>
            {renderBenefitsList(localUpcomingBenefits)}
          </section>
        )}
        {activeTab === 'completed' && (
          <section>
            {renderBenefitsList(localCompletedBenefits)}
          </section>
        )}
      </div>
    </div>
  );
} 