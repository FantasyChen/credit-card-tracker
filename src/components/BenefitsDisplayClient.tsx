'use client';

import React, { useState } from 'react';
import BenefitCardClient from '@/components/BenefitCardClient';
import type { DisplayBenefitStatus } from '@/app/benefits/page'; // Ensure this path is correct

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
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'completed'

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Benefits Dashboard</h1>

      {/* Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-blue-100 border border-blue-300 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-blue-800">Total Value of Upcoming Benefits</h3>
          <p className="text-2xl font-bold text-blue-700">${totalUnusedValue.toFixed(2)}</p>
        </div>
        <div className="bg-green-100 border border-green-300 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-green-800">Total Value of Claimed Benefits</h3>
          <p className="text-2xl font-bold text-green-700">${totalUsedValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm 
              ${activeTab === 'upcoming' 
                ? 'border-indigo-500 text-indigo-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Upcoming / Pending Benefits ({upcomingBenefits.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm 
              ${activeTab === 'completed' 
                ? 'border-indigo-500 text-indigo-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Claimed Benefits ({completedBenefits.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'upcoming' && (
          <section>
            {upcomingBenefits.length === 0 ? (
              <p className="text-gray-500">No upcoming benefits found.</p>
            ) : (
              <div className="space-y-4">
                {upcomingBenefits.map(status => (
                  <BenefitCardClient key={status.id} status={status} />
                ))}
              </div>
            )}
          </section>
        )}
        {activeTab === 'completed' && (
          <section>
            {completedBenefits.length === 0 ? (
              <p className="text-gray-500">No completed benefits.</p>
            ) : (
              <div className="space-y-4">
                {completedBenefits.map(status => (
                  <BenefitCardClient key={status.id} status={status} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
} 