import React from 'react';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoyaltyAccountsClient } from './LoyaltyAccountsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Loyalty Programs - Track Points & Miles",
  description: "Track your airline miles, hotel points, and loyalty program expiration dates. Never lose points to expiration again.",
  keywords: [
    'loyalty program tracker',
    'airline miles tracker',
    'hotel points tracker',
    'points expiration',
    'miles management'
  ],
  alternates: {
    canonical: '/loyalty',
  },
};

export default async function LoyaltyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/api/auth/signin?callbackUrl=/loyalty');
  }

  // Fetch user's current loyalty accounts
  const userLoyaltyAccounts = await prisma.loyaltyAccount.findMany({
    where: { userId: session.user.id },
    include: {
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          displayName: true,
          type: true,
          company: true,
          expirationMonths: true,
          hasExpiration: true,
          description: true,
          qualifyingActivities: true,
          website: true,
        }
      }
    },
    orderBy: [
      { loyaltyProgram: { type: 'asc' } },
      { loyaltyProgram: { company: 'asc' } }
    ]
  });

  // Fetch all available loyalty programs for adding new accounts
  const availablePrograms = await prisma.loyaltyProgram.findMany({
    where: {
      id: {
        notIn: userLoyaltyAccounts.map(account => account.loyaltyProgramId)
      }
    },
    orderBy: [
      { type: 'asc' },
      { company: 'asc' }
    ]
  });

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 dark:text-white">Loyalty Programs</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your loyalty program accounts and prevent points from expiring.
        </p>
      </div>

      <LoyaltyAccountsClient 
        userAccounts={userLoyaltyAccounts}
        availablePrograms={availablePrograms}
      />
    </div>
  );
} 