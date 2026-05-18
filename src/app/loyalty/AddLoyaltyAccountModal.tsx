'use client';

import React, { useState } from 'react';
import { X, Info, Plus, Trash2 } from 'lucide-react';
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
  expirationBasis: string | null;
  description: string | null;
  qualifyingActivities: string | null;
  website: string | null;
};

interface AddLoyaltyAccountModalProps {
  availablePrograms: LoyaltyProgram[];
  onSubmit: (formData: FormData) => void;
  onClose: () => void;
  isPending: boolean;
}

type CertificateFormRow = {
  id: string;
  label: string;
  quantity: string;
  expirationDate: string;
  notes: string;
};

function createCertificateRow(): CertificateFormRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label: '',
    quantity: '1',
    expirationDate: '',
    notes: '',
  };
}

export function AddLoyaltyAccountModal({ 
  availablePrograms, 
  onSubmit, 
  onClose, 
  isPending 
}: AddLoyaltyAccountModalProps) {
  const [selectedProgram, setSelectedProgram] = useState<LoyaltyProgram | null>(null);
  const [showActivities, setShowActivities] = useState(false);
  const [certificateRows, setCertificateRows] = useState<CertificateFormRow[]>([]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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

  const getDefaultLastActivityDate = () => {
    const today = new Date();
    today.setMonth(today.getMonth() - 1); // Default to 1 month ago
    return today.toISOString().split('T')[0];
  };

  const updateCertificateRow = (id: string, field: keyof Omit<CertificateFormRow, 'id'>, value: string) => {
    setCertificateRows((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  };

  const serializedCertificates = JSON.stringify(
    selectedProgram?.type === 'HOTEL'
      ? certificateRows
          .filter((row) => row.expirationDate)
          .map(({ label, quantity, expirationDate, notes }) => ({ label, quantity, expirationDate, notes }))
      : []
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Add Loyalty Program</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Program Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Loyalty Program *
            </label>
            <select
              name="loyaltyProgramId"
              required
              value={selectedProgram?.id || ''}
              onChange={(e) => {
                const program = availablePrograms.find(p => p.id === e.target.value);
                setSelectedProgram(program || null);
                if (program?.type !== 'HOTEL') {
                  setCertificateRows([]);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Choose a program...</option>
              {availablePrograms.map(program => (
                <option key={program.id} value={program.id}>
                  {getTypeIcon(program.type)} {program.displayName} ({program.company})
                </option>
              ))}
            </select>
          </div>

          {/* Program Details */}
          {selectedProgram && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {selectedProgram.displayName}
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedProgram.type.replace('_', ' ')}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  <strong>Expiration:</strong>{' '}
                  {selectedProgram.hasExpiration 
                    ? selectedProgram.expirationBasis === 'EARNING'
                      ? `${selectedProgram.expirationMonths} months from earning (fixed per batch)`
                      : `${selectedProgram.expirationMonths} months after last activity`
                    : 'Points/miles never expire'
                  }
                </p>
                
                {selectedProgram.description && (
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>Policy:</strong> {selectedProgram.description}
                  </p>
                )}

                {selectedProgram.qualifyingActivities && (
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
                          {JSON.parse(selectedProgram.qualifyingActivities).map((activity: string, index: number) => (
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
          )}

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account/Member Number (optional)
            </label>
            <Input
              type="text"
              name="accountNumber"
              placeholder="Enter your account number"
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This is optional and helps you identify the account
            </p>
          </div>

          {/* Points/Miles Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {selectedProgram?.type === 'AIRLINE' ? 'Miles Remaining' : 'Points Remaining'} (optional)
            </label>
            <Input
              type="number"
              name="pointsBalance"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder={selectedProgram?.type === 'AIRLINE' ? 'Enter miles balance' : 'Enter points balance'}
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Track the current balance you see in the loyalty program.
            </p>
          </div>

          {/* Last Activity Date / Oldest Earning Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {selectedProgram?.expirationBasis === 'EARNING'
                ? 'Oldest Earning Date *'
                : selectedProgram?.hasExpiration === false
                  ? 'Last Activity *'
                  : 'Last Activity Date *'}
            </label>
            <Input
              type="date"
              name="lastActivityDate"
              defaultValue={getDefaultLastActivityDate()}
              required
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {selectedProgram?.expirationBasis === 'EARNING'
                ? 'Date of your oldest unredeemed mile batch. Miles expire from earning—new activity does not extend older miles.'
                : selectedProgram?.hasExpiration === false
                  ? 'For your records only—points never expire.'
                  : 'When did you last earn or redeem points/miles? This determines your expiration date.'}
            </p>
          </div>

          {/* Free Night Certificates */}
          {selectedProgram?.type === 'HOTEL' && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <input type="hidden" name="certificates" value={serializedCertificates} />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Free Night Certificates</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Add each certificate or group with its expiration date.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCertificateRows((rows) => [...rows, createCertificateRow()])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>

              {certificateRows.length === 0 ? (
                <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                  No free night certificates recorded.
                </p>
              ) : (
                <div className="space-y-3">
                  {certificateRows.map((row) => (
                    <div key={row.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px_150px_36px]">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Label</label>
                          <Input
                            type="text"
                            value={row.label}
                            onChange={(e) => updateCertificateRow(row.id, 'label', e.target.value)}
                            placeholder="Anniversary free night"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Qty</label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={row.quantity}
                            onChange={(e) => updateCertificateRow(row.id, 'quantity', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Expires</label>
                          <Input
                            type="date"
                            value={row.expirationDate}
                            onChange={(e) => updateCertificateRow(row.id, 'expirationDate', e.target.value)}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCertificateRows((rows) => rows.filter((item) => item.id !== row.id))}
                            className="h-9 w-9 p-0 text-red-600 hover:text-red-700"
                            aria-label="Remove certificate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Notes</label>
                        <Input
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateCertificateRow(row.id, 'notes', e.target.value)}
                          placeholder="Optional certificate details"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Any notes about this account..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !selectedProgram}>
              {isPending ? 'Adding...' : 'Add Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
