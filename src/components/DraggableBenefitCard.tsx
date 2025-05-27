'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import BenefitCardClient from '@/components/BenefitCardClient';
import type { DisplayBenefitStatus } from '@/app/benefits/page';

interface DraggableBenefitCardProps {
  status: DisplayBenefitStatus;
  isDragMode: boolean;
  onStatusChange?: (statusId: string, newIsCompleted: boolean) => void;
}

export default function DraggableBenefitCard({ status, isDragMode, onStatusChange }: DraggableBenefitCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
      {...(isDragMode ? attributes : {})}
      {...(isDragMode ? listeners : {})}
    >
      {isDragMode && (
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10">
          <div className="flex flex-col space-y-1">
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          </div>
        </div>
      )}
      <div className={isDragMode ? 'pl-6' : ''}>
        <BenefitCardClient status={status} onStatusChange={onStatusChange} />
      </div>
    </div>
  );
} 