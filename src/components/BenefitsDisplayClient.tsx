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

interface BenefitsDisplayProps {
  upcomingBenefits: DisplayBenefitStatus[];
  completedBenefits: DisplayBenefitStatus[];
  totalUnusedValue: number;
  totalUsedValue: number;
}

export default function BenefitsDisplayClient({
  upcomingBenefits,
  completedBenefits,
  totalUnusedValue,
  totalUsedValue,
}: BenefitsDisplayProps) {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [isDragMode, setIsDragMode] = useState(false);
  const [localUpcomingBenefits, setLocalUpcomingBenefits] = useState(upcomingBenefits);
  const [localCompletedBenefits, setLocalCompletedBenefits] = useState(completedBenefits);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const renderBenefitsList = (benefits: DisplayBenefitStatus[], emptyMessage: string) => {
    if (benefits.length === 0) {
      return <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>;
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
          <BenefitCardClient key={status.id} status={status} />
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-blue-100 border border-blue-300 p-4 rounded-lg shadow dark:bg-slate-700 dark:border-slate-600">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-slate-100">Total Value of Upcoming Benefits</h3>
          <p className="text-2xl font-bold text-blue-700 dark:text-slate-200">${totalUnusedValue.toFixed(2)}</p>
        </div>
        <div className="bg-green-100 border border-green-300 p-4 rounded-lg shadow dark:bg-gray-700 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-green-800 dark:text-gray-100">Total Value of Claimed Benefits</h3>
          <p className="text-2xl font-bold text-green-700 dark:text-gray-200">${totalUsedValue.toFixed(2)}</p>
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
            {renderBenefitsList(localUpcomingBenefits, 'No upcoming benefits found.')}
          </section>
        )}
        {activeTab === 'completed' && (
          <section>
            {renderBenefitsList(localCompletedBenefits, 'No completed benefits.')}
          </section>
        )}
      </div>
    </div>
  );
} 