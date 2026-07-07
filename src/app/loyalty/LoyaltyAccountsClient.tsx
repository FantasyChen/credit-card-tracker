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
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getDateStatus = (expirationDate: Date | null, neverExpires = false) => {
    if (neverExpires) {
      return { status: 'never', color: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200', border: 'border-l-emerald-500' };
    }

    const daysUntilExpiration = calculateDaysUntilExpiration(expirationDate);
    if (daysUntilExpiration === null) return { status: 'unknown', color: 'border-border bg-muted text-muted-foreground', border: 'border-l-muted-foreground' };

    if (daysUntilExpiration <= 0) {
      return { status: 'expired', color: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200', border: 'border-l-red-500' };
    }
    if (daysUntilExpiration <= 30) {
      return { status: `${daysUntilExpiration} days`, color: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200', border: 'border-l-orange-500' };
    }
    if (daysUntilExpiration <= 90) {
      return { status: `${daysUntilExpiration} days`, color: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200', border: 'border-l-amber-500' };
    }
    return { status: `${daysUntilExpiration} days`, color: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200', border: 'border-l-emerald-500' };
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

  const getBalanceLabel = (type: string) => type === 'AIRLINE' ? 'Miles remaining' : 'Points remaining';

  const totalCertificates = userAccounts.reduce((total, account) => (
    total + account.certificates
      .filter((certificate) => certificate.isActive)
      .reduce((sum, certificate) => sum + certificate.quantity, 0)
  ), 0);

  const expiringSoonCount = userAccounts.filter(account => {
    const days = calculateDaysUntilExpiration(getUrgencyDate(account));
    return days !== null && days <= 90 && days > 0;
  }).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Programs</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{userAccounts.length}</p>
              </div>
              <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                <Plus className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{expiringSoonCount}</p>
              </div>
              <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Free Nights</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{totalCertificates}</p>
              </div>
              <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                <Ticket className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-foreground">Your loyalty accounts</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="loyalty-sort" className="sr-only">Sort loyalty accounts</label>
          <select
            id="loyalty-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm shadow-black/[0.02] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="urgency">Expiring soon</option>
            <option value="program">Program name</option>
            <option value="type">Program type</option>
          </select>
          <Button onClick={() => setShowAddModal(true)} disabled={isPending || availablePrograms.length === 0}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add program</span>
          </Button>
        </div>
      </div>

      {userAccounts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-xl bg-muted p-4 text-muted-foreground">
                <Calendar className="h-8 w-8" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">No loyalty programs yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Add your first loyalty program to track points, miles, and certificates.</p>
              </div>
              <Button onClick={() => setShowAddModal(true)} disabled={availablePrograms.length === 0}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add first program
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        {getTypeIcon(account.loyaltyProgram.type)}
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="truncate">{account.loyaltyProgram.displayName}</CardTitle>
                        <CardDescription className="truncate">{account.loyaltyProgram.company}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingAccount(account)} className="h-8 w-8 p-0" aria-label={`Edit ${account.loyaltyProgram.displayName}`}>
                        <Edit className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAccount(account.id)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700" aria-label={`Delete ${account.loyaltyProgram.displayName}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {account.accountNumber && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Account number</p>
                      <p className="mt-1 break-all font-mono text-sm text-foreground">{account.accountNumber}</p>
                    </div>
                  )}

                  {balance && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{getBalanceLabel(account.loyaltyProgram.type)}</p>
                      <p className="mt-1 flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
                        <Coins className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {balance}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Last activity</p>
                    <p className="mt-1 text-sm text-foreground">{new Date(account.lastActivityDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</p>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Points or miles expiration</p>
                    <Badge variant="outline" className={pointsExpirationStatus.color}>
                      {pointsExpirationStatus.status === 'never' ? 'Never expires' :
                       pointsExpirationStatus.status === 'expired' ? 'Expired' :
                       `Expires in ${pointsExpirationStatus.status}`}
                    </Badge>
                  </div>

                  {account.loyaltyProgram.type === 'HOTEL' && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Free Night Certificates</p>
                      {activeCertificates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None recorded</p>
                      ) : (
                        <div className="space-y-2">
                          {activeCertificates.slice(0, 3).map((certificate) => {
                            const certificateStatus = getDateStatus(certificate.expirationDate);
                            const label = certificate.label || 'Free night certificate';

                            return (
                              <div key={certificate.id} className="rounded-lg border border-border bg-muted/45 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 text-sm font-medium text-foreground">
                                    <span className="break-words">{label}</span>
                                    {certificate.quantity > 1 && <span className="text-muted-foreground"> x{certificate.quantity}</span>}
                                  </p>
                                  <Badge variant="outline" className={certificateStatus.color}>
                                    {certificateStatus.status === 'expired' ? 'Expired' : `Expires in ${certificateStatus.status}`}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {new Date(certificate.expirationDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                                </p>
                              </div>
                            );
                          })}
                          {activeCertificates.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{activeCertificates.length - 3} more certificate{activeCertificates.length - 3 === 1 ? '' : 's'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {account.loyaltyProgram.website && (
                    <a
                      href={account.loyaltyProgram.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Visit website <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
                    </a>
                  )}

                  {account.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p className="mt-1 text-sm text-foreground">{account.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
