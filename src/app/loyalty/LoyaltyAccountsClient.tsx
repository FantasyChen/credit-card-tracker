'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, AlertTriangle, Edit, Trash2, ExternalLink, Plane, Hotel, Car, CreditCard, Gift, Coins, Ticket } from 'lucide-react';
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
  expirationBasis: string | null;
  description: string | null;
  qualifyingActivities: string | null;
  website: string | null;
};

type LoyaltyAccount = {
  id: string;
  accountNumber: string | null;
  pointsBalance: number | null;
  lastActivityDate: Date;
  expirationDate: Date | null;
  isActive: boolean;
  notes: string | null;
  certificates: LoyaltyCertificate[];
  loyaltyProgram: LoyaltyProgram;
};

type LoyaltyCertificate = {
  id: string;
  label: string | null;
  quantity: number;
  expirationDate: Date;
  notes: string | null;
  isActive: boolean;
};

interface LoyaltyAccountsClientProps {
  userAccounts: LoyaltyAccount[];
  availablePrograms: LoyaltyProgram[];
}

export function LoyaltyAccountsClient({ userAccounts, availablePrograms }: LoyaltyAccountsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LoyaltyAccount | null>(null);
  const [sortMode, setSortMode] = useState<'urgency' | 'program' | 'type'>('urgency');

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

  const getDateStatus = (expirationDate: Date | null, neverExpires = false) => {
    if (neverExpires) {
      return { status: 'never', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', border: 'border-l-green-500' };
    }

    const daysUntilExpiration = calculateDaysUntilExpiration(expirationDate);
    if (daysUntilExpiration === null) return { status: 'unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', border: 'border-l-gray-400' };
    
    if (daysUntilExpiration <= 0) {
      return { status: 'expired', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', border: 'border-l-red-500' };
    } else if (daysUntilExpiration <= 30) {
      return { status: `${daysUntilExpiration} days`, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300', border: 'border-l-orange-500' };
    } else if (daysUntilExpiration <= 90) {
      return { status: `${daysUntilExpiration} days`, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', border: 'border-l-yellow-500' };
    } else {
      return { status: `${daysUntilExpiration} days`, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', border: 'border-l-green-500' };
    }
  };

  const getPointsExpirationStatus = (account: LoyaltyAccount) => {
    return getDateStatus(account.expirationDate, !account.loyaltyProgram.hasExpiration);
  };

  const getNearestCertificateExpiration = (account: LoyaltyAccount) => {
    const activeCertificates = account.certificates.filter((certificate) => certificate.isActive);
    if (activeCertificates.length === 0) return null;

    return activeCertificates.reduce<Date | null>((nearest, certificate) => {
      const expirationDate = new Date(certificate.expirationDate);
      if (!nearest || expirationDate.getTime() < nearest.getTime()) {
        return expirationDate;
      }
      return nearest;
    }, null);
  };

  const getUrgencyDate = (account: LoyaltyAccount) => {
    const candidates = [account.expirationDate, getNearestCertificateExpiration(account)]
      .filter((date): date is Date => Boolean(date));

    if (candidates.length === 0) return null;
    return candidates.reduce((nearest, date) => (
      new Date(date).getTime() < new Date(nearest).getTime() ? date : nearest
    ));
  };

  const getCardStatus = (account: LoyaltyAccount) => {
    const urgencyDate = getUrgencyDate(account);
    return getDateStatus(urgencyDate, !account.loyaltyProgram.hasExpiration && !urgencyDate);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'AIRLINE': return <Plane className="h-5 w-5" />;
      case 'HOTEL': return <Hotel className="h-5 w-5" />;
      case 'RENTAL_CAR': return <Car className="h-5 w-5" />;
      case 'CREDIT_CARD': return <CreditCard className="h-5 w-5" />;
      default: return <Gift className="h-5 w-5" />;
    }
  };

  const sortedAccounts = [...userAccounts].sort((a, b) => {
    if (sortMode === 'program') {
      return a.loyaltyProgram.displayName.localeCompare(b.loyaltyProgram.displayName);
    }

    if (sortMode === 'type') {
      return a.loyaltyProgram.type.localeCompare(b.loyaltyProgram.type)
        || a.loyaltyProgram.displayName.localeCompare(b.loyaltyProgram.displayName);
    }

    const aDays = calculateDaysUntilExpiration(getUrgencyDate(a));
    const bDays = calculateDaysUntilExpiration(getUrgencyDate(b));
    const aRank = aDays === null ? Number.POSITIVE_INFINITY : aDays;
    const bRank = bDays === null ? Number.POSITIVE_INFINITY : bDays;

    return aRank - bRank || a.loyaltyProgram.displayName.localeCompare(b.loyaltyProgram.displayName);
  });

  const formatBalance = (balance: number | null) => {
    if (balance === null || balance === undefined) return null;
    return new Intl.NumberFormat('en-US').format(balance);
  };

  const getBalanceLabel = (type: string) => type === 'AIRLINE' ? 'Miles Remaining' : 'Points Remaining';

  const totalCertificates = userAccounts.reduce((total, account) => (
    total + account.certificates
      .filter((certificate) => certificate.isActive)
      .reduce((sum, certificate) => sum + certificate.quantity, 0)
  ), 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
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
          <CardContent className="p-5">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Expiring Soon</p>
                <p className="text-2xl font-bold dark:text-white">
                  {userAccounts.filter(account => {
                    const days = calculateDaysUntilExpiration(getUrgencyDate(account));
                    return days !== null && days <= 90 && days > 0;
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                <Ticket className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Free Nights</p>
                <p className="text-2xl font-bold dark:text-white">
                  {totalCertificates}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add New Account Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-gray-950 dark:text-white">Your Loyalty Accounts</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="loyalty-sort" className="sr-only">Sort loyalty accounts</label>
          <select
            id="loyalty-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="urgency">Expiring soon</option>
            <option value="program">Program name</option>
            <option value="type">Program type</option>
          </select>
          <Button
            onClick={() => setShowAddModal(true)}
            disabled={isPending || availablePrograms.length === 0}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Program</span>
          </Button>
        </div>
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
                <p className="text-gray-500 dark:text-gray-400">Add your first loyalty program to track points, miles, and certificates.</p>
              </div>
              <Button onClick={() => setShowAddModal(true)} disabled={availablePrograms.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Program
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedAccounts.map((account) => {
            const cardStatus = getCardStatus(account);
            const pointsExpirationStatus = getPointsExpirationStatus(account);
            const balance = formatBalance(account.pointsBalance);
            const activeCertificates = account.certificates
              .filter((certificate) => certificate.isActive)
              .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());

            return (
              <Card key={account.id} className={`relative border-l-4 ${cardStatus.border}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex min-w-0 items-center space-x-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{getTypeIcon(account.loyaltyProgram.type)}</span>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg leading-snug">{account.loyaltyProgram.displayName}</CardTitle>
                        <CardDescription className="truncate">{account.loyaltyProgram.company}</CardDescription>
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
                
                <CardContent className="space-y-4">
                  {/* Account Number */}
                  {account.accountNumber && (
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Account Number</p>
                      <p className="break-all text-sm font-mono dark:text-white">{account.accountNumber}</p>
                    </div>
                  )}

                  {/* Points/Miles Balance */}
                  {balance && (
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{getBalanceLabel(account.loyaltyProgram.type)}</p>
                      <p className="flex items-center gap-1 text-sm font-semibold dark:text-white">
                        <Coins className="h-4 w-4 text-gray-500" />
                        {balance}
                      </p>
                    </div>
                  )}
                  
                  {/* Last Activity */}
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Last Activity</p>
                    <p className="text-sm dark:text-white">{new Date(account.lastActivityDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</p>
                  </div>
                  
                  {/* Expiration Status */}
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Points/Miles Expiration</p>
                    <Badge className={pointsExpirationStatus.color}>
                      {pointsExpirationStatus.status === 'never' ? 'Never expires' :
                       pointsExpirationStatus.status === 'expired' ? 'Expired' :
                       `Expires in ${pointsExpirationStatus.status}`}
                    </Badge>
                  </div>

                  {/* Free Night Certificates */}
                  {account.loyaltyProgram.type === 'HOTEL' && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Free Night Certificates</p>
                      {activeCertificates.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">None recorded</p>
                      ) : (
                        <div className="space-y-2">
                          {activeCertificates.slice(0, 3).map((certificate) => {
                            const certificateStatus = getDateStatus(certificate.expirationDate);
                            const label = certificate.label || 'Free night certificate';

                            return (
                              <div key={certificate.id} className="rounded-md bg-gray-50 p-2 dark:bg-gray-700">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 text-sm font-medium text-gray-900 dark:text-white">
                                    <span className="break-words">{label}</span>
                                    {certificate.quantity > 1 && <span className="text-gray-500 dark:text-gray-300"> x{certificate.quantity}</span>}
                                  </p>
                                  <Badge className={certificateStatus.color}>
                                    {certificateStatus.status === 'expired' ? 'Expired' : `Expires in ${certificateStatus.status}`}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(certificate.expirationDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                                </p>
                              </div>
                            );
                          })}
                          {activeCertificates.length > 3 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              +{activeCertificates.length - 3} more certificate{activeCertificates.length - 3 === 1 ? '' : 's'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
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
