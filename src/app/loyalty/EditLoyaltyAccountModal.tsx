'use client';

import React, { useState } from 'react';
import { X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LoyaltyProgram = {
  id: string;
  name: string;
  displayName: string;
  type: string;
  company: string;
  expirationMonths: number | null;
  hasExpiration: boolean;
  description: string | null;
  qualifyingActivities: string | null;
  website: string | null;
};

type LoyaltyAccount = {
  id: string;
  accountNumber: string | null;
  lastActivityDate: Date;
  expirationDate: Date | null;
  isActive: boolean;
  notes: string | null;
  loyaltyProgram: LoyaltyProgram;
};

interface EditLoyaltyAccountModalProps {
  account: LoyaltyAccount;
  onSubmit: (formData: FormData) => void;
  onClose: () => void;
  isPending: boolean;
}

export function EditLoyaltyAccountModal({ 
  account, 
  onSubmit, 
  onClose, 
  isPending 
}: EditLoyaltyAccountModalProps) {
  const [showActivities, setShowActivities] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append('accountId', account.id);
    onSubmit(formData);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'AIRLINE': return '✈️';
      case 'HOTEL': return '🏨';
      case 'RENTAL_CAR': return '🚗';
      case 'CREDIT_CARD': return '💳';
      default: return '🎁';
    }
  };

  const formatDateForInput = (date: Date) => {
    return new Date(date).toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Edit Loyalty Account</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Program Info (Read-only) */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getTypeIcon(account.loyaltyProgram.type)}</span>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {account.loyaltyProgram.displayName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {account.loyaltyProgram.company}
                  </p>
                </div>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {account.loyaltyProgram.type.replace('_', ' ')}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                <strong>Expiration:</strong>{' '}
                {account.loyaltyProgram.hasExpiration 
                  ? `${account.loyaltyProgram.expirationMonths} months after last activity`
                  : 'Points/miles never expire'
                }
              </p>
              
              {account.loyaltyProgram.description && (
                <p className="text-gray-600 dark:text-gray-400">
                  <strong>Policy:</strong> {account.loyaltyProgram.description}
                </p>
              )}

              {account.loyaltyProgram.qualifyingActivities && (
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowActivities(!showActivities)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-0 h-auto"
                  >
                    <Info className="h-3 w-3 mr-1" />
                    {showActivities ? 'Hide' : 'Show'} qualifying activities
                  </Button>
                  
                  {showActivities && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900 rounded-md">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Activities that reset expiration:
                      </p>
                      <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                        {JSON.parse(account.loyaltyProgram.qualifyingActivities).map((activity: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{activity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account/Member Number (optional)
            </label>
            <Input
              type="text"
              name="accountNumber"
              defaultValue={account.accountNumber || ''}
              placeholder="Enter your account number"
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This is optional and helps you identify the account
            </p>
          </div>

          {/* Last Activity Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Last Activity Date *
            </label>
            <Input
              type="date"
              name="lastActivityDate"
              defaultValue={formatDateForInput(account.lastActivityDate)}
              required
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              When did you last earn or redeem points/miles? This determines your expiration date.
            </p>
            {account.expirationDate && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Current expiration: {new Date(account.expirationDate).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={account.notes || ''}
              placeholder="Any notes about this account..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 