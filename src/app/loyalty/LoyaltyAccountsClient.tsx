'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, AlertTriangle, Edit, Trash2, ExternalLink } from 'lucide-react';
import { addLoyaltyAccountAction, updateLoyaltyAccountAction, deleteLoyaltyAccountAction } from './actions';
import { AddLoyaltyAccountModal } from './AddLoyaltyAccountModal';
import { EditLoyaltyAccountModal } from './EditLoyaltyAccountModal';

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

interface LoyaltyAccountsClientProps {
  userAccounts: LoyaltyAccount[];
  availablePrograms: LoyaltyProgram[];
}

export function LoyaltyAccountsClient({ userAccounts, availablePrograms }: LoyaltyAccountsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LoyaltyAccount | null>(null);

  const handleAddAccount = (formData: FormData) => {
    startTransition(async () => {
      await addLoyaltyAccountAction(formData);
      setShowAddModal(false);
    });
  };

  const handleUpdateAccount = (formData: FormData) => {
    startTransition(async () => {
      await updateLoyaltyAccountAction(formData);
      setEditingAccount(null);
    });
  };

  const handleDeleteAccount = (accountId: string) => {
    if (confirm('Are you sure you want to delete this loyalty account?')) {
      startTransition(async () => {
        await deleteLoyaltyAccountAction(accountId);
      });
    }
  };

  const calculateDaysUntilExpiration = (expirationDate: Date | null) => {
    if (!expirationDate) return null;
    const today = new Date();
    const expiry = new Date(expirationDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpirationStatus = (account: LoyaltyAccount) => {
    if (!account.loyaltyProgram.hasExpiration) {
      return { status: 'never', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
    }
    
    const daysUntilExpiration = calculateDaysUntilExpiration(account.expirationDate);
    if (daysUntilExpiration === null) return { status: 'unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    
    if (daysUntilExpiration <= 0) {
      return { status: 'expired', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' };
    } else if (daysUntilExpiration <= 30) {
      return { status: `${daysUntilExpiration} days`, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' };
    } else if (daysUntilExpiration <= 90) {
      return { status: `${daysUntilExpiration} days`, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' };
    } else {
      return { status: `${daysUntilExpiration} days`, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
    }
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

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                <Plus className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Programs</p>
                <p className="text-2xl font-bold dark:text-white">{userAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Expiring Soon</p>
                <p className="text-2xl font-bold dark:text-white">
                  {userAccounts.filter(account => {
                    const days = calculateDaysUntilExpiration(account.expirationDate);
                    return days !== null && days <= 90 && days > 0;
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                <Calendar className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Never Expire</p>
                <p className="text-2xl font-bold dark:text-white">
                  {userAccounts.filter(account => !account.loyaltyProgram.hasExpiration).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add New Account Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold dark:text-white">Your Loyalty Accounts</h2>
        <Button 
          onClick={() => setShowAddModal(true)}
          disabled={isPending || availablePrograms.length === 0}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Program</span>
        </Button>
      </div>

      {/* Accounts Grid */}
      {userAccounts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-gray-100 rounded-full dark:bg-gray-700">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No loyalty programs yet</h3>
                <p className="text-gray-500 dark:text-gray-400">Add your first loyalty program to start tracking expiration dates.</p>
              </div>
              <Button onClick={() => setShowAddModal(true)} disabled={availablePrograms.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Program
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userAccounts.map((account) => {
            const expirationStatus = getExpirationStatus(account);
            return (
              <Card key={account.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getTypeIcon(account.loyaltyProgram.type)}</span>
                      <div>
                        <CardTitle className="text-lg">{account.loyaltyProgram.displayName}</CardTitle>
                        <CardDescription>{account.loyaltyProgram.company}</CardDescription>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAccount(account)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAccount(account.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Account Number */}
                  {account.accountNumber && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Account Number</p>
                      <p className="text-sm font-mono dark:text-white">{account.accountNumber}</p>
                    </div>
                  )}
                  
                  {/* Last Activity */}
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Activity</p>
                    <p className="text-sm dark:text-white">{new Date(account.lastActivityDate).toLocaleDateString()}</p>
                  </div>
                  
                  {/* Expiration Status */}
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Expiration</p>
                    <Badge className={expirationStatus.color}>
                      {expirationStatus.status === 'never' ? 'Never expires' : 
                       expirationStatus.status === 'expired' ? 'Expired' :
                       `Expires in ${expirationStatus.status}`}
                    </Badge>
                  </div>
                  
                  {/* Website Link */}
                  {account.loyaltyProgram.website && (
                    <a
                      href={account.loyaltyProgram.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Visit website <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  )}
                  
                  {/* Notes */}
                  {account.notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{account.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddLoyaltyAccountModal
          availablePrograms={availablePrograms}
          onSubmit={handleAddAccount}
          onClose={() => setShowAddModal(false)}
          isPending={isPending}
        />
      )}

      {editingAccount && (
        <EditLoyaltyAccountModal
          account={editingAccount}
          onSubmit={handleUpdateAccount}
          onClose={() => setEditingAccount(null)}
          isPending={isPending}
        />
      )}
    </div>
  );
} 